# GOAPIMPL-010: Refinement State Manager

**Priority**: HIGH
**Estimated Effort**: 2-3 hours
**Dependencies**: GOAPIMPL-007 (Context Assembly), GOAPIMPL-008 (Parameter Resolution)

## Description

Create RefinementStateManager that maintains `refinement.localState` during method execution. Handles state accumulation with the `storeResultAs` pattern and provides state access for conditions and parameters.

The refinement.localState is a mutable accumulator that stores intermediate results during refinement method execution. Each step can store its result, and subsequent steps can reference those stored values.

## Acceptance Criteria

- [ ] Manages `refinement.localState` as mutable accumulator object
- [ ] Supports `storeResultAs` pattern for action results
- [ ] Provides immutable state snapshot for condition evaluation
- [ ] Clears state between refinement method executions
- [ ] Handles state updates atomically (no partial updates)
- [ ] Provides state inspection API for debugging
- [ ] Thread-safe if needed for concurrent refinements
- [ ] 90%+ test coverage

## Files to Create

### Main Implementation
- `src/goap/refinement/refinementStateManager.js` - State manager service

### Tests
- `tests/unit/goap/refinement/refinementStateManager.test.js` - Unit tests

## Files to Modify

### Dependency Injection
- `src/dependencyInjection/tokens/tokens-core.js` - Add `IRefinementStateManager` token
- `src/dependencyInjection/registrations/goapRegistrations.js` - Register service

## Testing Requirements

### Unit Tests
- [ ] Test state initialization (empty object)
- [ ] Test state accumulation with `storeResultAs`
- [ ] Test state snapshot immutability
- [ ] Test state clearing between methods
- [ ] Test state inspection API
- [ ] Test concurrent state management (if applicable)
- [ ] Test state updates with various value types
- [ ] Test state retrieval for parameter resolution

## State Lifecycle

### Initialization
```javascript
// Start of refinement method execution
refinement.localState = {}
```

### Accumulation (via storeResultAs)
```javascript
// After step 1 executes
refinement.localState.pickedItem = "entity-123"

// After step 2 executes
refinement.localState.targetLocation = "entity-456"

// State grows throughout execution
```

### Snapshot (for conditions)
```javascript
// When evaluating conditional step
const stateSnapshot = manager.getSnapshot();
// stateSnapshot is immutable copy
// mutations don't affect original state
```

### Clearing (between methods)
```javascript
// After method completes
manager.clear();
// refinement.localState = {}
```

## API Design

### RefinementStateManager Interface
```javascript
class RefinementStateManager {
  // Initialize new state
  initialize();

  // Store result from step execution
  store(key, value);

  // Get current state (mutable reference)
  getState();

  // Get immutable snapshot for conditions
  getSnapshot();

  // Clear all state
  clear();

  // Check if key exists
  has(key);

  // Get specific value
  get(key);

  // Debugging: serialize state
  toJSON();
}
```

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` lines 73-85 - Example refinement showing state accumulation

### Implementation Guides
- `docs/goap/refinement-parameter-binding.md` - `refinement.localState` as parameter source

### Schema References
- `data/schemas/refinement-method.schema.json` - See `storeResultAs` field in step definitions

### Examples
- `data/mods/core/tasks/refinement-methods/*.refinement.json` - Search for `storeResultAs` usage

## Implementation Notes

### State Visibility
- State is scoped to single refinement method execution
- State does NOT persist across different method executions
- State is NOT shared between different actors

### State Update Semantics
- Updates are immediate (not deferred)
- Duplicate keys overwrite previous values
- Storing null/undefined is allowed

### Snapshot Immutability
The snapshot returned by `getSnapshot()` must be:
- Deep copy of current state
- Frozen (Object.freeze) to prevent mutations
- Safe to pass to condition evaluation

### Performance Considerations
- State updates should be O(1)
- Snapshot creation is O(n) where n = number of keys
- Consider shallow copy if state values are primitives
- Deep copy required if state values are objects/arrays

### Integration Points
- Used by StepExecutorService (GOAPIMPL-012) to store action results
- Used by ConditionalStepExecutor (GOAPIMPL-013) for condition context
- Used by ParameterResolutionService (GOAPIMPL-008) for parameter binding

## Success Validation

✅ **Done when**:
- All unit tests pass with 90%+ coverage
- State accumulation works correctly across multiple steps
- Snapshots are truly immutable
- State clears properly between executions
- Service integrates with DI container
- Documentation explains state lifecycle and API
