# THIRD_PARTY_ASSETS

All four packs were downloaded on 2026-11-24 from the creators' official pages, free tier only. Nothing was bought.
The original zips are kept unchanged in `assets/_archives/` and extracted unchanged into `assets/vendor/`.
Derived (sliced or recoloured) files are kept separately in `assets/modified/` and are produced by `tools/build_art.py`.

| Asset | Creator | Source | License (as checked) | Used for |
|---|---|---|---|---|
| Tiny Swords (Free Pack) | Pixel Frog | https://pixelfrog-assets.itch.io/tiny-swords | Personal and commercial use allowed, modification allowed, credit optional. **No redistribution, resale or repackaging, even if modified.** | Terrain (64px), buildings, trees, gold stones, guild master (Warrior), workers (Pawn: chopping, mining, carrying), adventurers (Archer, Lancer, Monk), UI (paper, buttons, ribbons, avatars) |
| Pixel Art Automation Tileset | sierrassets | https://sierrassets.itch.io/automation-tileset | `assets/vendor/automation-tileset/LICENSE-itch.txt`: commercial and non-commercial games allowed, derivatives allowed. **No redistribution outside the game, no logos or trademarks, no merchandise**, and players must not be able to extract the assets. | Conveyor belt, 6 animated machines (on and off states), factory items |
| 16x16 Assorted RPG Icons | Merchant Shade | https://merchant-shade.itch.io/16x16-mixed-rpg-icons | Free, commercial use allowed, modification allowed, credit not required. | Weapons, books (quest scrolls), potions, chests, armour icons |
| UI Pack – Pixel Adventure 2.0 | Kenney | https://kenney.nl/assets/ui-pack-pixel-adventure | CC0 (`assets/vendor/kenney-ui-pixel-adventure/License.txt`) | Supporting UI: build-menu slots and panels |
| Galmuri (font) | Minseo Lee | npm `galmuri` | OFL-1.1 | Korean pixel font (planned) |

## Redistribution warning
Tiny Swords and the Automation Tileset **must not be published as raw files**.
If the GitHub repository is **public**, `assets/vendor`, `assets/_archives` and `assets/modified` must stay out of git (see `.gitignore`). Recreate them with `tools/fetch_itch.py` and `tools/build_art.py`.
Shipping them inside a compiled game build (Windows/WebGL) is allowed.

## Credits (optional, but we include them)
Art by Pixel Frog (Tiny Swords), sierrassets (Automation Tileset), Merchant Shade (RPG Icons) and Kenney (kenney.nl).
