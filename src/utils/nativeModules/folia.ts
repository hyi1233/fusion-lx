// src/utils/nativeModules/folia.ts
//
// Folia WebView 静态资源服务器的 JS 侧封装。
//
// Android 端在应用进程内起一个只监听 127.0.0.1 的 HTTP 服务器，把打包进
// assets/folia 的 Folia WebView 产物按普通同源资源提供出去——Folia 页面是
// ES module 脚本（monet 模式还用了 module worker），file:// 下 Chromium 会拒绝加载。

import { NativeModules } from 'react-native'

interface FoliaAssetServerModule {
  start: () => Promise<string>
  stop: () => Promise<boolean>
}

const getModule = (): FoliaAssetServerModule | null =>
  (NativeModules as unknown as { FoliaAssetServer?: FoliaAssetServerModule }).FoliaAssetServer ?? null

/** 启动本地资源服务器，返回页面入口 URL；不可用（非 Android / 未注册模块）时返回 null。 */
export const startFoliaAssetServer = async(): Promise<string | null> => {
  const mod = getModule()
  if (!mod?.start) return null
  try {
    return await mod.start()
  } catch {
    return null
  }
}

/** 停止本地资源服务器（组件卸载时调用）。 */
export const stopFoliaAssetServer = async(): Promise<void> => {
  const mod = getModule()
  if (!mod?.stop) return
  try {
    await mod.stop()
  } catch {
    // ignore
  }
}
