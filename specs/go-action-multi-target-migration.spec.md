# Go Action Multi-Target Migration Implementation Specification

## Executive Summary

This specification provides comprehensive implementation requirements and guidance for migrating the `core:go` action from the legacy single-target format to the new multi-target action system. The migration includes updating `data/mods/core/actions/go.action.json`, `data/mods/core/rules/go.rule.json`, and all corresponding test suites while maintaining backward compatibility.

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Target Architecture](#target-architecture)
3. [Migration Requirements](#migration-requirements)
4. [Implementation Plan](#implementation-plan)
5. [Test Suite Updates](#test-suite-updates)
6. [Validation Requirements](#validation-requirements)
7. [Backward Compatibility](#backward-compatibility)
8. [Implementation Guide](#implementation-guide)

## Current State Analysis

### Current Action Definition (go.action.json)

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "core:go",
  "name": "Go",
  "description": "Moves your character to the specified location, if the way is clear.",
  "scope": "core:clear_directions",
  "template": "go to {target}",
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "core:actor-can-move"
      },
      "failure_message": "You cannot move without functioning legs."
    }
  ]
}
```

**Key Characteristics:**
- Uses legacy `scope` property with single scope string
- Simple `{target}` placeholder in template
- Single prerequisite checking movement capability
- No multi-target support

### Current Rule Definition (go.rule.json)

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_go_action",
  "comment": "Handles the 'core:go' action...",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "core:event-is-action-go"
  },
  "actions": [
    // Rule accesses target via: event.payload.targetId
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "resolvedTargetLocationId",
        "value": "{event.payload.targetId}"
      }
    }
    // ... rest of rule logic
  ]
}
```

**Key Characteristics:**
- Directly accesses `event.payload.targetId`
- Single target resolution pattern
- No support for multi-target payloads

### Current Event Payload Structure

```json
{
  "eventName": "core:attempt_action",
  "actorId": "player_001",
  "actionId": "core:go",
  "targetId": "location_002",
  "originalInput": "go north"
}
```

## Target Architecture

### Migrated Action Definition

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "core:go",
  "name": "Go",
  "description": "Moves your character to the specified location, if the way is clear.",
  "targets": {
    "primary": {
      "scope": "core:clear_directions",
      "placeholder": "destination",
      "description": "Location to move to"
    }
  },
  "template": "go to {destination}",
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "core:actor-can-move"
      },
      "failure_message": "You cannot move without functioning legs."
    }
  ]
}
```

**Migration Changes:**
- `scope` → `targets.primary.scope`
- Added `placeholder` and `description` for clarity
- Updated template: `{target}` → `{destination}`
- Maintains same functionality with enhanced structure

### Enhanced Rule Definition

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_go_action",
  "comment": "Handles the 'core:go' action. Updated for multi-target compatibility.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "core:event-is-action-go"
  },
  "actions": [
    {
      "type": "SET_VARIABLE",
      "comment": "Use backward-compatible targetId (maintains compatibility with both formats)",
      "parameters": {
        "variable_name": "resolvedTargetLocationId",
        "value": "{event.payload.targetId}"
      }
    }
    // ... rest of rule logic remains unchanged
  ]
}
```

**Migration Strategy:**
- **Backward Compatible**: Continue using `event.payload.targetId`
- **Future Ready**: Rule can handle both legacy and multi-target events
- **No Logic Changes**: Core movement logic remains identical

### New Event Payload Structure

```json
{
  "eventName": "core:attempt_action",
  "actorId": "player_001",
  "actionId": "core:go",
  "targets": {
    "primary": "location_002"
  },
  "targetId": "location_002",
  "originalInput": "go north"
}
```

**Backward Compatibility Features:**
- `targetId` field maintained with primary target value
- Both `targets` and `targetId` fields present
- Existing rules continue to work unchanged

## Migration Requirements

### Functional Requirements

1. **Action Discovery Compatibility**
   - Migrated action must work with existing action discovery system
   - Target resolution must produce identical results
   - Command formatting must generate same output text

2. **Rule Processing Compatibility**
   - Rule must handle both legacy and multi-target event payloads
   - Same movement logic and validation behavior
   - Identical error handling and messaging

3. **Event System Integration**
   - Generated events must maintain same structure
   - Perceptible events must remain unchanged
   - Turn ending behavior must be identical

### Non-Functional Requirements

1. **Performance**
   - No degradation in action resolution time
   - Memory usage should remain constant
   - Target resolution performance unchanged

2. **Maintainability**
   - Clear documentation of changes
   - Comprehensive test coverage
   - Easy rollback capability

3. **Compatibility**
   - Full backward compatibility with existing saves/data
   - Works with existing UI components
   - Compatible with other mod actions

## Implementation Plan

### Phase 1: Action Definition Migration

**Files to Modify:**
- `data/mods/core/actions/go.action.json`

**Changes Required:**
1. Replace `scope` with `targets.primary` object
2. Update template placeholder
3. Add target description
4. Validate against updated schema

**Validation Steps:**
1. Schema validation passes
2. Action discovery system recognizes new format
3. Target resolution produces identical results
4. Command formatting works correctly

### Phase 2: Rule Definition Updates

**Files to Modify:**
- `data/mods/core/rules/go.rule.json`

**Changes Required:**
1. Update comments to reflect multi-target awareness
2. Ensure `event.payload.targetId` access pattern continues
3. Add documentation for backward compatibility approach

**Validation Steps:**
1. Rule processes both legacy and multi-target events
2. Movement logic remains identical
3. Error handling unchanged
4. Event dispatching works correctly

### Phase 3: Test Suite Updates

**Test Files Requiring Updates:**

1. **Integration Tests:**
   - `tests/integration/rules/goRule.integration.test.js`
   - `tests/integration/actions/actionCandidateProcessor.integration.test.js`
   - `tests/integration/scopes/actionDiscoveryIntegration.integration.test.js`

2. **Unit Tests:**
   - `tests/unit/actions/actionDiscoverySystem.go.test.js`
   - `tests/unit/actions/pipeline/stages/TargetResolutionStage.test.js`
   - `tests/unit/schemas/go.schema.test.js`

3. **E2E Tests:**
   - `tests/e2e/actions/ActionDiscoveryWorkflow.e2e.test.js`
   - `tests/e2e/actions/TurnBasedActionProcessing.e2e.test.js`
   - `tests/e2e/scopeDsl/ActionSystemIntegration.e2e.test.js`

**New Test Requirements:**
1. Multi-target event payload validation
2. Backward compatibility verification
3. Schema validation for new format
4. Target resolution consistency checks

## Test Suite Updates

### Integration Test Updates

#### goRule.integration.test.js

**Required Changes:**
1. **Import Updates**: No changes needed - rule uses same targetId access
2. **Test Data**: Update action definition reference if needed
3. **Event Payloads**: Add tests for multi-target event format
4. **Validation**: Ensure rule handles both payload formats

**New Test Cases:**
```javascript
it('handles multi-target event payload format', async () => {
  // Test with new multi-target event structure
  await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
    actorId: 'actor1',
    actionId: 'core:go',
    targets: { primary: 'locB' },
    targetId: 'locB', // Backward compatibility
    originalInput: 'go north',
  });
  
  // Same assertions as legacy test
  expect(
    testEnv.entityManager.getComponentData('actor1', POSITION_COMPONENT_ID)
  ).toEqual({ locationId: 'locB' });
});

it('maintains backward compatibility with legacy event format', async () => {
  // Test with legacy event structure (no targets field)
  await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
    actorId: 'actor1',
    actionId: 'core:go',
    targetId: 'locB',
    originalInput: 'go north',
  });
  
  // Same results expected
  expect(
    testEnv.entityManager.getComponentData('actor1', POSITION_COMPONENT_ID)
  ).toEqual({ locationId: 'locB' });
});
```

#### actionDiscoverySystem.go.test.js

**Required Changes:**
1. **Action Definition**: Update import to reference migrated action
2. **Mock Expectations**: Verify new template format generation
3. **Target Resolution**: Ensure scope resolution works with new format

**Updated Test Case:**
```javascript
it('should discover "go to The Town" action with new multi-target format', async () => {
  const bed = getBed();
  
  // Mock should return new template format
  bed.mocks.actionCommandFormatter.format.mockImplementation(
    (actionDef) => {
      if (actionDef.id === 'core:go')
        return { ok: true, value: 'go to The Town' }; // Updated placeholder
      return { ok: false, error: 'invalid' };
    }
  );
  
  const result = await bed.service.getValidActions(mockHeroEntity, {
    jsonLogicEval: {},
  });
  
  expect(result.errors).toEqual([]);
  // Verify action structure includes targets format
  const goAction = result.actions.find(a => a.actionId === 'core:go');
  expect(goAction).toBeDefined();
  expect(goAction.targets).toBeDefined();
  expect(goAction.targets.primary).toBeDefined();
});
```

### Schema Validation Tests

**New Test File**: `tests/unit/schemas/goActionMultiTarget.schema.test.js`

```javascript
import { describe, it, expect } from '@jest/globals';
import Ajv from 'ajv';
import actionSchema from '../../../data/schemas/action.schema.json';
import goActionMigrated from '../../../data/mods/core/actions/go.action.json';

describe('Go Action Multi-Target Schema Validation', () => {
  let ajv;

  beforeEach(() => {
    ajv = new Ajv({ allErrors: true });
  });

  it('validates migrated go.action.json against action schema', () => {
    const valid = ajv.validate(actionSchema, goActionMigrated);
    if (!valid) {
      console.error('Schema validation errors:', ajv.errors);
    }
    expect(valid).toBe(true);
  });

  it('ensures targets structure is properly defined', () => {
    expect(goActionMigrated.targets).toBeDefined();
    expect(goActionMigrated.targets.primary).toBeDefined();
    expect(goActionMigrated.targets.primary.scope).toBe('core:clear_directions');
    expect(goActionMigrated.targets.primary.placeholder).toBe('destination');
    expect(goActionMigrated.targets.primary.description).toBeDefined();
  });

  it('ensures template uses new placeholder', () => {
    expect(goActionMigrated.template).toBe('go to {destination}');
  });
});
```

## Validation Requirements

### Schema Compliance

1. **Action Schema Validation**
   - Migrated action must pass `action.schema.json` validation
   - All required fields present and correctly typed
   - Targets structure follows multi-target specification

2. **Rule Schema Validation**
   - Updated rule must pass `rule.schema.json` validation
   - All operations remain valid
   - Comments and structure properly formatted

3. **Event Schema Validation**
   - Generated events must pass `attempt_action.event.json` validation
   - Both legacy and multi-target payload formats supported
   - Required fields present in both formats

### Functional Validation

1. **Action Discovery**
   - Action appears in discovery results
   - Target resolution produces expected results
   - Command formatting generates correct text
   - Prerequisites evaluate correctly

2. **Rule Processing**
   - Rule triggers on correct events
   - Movement logic executes properly
   - Error handling works as expected
   - Event dispatching maintains behavior

3. **Integration Testing**
   - End-to-end movement workflow functions
   - UI integration remains functional
   - Save/load compatibility maintained
   - Performance benchmarks met

### Test Coverage Requirements

1. **Minimum Coverage Thresholds**
   - Unit tests: 90% function coverage, 80% branch coverage
   - Integration tests: All critical paths covered
   - E2E tests: Complete user workflows validated

2. **Test Categories Required**
   - Schema validation tests
   - Backward compatibility tests
   - Multi-target format tests
   - Error handling tests
   - Performance regression tests

## Backward Compatibility

### Event Payload Compatibility

The migration maintains full backward compatibility through dual-format support:

**Legacy Format Support:**
```json
{
  "actorId": "player_001",
  "actionId": "core:go",
  "targetId": "location_002",
  "originalInput": "go north"
}
```

**Multi-Target Format:**
```json
{
  "actorId": "player_001",
  "actionId": "core:go",
  "targets": { "primary": "location_002" },
  "targetId": "location_002",
  "originalInput": "go north"
}
```

**Compatibility Mechanism:**
- `targetId` field always present (contains primary target)
- Rules can access either `event.payload.targetId` or `event.payload.targets.primary`
- Schema validation accepts both formats
- Action pipeline generates both fields

### Rule Compatibility

**Current Rule Access Pattern:**
```json
{
  "type": "SET_VARIABLE",
  "parameters": {
    "variable_name": "resolvedTargetLocationId",
    "value": "{event.payload.targetId}"
  }
}
```

**Compatibility Strategy:**
- **Keep Existing**: Continue using `event.payload.targetId`
- **Dual Support**: System ensures `targetId` always equals `targets.primary`
- **No Changes**: Rule logic remains completely unchanged
- **Future Proof**: Can migrate to `targets.primary` access later if needed

### Data Migration

**No Data Migration Required:**
- Existing save files continue to work
- Legacy action definitions supported during transition
- Game state remains compatible
- No breaking changes to data structures

## Implementation Guide

### Step 1: Backup Current Files

```bash
# Create backup copies
cp data/mods/core/actions/go.action.json data/mods/core/actions/go.action.json.backup
cp data/mods/core/rules/go.rule.json data/mods/core/rules/go.rule.json.backup
```

### Step 2: Update Action Definition

**File**: `data/mods/core/actions/go.action.json`

**Changes to Apply:**
1. Replace `scope` field with `targets` object
2. Update template placeholder
3. Add target description

**Implementation:**
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "core:go",
  "name": "Go",
  "description": "Moves your character to the specified location, if the way is clear.",
  "targets": {
    "primary": {
      "scope": "core:clear_directions",
      "placeholder": "destination",
      "description": "Location to move to"
    }
  },
  "template": "go to {destination}",
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "core:actor-can-move"
      },
      "failure_message": "You cannot move without functionality legs."
    }
  ]
}
```

### Step 3: Update Rule Comments

**File**: `data/mods/core/rules/go.rule.json`

**Changes to Apply:**
1. Update main comment to note multi-target compatibility
2. Add comment explaining backward compatibility approach
3. No logic changes required

**Implementation:**
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_go_action",
  "comment": "Handles the 'core:go' action. Uses backward-compatible targetId access to support both legacy and multi-target event formats.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "core:event-is-action-go"
  },
  "actions": [
    // ... existing actions remain unchanged
    {
      "type": "SET_VARIABLE",
      "comment": "Use backward-compatible targetId (works with both legacy and multi-target events)",
      "parameters": {
        "variable_name": "resolvedTargetLocationId",
        "value": "{event.payload.targetId}"
      }
    }
    // ... rest of rule unchanged
  ]
}
```

### Step 4: Run Validation Tests

```bash
# Validate schema compliance
npm run test:single -- --testPathPattern="schemas.*go"

# Run action discovery system tests
npm run test:single -- --testPathPattern="actionDiscoverySystem.*go"

# Run rule integration tests
npm run test:single -- --testPathPattern="goRule.integration"

# Run full test suite
npm run test:ci
```

### Step 5: Update Test Files

**Priority Order:**
1. Schema validation tests (highest impact)
2. Integration tests (core functionality)
3. Unit tests (specific components)
4. E2E tests (user workflows)

**Validation After Each Update:**
```bash
npm run test:single -- --testPathPattern="[specific-test-pattern]"
```

### Step 6: Performance Validation

```bash
# Run performance tests
npm run test:single -- --testPathPattern="performance.*entity"

# Check action discovery performance
npm run test:single -- --testPathPattern="ActionDiscoveryWorkflow"
```

### Step 7: Final Validation

```bash
# Full test suite
npm run test:ci

# Lint and format
npm run lint
npm run format

# Type checking
npm run typecheck
```

### Step 8: Rollback Plan

If issues arise during implementation:

```bash
# Restore backup files
cp data/mods/core/actions/go.action.json.backup data/mods/core/actions/go.action.json
cp data/mods/core/rules/go.rule.json.backup data/mods/core/rules/go.rule.json

# Revert test changes
git checkout -- tests/

# Run validation
npm run test:ci
```

## Success Criteria

### Technical Criteria

1. **Schema Validation**: All migrated files pass schema validation
2. **Test Coverage**: All test suites pass with maintained coverage levels
3. **Backward Compatibility**: Legacy event formats continue to work
4. **Performance**: No performance degradation in action resolution
5. **Integration**: Full integration with existing action pipeline

### Functional Criteria

1. **User Experience**: Movement commands work identically to before
2. **Error Handling**: Same error messages and failure behaviors
3. **Event Generation**: Identical event sequences and payloads
4. **Save Compatibility**: Existing save files continue to load and work
5. **Mod Compatibility**: Other mods that reference go action continue to work

### Quality Criteria

1. **Code Quality**: Lint and format checks pass
2. **Documentation**: Clear comments and specification updates
3. **Maintainability**: Changes are well-documented and reversible
4. **Testing**: Comprehensive test coverage for new functionality
5. **Monitoring**: No regression in system performance or reliability

## Conclusion

This specification provides a comprehensive roadmap for migrating the `core:go` action to the new multi-target format while maintaining full backward compatibility. The approach prioritizes safety and reversibility, ensuring that the migration can be completed without disrupting existing functionality or user experience.

The key insight is that the `go` action, being inherently single-target, doesn't require complex multi-target logic but benefits from the enhanced structure and consistency of the new format. By maintaining the `targetId` field for backward compatibility, we ensure a smooth transition that future-proofs the action system while preserving all existing functionality.