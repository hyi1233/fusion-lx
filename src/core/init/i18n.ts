import { createI18n } from '@/lang/i18n'
import type { I18n } from '@/lang/i18n'
import { getDeviceLanguage } from '@/utils/tools'
import { setLanguage, updateSetting } from '@/core/common'


export default async(setting: LX.AppSetting) => {
  let lang = setting['common.langId']

  global.i18n = createI18n()

  if (!lang || !global.i18n.availableLocales.includes(lang)) {
    const deviceLanguage = (await getDeviceLanguage()).toLowerCase()
    let resolvedLang: I18n['locale'] = 'en_us'
    if (typeof deviceLanguage === 'string') {
      if (/zh[-_]?.*(hant|tw|hk)/i.test(deviceLanguage)) {
        resolvedLang = 'zh_tw'
      } else if (/^zh/i.test(deviceLanguage)) {
        resolvedLang = 'zh_cn'
      } else if (global.i18n.availableLocales.includes(deviceLanguage as I18n['locale'])) {
        resolvedLang = deviceLanguage as I18n['locale']
      }
    }
    lang = resolvedLang
    updateSetting({ 'common.langId': lang })
  }
  setLanguage(lang)
}
