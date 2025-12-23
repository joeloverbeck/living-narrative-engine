# OXYDROSYS-006: Create human lung entities

## Description

Define left and right human lung entity definitions with the respiratory_organ component.

## Files to Create

- `data/mods/breathing/entities/definitions/human_lung_left.entity.json`
- `data/mods/breathing/entities/definitions/human_lung_right.entity.json`

## Files to Modify

- `data/mods/breathing/mod-manifest.json` - Add entities to `content.entities.definitions` array

## Out of Scope

- Integration with humanoid blueprint (separate ticket)
- Recipe modifications
- Other creature lungs

## Acceptance Criteria

1. **Schema valid**: Entities pass entity-definition.schema.json validation
2. **Components present**: `core:name`, `core:weight`, `anatomy:part`, `anatomy:part_health`, `breathing:respiratory_organ`
3. **Part properties**: `subType: "lung"`, `orientation: "left"/"right"`, `hit_probability_weight: 0`
4. **Oxygen values**: `oxygenCapacity: 10`, `currentOxygen: 10`, `respirationType: "pulmonary"`
5. **Health**: `maxHealth: 30`, `currentHealth: 30`

## Tests That Must Pass

- `npm run validate` - Schema validation
- Unit test: Entity definitions are valid

## Invariants

- Entity IDs: `breathing:human_lung_left`, `breathing:human_lung_right`
- `hit_probability_weight: 0` (protected organs, not directly targetable)
- Follows vital organ protection pattern from heart/brain/spine
