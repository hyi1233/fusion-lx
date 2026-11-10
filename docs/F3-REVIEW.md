# fusion-lx 项目复盘与进度交接（2026-11-10，captain 代原成员撰写）

## 一、里程碑时间线

| 阶段 | 内容 | Commit | 状态 |
|---|---|---|---|
| F1a | fork lyswhut/lx-music-mobile（基线 v1.9.2 / RN 0.73.11）+ Android 构建链打通 + GitHub Actions CI | `0a0ca11`、`cc6abe36` | ✅ CI 绿 |
| F1b | Folia WebView 歌词层 + 洛雪→Folia Line 转换器（fusion-music 仓库，b067dcf） | b067dcf | ✅ 97/97 测试 |
| F1c | 播放页歌词视图替换为 FoliaLyricStage（WebView + 原生 asset server 127.0.0.1） | `da376a1e` | ✅ CI run 42471282906 绿 |
| F1d | 融合版构建验证（APK 63.7MB universal / 25.3MB arm64） | — | ✅ qa 通过 |
| F2a/F2b | 网页版 UI 翻新 + 音源降级链（fusion-music 仓库，237fef4 / 4b7ea39+7cd894b+03863d0） | — | ✅ 用户后定案：网页仅观察，冻结 |
| **F3** | **播放页右下角「歌词动态」弹窗选择器**（17 模式中文名/封面背景/模糊三档/压暗/混乱效果四档/三语 i18n 50 键/设置持久化；桥命令 setBackdrop/setIntensity） | **`7ecb88d6`** | ✅ 代码完成+推送，**模拟器实测未做** |

## 二、当前代码状态（本仓库 fusion-lx，github.com/hyi1233/fusion-lx）

- 工作区干净（`git status` 无未提交改动），HEAD = `7ecb88d6`。
- 最新 APK（2026-11-10 20:34 构建，含 F3）：
  - `android/app/build/outputs/apk/debug/lx-music-mobile-v1.9.2-universal.apk`（67.7MB）
  - arm64-v8a 29.3MB / armeabi-v7a 26.5MB / x86 30.9MB / x86_64 30.3MB
- fusion-music 仓库（WebView 页面源码）HEAD 含 setBackdrop/setIntensity 支持（FoliaWebViewPage.tsx:206-210）。
- 验证记录：`npx tsc --noEmit` 新代码 0 错（仓库既有 4 处 Timer 类型历史错误：src/core/player/timeoutExit.ts:35、src/plugins/player/hook.ts:126）；`npx react-native bundle` Done。

## 三、已知问题清单

1. **PlayLine 拖歌词调进度失效**（F1c 引入 WebView 后拿不到 FlatList 滚动信息；恢复需 Folia 页内 seek 桥命令）。
2. **封面仅 http(s) 可传**给 WebView；本地 file:// 封面需走原生 asset server。
3. 本机直连各音源接口被拒：onrender 按 IP 封 code:1；酷我 antiserver 403 / www illegal；QQ 匿名无 vkey；酷狗接口需签名。洛雪原版 musicSdk 的接口在 App 内才完整可用。
4. 模拟器安装冲突：APK 包名 cn.toside.music.mobile，AVD 里已装更高 versionCode 79003 同名应用 → 先 `adb uninstall cn.toside.music.mobile`。
5. fork 自带的 build-test.yml 上游 CI 必失败，非回归。

## 四、下一步落点：F3 模拟器实测验收（唯一剩余工作）

```bash
# 1. 启动模拟器（无头，省 CPU；用完必须 kill）
JAVA_HOME=/Users/caiqing/fusion-lx-env/jdk-21.0.13+9/Contents/Home
$JAVA_HOME/bin/java -version  # 确认 JDK
/Users/caiqing/fusion-lx-env/android-sdk/emulator/emulator -avd fusion_phone \
  -no-window -no-audio -gpu swiftshader_indirect &
# 2. 卸载旧包（防 INSTALL_FAILED_VERSION_DOWNGRADE）
/Users/caiqing/fusion-lx-env/android-sdk/platform-tools/adb uninstall cn.toside.music.mobile
# 3. 装新 APK
/Users/caiqing/fusion-lx-env/android-sdk/platform-tools/adb install \
  android/app/build/outputs/apk/debug/lx-music-mobile-v1.9.2-universal.apk
# 4. 启动 App → 搜歌 → 进播放页 → 验证右下角悬浮按钮 → 弹窗：
#    17 模式中文名、背景（封面/模糊弱中强/压暗）、混乱效果（静止/微动/标准/狂暴）
# 5. 切 2-3 个模式 + 改背景档 → 杀 App 重开 → 验证设置持久化
# 6. 截图 → 完事后 adb emu kill（模拟器极吃 CPU）
```

截图命名：`docs/f3-shots/01-picker.png`、`02-mode-changed.png`、`03-backdrop.png`、`04-persisted.png`。

## 五、坑速查表

- **JAVA_HOME 必须指向 Contents/Home**：`/Users/caiqing/fusion-lx-env/jdk-21.0.13+9/Contents/Home`（指到根目录会报 "Please set the JAVA_HOME variable"）。
- `android/keystore.properties` 缺失 → build.gradle:138 评估期直接失败（debug 也要写 debug 签名配置；CI 已配）。
- npm 12 禁 git 依赖 → `npm install --allow-git=all --allow-remote=all`。
- Maven Central 并发拉 aar 偶发 403 → 重跑/降并发。
- gradle 8.8 首跑需下载 gradle-8.8-all.zip（几分钟，别当卡死）。
- gradle 命令建议加 `-Dorg.gradle.java.home=$JAVA_HOME` 双保险。
- 模拟器 swiftshader 吃满 CPU → 用完 `adb emu kill`。
- AgentTeams 纪律（对下一任成员）：小步多次写文件；限流/5xx 等 60s 再试一次，连续两次失败立刻报 captain 换通道，不要反复重试。

## 六、团队成员通道故障记录（供 captain 决策）

- lx-shell（xy/minimax-m3.1flash）：openai_error PI_AI_ERROR ×2、408；"走一步停一步"型卡死。
- engine-folia（xy/deepseek-v4.1-flash-1017）：413、TRANSPORT stream 断流、**xy 通道月 token 额度已耗尽**（成员临终消息连刷"每月token额度已不足"）。
- qa（xy/kimi-k3.1-pro）：503 无通道；qa2（googel/gemini-3.8-flash-high）目前可用。
- 结论：xy 通道（minimax/deepseek 系）已不可靠，任务续接应换 googel 或其他通道成员执行。
