# Herd & Seek — Seamless World Expansion Specification

Status: implemented and release-verified for the July 2026 tablet-first world, interface, audio, networking, animation, and soccer expansion.

## July 2026 implementation record

This release extends the existing 6,000×6,000 seamless reserve rather than replacing it with a second world. It adds a server-authenticated daily district event, discovery-based fast travel, reconnect-safe position recovery, bounded client rendering budgets, and organic held-state ambient herds. All reward, travel, room, loadout, and match decisions remain authoritative in the Worker Durable Objects.

The tablet gameplay pass adds a shared DOM control layer for hunt, open-world, and soccer scenes. It supports fixed or floating joystick placement, left- or right-handed layouts, scale and opacity preferences, pointer capture and cancellation, keyboard input, and gamepad input. Preferences persist locally, while loss of focus, orientation changes, and pointer cancellation always clear movement and actions.

Solo play now defaults to a clearly explained Beginner tier with spawn protection, short bot sight, delayed reactions, intentional misses, limited ranger ammunition, and acceleration-based animal movement. NPCs use persistent intent states instead of changing direction every frame. Easy, Medium, and Hard retain progressively steeper reaction, sight, resource, and movement tuning.

The release also adds a lobby Levels entry, a visible authenticated Admin entry with explicit logout, fictional cosmetic hunter tools and species-safe animal skins, `HSR-` room codes, and a production health release marker. The admin passphrase is a deployment secret and is never stored in source, client bundles, tests, logs, or this specification.

## Product direction

Herd & Seek is a toyetic social wildlife adventure: readable in seconds, expressive in motion, and deep enough to explore with friends. The supplied references establish a graphic grammar of block-built characters, thick silhouettes, sunny outdoor scenes, and playful high-contrast composition. The implementation is original and does not copy third-party branding, logos, characters, or UI.

### Visual tokens

| Token | Value | Primary use |
| --- | --- | --- |
| Deep plum | `#3B0855` | Outlines, navigation, high-contrast surfaces |
| Berry | `#852467` | Secondary actions, multiplayer identity |
| Coral | `#FD8083` | Friendly highlights and team coral |
| Hot pink | `#EE227D` | Focus, rare rewards, urgent accents |
| Lake blue | `#498099` | Water, informational UI, team blue |
| Lagoon | `#30C0B7` | Success, online status, exploration |
| Sun | `#FFD45C` | Primary action, coins, wayfinding |
| Cream | `#FFF5DE` | Text and paper-like panels |

Shared shape rules: 3–5 px dark outlines, 12–24 px radii, offset hard shadows, deliberately chunky geometry, minimum 44 px touch targets, and no glassmorphism. Headings use a rounded display stack; controls use a highly legible sans-serif stack. Motion respects `prefers-reduced-motion`.

## 1. UI and UX overhaul

### Technical specification

- Home: immediate game identity, animated toy-world depth, one-field name entry, independent Music and SFX controls, keyboard and touch submission.
- Mode hub: one dominant seamless-world action plus public/private rooms, solo challenge, and soccer activities. Cards must explain player count and session behavior before entry.
- Lobby: room identity, host state, player readiness, biome/morph selection, audio settings, shop, and explicit admin entry. Admin authentication remains server-authoritative.
- Gameplay HUD: objective, role, timer, ammo/perk, event feed, connection health, and compact audio controls without obscuring play.
- Responsive targets: 360×640, 768×1024, 1366×768, and ultrawide. Safe-area insets are required around interactive controls.

### Acceptance criteria

- All core flows can be completed by keyboard and touch.
- Focus is visible, status changes use live regions, and essential text reaches WCAG AA contrast.
- The interface stays legible with 200% text zoom and reduced motion enabled.

## 2. Seamless open world

### Technical specification

- A single Phaser scene contains a 6,000×6,000 reserve—four times the original playable area. Districts are spatial biomes, not separately loaded levels.
- Districts: Ranger Outpost, Sunstep Grasslands, Moonfern Forest, Tideglass Wetlands, Ember Ridge, Acacia Grove, and Striker Field.
- The authoritative Durable Object publishes player positions, collectibles, quest state, and world events. Clients interpolate remote movement and never award their own rewards.
- World density uses deterministic seeded decoration and pooled interactive objects. A minimap and landmark silhouettes preserve orientation without loading screens.
- A single player can enter without creating a room and complete quests alongside ambient herds; when other explorers connect, the same topology becomes multiplayer automatically. Legacy timed hunt challenges remain available from the mode hub.
- Clients deterministically generate world decoration while the server remains authoritative for players, quest state, collection distance, movement bounds, persistence, and rewards.

### Acceptance criteria

- Travel between every district has no scene transition or page reload.
- At least seven distinct landmarks and three terrain media are visually recognizable.
- Quest collection, persistence, multiplayer interpolation, and reconnect all continue across district boundaries.

## 3. Character and environment animation

### Technical specification

- A terrain sampler returns `grass`, `forest`, `rock`, `sand`, `shallowWater`, or `deepWater` for any world position.
- Locomotion is velocity-driven: stride bob, lean, squash/stretch, facing, acceleration anticipation, idle breathing, and remote-player interpolation.
- Shallow water changes the stride profile; deep water uses a buoyant wade/swim profile and reduced horizontal acceleration.
- A pooled ripple/displacement system emits concentric rings and short-lived wake marks only when speed and terrain thresholds are met.
- NPC cadence is species-aware, with small prey using faster shorter steps and large herd animals using slower weightier motion.
- Animation amplitude is reduced or disabled when reduced motion or low quality is active.

### Acceptance criteria

- Idle, walking, running, and wading are visibly distinct.
- Ripples follow characters in water without unbounded object creation.
- Local, remote, and NPC movement share the same art direction while retaining species weight.

## 4. Audio engineering

### Technical specification

- Web Audio mixer buses: master → independent Music and SFX gain stages.
- Playback unlocks from the initial Play gesture to satisfy browser autoplay rules.
- Original, deterministic, project-owned audio assets are generated at build time: reserve and soccer loops, shot, UI confirm, and biome footstep families. No third-party recording or license dependency is introduced.
- Surface-aware footsteps are rate-limited by locomotion cadence. Water, grass, rock, sand, and forest each have a distinct timbre.
- BGM changes by activity, crossfades where possible, loops without blocking gameplay, and persists independent Music/SFX preferences in local storage.

### Acceptance criteria

- Music can be muted while shots and footsteps remain audible, and vice versa.
- No audio plays before a user gesture; settings persist after refresh.
- Audio failure degrades silently and never blocks the game.

## 5. Multiplayer room directory and matchmaking

### Technical specification

- Public rooms are discoverable in a live directory showing room name, occupancy, state, and creation time.
- Private rooms require room name and password. Passwords are never stored or transported after join as plaintext: the Worker stores a salted cryptographic verifier and exchanges a valid password for a short-lived opaque room access token.
- WebSocket upgrades for protected rooms require the room token. Existing direct room-code sessions remain compatible.
- Directory API: `GET /api/rooms`, `POST /api/rooms`, and `POST /api/rooms/join`; clients refresh while visible and expose loading, empty, full, and failure states.
- Room names are normalized, bounded, and checked for collisions. Activity-specific authorization prevents hunt and soccer credentials from crossing modes, while private-room failures never expose password material.

### Acceptance criteria

- A public room appears without refresh and can be joined from the adjacent list.
- A private room cannot be joined or upgraded with an absent/invalid token.
- Neither directory responses, logs, session storage, nor WebSocket URLs contain the password.

## 6. Scale and difficulty

### Technical specification

- Existing forest, deep-dark, and savannah maps become challenge districts and use expanded arena bounds, additional sightline blockers, water/terrain patches, and recognizable landmarks.
- Player-facing tiers are Easy, Medium, and Hard (`normal` remains the compatible wire value for Medium).
- Easy: slower, less perceptive bots; generous hunter resources; broad aim tolerance.
- Medium: baseline speed, prediction, and balanced ammo.
- Hard: faster reactions, coordinated evasion, tighter resources, increased objective density, and higher reward multiplier.
- All rewards and win conditions remain server-authoritative.

### Acceptance criteria

- Each tier changes at least bot reaction, movement, aim/evasion, and resource pressure.
- Difficulty rises monotonically and is described before start.

## 7. Consistent biome animals

### Technical specification

- Animals are assembled from a shared block-animal grammar: outlined body mass, squared muzzle, two-tone planes, readable ears/horns/tails, and two or four grounded legs.
- Palette and accessory accents identify biome without changing the silhouette needed for gameplay.
- Forest roster favors rabbit, fox, deer, and bear; wetland/marine art favors turtle, otter, frog, and seal-like shapes; grassland uses zebra, gazelle, wildebeest, and meerkat.
- Texture generation is deterministic and cached per species/variant. No emoji or third-party character art is used in gameplay sprites.

### Acceptance criteria

- Every playable/NPC species is identifiable at HUD and gameplay sizes.
- Mixed-biome rosters still look like one game, while district-native animals feel contextual.

## 8. Striker Field soccer

### Technical specification

- A dedicated Phaser activity scene uses a deterministic fixed-step rules core for responsive top-down collision, damping, wall/goal interaction, possession impulses, and reset after scoring.
- Team setup supports the readable Ranger Squad and Wild Herd identities. The compatible wire format retains the internal coral/teal identifiers, while all player-facing setup, HUD, and result copy uses the role names. The same command/snapshot bridge runs local AI play or an authoritative multiplayer Durable Object.
- AI opponents choose attack, support, mark, intercept, and goalkeeper behaviors using distance and ball trajectory heuristics.
- Match loop: kickoff, regulation timer, scoring, reset, final result. HUD shows team, score, clock, stamina/action prompt, and exit.
- Visual language uses the shared block-animal silhouettes, palette, outlines, pitch landmarks, responsive crowd motion, ball trail, and goal celebration.

### Acceptance criteria

- Ball momentum, friction, kick impulse, goal detection, score, reset, AI pressure, and full-time state are covered by deterministic rule tests.
- Both teams are selectable; local input supports keyboard, touch, and gamepad bridge commands. Quick Play gives only the human-controlled character an 8% movement advantage; multiplayer remains speed-equal and server-authoritative.

## Release gates

- App: lint, unit/integration tests, production build, full multi-project Playwright suite, tablet Chromium, and tablet WebKit.
- Worker: TypeScript validation, unit/integration tests, room-directory authorization, profile migration/loadout validation, open-world event/travel validation, and soccer authority tests.
- Performance: tablet browser gameplay must hold a 30 FPS one-percent-low floor under the automated software-rendering test, with quality-tier caps on props, foliage, particles, and ambient NPCs.
- Accessibility: 44 px touch targets, visible focus, semantic dialogs, safe-area padding, reduced-motion behavior, and non-color-only role/state labels.
- Production: Worker health/release response, directory HTTP responses, authenticated room WebSocket upgrade, Pages navigation, admin login/logout, and tablet browser gameplay smoke.

## Delivery and verification sequence

1. Establish tokens, responsive shell, and accessibility rules.
2. Add secure room directory and session-token plumbing.
3. Expand the world coordinate model and district content.
4. Add shared terrain, locomotion, ripple, and environmental cue systems.
5. Add independent audio buses and generated original assets.
6. Add soccer setup, rules, scene, controls, and AI.
7. Normalize generated animal textures and biome rosters.
8. Run unit, integration, accessibility, build, and browser smoke suites.
9. Commit intentionally, push the feature branch, merge through the repository’s normal workflow, deploy Worker then Pages, and verify production routes and WebSocket behavior.

## Asset manifest

| Asset family | Format | Source/licensing | Budget |
| --- | --- | --- | --- |
| Character and environment art | Runtime SVG/Phaser vector textures | Original project code | Cached textures, ≤256 px per sprite atlas cell |
| Reserve BGM | Mono WAV, 22.05 kHz / 16-bit | Deterministically composed, project-owned | ≤1.0 MB loop |
| Soccer BGM | Mono WAV, 22.05 kHz / 16-bit | Deterministically composed, project-owned | ≤1.0 MB loop |
| SFX families | Mono WAV, 22.05 kHz / 16-bit | Deterministically synthesized, project-owned | ≤80 KB each |
| Reference images | Design input only | User-supplied; not redistributed | Not shipped |
