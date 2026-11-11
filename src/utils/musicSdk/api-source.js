import apiSourceInfo from './api-source-info'

// import temp_api_kw from './kw/api-temp'
// import test_api_kg from './kg/api-test'
// import test_api_kw from './kw/api-test'
// import test_api_tx from './tx/api-test'
// import test_api_wy from './wy/api-test'
// import test_api_mg from './mg/api-test'

// import direct_api_kg from './kg/api-direct'
// import direct_api_kw from './kw/api-direct'
// import direct_api_tx from './tx/api-direct'
// import direct_api_wy from './wy/api-direct'
// import direct_api_mg from './mg/api-direct'

import settingState from '@/store/setting/state'


import apiSourceInfo from './api-source-info'
import settingState from '@/store/setting/state'
import { httpFetch } from '@/utils/request'

// 酷我/QQ/酷狗原生移动端取链与免签直链接口降级
const fetchKuwoUrl = (songInfo, type) => {
  const songId = songInfo.songmid || songInfo.id
  const rid = String(songId).startsWith('MUSIC_') ? songId : `MUSIC_${songId}`
  const br = type === '320k' ? '320kmp3' : type === 'flac' ? 'flac' : '128kmp3'
  const format = br === 'flac' ? 'flac' : 'mp3'
  const url = `http://antiserver.kuwo.cn/anti/s?type=convert_url3&rid=${encodeURIComponent(rid)}&format=${format}&br=${br}`
  const req = httpFetch(url)
  return {
    promise: req.promise.then(res => {
      if (res && res.body && typeof res.body === 'object' && res.body.url) {
        return { url: res.body.url, type }
      }
      if (res && typeof res.body === 'string') {
        try {
          const parsed = JSON.parse(res.body)
          if (parsed && parsed.url) return { url: parsed.url, type }
        } catch (_) {}
      }
      throw new Error('kuwo get url failed')
    }),
    cancelHttp() {
      req.cancelHttp()
    },
  }
}

const fetchKugouUrl = (songInfo, type) => {
  const hash = songInfo.hash || songInfo.songmid || songInfo.id
  const albumId = songInfo.albumId || ''
  const url = `http://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`
  const req = httpFetch(url)
  return {
    promise: req.promise.then(res => {
      let data = res?.body
      if (typeof data === 'string') {
        try { data = JSON.parse(data) } catch (_) {}
      }
      if (data && data.url) return { url: data.url, type: '128k' }
      if (data && data.backup_url && data.backup_url.length) return { url: data.backup_url[0], type: '128k' }
      throw new Error('kugou get url failed')
    }),
    cancelHttp() {
      req.cancelHttp()
    },
  }
}

const fetchTxUrl = (songInfo, type) => {
  const songmid = songInfo.strMediaMid || songInfo.songmid || songInfo.id
  const url = `https://c.y.qq.com/base/fcgi-bin/fcg_music_express_mobile3.fcg?format=json&platform=yqq&cid=205361747&songmid=${songmid}&filename=C400${songmid}.m4a&guid=126548448`
  const req = httpFetch(url)
  return {
    promise: req.promise.then(res => {
      let data = res?.body
      if (typeof data === 'string') {
        try { data = JSON.parse(data) } catch (_) {}
      }
      const vkey = data?.data?.items?.[0]?.vkey
      const filename = data?.data?.items?.[0]?.filename
      if (vkey && filename) {
        return {
          url: `http://dl.stream.qqmusic.qq.com/${filename}?vkey=${vkey}&guid=126548448&uin=0&fromtag=66`,
          type: '128k',
        }
      }
      throw new Error('tx get url failed')
    }),
    cancelHttp() {
      req.cancelHttp()
    },
  }
}

const defaultNativeApis = {
  kw: {
    getMusicUrl(songInfo, type) {
      return fetchKuwoUrl(songInfo, type)
    },
  },
  kg: {
    getMusicUrl(songInfo, type) {
      return fetchKugouUrl(songInfo, type)
    },
  },
  tx: {
    getMusicUrl(songInfo, type) {
      return fetchTxUrl(songInfo, type)
    },
  },
  wy: {
    getMusicUrl(songInfo, type) {
      const id = songInfo.songmid || songInfo.id
      return {
        promise: Promise.resolve({
          url: `https://music.163.com/song/media/outer/url?id=${id}.mp3`,
          type: '128k',
        }),
        cancelHttp() {},
      }
    },
  },
  mg: {
    getMusicUrl(songInfo, type) {
      return fetchKuwoUrl(songInfo, type)
    },
  },
  bd: {
    getMusicUrl(songInfo, type) {
      return fetchKuwoUrl(songInfo, type)
    },
  },
}

const apiList = {}
const supportQuality = {
  default: {
    kw: ['128k', '320k', 'flac'],
    kg: ['128k', '320k', 'flac'],
    tx: ['128k', '320k', 'flac'],
    wy: ['128k', '320k'],
    mg: ['128k', '320k'],
  },
}

for (const api of apiSourceInfo) {
  supportQuality[api.id] = api.supportQualitys
}

const getAPI = source => apiList[`${settingState.setting['common.apiSource']}_api_${source}`]

const apis = source => {
  if (/^user_api/.test(settingState.setting['common.apiSource'])) return global.lx.apis[source]
  const api = getAPI(source)
  if (api) return api
  if (defaultNativeApis[source]) return defaultNativeApis[source]
  throw new Error('Api is not found')
}

export { apis, supportQuality }

