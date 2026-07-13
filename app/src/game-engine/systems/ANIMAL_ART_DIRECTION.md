# Procedural Animal Art Contract

All player and NPC animals are generated at runtime as original 96 x 96 Phaser
textures. The set deliberately shares one visual language instead of mixing
emoji, third-party illustrations, and unrelated fallback shapes.

## Shared grammar

- Chunky side-view geometry with exaggerated species landmarks.
- A consistent 6px-equivalent deep-plum (`#3B0855`) silhouette keyline.
- Two body colors plus one accent per species; cream eyes keep faces readable.
- Layer order is feet/tail, body, markings, head, face so every animal remains
  recognizable when NPC textures are displayed at 64px.
- Texture keys remain `animal-{species}` for network, lobby preview, and saved
  profile compatibility. Textures are generated once per Phaser texture cache.

## Biome palettes

- Forest: moss, bark, warm cream, with coral or turquoise equipment accents.
- Marine: lagoon teal and deep-water blue, with coral/pink reef accents.
- Savannah: dusk gold, clay, cream, and plum shadow markings.

`ANIMAL_SPECIES_STYLES` is the source of truth for body plan, marking system,
biome, palette, and readable silhouette cue. New species must add a descriptor,
an `AnimalType` entry, and a test-covered drawing body plan. No external raster
asset or license attribution is required for this procedural set.
