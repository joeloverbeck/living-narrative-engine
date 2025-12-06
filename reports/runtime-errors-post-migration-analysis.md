# Runtime Error Analysis: Post-Migration Failures

**Date**: 2025-10-06
**Log File**: `logs/127.0.0.1-1757518601476.log`
**Context**: Errors after migrating 'intimacy' mod into three separate mods (caressing, affection, kissing) and introducing item-related actions

---

## Executive Summary

**Total Errors Identified**: 12 validation failures across 2 mods
**Severity**: 🔴 **BLOCKING** - Game initialization fails due to schema validation errors
**Impact**: Content loading phase fails, preventing game from starting properly

### Error Breakdown by Mod

| Mod             | Error Count | Error Types                                                    |
| --------------- | ----------- | -------------------------------------------------------------- |
| **positioning** | 2           | Action schema violations                                       |
| **items**       | 10          | Action (2), Condition (1), Rule (3 × 2 validation errors each) |

---

## Category 1: Action Schema Violations - required_components.target Not Supported

### 🔴 Critical Issue: Invalid 'target' Property in required_components (Feature Not Implemented)

**Affected Files**:

- `data/mods/positioning/actions/straddle_waist_facing.action.json` (line 69-76)
- `data/mods/positioning/actions/straddle_waist_facing_away.action.json`

**Error Message**:

```
ActionLoader [positioning]: Primary schema validation failed
Validation errors:
  - /required_components: Unexpected property 'target'
```

**Root Cause Analysis**:

The action schema (`data/schemas/action.schema.json` lines 105-118) defines `required_components` with strict validation that ONLY supports actor requirements:

```json
"required_components": {
  "type": "object",
  "properties": {
    "actor": {
      "type": "array",
      "description": "Components required on actor"
    }
  },
  "additionalProperties": false  // ← This prevents 'target'/'primary'/etc.
}
```

**Current Invalid Code**:

```json
{
  "required_components": {
    "actor": ["positioning:closeness"],
    "target": ["positioning:sitting_on", "positioning:closeness"] // ❌ INVALID
  }
}
```

**Why This Happened**:
The schema supports multi-target actions (via the `targets` property), but `required_components` was intentionally designed to only validate actor requirements. Unlike `forbidden_components` which supports both actor and target validation (schema lines 119-165), `required_components` has **never** supported target role validation.

**Architectural Pattern Discovery**:

- ✅ **`forbidden_components`**: Fully supports `actor`, `target` (legacy), `primary`, `secondary`, `tertiary` (multi-target)
  - **Validator**: `src/actions/validation/TargetComponentValidator.js` handles target validation
  - **Pipeline Stage**: `src/actions/pipeline/stages/TargetComponentValidationStage.js` applies validation
  - **Schema**: Lines 119-165 of `action.schema.json` define multi-target support

- ❌ **`required_components`**: Only supports `actor` property
  - **ActionIndex**: `src/actions/actionIndex.js` only indexes/filters based on `actor` requirements
  - **No Validator**: No equivalent to `TargetComponentValidator` for required components
  - **No Pipeline Stage**: No target-side validation for required components exists

**Impact**:

- 2 new straddling actions cannot load
- Feature completely blocked

---

## Category 2: Action Schema Violations - Multi-Target Format

### 🔴 Critical Issue: Invalid contextFrom Value

**Affected Files**:

- `data/mods/items/actions/drop_item.action.json` (line 478-519)
- `data/mods/items/actions/pick_up_item.action.json` (line 569-609)

**Error Messages**:

```
Validation errors:
  - /targets: Expected type 'string' but got 'object'
  - /targets/primary/contextFrom: Must be one of: primary
  - /targets: must match exactly one schema in oneOf
```

**Root Cause Analysis**:

The action schema (`data/schemas/action.schema.json` lines 25-29) defines:

```json
"contextFrom": {
  "type": "string",
  "enum": ["primary"],  // ← Only "primary" is allowed
  "description": "Use another target as context"
}
```

**Current Invalid Code** (drop_item.action.json):

```json
{
  "targets": {
    "primary": {
      "scope": "items:actor_inventory_items",
      "placeholder": "item",
      "description": "Item to drop",
      "contextFrom": "actor" // ❌ INVALID - "actor" not in enum
    }
  }
}
```

**Why This Happened**:
The `contextFrom` property was designed to reference _other targets_ (like "use primary target as context for secondary"), not entity roles like "actor". The field is being misused.

**Additional Issue - Missing Template**:
`pick_up_item.action.json` is missing the required `template` property entirely.

**Impact**:

- 2 item actions cannot load
- Inventory system non-functional

---

## Category 3: Condition Schema Violations

### 🔴 Critical Issue: Wrong Property Name (jsonLogic vs logic)

**Affected File**:

- `data/mods/items/conditions/secondary-has-portable.condition.json` (line 344-383)

**Error Message**:

```
ConditionLoader [items]: Primary schema validation failed
Validation errors:
  - root: Missing required property 'logic'
  - root: Unexpected property 'jsonLogic'
```

**Root Cause Analysis**:

The condition schema (`data/schemas/condition.schema.json` line 17, 22) requires:

```json
{
  "required": ["id", "description", "logic"], // ← Must be "logic"
  "properties": {
    "logic": {
      /* ... */
    } // ← Not "jsonLogic"
  }
}
```

**Current Invalid Code**:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "items:secondary-has-portable",
  "description": "Checks if the secondary target has portable component",
  "jsonLogic": {
    // ❌ INVALID - Should be "logic"
    "!!": [{ "var": "secondaryTarget.components.items:portable" }]
  }
}
```

**Why This Happened**:
Likely confusion during file creation. The schema standardized on `logic` as the property name, but the file was created with `jsonLogic`.

**Impact**:

- 1 condition fails to load
- May affect item-related prerequisites

---

## Category 4: Missing Operation Schemas

### 🔴 Critical Issue: Operation Handlers Exist But Schemas Missing

**Affected Files**:

- `data/mods/items/rules/handle_drop_item.rule.json` (line 750-812)
- `data/mods/items/rules/handle_give_item.rule.json` (line 859-921)
- `data/mods/items/rules/handle_pick_up_item.rule.json` (line 968-1030)

**Error Messages**:

```
Pre-validation failed for 'handle_drop_item.rule.json':
  Operation at index 1: Unknown operation type "DROP_ITEM_AT_LOCATION"

Pre-validation failed for 'handle_give_item.rule.json':
  Operation at index 0: Unknown operation type "VALIDATE_INVENTORY_CAPACITY"

Pre-validation failed for 'handle_pick_up_item.rule.json':
  Operation at index 0: Unknown operation type "VALIDATE_INVENTORY_CAPACITY"
```

**Root Cause Analysis**:

**Good News**: The operation handlers ARE registered in the code!

From `src/dependencyInjection/registrations/interpreterRegistrations.js` (lines 159-171):

```javascript
registry.register('TRANSFER_ITEM', bind(tokens.TransferItemHandler));
registry.register(
  'VALIDATE_INVENTORY_CAPACITY',
  bind(tokens.ValidateInventoryCapacityHandler)
);
registry.register(
  'DROP_ITEM_AT_LOCATION',
  bind(tokens.DropItemAtLocationHandler)
);
registry.register(
  'PICK_UP_ITEM_FROM_LOCATION',
  bind(tokens.PickUpItemFromLocationHandler)
);
```

**Problem**: The JSON schemas for these operations are missing from `data/schemas/operations/`

**Expected Files** (not found):

- `data/schemas/operations/dropItemAtLocation.schema.json`
- `data/schemas/operations/pickUpItemFromLocation.schema.json`
- `data/schemas/operations/validateInventoryCapacity.schema.json`
- `data/schemas/operations/transferItem.schema.json`

**Why This Happened**:
The operation handlers were implemented in code (`src/logic/operationHandlers/`) but the corresponding schema definitions were never created. The schema validation system requires both:

1. ✅ Runtime handler registration (done)
2. ❌ Schema definition files (missing)

**Impact**:

- 3 item-related rules fail validation
- Core inventory functionality blocked
- Give/drop/pick-up mechanics non-functional

---

## Resolution Pathways

### Path A: Quick Fixes (Low Complexity)

**Priority 1**: Fix simple property name errors

- **Ticket A1**: Rename `jsonLogic` to `logic` in condition file
- **Ticket A2**: Add missing `template` property to `pick_up_item.action.json`
- **Time**: 5 minutes
- **Risk**: Minimal

### Path B: Schema Design Updates (Medium Complexity)

**Priority 2**: Update action schema to support target roles in required_components

**Two Options**:

**Option B1 - Extend Schema to Support Target Required Components** (Recommended):

- Update `action.schema.json` to allow `target` (legacy), `primary`, `secondary`, `tertiary` in `required_components`
- **Pattern Reference**: Match existing `forbidden_components` design in schema lines 119-165
- **Implementation Requirements**:
  1. Schema modification: Update `action.schema.json` lines 105-118
  2. Create new validator: `TargetRequiredComponentsValidator.js` (mirror `TargetComponentValidator.js`)
  3. Create or extend pipeline stage: Similar to `TargetComponentValidationStage.js`
  4. Update `ActionIndex.js` or create new filtering mechanism for target component requirements
  5. Add tests for new validation logic
- Preserves backward compatibility with `actor`-only property
- **Time**: 2-3 hours (not 30 minutes - requires new validator + pipeline integration)
- **Risk**: Medium (affects action discovery pipeline, requires new validation layer)

**Option B2 - Remove Target Validation**:

- Remove `target` from `required_components` in action files
- Rely only on scope filtering for target validation
- **Time**: 10 minutes
- **Risk**: Medium (loses optimization capability)

**Recommendation**: Option B1 - extends schema properly

**Priority 3**: Fix contextFrom usage

**Two Options**:

**Option B3 - Remove contextFrom** (Quick fix):

- Remove `"contextFrom": "actor"` from item actions
- Document that contextFrom is for target-to-target relationships only
- **Time**: 5 minutes
- **Risk**: Minimal (property is optional)

**Option B4 - Extend contextFrom enum**:

- Add "actor" to allowed contextFrom values
- Update multi-target resolution to handle actor context
- **Time**: 2 hours
- **Risk**: Medium (affects core target resolution logic)

**Recommendation**: Option B3 - remove invalid usage for now

### Path C: Create Missing Operation Schemas (High Priority)

**Priority 4**: Create operation schema files

**Required Actions**:

- **Ticket C1**: Create `dropItemAtLocation.schema.json`
- **Ticket C2**: Create `pickUpItemFromLocation.schema.json`
- **Ticket C3**: Create `validateInventoryCapacity.schema.json`
- **Ticket C4**: Create `transferItem.schema.json`

**Schema Template Reference**: Use existing operation schemas as templates (e.g., `data/schemas/operations/modifyComponent.schema.json`)

**Required Parameters** (from handler implementations):

- `DROP_ITEM_AT_LOCATION`: `actorEntity`, `itemEntity`, `locationId`
- `PICK_UP_ITEM_FROM_LOCATION`: `actorEntity`, `itemEntity`, `locationId`
- `VALIDATE_INVENTORY_CAPACITY`: `actorEntity`, `itemEntity`
- `TRANSFER_ITEM`: `fromEntity`, `toEntity`, `itemEntity`

**Time**: 1 hour (all 4 schemas)
**Risk**: Low (templates available)

---

## Recommended Ticket Breakdown

### Sprint 1: Immediate Fixes (Unblock Game Startup)

**🎯 Goal**: Get game loading again

#### Ticket #1: Fix Condition Schema Violation

**Priority**: 🔴 P0 (Blocking)
**Complexity**: ⭐ Trivial
**Files**: 1
**Estimate**: 5 minutes

**Actions**:

- Rename `jsonLogic` → `logic` in `secondary-has-portable.condition.json`
- Test: Run game and verify condition loads

**Acceptance Criteria**:

- Condition loads without validation errors
- Log shows: "ConditionLoader [items]: Loaded X conditions"

---

#### Ticket #2: Add Missing Template to pick_up_item Action

**Priority**: 🔴 P0 (Blocking)
**Complexity**: ⭐ Trivial
**Files**: 1
**Estimate**: 5 minutes

**Actions**:

- Add `"template": "pick up {item}"` to `pick_up_item.action.json`
- Test: Run game and verify action structure

**Acceptance Criteria**:

- Action definition includes template property
- Schema validation passes for this file

---

#### Ticket #3: Remove Invalid contextFrom Properties

**Priority**: 🔴 P0 (Blocking)
**Complexity**: ⭐ Trivial
**Files**: 2
**Estimate**: 10 minutes

**Actions**:

- Remove `"contextFrom": "actor"` from `drop_item.action.json`
- Remove `"contextFrom": "actor"` from `pick_up_item.action.json`
- Document in comments that contextFrom is for inter-target relationships only

**Acceptance Criteria**:

- Both action files validate successfully
- Actions load during content phase
- No `contextFrom` validation errors in logs

---

#### Ticket #4: Create Operation Schema - DROP_ITEM_AT_LOCATION

**Priority**: 🔴 P0 (Blocking)
**Complexity**: ⭐⭐ Simple
**Files**: 1 new
**Estimate**: 15 minutes

**Actions**:

- Create `data/schemas/operations/dropItemAtLocation.schema.json`
- Define parameters: `actorEntity` (string), `itemEntity` (string), `locationId` (string)
- Follow template from `modifyComponent.schema.json`
- Register schema in schema loader

**Acceptance Criteria**:

- Schema file exists and validates
- `handle_drop_item.rule.json` passes pre-validation
- Operation can be used in rules

---

#### Ticket #5: Create Operation Schema - PICK_UP_ITEM_FROM_LOCATION

**Priority**: 🔴 P0 (Blocking)
**Complexity**: ⭐⭐ Simple
**Files**: 1 new
**Estimate**: 15 minutes

**Actions**:

- Create `data/schemas/operations/pickUpItemFromLocation.schema.json`
- Define parameters: `actorEntity` (string), `itemEntity` (string), `locationId` (string)
- Follow same pattern as DROP_ITEM_AT_LOCATION

**Acceptance Criteria**:

- Schema file exists and validates
- `handle_pick_up_item.rule.json` passes pre-validation
- Operation can be used in rules

---

#### Ticket #6: Create Operation Schema - VALIDATE_INVENTORY_CAPACITY

**Priority**: 🔴 P0 (Blocking)
**Complexity**: ⭐⭐ Simple
**Files**: 1 new
**Estimate**: 15 minutes

**Actions**:

- Create `data/schemas/operations/validateInventoryCapacity.schema.json`
- Define parameters: `actorEntity` (string), `itemEntity` (string)
- Include validation result variable parameter

**Acceptance Criteria**:

- Schema file exists and validates
- Both `handle_give_item.rule.json` and `handle_pick_up_item.rule.json` pass validation
- Operation can be used in rules

---

#### Ticket #7: Create Operation Schema - TRANSFER_ITEM

**Priority**: 🟡 P1 (High - for give_item action)
**Complexity**: ⭐⭐ Simple
**Files**: 1 new
**Estimate**: 15 minutes

**Actions**:

- Create `data/schemas/operations/transferItem.schema.json`
- Define parameters: `fromEntity` (string), `toEntity` (string), `itemEntity` (string)

**Acceptance Criteria**:

- Schema file exists and validates
- TRANSFER_ITEM operation recognized by rule pre-validation

---

### Sprint 2: Schema Improvements (Remove Technical Debt)

#### Ticket #8: Implement Target Required Components Validation

**Priority**: 🟡 P1 (High)
**Complexity**: ⭐⭐⭐⭐ High (New Feature Implementation)
**Files**: 1 schema, 1 new validator class, 1 pipeline stage modification, 2 actions, tests
**Estimate**: 2-3 hours

**Actions**:

1. **Schema Update** (`data/schemas/action.schema.json` lines 105-118):

   ```json
   "required_components": {
     "type": "object",
     "properties": {
       "actor": { "type": "array", "items": { "type": "string" } },
       "target": { "type": "array", "items": { "type": "string" }, "description": "Legacy single-target format" },
       "primary": { "type": "array", "items": { "type": "string" } },
       "secondary": { "type": "array", "items": { "type": "string" } },
       "tertiary": { "type": "array", "items": { "type": "string" } }
     },
     "additionalProperties": false
   }
   ```

2. **Create New Validator**: `src/actions/validation/TargetRequiredComponentsValidator.js`
   - Mirror structure of `TargetComponentValidator.js` (lines 18-222)
   - Implement `validateTargetRequirements(actionDef, targetEntities)` method
   - Support both legacy single-target and multi-target formats
   - Return `{valid: boolean, reason?: string}` for consistent error handling

3. **Pipeline Integration**: Extend `src/actions/pipeline/stages/TargetComponentValidationStage.js`
   - Add required components validation alongside forbidden components
   - Or create new `TargetRequiredComponentsStage.js` if separation is preferred

4. **ActionIndex Enhancement**: `src/actions/actionIndex.js`
   - Option A: Pre-filter at index build time (complex, affects performance optimization)
   - Option B: Add post-filter validation in pipeline (simpler, consistent with current architecture)
   - **Recommended**: Option B for consistency with forbidden_components pattern

5. **Update Action Files**:
   - `data/mods/positioning/actions/straddle_waist_facing.action.json`
   - `data/mods/positioning/actions/straddle_waist_facing_away.action.json`
   - Change `"target"` to `"primary"` in `required_components`

6. **Testing**:
   - Unit tests for `TargetRequiredComponentsValidator`
   - Integration tests for pipeline stage
   - Edge cases: empty arrays, missing entities, mixed legacy/multi-target

**Acceptance Criteria**:

- Schema allows both actor and target role properties
- New validator class correctly validates target requirements
- Pipeline stage filters actions based on target components
- Straddling actions validate successfully
- Backward compatibility maintained for actor-only actions
- All tests pass with 80%+ coverage
- Documentation updated

**Implementation Reference**:

- **Pattern**: `src/actions/validation/TargetComponentValidator.js` (forbidden components)
- **Schema Pattern**: Lines 119-165 of `action.schema.json` (forbidden_components multi-target support)
- **Pipeline Pattern**: `src/actions/pipeline/stages/TargetComponentValidationStage.js`
- **Index Pattern**: `src/actions/actionIndex.js` (lines 106-122 for forbidden components)

**Technical Notes**:

- This is a NEW FEATURE, not just a schema fix
- Match pattern from `forbidden_components` which already supports target validation
- Consider whether to pre-filter (ActionIndex) or post-filter (pipeline stage)
- Deprecate "target" terminology in favor of "primary" for consistency with multi-target pattern

---

#### Ticket #9: Integration Testing - Item System

**Priority**: 🟡 P1 (High)
**Complexity**: ⭐⭐⭐ Medium
**Files**: Test suite
**Estimate**: 1 hour

**Actions**:

- Create integration tests for drop/pick-up/give item workflows
- Test operation handler execution
- Verify perception logging
- Test inventory capacity validation

**Acceptance Criteria**:

- All item operations execute successfully in integration tests
- Inventory state updates correctly
- Perception events dispatched properly
- Edge cases handled (full inventory, invalid items, etc.)

---

## Dependency Graph

```
Ticket #1 ────┐
Ticket #2 ────┤
Ticket #3 ────┼──► Game Starts ──► Ticket #9 (Integration Tests)
Ticket #4 ────┤
Ticket #5 ────┤
Ticket #6 ────┤
Ticket #7 ────┘

Ticket #8 ────► Schema Improvement (Independent)
```

**Critical Path**: Tickets #1-7 must complete before game can start
**Parallel Work**: Ticket #8 can be done independently

---

## Risk Assessment

### Low Risk ✅

- Tickets #1, #2, #3: Simple property fixes
- Tickets #4-7: Following established schema patterns

### Medium Risk ⚠️

- Ticket #8: Schema changes affect validation system
- Ticket #9: May reveal additional integration issues

### Mitigation Strategies

1. **Backup**: Commit before schema changes
2. **Incremental Testing**: Test each ticket completion
3. **Validation**: Run full test suite after Sprint 1
4. **Rollback Plan**: Keep schema versions documented

---

## Testing Strategy

### Unit Tests Required

- None (schema changes don't require unit tests)

### Integration Tests Required

- Ticket #9: Item system workflow tests

### Manual Testing Checklist

- [ ] Game loads without validation errors
- [ ] Straddling actions appear in action list
- [ ] Item actions (drop/pick-up/give) work correctly
- [ ] Inventory state updates properly
- [ ] Perception logs show item actions
- [ ] No regression in existing positioning actions

---

## Success Metrics

### Sprint 1 Complete When:

- ✅ 0 schema validation errors in logs
- ✅ All 12 identified errors resolved
- ✅ Game initialization completes successfully
- ✅ Item mod loads all content
- ✅ Positioning mod loads all content

### Sprint 2 Complete When:

- ✅ Schema supports target role validation
- ✅ Integration tests pass at 100%
- ✅ Documentation updated
- ✅ Technical debt removed

---

## Notes for Implementation

### Schema File Locations

- **Operation Schemas**: `data/schemas/operations/*.schema.json`
- **Action Schema**: `data/schemas/action.schema.json`
- **Condition Schema**: `data/schemas/condition.schema.json`

### Reference Files for Templates

- **Operation Schema Template**: `data/schemas/operations/modifyComponent.schema.json`
- **Multi-Target Action Example**: Any action in `data/mods/*/actions/` using `targets` object
- **Condition Example**: `data/mods/core/conditions/`

### Validation Commands

```bash
# Run game and check console for validation errors
npm run start

# Check specific log file for errors
grep -E "ERROR|Error|failed|Failed" logs/127.0.0.1-*.log

# Validate all schemas (if schema validation script exists)
npm run validate:schemas
```

---

## Conclusion

**Current State**: Game initialization blocked by 12 schema validation failures
**Root Cause**: Incomplete schema definitions for new item system + schema limitations for multi-target actions
**Resolution Time**: ~2 hours for Sprint 1 (critical path)
**Follow-up**: ~2 hours for Sprint 2 (quality improvements)

**Immediate Action**: Start with Tickets #1-3 (30 minutes total) to remove simple errors, then proceed to operation schema creation (Tickets #4-7, 1 hour total).

**Long-term**: Consider implementing a schema validation CI/CD step to catch these issues before runtime.

---

## Architecture Clarification Note (Added 2025-10-06)

**Key Discovery**: This analysis originally assumed that `required_components` for targets was simply not updated for multi-target actions. **This assumption was incorrect.**

**Actual Architecture**:

- ✅ **`forbidden_components`**: Fully implemented for both actor AND target validation
  - Supports legacy `target` and multi-target `primary`/`secondary`/`tertiary` roles
  - Has dedicated validator: `TargetComponentValidator.js`
  - Integrated into pipeline: `TargetComponentValidationStage.js`

- ❌ **`required_components`**: Only supports `actor` validation (by design)
  - Has NO target-side validation support
  - ActionIndex only filters on actor requirements
  - No equivalent to `TargetComponentValidator` exists

**Implication for Ticket #8**: This is not a simple schema extension. Implementing `required_components` for targets requires:

1. New validator class (~200 lines, mirroring `TargetComponentValidator.js`)
2. Pipeline stage integration (new stage or extend existing)
3. Schema modifications
4. Comprehensive testing
5. Estimated time: 2-3 hours (not 45 minutes)
