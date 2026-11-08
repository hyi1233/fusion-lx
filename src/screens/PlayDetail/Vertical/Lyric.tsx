import { useCallback, useRef } from 'react'
import { useSettingValue } from '@/store/setting/hook'
import FoliaLyricStage from '@/components/FoliaLyricStage'
import PlayLine, { type PlayLineType } from '../components/PlayLine'

// 融合点 1：播放页歌词视图改为 Folia 的动态歌词引擎（WebView 承载 VisualizerStage）。
// 页面布局与控制条不变，只替换歌词渲染体。
// 注：原洛雪歌词列表的 PlayLine（拖动歌词调进度）依赖 FlatList 的滚动信息，
// Folia 渲染体没有滚动列表，故这里保留组件挂载但不提供滚动信息（即不显示）。
export default () => {
  const playLineRef = useRef<PlayLineType>(null)
  const isShowLyricProgressSetting = useSettingValue('playDetail.isShowLyricProgressSetting')

  const handlePlayLine = useCallback((time: number) => {
    playLineRef.current?.setVisible(false)
    global.app_event.setProgress(time)
  }, [])

  return (
    <>
      <FoliaLyricStage />
      { isShowLyricProgressSetting ? <PlayLine ref={playLineRef} onPlayLine={handlePlayLine} /> : null }
    </>
  )
}
