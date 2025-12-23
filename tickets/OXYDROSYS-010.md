# OXYDROSYS-010: Create reptilian and eldritch respiratory entities

## Description

Create respiratory entities for dragons (reptilian) and eldritch creatures.

## Files to Create

- `data/mods/breathing/entities/definitions/reptilian_lung_left.entity.json`
- `data/mods/breathing/entities/definitions/reptilian_lung_right.entity.json`
- `data/mods/breathing/entities/definitions/eldritch_respiratory_mass.entity.json`

## Files to Modify

- `data/mods/breathing/mod-manifest.json` - Add entities
- Red dragon blueprint and recipe files
- Writhing observer blueprint and recipe files

## Out of Scope

- Fire-breathing dragon mechanics
- Eldritch special abilities

## Acceptance Criteria

1. **Reptilian lungs**: Larger capacity for dragons, `respirationType: "pulmonary"`
2. **Eldritch respiratory**: `respirationType: "unusual"`, `environmentCompatibility: ["any"]`
3. **Blueprints updated**: Dragon and writhing observer include respiratory organs
4. **Entity names**: Appropriate for creature type ("respiratory mass" for eldritch)

## Tests That Must Pass

- `npm run validate` - Schema validation
- Integration test: Dragon and eldritch entities have respiratory organs

## Invariants

- Dragons have higher oxygen capacity (larger creatures)
- Eldritch creatures have "unusual" respiration type
