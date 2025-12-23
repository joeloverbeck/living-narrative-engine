# OXYDROSYS-009: Create amphibian respiratory entities

## Description

Create amphibian-specific respiratory entities including both lungs and cutaneous (skin) respiration.

## Files to Create

- `data/mods/breathing/entities/definitions/amphibian_lung.entity.json`
- `data/mods/breathing/entities/definitions/amphibian_skin_respiration.entity.json`

## Files to Modify

- `data/mods/breathing/mod-manifest.json` - Add entities
- Toad folk blueprint and recipe files

## Out of Scope

- Dual-environment breathing logic (can breathe in water via skin)
- Other creature types

## Acceptance Criteria

1. **Lung entity**: Standard pulmonary with `environmentCompatibility: ["air"]`
2. **Skin respiration entity**: `respirationType: "cutaneous"`, `environmentCompatibility: ["air", "water"]`
3. **Toad folk updated**: Blueprint and recipe include both respiratory organs
4. **Unique behavior**: Amphibians have backup water-breathing capability

## Tests That Must Pass

- `npm run validate` - Schema validation
- Integration test: Toad folk entity has both respiratory organs

## Invariants

- Amphibian lung capacity may differ from human (species-appropriate)
- Cutaneous respiration provides redundancy, not replacement
