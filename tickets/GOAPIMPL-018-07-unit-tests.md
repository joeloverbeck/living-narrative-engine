# GOAPIMPL-018-07: Unit Tests

**Parent Ticket**: GOAPIMPL-018 (GOAP A* Algorithm)
**Priority**: HIGH
**Estimated Effort**: 1.5 hours
**Dependencies**: GOAPIMPL-018-01 through GOAPIMPL-018-06 (all implementation tickets)

## Description

Create comprehensive unit tests for all GoapPlanner methods and MinHeap class. Ensure 90%+ function/line coverage and 80%+ branch coverage.

## Acceptance Criteria

- [ ] MinHeap fully tested (all methods, edge cases)
- [ ] State helpers fully tested (hashing, goal check, context building)
- [ ] Task library construction tested
- [ ] Parameter binding tested
- [ ] A* search algorithm tested
- [ ] Coverage targets met: 90%+ functions/lines, 80%+ branches
- [ ] All tests pass
- [ ] Mock dependencies properly

## Test Files to Create

### 1. MinHeap Tests
**File**: `tests/unit/goap/planner/minHeap.test.js` (~150 lines)

Test cases:
- Constructor validation
- Push/pop operations
- Heap property maintenance
- findIndex/remove/get operations
- Edge cases (empty heap, single item, duplicates)
- Performance benchmarks

### 2. State Helpers Tests
**File**: `tests/unit/goap/planner/goapPlanner.stateHelpers.test.js` (~200 lines)

Test cases:
- State hashing consistency
- State hashing with different key orders
- Goal satisfaction checking
- Evaluation context building
- Error handling for all methods

### 3. Task Library Tests
**File**: `tests/unit/goap/planner/goapPlanner.taskLibrary.test.js` (~150 lines)

Test cases:
- Task filtering by structural gates
- Tasks without gates included
- Actor not found handling
- Empty task repository handling

### 4. Parameter Binding Tests
**File**: `tests/unit/goap/planner/goapPlanner.parameterBinding.test.js` (~150 lines)

Test cases:
- Successful parameter binding
- Binding failures (null return)
- Scope evaluation errors
- Missing scope definitions

### 5. A* Search Tests
**File**: `tests/unit/goap/planner/goapPlanner.plan.test.js` (~300 lines)

Test cases:
- Simple plans (1-3 tasks)
- Complex plans (5+ tasks)
- Unsolvable goals
- Search limit enforcement
- State deduplication
- Duplicate path handling
- Heuristic calculation
- Error handling throughout

## Mock Setup Pattern

```javascript
let mockLogger, mockEntityManager, mockRepository, mockScopeEngine,
    mockJsonLogic, mockEffectsSimulator, mockHeuristicRegistry;

beforeEach(() => {
  mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  mockEntityManager = {
    getEntity: jest.fn(),
    hasEntity: jest.fn(),
  };

  // ... setup other mocks
});
```

## Success Validation

✅ **Done when**:
- All test files created
- All tests pass
- Coverage: 90%+ functions/lines, 80%+ branches
- Mocks properly isolate units
- Edge cases covered
- Error paths tested

---

**Next Ticket**: GOAPIMPL-018-08 (Integration Tests)
