# INJREPANDUSEINT-010: Vital Organ Entity Definitions

## Status: COMPLETED

## Description

Create entity definitions for vital organs and update torso/head entities with damage propagation.

## Assumption Corrections (Pre-Implementation Review)

The following assumptions in the original ticket were corrected after reviewing the actual codebase:

1. **Head Entity Naming**: Original ticket assumed `human_male_head.entity.json` and `human_female_head.entity.json` exist. Actual codebase uses gender-neutral `humanoid_head.entity.json` shared by all human blueprints.

2. **Blueprint Modification Approach**: Original ticket assumed direct modification of `*.blueprint.json` files. Actual codebase uses composition via `humanoid_core.part.json` and slot libraries. Organ slots are added to the part file and slot library instead.

## File List (Corrected)

| File | Action |
|------|--------|
| `data/mods/anatomy/entities/definitions/human_heart.entity.json` | CREATE |
| `data/mods/anatomy/entities/definitions/human_brain.entity.json` | CREATE |
| `data/mods/anatomy/entities/definitions/human_spine.entity.json` | CREATE |
| `data/mods/anatomy/entities/definitions/human_male_torso.entity.json` | MODIFY - add damage_propagation, sockets |
| `data/mods/anatomy/entities/definitions/human_female_torso.entity.json` | MODIFY - add damage_propagation, sockets |
| `data/mods/anatomy/entities/definitions/humanoid_head.entity.json` | MODIFY - add damage_propagation, brain socket |
| `data/mods/anatomy/parts/humanoid_core.part.json` | MODIFY - add organ slot definitions |
| `data/mods/anatomy/libraries/humanoid.slot-library.json` | MODIFY - add organ slot types |

## Out of Scope

- Service implementations
- UI components
- Non-human anatomies

## Acceptance Criteria

### Tests That Must Pass

- `npm run validate` passes for all modified/created files
- `npm run test:integration` passes

### Invariants

- Heart entity:
  - Has `anatomy:vital_organ` with `organType: "heart"`
  - Has `anatomy:part_health` with appropriate maxHealth (e.g., 50)
  - Located inside torso via socket
- Brain entity:
  - Has `anatomy:vital_organ` with `organType: "brain"`
  - Has `anatomy:part_health` with appropriate maxHealth (e.g., 40)
  - Located inside head via socket (per user decision)
- Spine entity:
  - Has `anatomy:vital_organ` with `organType: "spine"`
  - Has `anatomy:part_health` with appropriate maxHealth (e.g., 60)
  - Located inside torso via socket
- Torso entities have:
  - `anatomy:damage_propagation` component with rules per spec section 4.4
  - Sockets for heart and spine
  - Propagation rules defining probability and damage fraction for each internal organ
- Head entity has:
  - `anatomy:damage_propagation` component
  - Socket for brain
  - Propagation rules for brain damage
- Part file and slot library updated to:
  - Define organ slot requirements
  - Wire up socket connections correctly

## Dependencies

- INJREPANDUSEINT-001 (Component Definitions)

## Reference

See `specs/injury-reporting-and-user-interface.md` section 4.4 for damage propagation configuration and section 4.1 for vital organ component specification.

---

## Outcome

### What Was Actually Changed

**Created Files (3):**
- `data/mods/anatomy/entities/definitions/human_heart.entity.json` - Heart entity with 50 maxHealth, vital_organ component
- `data/mods/anatomy/entities/definitions/human_brain.entity.json` - Brain entity with 40 maxHealth, vital_organ component
- `data/mods/anatomy/entities/definitions/human_spine.entity.json` - Spine entity with 60 maxHealth, vital_organ component

**Modified Files (5):**
- `data/mods/anatomy/entities/definitions/human_male_torso.entity.json` - Added `heart_socket`, `spine_socket`, and `anatomy:damage_propagation` component
- `data/mods/anatomy/entities/definitions/human_female_torso.entity.json` - Added `heart_socket`, `spine_socket`, and `anatomy:damage_propagation` component
- `data/mods/anatomy/entities/definitions/humanoid_head.entity.json` - Added `brain_socket` and `anatomy:damage_propagation` component
- `data/mods/anatomy/parts/humanoid_core.part.json` - Added `heart`, `spine`, `brain` slot definitions referencing library
- `data/mods/anatomy/libraries/humanoid.slot-library.json` - Added `standard_heart`, `standard_spine`, `standard_brain` slot definitions

**New Test File:**
- `tests/integration/anatomy/vitalOrganEntities.integration.test.js` - 16 tests validating:
  - Organ entity structure and health values
  - Torso socket and damage propagation configuration
  - Head socket and brain propagation rules
  - Slot library integration
  - Part file integration

### Deviation from Original Plan

1. **Head entities**: Used single `humanoid_head.entity.json` instead of separate male/female head entities (which don't exist in codebase)
2. **Blueprint modification**: Instead of modifying blueprints directly, updated `humanoid_core.part.json` and slot library following the existing composition pattern

### Validation Results

- `npm run validate`: PASSED - 0 cross-reference violations
- New integration tests: 16/16 PASSED
- Existing death check tests: 7/7 PASSED
- Other anatomy validation tests: 25/25 PASSED
