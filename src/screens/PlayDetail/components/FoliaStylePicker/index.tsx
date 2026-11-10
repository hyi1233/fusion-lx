// src/screens/PlayDetail/components/FoliaStylePicker/index.tsx
//
// F3「歌词动态」选择器：播放页右下角的悬浮圆形按钮 + 半屏底部弹窗。
//
// 弹窗里分组列出：
//   1. 动态模式：17 种 Folia 模式（中文名 + 预览说明，当前项高亮）
//   2. 背景：封面背景开关 / 背景模糊（弱·中·强）/ 压暗背景开关
//   3. 混乱效果：静止 / 微动 / 标准 / 狂暴
//
// 选项全部写进洛雪现有的 setting（playDetail.style.folia* 命名空间），
// FoliaLyricStage 监听这些设置并通过 setMode / setBackdrop / setIntensity
// 桥命令推给 WebView 页面，所以这里只负责改设置，不直接操作 WebView。

import { useCallback, useMemo, useRef } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Popup, { type PopupType } from '@/components/common/Popup'
import Text from '@/components/common/Text'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang/i18n'
import type { Message } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import {
  FOLIA_INTENSITY_LEVELS,
  type FoliaBlurLevel,
  type FoliaIntensityLevel,
} from '@/merge/bridgeProtocol'
import { FOLIA_VISUALIZER_MODES, type FoliaVisualizerMode } from '@/components/FoliaLyricStage/modes'

const BLUR_LEVELS: FoliaBlurLevel[] = ['weak', 'medium', 'strong']

export interface FoliaStylePickerProps {
  /** 悬浮按钮的定位（横屏播放页的歌词区在右侧，需要往左挪一点）。 */
  style?: object
}

export default function FoliaStylePicker({ style }: FoliaStylePickerProps) {
  const t = useI18n()
  const theme = useTheme()
  const popupRef = useRef<PopupType>(null)

  const mode = useSettingValue('playDetail.style.foliaMode')
  const cover = useSettingValue('playDetail.style.foliaCover')
  const blur = useSettingValue('playDetail.style.foliaBlur')
  const dim = useSettingValue('playDetail.style.foliaDim')
  const intensity = useSettingValue('playDetail.style.foliaIntensity')

  const openPicker = useCallback(() => {
    popupRef.current?.setVisible(true)
  }, [])

  const setMode = useCallback((value: FoliaVisualizerMode) => {
    updateSetting({ 'playDetail.style.foliaMode': value })
  }, [])

  const setBlur = useCallback((value: FoliaBlurLevel) => {
    updateSetting({ 'playDetail.style.foliaBlur': value })
  }, [])

  const setIntensity = useCallback((value: FoliaIntensityLevel) => {
    updateSetting({ 'playDetail.style.foliaIntensity': value })
  }, [])

  const modeItems = useMemo(() => {
    return FOLIA_VISUALIZER_MODES.map(m => ({
      id: m,
      name: t(`play_detail_setting_folia_mode_${m}` as keyof Message),
      desc: t(`play_detail_folia_mode_desc_${m}` as keyof Message),
    }))
  }, [t])

  const blurItems = useMemo(() => {
    return BLUR_LEVELS.map(l => ({ id: l, name: t(`play_detail_folia_blur_${l}` as keyof Message) }))
  }, [t])

  const intensityItems = useMemo(() => {
    return FOLIA_INTENSITY_LEVELS.map(l => ({ id: l, name: t(`play_detail_folia_intensity_${l}` as keyof Message) }))
  }, [t])

  return (
    <>
      <View style={[styles.floating, style]} pointerEvents="box-none">
        <TouchableOpacity style={styles.floatingBtn} onPress={openPicker}>
          <Icon name="lyric-on" size={20} style={{ color: theme['c-primary'] }} />
        </TouchableOpacity>
      </View>
      <Popup ref={popupRef} position="bottom" title={t('play_detail_folia_picker_title')}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Text size={13} style={styles.groupTitle}>{t('play_detail_folia_group_mode')}</Text>
          <View style={styles.modeList}>
            {modeItems.map(item => {
              const active = item.id === mode
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.modeItem, active && { backgroundColor: theme['c-primary-alpha-200'] }]}
                  onPress={() => { setMode(item.id) }}
                >
                  <Text size={14} style={active ? { color: theme['c-primary'] } : undefined}>{item.name}</Text>
                  <Text size={11} style={[styles.modeDesc, { color: theme['c-500'] }]}>{item.desc}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text size={13} style={styles.groupTitle}>{t('play_detail_folia_group_backdrop')}</Text>
          <View style={styles.optionRow}>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => { updateSetting({ 'playDetail.style.foliaCover': !cover }) }}
            >
              <View style={[styles.checkbox, cover && { backgroundColor: theme['c-primary'], borderColor: theme['c-primary'] }]} />
              <Text size={14}>{t('play_detail_folia_cover')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => { updateSetting({ 'playDetail.style.foliaDim': !dim }) }}
            >
              <View style={[styles.checkbox, dim && { backgroundColor: theme['c-primary'], borderColor: theme['c-primary'] }]} />
              <Text size={14}>{t('play_detail_folia_dim')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.optionRow}>
            <Text size={13} style={{ color: theme['c-500'] }}>{t('play_detail_folia_blur')}</Text>
            {blurItems.map(item => {
              const active = item.id === blur
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.chip, active && { backgroundColor: theme['c-primary'], borderColor: theme['c-primary'] }]}
                  onPress={() => { setBlur(item.id) }}
                >
                  <Text size={12} style={active ? { color: theme['c-font'] } : undefined}>{item.name}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text size={13} style={styles.groupTitle}>{t('play_detail_folia_group_intensity')}</Text>
          <View style={styles.optionRow}>
            {intensityItems.map(item => {
              const active = item.id === intensity
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.chip, active && { backgroundColor: theme['c-primary'], borderColor: theme['c-primary'] }]}
                  onPress={() => { setIntensity(item.id) }}
                >
                  <Text size={12} style={active ? { color: theme['c-font'] } : undefined}>{item.name}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
          <View style={styles.bottomSpace} />
        </ScrollView>
      </Popup>
    </>
  )
}

const styles = createStyle({
  floating: {
    position: 'absolute',
    right: scaleSizeW(12),
    bottom: scaleSizeH(16),
  },
  floatingBtn: {
    width: scaleSizeW(42),
    height: scaleSizeW(42),
    borderRadius: scaleSizeW(21),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.18)',
  },
  scrollView: {
    maxHeight: '100%',
  },
  scrollContent: {
    paddingHorizontal: scaleSizeW(15),
    paddingBottom: scaleSizeH(10),
  },
  groupTitle: {
    marginTop: scaleSizeH(12),
    marginBottom: scaleSizeH(6),
  },
  modeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  modeItem: {
    width: '50%',
    paddingVertical: scaleSizeH(6),
    paddingHorizontal: scaleSizeW(8),
    borderRadius: 8,
    marginBottom: scaleSizeH(6),
  },
  modeDesc: {
    marginTop: scaleSizeH(2),
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: scaleSizeH(6),
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: scaleSizeW(18),
    paddingVertical: scaleSizeH(4),
  },
  checkbox: {
    width: scaleSizeW(16),
    height: scaleSizeW(16),
    borderRadius: scaleSizeW(8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.35)',
    marginRight: scaleSizeW(6),
  },
  chip: {
    paddingHorizontal: scaleSizeW(12),
    paddingVertical: scaleSizeH(4),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.25)',
    marginRight: scaleSizeW(8),
    marginBottom: scaleSizeH(6),
  },
  bottomSpace: {
    height: scaleSizeH(16),
  },
})
