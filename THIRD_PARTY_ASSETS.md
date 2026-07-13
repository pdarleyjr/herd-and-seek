# Third-party assets and libraries

## Runtime libraries

| Source | Package | Version | Author | License | Use |
| --- | --- | ---: | --- | --- | --- |
| npm / phaser.io | Phaser | 4.1.0 | Phaser Studio Inc. and contributors | MIT | Client rendering, scenes, Arcade Physics, cameras, input, tweens, and particles |
| npm / Deque Systems | @axe-core/playwright | 4.12.1 | Deque Systems and contributors | MPL-2.0 | Automated accessibility checks in Playwright |

## Art assets

No external art pack was added in this migration. Existing animal and forest PNG files are repository-owned pre-existing assets and retain their original filenames under `app/public/assets/`. The migration adds original project artwork in `app/public/game-assets/`: `forest-ranger.svg`, `deep-scuba.svg`, and `savannah-ranger.svg`. These were created specifically for Herd & Seek and are not derived from a third-party or commercial game.

Generated atlas files are deterministic derivatives of the repository-owned source sprites under `app/assets-src/`; their WebP/PNG encoding, one-pixel edge extrusion, frame coordinates, and compression changes are recorded by Phaser atlas JSON and the generated reports.
