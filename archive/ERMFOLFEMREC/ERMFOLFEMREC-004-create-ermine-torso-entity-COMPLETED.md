# ERMFOLFEMREC-004: Create ermine-folk female torso entity (COMPLETED)

Add ermine-folk female torso entity with required sockets, health/weight tuning, and damage propagation rules per spec.

## Outcome
- Added `data/mods/dredgers/entities/definitions/ermine_folk_female_torso.entity.json` with lissom build, health 45, weight 20, and matching cat-girl-derived damage propagation and sockets per spec.
- Kept manifest/blueprint/recipe untouched per ticket scope; torso remains unregistered until a later manifest sync.

## Updated assumptions
- Schema/id: new entity uses `entity-definition.schema.json` with id `dredgers:ermine_folk_female_torso` and the lissom descriptor from `specs/ermine-folk-female-recipe.md`.
- Anatomy parity: mirror `anatomy:cat_girl_torso` structure—`anatomy:part.hit_probability_weight` 45 and `health_calculation_weight` 10, plus `anatomy:visibility_rules` (`clothingSlotId` `torso_upper`, `nonBlockingLayers` `underwear` and `accessories`).
- Sockets (explicit ids and allowed types): `neck` (head/neck), `left_shoulder`/`right_shoulder` (arm), `left_hip`/`right_hip` (leg), `left_chest`/`right_chest` (breast), `pubic_hair` (pubic_hair), `vagina` (vagina), `asshole` (asshole), `left_ass`/`right_ass` (ass_cheek), `lower_back` (tail), `heart_socket` (heart), `spine_socket` (spine).
- Damage propagation: same two rules as the cat-girl torso—`heart_socket` (baseProbability 0.3, damageFraction 0.5, modifiers piercing 1.5 / blunt 0.3 / slashing 0.8) and `spine_socket` (baseProbability 0.2, damageFraction 0.5, modifiers piercing 1.2 / blunt 0.5 / slashing 0.6).
- Scope stays narrow: no manifest/blueprint/recipe wiring; only the torso definition file is created/edited.

## File list
- data/mods/dredgers/entities/definitions/ermine_folk_female_torso.entity.json (new torso entity with sockets and descriptors)

## Out of scope
- Ear/tail entities
- Blueprint or recipe wiring
- Manifest edits

## Acceptance criteria
- Tests: `npm run validate:quick` passes
- Invariants: torso health 45, weight 20, build `lissom`; anatomy part weights set (`hit_probability_weight` 45, `health_calculation_weight` 10); visibility rules present per cat_girl pattern.
- Sockets exactly match the spec list above (ids, orientations, allowedTypes/templates) including separate left/right chest and left/right ass sockets.
- Damage propagation matches the spec values above (heart/spine rules only).
- No other entity files changed; manifest/blueprint/recipe remain untouched.

## Test results
- `npm run validate:quick`
