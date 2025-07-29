# Dismiss Action Migration Specification

## Overview

This specification documents the migration of the `core:dismiss` action and its corresponding rule from the legacy single-target format to the new multi-target action system in the Living Narrative Engine. This migration follows the comprehensive guidelines outlined in `reports/action-migration-guide.md`.

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Migration Requirements](#migration-requirements)
3. [Action Definition Migration](#action-definition-migration)
4. [Rule Definition Migration](#rule-definition-migration)
5. [Event Payload Changes](#event-payload-changes)
6. [Test Suite Updates](#test-suite-updates)
7. [Implementation Plan](#implementation-plan)
8. [Validation Checklist](#validation-checklist)

## Current State Analysis

### Legacy Action Structure

**File**: `data/mods/core/actions/dismiss.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "core:dismiss",
  "name": "Dismiss",
  "description": "Dismisses a follower from your service.",
  "scope": "core:followers",
  "required_components": {
    "actor": ["core:leading"]
  },
  "template": "dismiss {target}",
  "prerequisites": []
}
```

**Legacy Format Characteristics**:
- Uses deprecated `scope` property instead of `targets`
- Single `{target}` placeholder in template
- Simple target resolution to `targetId` in events
- Basic actor component requirement checking

### Legacy Rule Structure

**File**: `data/mods/core/rules/dismiss.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.json",
  "rule_id": "handle_dismiss",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "core:event-is-action-dismiss"
  },
  "actions": [
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_ref": "target",
        "component_type": "core:following"
      }
    },
    {
      "type": "MODIFY_ARRAY_FIELD",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:leading",
        "field": "followers",
        "mode": "remove_by_value",
        "value": "{event.payload.targetId}"
      }
    }
    // ... additional actions
  ]
}
```

**Legacy Rule Characteristics**:
- Directly references `{event.payload.targetId}` 
- Uses simple entity references like `"entity_ref": "target"`
- Expects single-target event payload structure

### Current Test Coverage

**Existing Test Files**:
1. `tests/unit/schemas/dismiss.schema.test.js` - Schema validation
2. `tests/integration/rules/dismissRule.integration.test.js` - Rule execution
3. Various action discovery and scope integration tests

## Migration Requirements

### Primary Goals

1. **Modernize Action Structure**: Convert from legacy `scope` to multi-target `targets` format
2. **Enhance Clarity**: Use semantic target naming (`follower` instead of generic `target`)
3. **Maintain Compatibility**: Ensure backward compatibility during transition
4. **Improve Testing**: Expand test coverage for multi-target scenarios

### Design Decisions

1. **Single Primary Target**: The dismiss action logically involves one target (the follower)
2. **Semantic Naming**: Use `follower` as the placeholder name for clarity
3. **Backward Compatibility**: Support both legacy and multi-target event payloads
4. **Template Enhancement**: Update template to use semantic placeholder

## Action Definition Migration

### Migrated Action Structure

**Target File**: `data/mods/core/actions/dismiss.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "core:dismiss",
  "name": "Dismiss",
  "description": "Dismisses a follower from your service.",
  "targets": {
    "primary": {
      "scope": "core:followers",
      "placeholder": "follower",
      "description": "The follower to dismiss from service"
    }
  },
  "required_components": {
    "actor": ["core:leading"]
  },
  "template": "dismiss {follower}",
  "prerequisites": []
}
```

### Migration Changes Summary

| Aspect | Legacy Format | Multi-Target Format |
|--------|---------------|-------------------|
| Target Definition | `"scope": "core:followers"` | `"targets": {"primary": {...}}` |
| Template | `"dismiss {target}"` | `"dismiss {follower}"` |
| Placeholder | `{target}` | `{follower}` |
| Target Description | None | "The follower to dismiss from service" |
| Schema Compliance | Legacy support | Modern multi-target |

### Validation Requirements

1. **Schema Compliance**: Must validate against updated action schema
2. **Target Resolution**: `core:followers` scope must resolve correctly  
3. **Template Rendering**: `{follower}` placeholder must render properly
4. **Component Requirements**: Actor must still have `core:leading` component

## Rule Definition Migration

### Event Payload Evolution

#### Legacy Event Payload
```json
{
  "eventName": "core:attempt_action",
  "actorId": "player_001",
  "actionId": "core:dismiss", 
  "targetId": "follower_001",
  "originalInput": "dismiss John"
}
```

#### Multi-Target Event Payload
```json
{
  "eventName": "core:attempt_action",
  "actorId": "player_001",
  "actionId": "core:dismiss",
  "targets": {
    "primary": "follower_001"
  },
  "targetId": "follower_001",
  "originalInput": "dismiss John"
}
```

**Key Changes**:
- Addition of `targets` object with `primary` field
- Retention of `targetId` for backward compatibility
- `targetId` contains the primary target ID

### Rule Migration Strategy

The rule should be updated to support both legacy and multi-target formats while maintaining full functionality.

#### Option 1: Backward Compatible Approach (Recommended)

Keep existing `{event.payload.targetId}` references since:
- `targetId` is maintained for backward compatibility
- Contains the primary target ID in multi-target actions
- Requires no rule changes
- Maintains existing functionality

#### Option 2: Multi-Target Native Approach

Update to use `{event.payload.targets.primary}` with fallback:

```json
{
  "type": "SET_VARIABLE",
  "parameters": {
    "variable_name": "dismissedFollowerId",
    "value": "{event.payload.targets.primary || event.payload.targetId}"
  }
}
```

**Recommendation**: Use Option 1 (Backward Compatible) to minimize changes and maintain stability.

### Updated Rule Structure

**Target File**: `data/mods/core/rules/dismiss.rule.json`

The rule structure remains unchanged as it already uses the backward-compatible `targetId` field:

```json
{
  "$schema": "schema://living-narrative-engine/rule.json",
  "rule_id": "handle_dismiss",
  "comment": "Handles the 'core:dismiss' action. Removes the component from the TARGET, updates the ACTOR's (leader's) cache, dispatches a conditional perceptible event and a success UI event, and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "core:event-is-action-dismiss"
  },
  "actions": [
    {
      "type": "REMOVE_COMPONENT",
      "comment": "Step 1: Authoritatively remove the following relationship from the TARGET entity.",
      "parameters": {
        "entity_ref": "target",
        "component_type": "core:following"
      }
    },
    {
      "type": "MODIFY_ARRAY_FIELD",
      "comment": "Step 2: Remove the follower from the ACTOR's (leader's) 'core:leading' component.",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:leading",
        "field": "followers",
        "mode": "remove_by_value",
        "value": "{event.payload.targetId}"
      }
    }
    // ... rest of actions unchanged
  ]
}
```

**Rationale**: No changes needed because:
1. The rule uses `{event.payload.targetId}` which is maintained in multi-target events
2. Entity references like `"entity_ref": "target"` continue to work
3. Backward compatibility is preserved
4. Existing functionality is maintained

## Event Payload Changes

### Compatibility Matrix

| Field | Legacy Format | Multi-Target Format | Rule Access |
|-------|---------------|-------------------|-------------|
| `actorId` | ✅ Present | ✅ Present | `{event.payload.actorId}` |
| `actionId` | ✅ Present | ✅ Present | `{event.payload.actionId}` |
| `targetId` | ✅ Present | ✅ Present (primary) | `{event.payload.targetId}` |
| `targets` | ❌ Absent | ✅ Present | `{event.payload.targets.primary}` |
| `originalInput` | ✅ Present | ✅ Present | `{event.payload.originalInput}` |

### Event Schema Validation

The `core:attempt_action` event schema supports both formats through `anyOf` validation:

```json
{
  "anyOf": [
    {
      "description": "Legacy format: requires targetId",
      "required": ["targetId"]
    },
    {
      "description": "Multi-target format: requires targets and targetId as primary",
      "required": ["targets", "targetId"],
      "properties": {
        "targets": {
          "minProperties": 1
        },
        "targetId": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  ]
}
```

## Test Suite Updates

### Test Files Requiring Updates

#### 1. Schema Validation Test
**File**: `tests/unit/schemas/dismiss.schema.test.js`

**Current Structure**:
```javascript
test('should be a valid action definition', () => {
  const isValid = validate(actionData);
  if (!isValid) {
    console.error('Validation errors:', validate.errors);
  }
  expect(isValid).toBe(true);
});
```

**Required Updates**:
- Test validates against updated multi-target action schema
- Verify `targets.primary` structure validation
- Ensure placeholder and description validation
- Add negative test cases for invalid target structures

#### 2. Rule Integration Test
**File**: `tests/integration/rules/dismissRule.integration.test.js`

**Current Test**:
```javascript
await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
  actorId: 'actor1',
  actionId: 'core:dismiss',
  targetId: 'target1',
});
```

**Required Updates**:
- Add tests for multi-target event payload format
- Verify backward compatibility with legacy event format
- Test both `targetId` and `targets.primary` access patterns
- Ensure rule processes both formats correctly

#### 3. Action Discovery Tests
**Files**: 
- `tests/integration/scopes/actionDiscoveryIntegration.integration.test.js`
- `tests/integration/scopes/scopeIntegration.test.js`
- `tests/e2e/actions/ActionDiscoveryWorkflow.e2e.test.js`

**Required Updates**:
- Update expectations for action template changes (`{target}` → `{follower}`)
- Verify action discovery works with multi-target format
- Test target resolution with new `targets.primary.scope`

### New Test Requirements

#### 1. Multi-Target Event Validation Tests
```javascript
describe('Multi-Target Event Processing', () => {
  it('should process multi-target event payload', async () => {
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'actor1',
      actionId: 'core:dismiss',
      targets: {
        primary: 'target1'
      },
      targetId: 'target1',
    });
    
    // Verify rule processes correctly
    expect(testEnv.events).toContainEqual(
      expect.objectContaining({
        eventType: 'core:display_successful_action_result'
      })
    );
  });
});
```

#### 2. Template Rendering Tests
```javascript
describe('Template Rendering', () => {
  it('should render template with follower placeholder', () => {
    const template = "dismiss {follower}";
    const targets = { primary: { name: "John" } };
    
    const result = renderTemplate(template, targets);
    
    expect(result).toBe("dismiss John");
  });
});
```

#### 3. Backward Compatibility Tests
```javascript
describe('Backward Compatibility', () => {
  it('should handle legacy event format', async () => {
    // Test legacy format still works
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'actor1',
      actionId: 'core:dismiss',
      targetId: 'target1',
    });
    
    // Verify same behavior as multi-target format
  });
});
```

### Test Coverage Requirements

1. **Schema Validation**: 100% coverage of new action structure
2. **Event Processing**: Both legacy and multi-target event formats
3. **Template Rendering**: New placeholder validation
4. **Target Resolution**: Multi-target scope resolution
5. **Rule Execution**: Backward compatibility verification
6. **Error Handling**: Invalid target structure scenarios

## Implementation Plan

### Phase 1: Action Definition Migration
**Duration**: 1-2 hours

1. **Update Action File**
   - Modify `data/mods/core/actions/dismiss.action.json`
   - Replace `scope` with `targets` structure
   - Update template placeholder
   - Add target description

2. **Validate Schema Compliance**
   - Run `npm run lint`
   - Verify action validates against schema
   - Test action discovery still works

### Phase 2: Test Suite Updates
**Duration**: 2-3 hours

1. **Update Schema Test**
   - Modify `tests/unit/schemas/dismiss.schema.test.js`
   - Add multi-target validation tests
   - Test negative scenarios

2. **Update Integration Tests**
   - Modify `tests/integration/rules/dismissRule.integration.test.js`
   - Add multi-target event tests
   - Verify backward compatibility

3. **Update Discovery Tests**
   - Update template expectations in discovery tests
   - Verify target resolution works correctly

### Phase 3: Enhanced Testing
**Duration**: 1-2 hours

1. **Add New Test Cases**
   - Multi-target event processing tests
   - Template rendering validation
   - Backward compatibility verification

2. **Coverage Verification**
   - Run full test suite
   - Verify 80%+ coverage maintained
   - Check for regressions

### Phase 4: Validation and Documentation
**Duration**: 1 hour

1. **Full System Testing**
   - Run `npm run test:ci`
   - Verify all existing tests pass
   - Test in game environment

2. **Documentation Updates**
   - Update any relevant documentation
   - Note migration completion

## Validation Checklist

### Pre-Migration Checklist
- [ ] Current action file structure documented
- [ ] Current rule file structure documented  
- [ ] All existing tests identified and documented
- [ ] Migration strategy defined and reviewed

### Action Migration Checklist
- [ ] Action file updated to multi-target format
- [ ] Schema validation passes
- [ ] Template uses semantic placeholder (`{follower}`)
- [ ] Target description added
- [ ] `required_components` preserved

### Rule Migration Checklist
- [ ] Rule structure reviewed for compatibility needs
- [ ] Backward compatibility maintained
- [ ] Event payload access patterns verified
- [ ] No breaking changes introduced

### Testing Checklist
- [ ] Schema validation tests updated
- [ ] Integration tests support both event formats
- [ ] Action discovery tests updated for template changes
- [ ] New multi-target tests added
- [ ] Backward compatibility tests added
- [ ] All tests pass (`npm run test:ci`)

### Final Validation Checklist
- [ ] Full test suite passes (unit + integration + e2e)
- [ ] Code linting passes (`npm run lint`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Manual testing in game environment successful
- [ ] No regressions in existing functionality
- [ ] Migration documented and reviewed

## Risk Assessment

### Low Risk Items
- **Action Schema Changes**: Well-defined migration path
- **Template Updates**: Simple placeholder substitution
- **Test Updates**: Straightforward additions

### Medium Risk Items
- **Event Payload Compatibility**: Requires careful testing of both formats
- **Rule Integration**: Must verify no breaking changes

### Mitigation Strategies
1. **Incremental Testing**: Test each change separately
2. **Rollback Plan**: Keep backup of original files
3. **Comprehensive Testing**: Test both legacy and new formats
4. **Manual Verification**: Test in actual game environment

## Success Criteria

1. **Functionality Preserved**: Dismiss action works identically to before
2. **Schema Compliance**: Action validates against multi-target schema
3. **Test Coverage**: All tests pass with adequate coverage
4. **Backward Compatibility**: System handles both event formats
5. **Code Quality**: Linting and type checking pass
6. **Documentation**: Migration properly documented

## Conclusion

This migration specification provides a comprehensive roadmap for converting the `core:dismiss` action from legacy single-target format to the modern multi-target system. The approach prioritizes backward compatibility while modernizing the action structure and enhancing test coverage.

The migration maintains full functionality while improving code clarity through semantic naming and enhanced validation. The comprehensive test plan ensures reliability and prevents regressions during the transition.

## References

- **Migration Guide**: `reports/action-migration-guide.md`
- **Action Schema**: `data/schemas/action.schema.json`  
- **Event Schema**: `data/mods/core/events/attempt_action.event.json`
- **Original Action**: `data/mods/core/actions/dismiss.action.json`
- **Original Rule**: `data/mods/core/rules/dismiss.rule.json`