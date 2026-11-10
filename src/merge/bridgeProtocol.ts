// src/merge/bridgeProtocol.ts
//
// 洛雪壳（RN）这一半的桥协议：把命令发给 Folia WebView，把事件收回来。
//
// 页面那一半在 fusion-music 的 src/merge/bridgeProtocol.ts 与 src/webview/transport.ts：
//   页面 → App  走 window.ReactNativeWebView.postMessage(string)
//   App → 页面  走 injectJavaScript("window.__FOLIA_RECEIVE__('<json>')")
//
// 这里的命令只用页面已经支持的四条：setLines / setCurrentTime / setMode / showControls。
// setLines 直接发洛雪行（{time: 秒, text, translation?}），页面侧的 convertIncomingLines
// 会自动判定格式并转成 Folia 的逐字行——所以壳这边不需要复制一份转换器。

export const FOLIA_BRIDGE_VERSION = 1

/** 封面背景的模糊档位。 */
export type FoliaBlurLevel = 'weak' | 'medium' | 'strong'

/** 效果强度（混乱程度）档位：静止 / 微动 / 标准 / 狂暴。 */
export type FoliaIntensityLevel = 'still' | 'subtle' | 'normal' | 'chaotic'

export const FOLIA_BLUR_LEVELS: readonly FoliaBlurLevel[] = ['weak', 'medium', 'strong']

export const FOLIA_INTENSITY_LEVELS: readonly FoliaIntensityLevel[] = ['still', 'subtle', 'normal', 'chaotic']

export const isFoliaBlurLevel = (value: unknown): value is FoliaBlurLevel =>
  typeof value === 'string' && (FOLIA_BLUR_LEVELS as readonly string[]).includes(value)

export const isFoliaIntensityLevel = (value: unknown): value is FoliaIntensityLevel =>
  typeof value === 'string' && (FOLIA_INTENSITY_LEVELS as readonly string[]).includes(value)
export const FOLIA_BRIDGE_SOURCE = 'folia-webview'

/** 洛雪行（发给页面侧的形状）。`time` 单位是**秒**（洛雪内部是毫秒，发之前要除 1000）。 */
export interface FoliaBridgeLxLine {
  time: number
  text: string
  translation?: string
}

export interface SetLinesCommand {
  type: 'setLines'
  lines: FoliaBridgeLxLine[]
  duration?: number
  songTitle?: string | null
  songArtist?: string | null
  songAlbum?: string | null
  coverUrl?: string | null
}

export interface SetCurrentTimeCommand {
  type: 'setCurrentTime'
  time: number
  duration?: number
  playing?: boolean
}

export interface SetModeCommand {
  type: 'setMode'
  mode: string
}

export interface SetBackdropCommand {
  type: 'setBackdrop'
  /** 是否用封面图做背景层 */
  cover: boolean
  /** 封面背景的模糊强度 */
  blur: FoliaBlurLevel
  /** 是否在背景上叠一层暗化 */
  dim: boolean
}

export interface SetIntensityCommand {
  type: 'setIntensity'
  /** 效果强度（混乱程度） */
  level: FoliaIntensityLevel
}

export interface ShowControlsCommand {
  type: 'showControls'
  visible: boolean
}

export type FoliaBridgeCommand =
  | SetLinesCommand
  | SetCurrentTimeCommand
  | SetModeCommand
  | SetBackdropCommand
  | SetIntensityCommand
  | ShowControlsCommand

export type FoliaBridgeEventPayload =
  | { type: 'ready', mode: string, modes: readonly string[], hasLines: boolean }
  | { type: 'lineChange', index: number, startTime: number | null }
  | { type: 'modeChange', mode: string }
  | { type: 'controlsChange', visible: boolean }
  | { type: 'error', message: string, detail?: string }

export type FoliaBridgeEvent = FoliaBridgeEventPayload & {
  source: typeof FOLIA_BRIDGE_SOURCE
  version: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** 命令 → JSON 字符串（页面侧 parseBridgeCommand 接受字符串或对象）。 */
export const serializeBridgeCommand = (command: FoliaBridgeCommand): string => JSON.stringify(command)

/**
 * 解析页面回传的事件。非法消息返回 null（绝不抛异常，播放页不能因为一条坏消息白屏）。
 */
export const parseBridgeEvent = (input: unknown): FoliaBridgeEvent | null => {
  let value = input
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown
    } catch {
      return null
    }
  }
  if (!isRecord(value)) return null
  if (value.source !== FOLIA_BRIDGE_SOURCE) return null
  if (typeof value.type !== 'string') return null
  const version = typeof value.version === 'number' ? value.version : FOLIA_BRIDGE_VERSION
  switch (value.type) {
    case 'ready':
      return {
        type: 'ready',
        mode: typeof value.mode === 'string' ? value.mode : '',
        modes: Array.isArray(value.modes) ? value.modes.filter(m => typeof m === 'string') : [],
        hasLines: value.hasLines === true,
        source: FOLIA_BRIDGE_SOURCE,
        version,
      }
    case 'lineChange':
      return {
        type: 'lineChange',
        index: typeof value.index === 'number' ? value.index : -1,
        startTime: typeof value.startTime === 'number' ? value.startTime : null,
        source: FOLIA_BRIDGE_SOURCE,
        version,
      }
    case 'modeChange':
      return { type: 'modeChange', mode: typeof value.mode === 'string' ? value.mode : '', source: FOLIA_BRIDGE_SOURCE, version }
    case 'controlsChange':
      return { type: 'controlsChange', visible: value.visible === true, source: FOLIA_BRIDGE_SOURCE, version }
    case 'error':
      return {
        type: 'error',
        message: typeof value.message === 'string' ? value.message : 'unknown',
        detail: typeof value.detail === 'string' ? value.detail : undefined,
        source: FOLIA_BRIDGE_SOURCE,
        version,
      }
    default:
      return null
  }
}
