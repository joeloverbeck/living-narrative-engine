# SEACONINT-006: Update Stool Entity Instances with near_furniture Component

**Status**: COMPLETED
**Priority**: MEDIUM
**Estimated Effort**: 30 minutes
**Actual Effort**: 15 minutes
**Dependencies**: SEACONINT-001
**Blocks**: SEACONINT-009
**Completed Date**: 2025-12-09

## Outcome

### What Was Changed vs Originally Planned

**✅ Exactly as planned:**
- Added `furniture:near_furniture` component to all 4 stool entity instances
- Each stool now references `fantasy:aldous_kitchen_rustic_wooden_table_instance`
- All existing components and properties preserved unchanged

**Files Modified:**
1. `data/mods/fantasy/entities/instances/plain_wooden_stool_1.entity.json`
2. `data/mods/fantasy/entities/instances/plain_wooden_stool_2.entity.json`
3. `data/mods/fantasy/entities/instances/plain_wooden_stool_3.entity.json`
4. `data/mods/fantasy/entities/instances/plain_wooden_stool_4.entity.json`

**Verification Results:**
- ✅ `npm run validate` passed - 0 cross-reference violations across 55 mods
- ✅ Entity instance schema validation passed
- ✅ Component data validates against `furniture:near_furniture` schema
- ✅ Referenced table instance ID exists
- ✅ Furniture mod integration tests pass (4/4)
- ✅ Entity loading tests pass (5/5)

**No Discrepancies Found:**
The ticket assumptions were 100% accurate. All entity files existed exactly as documented and the component schema matched expectations.

---

## Objective

Add the `furniture:near_furniture` component to the plain wooden stool entity instances in the fantasy mod, linking them to the kitchen table.

## Files To Create

None.

## Files To Modify

| File | Change |
|------|--------|
| `data/mods/fantasy/entities/instances/plain_wooden_stool_1.entity.json` | Add `furniture:near_furniture` component |
| `data/mods/fantasy/entities/instances/plain_wooden_stool_2.entity.json` | Add `furniture:near_furniture` component |
| `data/mods/fantasy/entities/instances/plain_wooden_stool_3.entity.json` | Add `furniture:near_furniture` component |
| `data/mods/fantasy/entities/instances/plain_wooden_stool_4.entity.json` | Add `furniture:near_furniture` component |

## Out of Scope

- **DO NOT** modify the base `plain_wooden_stool` entity definition
- **DO NOT** modify the kitchen table entity instance
- **DO NOT** create any new entity instances
- **DO NOT** modify the fantasy mod manifest
- **DO NOT** modify any other mod's entities

## Implementation Details

### Current Structure (Example: plain_wooden_stool_1)

```json
{
    "$schema": "http://example.com/schemas/entity-instance.schema.json",
    "instanceId": "fantasy:plain_wooden_stool_1_instance",
    "definitionId": "furniture:plain_wooden_stool",
    "componentOverrides": {
        "core:name": {
            "text": "plain wooden stool #1"
        },
        "core:position": {
            "locationId": "fantasy:aldous_kitchen_instance"
        }
    }
}
```

### Updated Structure (Add furniture:near_furniture)

```json
{
    "$schema": "http://example.com/schemas/entity-instance.schema.json",
    "instanceId": "fantasy:plain_wooden_stool_1_instance",
    "definitionId": "furniture:plain_wooden_stool",
    "componentOverrides": {
        "core:name": {
            "text": "plain wooden stool #1"
        },
        "core:position": {
            "locationId": "fantasy:aldous_kitchen_instance"
        },
        "furniture:near_furniture": {
            "nearFurnitureIds": ["fantasy:aldous_kitchen_rustic_wooden_table_instance"]
        }
    }
}
```

### Changes for Each File

| File | Instance ID | nearFurnitureIds |
|------|-------------|------------------|
| `plain_wooden_stool_1.entity.json` | `fantasy:plain_wooden_stool_1_instance` | `["fantasy:aldous_kitchen_rustic_wooden_table_instance"]` |
| `plain_wooden_stool_2.entity.json` | `fantasy:plain_wooden_stool_2_instance` | `["fantasy:aldous_kitchen_rustic_wooden_table_instance"]` |
| `plain_wooden_stool_3.entity.json` | `fantasy:plain_wooden_stool_3_instance` | `["fantasy:aldous_kitchen_rustic_wooden_table_instance"]` |
| `plain_wooden_stool_4.entity.json` | `fantasy:plain_wooden_stool_4_instance` | `["fantasy:aldous_kitchen_rustic_wooden_table_instance"]` |

## Design Notes

- All four stools are in the same kitchen and should be able to interact with the same table
- The table instance ID must match exactly: `fantasy:aldous_kitchen_rustic_wooden_table_instance`
- This is instance-level configuration - the base stool definition doesn't know about proximity

## Acceptance Criteria

### Tests That Must Pass

1. ✅ `npm run validate` passes for all modified entity files
2. ✅ Entity instance schema validation passes
3. ✅ The `furniture:near_furniture` component data validates against its schema
4. ✅ The referenced table instance ID exists: `fantasy:aldous_kitchen_rustic_wooden_table_instance`

### Invariants That Must Remain True

1. ✅ Entity instance IDs remain unchanged
2. ✅ Entity definition IDs remain unchanged
3. ✅ Entity positions remain unchanged
4. ✅ All existing entity components remain unchanged
5. ✅ The fantasy mod continues to load without errors

## Verification Commands

```bash
# Validate all JSON files
npm run validate

# Ensure no regressions
npm run test:ci
```

## Related Files (For Reference)

- `data/mods/fantasy/entities/instances/aldous_kitchen_rustic_wooden_table.entity.json` - The table being referenced
- `data/mods/furniture/entities/definitions/plain_wooden_stool.entity.json` - The stool definition
- `data/mods/furniture/components/near_furniture.component.json` - The component schema (from SEACONINT-001)
