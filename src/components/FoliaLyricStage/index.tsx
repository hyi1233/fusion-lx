// src/components/FoliaLyricStage/index.tsx
//
// 融合点 1 的壳侧渲染体：用 WebView 全屏承载 Folia 的动态歌词引擎
// （VisualizerStage，fusion-music 的构建产物），替换洛雪播放页原来的
// FlatList + LrcLine 歌词列表。
//
// 数据流仍然完全走洛雪自己的歌词插件与播放器状态：
//   useLrcSet()   → 歌词行（洛雪 Line.time 单位是**毫秒**，发给页面前要 /1000）
//   useLrcPlay()  → 当前行（洛雪歌词引擎切行的那一瞬间，用来把页面时钟锚回来）
//   useProgress() → 播放进度（秒）
//   useIsPlay()   → 播放/暂停
// 页面上游把洛雪行自动转成 Folia 的逐字行并渲染；页面侧还会用 rAF 补成 60fps，
// 所以这边只需要 10Hz 左右地推一次当前时间。
//
// 资源加载：Folia 页面是 ES module 产物（monet 模式还用 module worker），
// Android 的 file:// 下 Chromium 会拒绝加载 module script 与 worker，
// 所以由原生模块 FoliaAssetServer 在应用进程内起一个只监听 127.0.0.1 的
// 极简静态服务器（assets/folia/），页面以同源 http://127.0.0.1:<port>/ 加载。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { WebView } from 'react-native-webview'

import { useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { getPosition } from '@/plugins/player'
import { useIsPlay, usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { startFoliaAssetServer } from '@/utils/nativeModules/folia'
import {
  isFoliaBlurLevel,
  isFoliaIntensityLevel,
  parseBridgeEvent,
  serializeBridgeCommand,
  type FoliaBridgeCommand,
  type FoliaBlurLevel,
  type FoliaIntensityLevel,
} from '@/merge/bridgeProtocol'
import { DEFAULT_FOLIA_VISUALIZER_MODE, isFoliaVisualizerMode } from './modes'

// react-native-webview 的类型是 iOS/Android/Windows 三套 props 的交叉，
// 在 RN 0.73 + TS 5.9 下交叉处会退化成 never（source/onMessage 冲突），
// 这里显式收敛成宽松类型，运行期行为不受影响。
const FoliaWebView = WebView as unknown as React.ComponentType<any>

export interface FoliaLyricStageProps {
  style?: StyleProp<ViewStyle>
}

/** 推时间的节奏：页面侧用 rAF 补到 60fps，10Hz 足够且省电。 */
const TIME_SYNC_INTERVAL = 100

/** 洛雪歌词引擎的 offset（plugins/lyric.ts 里 Lyric({ offset: 100 })，单位毫秒）。 */
const LYRIC_OFFSET_SECONDS = 0.1

/** 页面入口：Folia 页面把控制条与触摸手势留给宿主，所以这里 controls=0、tap=0。
 *  模式不放在 URL 里——切模式走 setMode 命令，避免每次切模式都重载整个 WebView。 */
const buildPageUri = (baseUrl: string, langId?: string) => {
  const lang = langId?.startsWith('zh') ? 'zh' : 'en'
  return `${baseUrl}?controls=0&tap=0&lang=${lang}`
}

/** 只有 http(s) 的封面图能给页面用；洛雪的封面多是本地路径，WebView 取不到。 */
const toWebCoverUrl = (pic?: string | null) => {
  if (!pic) return null
  return /^https?:\/\//i.test(pic) ? pic : null
}

export default function FoliaLyricStage({ style }: FoliaLyricStageProps) {
  const webViewRef = useRef<any>(null)
  const lyricLines = useLrcSet()
  const lrcPlay = useLrcPlay()
  const { nowPlayTime, maxPlayTime } = useProgress()
  const isPlay = useIsPlay()
  const musicInfo = usePlayerMusicInfo()
  const langId = useSettingValue('common.langId')
  const settingMode = useSettingValue('playDetail.style.foliaMode')
  // 设置里的模式可能来自旧版本/外部写入，非法值回落到默认模式（否则页面会回一条 error）。
  const mode = isFoliaVisualizerMode(settingMode) ? settingMode : DEFAULT_FOLIA_VISUALIZER_MODE
  const playbackRate = useSettingValue('player.playbackRate')
  // F3：背景与混乱效果的设置（写进 setting 后由这里推给页面）
  const settingCover = useSettingValue('playDetail.style.foliaCover')
  const settingBlur = useSettingValue('playDetail.style.foliaBlur')
  const settingDim = useSettingValue('playDetail.style.foliaDim')
  const settingIntensity = useSettingValue('playDetail.style.foliaIntensity')

  // 设置可能来自旧版本/外部写入，非法值回落到默认。
  const blur: FoliaBlurLevel = isFoliaBlurLevel(settingBlur) ? settingBlur : 'medium'
  const intensity: FoliaIntensityLevel = isFoliaIntensityLevel(settingIntensity) ? settingIntensity : 'normal'

  const [pageUrl, setPageUrl] = useState<string | null>(null)

  // 页面是否已经回过 ready（用 ref，避免为了一个布尔量反复重渲染 WebView）。
  const pageReadyRef = useRef(false)

  // 进度推算：洛雪的进度事件是 1Hz，这里按播放速率做线性外推，得到平滑的 10Hz 时间轴。
  const timeRef = useRef({ time: 0, at: 0 })
  useEffect(() => {
    timeRef.current = { time: nowPlayTime, at: Date.now() }
  }, [nowPlayTime])

  // 歌词行 → 页面（洛雪 ms → 秒）。
  // 洛雪的歌词引擎带 100ms 的提前量（plugins/lyric.ts 里 Lyric({ offset: 100 })，
  // 实际是"音频位置 + offset ≥ 行时间"才触发），所以这里同样减去这个偏移，
  // 让页面与洛雪的切行时刻保持一致。translation 取该行的第一段扩展歌词。
  const linesPayload = useMemo(() => {
    return lyricLines.map(line => ({
      time: Math.max(0, line.time / 1000 - LYRIC_OFFSET_SECONDS),
      text: line.text,
      translation: line.extendedLyrics?.[0],
    }))
  }, [lyricLines])

  const linesRef = useRef(linesPayload)
  linesRef.current = linesPayload
  const modeRef = useRef(mode)
  modeRef.current = mode
  const blurRef = useRef(blur)
  blurRef.current = blur
  const intensityRef = useRef(intensity)
  intensityRef.current = intensity
  const metaRef = useRef({ maxPlayTime, musicInfo })
  metaRef.current = { maxPlayTime, musicInfo }

  const sendCommand = useCallback((command: FoliaBridgeCommand) => {
    const json = serializeBridgeCommand(command)
    try {
      webViewRef.current?.injectJavaScript(`window.__FOLIA_RECEIVE__(${JSON.stringify(json)}); true;`)
    } catch (error) {
      // 页面正在重载时 inject 可能失败，忽略即可（下一次同步会补上）。
      console.warn('[FoliaLyricStage] inject failed', error)
    }
  }, [])

  const pushLines = useCallback(() => {
    const { maxPlayTime: duration, musicInfo: info } = metaRef.current
    sendCommand({
      type: 'setLines',
      lines: linesRef.current,
      duration: duration > 0 ? duration : undefined,
      songTitle: info.name ?? null,
      songArtist: info.singer ?? null,
      songAlbum: info.album ?? null,
      coverUrl: toWebCoverUrl(info.pic),
    })
  }, [sendCommand])

  const pushMode = useCallback(() => {
    sendCommand({ type: 'setMode', mode: modeRef.current })
  }, [sendCommand])

  const pushBackdrop = useCallback(() => {
    sendCommand({
      type: 'setBackdrop',
      cover: !!settingCover,
      blur: blurRef.current,
      dim: !!settingDim,
    })
  }, [sendCommand, settingCover, settingDim])

  const pushIntensity = useCallback(() => {
    sendCommand({ type: 'setIntensity', level: intensityRef.current })
  }, [sendCommand])

  const pushTime = useCallback((time: number) => {
    const { maxPlayTime: duration } = metaRef.current
    sendCommand({
      type: 'setCurrentTime',
      time,
      duration: duration > 0 ? duration : undefined,
      playing: isPlay,
    })
  }, [isPlay, sendCommand])

  // 起本地资源服务器拿到页面地址
  useEffect(() => {
    let disposed = false
    void startFoliaAssetServer().then(url => {
      // 服务器是全局共享的（竖屏/横屏两个歌词页可能同时存在），卸载时不停止它，
      // 由原生模块在进程销毁时回收。
      if (disposed) return
      setPageUrl(url)
    })
    return () => {
      disposed = true
    }
  }, [])

  // 歌词变化 → 重新发行
  useEffect(() => {
    if (!pageReadyRef.current) return
    pushLines()
  }, [linesPayload, pushLines])

  // 模式变化 → 通知页面（页面不支持的模式会回一条 error 事件）
  useEffect(() => {
    if (!pageReadyRef.current) return
    pushMode()
  }, [mode, pushMode])

  // 背景设置变化 → 通知页面
  useEffect(() => {
    if (!pageReadyRef.current) return
    pushBackdrop()
  }, [blur, pushBackdrop, settingCover, settingDim])

  // 混乱效果强度变化 → 通知页面
  useEffect(() => {
    if (!pageReadyRef.current) return
    pushIntensity()
  }, [intensity, pushIntensity])

  // 播放进度（10Hz）
  useEffect(() => {
    const timer = setInterval(() => {
      if (!pageReadyRef.current) return
      const base = timeRef.current
      const elapsed = isPlay ? ((Date.now() - base.at) / 1000) * (playbackRate || 1) : 0
      pushTime(Math.max(0, base.time + elapsed))
    }, TIME_SYNC_INTERVAL)
    return () => {
      clearInterval(timer)
    }
  }, [isPlay, playbackRate, pushTime])

  // 洛雪歌词引擎切行 → 说明播放位置可能发生过跳转（seek/换歌），
  // 这里用播放器的真实位置重新锚定页面时钟，避免页面还停在上一个位置。
  useEffect(() => {
    if (!pageReadyRef.current) return
    if (lrcPlay.line < 0) return
    let canceled = false
    void getPosition().then(position => {
      if (canceled) return
      if (typeof position !== 'number' || !Number.isFinite(position) || position < 0) return
      timeRef.current = { time: position, at: Date.now() }
      pushTime(position)
    })
    return () => {
      canceled = true
    }
  }, [lrcPlay.line, pushTime])

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    const parsed = parseBridgeEvent(event.nativeEvent.data)
    if (!parsed) return
    switch (parsed.type) {
      case 'ready':
        pageReadyRef.current = true
        pushLines()
        pushMode()
        pushBackdrop()
        pushIntensity()
        break
      case 'error':
        // 页面侧命令解析/应用失败：只记日志，不打断播放
        console.warn('[FoliaLyricStage]', parsed.message, parsed.detail ?? '')
        break
      default:
        break
    }
  }, [pushBackdrop, pushIntensity, pushLines, pushMode])

  if (!pageUrl) return <View style={[styles.container, style]} />

  return (
    <View style={[styles.container, style]}>
      <FoliaWebView
        ref={webViewRef}
        source={{ uri: buildPageUri(pageUrl, langId ?? undefined) }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        // Folia 页面是全屏画布，不需要滚动；关掉滚动与越界回弹，
        // 避免在竖屏播放页里抢走 PagerView 的滑动手势。
        scrollingEnabled={false}
        overScrollMode="never"
        onMessage={handleMessage}
        onLoadStart={() => {
          // 页面重新加载后旧的 ready 状态失效，等新的 ready 事件再重新同步。
          pageReadyRef.current = false
        }}
        style={styles.webview}
        containerStyle={styles.webviewContainer}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
})
