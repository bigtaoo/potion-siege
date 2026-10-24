# Load and frame cost: before / after 4c3fb03

Measured 2026-10-22 on one Windows laptop (Intel Arc, headless Chrome). Before is main at d0fc2e0;
after is 4c3fb03 (WebP art, CrazyGames boot in parallel, pooled enemy shadows and bars, antialias
off at resolution 2 and up). Every other setting was the same for both builds.

## CrazyGames boot

`CG_SDK_MS=<ms> npm run firstframe -- <cg dist> 7` on a `vite build --config
vite.crazygames.config.js` build. The portal is blocked and a fake SDK stands in for it, its
init settling after 300 or 1000 ms. Fast 3G, 4x CPU, 390x844@3, median of 7 runs.

| SDK init | before (PNG, serial boot) | WebP, serial boot | after (WebP, parallel boot) |
|---|---|---|---|
| 300 ms | 6.78 s, 764 kB | 5.18 s, 402 kB | 5.25 s, 402–456 kB |
| 1000 ms | 7.46 s, 764 kB | 5.82 s, 402 kB | 5.51 s, 402–659 kB |

The middle column is the after tree with the old serial `main.crazygames.ts`. It shows each change
on its own:

- **WebP** saves about 1.6 s at either SDK delay.
- **The parallel boot** saves 0.31 s at 1000 ms. At 300 ms it saves nothing: +0.07 s, within
  noise.

The parallel boot has a cost. While the SDK is still starting, the first battle's art finishes and
the later art starts loading, so it takes bandwidth from the boot. Some runs had 20–33 requests
and up to 659 kB in flight before the first frame; one cold run took 8.91 s. Holding back the
SOON/LATER art until boot() has started would take that away.

## Battle frame cost

`npm run framecost -- <dev dist> horde|endless 10` on a dev build of each commit. Autoplay
battle at `?quality=high` (resolution held at 3), 4x CPU, 390x844@3, Math.random seeded alike,
10 s window. Median shown.

- "Rebuild" is the inclusive time of Pixi's `updateGpuContext`, as a share of busy script time.
- "Shapes rebuilt" counts the instructions of the Graphics contexts that were dirty when the
  renderer rebuilt them.

### Horde opener (stage 1, wave 1), 3 runs each

| | before | after |
|---|---|---|
| enemies on the road (mean / max) | 14 / 26 | 14 / 26 |
| script ms per frame | 7.76 | 6.24 (−20%) |
| Graphics rebuild share | 41.7% | 35.8% |
| Graphics rebuild ms per frame | 3.24 | 2.25 (−31%) |
| buildLine share | 15.0% | 11.0% |
| contexts rebuilt per frame | 12.6 | 12.6 |
| shapes rebuilt per frame | 155 | 118 (−24%) |
| frame interval median / p95 | 16.7 / 16.8 ms | 16.7 / 16.8 ms |

### Endless wave 20

To get here, the wall is kept full from the page in both builds, because autoplay on a fresh save
falls around wave 4. The run is fast-forwarded at speed 25 and drops to 1x on the first frame of
wave 20.

That fast-forward is not fully repeatable. Across the runs, 122, 188 or 265 enemies were on the
road, so only runs that matched are compared below: 122 enemies in both builds, 3 runs before and
2 after.

| | before | after |
|---|---|---|
| enemies on the road (mean / max) | 122 / 123–126 | 122 / 125 |
| script ms per frame | 25.3 (24.0–27.8) | 22.4–23.2 (−10%) |
| Graphics rebuild share | 46% | 40% |
| Graphics rebuild ms per frame | 11.7 | 8.9–9.3 (−22%) |
| shapes rebuilt per frame | 743–772 | 376 (−50%) |
| frame interval median / p95 | 33.3 / 33–50 ms (30 fps) | 16.7 / 33.4 ms (60 fps) |

The after build with 265 enemies still came in under the before build with 122: 19.8–23.5 ms
script per frame, 6.8–7.7 ms rebuild and 330 shapes.

Late waves are still over the 16.7 ms budget at 4x CPU. The rest of the rebuild comes from the
Graphics redrawn every frame:
- `fx.mid`: hit flashes and the circles of effects.
- `world`: elite rings, beams and boss parts.
- `grid`.
- the potion figures.
- `heroOver`.

During the horde these account for 32, 18, 15, about 10 each, and 7 shapes per frame. The wall and
the field ground are drawn once.

## GPU texture memory: texture GC, TexturePool and context loss

Three fixes from another Pixi 8 game (standing 00b54ee, 64ac1bc, df4e646), checked against this
one. Measured with `npm run memruns` (430×932 at 2x, headless Chrome), which now also prints GPU
texture MB by kind (`artMB` loaded art, `textMB` live text, `scratchMB` sources with nothing behind
them: text textures given back to Pixi's TexturePool) and `reup`, how many art uploads were
repeats. `PORT` and `CDP_PORT` move memruns, framecost and contextloss off their default ports.

**1. Texture GC off on loaded art: applies, ported.** Pixi's GC unloads an image source that no
frame drew for 60 s; the next frame that draws it uploads it again, mid-battle. `art.ts` now sets
`autoGarbageCollect = false` on every texture it loads (first, soon, later art and fields). All of
it is held for the session already and nothing in the game frees art by hand, so there was nothing
to free instead.

| memruns | before | after |
|---|---|---|
| 12 runs at speed 8: art re-uploads | 3 (enemy_flyer, enemy_winder ×2) | 0 |
| 5 runs at speed 2 (≈130 s each): art re-uploads | 4 / 10 / 12 / 16 / 22 after runs 1–5 | 0 |
| what went up again at speed 2 | potion arcane, lightning, fire, ice_ult ×4, poison, wind_ult ×3 | – |

`artMB` stays at 13.5–14.5 MB in both.

**2. TexturePool cleared at battle start: applies, through Text, not filters.** The game uses no
filters or render targets, but every Pixi Text texture comes from the same TexturePool, and a text
destroyed with its screen gives its texture back to the pool, which keeps it on the GPU for good.
`newBattle` now clears the pool once the menu or result screen is torn down.

| | before | after |
|---|---|---|
| 12 runs at speed 8: GPU textures after a run | 48 at start → 118–143 | 39 → 61–65 (stage), 87–89 (endless) |
| scratchMB after a run | 15.5–19 (stage), 10.5–11 (endless) | 0–0.5 |
| 5 runs at speed 2: GPU textures / scratchMB | 93–125 / 15–19.5 | 45–46 (72 endless) / 0–0.5 |
| mid-battle at speed 1, 25 s in (2 runs): GPU textures / scratchMB | 92, 98 / 15.5, 17 | 39, 40 / 0, 2 |

JS heap after a run (14.4–22.7 MB before, 15.3–22 after) and allocation in a battle (135.6 vs
131.9 MB/s at speed 8; 104.7 vs 147.2 at speed 2, which is noise between runs) do not move.

**3. Redraw baked render textures on context restore: does not apply.** The game bakes nothing
into render textures (no `generateTexture`, no `RenderTexture`), Pixi 8.22 regenerates Text after a
context comes back, and the one canvas texture (the enemy mark disc) uploads again from its canvas.
`npm run contextloss` checks it: it freezes the game's tick, takes two screenshots (noise), loses
the context with `WEBGL_lose_context`, restores it and compares; same for the home screen.

| contextloss | battle | home |
|---|---|---|
| noise between two frames | 0% | 0% |
| while lost (shows the test can tell) | 97.9% off, mean 161.8 | 97.7% off |
| after restore | 0%, mean 0 | 0% |

Same result before and after fixes 1 and 2.

**Frame cost.** `npm run framecost` on the horde (10 s, wave 1, 4x CPU), builds alternated: before
11.42 / 11.55 ms script per frame (a first, cold run at 16.47 left out), after 10.85 / 9.68 (one
run did not start);
interval median 17.4 vs 17.3–17.5 ms, p95 18.1 vs 18.0–18.1. The fixes are about memory and
hitches after a minute, which a 10 s bench does not reach, so this only shows no cost.
