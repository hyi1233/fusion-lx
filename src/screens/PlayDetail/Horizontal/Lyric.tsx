import { useCallback, useRef } from 'react'
import { useSettingValue } from '@/store/setting/hook'
import FoliaLyricStage from '@/components/FoliaLyricStage'
import PlayLine, { type PlayLineType } from '../components/PlayLine'

// 融合点 1：横屏播放页歌词视图同样替换为 Folia 动态歌词引擎，布局与控制条不变。
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
