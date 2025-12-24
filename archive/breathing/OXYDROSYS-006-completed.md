# OXYDROSYS-006: Create human lung entities

**Status**: ✅ COMPLETED

## Description

Define left and right human lung entity definitions with the respiratory_organ component.

## Files Created

- `data/mods/breathing/entities/definitions/human_lung_left.entity.json`
- `data/mods/breathing/entities/definitions/human_lung_right.entity.json`

## Files Modified

- `data/mods/breathing/mod-manifest.json` - Added entities to `content.entities.definitions` array

## Out of Scope

- Integration with humanoid blueprint (separate ticket)
- Recipe modifications
- Other creature lungs

## Acceptance Criteria

1. **Schema valid**: Entities pass entity-definition.schema.json validation ✅
2. **Components present**: `core:name`, `core:weight`, `anatomy:part`, `anatomy:part_health`, `breathing:respiratory_organ` ✅
3. **Part properties**: `subType: "lung"`, `orientation: "left"/"right"`, `hit_probability_weight: 0` ✅
4. **Oxygen values**: `oxygenCapacity: 10`, `currentOxygen: 10`, `respirationType: "pulmonary"` ✅
5. **Health**: `maxHealth: 30`, `currentHealth: 30` ✅

## Tests Created

- `tests/unit/mods/breathing/entities/humanLungEntities.test.js` - 36 tests covering all acceptance criteria

## Invariants

- Entity IDs: `breathing:human_lung_left`, `breathing:human_lung_right`
- `hit_probability_weight: 0` (protected organs, not directly targetable)
- Follows vital organ protection pattern from heart/brain/spine

## Implementation Notes

**Property Name Corrections**: The brainstorming document example used incorrect property names:
- `core:name` uses `{ "text": "..." }` (not `{ "name": "..." }`)
- `core:weight` uses `{ "weight": ... }` (not `{ "value": ... }`)

These were corrected during implementation to match the actual component schemas.

## Outcome

### What Was Changed vs Originally Planned

**Planned**: Create two lung entity files following brainstorming document examples.

**Actual Changes**:
1. Created `human_lung_left.entity.json` and `human_lung_right.entity.json` with corrected property names
2. Updated `mod-manifest.json` to register the new entities
3. Created comprehensive test suite with 36 tests validating all components and schema compliance
4. Documented property name discrepancy in ticket for future reference

**Deviation from Plan**: The brainstorming document's example entity used incorrect property names (`name` instead of `text` for `core:name`, `value` instead of `weight` for `core:weight`). These were corrected in the implementation based on actual component schema inspection.

**Validation Results**:
- `npm run validate`: 0 violations across 91 mods
- Unit tests: 36 passed, 0 failed
