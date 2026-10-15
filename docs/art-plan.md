# 药水围城 美术方案

## v3（2026-10-15 起生效）：活药水

英雄都是**长着脸、会动的药水瓶**。合成就是把两瓶药水倒在一起，所以结果是随机的；格子是炼金塔上的货架，指挥官是炼金术士。之前的萌系动物（v1）和史莱姆（v2）方案都已废弃。

**玩法规则**（`src/sim/balance.json`）：
- **阵容**（`lineup`）：每局带 4 种英雄：`arcane`（奥术药剂）/ `fire` / `ice` / `lightning`。召唤从中随机出 1 级；两格同种同级合成时，结果升 1 级，种类在 4 种里重新随机。
- **等级**（`maxStar` = 4）：1-3 级在格子里分别站 1-3 瓶小药水，4 级是终极形态，一格只站 1 个大号造型。终极格子加金框和金色光环。合出终极英雄时，弹出"选择 1 个额外技能"，技能优先给这个英雄。
- **金币**：召唤花费逐次上涨（`summonCost*`）。「强化」按钮花金币换一次三选一技能，价格 100 → 200 → 400 → 600 → 1000 → 1500，之后每次 +500（`upgrade`）。没有经验条，英雄不能卖。
- **一局**：10 波（第 5、10 波是 Boss），约 4-5 分钟。

**四种药水**：

| 代码 id | 名字 | 定位 | 瓶身（1-3 级） | 元素标记（代码画） | 终极形态 |
|---|---|---|---|---|---|
| arcane | 奥术药剂 | 速射单体，无元素 | 紫色圆底试管 | 绕瓶口转的 3 颗小星星 | 金座水晶球，星星王冠，两手举试管 |
| fire | 火焰药剂 | 范围爆炸 | 橙色圆底烧瓶 | 瓶口火苗和火星 | 铁坩埚，火焰王冠 |
| ice | 冰霜药剂 | 减速 | 青色锥形瓶 | 冷雾和旋转雪花 | 银罐，冰晶王冠 |
| lightning | 雷电药剂 | 连锁 | 黄色方瓶（`size` 0.82） | 悬浮的 ⚡ | 铜框电池罐，闪电王冠 |

**分层**：
- 1-3 级：AI 只画一个光瓶身加脸（`public/art/potion_{kind}_body.png`），手脚、眨眼、元素标记、投掷和倒药水动画都由 `src/view/potion.ts` 画。眼睛和瓶口位置、颜色、`size` 写在 `src/view/art.ts` 的 `POTIONS` 里。
- 终极形态：单张图（`potion_{kind}_ult.png`），代码只做挤压回弹。按高度 150 显示，太宽的按宽度 155 缩小。

**出图流程**：
1. 文生图（`tools/generate_image.sh`），prompt 在 `art/prompts/potion_*_gen.txt`，第一行是统一风格前缀。
2. `tools/flatten.py <in> <out> <高> 24 <描边>`：抠图、量化成平涂、重画统一黑描边（瓶身 256/4，终极 400/6）。
3. 腮红重涂成 (255,150,185)；`tools/clean_edges.py` 清掉描边上的杂色。
4. 成品放 `public/art/`，副本放 `art/cut/`。

**经验**：
- Mistral 几乎总会加软木塞和深色玻璃，要在预处理里切掉，并用墨线封住瓶口。
- 浅色玻璃（色度 < 55）会被 flatten.py 当背景抠掉，玻璃要涂成 (160,222,250) 这类够饱和的颜色。
- 地面阴影要在 flatten 之前去掉。
- 形状 AI 画不准时可以自己画：奥术试管就是用 `tools/draw_arcane_body.py` 画的瓶身，再移植 AI 稿的脸。

**同种同级怎么一眼看出来**：
1. 瓶子个数就是等级；终极形态单独一个大造型，配金框。
2. 每种药水有自己的瓶形和液体颜色，涂成纯黑也要能分出来。王冠只给终极形态用。
3. 拖起一格时，能合的同款发金光，其它全部压暗；5 秒不操作，会让一对能合的轻轻跳起来提示。

**城墙与指挥官**（`commander`）：
- 棋盘 7 列 × 3 行。最下面一排就是城墙，开局只有这 7 格。
- 指挥官（炼金术士）站在城墙下方正中间，左边是「强化」按钮，右边是「召唤」按钮。现在的 `public/art/commander.png` 还是旧图，待重画。
- 指挥官每召唤 5 次就在城墙上搭 1 个新格子（头顶显示 x/5）。新格子位置随机，但必须落在已有格子的正上方。共搭 6 格。
- 指挥官自己也会射击（奥术弹），伤害随已搭格子数上涨，只吃全体加成技能（伤害、攻速、暴击）。

下面的 v1 内容中，敌人、图标、流程、目录、风险这几部分仍然有效。

---

# v1（草案，英雄部分已废弃）

已定：萌系动物元素守卫 · standing 贴纸风 · 英雄每种 2 档造型（1-2★ / 3-4★）· 竖屏 + 横屏两套布局。
流程照搬 D:\standing（脚本见其 `tools/`），角色与题材全新原创，不沿用 standing 的和尚/僵尸，也不参考《永远的蔚蓝星球》的任何素材。

## 1. 风格锚点

**通用前缀**（改自 standing `art/monk/style_r3/hero_run.txt`，把"朝右三分之四侧"改成"朝向镜头"，因为我们的敌人从上往下走、英雄面对玩家）：

> 2D casual mobile game art, sticker-like cartoon style. VERY THICK uniform black outline around the whole silhouette and every shape, like a vinyl sticker. Flat solid colors only, exactly one hard-edged cel shadow tone per color, no gradients, no texture, no soft shading. Very simple bold shapes, minimal details, readable at tiny size. Full body, three-quarter front view facing the viewer. Plain pure white background, no ground shadow, no scenery, no text, no letters, no signature.

**阵营配色规则**

| 阵营 | 规则 |
|---|---|
| 我方英雄 | 毛色暖、明亮；各自的元素色只出现在服饰和武器上，和代码里 `HERO_COLORS` 对齐；统一戴奶油色＋金色的"守卫徽章"围巾，作为阵营识别 |
| 敌人 | 冷灰、紫、墨绿，**红眼**；身上不出现饱和暖色（同 standing 规则） |
| 3-4★ 进阶 | 同一角色加大号武器、披风或小王冠，轮廓明显变大，配色不变 |

## 2. 角色表

体型：Q 版，约 2 头身，大头小身。英雄统一"可爱但有干劲"的表情。

| 职业（代码 id） | 角色 | 1-2★ 造型 | 3-4★ 进阶 | 元素色 |
|---|---|---|---|---|
| archer | 狐狸游侠 | 绿色兜帽，小木弓 | 金边长弓，飘动披风 | 橙毛 + 森林绿 |
| fire | 小火龙 | 圆滚滚红色幼龙，小翅膀 | 头盔 + 更大的翅膀，尾巴带火 | 朱红 + 金 |
| ice | 企鹅冰法 | 蓝围巾，冰晶法杖 | 冰晶王冠，长斗篷 | 白黑 + 冰蓝 |
| lightning | 闪电猫 | 黄色雷云耳罩 | 双手各抓一道闪电，护目镜 | 灰白毛 + 电黄 |
| poison | 青蛙药剂师 | 背小药瓶 | 大药锅背包，冒泡 | 草绿 + 紫药水 |

| 敌人（代码 id） | 角色 | 剪影要点 |
|---|---|---|
| grunt | 紫皮哥布林，拿木棒 | 标准体型，作为参照 |
| runner | 瘦长的蝙蝠耳小鬼，前冲姿势 | 细长、前倾，一眼看出"快" |
| brute | 石皮食人魔，举木盾 | 宽胖、方形 |
| boss | 哥布林国王，骑在破木战车上，戴王冠 | 体积约为 grunt 的 3 倍，冠和车是剪影要点 |

经验：standing 发现参考图会把脸和衣服一起"传染"给新角色，**每种敌人必须有一个独有的强剪影特征**；体型按不透明面积比，不按高度。

## 3. 资产清单（原型）

| 类别 | 数量 | 做法 | 出图尺寸 → 游戏内 |
|---|---|---|---|
| 英雄 | 5 × 2 = 10 | 文生图定 1 张样板，其余都用 edit 改 | 抠图高 256 → 显示约 150（设计坐标） |
| 敌人 | 4 | 以哥布林为参考 edit；`bake_mob.py` 烘焙 8-12 帧行走 + 白闪帧 | grunt 160 / runner 140 / brute 200 / boss 384 |
| 技能图标 | 11 | standing 图标前缀，"single object, no people" | 128 px 图集（`pack_icons.py`） |
| 英雄头像/图鉴卡 | 复用英雄图 | — | — |
| 战场背景 | 1 张宽幅 → 竖、横两种裁切 | 草地 + 小路 + 底部村庄木墙 | JPEG q82 |
| 城墙 | 1 条可平铺 | `make_tile.py` | — |
| Logo | 1 | Luckiest Guy（Apache 2.0）字体 + 小图标，`make_logo.py` | — |
| 商店封面 | 3 | `cover_ref.py` → edit → `cover_final.py` | 1920×1080 / 800×1200 / 800×800，除 logo 外无文字 |

**不出图、用代码画的**：子弹、命中、合成光效、连锁闪电、毒圈、UI 面板和按钮（沿用 standing `widgets.ts` 写法：圆角 + 8px 描边 + 底边厚度）、星级标记、格子。

## 4. 动画

- **英雄**：不做骨骼。用代码做呼吸（上下 2-3%）、开火时挤压回弹、合成时弹跳加闪白、被拖动时放大。
- **敌人**：`bake_mob.py` 烘焙行走循环（14-20 fps）和受击白闪；死亡用代码做压扁淡出。
- **Boss**：先用烘焙帧；做后续版本时再考虑 standing 的 `.tao` 骨骼。

## 5. 流程与目录

```
art/                 源文件（不打包）
  prompts/           每张图的 prompt .txt
  heroes/ enemies/ icons/ bg/ store/
  style/             样板图、各轮试稿
tools/               从 standing 复制：generate_image.sh、edit_image.sh、mistral_failover.sh、
                     cutout.py、bake_mob.py、pack_icons.py、lineup_test.py、make_tile.py、
                     make_logo.py、cover_*.py
public/art/          打包进游戏的成品（256 色量化 PNG / JPEG）
```

生成 → `cutout.py` 抠图缩放 → 256 色量化 → `lineup_test.py` 检查描边、饱和度、暖色占比 → 打包 → 用 Pixi `Assets.load` 加载。

**体积预算**：首包 ≤5 MB（CrazyGames 上限 50 MB、移动端首页 20 MB），从 standing 复制包体检查脚本，加进 `npm run check`。

## 6. 里程碑

1. **M1 风格样板**（先给你确认）：狐狸游侠 1★ 和 3★、哥布林、1 个技能图标，放进游戏里截图。
2. **M2 全员**：其余英雄、敌人、图标，过 `lineup_test` 检查。
3. **M3 接入**：替换占位图形，加代码动画，完成横屏布局。
4. **M4 商店素材**：Logo、3 张封面、录屏。

## 7. 风险

- **画风漂移**：靠"始终从样板图 edit"控制，并把每轮试稿留档。
- **正面行走帧**：standing 的敌人是侧面。正面朝镜头的行走用 bob/squash 烘焙是否自然，要在 M1 验证；不自然就改成"侧身斜向走"。
- **Mistral 内容审核偶尔拒图**：funny 遇到过，必要时换 prompt 措辞。
- **版权**：上线前确认所用 AI 出图服务的商用条款；字体只用 OFL/Apache 授权，音效只用 CC0。
