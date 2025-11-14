# GOAPIMPL-018 Workflow Overview

**Original Ticket**: GOAPIMPL-018 (GOAP A* Algorithm - CORRECTED)
**Total Estimated Effort**: 7-7.5 hours
**Created**: 2025-11-14

## Summary

The GOAPIMPL-018 ticket has been decomposed into 8 focused, actionable sub-tickets. Each ticket is self-contained with clear acceptance criteria, implementation details, and testing requirements.

## Workflow Execution Order

```
GOAPIMPL-018-01 (MinHeap)
       ↓
GOAPIMPL-018-02 (State Management Helpers)
       ↓
GOAPIMPL-018-03 (Task Library Construction)
       ↓
GOAPIMPL-018-04 (Parameter Binding)
       ↓
GOAPIMPL-018-05 (A* Search Algorithm) ← Core integration point
       ↓
GOAPIMPL-018-06 (DI Registration)
       ↓
GOAPIMPL-018-07 (Unit Tests)
       ↓
GOAPIMPL-018-08 (Integration Tests)
```

## Sub-Tickets

### GOAPIMPL-018-01: MinHeap Implementation
- **File**: `tickets/GOAPIMPL-018-01-minheap-implementation.md`
- **Effort**: 1-1.5 hours
- **Dependencies**: None
- **Deliverable**: Binary min-heap for A* open list (~80-100 lines)

### GOAPIMPL-018-02: State Management Helpers
- **File**: `tickets/GOAPIMPL-018-02-state-management-helpers.md`
- **Effort**: 1.5 hours
- **Dependencies**: None
- **Deliverables**:
  - `#hashState()` - State deduplication
  - `#goalSatisfied()` - Goal detection
  - `#buildEvaluationContext()` - Context conversion

### GOAPIMPL-018-03: Task Library Construction
- **File**: `tickets/GOAPIMPL-018-03-task-library-construction.md`
- **Effort**: 1 hour
- **Dependencies**: GOAPIMPL-018-02
- **Deliverable**: `#getTaskLibrary()` - Filter tasks by structural gates

### GOAPIMPL-018-04: Parameter Binding
- **File**: `tickets/GOAPIMPL-018-04-parameter-binding.md`
- **Effort**: 2 hours
- **Dependencies**: GOAPIMPL-018-02, GOAPIMPL-018-03
- **Deliverables**:
  - `#bindTaskParameters()` - Scope-based parameter binding
  - `#getApplicableTasks()` - Precondition filtering

### GOAPIMPL-018-05: A* Search Algorithm
- **File**: `tickets/GOAPIMPL-018-05-astar-search-algorithm.md`
- **Effort**: 2.5 hours
- **Dependencies**: GOAPIMPL-018-01, 02, 03, 04
- **Deliverable**: `plan()` method - Core A* search (~200 lines)

### GOAPIMPL-018-06: DI Registration
- **File**: `tickets/GOAPIMPL-018-06-di-registration.md`
- **Effort**: 30 minutes
- **Dependencies**: GOAPIMPL-018-05
- **Deliverables**:
  - Token definition in `tokens-core.js`
  - Service registration in `goapRegistrations.js`

### GOAPIMPL-018-07: Unit Tests
- **File**: `tickets/GOAPIMPL-018-07-unit-tests.md`
- **Effort**: 1.5 hours
- **Dependencies**: GOAPIMPL-018-01 through 06
- **Deliverables**: 5 test files with 90%+ coverage

### GOAPIMPL-018-08: Integration Tests
- **File**: `tickets/GOAPIMPL-018-08-integration-tests.md`
- **Effort**: 1.5 hours
- **Dependencies**: GOAPIMPL-018-07
- **Deliverable**: Integration test file with real services and tasks

## Key Implementation Insights

### 1. Task Library Source (Resolved)
**Decision**: Use `GameDataRepository` as constructor dependency
- Consistent with existing GOAP services
- Better separation of concerns
- Improved testability

### 2. Scope Context Structure (Resolved)
**Solution**: Build minimal runtimeCtx from planning state
```javascript
{
  entityManager: this.#entityManager,
  jsonLogicEval: this.#jsonLogicService,
  logger: this.#logger,
  container: this.#container // optional
}
```

### 3. Knowledge Limitation (Confirmed)
**Approach**: Scope definitions handle knowledge filtering
- No `core:known_to` checking in planner
- Scopes return only known entities
- Structural gates verify actor has knowledge capability

## Dependencies Map

```
External Dependencies:
- IPlanningEffectsSimulator (GOAPIMPL-016) ✅
- IHeuristicRegistry (GOAPIMPL-017) ✅
- GameDataRepository ✅
- IScopeEngine ✅
- JsonLogicEvaluationService ✅
- IEntityManager ✅
- ILogger ✅

Internal Dependencies (sub-tickets):
- MinHeap (01) → A* Search (05)
- State Helpers (02) → Task Library (03), A* Search (05)
- Task Library (03) → A* Search (05)
- Parameter Binding (04) → A* Search (05)
- All Implementation (01-05) → DI Registration (06)
- All Implementation + DI (01-06) → Unit Tests (07)
- Unit Tests (07) → Integration Tests (08)
```

## Files Created

### Implementation Files
1. `src/goap/planner/minHeap.js` (~100 lines)
2. `src/goap/planner/goapPlanner.js` (~600 lines total)
   - Constructor + validation (~60 lines)
   - State helpers (~150 lines)
   - Task library (~60 lines)
   - Parameter binding (~120 lines)
   - A* search (~200 lines)

### Test Files
1. `tests/unit/goap/planner/minHeap.test.js` (~150 lines)
2. `tests/unit/goap/planner/goapPlanner.stateHelpers.test.js` (~200 lines)
3. `tests/unit/goap/planner/goapPlanner.taskLibrary.test.js` (~150 lines)
4. `tests/unit/goap/planner/goapPlanner.parameterBinding.test.js` (~150 lines)
5. `tests/unit/goap/planner/goapPlanner.plan.test.js` (~300 lines)
6. `tests/integration/goap/aStarPlanning.integration.test.js` (~350 lines)

### Configuration Files Modified
1. `src/dependencyInjection/tokens/tokens-core.js` (+1 line)
2. `src/dependencyInjection/registrations/goapRegistrations.js` (+15 lines)

## Success Criteria (Overall)

✅ **GOAPIMPL-018 Complete When**:
- All 8 sub-tickets completed
- All unit tests pass (90%+ coverage functions/lines, 80%+ branches)
- All integration tests pass
- ESLint passes on all new files
- Plans correctly achieve goals (verified in integration tests)
- Search limits prevent runaway computation
- Knowledge-limited planning works correctly
- Service integrates with DI container
- Documentation complete

## Notes for Implementation

### Critical Corrections Applied
Based on validation report (`reports/GOAPIMPL-018-validation-report.md`):
1. ✅ Removed non-existent `ITaskLibraryConstructor` dependency
2. ✅ Fixed service names (`IScopeEngine`, `JsonLogicEvaluationService`)
3. ✅ Added missing `IEntityManager` dependency
4. ✅ Enhanced algorithm with state hashing and duplicate detection
5. ✅ Corrected parameter binding approach (use IScopeEngine)
6. ✅ Fixed test file naming pattern

### Recommended Implementation Approach
1. **Start with infrastructure** (GOAPIMPL-018-01, 02)
2. **Build task handling** (GOAPIMPL-018-03, 04)
3. **Integrate into A*** (GOAPIMPL-018-05)
4. **Connect to DI** (GOAPIMPL-018-06)
5. **Verify with tests** (GOAPIMPL-018-07, 08)

### Common Pitfalls to Avoid
- ❌ Not sorting keys in state hashing → duplicate detection failures
- ❌ Confusing structural gates with preconditions → wrong evaluation context
- ❌ Not handling binding failures → crashes on null
- ❌ Missing open list duplicate detection → suboptimal plans
- ❌ Using wrong service names → DI resolution failures

---

**Created**: 2025-11-14
**Status**: Ready for implementation
**Estimated Total Time**: 7-7.5 hours across 8 focused tickets
