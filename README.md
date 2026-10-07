# 工作台主题（dsh-workbench-theme）

给官方 DeepSeek Harness Web 提供一套明暗配色、APTX 胶囊标志和可选的灰原哀展示组件。可以单独安装；导航、文档等其他插件都不是它的必需依赖。

当前版本 1.3.3，适用于官方 DeepSeek Harness **0.1.7-rc.2**。

## 安装

需要 Node.js 24 和已安装的官方 `dsh` 0.1.7-rc.2。先停止目标 Profile，再安装并启动：

```sh
dsh plugin --profile web add dsh-workbench-theme
dsh web
```

用环境变量 `DSH_HOME` 指定要安装到的数据目录。也可以安装本地构建的包：`dsh plugin --profile web add /绝对路径/dsh-workbench-theme-1.3.3.tgz`。

卸载：

```sh
dsh plugin --profile web remove dsh-workbench-theme
```

重启后业务页面回到原生主题。主题不拥有、修改或删除文档、会话和业务数据。

## 功能

- **配色**：通过官方 `theme.overrideTokens()` 设置共享的明暗配色，保留原生明暗模式切换。
- **外观设置**：在「设置 → 通用 → 外观」集中提供展示素材、强度、标志和减少动态效果。选「无装饰」会关闭人物与分镜，只保留配色。
- **浏览器标签**：标题显示“比护的 AI 工作台”（英文为 `Bihu AI Workbench`），保留原生会话名称前缀和文档自定义标题。标签图标跟随标志选项，APTX 胶囊按系统明暗模式显示；选默认图标或停用主题时恢复原图标。
- **展示素材**：按通用位置分配，欢迎区用立绘，目录页头用电影分镜，侧栏用彩稿，助手与设置用银箔。设置里可以展开查看全部八种展示形式。
- **首页字标**：中文名称用 Noto Serif SC 600，`AI` 与 `Ai Haibara` 用 Cormorant Garamond 600 斜体；两份字体以固定子集随包分发，页面不连接外部字体服务。标题按鼠标所在的字逐个响应，离开 500ms 后恢复。
- **其他插件参与装饰**：业务插件可以通过通用的 open Shadow 根声明参与，规则见 [通用外观协议](docs/appearance-contract.md)。装饰代码只识别通用位置，不读取业务插件的身份、文件、会话、按钮或编辑器内容。

无装饰、减少动态效果、触屏、失焦和卸载都会让动效恢复为静态原字。

## 与导航插件的关系

主题和 [dsh-workbench-shell](https://github.com/lucky01222/dsh-workbench-shell) 互相独立，可按任意顺序安装、启停。装了导航时，主题通过导航声明的品牌槽贡献标志。

旧版导航插件保存过的外观偏好（`workbench-shell` 配置）会在首次发现时迁移一次到 `workbench-theme`，之后只以新偏好为准；用户已在新主题中做的选择优先。远程浏览器按官方规则只保留本次连接的临时偏好。

## 升级与回退

先停止目标 Profile 并备份配置，再安装目标版本并重启。主题偏好保存在宿主配置中，保留配置即可恢复。升级后建议检查首页、插件页，以及明暗、无装饰、减少动态效果、停用与重新启用。

## 兼容性与限制

- 只适配官方 Web **0.1.7-rc.2**。浏览器标题投影绑定该版本的持久 `<title>` 与产品后缀，官方首页与插件管理页有少量 DOM 适配，升级宿主后都需要重新核对。
- 停用主题会释放配色层、标志、门户、设置行、观察器与监听器，恢复其他主题或官方默认。
- Client 样式在插入页面前标记所属插件，其他插件加载或热更新不会误移除本主题的 CSS。

## 制作你自己的角色主题

仓库提供可复用的 [DSH 角色主题制作 Skill](skills/dsh-character-theme/SKILL.md)，指导支持 Agent Skills 的编码助手根据其他角色的素材和视觉风格制作独立主题。它包含角色简报、明暗配色与字标设计、源码改造地图、版本核验、生命周期验证，以及按需制作截图和展示视频的方法。

Skill 本身不包含角色图片，也不会自动安装或切换你的 DSH 主题。新主题需要准备自己的可用素材；代码的 MIT 许可不涵盖现有灰原哀图片。

在 Codex 中首次安装：先下载本仓库，再在仓库根目录执行（已有同名 Skill 时先保留自定义内容）：

```sh
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R skills/dsh-character-theme "${CODEX_HOME:-$HOME/.codex}/skills/"
```

在新会话中使用，例如：

```text
使用 $dsh-character-theme，为我的原创角色“星旅者”制作 DSH 主题。
我提供了角色立绘和标志，希望使用深蓝与暖金的明暗配色，保留无装饰模式。
先核对我的 DSH 版本，在独立目录实现新主题，并在隔离环境中验证。
```

其他支持 Agent Skills 的助手可将同一目录放入其 Skill 发现位置。此 Skill 以主题 1.3.3 / 官方 DSH 0.1.7-rc.2 为已核实参考；其他宿主版本须重新核验。当前架构建议同一 Web Profile 一次只启用一个角色主题，可与导航插件配合。

Skill 通过本仓库的 `skills/` 目录分发，`dsh plugin add dsh-workbench-theme` 只安装主题插件，不会安装这份创作 Skill。

## 开发

```sh
npm ci --omit=peer
npm run build
npm run check
npm test
npm pack
```

构建后可用 `DSH_RUNTIME_ROOT=/path/to/official-runtime npm run test:client` 在真实 rc.2 Loader/Cordis 下跑生命周期回归；与导航配对的测试需要导航的构建产物，用 `DSH_PEER_PACKAGE_ROOT` 指向它的目录。这些测试使用内存 DOM，不代替浏览器界面验收。

## 素材与许可

代码以 MIT 许可发布。**随包的人物图片不在 MIT 许可范围内**：它们是《名侦探柯南》相关的第三方作品，版权属于原权利方，本仓库不授予再分发或商用许可。字体为 SIL OFL 1.1 许可的子集。各素材的来源、裁切记录和权利说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)、`docs/fonts` 与 `docs/artwork`。
