# Positioning Action Target Validation Architecture Analysis

**Date**: 2025-01-18
**Focus**: Action Schema Enhancement Implementation
**Issue**: LLM-controlled character can execute `kneel_before` action on target already kneeling, creating logical inconsistencies

## Executive Summary

The positioning system contains a critical validation gap where the `kneel_before` action can be executed on targets who are already in a kneeling state, creating impossible gameplay scenarios. The root cause is the action schema's architectural limitation - `forbidden_components` only supports actor validation, not target validation. This analysis provides a comprehensive technical solution through **Action Schema Enhancement** to enable target component validation, ensuring robust prevention of illogical positioning states.

## Problem Statement

### Observed Issue

During gameplay, an LLM-controlled character successfully executed the `kneel_before` action targeting a player character who was already kneeling before the LLM character. This creates a logical inconsistency:

1. **Initial State**: Player kneeling before LLM character
2. **Invalid Action**: LLM character executes "kneel before Player"
3. **Result**: Both characters would theoretically be kneeling before each other (impossible)

### Impact

- Breaks immersion through illogical character positioning
- Undermines the positioning system's state management integrity
- Allows contradictory game states that cannot be visually represented

## Current Architecture Analysis

### Action Definition Structure

**File**: `data/mods/deference/actions/kneel_before.action.json`

```json
{
  "id": "deference:kneel_before",
  "targets": {
    "primary": {
      "scope": "positioning:actors_in_location_facing"
    }
  },
  "forbidden_components": {
    "actor": ["positioning:kneeling_before", "positioning:sitting_on"]
  }
}
```

**Current Validation**:

- ✅ **Actor validation**: Prevents actors already kneeling from kneeling again
- ❌ **Target validation**: No validation of target component state

### Scope Definition Analysis

**File**: `data/mods/positioning/scopes/actors_in_location_facing.scope`

```
positioning:actors_in_location_facing := entities(core:position)[][{
  "and": [
    { "condition_ref": "core:entity-at-location" },
    { "condition_ref": "core:entity-is-not-current-actor" },
    { "condition_ref": "core:entity-has-actor-component" },
    {
      "!": {
        "condition_ref": "positioning:entity-in-facing-away"
      }
    }
  ]
}]
```

**Current Filtering**:

- ✅ Same location check
- ✅ Excludes current actor
- ✅ Actors only
- ✅ Not facing away from
- ❌ **Missing**: Component state validation

### Component State Structure

**File**: `data/mods/positioning/components/kneeling_before.component.json`

```json
{
  "id": "positioning:kneeling_before",
  "dataSchema": {
    "type": "object",
    "properties": {
      "entityId": {
        "type": "string",
        "description": "The ID of the entity that the component holder is kneeling before"
      }
    }
  }
}
```

The component provides clear state tracking - presence indicates kneeling status.

## Root Cause Analysis

### 1. Scope Filtering Limitation

The current scope `positioning:actors_in_location_facing` focuses on positional and facing requirements but lacks component state validation. It doesn't filter out entities that already have conflicting positional components.

### 2. Action Schema Architecture Constraint

The `forbidden_components` property in the action schema only supports validation on the `"actor"` entity:

```json
"forbidden_components": {
  "actor": ["list_of_components"],
  // No "target" property supported
}
```

This architectural limitation prevents direct target component validation at the action level.

### 3. Missing Target State Awareness

The action discovery system validates actor prerequisites but doesn't have a built-in mechanism for validating target component states during scope resolution.

## Technical Solution: Action Schema Enhancement

The comprehensive solution involves extending the action schema architecture to support target component validation, enabling declarative forbidden component specifications for targets across all actions.

### Schema Enhancement Specification

**Enhanced Action Schema Structure**:

```json
{
  "forbidden_components": {
    "actor": ["positioning:kneeling_before", "positioning:sitting_on"],
    "target": ["positioning:kneeling_before", "positioning:sitting_on"],
    "primary": ["positioning:kneeling_before"],
    "secondary": ["positioning:sitting_on"]
  }
}
```

**Multi-Target Support**: The enhancement supports both legacy single-target and new multi-target action formats:

- `"target"`: Legacy single-target actions
- `"primary"/"secondary"/"tertiary"`: Named target roles in multi-target actions

### Implementation Architecture

#### 1. Schema Validation Layer (`data/schemas/action.schema.json`)

**Current Structure** (Lines 119-133):

```json
"forbidden_components": {
  "type": "object",
  "properties": {
    "actor": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

**Enhanced Structure**:

```json
"forbidden_components": {
  "type": "object",
  "properties": {
    "actor": {
      "type": "array",
      "items": { "type": "string", "pattern": "^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$" }
    },
    "target": {
      "type": "array",
      "items": { "type": "string", "pattern": "^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$" }
    },
    "primary": {
      "type": "array",
      "items": { "type": "string", "pattern": "^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$" }
    },
    "secondary": {
      "type": "array",
      "items": { "type": "string", "pattern": "^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$" }
    },
    "tertiary": {
      "type": "array",
      "items": { "type": "string", "pattern": "^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$" }
    }
  },
  "additionalProperties": false
}
```

#### 2. Target Validation Pipeline Integration

**Validation Point**: Target component validation should occur in the **TargetResolutionStage** (`src/actions/pipeline/stages/TargetResolutionStage.js`) or a new **TargetComponentValidationStage** after target resolution but before action formatting.

**Integration Strategy**:

1. **Extend ComponentFilteringStage**: Add target validation logic alongside existing actor validation
2. **New Pipeline Stage**: Create dedicated `TargetComponentValidationStage` for separation of concerns
3. **TargetResolutionStage Enhancement**: Integrate validation directly into target resolution process

**Recommended Approach**: New `TargetComponentValidationStage` for maintainability and single responsibility.

#### 3. Validation Logic Implementation

**Core Validation Interface**:

```javascript
class TargetComponentValidator {
  validateTargetComponents(actionDef, targetEntities, entityManager) {
    const forbiddenComponents = actionDef.forbidden_components;
    if (!forbiddenComponents) return true;

    // Handle legacy single-target format
    if (forbiddenComponents.target && targetEntities.target) {
      return this.validateEntityComponents(
        targetEntities.target,
        forbiddenComponents.target,
        entityManager
      );
    }

    // Handle multi-target format
    for (const [role, entity] of Object.entries(targetEntities)) {
      if (forbiddenComponents[role]) {
        if (
          !this.validateEntityComponents(
            entity,
            forbiddenComponents[role],
            entityManager
          )
        ) {
          return false;
        }
      }
    }

    return true;
  }
}
```

### Backward Compatibility

**Compatibility Matrix**:

- ✅ **Existing Actions**: All current actions with `forbidden_components.actor` continue working unchanged
- ✅ **Legacy Target Format**: Single-target actions using `"targets": "scope:id"` support new `forbidden_components.target`
- ✅ **Multi-Target Actions**: New multi-target actions support role-specific forbidden components
- ✅ **Schema Migration**: No breaking changes to existing action definitions

### Performance Considerations

**Validation Performance Profile**:

- **Actor Validation**: Current performance baseline (< 5ms per action)
- **Target Validation**: Expected similar performance (< 5ms per target)
- **Multi-Target Impact**: Linear scaling with number of targets (< 15ms for 3 targets)
- **Optimization Strategy**: Component existence checks are O(1) hash lookups

**Performance Monitoring**:

- Add performance tracing to target validation stage
- Monitor validation overhead in action discovery pipeline
- Implement caching for frequently accessed component states

### Advantages of Schema Enhancement

- ✅ **Comprehensive Solution**: Addresses target validation for all actions system-wide
- ✅ **Declarative Approach**: Clean, readable action definitions with clear validation rules
- ✅ **Multi-Target Support**: Handles complex actions with multiple target roles
- ✅ **Performance Efficient**: Validation occurs early in pipeline with minimal overhead
- ✅ **Maintainable**: Centralized validation logic reduces code duplication
- ✅ **Extensible**: Foundation for additional target validation features

### Implementation Challenges

- **Engine Complexity**: Requires modifications to core action discovery and validation systems
- **Testing Scope**: Comprehensive testing required across all action types and scenarios
- **Migration Strategy**: Careful rollout to avoid disrupting existing action functionality
- **Documentation**: Update of action authoring guidelines and validation patterns

## Comprehensive Test Specifications

To ensure the Action Schema Enhancement functions correctly and robustly, the following test suite must be implemented:

### 1. Schema Validation Tests (`tests/unit/schemas/actionSchemaTargetValidation.test.js`)

**Objective**: Validate action schema correctly accepts and rejects target forbidden component configurations.

#### Test Cases:

```javascript
describe('Action Schema Target Forbidden Components', () => {
  it('should validate action with target forbidden components', () => {
    const actionDef = {
      id: 'test:action',
      forbidden_components: {
        actor: ['comp:actor1'],
        target: ['comp:target1', 'comp:target2'],
      },
    };
    expect(validator.validate(actionDef)).toBe(true);
  });

  it('should validate multi-target action with role-specific forbidden components', () => {
    const actionDef = {
      forbidden_components: {
        actor: ['comp:actor1'],
        primary: ['comp:primary1'],
        secondary: ['comp:secondary1'],
        tertiary: ['comp:tertiary1'],
      },
    };
    expect(validator.validate(actionDef)).toBe(true);
  });

  it('should reject invalid component format in target forbidden components', () => {
    const actionDef = {
      forbidden_components: {
        target: ['invalid-format'], // Missing colon separator
      },
    };
    expect(validator.validate(actionDef)).toBe(false);
  });

  it('should reject unknown properties in forbidden_components', () => {
    const actionDef = {
      forbidden_components: {
        unknown_role: ['comp:test'],
      },
    };
    expect(validator.validate(actionDef)).toBe(false);
  });
});
```

### 2. Target Component Filtering Tests (`tests/unit/actions/targetComponentValidation.test.js`)

**Objective**: Test core target component validation logic in isolation.

#### Test Cases:

```javascript
describe('TargetComponentValidator', () => {
  it('should allow action when target lacks forbidden components', () => {
    const actionDef = {
      forbidden_components: { target: ['positioning:kneeling_before'] },
    };
    const targetEntity = { id: 'target1', components: {} };

    expect(
      validator.validateTargetComponents(actionDef, { target: targetEntity })
    ).toBe(true);
  });

  it('should reject action when target has forbidden component', () => {
    const actionDef = {
      forbidden_components: { target: ['positioning:kneeling_before'] },
    };
    const targetEntity = {
      id: 'target1',
      components: { 'positioning:kneeling_before': { entityId: 'someone' } },
    };

    expect(
      validator.validateTargetComponents(actionDef, { target: targetEntity })
    ).toBe(false);
  });

  it('should handle multi-target validation correctly', () => {
    const actionDef = {
      forbidden_components: {
        primary: ['positioning:kneeling_before'],
        secondary: ['positioning:sitting_on'],
      },
    };
    const targets = {
      primary: { id: 't1', components: {} }, // Valid
      secondary: { id: 't2', components: { 'positioning:sitting_on': {} } }, // Invalid
    };

    expect(validator.validateTargetComponents(actionDef, targets)).toBe(false);
  });

  it('should handle mixed forbidden and allowed components', () => {
    const actionDef = {
      forbidden_components: { target: ['positioning:kneeling_before'] },
    };
    const targetEntity = {
      id: 'target1',
      components: {
        'core:actor': {}, // Allowed
        'core:position': {}, // Allowed
      },
    };

    expect(
      validator.validateTargetComponents(actionDef, { target: targetEntity })
    ).toBe(true);
  });
});
```

### 3. Action Discovery Integration Tests (`tests/integration/actions/targetForbiddenComponentsDiscovery.test.js`)

**Objective**: Test target forbidden component validation in the full action discovery pipeline.

#### Test Cases:

```javascript
describe('Action Discovery with Target Forbidden Components', () => {
  it('should filter out actions with forbidden target components during discovery', async () => {
    // Setup: Create actor and target where target has forbidden component
    const actor = createTestActor('actor1');
    const target = createTestActor('target1');
    addComponent(target, 'positioning:kneeling_before', {
      entityId: 'someone',
    });

    // Action with target forbidden component
    const actionDef = {
      id: 'test:kneel_before',
      forbidden_components: { target: ['positioning:kneeling_before'] },
    };

    const discoveredActions = await actionDiscovery.discoverActions(actor);
    const kneelAction = discoveredActions.find(
      (a) => a.actionId === 'test:kneel_before'
    );

    expect(kneelAction).toBeUndefined(); // Should be filtered out
  });

  it('should include actions when target components are allowed', async () => {
    const actor = createTestActor('actor1');
    const target = createTestActor('target1');
    // Target has no forbidden components

    const actionDef = {
      id: 'test:kneel_before',
      forbidden_components: { target: ['positioning:kneeling_before'] },
    };

    const discoveredActions = await actionDiscovery.discoverActions(actor);
    const kneelAction = discoveredActions.find(
      (a) => a.actionId === 'test:kneel_before'
    );

    expect(kneelAction).toBeDefined(); // Should be included
    expect(kneelAction.targets).toContain(target.id);
  });
});
```

### 4. Positioning Scenario Integration Tests (`tests/integration/mods/positioning/targetValidationScenarios.test.js`)

**Objective**: Test real positioning scenarios with the new target validation.

#### Test Cases:

```javascript
describe('Positioning Target Validation Scenarios', () => {
  it('should prevent kneeling before target already kneeling', async () => {
    const scenario = setupKneelingScenario();

    // Target is already kneeling before someone else
    addComponent(scenario.target, 'positioning:kneeling_before', {
      entityId: 'other_character',
    });

    const result = await testBed.executeAction('deference:kneel_before', {
      actor: scenario.actor.id,
      target: scenario.target.id,
    });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('target forbidden component');
  });

  it('should allow kneeling before standing target', async () => {
    const scenario = setupKneelingScenario();
    // Target has no positioning components (standing)

    const result = await testBed.executeAction('deference:kneel_before', {
      actor: scenario.actor.id,
      target: scenario.target.id,
    });

    expect(result.success).toBe(true);
    expect(
      scenario.actor.components['positioning:kneeling_before']
    ).toBeDefined();
  });

  it('should handle complex multi-actor positioning states', async () => {
    const scenario = setupMultiActorKneelingScenario();

    // Character A kneels before Character B
    await testBed.executeAction('deference:kneel_before', {
      actor: scenario.actorA.id,
      target: scenario.actorB.id,
    });

    // Character C tries to kneel before Character B (should succeed)
    const result = await testBed.executeAction('deference:kneel_before', {
      actor: scenario.actorC.id,
      target: scenario.actorB.id,
    });

    expect(result.success).toBe(true);
  });

  it('should prevent circular kneeling scenarios', async () => {
    const scenario = setupKneelingScenario();

    // Actor kneels before target
    await testBed.executeAction('deference:kneel_before', {
      actor: scenario.actor.id,
      target: scenario.target.id,
    });

    // Target tries to kneel before actor (should be prevented)
    const result = await testBed.executeAction('deference:kneel_before', {
      actor: scenario.target.id,
      target: scenario.actor.id,
    });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('target forbidden component');
  });
});
```

### 5. Performance Validation Tests (`tests/performance/actions/targetValidationPerformance.test.js`)

**Objective**: Ensure target validation doesn't significantly impact action discovery performance.

#### Test Cases:

```javascript
describe('Target Validation Performance', () => {
  it('should validate target components within performance thresholds', async () => {
    const startTime = performance.now();

    // Test with multiple actions and targets
    const results = await Promise.all([
      validateTargetComponents(action1, targets1),
      validateTargetComponents(action2, targets2),
      validateTargetComponents(action3, targets3),
    ]);

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(15); // < 15ms for 3 validations
    expect(results.every((r) => typeof r === 'boolean')).toBe(true);
  });

  it('should scale linearly with number of targets', async () => {
    const singleTargetTime = await measureValidationTime(1);
    const multiTargetTime = await measureValidationTime(3);

    const scalingFactor = multiTargetTime / singleTargetTime;
    expect(scalingFactor).toBeLessThan(4); // Should be roughly linear
  });
});
```

### 6. Regression Tests (`tests/integration/actions/targetValidationRegression.test.js`)

**Objective**: Ensure new target validation doesn't break existing functionality.

#### Test Cases:

```javascript
describe('Target Validation Regression Tests', () => {
  it('should not affect actions without forbidden components', async () => {
    const actionDef = {
      id: 'test:basic_action',
      // No forbidden_components property
    };

    const result = await actionDiscovery.discoverActions(actor);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should preserve existing actor forbidden component behavior', async () => {
    const actor = createTestActor('actor1');
    addComponent(actor, 'positioning:kneeling_before', { entityId: 'someone' });

    const actionDef = {
      id: 'test:action',
      forbidden_components: {
        actor: ['positioning:kneeling_before'],
      },
    };

    const result = await actionDiscovery.discoverActions(actor);
    const filteredAction = result.find((a) => a.actionId === 'test:action');

    expect(filteredAction).toBeUndefined(); // Should still be filtered
  });
});
```

### 7. Edge Case Tests (`tests/integration/actions/targetValidationEdgeCases.test.js`)

**Objective**: Test complex scenarios and edge cases.

#### Test Cases:

```javascript
describe('Target Validation Edge Cases', () => {
  it('should handle actions with both actor and target forbidden components', () => {
    // Test combined validation logic
  });

  it('should handle malformed component data gracefully', () => {
    // Test error handling for corrupted component data
  });

  it('should handle entity state changes during validation', () => {
    // Test concurrent modification scenarios
  });

  it('should validate all target roles in multi-target actions', () => {
    // Test primary, secondary, tertiary validation
  });
});
```

### Test Execution Strategy

1. **Unit Tests First**: Validate core logic in isolation
2. **Integration Tests**: Test pipeline integration and real scenarios
3. **Performance Tests**: Ensure acceptable performance characteristics
4. **Regression Tests**: Verify no existing functionality is broken
5. **Edge Case Coverage**: Handle unusual but possible scenarios

### Success Criteria

- ✅ All unit tests pass with >95% code coverage
- ✅ Integration tests demonstrate correct positioning behavior
- ✅ Performance tests show <15ms validation overhead
- ✅ Regression tests confirm no existing functionality breaks
- ✅ Edge case tests handle error conditions gracefully

## Implementation Roadmap

### Phase 1: Core Schema Enhancement (Weeks 1-2)

1. **Schema Definition Update**: Modify `data/schemas/action.schema.json` to support target forbidden components
2. **Validation Logic Implementation**: Create `TargetComponentValidator` class with core validation methods
3. **Pipeline Integration**: Add `TargetComponentValidationStage` to action discovery pipeline
4. **Unit Test Coverage**: Implement comprehensive unit tests for validation logic

### Phase 2: Engine Integration (Weeks 3-4)

1. **Pipeline Stage Registration**: Integrate new validation stage into main pipeline
2. **Multi-Target Support**: Implement role-specific validation for primary/secondary/tertiary targets
3. **Performance Optimization**: Add validation caching and performance monitoring
4. **Integration Test Implementation**: Create end-to-end integration tests

### Phase 3: Validation & Deployment (Week 5)

1. **Positioning Action Updates**: Update `kneel_before` action to use target forbidden components
2. **Regression Testing**: Comprehensive testing to ensure no existing functionality breaks
3. **Performance Validation**: Confirm validation overhead meets performance requirements
4. **Documentation Updates**: Update action authoring guidelines and architecture documentation

### Related Actions Analysis

**Actions Requiring Similar Target Validation**:

1. **`positioning:turn_around_to_face`**: Should validate target facing states and positioning compatibility
2. **`positioning:get_close`**: May need proximity and positioning state validation
3. **`positioning:place_yourself_behind`**: Requires target standing state and spatial compatibility
4. **`intimacy:kiss`**: Already has positioning conflict detection, could benefit from schema-based approach

**Implementation Pattern**:

```json
{
  "id": "positioning:turn_around_to_face",
  "forbidden_components": {
    "actor": ["positioning:facing_away"],
    "target": ["positioning:facing_away", "positioning:kneeling_before"]
  }
}
```

## Conclusion

The positioning target validation gap requires a comprehensive solution through **Action Schema Enhancement**. This approach addresses the root architectural limitation by extending the action schema to support target component validation, providing a systematic solution that scales across all actions in the system.

**Key Benefits of Schema Enhancement**:

- **Comprehensive**: Solves target validation for all current and future actions
- **Declarative**: Clean, maintainable action definitions with explicit validation rules
- **Performance Efficient**: Validation integrated into existing pipeline with minimal overhead
- **Future-Proof**: Extensible foundation for additional validation features

**Immediate Implementation Required**:

1. **Schema Enhancement**: Extend `forbidden_components` to support target roles
2. **Pipeline Integration**: Add `TargetComponentValidationStage` to action discovery
3. **Validation Logic**: Implement `TargetComponentValidator` class
4. **Comprehensive Testing**: Execute full test suite to ensure robustness

**Success Metrics**:

- ✅ **Functional**: kneel_before action properly validates target positioning states
- ✅ **Performance**: <15ms validation overhead for multi-target actions
- ✅ **Compatibility**: Zero breaking changes to existing action definitions
- ✅ **Quality**: >95% test coverage with comprehensive edge case handling

**Long-term Impact**:
This enhancement establishes a robust foundation for declarative action validation, enabling game designers to specify complex target requirements without custom scope or condition implementations. The pattern can be extended to support additional validation types (required target components, component value constraints, etc.) as the system evolves.

---

**Files To Be Modified**:

- `data/schemas/action.schema.json` - Schema definition enhancement
- `src/actions/pipeline/stages/TargetComponentValidationStage.js` - New validation stage
- `src/actions/pipeline/Pipeline.js` - Pipeline stage registration
- `data/mods/deference/actions/kneel_before.action.json` - Updated with target validation
- Multiple test files as specified in test specifications

**Files Referenced for Analysis**:

- `src/actions/actionIndex.js` - Current actor component filtering implementation
- `src/actions/pipeline/stages/ComponentFilteringStage.js` - Actor validation patterns
- `src/actions/pipeline/stages/TargetResolutionStage.js` - Target resolution pipeline
- `tests/integration/mods/positioning/kneel_before_action.test.js` - Existing test patterns
- `tests/integration/actions/forbiddenComponents.integration.test.js` - Component validation tests
