# Remove Clothing Action Multi-Target Migration Status Specification

## Document Information

- **Specification ID**: `remove-clothing-multi-target-migration-status`
- **Version**: 2.0.0
- **Date**: 2025-08-06
- **Target**: `data/mods/clothing/actions/remove_clothing.action.json`
- **Dependencies**: `data/mods/clothing/rules/handle_remove_clothing.rule.json`, related test suites
- **Status**: **MIGRATION NOT YET PERFORMED** - Legacy format still in use

## Executive Summary

This specification documents the current status of the `clothing:remove_clothing` action, which **remains in the legacy single-target format** using the deprecated `scope` property. The action has **NOT YET** been migrated to the new multi-target format using the `targets` property. This document serves as a reference for the current implementation state and outlines the migration requirements when the migration is eventually performed.

## Current State Analysis

### Current Action Structure (Legacy Format)

**File**: `data/mods/clothing/actions/remove_clothing.action.json`

**ACTUAL CONTENT** (as of production code analysis):

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "clothing:remove_clothing",
  "name": "Remove Clothing",
  "description": "Remove a piece of your topmost clothing",
  "scope": "clothing:topmost_clothing",
  "required_components": {
    "actor": ["clothing:equipment"]
  },
  "template": "remove {target}",
  "prerequisites": []
}
```

**Analysis**: This action currently uses the **legacy `scope` property** format and has not been migrated to the new `targets` property format. According to the schema, this format is deprecated but still supported for backward compatibility.

### Associated Rule Structure

**File**: `data/mods/clothing/rules/handle_remove_clothing.rule.json`

**CURRENT IMPLEMENTATION**: The rule processes `core:attempt_action` events where `actionId` matches `clothing:remove_clothing` and handles:

- Name extraction for actor and target using `GET_NAME` operations
- Position queries for location context using `QUERY_COMPONENT` operation
- `UNEQUIP_CLOTHING` operation execution with parameters:
  - `entity_ref`: "actor"
  - `clothing_item_id`: "{event.payload.targetId}"
  - `cascade_unequip`: false
  - `destination`: "ground"
- Variable setup for logging (logMessage, perceptionType, locationId, targetId)
- Perception event generation via `core:logSuccessAndEndTurn` macro

**Rule Dependencies**:

- Expects `event.payload.targetId` (target clothing item)
- Expects `event.payload.actorId` (actor performing action)
- Uses standard action event structure - **compatible with both legacy and new formats**
- Rule requires **no changes** for migration as it operates on the event payload structure which remains identical

### Scope Definition

**File**: `data/mods/clothing/scopes/topmost_clothing.scope`

**CURRENT CONTENT**:

```
// Returns all topmost clothing items worn by the actor
// Items are prioritized by layer: outer > base > underwear
clothing:topmost_clothing := actor.topmost_clothing[]
```

**Status**: The scope definition is correctly implemented and will continue to work with both legacy and migrated action formats. No changes needed for the scope itself during migration.

### Test Coverage Analysis

**Affected Test Files**:

1. **`tests/integration/clothing/unequipClothingAction.test.js`**
   - Direct integration tests for remove clothing workflow
   - Tests action discovery, execution, and state changes
   - Filters actions by `action.id === 'clothing:remove_clothing'`
   - Tests various scenarios: basic removal, layered clothing, cascade unequip

2. **`tests/integration/actionCategorization/completeWorkflow.test.js`**
   - Tests action categorization for LLM prompts
   - References `actionId: 'clothing:remove_clothing'` in expected results
   - Validates command string generation and description formatting

## Migration Status and Requirements

### Current Migration Status

**STATUS**: **NOT MIGRATED** - The `clothing:remove_clothing` action remains in the legacy format using the deprecated `scope` property.

**Evidence from Production Code Analysis**:

- Action file still contains `"scope": "clothing:topmost_clothing"`
- No `targets` property present in the action definition
- Other actions in the codebase show mixed migration status:
  - `core:go` - **MIGRATED** to full multi-target format with `targets.primary`
  - `core:follow` - **MIGRATED** to simplified multi-target format with `targets` string
  - `core:wait` - **MIGRATED** to simplified format with `targets: "none"`
  - `clothing:remove_clothing` - **NOT MIGRATED** still uses `scope` property

### Schema Compatibility Analysis

Based on the current `action.schema.json`, the system supports three formats:

1. **Legacy Format** (deprecated but supported):

   ```json
   { "scope": "clothing:topmost_clothing" }
   ```

2. **Simplified Multi-Target Format**:

   ```json
   { "targets": "clothing:topmost_clothing" }
   ```

3. **Full Multi-Target Format**:
   ```json
   {
     "targets": {
       "primary": {
         "scope": "clothing:topmost_clothing",
         "placeholder": "target",
         "description": "Clothing item to remove"
       }
     }
   }
   ```

## Future Migration Requirements (When Migration is Performed)

### Functional Requirements

1. **Behavioral Preservation**: Action must function identically after migration
2. **Schema Compliance**: Must validate against updated action.schema.json
3. **Rule Compatibility**: Existing rule must continue to work without modification
4. **Test Compatibility**: All existing tests must pass with minimal updates
5. **Scope Integration**: Must continue using `clothing:topmost_clothing` scope

### Technical Requirements

1. **Multi-Target Format**: Convert to new `targets` property structure
2. **Placeholder Consistency**: Maintain `{target}` placeholder in template
3. **Component Requirements**: Preserve `required_components` configuration
4. **Prerequisites**: Maintain empty prerequisites array (no changes needed)
5. **Backward Compatibility**: Support during transition period

### Performance Requirements

1. **Zero Performance Regression**: No impact on action discovery or execution
2. **Memory Efficiency**: No additional memory overhead
3. **Schema Validation**: Must pass all existing schema validation checks

## Migration Implementation Guide (For Future Use)

### Migration Options Available

Based on analysis of other migrated actions in the codebase, there are two viable migration paths:

#### Option 1: Simplified String Format (Like `core:follow`)

**Current (Legacy)**:

```json
{
  "scope": "clothing:topmost_clothing",
  "template": "remove {target}"
}
```

**Target (Simplified)**:

```json
{
  "targets": "clothing:topmost_clothing",
  "template": "remove {target}"
}
```

#### Option 2: Full Multi-Target Format (Like `core:go`)

**Current (Legacy)**:

```json
{
  "scope": "clothing:topmost_clothing",
  "template": "remove {target}"
}
```

**Target (Full Multi-Target)**:

```json
{
  "targets": {
    "primary": {
      "scope": "clothing:topmost_clothing",
      "placeholder": "target",
      "description": "Clothing item to remove"
    }
  },
  "template": "remove {target}"
}
```

### Recommended Migration: Simplified Format

**Complete Migrated Action** (Recommended):

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "clothing:remove_clothing",
  "name": "Remove Clothing",
  "description": "Remove a piece of your topmost clothing",
  "targets": "clothing:topmost_clothing",
  "required_components": {
    "actor": ["clothing:equipment"]
  },
  "template": "remove {target}",
  "prerequisites": []
}
```

**Rationale**: The simplified format is sufficient since this is a single-target action that doesn't require the complexity of the full multi-target structure. This approach is consistent with `core:follow` which has similar single-target behavior.

### Step 3: Schema Validation

**Validation Points**:

1. **Schema Compliance**: Must validate against `action.schema.json`
2. **ID Format**: Ensure proper namespaced ID `clothing:remove_clothing`
3. **Target Definition**: Primary target must have valid scope, placeholder, description
4. **Template Consistency**: Placeholder `{target}` matches `targets.primary.placeholder`
5. **Required Properties**: All required schema properties must be present

**Validation Command**:

```bash
npm run scope:lint  # Validates scope definitions and action schemas
```

## Rule Compatibility Analysis

### No Changes Required

The existing rule `handle_remove_clothing.rule.json` requires **no modifications** because:

1. **Event Structure**: Rule processes `core:attempt_action` events with standard payload
2. **Target Access**: Uses `event.payload.targetId` - this remains identical
3. **Actor Access**: Uses `event.payload.actorId` - this remains identical
4. **Operation Parameters**: `UNEQUIP_CLOTHING` operation parameters unchanged
5. **Variable Resolution**: Context variable patterns remain consistent

### Verification Strategy

1. **Event Payload Consistency**: Verify action discovery generates identical event payloads
2. **Variable Resolution**: Confirm `{event.payload.targetId}` resolves correctly
3. **Operation Execution**: Validate `UNEQUIP_CLOTHING` operation receives expected parameters
4. **Logging Output**: Ensure perception messages generate correctly

## Test Compatibility Analysis

### Current Test Status

Based on analysis of existing test files, the current tests are designed to work with the action system regardless of whether actions use legacy or new formats:

#### 1. `tests/integration/clothing/unequipClothingAction.test.js`

**Current Test Design**: Tests operate at the integration level and are **format-agnostic**

**Key Findings**:

- Tests filter actions by `action.id === 'clothing:remove_clothing'` - **works with any format**
- Tests verify action discovery returns proper `targetId` properties - **format independent**
- Tests validate event emission with expected payload structure - **unchanged by format**
- Tests confirm rule execution produces expected results - **rule is format-agnostic**
- All test scenarios currently pass with legacy format

**Test Scenarios (Currently Passing)**:

- ✅ `should generate remove clothing actions for equipped items`
- ✅ `should successfully remove clothing and place it on ground`
- ✅ `should place item in inventory when actor has inventory component`
- ✅ `should only show topmost clothing items as removable`
- ✅ `should handle cascade unequip correctly`
- ✅ `should fail gracefully when trying to remove non-equipped item`

#### 2. `tests/integration/actionCategorization/completeWorkflow.test.js`

**Current Test Design**: Action categorization service is **format-neutral**

**Key Findings**:

- Tests reference `actionId: 'clothing:remove_clothing'` in expected results - **format independent**
- Command string generation works with both formats - **template unchanged**
- Description formatting remains consistent - **no format dependency**
- LLM prompt categorization works with any valid action format
- Test includes example action with expected structure that matches current behavior

**Current Test Expectation** (Line 124-128):

```javascript
{
  index: 5,
  actionId: 'clothing:remove_clothing',
  commandString: 'remove shirt',
  description: 'Remove your shirt.',
  params: {},
}
```

### Test Migration Impact Assessment

**CONCLUSION**: **No test changes required** for migration. All tests are designed to work at the integration level and are agnostic to the internal action definition format. Both legacy and new formats produce identical runtime behavior, which is what the tests validate.

### Test Execution Strategy

```bash
# Run specific clothing action tests
npm test -- tests/integration/clothing/unequipClothingAction.test.js

# Run action categorization tests
npm test -- tests/integration/actionCategorization/completeWorkflow.test.js

# Run full integration test suite
npm run test:integration

# Validate schema compliance
npm run scope:lint
```

## Risk Assessment

### Low Risk Factors

1. **Schema Compatibility**: New format is fully supported by existing systems
2. **Rule Compatibility**: No rule changes required - event structure identical
3. **Template Consistency**: Same `{target}` placeholder maintained
4. **Scope Reuse**: Same `clothing:topmost_clothing` scope definition

### Medium Risk Factors

1. **Test Sensitivity**: Tests may have expectations about action structure internals
2. **Discovery Changes**: Action discovery service must handle new target format
3. **Validation Timing**: Schema validation may catch edge cases during migration

### Mitigation Strategies

1. **Incremental Testing**: Test after each migration step
2. **Rollback Plan**: Keep backup of original action definition
3. **Comprehensive Validation**: Run full test suite before deployment
4. **Schema Verification**: Validate against schema before committing changes

## Implementation Steps

### Phase 1: Preparation

1. **Backup Current State**: Create backup of existing action file
2. **Environment Setup**: Ensure development environment is clean
3. **Baseline Testing**: Run all tests to establish working baseline

### Phase 2: Migration

1. **Update Action Definition**: Apply new multi-target format
2. **Schema Validation**: Verify against action.schema.json
3. **Syntax Validation**: Run linting and scope validation

### Phase 3: Verification

1. **Unit Test Execution**: Run clothing-specific tests
2. **Integration Test Execution**: Run full integration test suite
3. **Behavior Verification**: Confirm identical action behavior
4. **Rule Testing**: Verify rule execution remains unchanged

### Phase 4: Validation

1. **Full Test Suite**: Execute complete test suite
2. **Performance Testing**: Verify no performance regression
3. **Schema Compliance**: Final schema validation check
4. **Documentation Update**: Update any references if needed

## Success Criteria

### Functional Success

- [ ] All existing tests pass without modification
- [ ] Action discovery returns identical results
- [ ] Rule execution produces same outcomes
- [ ] Event payloads remain unchanged
- [ ] Clothing removal behavior preserved

### Technical Success

- [ ] Schema validation passes
- [ ] No linting errors
- [ ] No performance regression
- [ ] Memory usage unchanged
- [ ] Code style compliance

### Quality Success

- [ ] Full test coverage maintained
- [ ] No new warnings or errors
- [ ] Documentation accuracy preserved
- [ ] Development workflow unimpacted

## Rollback Procedure

If migration causes issues:

1. **Immediate Rollback**: Replace migrated action with backed-up original
2. **Test Verification**: Run test suite to confirm rollback success
3. **Issue Analysis**: Analyze root cause of migration failure
4. **Corrective Planning**: Develop corrected migration approach

```bash
# Rollback command example
cp data/mods/clothing/actions/remove_clothing.action.json.backup \
   data/mods/clothing/actions/remove_clothing.action.json

# Verify rollback
npm run test:integration
```

## Current Status Summary

### Immediate Status

- Action definition **remains in legacy format**
- All tests **currently pass** with legacy format
- Schema validation **succeeds** (legacy format still supported)
- Functional behavior **works correctly** as implemented

### Future Migration Benefits

When migration is eventually performed:

- Consistency with modernized action system
- Support for future multi-target enhancements
- Improved maintainability and readability
- Alignment with project architecture standards

### Production Code Reality Check

**IMPORTANT**: This specification now accurately reflects the current state of production code. The `clothing:remove_clothing` action has **NOT** been migrated and continues to use the deprecated `scope` property. Any development work should account for this current state.

## Appendix

### Reference Files

- `data/schemas/action.schema.json` - Multi-target action schema definition (supports both formats)
- `data/mods/core/actions/go.action.json` - Example fully migrated action (full multi-target format)
- `data/mods/core/actions/follow.action.json` - Example simply migrated action (string format)
- `data/mods/core/actions/wait.action.json` - Example migrated action (targets: "none")
- `data/mods/clothing/actions/remove_clothing.action.json` - **NOT MIGRATED** (still uses scope)
- `tests/integration/clothing/unequipClothingAction.test.js` - Primary test file (format-agnostic)
- `tests/integration/actionCategorization/completeWorkflow.test.js` - Secondary test file (format-agnostic)

### Migration Pattern Examples from Production Code

**Successful Migration Examples**:

1. **Simple Migration Pattern** (`core:follow`):

   ```json
   {
     "id": "core:follow",
     "targets": "core:potential_leaders",
     "template": "follow {target}"
   }
   ```

2. **Full Migration Pattern** (`core:go`):

   ```json
   {
     "id": "core:go",
     "targets": {
       "primary": {
         "scope": "core:clear_directions",
         "placeholder": "destination",
         "description": "Location to move to"
       }
     },
     "template": "go to {destination}"
   }
   ```

3. **None Target Pattern** (`core:wait`):
   ```json
   {
     "id": "core:wait",
     "targets": "none",
     "template": "wait"
   }
   ```

**Current Legacy Pattern** (`clothing:remove_clothing`):

```json
{
  "id": "clothing:remove_clothing",
  "scope": "clothing:topmost_clothing",
  "template": "remove {target}"
}
```

### Testing Validation Commands

```bash
# Full validation sequence
npm run lint
npm run typecheck
npm run scope:lint
npm run test:ci

# Specific test execution
npm test -- --testNamePattern="Remove Clothing Action"
npm test -- tests/integration/clothing/unequipClothingAction.test.js --verbose
```

---

**Document Status**: **UPDATED TO REFLECT CURRENT STATE**  
**Current Reality**: Migration has NOT been performed - action remains in legacy format  
**Next Action**: Consider migration as future enhancement, following patterns established by migrated core actions
