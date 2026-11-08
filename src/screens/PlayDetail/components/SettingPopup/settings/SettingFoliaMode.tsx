import { useMemo } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import CheckBox from '@/components/common/CheckBox'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useI18n, type Message } from '@/lang'
import styles from './style'
import {
  FOLIA_MODE_LABEL_KEYS,
  FOLIA_VISUALIZER_MODES,
  type FoliaVisualizerMode,
} from '@/components/FoliaLyricStage/modes'

export default () => {
  const t = useI18n()
  const currentMode = useSettingValue('playDetail.style.foliaMode')

  const list = useMemo(() => {
    return FOLIA_VISUALIZER_MODES.map(id => ({
      id,
      name: t(FOLIA_MODE_LABEL_KEYS[id] as keyof Message) || id,
      active: currentMode == id,
    }))
  }, [currentMode, t])

  const setMode = (id: FoliaVisualizerMode) => {
    updateSetting({ 'playDetail.style.foliaMode': id })
  }

  return (
    <View style={styles.container}>
      <Text>{t('play_detail_setting_folia_mode')}</Text>
      <View style={styles.content}>
        <View style={styles.list}>
          {
            list.map(({ id, name, active }) => (
              <CheckBox
                key={id}
                marginBottom={3}
                check={active}
                label={name}
                onChange={() => { setMode(id) }}
                need
              />
            ))
          }
        </View>
      </View>
    </View>
  )
}
