# GOAPIMPL-016: Planning Effects Simulator

**Priority**: HIGH
**Estimated Effort**: 3-4 hours
**Dependencies**: GOAPIMPL-007 (Context Assembly)

## Description

Create PlanningEffectsSimulator that applies planning effects to world state during planning search. Uses operation handlers to simulate state changes without actually executing them.

The effects simulator is how the planner predicts what will happen if a task is executed - it applies the task's planning effects to create a successor state in the search space.

## Acceptance Criteria

- [ ] Applies operation effects to state snapshot (immutable simulation)
- [ ] Supports all operation types (ADD_COMPONENT, MODIFY_COMPONENT, REMOVE_COMPONENT, etc.)
- [ ] Creates new state instance (doesn't mutate input state)
- [ ] Validates operation parameters before simulation
- [ ] Handles operation simulation failures gracefully
- [ ] Logs simulation process for debugging
- [ ] Returns simulated state and operation results
- [ ] 90%+ test coverage

## Files to Create

### Main Implementation
- `src/goap/planner/planningEffectsSimulator.js` - Effects simulator

### Tests
- `tests/unit/goap/planner/planningEffectsSimulator.test.js` - Unit tests
- `tests/integration/goap/effectsSimulation.integration.test.js` - Integration tests

## Files to Modify

### Dependency Injection
- `src/dependencyInjection/tokens/tokens-core.js` - Add `IPlanningEffectsSimulator` token
- `src/dependencyInjection/registrations/goapRegistrations.js` - Register service

## Testing Requirements

### Unit Tests
- [ ] Test ADD_COMPONENT simulation
- [ ] Test MODIFY_COMPONENT simulation
- [ ] Test REMOVE_COMPONENT simulation
- [ ] Test operation sequence simulation
- [ ] Test state immutability (original state unchanged)
- [ ] Test invalid operation handling
- [ ] Test operation parameter validation
- [ ] Test simulation with mock operation handlers

### Integration Tests
- [ ] Test simulation with real operation handlers
- [ ] Test simulation with real entity components
- [ ] Test simulation with complex operation sequences
- [ ] Test state correctness after simulation
- [ ] Test error handling with invalid operations

## Planning Effects Structure

### From Task Schema
```json
{
  "planningEffects": [
    {
      "type": "MODIFY_COMPONENT",
      "parameters": {
        "entity": "actor",
        "componentId": "core:hungry",
        "updates": {
          "value": false
        }
      }
    },
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity": "actor",
        "componentId": "core:satiated"
      }
    }
  ]
}
```

## Simulation Process

### High-Level Algorithm
```javascript
simulateEffects(currentState, planningEffects, context) {
  // 1. Clone current state (immutable simulation)
  const newState = deepClone(currentState);

  // 2. Apply each operation
  for (const effect of planningEffects) {
    // 3. Resolve operation parameters (entity refs, etc.)
    const resolvedParams = resolveOperationParameters(
      effect.parameters,
      context
    );

    // 4. Simulate operation on cloned state
    const operationResult = simulateOperation(
      effect.type,
      resolvedParams,
      newState
    );

    // 5. Update state with operation results
    applyOperationToState(newState, operationResult);
  }

  // 6. Return new state
  return newState;
}
```

### Operation Simulation
```javascript
simulateOperation(operationType, parameters, state) {
  switch (operationType) {
    case 'ADD_COMPONENT':
      // Simulate: Add component to entity in state
      state[`${parameters.entity}:${parameters.componentId}`] =
        parameters.initialData || {};
      break;

    case 'MODIFY_COMPONENT':
      // Simulate: Update component properties in state
      const key = `${parameters.entity}:${parameters.componentId}`;
      state[key] = { ...state[key], ...parameters.updates };
      break;

    case 'REMOVE_COMPONENT':
      // Simulate: Remove component from entity in state
      delete state[`${parameters.entity}:${parameters.componentId}`];
      break;

    // Handle other operation types...
  }

  return { success: true, state };
}
```

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` lines 232-233 - Planning effects use operation system

### Schema References
- `data/schemas/task.schema.json` - See `planningEffects` field
- `data/schemas/operation.schema.json` - Operation structure

### Operation System
- `src/logic/operationHandlers/` - Existing operation handlers (54 handlers)
- Operation schemas in `data/schemas/operations/`

## Implementation Notes

### Immutability Requirement
**CRITICAL**: Never mutate input state
```javascript
// ❌ WRONG - mutates input
function simulate(state, effects) {
  state.prop = newValue;  // BAD
  return state;
}

// ✅ CORRECT - creates new state
function simulate(state, effects) {
  const newState = deepClone(state);
  newState.prop = newValue;  // GOOD
  return newState;
}
```

### State Representation
World state in planning is symbolic:
```javascript
{
  "entity-123:core:hungry": true,
  "entity-123:core:health": 50,
  "entity-456:core:located_at": "room-1"
}
```

After ADD_COMPONENT simulation:
```javascript
{
  "entity-123:core:hungry": true,
  "entity-123:core:health": 50,
  "entity-456:core:located_at": "room-1",
  "entity-123:core:satiated": {}  // NEW
}
```

### Parameter Resolution
Operation parameters may reference:
- `"actor"` → current actor entity ID
- `"task.params.item"` → task parameter values
- Literal values

Use ParameterResolutionService (GOAPIMPL-008) for resolution.

### Error Handling
If operation simulation fails:
1. Log error with operation details
2. Return original state (no changes)
3. Mark simulation as failed
4. Don't throw exception (allows planner to try other tasks)

### Performance Optimization
- Shallow clone state where possible
- Cache operation handler results
- Batch similar operations
- Consider copy-on-write optimization

### Simulation vs Execution
**Simulation** (planning-time):
- No side effects
- No events dispatched
- No actual component changes
- Fast, optimistic

**Execution** (runtime):
- Side effects occur
- Events dispatched
- Actual component changes
- Slower, validated

## Integration Points

### Required Services (inject)
- `IParameterResolutionService` (GOAPIMPL-008) - Resolve parameters
- `ILogger` - Logging

### Optional Services
- Operation handler registry (if separate from logic system)

### Used By (future)
- GOAPIMPL-018 (GOAP Planner) - Generate successor states

## Success Validation

✅ **Done when**:
- All unit tests pass with 90%+ coverage
- Integration tests validate simulation with real operations
- State immutability is guaranteed
- All operation types are supported
- Error handling is robust
- Service integrates with DI container
- Documentation explains simulation process and state representation
