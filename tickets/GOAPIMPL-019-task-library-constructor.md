# GOAPIMPL-019: Task Library Constructor

**Priority**: HIGH
**Estimated Effort**: 2-3 hours
**Dependencies**: GOAPIMPL-007 (Context Assembly), GOAPIMPL-018 (GOAP Planner)

## Description

Create TaskLibraryConstructor that builds per-actor task libraries by evaluating structural gates. Filters tasks to only those relevant for specific actor/situation before planning.

Task library construction is an optimization: instead of considering all tasks during planning, we pre-filter to only those the actor can potentially use.

## Acceptance Criteria

- [ ] Evaluates structural gates for all loaded tasks
- [ ] Builds filtered task library for actor
- [ ] Caches libraries for performance (per actor)
- [ ] Logs library construction for debugging
- [ ] Handles structural gate evaluation errors gracefully
- [ ] Invalidates cache when actor capabilities change
- [ ] Returns tasks with evaluated applicability
- [ ] 90%+ test coverage

## Files to Create

### Main Implementation
- `src/goap/planner/taskLibraryConstructor.js` - Library constructor

### Tests
- `tests/unit/goap/planner/taskLibraryConstructor.test.js` - Unit tests
- `tests/integration/goap/taskLibrary.integration.test.js` - Integration tests

## Files to Modify

### Dependency Injection
- `src/dependencyInjection/tokens/tokens-core.js` - Add `ITaskLibraryConstructor` token
- `src/dependencyInjection/registrations/goapRegistrations.js` - Register service

## Testing Requirements

### Unit Tests
- [ ] Test library construction with various actors
- [ ] Test structural gate filtering
- [ ] Test library caching
- [ ] Test cache invalidation
- [ ] Test with all example tasks
- [ ] Test error handling for invalid gates
- [ ] Test empty library (no applicable tasks)

### Integration Tests
- [ ] Test with real actor components
- [ ] Test structural gates with real entity data
- [ ] Test library construction performance
- [ ] Test cache hit/miss rates
- [ ] Test multi-actor scenarios

## Task Library Construction

### Process Flow
```javascript
constructLibrary(actor, allTasks) {
  // 1. Check cache
  const cacheKey = `${actor.id}:${actor.capabilitiesHash}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  // 2. Filter by structural gates
  const applicableTasks = allTasks.filter(task => {
    if (!task.structuralGates) {
      return true;  // No gates = always applicable
    }

    return task.structuralGates.every(gate =>
      evaluateStructuralGate(gate, actor)
    );
  });

  // 3. Cache result
  cache.set(cacheKey, applicableTasks);

  return applicableTasks;
}
```

### Structural Gate Evaluation
```javascript
evaluateStructuralGate(gate, actor) {
  // Gates use JSON Logic with actor context
  const context = {
    actor: {
      id: actor.id,
      components: actor.components
    }
  };

  return jsonLogic.evaluate(gate, context);
}
```

## Structural Gates

### Purpose
Structural gates check actor **capabilities**, not world state:
- "Does actor have hunger system?" (capability)
- vs "Is actor currently hungry?" (world state - not a gate)

### Examples from Task Schema
```json
{
  "structuralGates": [
    {
      "var": "actor.components.core:hunger"
    }
  ]
}
```

This task only applies to actors with hunger system.

### Gate Types

**Component Existence**:
```json
{ "var": "actor.components.core:hunger" }
```

**Component Property Check**:
```json
{
  "==": [
    { "var": "actor.components.core:species.value" },
    "human"
  ]
}
```

**Complex Gates**:
```json
{
  "and": [
    { "var": "actor.components.core:hunger" },
    { "var": "actor.components.core:inventory" }
  ]
}
```

## Caching Strategy

### Cache Key Generation
```javascript
// Include actor capabilities in key
const capabilitiesHash = hashComponents([
  'core:hunger',
  'core:inventory',
  'core:species'
  // ... all relevant components
]);

const cacheKey = `${actor.id}:${capabilitiesHash}`;
```

### Cache Invalidation
Invalidate cache when:
- Actor gains/loses components
- Actor capabilities change
- Task definitions change (reload)

### Cache Performance
- Hit rate target: 90%+ (actors rarely change capabilities)
- Cache size: Small (one entry per unique capability set)
- Eviction: LRU or time-based

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` lines 196-207 - **PRIMARY REFERENCE** - Task library construction

### Schema References
- `data/schemas/task.schema.json` - See `structuralGates` field

### Examples
- `data/mods/core/tasks/*.task.json` - Tasks with structural gates

## Implementation Notes

### Structural Gates vs Preconditions

**Structural Gates**:
- Evaluate **once** per actor (cached)
- Check actor **capabilities**
- Run before planning
- Fast filtering

**Preconditions**:
- Evaluate **every planning step**
- Check **world state**
- Run during planning
- Determine task applicability

### Performance Impact
Library construction reduces planning complexity:
```
Without library: O(all_tasks × planning_steps)
With library: O(applicable_tasks × planning_steps)

If library filters 50% of tasks → 2× speedup
```

### Error Handling
If structural gate evaluation fails:
1. Log warning with gate and actor
2. Treat task as "not applicable" (safe default)
3. Continue with other tasks

### Library Statistics
Track for debugging:
- Total tasks loaded
- Tasks in actor library
- Filter rate (%)
- Cache hit rate (%)
- Evaluation time

Log example:
```
[TaskLibrary] Constructed library for actor-123
  Total tasks: 50
  Applicable: 23 (46%)
  Cache: MISS
  Time: 12ms
```

## Integration Points

### Required Services (inject)
- `ITaskLoader` - Get all loaded tasks
- `IJsonLogicService` - Evaluate structural gates
- `ILogger` - Logging

### Used By (future)
- GOAPIMPL-018 (GOAP Planner) - Get applicable tasks for actor

## Success Validation

✅ **Done when**:
- All unit tests pass with 90%+ coverage
- Integration tests validate library construction with real actors
- Caching works correctly with cache key generation
- Structural gate evaluation handles all edge cases
- Library construction is fast (< 50ms for 100 tasks)
- Service integrates with DI container
- Documentation explains structural gates and caching strategy
