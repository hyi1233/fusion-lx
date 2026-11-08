#!/usr/bin/env bash
#
# 把 fusion-music 的 Folia WebView 构建产物同步到 Android assets。
#
#   scripts/sync-folia-webview.sh [fusion-music 仓库路径]
#
# 产物目录：fusion-music/dist-webview/ → android/app/src/main/assets/folia/
# 页面入口：folia-webview.html（里面用相对路径 './assets/...' 引 chunk）
#
# 说明：
#   * Folia 页面是 ES module 脚本，monet 模式还用 module worker，
#     Android 的 file:// 下 Chromium 会拒绝加载，所以原生侧用进程内 HTTP 服务器
#     （FoliaAssetServerModule）把这些文件按同源资源提供出去。
#   * 产物默认已经提交进本仓库（android/app/src/main/assets/folia/），
#     CI 与普通 clone 都能直接构建；这个脚本用于跟随 fusion-music 的更新。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${1:-${ROOT_DIR}/../fusion-music}"
SRC_DIST="${SRC_DIR}/dist-webview"
DEST_DIR="${ROOT_DIR}/android/app/src/main/assets/folia"

if [ ! -d "${SRC_DIST}" ]; then
  echo "找不到 ${SRC_DIST}"
  echo "用法：scripts/sync-folia-webview.sh [fusion-music 仓库路径]"
  exit 1
fi

mkdir -p "${DEST_DIR}"
rsync -a --delete "${SRC_DIST}/" "${DEST_DIR}/"

echo "已同步："
echo "  ${SRC_DIST} → ${DEST_DIR}"
find "${DEST_DIR}" -type f | wc -l | xargs echo "  文件数："
