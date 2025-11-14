# GOAPIMPL-018-06: Dependency Injection Registration

**Parent Ticket**: GOAPIMPL-018 (GOAP A* Algorithm)
**Priority**: MEDIUM
**Estimated Effort**: 30 minutes
**Dependencies**: GOAPIMPL-018-05 (GoapPlanner implementation)

## Description

Register GoapPlanner in the dependency injection container with proper token definition and service configuration.

## Acceptance Criteria

- [ ] Token `IGoapPlanner` added to tokens-core.js
- [ ] GoapPlanner registered in goapRegistrations.js
- [ ] All 7 dependencies correctly injected
- [ ] Singleton lifecycle configured
- [ ] Service resolves successfully from container
- [ ] No circular dependencies

## Files to Modify

### 1. Add Token Definition
**File**: `src/dependencyInjection/tokens/tokens-core.js`

Add after line 347 (after IHeuristicRegistry):
```javascript
// GOAP Planner (GOAPIMPL-018)
IGoapPlanner: 'IGoapPlanner',
```

### 2. Register Service
**File**: `src/dependencyInjection/registrations/goapRegistrations.js`

Add after HeuristicRegistry registration:
```javascript
// GOAP Planner (GOAPIMPL-018)
// A* search planner for goal-directed task sequence planning
// Evaluates tasks against world state and constructs optimal plans
container.register(tokens.IGoapPlanner, GoapPlanner, {
  dependencies: [
    tokens.IPlanningEffectsSimulator,
    tokens.IHeuristicRegistry,
    tokens.GameDataRepository,
    tokens.IScopeEngine,
    tokens.JsonLogicEvaluationService,
    tokens.IEntityManager,
    tokens.ILogger,
  ],
  lifecycle: 'singleton',
});
```

### 3. Add Import
Add to imports section:
```javascript
import GoapPlanner from '../planner/goapPlanner.js';
```

## Testing Requirements

Tests in `tests/unit/dependencyInjection/goapRegistrations.test.js`:
1. IGoapPlanner token resolves to GoapPlanner instance
2. All dependencies injected correctly
3. Singleton lifecycle (same instance returned)
4. No circular dependency errors

## Success Validation

✅ **Done when**:
- Token defined in tokens-core.js
- Service registered in goapRegistrations.js
- Import added
- Container resolves GoapPlanner successfully
- Tests pass

---

**Next Ticket**: GOAPIMPL-018-07 (Unit Tests)
