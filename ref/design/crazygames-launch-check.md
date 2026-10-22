# CrazyGames 上架检查（Potion Siege）

检查日期：2026-10-17 · 分支 `claude/crazygames-check-a4f206` · 对照 CrazyGames 开发者文档（当日抓取）
标记：✅ 通过 · 🔧 已修复（本分支提交） · 👤 需要你处理 · ⚠️ 风险 / 需要你决定

## 构建与体积

| 项 | 要求 | 结果 | 标记 |
|---|---|---|---|
| 首次下载体积 | ≤50 MB（进移动端首页 ≤20 MB），算到第一次 gameplayStart 为止 | zip 2.4 MB，全部资源在 gameplayStart 前加载 | ✅ |
| 总体积 / 文件数 | ≤250 MB，≤1500 个文件 | 2.4 MB，38 个文件（26 张美术图、11 个资源、index.html） | ✅ |
| 相对路径 | 不能用绝对路径 | `base: './'`，美术用 `import.meta.env.BASE_URL` | ✅ |
| zip 结构 | index.html 放在 zip 根目录 | CI 产物 `dist-crazygames` 就是这样 | ✅ |
| 主 JS 包 | 无硬性要求 | 533 kB（Pixi + 游戏）；拆包可以加快首屏，可选 | ✅ |

## SDK 接入（本地 SDK 模式实测，v3.8.0）

| 项 | 结果 | 标记 |
|---|---|---|
| SDK 初始化 | 有超时保护的 init，失败时退回普通网页模式 | ✅ |
| loadingStart / loadingStop | 顺序是 loading start → adblock 检查 → 读写存档 → 设置监听 → loading stop | ✅ |
| gameplayStart / gameplayStop | 第一次点击开始时 start；菜单、结算、暂停时 stop；去重，失焦时不会误发 | ✅ |
| happytime | 原来每次胜利都发。现在只在首次通关某关、或刷新今日挑战最佳档位时发（文档要求少用） | 🔧 90eba82 |
| 激励广告 | 广告开始时静音，结束或出错时恢复；adError 不给奖励；本地模式下 started → finished | ✅ |
| 不连续播广告 | 原来结算页看完 ×2 激励广告、回主页时紧接着播插屏。现在看过激励广告的那次休息不再播插屏 | 🔧 88cc4a4 |
| 插屏广告 | 只在休息时播（结算后回主页），第一局之后不播；SDK 自己限制 3 分钟最多 1 次 | ✅ |
| Basic Launch（无广告） | 用 prefetchAd 检测 adsDisabledBasicLaunch；不播广告，直接给奖励，不会出现“点了没用”的按钮 | ✅ |
| 平台静音 | muteAudio 用单独的标记，优先于游戏内音量设置 | ✅ |
| iOS 音频 | 在 pointerdown / touchend / keydown 里 resume AudioContext | ✅ |

## 存档

| 项 | 结果 | 标记 |
|---|---|---|
| 进度存档 | 用 SDK data module（文档推荐），游客数据存在本地，登录后同步；存档远小于 1 MB | ✅ |
| data module 被关掉时 | 原来如果提交时没开“Progress Save”，存档只在内存里，刷新就丢。现在会探测，读不了就退回 localStorage | 🔧 2b10a14 |
| 提交表单里打开 **Progress Save** | 不开的话 data module 报 dataModuleDisabled，存档只留在当前浏览器 | 👤 |
| 说明 | dataModuleDisabled 是不是同步抛出，本地模式验证不了；上传后请在 QA 工具里刷新确认进度还在 | ⚠️ |

## 语言

| 项 | 结果 | 标记 |
|---|---|---|
| 语言来源 | 只看 SDK 的 `systemInfo.locale`，不支持的语言退回英文（文档要求英文必须有） | ✅ |

## 画面适配（实测截图）

| 尺寸 | 结果 | 标记 |
|---|---|---|
| 800x450（移动端 iframe） | 主页、每日奖励弹窗、战斗都能完整显示，文字在 DPR 1 下可读 | ✅ |
| 1280x720 | 横屏两侧面板正常 | ✅ |
| 手机 375x812 | 竖屏布局正常 | ✅ |
| 标题页 | 原来“Potion Siege”标题下面透出合成提示的手势和文字（800x450 和手机都有）。现在标题显示时隐藏提示 | 🔧 e6c376b |
| 进游戏步数 | 一个“点击开始”标题页 → 直接进第一场战斗（文档允许最多一次点击）；新手教程可以跳过 | ✅ |
| 全屏按钮 | 没有自定义全屏按钮（文档禁止） | ✅ |
| 选中文字 / 长按菜单 | body 有 user-select: none，关掉了 touch-callout 和点击高亮 | ✅ |

## 内容与外链

| 项 | 结果 | 标记 |
|---|---|---|
| 外部链接 / 交叉推广 | 代码里没有外链，打包结果里只有注释里的 pixijs.com 和统计接口 | ✅ |
| 禁止内容 | 卡通药水对战发条兵，没有血腥、赌博、真钱交易，属于 PEGI 12 以内 | ✅ |

## 风险 / 需要你决定

1. ✅（d885182 / 5a07fe4 起：EEA/英国/瑞士玩家先问再发，设置里有玩家 ID 和保留期）~~**统计数据发到自己的服务器**~~：CrazyGames 版也会把随机 uid、设备信息、GPU 等发到 `ps.gamestao.com/e`。文档说，SDK 事件以外收集个人数据的游戏需要显示隐私政策 / 条款提示。二选一：CrazyGames 版关掉统计（去掉 `VITE_ANALYTICS_URL` 就行），或者加一个隐私提示和链接。
2. 🔧（2026-10-22，见文末）~~**adblock 下激励按钮直接隐藏，没有提示**~~：文档要求功能被禁用时告诉玩家原因。优先级低，但审核可能会提。
3. 🔧（2026-10-22，见文末）~~**失败后的“复活”加回主页的插屏**~~：输了会先出复活（激励“继续玩”），如果不看，回主页会播插屏。严格理解“关卡之间不要把插屏和继续玩的激励放在一起”的话，这里可能有问题。看过复活的那次已经不播插屏（88cc4a4）；要不要连“只是出现过复活按钮”的那次也跳过插屏，由你决定。
4. ℹ️ 开发者测试模式 `?autoplay` 会卡在终极技能选择弹窗（只影响自动测试，玩家不受影响），可以以后再修。

## 需要你处理（账号、素材、提交）

- 👤 CrazyGames 开发者账号（我没有创建任何账号，也没有提交任何东西）
- 👤 提交表单：打开 Progress Save，选分类和标签（见 `docs/store-listing.md`），设置屏幕方向（横竖屏都支持）
- 👤 三种尺寸的封面定稿（方案在 `docs/store-listing.md`，素材在 `ref/store`）
- 👤 两种比例的预告片（分镜在 `docs/store-listing.md`）
- 👤 上传 zip 后用 crazygames.com/preview 的 QA 工具测一遍：800x450、全屏、复活 / ×2 / 重抽广告、第二局后的插屏、刷新后进度还在
- 👤 决定上面的风险 1–3

## 本分支提交

- `2b10a14` data module 不可用时存档退回 localStorage
- `88cc4a4` 看过激励广告后回主页不再播插屏
- `90eba82` happytime 只用于首次通关和刷新今日挑战最佳
- `e6c376b` 标题页隐藏合成提示
- `9b8373c` 构建产物的预览配置（端口 4186）
- 文档：`docs/store-listing.md` 上传清单加了 Progress Save，体积数字更新；本清单

测试：`npm test` 236/236 通过，类型检查通过。

## re-check 2026-10-18（main 8188560，指挥官技能取代普通攻击之后）

分支 `claude/cg-qa-pass-fe8b91`，没有合并、没有推送。对比基线是上一个提交 9a03ffe（同一套脚本、同样的种子数）。

### 自动检查和平衡脚本

| 项 | 结果 | 标记 |
|---|---|---|
| `npm run check` | 类型检查通过，测试 23 个文件 298/298 通过（含新加的静音测试） | ✅ |
| 第一关种子 609 | 4/4 胜，城墙 100 | ✅ |
| 种子池（各种节奏都能赢） | 1625 → 1575，均值 3.50 → 3.43，影响很小 | ✅ |
| 无尽（初始四个药剂） | 13 / 33 / 44，之前 13 / 32 / 43 | ✅ |
| Boss | 钟 / 三脚架 90 / 91、铁砧 96 / 96 基本不变；齿轮 72 / 73 → 75 / 79 | ✅ |
| 晚期曲线（CURVE_ONLY，480 种子，第 9–20 关到达率） | 均值：记录值 38.7 / 39.5，9a03ffe 42.3，8188560 44.7。第 13–20 关容易了 3–8 点，第 20 关 27 → 35。9a03ffe 本身就比记录高约 3 点（章节曲线带来的），指挥官又加了约 2.4 点 | ⚠️ |
| 章节曲线 9–50 | 第 13–25、31–46 关容易 3–10 点；章节终关 30 / 40 / 50 不变（17 / 25 / 17） | ⚠️ |
| 前期地图（新存档 / 低预算） | 预算 0 第 3 关 50 → 40；预算 0–300 第 4–6 关看广告复活后的胜率下降（例如 57 → 38、25 → 15）。原因多半是没了普通攻击，复活后墙上没有输出补刀 | ⚠️ |
| 前期战役 | 基本一样；8 个模拟玩家里 3 个通关第 10 关要多 1–2 局 | ✅ |
| 平衡报告 | 新存档第 3 关 57 → 48；第 11–18 关略容易 | ⚠️ |
| 经济（`STAGES=50`，脚本默认参数） | 9a03ffe 和 8188560 几乎一样（全满级：休闲 >180 / >180，休闲+广告 108 / 108，常规 75 / 75，常规+广告 53 / 52，重度 26 / 25，重度+广告 22 / 22），所以指挥官没有带来经济漂移。和 `crystal-economy.md` 的数字不同，是因为那里用的是 `LATE_GROWTH=1.018 CHAPTER_CHEST=300`，而脚本默认是 0（章节收入一栏是 0%）。要对比得带上同样的参数 | ℹ️ |

结论：指挥官技能让中后期整体容易 2–10 点，同时让最前面几关（尤其是复活之后）更难。上架前不算阻塞，但第 3–6 关的复活胜率值得调（例如复活时给一次满充能的炸弹）。

### 浏览器实测（dev 5180 / dev:crazygames 5181，1280x720、800x450、375x812，中文和英文）

| 项 | 结果 | 标记 |
|---|---|---|
| 新存档 | 没有标题点击，直接进第一场活的战斗；教程从不卡住战斗；8 秒提示会自动帮做一步 | ✅ |
| 第 1–3 场 | 赢了出“下一关”，连打第 1–3 关正常 | ✅ |
| 指挥官技能 | 击杀充能、点击施法、充满 8 秒自动释放都正常 | ✅ |
| 章节 / Boss | 主页第 2 章卡片显示钟 Boss；第 11 关第 5 波 Boss 出场，有“落地钟巨人”介绍卡 | ✅ |
| 无尽 / 换章节 | 进入正常；第 11 波“战场转移：雪原”横幅和换场正常 | ✅ |
| 结算 ×2（`?ads=fake`） | 3/3 → 2/3 …，用完后按钮变灰显示“今日剩余 0/3 次”；看完晶石翻倍、显示 ×2 标记 | ✅ |
| 复活 | 看广告复活，城墙回到 500，战斗继续；第二次失败显示 ×2 + 继续 | ✅ |
| 插屏 | 回主页播插屏；刚看过 ×2 的那次不播（`rewardedSinceEnd`，符合设计） | ✅ |
| 英文 / 三种尺寸 | 主页和战斗都没有溢出（scrollWidth 等于视口宽） | ✅ |
| 控制台 | 没有报错 | ✅ |
| `?autoplay` | 原来技能选择出现在一帧最后一步（或机器人自己升级触发）时会卡在弹窗上。现在一帧结束时如果有待选技能，机器人先选再判断是否弹窗；`?autoplay&speed=8` 连跑多场不再卡住（旧风险 4） | 🔧 本次提交 |
| 小问题 | “点我施法”和 1/5 标签挤在一起；“BOSS 来袭!”文字压在 Boss 身上；每局战斗顶部都会出现合成提示；`scripts/chapter-curve.test.ts` 提到不存在的 `scripts/chapter-report.mjs`；`?autoplay` 的战斗结果会写进存档（只影响开发测试） | ℹ️ |

### CrazyGames SDK（本地 SDK 模式，在 SDK 自己的 gameLogger / adModule 上挂钩记录顺序）

| 项 | 结果 | 标记 |
|---|---|---|
| 启动顺序 | init → loadingStart → hasAdblock → 设置监听 → loadingStop → gameplayStart（gameplayStart 一定在 loadingStop 之后） | ✅ |
| 战斗结束 | 失败时 gameplayStop；复活后再次 gameplayStart | ✅ |
| 激励广告 | 复活和 ×2 都走 `requestAd('rewarded')`，期间预取了 midgame | ✅ |
| 插屏 | 不看广告点“继续”回主页时 `requestAd('midgame')` | ✅ |
| 静音 | 启动时读 `settings.muteAudio`，并注册了设置变化监听。本地 SDK 没法从外面切换静音，所以补了单元测试（当前状态 + 每次变化都传给游戏） | 🔧 本次提交 |
| 门户里真正切换静音 | 需要在 crazygames.com/preview 的 QA 工具里点一次 | 👤 |

### 线上 p.gamestao.com（只读，没有改任何部署设置）

| 项 | 结果 | 标记 |
|---|---|---|
| 构建标记 | 打包里是 `0.0.1+8188560`（干净，和 main 一致） | ✅ |
| loaded_ 信标 | `ps.gamestao.com/b?h=web&b=0.0.1%2B8188560&s=loaded_desktop&ms=2992` 发出了 | ✅ |
| open_ 信标 | 按设计只有 CrazyGames 版的 HTML 里有，网页版没有。本地用 `VITE_ANALYTICS_URL` 打了一个 CrazyGames 包，HTML 里内联的是 `h=crazygames&b=0.0.1%2B8188560…&s=open_` + touch/desktop，本地主机跳过 | ✅ |

### 仍然开着的风险（和上面“风险 / 需要你决定”一样，复查时没有变化）

1. ⚠️ CrazyGames 版仍然把统计发到 `ps.gamestao.com/e`，没有隐私提示 —— 提交前要决定（关掉或加提示）。
2. ⚠️ adblock 下激励按钮直接隐藏，没有说明。
3. ⚠️ 出现过复活按钮但没看、点“继续”回主页，仍会播插屏（本次实测确认）。
4. ✅ `?autoplay` 卡住 —— 已修。

### 本次提交

- `src/app.ts`：autoplay 在一帧结束时先替机器人选技能，避免弹窗卡住
- `src/platform/crazygames/CrazyGamesPlatform.test.ts`：门户静音的单元测试
- 本节文档

## 发布前收尾 2026-10-22（分支 `claude/launch-leftovers-e4fc7c`，未合并、未推送）

### 改了什么

| 项 | 结果 | 标记 |
|---|---|---|
| adblock | 门户上有 adblock 时，结算页在“继续”上方加一行“已开启广告拦截：看广告领奖励不可用”（15 种语言，`layout.test.ts` 加了这一屏的溢出检查）。只在本来会出现复活或 ×2 时才显示。Basic Launch 期间奖励本来就不用看广告直接给，所以 adblock 不再隐藏这些按钮 | 🔧 6a9cedf |
| 跳过复活后的插屏 | 输了且出现过复活按钮（不管点没点、广告有没有播完），这次回主页不播插屏。`resultScreen.test.ts` 加了：跳过复活 → 0 次插屏；没有复活可选的失败 → 照常 1 次插屏 | 🔧 6a9cedf |
| URL 开关 | 正式构建（网页、CrazyGames、iOS）只认 `?lang`。`?autoplay`、`?speed`、`?ads=fake`、`?track`、`?quality` 只在开发构建里生效（`src/game/switches.ts`，和 standing 的 5958f85 一样）。之前线上可以用 `?speed=N` 加速刷晶石，网页版用 `?ads=fake` 白拿奖励。`?native` 本来就只在开发构建里生效。没有种子或关卡相关的 URL 开关 | 🔧 4dd8093 |
| `?autoplay` 写存档 | 机器人的战斗只改内存里的存档，`store()` 不再写入 | 🔧 4dd8093 |
| `chapter-report.mjs` | ad7347b 里已经补上了，引用没问题。没有分片时改成提示先跑 `npm run chapters`，不再抛 ENOENT | 🔧 4dd8093 |
| CrazyGames 会话统计 | `session_start` 带上 `app`（SDK 的 `applicationType`：web / google_play_store / apple_store / pwa）和 `basic`（是否在 Basic Launch），对应 standing 的 00b3a0f。报表还没按 `app` 分列 | 🔧 本次提交 |
| iOS shell 测试 | Windows 检出（CRLF）时 `shell.test.ts` 的 AdMob live 开关正则不匹配，改成接受 `?
` | 🔧 本次提交 |

关于插屏的取舍：门户允许在自然停顿处放插屏，所以这条不是硬性要求。代价是：有广告时每一局失败都会出现复活，于是失败后的插屏全部没了，插屏收入大约少一半。Basic Launch 期间本来就没有广告，所以对上架评估没有影响；Full Launch 后如果插屏收入不够，可以改成“只在没点复活时跳过”。

### standing 2026-10-10 以来的修复，Potion Siege 是否也有同样问题（不含 UI / 内存 / 新手 / 平衡）

| standing | 内容 | Potion Siege | 标记 |
|---|---|---|---|
| 00b3a0f | CrazyGames `applicationType` 进统计 | 有同样问题，已移植（只到客户端，报表没改） | 🔧 |
| 937a1cb | 每分钟一个 `alive` 事件，页面直接被杀掉（没有 pagehide）时也知道玩到哪 | 已移植并改过：所有可见界面都计时（和 CrazyGames 的 playtime 一样只算页面可见时间，每次 tick 最多算 5 s），带界面/关卡/波次；`session_end` 带 `vis`；报表的 playtime 改用 `vis`，新增 Sessions 一段（页面死掉时最后在哪）。没有 run_resume（Potion Siege 没有保留的局） | 🔧 26d151d、4e44330 |
| 4bb561a | 开发构建把 perf / anomaly 打到控制台（超出上限的也打） | 已经有：`src/analytics/devPrint.ts`（ceecfb0），开发构建直接打印，超过上限也打 | ℹ️ 已有 |
| c05ae3d | 会话事件带上门户语言和浏览器语言 | 已移植：`session_start` 带 `langs`（门户/手机）和 `navLangs`（浏览器），各最多 4 个 | 🔧 26d151d |
| 8267b39 | dev server 忽略构建输出目录（Windows 上会占满 CPU） | 已移植：`scripts/devWatch.mjs` 的 `WATCH_IGNORED`（从根目录起的 `dist*`、`ios/`、`ref/`、`telemetry/`，`src/platform/ios` 照常监视），三个 vite 配置都用 | 🔧 b496be0 |
| 8f4de83 | 用线上真实存档测试能完整解析 | 跳过：还没在 CrazyGames 上线，没有线上存档可用；等上线后取一份真实存档再补 | ⏭️ 跳过 |
| 0af6559 | `launch_check.mjs`：新上传版本前几小时和上一版对比 | 已移植：`npm run report -- <file> --compare crazygames [--hours n]`（`scripts/buildCompare.mjs`），按设备，同样的安装后时长 | 🔧 4e44330 |
| baee706 附带 | 从 bfcache 恢复的页面可能发两次 `session_end`（pagehide 没限制只发一次） | 已修：每次离开只发一次，bfcache 恢复后重新允许，未结束的局可以再记 `run_quit`；报表按 sid 合并多个 `session_end` | 🔧 26d151d |

已经有或不适用：1024b09（纹理卸载后冻结，已移植）、aa727bc（open 信标，已经正确）、c63aa50（重复批次，BeaconSink 不重试）、5d8db2f（iOS 帧抖动，没有对应代码）、bd5e7f5、97057ff、a3fe951/544021f、回放收集、Playgama / Newgrounds 相关。另外：standing 发现 saver 档 30 fps 在 iPhone 13 上越跑越卡，Potion Siege 也还是 30 fps（`quality.ts:22`），这属于性能，留给内存/性能那边。

### 自动检查

`npm run check` 全绿（typecheck、check:filelength、55 个测试文件 629 个测试、balance quick、build:crazygames、build:ios）。`dist-crazygames` 用 vite preview 打开（SDK 3.8.0 local）：控制台只有 SDK 的 log/debug 行，没有 warning 或 error；首局直接进战斗，教程提示正常。主包 591 kB（gzip 198 kB），和之前一样。

### 仍然开着的风险

1. ⚠️ 插屏收入的取舍（上面）：Full Launch 前再看一次。
2. ✅ `alive` 心跳已移植（26d151d）：页面被直接杀掉时，报表能看到最后一次心跳的界面/关卡/波次。隐私页（中英）已写上每分钟报到、游戏关闭和语言列表。
3. 👤 门户里真正切换静音、adblock 提示行的实际效果，要在 crazygames.com/preview 的 QA 工具里看一次（本地 SDK 模拟不了 adblock）。
4. ℹ️ `?lang` 在正式构建里保留（只换语言，没有影响）。
