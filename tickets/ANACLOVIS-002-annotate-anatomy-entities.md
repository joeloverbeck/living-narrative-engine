# Goal
Annotate genital and torso anatomy entities with the new visibility rules component so they respect clothing coverage.

# File list
- `data/mods/anatomy/entities/definitions/human_penis*.entity.json` (add `anatomy:visibility_rules` with `clothingSlotId: torso_lower`, `nonBlockingLayers: ['underwear', 'accessories']`)
- `data/mods/anatomy/entities/definitions/human_testicle*.entity.json` (same visibility rules as penis entries)
- `data/mods/anatomy/entities/definitions/human_vagina*.entity.json` (same visibility rules as penis entries)
- `data/mods/anatomy/entities/definitions/pubic_hair*.entity.json` (same visibility rules as penis entries)
- `data/mods/anatomy/entities/definitions/human_torso*.entity.json` (visibility rules using `clothingSlotId: torso_upper`, `nonBlockingLayers: ['underwear', 'accessories']`, excluding breast-specific entries)

# Out of scope
- Creating or renaming anatomy entities
- Editing descriptor text or ordering metadata beyond adding the new component
- Introducing runtime logic changes for visibility checks

# Acceptance criteria
- Tests
  - `npm run validate:ecosystem` passes
  - Any targeted schema/entity validation added for the new component remains green
- Invariants
  - No existing descriptor content, ordering, or sockets are modified
  - Only the specified entities gain the visibility component; unrelated anatomy entities remain untouched
