# GOAPIMPL-018-04: Parameter Binding via Scopes

**Parent Ticket**: GOAPIMPL-018 (GOAP A* Algorithm)
**Priority**: HIGH
**Estimated Effort**: 2 hours
**Dependencies**: GOAPIMPL-018-02 (evaluation context), GOAPIMPL-018-03 (task library)

## Description

Implement parameter binding for planning tasks using IScopeEngine to resolve scope definitions and bind abstract task parameters to concrete entity IDs.

## Acceptance Criteria

- [ ] Resolves planning scope via IScopeEngine
- [ ] Binds task parameters from scope results
- [ ] Handles binding failures gracefully (returns null)
- [ ] Builds proper runtimeCtx from planning state
- [ ] Uses optimistic binding strategy (first candidate)
- [ ] Logs binding successes and failures at debug level
- [ ] 90%+ test coverage

## Files to Modify

- `src/goap/planner/goapPlanner.js` - Add `#bindTaskParameters()` and `#getApplicableTasks()` (~120 lines)

## Testing Requirements

Tests in `tests/unit/goap/planner/goapPlanner.parameterBinding.test.js`:
1. Successfully binds parameters from scope
2. Returns null when scope empty
3. Returns null when scope evaluation fails
4. Handles missing planning scope definition
5. Builds correct runtimeCtx
6. Uses first entity (optimistic strategy)
7. Logs appropriately

## Key Implementation Pattern

```javascript
#bindTaskParameters(task, state, actorId) {
  const scopeId = task.planningScope;
  const scopeDef = this.#gameDataRepository.getScope(scopeId);

  const runtimeCtx = {
    entityManager: this.#entityManager,
    jsonLogicEval: this.#jsonLogicService,
    logger: this.#logger
  };

  const scopeResult = this.#scopeEngine.resolve(
    scopeDef.ast,
    actorEntity,
    runtimeCtx,
    trace
  );

  // Extract first entity (optimistic)
  const boundParams = {};
  const iterator = scopeResult.values();
  const first = iterator.next();
  if (!first.done) {
    boundParams[task.parameterName] = first.value;
  } else {
    return null; // No bindings available
  }

  return boundParams;
}
```

---

**Next Ticket**: GOAPIMPL-018-05 (A* Search Algorithm)
