# Complex Prerequisite Chains E2E Test Specification

## Overview

This specification defines requirements and implementation guidelines for comprehensive end-to-end testing of complex prerequisite chains in the Living Narrative Engine. The tests will validate how the action system evaluates nested and dynamic prerequisites, ensures proper condition reference resolution, prevents circular dependencies, and maintains performance under complex logic scenarios.

### Purpose

The Living Narrative Engine uses JSON Logic-based prerequisites to determine when actions are available. These prerequisites can reference other conditions through `condition_ref`, creating complex chains of logic that must be properly tested to ensure reliable action discovery and validation.

### Scope

This specification covers:
- Nested prerequisite condition evaluation
- Dynamic prerequisite evaluation based on game state
- Condition reference (`condition_ref`) resolution
- Circular prerequisite detection and prevention
- Performance monitoring for complex logic trees
- Context building and component access patterns
- Integration with the action discovery pipeline

## Architecture Overview

### Prerequisite Evaluation Flow

```
Action Discovery → Component Filtering → Prerequisite Evaluation
                                               ↓
                                     ActionValidationContextBuilder
                                               ↓
                                     Build Evaluation Context
                                               ↓
                                     PrerequisiteEvaluationService
                                               ↓
                                     Resolve condition_ref → Circular Check
                                               ↓
                                     JsonLogicEvaluationService
                                               ↓
                                     Evaluate Logic → Pass/Fail
```

### Key Components

1. **PrerequisiteEvaluationService** (`src/actions/validation/prerequisiteEvaluationService.js`)
   - Orchestrates prerequisite evaluation
   - Resolves `condition_ref` recursively
   - Detects circular references
   - Integrates with JsonLogic evaluation

2. **ActionValidationContextBuilder** (`src/actions/validation/actionValidationContextBuilder.js`)
   - Builds evaluation context from entities
   - Provides component data access
   - Creates actor context for JsonLogic rules

3. **JsonLogicEvaluationService** (`src/logic/jsonLogicEvaluationService.js`)
   - Evaluates JSON Logic rules
   - Supports custom operators
   - Validates allowed operations

4. **ConditionRefResolver** (`src/utils/conditionRefResolver.js`)
   - Recursively resolves condition references
   - Tracks visited conditions for circular detection
   - Integrates with GameDataRepository

5. **PrerequisiteEvaluationStage** (`src/actions/pipeline/stages/PrerequisiteEvaluationStage.js`)
   - Pipeline stage for prerequisite filtering
   - Processes candidate actions
   - Handles errors gracefully

## Test Scenarios

### 1. Nested Prerequisite Conditions

#### 1.1 Multi-Level Condition References
**Scenario**: Action prerequisites reference conditions that reference other conditions
```json
// Action: complex_ritual
"prerequisites": [{
  "logic": {
    "and": [
      { "condition_ref": "magic:has_magic_ability" },
      { "condition_ref": "magic:ritual_requirements_met" }
    ]
  }
}]

// Condition: magic:ritual_requirements_met
{
  "logic": {
    "and": [
      { "condition_ref": "magic:has_spell_components" },
      { "condition_ref": "environment:proper_location" },
      { ">=": [{ "var": "actor.components.magic:power.level" }, 5] }
    ]
  }
}

// Condition: magic:has_spell_components
{
  "logic": {
    "all": [
      { "var": "actor.components.inventory:items" },
      { "in": [{ "var": "type" }, ["herb", "crystal", "essence"]] }
    ]
  }
}
```

**Test Requirements**:
- Verify 3+ levels of condition resolution
- Validate each level evaluates correctly
- Ensure context propagates through all levels
- Track resolution performance

#### 1.2 Mixed Logic and References
**Scenario**: Prerequisites combine direct logic with condition references
```json
"prerequisites": [{
  "logic": {
    "and": [
      { "condition_ref": "core:actor-can-move" },
      { 
        "or": [
          { "condition_ref": "combat:is_aggressive_stance" },
          { ">": [{ "var": "actor.components.stats:strength.value" }, 15] }
        ]
      },
      { "!": { "condition_ref": "status:is_exhausted" } }
    ]
  },
  "failure_message": "You must be able to move and either be aggressive or strong enough"
}]
```

**Test Requirements**:
- Verify mixed evaluation of references and direct logic
- Test all logical branches
- Validate failure messages propagate correctly

### 2. Dynamic Prerequisite Evaluation

#### 2.1 Component-Based Dynamic Checks
**Scenario**: Prerequisites that adapt based on entity components
```json
"prerequisites": [{
  "logic": {
    "if": [
      { "var": "actor.components.magic:class" },
      { "condition_ref": "magic:spell_prerequisites" },
      { "condition_ref": "physical:strength_prerequisites" }
    ]
  }
}]
```

**Test Requirements**:
- Test with entities having different component configurations
- Verify correct branch selection based on components
- Validate both paths evaluate correctly

#### 2.2 State-Dependent Chains
**Scenario**: Prerequisites that check game state and entity relationships
```json
"prerequisites": [{
  "logic": {
    "and": [
      { "condition_ref": "social:has_relationship" },
      {
        "if": [
          { ">=": [{ "var": "actor.components.social:reputation.value" }, 50] },
          { "condition_ref": "social:trusted_actions" },
          { "condition_ref": "social:basic_actions" }
        ]
      }
    ]
  }
}]
```

**Test Requirements**:
- Test with varying reputation values
- Verify different condition paths based on state
- Ensure relationship checks work correctly

### 3. Circular Reference Detection

#### 3.1 Direct Circular Reference
**Scenario**: Condition A references Condition B which references Condition A
```json
// Condition: test:circular_a
{
  "logic": {
    "and": [
      { "var": "actor.components.test:value" },
      { "condition_ref": "test:circular_b" }
    ]
  }
}

// Condition: test:circular_b
{
  "logic": {
    "or": [
      { "condition_ref": "test:circular_a" },
      { "var": "actor.components.test:override" }
    ]
  }
}
```

**Test Requirements**:
- Verify circular reference is detected
- Ensure helpful error message with path
- Validate system doesn't crash or hang
- Test recovery after circular detection

#### 3.2 Indirect Circular Reference
**Scenario**: A → B → C → A circular chain
```json
// Three or more conditions creating a circular dependency
```

**Test Requirements**:
- Detect indirect circular references
- Show complete circular path in error
- Ensure all intermediate conditions are tracked

### 4. Performance with Complex Logic

#### 4.1 Deep Nesting Performance
**Scenario**: Prerequisites with 10+ levels of nesting
```json
"prerequisites": [{
  "logic": {
    "and": [
      { "condition_ref": "level1" },
      {
        "or": [
          { "condition_ref": "level2a" },
          { "condition_ref": "level2b" }
        ]
      }
      // ... continuing to level 10+
    ]
  }
}]
```

**Test Requirements**:
- Measure evaluation time for deep nesting
- Set performance benchmarks (<100ms for 10 levels)
- Test with multiple actors simultaneously
- Monitor memory usage

#### 4.2 Wide Logic Trees
**Scenario**: Prerequisites with many parallel conditions
```json
"prerequisites": [{
  "logic": {
    "and": [
      // 20+ condition references at same level
      { "condition_ref": "check1" },
      { "condition_ref": "check2" },
      // ... up to check20
    ]
  }
}]
```

**Test Requirements**:
- Verify all conditions are evaluated
- Test short-circuit optimization
- Monitor performance with parallel evaluation

### 5. Error Handling and Recovery

#### 5.1 Missing Condition References
**Scenario**: Prerequisite references non-existent condition
```json
"prerequisites": [{
  "logic": {
    "condition_ref": "missing:condition_id"
  }
}]
```

**Test Requirements**:
- Graceful error handling
- Clear error messages
- Action marked as unavailable
- System continues functioning

#### 5.2 Malformed Logic
**Scenario**: Invalid JSON Logic in prerequisites
```json
"prerequisites": [{
  "logic": {
    "invalid_operator": [{ "var": "test" }]
  }
}]
```

**Test Requirements**:
- Detect invalid operators
- Provide helpful error context
- Continue processing other actions

## Implementation Guidelines

### Test Structure

```javascript
describe('Complex Prerequisite Chains E2E', () => {
  let facades;
  let testEntities;
  
  beforeEach(async () => {
    facades = await createMockFacades();
    testEntities = await setupTestEntities();
    await setupComplexConditions();
  });

  describe('Nested Prerequisite Conditions', () => {
    test('should resolve multi-level condition references', async () => {
      // Implementation
    });
    
    test('should handle mixed logic and references', async () => {
      // Implementation
    });
  });

  describe('Dynamic Prerequisite Evaluation', () => {
    test('should evaluate based on entity components', async () => {
      // Implementation
    });
    
    test('should handle state-dependent chains', async () => {
      // Implementation
    });
  });

  describe('Circular Reference Detection', () => {
    test('should detect direct circular references', async () => {
      // Implementation
    });
    
    test('should detect indirect circular references', async () => {
      // Implementation
    });
  });

  describe('Performance', () => {
    test('should handle deep nesting efficiently', async () => {
      // Implementation with performance measurements
    });
    
    test('should handle wide logic trees efficiently', async () => {
      // Implementation with performance measurements
    });
  });

  describe('Error Scenarios', () => {
    test('should handle missing condition references', async () => {
      // Implementation
    });
    
    test('should handle malformed logic', async () => {
      // Implementation
    });
  });
});
```

### Key Testing Utilities

1. **Condition Setup Helper**
```javascript
function setupTestCondition(id, logic) {
  const registry = facades.container.resolve(tokens.IDataRegistry);
  registry.store('conditions', id, {
    id,
    description: `Test condition ${id}`,
    logic
  });
}
```

2. **Prerequisite Evaluation Helper**
```javascript
async function evaluateActionPrerequisites(actionId, actorId) {
  const discoveryService = facades.container.resolve(tokens.IActionDiscoveryService);
  const actions = await discoveryService.discoverAvailableActions(actorId);
  return actions.find(a => a.id === actionId);
}
```

3. **Performance Measurement**
```javascript
function measurePrerequisitePerformance(actionDef, actor, iterations = 100) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    prereqService.evaluate(actionDef.prerequisites, actionDef, actor);
  }
  const end = performance.now();
  return (end - start) / iterations;
}
```

### Assertions and Validations

1. **Trace Validation**: Use TraceContext to verify evaluation paths
2. **Error Context**: Validate error messages and recovery
3. **Performance Metrics**: Assert evaluation times stay within bounds
4. **State Verification**: Check final entity states after evaluation

### Integration Points

The test suite must integrate with:
- ActionDiscoveryService for end-to-end validation
- GameDataRepository for condition storage
- EntityManager for component access
- EventBus for action execution effects
- TraceContext for detailed logging

## Success Criteria

1. **Functionality**
   - All nested conditions resolve correctly
   - Dynamic evaluation works based on game state
   - Circular references are detected and reported
   - Error handling is graceful and informative

2. **Performance**
   - 10-level deep nesting evaluates in <100ms
   - 20-wide condition trees evaluate in <200ms
   - No memory leaks with repeated evaluation
   - Efficient caching of resolved conditions

3. **Reliability**
   - 100% test coverage for prerequisite evaluation paths
   - No race conditions in concurrent evaluation
   - Consistent results across multiple runs
   - Proper cleanup after errors

4. **Developer Experience**
   - Clear error messages for debugging
   - Comprehensive trace logging
   - Well-documented test cases
   - Reusable test utilities

## Future Considerations

1. **Async Prerequisites**: Support for async condition evaluation
2. **Prerequisite Caching**: Cache complex evaluation results
3. **Parallel Evaluation**: Evaluate independent conditions in parallel
4. **Custom Operators**: Support for game-specific JsonLogic operators
5. **Prerequisite Visualization**: Tools to visualize prerequisite chains