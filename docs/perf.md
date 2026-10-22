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
