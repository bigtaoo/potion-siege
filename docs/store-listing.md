# Store listing — Potion Siege (药水围城)

Texts, tags, controls, covers and the trailer plan for the CrazyGames submission.
Requirements checked against docs.crazygames.com (game covers, preview video) on 2026-10-16.

## Name

- en: **Potion Siege**
- zh: **药水围城**

## Short description

**en** (one line):
> Brew, merge and defend: living potion bottles hold the castle wall against a clockwork army.

**zh**:
> 召唤、合成、守城：一群活泼的药水瓶，帮老法师挡住发条军团的进攻。

## Long description

**en**

> The clockwork army is marching on the alchemist's castle — and his potions have come to life to stop it.
>
> Summon potion heroes onto the wall, then drag two matching potions together to brew a stronger one.
> Fire tonics blast crowds, frost tonics slow them, storm tonics chain lightning, arcane tonics never miss —
> and later the corrosion and gale tonics join the fight. Every upgrade offers three skills: build your
> run around one potion or mix them all.
>
> Hold the wall for 10 waves against tin soldiers, clock mice, boiler golems, ornithopters, winder spiders
> and the steam tank boss. Each enemy fears different potions — read the wave forecast and plan your brew.
>
> Between battles, level up your potions, upgrade the workshop, unlock new stages and take on the daily
> challenge with its own twists.
>
> - Merge-and-defend battles that last a few minutes
> - 6 potion heroes, 30+ skills, ultimate potions with bonus skills
> - 6 clockwork enemies with their own weaknesses, 20 stages
> - Daily challenge, daily tasks and rewards
> - English and Chinese

**zh**

> 发条军团正向炼金师的城堡进发——他的药水们活了过来，要守住城墙！
>
> 在城墙上召唤药水英雄，把两瓶相同的药水拖到一起，就能合成一瓶更强的。火焰药剂炸散敌群，冰霜药剂减速，
> 雷电药剂连锁弹射，奥术药剂百发百中，之后还有腐蚀和疾风药剂加入战斗。每次强化都有三个技能可选：
> 专精一种药水，或者混搭全部。
>
> 守住 10 波进攻：锡兵、发条鼠、锅炉魔像、扑翼机、上弦蜘蛛，还有蒸汽坦克首领。每种敌人怕的药水不同——
> 看看波次预告，提前布阵。
>
> 战斗之外，升级药水、强化工坊、解锁新关卡，再挑战每天规则不同的每日挑战。
>
> - 几分钟一局的合成守城
> - 6 种药水英雄，30 多个技能，终极药水附赠技能
> - 6 种发条敌人，各有弱点，共 20 关
> - 每日挑战、每日任务与奖励
> - 中文与英文

## Category and tags

- Category: **Strategy** (fallback: Casual)
- Tags (pick from the portal's list): Merge, Tower Defense, Defense, Strategy, Magic, Wizard, Robot,
  Casual, Mouse, Touch, 2D, Cute, Upgrade, Singleplayer

## Controls

| Action | Mouse | Touch |
|---|---|---|
| Summon a potion | Click **Summon** | Tap **Summon** |
| Merge two potions | Drag one onto a matching one | Drag one onto a matching one |
| Upgrade (pick a skill) | Click **Upgrade**, then a skill card | Tap **Upgrade**, then a card |
| Menus | Click the tabs and buttons | Tap |

Portal text: *"Click Summon to brew a potion. Drag two matching potions together to merge them into a
stronger one. Click Upgrade to pick a skill."*
No keyboard is needed. The game works in landscape embeds (side boards beside the board) and on phones in portrait.

## Covers

CrazyGames needs three covers with the same look. Rules: no borders, the title is the only text (no
"New" or "Play now"), no icons or store logos, nothing blurry.

| Cover | Size | Candidate |
|---|---|---|
| Landscape | 1920x1080 (16:9) | `ref/store/cover_landscape_1920x1080_{en,zh}.png` |
| Portrait | 800x1200 (2:3) | `ref/store/cover_portrait_800x1200_{en,zh}.png` |
| Square | 800x800 (1:1) | `ref/store/cover_square_800x800_{en,zh}.png` |

How the candidates were made: composed with PIL from the game's own art in `public/art/`:
- the field and the wall from the battle background
- the four starting potions in their ultimate forms
- the alchemist in the middle
- the clockwork army coming down the road behind them
- the title in gold with a dark outline

They live in `ref/` (gitignored). The script is kept with the session notes and can be re-run.

Plan for the final covers:
- **Keep**: the composition (potions on the wall in front, the enemies behind, the title at the top).
- **Improve**: the background. The field art is 1080 px wide and gets upscaled 1.8x for the landscape cover, so it is soft. A cleaner landscape cover redraws or regenerates the field at 1920 px.
- **Add**: a merge moment, two potions fusing with a burst. The covers would show the core mechanic, which they don't yet.
- **Language**: the English cover is the default. The Chinese one is for a localized listing, if the portal allows one.

## Trailer storyboard (15–20 s)

Requirements: 15–20 s (cut at 20), at most 50 MB, both **landscape 1080p 16:9** and **portrait 1080p 2:3**.
- Content: no sound, no fast-forward, open on the static cover.
- Avoid: black screens, logo transitions, black bars, the mouse cursor, promo text and icons.

| Time | Shot | Notes |
|---|---|---|
| 0.0–1.5 s | The landscape (or portrait) cover, held | The required opening frame |
| 1.5–4.0 s | A battle starts: wave 1 banner, tin soldiers walk down the road, three summons pop onto the wall | Real play, normal speed |
| 4.0–7.0 s | **Merge**: drag a fire tonic onto another, they fuse into a 2-star one; then two 2-stars into a 3-star | The core hook; a touch pointer, not a mouse cursor |
| 7.0–9.5 s | Upgrade, the three skill cards slide in, one is picked (Wildfire), and the next fire blast is visibly wider | Shows the run-building |
| 9.5–13.0 s | A busy mid wave: frost slowing, storm chaining, ornithopters overhead, gold popping | Many potions on the wall |
| 13.0–17.0 s | **BOSS WAVE!**: the steam tank arrives, the wall HP drops, an ultimate potion is brewed and the tank goes down | The climax |
| 17.0–19.5 s | The victory screen with the crystals, then a quick cut to the home screen lineup | The ending |

How to record:
- Use the web build with `?lang=en` in a 1920x1080 window, which shows the landscape side boards, and a 720x1080 window scaled to 1080x1620 for the portrait cut.
- Play by hand, because `?autoplay` drags too fast to read.
- Pin the seed and stage so takes repeat.
- Hide the cursor while capturing, then cut in a video editor.
- Export H.264 MP4 without an audio track.

## Before uploading

- [ ] `npm run check` green; zip the contents of `dist-crazygames/` (index.html at the zip root)
- [ ] The three covers chosen (and the Chinese set, if used)
- [ ] The trailer in both aspect ratios
- [ ] QA tool: 800x450, full screen, revive / ×2 / reroll ads, a midgame ad on the second run, progress after a reload
- Notes:
  - In Basic Launch the portal serves no ads. The game then grants revive, ×2 and reroll without one, which is by design.
  - The main JS chunk is 506 kB (Pixi plus the game, 3.0 MB total). It is fine for the portal's size limits, but code-splitting would speed up the first load.
