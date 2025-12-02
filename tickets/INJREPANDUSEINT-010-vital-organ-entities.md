# INJREPANDUSEINT-010: Vital Organ Entity Definitions

## Description

Create entity definitions for vital organs and update torso/head entities with damage propagation.

## File List

| File | Action |
|------|--------|
| `data/mods/anatomy/entities/definitions/human_heart.entity.json` | CREATE |
| `data/mods/anatomy/entities/definitions/human_brain.entity.json` | CREATE |
| `data/mods/anatomy/entities/definitions/human_spine.entity.json` | CREATE |
| `data/mods/anatomy/entities/definitions/human_male_torso.entity.json` | MODIFY - add damage_propagation, sockets |
| `data/mods/anatomy/entities/definitions/human_female_torso.entity.json` | MODIFY - add damage_propagation, sockets |
| `data/mods/anatomy/entities/definitions/human_male_head.entity.json` | MODIFY - add damage_propagation, brain socket |
| `data/mods/anatomy/entities/definitions/human_female_head.entity.json` | MODIFY - add damage_propagation, brain socket |
| `data/mods/anatomy/blueprints/*.blueprint.json` | MODIFY as needed to include organs |

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
- Head entities have:
  - `anatomy:damage_propagation` component
  - Socket for brain
  - Propagation rules for brain damage
- Blueprints updated to:
  - Instantiate organs inside appropriate parent parts
  - Wire up socket connections correctly

## Dependencies

- INJREPANDUSEINT-001 (Component Definitions)

## Reference

See `specs/injury-reporting-and-user-interface.md` section 4.4 for damage propagation configuration and section 4.1 for vital organ component specification.
