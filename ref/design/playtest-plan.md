# 上 CrazyGames 之前的小规模试玩（2026-10）

## 一、目的

Holy Kicker 在 CrazyGames Basic Launch 上因为**转化率**没过（8/15，9/15 才算过）。Potion Siege 提交之前，
先用自己的渠道拉一批**真正的新玩家**，量出和 CG 打分口径尽量一致的几个数，看够不够、差在哪：

| CG 打的分 | 我们怎么量 | CG 参考线 |
|---|---|---|
| 游戏转化（gameplay conversion） | 第一次会话里打满 60 秒战斗的新玩家 ÷ 新玩家的 `open_*` 打开信标 | 桌面 63% = 3/5；移动 28.57% = 2/5 |
| 平均游玩时长 | 每个新玩家所有会话加起来的分钟数，取平均 | 12 分钟 = 5/5（Action 类 8m52 = 4/5） |
| D1 留存 | 安装后第 1 个自然日回来的比例 | Action 类：桌面 3.93% = 3/5，移动约 4.5% = 3/5 |

另外看 CG 不打分、但决定上面三个数的：第 1–3 局漏斗、新手引导完成率、打到第几关、在哪一关哪一波退出、
第 3 局结束后的一次性评分（1–5 星 + 一句话）。

## 二、样本和时间

- **新玩家 50–150 个**，桌面和移动都要有：每种设备至少 **30 次打开**，否则转化率的误差（±15 个百分点）
  大到没法和 63% / 28.57% 比。
- **3–7 天**。第 1 天发熟人和群，第 2–3 天发 Reddit / itch.io / Newgrounds；D1 要等最后一批人装完再过
  2 天才算得出来（报表只算安装时间比最新事件早 2 天以上的人）。
- 在此期间**不改版本**：报表按玩家第一次玩的 build（提交短哈希）分组，中途发新版会把样本切碎。
  真要修大 bug，就把修之前和修之后当成两轮看。**试玩期间不要 push main**：CI 每次 push 都重新部署网页版，
  哪怕只改了文档，build 号也会变成新的提交哈希。文档改动先只在本地提交，测完再推。
- 试玩版本：**开测那天 `main` 上线的那个提交**，开测时填进这里。截至 2026-10-18 还没开测、渠道也没定，
  `main` 照常改；冻结从开测那天开始。当前线上是 `11abaab`（在 `71457b8` 之上只加了埋点链路的测试，游戏没变）。

## 三、开始之前要做的（这些只能你来做）

1. ✅ 已完成（2026-10-18）：试玩相关分支都合进 `main` 并上线，收集器会记下打开信标里的 `n` 新玩家 /
   `r` 来源。开测前确认 p.gamestao.com 显示的 `0.0.1+<提交>` 就是上面填的试玩版本。
   **还没定：隐私提示。** 现在统计没有任何提示，评分还能留言。开测前二选一：加一行简短提示，或者关掉统计。
2. 自测一遍：手机和电脑各打开一次 `https://p.gamestao.com/?src=test`，玩 1 分钟以上，然后

   ```bash
   ssh blightbloom 'cat /home/deploy/potion-siege/data/events-*.ndjson' > telemetry/events.ndjson
   npm run report -- telemetry/events.ndjson
   ```

   报表最后的 `== Playtest ==` 表里应该能看到 `test desktop` 和 `test touch` 两行，`opens` 和 `new` 都是 1。
   自己的测试一律用 `?src=test`，看数时直接跳过这一行。
3. 需要上传的平台（itch.io、Newgrounds）先打包（见第五节），**账号、上传、发帖都由你来做**。

## 四、渠道、链接和帖子

来源标签的规则：第一次打开时记下 `?src=`（或 `utm_source`），没有就用来源网站的域名（只记域名，不记完整
地址），都没有就是 `direct`；之后永远不变，跟着每条事件和打开 / 加载信标发出去。老存档读出来是 `unknown`。
所以**每个渠道一定用带 `?src=` 的链接**，尤其是微信、QQ、Discord 这种不带 referrer 的地方。

下表是候选渠道，**还没定用哪几个**（2026-10-18）。

| 渠道 | 链接 | 预计 | 说明 |
|---|---|---|---|
| 朋友、同事 | https://p.gamestao.com/?src=friends | 10–20 | 最热情的一批，转化会偏高，单独看 |
| Reddit r/WebGames | https://p.gamestao.com/?src=reddit | 20–60 | 链接帖直接指向游戏；发之前看一遍版规（标题格式、自荐频率） |
| itch.io（HTML5） | 上传 `potion-siege-itch.zip`（来源自动是 `itch`） | 10–40 | 也可以在页面上放 https://p.gamestao.com/?src=itch 作为「在新标签页玩」 |
| Newgrounds | 上传 `potion-siege-newgrounds.zip`（来源自动是 `newgrounds`） | 10–40 | 新作品先进 Under Judgment，被投票通过才留下 |
| Discord 群 | https://p.gamestao.com/?src=discord | 5–20 | 独立游戏 / 塔防 / 网页游戏的服务器，发在允许自荐的频道 |
| QQ 群 | https://p.gamestao.com/?src=qq | 5–20 | |
| 微信群 / 朋友圈 | https://p.gamestao.com/?src=wechat | 5–20 | 微信内置浏览器不带 referrer，必须用这个链接 |

**光靠 itch 凑不够样本**：新上传的 HTML5 小游戏没有宣传时自然流量很少，itch 的用户又以桌面为主，
移动 30 次打开基本凑不到。所以 itch 当稳定的桌面渠道，r/WebGames 冲量（桌面移动都有），中文群补移动。

想细分（比如两个不同的 Discord 服务器）就换标签：`?src=discord-td`、`?src=discord-indie`。
标签只保留小写字母、数字和 `. _ -`，最长 40 个字符。

### 帖子（可直接复制）

**English — Reddit / Discord / itch.io 页面**

> **Potion Siege** — a tower defense where your towers are living potion bottles. Summon them onto the
> wall, merge two of a kind into a stronger brew, and hold back a clockwork army across 50 stages,
> 5 bosses and an endless mode. Free, in the browser, desktop or phone, no install or sign-up.
>
> It's an early build and I'd love to know where it gets boring or too hard — after your third battle
> it asks for a 1–5 rating once; a line of text there helps a lot.
>
> Play: https://p.gamestao.com/?src=reddit

（Discord 把最后的 `src=reddit` 换成 `src=discord`。Reddit 标题可以用：
`Potion Siege — merge potion-bottle towers to hold off a clockwork army (tower defense, browser, mobile ok)`）

**中文 — 朋友 / QQ 群 / 微信群**

> 做了个网页小游戏《药水围城》（Potion Siege），想请大家帮忙试玩 10 分钟：
> 塔防 + 合成，防守的塔是会动的药水瓶，两个一样的合成更强的，帮老法师挡住发条军团。50 关、5 个 Boss、
> 还有无尽模式。手机电脑都能玩，不用下载也不用注册。
> 打完第 3 局会问一次 1–5 星，顺手打个分、写一句哪里难 / 哪里无聊就太感谢了！
> 👉 https://p.gamestao.com/?src=qq

（微信群用 `?src=wechat`，熟人私聊用 `?src=friends`。）

**itch.io 页面简介**（英文帖第一段即可，再加一句）：
`Best in portrait on phones; on desktop use the fullscreen button.`

## 五、itch.io / Newgrounds 的压缩包

这两个平台要上传一个 `index.html` 在最外层、所有路径都是相对路径的 zip；它们把游戏放在自己域名的
iframe 里，我们的 `?src=` 传不进去，所以包里直接写死默认来源：

```bash
npm run build:itch          # -> dist-itch/、potion-siege-itch.zip，新玩家来源 = itch
npm run build:newgrounds    # -> dist-newgrounds/、potion-siege-newgrounds.zip，新玩家来源 = newgrounds
node scripts/build-zip.mjs <标签>   # 别的平台同理
```

（`scripts/build-zip.mjs`：普通网页版构建，`base: './'`，环境变量 `PS_DEFAULT_SRC=<标签>`，遥测照样发到
`.env.production` 里的 ps.gamestao.com；生成的目录和 zip 已经在 `.gitignore` 里。）
**要从干净的工作区、已经合进 main 的那个提交打包**，这样包里的 build 号和网页版一致，报表才能放在一起看。

上传时：
- **itch.io**：Kind of project 选 HTML，上传 zip 后勾「This file will be played in the browser」；
  Embed options 视口 540×960，勾 Mobile friendly（Orientation: portrait）和 Fullscreen button。
  **一定勾 Automatically start on page load**：默认是先显示 Run game 按钮，点了才加载 iframe，那打开信标
  只算主动点了的人，转化会被高估；页面一打开就加载，分母才接近 CG 的「游戏页面访问」。
  itch 后台自带的浏览 / 游玩次数可以和我们的 `opens` 对一下。
- **Newgrounds**：Game 投稿，上传 zip，尺寸 540×960；同样打开全屏按钮。

## 六、看数

```bash
ssh blightbloom 'cat /home/deploy/potion-siege/data/events-*.ndjson' > telemetry/events.ndjson
npm run report -- telemetry/events.ndjson
```

最后两段是这次加的：

- `== Playtest: new players by source x device ==`：每个 build 一张表，每行是「来源 × 设备」，外加 `(all)`
  汇总行。列：`new` 新玩家、`opens` 新玩家的打开信标、`load` 加载完成信标、`conv` 转化率（后面是分子 / 分母）、
  `play` 平均分钟、`D1` 回来的 / 有资格算的、`tut` 新手引导完成、`r1end r2 r3 r3end` 第 1–3 局漏斗、
  `stage` 关卡中位数 / 最高、`quits` 中途退出的局数，下一行列出在哪退出（`s3w5` = 第 3 关第 5 波）、
  `feedback` 平均分（评分人数），`skip n` 是关掉或没答就离开的人数。达到 CG 参考线的数后面有 `+`；转化后面是 `!`
  （超过 100%）说明打开信标比玩家少：这个版本没发信标（开发服务器、合并之前的老版本）或者被拦了，这一行的转化不能用。
- `== Feedback ==`：每条评分和留言，最新的在前。

只算**新玩家**（第一个会话的 `session_start` 在数据里的人）；老玩家和 `?src=test` 不要算进结论。

## 七、什么算「可以上 CG 了」

看 `(all)` 行，桌面和移动分开判断：

| 指标 | 可以提交 | 要先改 |
|---|---|---|
| 桌面转化 | ≥ 74%，且 opens ≥ 30（约等于 CG 的 63% = 3/5） | < 63% |
| 移动转化 | ≥ 45%，且 opens ≥ 30（CG 的移动转化比我们量的低很多，只作参考） | < 35% |
| 平均游玩时长 | ≥ 12 分钟（Action 类 12m12 = 5/5；最低也要 ≥ 9 分钟） | < 7 分钟 |
| D1 | ≥ 5%（有资格的人 ≥ 30） | 0 回来，且第 3 局结束 < 30% |
| 第 1 局结束 / 新玩家 | ≥ 80% | < 65% |
| 第 3 局结束 / 新玩家 | ≥ 40%（Holy Kicker：一天打 3 局以上的人 D1 17%，只打 1 局的 1.6%） | < 25% |
| 新手引导完成 / 新玩家 | ≥ 75% | < 60% |
| 评分 | 平均 ≥ 3.5，n ≥ 10 | 平均 < 3 |

**为什么比 CG 的线严**：CG 的 Basic Launch 只看最后 7 天，但满 500 次游玩、满 7 天就结束，Holy Kicker 第 6 天
就到了 500，所以实际评的是**最开始那 7 天**，第一天的数据也算；被拒以后不能自己重开，只能发邮件申请。
期间传的新版本马上生效，但只能救后面几天。所以提交给 CG 的版本第一天就要过线，不能指望边上线边修。
换算来自 Holy Kicker：我们量的桌面「打满 60 秒 / 安装」约 60%，CG 显示 52%，即 CG ≈ 我们 × 0.87，
CG 的 63% 约等于我们的 72–74%。移动差得更多（我们约 49%，CG 16–21%），所以移动只作参考。

**判断**：两种设备的转化都过线、平均时长 ≥ 12 分钟（至少 ≥ 9），就提交；其他指标中间地带只记下来，不拦提交。
任何一项落进「要先改」，先改再拿新 build 测一轮（同样的链接再发一批，报表按 build 分开）。

注意试玩数据**比 CG 偏乐观**：朋友和看到帖子主动点进来的人比 CG 首页刷到的路人更想玩；CG 的分母是
游戏页面访问，也比我们的打开信标多一点（页面开了但 iframe 还没加载的也算）。所以转化最好留 5 个点以上余量。
朋友（`friends`、`wechat`、`qq`）和陌生人（`reddit`、`itch`、`newgrounds`）**分开看**，以陌生人为准。

## 八、没达标时调什么

| 哪里差 | 先看报表里的 | 可以调的 |
|---|---|---|
| 转化低、`load` 远少于 `opens` | 加载完成率、`loaded_*` 信标的 `ms` | 首屏包体（主 JS 575 kB，美术 3.9 MB）：压图、先加载第一关要用的、加载条 |
| 转化低、加载正常 | `r1end`、`quits` 里 `s1w1`/`s1w2` 多不多 | 第一分钟：开局不要等点击、引导不冻结战斗、去掉第一分钟里的弹窗（见 first-minute-live-battle） |
| 移动转化特别低 | touch 行的 `load` 和 `quits` | 触屏按钮大小、竖屏布局、低端机帧率（`perf` 事件） |
| 平均时长短 | `stage` 中位数、`quits` 集中的关和波 | 那一关的难度（`npm run early` / `npm run chapters`）、第 2–3 局的奖励节奏 |
| 第 3 局结束少 | `r2`、`r3` 掉在哪 | 每局之间的推进：下一关按钮、升级引导、水晶奖励（`npm run economy`） |
| D1 低 | 第 3 局结束率 | 先把当天多打几局做上去；再看每日奖励 / 每日挑战入口是否显眼 |
| 评分低 | `== Feedback ==` 里的留言 | 照留言改 |

## 九、数据说明

- 不收集个人信息：来源只有一个标签或网站域名，不记完整 referrer；评分里的留言最多 200 字，只有玩家自己写的。
- 打开信标在 `<head>` 里内联发出，比游戏代码早；本地地址（localhost、127.*）不发。玩家装了广告拦截器的话
  信标和事件都会被拦，所以分子分母一起少，转化率影响不大。
- 「新玩家」在打开信标里是看 localStorage 里有没有存档（`mb.player`）；在 CG 上存档是 SDK 的数据，
  信标读不到，CG 版的打开信标都会算成新玩家（CG 版本来就看 CG 自己的面板）。
- itch.io 所有游戏共用一个 iframe 域名（html-classic.itch.zone），清缓存或换浏览器的玩家会被当成新玩家。
- 评分只在网页版、第 3 局结束的结果页出现一次，可以直接关掉；不出现在 CG 版（CG 有自己的评分）。

## 十、本地验证过的链路（2026-10-18）

在本机跑过一遍：`node scripts/collector.mjs 8787 <文件>` 起收集器，`VITE_ANALYTICS_URL=http://<局域网 IP>:8787/e`
构建网页版并 `vite preview --host`，用 `http://e2e.localhost:<端口>/?src=test` 打开（`*.localhost` 不算本地地址，
打开信标会发；`localhost` 本身不发）。收到了带 `new: true, src: "test"` 的 `open_desktop` 和 `loaded_*` 信标、
带 `src` 的全部事件、第 3 局后的 `feedback_shown`、`feedback`（5 星 + 留言）和 `feedback_skip`（点了「以后再说」），
`npm run report` 的试玩表和评分列表都对得上。手机尺寸（375×667）下评分条不挡结果页的「继续」按钮。

## 十一、Basic Launch 每日检查（提交 CG 之后，每天早上一次）

Basic Launch 一般只看头 7 天（Holy Kicker 第 6 天就过了 500 次游玩），所以**每天看前一天的分，当天修、当天传**。
试玩期间也用同一张表看某个来源：`--src reddit`。

1. **拉数据**（收集器按 UTC 日期一天一个文件）：

   ```bash
   ssh blightbloom 'cat /home/deploy/potion-siege/data/events-*.ndjson' > telemetry/events.ndjson
   ```

2. **跑报表**，看最后的 `== Basic Launch daily ==`：

   ```bash
   npm run report -- telemetry/events.ndjson
   npm run report -- telemetry/events.ndjson --src reddit --bench action
   ```

   每行是「UTC 日期 × 设备」：`opens` 打开信标（≈ CG 的 plays）、`new` 当天新玩家、`conv` 当天战斗满 60 秒的
   会话 ÷ 打开、`play` 新玩家安装当天的平均分钟、`D1`（当天所有新玩家都满 2 天才显示，之前是 `wait (n)`）、
   `plays` 会话数、`score/15` 按 CG 打分换算的总分和 9/15 的结论（`pass` / `fail` / `?`）、`build` 当天主要版本。
   方括号里是 CG 的 0–5 分，`[3-5]` 表示分界线还不知道。`~` = 这台设备当天打开不足 30 次，波动 ±15 个点，
   **不要据此改东西**；`*` = 还没过完的一天。最后两行是「最近 7 个完整天」，就是 CG 结束时打分的窗口。
   `action` 一列是用 Holy Kicker 的 Action 类分界线算的参考分。

   分界线都在 `scripts/cgBenchmarks.mjs`。**Strategy 类目前只知道一个点**（移动转化 27.6% = 2 分），
   所以默认的 strategy 分大多是范围。游戏一进 Basic Launch，就把开发者后台「Basic Launch Results」上每个
   「x for n」提示抄进去（`kind: 'min'`），每天的实际得分也抄进去（`kind: 'seen'`），范围会一天天收窄。

3. **什么时候发修复版**（只看 opens ≥ 30 的行；两台设备分开看）：

   | 情况 | 动作 |
   |---|---|
   | 某台设备 7 天窗口的分数上限 < 9（`fail`） | 当天就修，修完立刻传：剩下的天数越少，新版本占窗口的比重越小 |
   | 桌面转化连续 2 天 < 55%，或移动转化 < 25% | 看第一分钟（`== First session ==`、`quits` 里的 `s1w1`），修完上传 |
   | 平均时长 < 8 分钟 | 看 `stage` 和退出的关卡、波次，降那一关的难度 |
   | 新版本上线后某个数掉了 5 个点以上 | 回滚到上一个版本 |
   | `load` 远少于 `opens`（顶部 `== Loading ==`） | 包体或崩溃问题，优先级最高 |

   中间地带（`?`）不急着动：先等那台设备再积累一天的数据。一天最多传一个版本，否则每天的数据混着两个版本，
   看不出哪个改动起了作用（`build` 列出现 `+1` 就是混了）。

4. **容易踩的坑**
   - **只看最近 7 天**。CG 判的是最后 7 天，不是累计；早期的差日子会滑出窗口，但只有 Basic Launch 还没结束才有用。
   - **500 次游玩 + 满 7 天就结束**。HK 第 6 天过了 500，所以实际就是头 7 天。报表最后一行 `opens so far` 是累计打开数，
     接近 500 时修复版已经来不及进窗口太多，**第 1–3 天的修复最值钱**。
   - **CG 的移动转化远低于我们自己算的**。HK 我们的数据里移动玩家近一半打满 60 秒，CG 只记了 16–21%。
     看移动转化时以 CG 后台为准，我们的表只用来看「改了之后有没有变化」。
   - **按设备时间 `ts` 排序和分天，不要按服务器时间**。一批事件在收集器里共用同一个 `received`（HK 的库里叫 `at`，
     设备时间叫 `t`），按服务器时间排会把会话切错、把跨午夜的会话放到第二天。打开信标只有服务器时间，这个没办法。
   - CG 的日期是 UTC，我们的表也按 UTC 分天；D1 用的是玩家本地日历的第 1 天（事件里的 `day`）。
   - 被拒之后不能自己重跑 Basic Launch，只能发邮件求人，所以宁可多等一轮试玩数据再提交。
