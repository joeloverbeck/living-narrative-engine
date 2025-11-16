# GOAP Integration Test Infrastructure Analysis

## Overview
Complete GOAP test infrastructure with real services, mocks, and helper factories for comprehensive integration testing.

## 1. Test Setup: `createGoapTestSetup(config)`

### Function Signature
```javascript
export async function createGoapTestSetup(config = {})
```

### Configuration Parameters
```javascript
{
  tasks: {},              // Task definitions by namespace
  methods: {},            // Refinement method definitions by task ID
  mockRefinement: false   // Whether to mock refinement engine
}
```

### Returned Setup Object Properties
```javascript
{
  testBed,                      // Jest test bed with mock logger
  controller,                   // GoapController (main orchestrator)
  planner,                      // GoapPlanner (A* planning)
  refinementEngine,             // RefinementEngine (task decomposition)
  invalidationDetector,         // PlanInvalidationDetector
  contextAssemblyService,       // ContextAssemblyService
  parameterResolutionService,   // ParameterResolutionService
  dataRegistry,                 // Mock data registry (goals storage)
  gameDataRepository,           // Mock game data repository (tasks)
  entityManager,                // SimpleEntityManager (real entity management)
  jsonLogicService,             // JsonLogicEvaluationService wrapper
  scopeRegistry,                // ScopeRegistry
  scopeEngine,                  // ScopeEngine
  eventBus,                     // EventBusRecorder (with recording capabilities)
  spatialIndexManager,          // Mock spatial index
  effectsSimulator,             // PlanningEffectsSimulator
  heuristicRegistry,            // HeuristicRegistry
}
```

## 2. Goal Factory: `testGoalFactory.js`

### Function: `createTestGoal(overrides)`
- **Returns**: Basic GOAP goal with test defaults
- **Default ID**: `'test:goal'`
- **Default Priority**: `10`
- **Default Relevance**: Always true
- **Default Goal State**: `{ '==': [{ var: 'actor.test_satisfied' }, true] }`
- **Example**:
```javascript
const goal = createTestGoal({
  id: 'test:hunger_goal',
  goalState: { has_component: ['actor', 'test:hungry'] }
});
```

### Function: `createHungerGoal()`
- Tests relevance condition: actor must have `test:hungry` component
- Goal state: remove `test:hungry` component

### Function: `createShelterGoal()`
- Tests multi-step planning
- Relevance: actor lacks shelter
- Goal state: add `test:has_shelter` component

### Function: `createImpossibleGoal()`
- For testing failure scenarios
- Goal state requires impossible component

### Function: `createComplexGoal()`
- For testing complex multi-step planning
- Requires `test:task_complete` component

## 3. Task Factory: `testTaskFactory.js`

### Function: `createTestTask(overrides)`
- **Default ID**: `'test:task'`
- **Default Effects**: Adds `test:goal_satisfied` component to actor
- **Default Methods**: `['test:method']`
- **Default Fallback**: `'replan'`

### Task Structure
```javascript
{
  id: string,
  structuralGates: null,  // or JSON Logic condition
  planningPreconditions: [{
    description: string,
    condition: { /* JSON Logic */ }
  }],
  planningEffects: [{
    type: 'ADD_COMPONENT' | 'REMOVE_COMPONENT',
    parameters: {
      entityId: 'actor' | 'param.name',
      componentId: string,
      componentData: object // for ADD_COMPONENT
    }
  }],
  refinementMethods: [string],
  fallbackBehavior: 'replan' | 'fail' | 'continue'
}
```

### Pre-built Task Factories
- `createConsumeTask()` - Removes hunger component
- `createGatherTask()` - Adds resources component
- `createBuildShelterTask()` - Requires resources, adds shelter
- `createReplanTask()` - Tests replan fallback
- `createFailTask()` - Tests fail fallback
- `createContinueTask()` - Tests continue fallback

## 4. Method Factory: `testMethodFactory.js`

### Function: `createTestMethod(overrides)`
- **Default ID**: `'test:method'`
- **Default Precondition**: Always true
- **Default Step**: Single primitive action `test:action`

### Method Structure
```javascript
{
  id: string,
  precondition: { /* JSON Logic */ },
  steps: [{
    stepType: 'primitive_action' | 'conditional',
    actionId: string,
    targetBindings: object,
    // For conditional steps:
    condition: { /* JSON Logic */ },
    thenSteps: [...],
    elseSteps: [...]
  }]
}
```

### Pre-built Method Factories
- `createConsumeMethod()` - Single action method
- `createMultiStepMethod()` - Move → Pickup → Consume (3 steps)
- `createFailingMethod()` - Precondition never satisfied
- `createConditionalMethod()` - Branching logic (if has item → consume, else pickup then consume)

## 5. Event Bus Recorder: `createEventBusRecorder()`

### Returned EventBus Object
```javascript
{
  dispatch(type, payload) { /* records event */ },
  getAll() → [{ type, payload, timestamp }],
  getEventTypes() → [type, type, ...],
  findEvent(type) → { type, payload, timestamp },
  findEvents(type) → [{ type, payload, timestamp }, ...],
  getEventsInOrder(...types) → [index, index, ...],
  clear() { /* clears recorded events */ }
}
```

## 6. GOAP Events: `goapEvents.js`

### Available Event Types
```javascript
GOAP_EVENTS = {
  GOAL_SELECTED:         'goap:goal_selected',
  PLANNING_STARTED:      'goap:planning_started',
  PLANNING_COMPLETED:    'goap:planning_completed',
  PLANNING_FAILED:       'goap:planning_failed',
  PLAN_INVALIDATED:      'goap:plan_invalidated',
  REPLANNING_STARTED:    'goap:replanning_started',
  REFINEMENT_STARTED:    'goap:refinement_started',
  METHOD_SELECTED:       'goap:method_selected',
  TASK_REFINED:          'goap:task_refined',
  REFINEMENT_COMPLETED:  'goap:refinement_completed',
  REFINEMENT_FAILED:     'goap:refinement_failed',
  ACTION_HINT_GENERATED: 'goap:action_hint_generated',
  ACTION_HINT_FAILED:    'goap:action_hint_failed',
  GOAL_ACHIEVED:         'goap:goal_achieved',
  REFINEMENT_STEP_STARTED:   'goap:refinement_step_started',
  REFINEMENT_STEP_COMPLETED: 'goap:refinement_step_completed',
  REFINEMENT_STEP_FAILED:    'goap:refinement_step_failed',
  REFINEMENT_STATE_UPDATED:  'goap:refinement_state_updated',
}
```

## 7. NumericConstraintEvaluator: `numericConstraintEvaluator.js`

### Location
`/src/goap/planner/numericConstraintEvaluator.js`

### Constructor
```javascript
new NumericConstraintEvaluator({
  jsonLogicEvaluator: JsonLogicEvaluationService,
  logger: Logger
})
```

### Methods
```javascript
evaluateConstraint(constraint, context) → boolean
calculateDistance(constraint, context) → number | null
isNumericConstraint(constraint) → boolean
```

### Supported Operators
- `>`, `<`, `>=`, `<=`, `==`

### DI Integration
- **Token**: `INumericConstraintEvaluator`
- **Registered in**: `goapRegistrations.js` (line 156)
- **Dependencies**: `JsonLogicEvaluationService`, `ILogger`
- **Lifecycle**: `singleton`

### Distance Calculation Logic
- `>` or `>=`: if current >= target → 0, else target - current
- `<` or `<=`: if current <= target → 0, else current - target
- `==`: Math.abs(current - target)

## 8. Integration Test Patterns

### Test Structure Pattern
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestSetup } from './testFixtures/goapTestSetup.js';
import { createTestGoal } from './testFixtures/testGoalFactory.js';
import { createTestTask } from './testFixtures/testTaskFactory.js';
import { GOAP_EVENTS } from '../../../src/goap/events/goapEvents.js';

describe('GOAP Feature - Integration', () => {
  let setup;

  beforeEach(async () => {
    setup = await createGoapTestSetup({
      tasks: { test: { [taskId]: taskDef } },
      methods: { [taskId]: [methodDef] },
      mockRefinement: true // or false for real refinement
    });
  });

  afterEach(() => {
    if (setup?.testBed) {
      setup.testBed.cleanup();
    }
  });

  it('should test feature', async () => {
    // Setup: Create entities, goals, tasks
    const actor = { id: 'actor', components: {} };
    setup.entityManager.addEntity(actor);

    const goal = createTestGoal({ /* overrides */ });
    setup.dataRegistry.register('goals', goal.id, goal);

    // Act: Execute planning/refinement
    const result = await setup.controller.decideTurn(actor, {});

    // Assert: Verify events and state
    const events = setup.eventBus.getAll();
    expect(events).toContainEqual(
      expect.objectContaining({ type: GOAP_EVENTS.PLANNING_COMPLETED })
    );
    setup.eventBus.clear();
  });
});
```

## 9. Mock Helper Functions in Setup

### Mock Data Registry
```javascript
{
  register(category, id, data) { },
  getAll(category) → [...],
  get(category, id) → object
}
```

### Mock Game Data Repository
```javascript
{
  get(key) → { 'namespace': { taskId: taskDef } },
  getTask(taskId) → taskDef
}
```

### Mock Spatial Index Manager
```javascript
{
  getEntitiesInLocation: jest.fn(() => []),
  getEntityLocation: jest.fn(() => null),
  addEntity: jest.fn(),
  removeEntity: jest.fn(),
  updateEntityLocation: jest.fn()
}
```

## 10. Context Assembly Service Mock Methods

### Methods Provided
```javascript
assembleRefinementContext(actorId) → { actor, world }
assemblePlanningContext(actorId) → { actor, world }
```

## Key Integration Points

1. **EventBus Recording**: All test setup instances use `createEventBusRecorder()` for event verification
2. **NumericConstraintEvaluator**: Integrated into `GoalDistanceHeuristic` for numeric goal distance calculation
3. **JSON Logic Service**: Custom operators registered (e.g., `has_component`)
4. **Entity Manager**: Real `SimpleEntityManager` for entity lifecycle management
5. **All Heuristics**: Use real implementations for accurate planning behavior

## Verification Checklist
✅ `goapTestSetup.js` - Fully functional test factory
✅ `testGoalFactory.js` - Goal creation helpers
✅ `testTaskFactory.js` - Task creation helpers
✅ `testMethodFactory.js` - Method creation helpers
✅ `eventBusRecorder.js` - Event recording for assertions
✅ `goapEvents.js` - Complete event types list
✅ `numericConstraintEvaluator.js` - Exists and integrated
✅ DI Token `INumericConstraintEvaluator` - Registered and available
✅ All dependencies resolved - No missing imports or services
