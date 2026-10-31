# Store listing — Potion Siege (药水围城)

Texts, tags, controls, covers and the trailer plan for the CrazyGames submission. The listing text in all
15 languages, for the App Store and CrazyGames, one file per field, is in `store/` (see `store/README.md`).
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
> Between battles, level up your potions, upgrade the workshop, push through five chapters — from the
> outskirts to the clock tower, each with its own boss — and take on the daily challenge with its own twists.
>
> - Merge-and-defend battles that last a few minutes
> - 6 potion heroes, 30+ skills, ultimate potions with bonus skills
> - 5 clockwork enemies with their own weaknesses and 5 bosses, 50 stages in 5 chapters
> - Endless mode: how many waves can your wall hold?
> - Daily challenge, daily tasks and rewards
> - Available in 15 languages

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
> 战斗之外，升级药水、强化工坊、从城郊一路打到钟楼，闯过各有首领的五个章节，再挑战每天规则不同的每日挑战。
>
> - 几分钟一局的合成守城
> - 6 种药水英雄，30 多个技能，终极药水附赠技能
> - 5 种发条敌人各有弱点，外加 5 个首领，5 章共 50 关
> - 无尽模式：看你的城墙能守多少波
> - 每日挑战、每日任务与奖励
> - 支持 15 种语言

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
| Portrait 9:16 (Playgama) | 1080x1920 | `ref/store/cover_portrait_1080x1920_en.png`: the 800x1200 cover scaled to 1080x1620 over a blurred, darkened fill |

How the candidates were made: composed with PIL from the game's own art (the PNG/JPEG sources, now in `art/web/`; `public/art/` ships WebP made from them):
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
- [ ] "Progress Save" switched on in the submission form (otherwise the data module is off and saves stay in the browser's localStorage only)
- [ ] QA tool: 800x450, full screen, revive / ×2 / reroll ads, a midgame ad on the second run, progress after a reload
- Notes:
  - In Basic Launch the portal serves no ads. The game then grants revive, ×2 and reroll without one, which is by design.
  - The main JS chunk is 533 kB (Pixi plus the game; the zip is 2.4 MB in 38 files). It is fine for the portal's size limits, but code-splitting would speed up the first load.

## Playgama

The form is filled by hand at developer.playgama.com, under app `cmvpgdscx066aqz0hdg590l59`. It went into the sandbox on 2026-10-26: https://playgama.ai/play/phz4f742hcbir2. It has been in the catalog since 2026-10-28: https://playgama.com/game/potion-siege. Since 2026-10-31 the catalog runs build 0.0.1+3cfcacd.

- **Texts**: the description and How to play are in English and say "mouse only, tap on phones". They follow `store/en/crazygames/`. How to play ends with the orientation note: a phone is held upright, and a desktop or wide screen shows the field on its side.
- **Settings**: Desktop, iOS and Android; Portrait + Landscape, since wide screens turn the field on its side (the setting is one for all devices); no features; all 15 languages.
- **Covers**: square 800x800, portrait 9:16 1080x1920 and landscape 1920x1080.
- **Distribution**: on everywhere since 2026-10-29: Playgama may put the game on its partner platforms, and no platform is excluded. The catalog traffic alone was too small, and the owner decided against keeping CrazyGames exclusive.
- **Upload steps**:
  1. Run `npm run build:playgama` from a clean tree. Always zip with Python, because a PowerShell zip fails the Bridge check.
  2. Upload it through the Playgama MCP (in `~/.claude.json` for `D:/fang`): `start_archive_upload` with the exact zip size and the version in the name, `curl -T` the zip to the signed URL, `confirm_archive_upload`, then wait for `get_archive_status` PASSED.
  3. `publish_sandbox` with that archive (it needs an English update note when the build changes), and follow `get_publications` until PUBLISHED. `get_sandbox_state` names the archive the sandbox serves.
  4. For the catalog: check `get_submission_state` with reviewType AUTO, then `send_playgama_catalog_update` with the archive and an English update note. It skips moderation, so it needs the owner's yes for each update. Follow the PLAYGAMA row in `get_publications` until PUBLISHED, which takes a few seconds. Keep the note in `ref/store/playgama_update_note_<sha>.txt`.
  5. By hand instead: Update Game, drop the zip, Save Changes; Continue, pick the build, Publish/Update in Sandbox.
- **Storage**: Playgama requirement 3.2.1 allows no localStorage, sessionStorage, IndexedDB or cookies. Everything goes through Bridge's store, the `ps.copies` save copies included: they are one more key in `KEYS` in `PlaygamaPlatform.ts`. So the copies follow the portal account, and only the server copy at `/s` crosses accounts.
- **QA and moderation**: submitting to moderation and the QA tool run stay with the owner in the console; the MCP has no tool for them.
- **Catalog review**: it opens at 100 qualifying plays (each over 30 s) with a 5:00 average.
- **Data**: our collector is off in the sandbox, so sandbox data is only in Playgama's console and in the events bridgeSink sends. The catalog game does send to our collector: real players are the lines with platform `playgama` and an sdk that is not qa_tool.
