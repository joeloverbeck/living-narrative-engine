# GOAPIMPL-018-08: Integration Tests

**Parent Ticket**: GOAPIMPL-018 (GOAP A* Algorithm)
**Priority**: HIGH
**Estimated Effort**: 1.5 hours
**Dependencies**: GOAPIMPL-018-07 (unit tests must pass first)

## Description

Create integration tests that validate the complete A* planning workflow with real GOAP services, tasks from core mod, and actual scope definitions.

## Acceptance Criteria

- [ ] Tests use real service instances (not mocks)
- [ ] Tests use real tasks from core mod
- [ ] Tests verify plan correctness (execution satisfies goal)
- [ ] Tests compare different heuristics (goal-distance vs relaxed-planning-graph)
- [ ] Tests verify knowledge-limited scope behavior
- [ ] Tests verify parameter binding with real scopes
- [ ] All tests pass
- [ ] Performance benchmarks within acceptable ranges

## Test File to Create

**File**: `tests/integration/goap/aStarPlanning.integration.test.js` (~300-400 lines)

## Test Scenarios

### 1. Simple Goal Planning
```javascript
describe('Simple goal achievement', () => {
  it('should plan single-task path for reducing hunger', async () => {
    // Setup: Actor with hungry state, nourishing item in world
    // Plan: Actor should find consume_nourishing_item task
    // Verify: Plan length === 1, correct task ID, correct parameters
  });
});
```

### 2. Multi-Task Planning
```javascript
describe('Complex multi-task planning', () => {
  it('should plan multi-step path for securing shelter', async () => {
    // Setup: Actor needs shelter, requires finding and securing it
    // Plan: Should include find_shelter + secure_shelter tasks
    // Verify: Plan length, task sequence, state transitions
  });
});
```

### 3. Knowledge-Limited Planning
```javascript
describe('Knowledge-limited scope planning', () => {
  it('should only plan with known entities', async () => {
    // Setup: Two items - one known, one unknown (no core:known_to)
    // Plan: Should only use known item
    // Verify: Parameter binding respects knowledge limitation
  });
});
```

### 4. Heuristic Comparison
```javascript
describe('Heuristic performance comparison', () => {
  it('should find same plan with different heuristics', async () => {
    // Plan with 'goal-distance'
    // Plan with 'relaxed-planning-graph'
    // Verify: Both find valid plans (may differ in node count)
  });
});
```

### 5. Plan Correctness Verification
```javascript
describe('Plan correctness', () => {
  it('should simulate plan execution and satisfy goal', async () => {
    // Get plan from planner
    // Simulate each task's effects in sequence
    // Verify: Final state satisfies goal condition
  });
});
```

### 6. Unsolvable Goal Handling
```javascript
describe('Unsolvable goals', () => {
  it('should return null when goal unreachable', async () => {
    // Setup: Goal requires item that doesn't exist
    // Plan: Should return null after exhausting search
    // Verify: Logged appropriate warning
  });
});
```

### 7. Parameter Binding with Real Scopes
```javascript
describe('Real scope parameter binding', () => {
  it('should bind parameters from core:known_nourishing_items scope', async () => {
    // Setup: Multiple nourishing items, actor knows subset
    // Plan: Should bind to known items only
    // Verify: Bound parameters are valid entity IDs from scope
  });
});
```

## Setup Pattern

```javascript
import { createTestBed } from '../../common/testBed.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

describe('GOAP A* Planner - Integration', () => {
  let testBed;
  let planner;
  let entityManager;
  let gameDataRepository;

  beforeEach(() => {
    testBed = createTestBed();

    // Create real service instances
    entityManager = new SimpleEntityManager();
    gameDataRepository = createRealGameDataRepository();

    // Load real tasks from core mod
    const coreTasks = loadTasksFromCoreMod();

    planner = new GoapPlanner({
      planningEffectsSimulator: createRealSimulator(),
      heuristicRegistry: createRealHeuristicRegistry(),
      gameDataRepository,
      scopeEngine: createRealScopeEngine(),
      jsonLogicService: createRealJsonLogicService(),
      entityManager,
      logger: testBed.createMockLogger(),
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });
});
```

## Performance Benchmarks

```javascript
describe('Performance benchmarks', () => {
  it('should plan within time limit for complex goals', () => {
    const start = Date.now();
    const plan = planner.plan(actorId, complexGoal, initialState, {
      maxTime: 2000
    });
    const elapsed = Date.now() - start;

    expect(plan).not.toBeNull();
    expect(elapsed).toBeLessThan(2000);
  });

  it('should explore < 100 nodes for simple goal', () => {
    let nodesExplored = 0;
    // Hook into logger to count node explorations
    const plan = planner.plan(...);
    expect(nodesExplored).toBeLessThan(100);
  });
});
```

## Success Validation

✅ **Done when**:
- All integration tests pass
- Tests use real GOAP services
- Plans verified to satisfy goals
- Knowledge limitation tested
- Different heuristics tested
- Performance within acceptable ranges
- Edge cases covered

---

**Implementation Order**: GOAPIMPL-018-01 → 02 → 03 → 04 → 05 → 06 → 07 → 08
