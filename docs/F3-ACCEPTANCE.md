# F3 验收报告（V1 实测）

日期：2026-11-11（深夜两轮实测）
验收人：captain（第一轮 engine-dev2 + 第二轮 captain 亲自完整走通）
APK：`android/app/build/outputs/apk/debug/lx-music-mobile-v1.9.2-universal.apk`（73.5MB，含 JS bundle）
设备：AVD fusion_phone（Android 14 / arm64 / 1080x2340 / swiftshader 软渲染，headless）

## 结论：PASS（核心验收全过，遗留 2 项已知问题，不阻塞 F3）

## 验收项逐条

| # | 验收项 | 结果 | 证据 |
|---|--------|------|------|
| 1 | 装包独立运行（脱离 Metro） | ✅ | 含 bundle 重打包后冷启动无红屏 |
| 2 | 播放页右下浮钮 | ✅ | f3-shots/06-lyricview.png（LRC 圆钮可见） |
| 3 | 弹窗：17 模式 + 中文名/描述 | ✅ | 01-picker.png（中文）、07（英文界面同样完整） |
| 4 | 背景组：封面/压暗开关 + 模糊三档 | ✅ | 03-backdrop.png（像素化封面背景+压暗+模糊生效） |
| 5 | 混乱效果四档 | ✅ | 弹窗内 chip 全可点，切换即时生效 |
| 6 | 切模式实时生效（WebView 视觉变化） | ✅ | 05-mode-hanabi-live.png（切花火后渲染变化）、08（高亮跟随） |
| 7 | 持久化：force-stop 重启后保持 | ✅ | 两轮重启验证，弹窗选中态保持（07/08） |
| 8 | 中英文界面 | ✅ | 语言跟随系统，i18n 键齐全（04 中文 / 07 英文） |

## 两轮实测差异说明

- 第一轮（engine-dev2 + captain 前半）：中文界面（设备语言中文），凝彩→花火切换验证，截图 01-03。
- 第二轮（captain 完整链路）：license 接受 → 搜索 love → 徐佳莹 Love → 播放页 → 左滑歌词视图 → 浮钮 → 弹窗（英文界面）→ 切模式 → 重启 → 持久化复验，截图 04-08。

## 已知问题（不阻塞 F3，转入 V2/V3）

1. **App 内音频取链失败**（"换源失败，请尝试手动在搜索页指定其他来源搜索该歌曲播放"）：搜索/歌词/UI 全正常，仅音频拉流不通。模拟器+代理环境下预期内；真机联调项。→ V2 重点。
2. **模拟器 swiftshader WebGL 告警**：`no texture bound to the unit 31` / `Unsupported color format transparent`（folia-webview JS）。软渲染能力限制，真机待验证；transparent 颜色格式建议引擎侧兜底。→ V3 看一眼。
3. **弹窗语言跟随系统而非 App 内语言**：i18n 键存在，疑似 WebView 侧 locale 传递未接 App 设置。低优先级。

## 测试操作坑（复测必读）

- 裸 debug APK（67.7MB）不含 `index.android.bundle`，必红屏；必须重打包（命令见 ENGINEERING-NOTES.md）。
- 宿主 TUN 代理（Clash fake-ip）导致 App 内全部请求 Network request failed；需 `adb shell settings put global http_proxy 10.0.2.2:7890`。代理与 Metro 互斥 → 必须用自带 bundle 的包。
- 进歌词视图：播放页**中部左滑**；点封面无效；左下 LRC 图标是桌面歌词权限弹窗，别点。
- 通知权限两次弹窗：DENY / NEVER SHOW AGAIN。
- uiautomator dump 属性顺序：`text` 在 `class` 之前。
- 复测完 `adb emu kill`（CPU 释放）。

## 截图索引（docs/f3-shots/）

01-picker / 02-mode-changed / 03-backdrop（第一轮）
04-picker-detail / 05-mode-hanabi-live / 06-lyricview / 07-picker-en-persisted / 08-mode-switch-highlight（第二轮）
