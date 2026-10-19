# Store listing text

The text for the App Store and CrazyGames listings in all 15 game languages, one file per field,
so each field is pasted (or uploaded) as a whole file. Covers, the trailer, tags and the submission
checklist are in `docs/store-listing.md`.

```
store/<lang>/app-store/name.txt              ≤ 30
store/<lang>/app-store/subtitle.txt          ≤ 30
store/<lang>/app-store/promotional_text.txt  ≤ 170
store/<lang>/app-store/description.txt       ≤ 4000
store/<lang>/app-store/keywords.txt          ≤ 100, comma separated, no space after a comma
store/<lang>/crazygames/short_description.txt  ≤ 160 (our limit), one line
store/<lang>/crazygames/controls.txt           ≤ 500 (our limit), one action per line
```

`node scripts/storeListing.mjs` prints every field's length per language and fails on a problem;
`src/i18n/store.test.ts` runs the same check in `npm test`. It also holds the store name equal to the
game's `title` and the controls naming the game's own Summon and Upgrade buttons in that language.
A file's trailing newline is not part of the text.

## Languages

| Folder | App Store Connect | Name |
|---|---|---|
| en | en-US | Potion Siege |
| zh | zh-Hans | 药水围城 |
| de | de-DE | Potion Siege |
| fr | fr-FR | Potion Siege |
| es | es-ES | Potion Siege |
| it | it | Potion Siege |
| pt | pt-BR | Potion Siege |
| pl | pl | Potion Siege |
| ru | ru | Potion Siege |
| ja | ja | ポーションシージ |
| ko | ko | 포션 시즈 |
| vi | vi | Potion Siege |
| tr | tr | Potion Siege |
| th | th | Potion Siege |
| id | id | Potion Siege |

`pt` is Brazilian (the game's `Tônico`, `você`); the same text can go into pt-PT. `es` can go into
es-MX too.

## Notes

- The text uses the game's own words from `src/i18n/<lang>.ts`: potion, enemy, boss and chapter
  names, the Summon and Upgrade buttons. Rename something in the game and grep `store/` for it.
- Keywords leave out words already in the name or subtitle (App Store search indexes those) and use
  "tower defense" and "td" in every language, since players search the English genre name too.
- English and Chinese grew from the text in `docs/store-listing.md`; the other thirteen were written
  for this listing and, like the game's translations, have not been read by a native speaker.
- The App Store description does not mention the ad-free purchase or ads; App Store Connect shows
  "In-App Purchases" on its own.
