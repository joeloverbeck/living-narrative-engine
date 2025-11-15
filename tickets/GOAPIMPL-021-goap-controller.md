# GOAPIMPL-021: GOAP Controller

**Priority**: CRITICAL
**Estimated Effort**: 4-5 hours
**Dependencies**: GOAPIMPL-014 (Refinement Engine), GOAPIMPL-018 (GOAP Planner), GOAPIMPL-020 (Plan Invalidation Detector)

## Description

Create GOAPController that orchestrates the complete GOAP cycle: goal selection → planning → refinement → action hint generation → replanning. Integrates planner, refinement engine, and turn system into a cohesive decision-making system.

The GOAP controller is the main entry point for GOAP-based AI - it coordinates all GOAP subsystems to make intelligent action decisions.

**Critical Architecture Note**: GOAP does NOT execute actions directly. It produces action hints (action references + target bindings) that flow through the standard turn system. This maintains the unified player type architecture where 'human', 'llm', and 'goap' all produce actions from `data/mods/*/actions/` and execute through the same pipeline.

## Acceptance Criteria

- [ ] Manages complete GOAP cycle (goal → plan → refine → action hint)
- [ ] Handles goal selection from actor's goals
- [ ] Triggers planning with GOAP planner
- [ ] Refines tasks to step results with refinement engine
- [ ] Extracts action hints from refinement step results
- [ ] Returns action hints to GoapDecisionProvider (not executing directly)
- [ ] Detects plan invalidation and triggers replanning
- [ ] Handles all failure modes gracefully (planning fails, refinement fails)
- [ ] Dispatches lifecycle events for monitoring
- [ ] Maintains plan state across turns
- [ ] 90%+ test coverage

## Files to Create

### Main Implementation
- `src/goap/controllers/goapController.js` - Main GOAP orchestration controller

### Tests
- `tests/unit/goap/goapController.test.js` - Unit tests
- `tests/integration/goap/goapController.integration.test.js` - Integration tests
- `tests/e2e/goap/goapFullCycle.e2e.test.js` - End-to-end tests

## Files to Modify

### Dependency Injection
- `src/dependencyInjection/tokens/tokens-core.js` - Add `IGOAPController` token
- `src/dependencyInjection/registrations/goapRegistrations.js` - Register controller

## Testing Requirements

### Unit Tests
- [ ] Test complete GOAP cycle with simple goal
- [ ] Test replanning on plan invalidation
- [ ] Test failure handling at each stage (planning, refinement, execution)
- [ ] Test multiple goal achievement
- [ ] Test goal selection logic
- [ ] Test plan state persistence
- [ ] Test event dispatching

### Integration Tests
- [ ] Test GOAP cycle with real tasks and action hints
- [ ] Test replanning scenarios
- [ ] Test multi-step plans
- [ ] Test failure recovery
- [ ] Test integration with GoapDecisionProvider and turn system

### E2E Tests
- [ ] Test complete game scenario with GOAP AI
- [ ] Test actor achieving complex goal over multiple turns
- [ ] Test plan adaptation to dynamic world
- [ ] Test multi-actor GOAP scenarios

## GOAP Cycle Flow

### High-Level Algorithm
```javascript
async decideTurn(actor, world) {
  // 1. Check if we have active plan
  if (this.activePlan) {
    // 2. Validate plan still applicable
    const validation = this.invalidationDetector.check(
      this.activePlan,
      world
    );

    if (!validation.valid) {
      // 3. Plan invalidated → clear and replan
      this.logger.info('Plan invalidated', validation.reason);
      this.activePlan = null;
    }
  }

  // 4. Need new plan?
  if (!this.activePlan) {
    // 5. Select goal
    const goal = this.selectGoal(actor);

    if (!goal) {
      return null;  // No goals → idle
    }

    // 6. Plan to achieve goal
    const plan = await this.planner.plan(actor, goal, world);

    if (!plan) {
      // 7. Planning failed → handle failure
      return this.handlePlanningFailure(goal);
    }

    this.activePlan = {
      goal: goal,
      tasks: plan,
      currentStep: 0
    };
  }

  // 8. Get next task from plan
  const task = this.activePlan.tasks[this.activePlan.currentStep];

  // 9. Refine task to step results (NOT executable actions)
  const refinementResult = await this.refinementEngine.refine(
    task.taskId,
    actor.id,
    task.params
  );

  if (!refinementResult.success) {
    // 10. Refinement failed → handle failure
    return this.handleRefinementFailure(task, refinementResult);
  }

  // 11. Extract action reference from first step result
  const firstStep = refinementResult.stepResults[0];
  if (!firstStep || !firstStep.actionRef) {
    throw new Error('Refinement produced no actionable steps');
  }

  // 12. Build action hint from step result
  const actionHint = {
    actionId: firstStep.actionRef,  // e.g., "items:consume_item"
    targetBindings: firstStep.targetBindings,
    stepIndex: 0
  };

  // 13. Advance plan
  this.activePlan.currentStep++;

  if (this.activePlan.currentStep >= this.activePlan.tasks.length) {
    // 14. Plan complete
    this.activePlan = null;
  }

  // 15. Return action hint for GoapDecisionProvider to resolve
  // The turn system will match this hint to available actions
  return { actionHint };
}
```

### Goal Selection
```javascript
selectGoal(actor) {
  const goals = actor.components['core:goals']?.goals || [];

  // Sort by priority (descending)
  goals.sort((a, b) => b.priority - a.priority);

  // Return highest priority unsatisfied goal
  for (const goal of goals) {
    if (!this.isGoalSatisfied(goal, actor)) {
      return goal;
    }
  }

  return null;  // All goals satisfied
}
```

## Plan State Management

### Active Plan Structure
```javascript
{
  goal: {
    id: "be_fed",
    priority: 10,
    conditions: [...]
  },
  tasks: [
    { taskId: "gather_food", parameters: {...} },
    { taskId: "eat_food", parameters: {...} }
  ],
  currentStep: 0,
  createdAt: timestamp,
  lastValidated: timestamp
}
```

### Plan Persistence
- Store active plan in actor state or separate plan manager
- Persist plan across turns
- Clear plan when completed or invalidated

## Failure Handling

### Planning Failure
```javascript
handlePlanningFailure(goal) {
  this.logger.warn('Planning failed for goal', goal.id);

  // Dispatch event
  this.eventBus.dispatch({
    type: 'GOAP_PLANNING_FAILED',
    payload: { goalId: goal.id, actorId: this.actor.id }
  });

  // Fallback: idle or default action
  return null;  // Idle this turn
}
```

### Refinement Failure
```javascript
handleRefinementFailure(task, result) {
  this.logger.warn('Refinement failed for task', task.taskId);

  if (result.fallbackBehavior === 'replan') {
    // Clear plan → will replan next turn
    this.activePlan = null;
    return null;
  }

  if (result.fallbackBehavior === 'continue') {
    // Skip this task, continue with plan
    this.activePlan.currentStep++;
    return this.decideTurn(this.actor, this.world);  // Recurse
  }

  // fallbackBehavior === 'fail'
  this.activePlan = null;
  return null;
}
```

### Execution Failure
Handled by the turn system's action execution pipeline. If an action fails prerequisite checks or execution, the turn system will handle it normally. This may trigger plan invalidation on the next turn if the failure affects world state.

## Events to Dispatch

### GOAP Lifecycle Events
```javascript
// Planning started
GOAP_PLANNING_STARTED { actorId, goalId }

// Planning completed
GOAP_PLANNING_COMPLETED { actorId, goalId, planLength }

// Planning failed
GOAP_PLANNING_FAILED { actorId, goalId, reason }

// Plan invalidated
GOAP_PLAN_INVALIDATED { actorId, goalId, reason, step }

// Replanning triggered
GOAP_REPLANNING_STARTED { actorId, goalId }

// Task refined
GOAP_TASK_REFINED { actorId, taskId, actionsGenerated }

// Goal achieved
GOAP_GOAL_ACHIEVED { actorId, goalId }
```

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` lines 164-195 - **PRIMARY REFERENCE** - Complete execution loop
- `specs/goap-system-specs.md` lines 327-349 - Plan invalidation and replanning

## Implementation Notes

### State Management
Options for plan persistence:
1. **Actor component**: Add `core:active_plan` component
2. **Controller state**: Store in controller instance (simple)
3. **Plan manager**: Separate service for multi-actor scenarios

Start with controller state for MVP.

### Turn-Based Execution
GOAP controller returns ONE action hint per turn:
- Refine task → get step results with action references
- Extract first action reference as hint
- Return hint to GoapDecisionProvider
- Provider matches hint to discovered actions
- Turn system executes chosen action
- Next turn: Controller advances to next step or task

### Replanning Strategy
When to replan:
- **Reactive**: On plan invalidation
- **Periodic**: Every N turns
- **Opportunistic**: When better plan available

Start with reactive for MVP.

### Goal Achievement Detection
Check goal satisfaction:
- Before goal selection (skip satisfied goals)
- After action execution (detect achievement)
- Periodic checks (external goal satisfaction)

### Performance Considerations
- Planning is expensive (~10-100ms)
- Cache plans when possible
- Validate incrementally (not full revalidation)
- Consider async planning (don't block game loop)

## Integration Points

### Required Services (inject)
- `IGOAPPlanner` (GOAPIMPL-018) - Planning
- `IRefinementEngine` (GOAPIMPL-014) - Task refinement
- `IPlanInvalidationDetector` (GOAPIMPL-020) - Plan validation
- `ITurnActionChoicePipeline` - Action discovery from refinement hints
- `IContextAssemblyService` (GOAPIMPL-007) - Build contexts
- `IEventBus` - Dispatch events
- `ILogger` - Logging

### Used By (future)
- GOAPIMPL-022 (Action Decider Integration) - GOAP decision provider

## Integration with Turn System

### Critical Architecture: Unified Player Type Design

**IMPORTANT**: GOAP is designed as a decision provider that produces action hints, NOT a separate execution system. All player types ('human', 'llm', 'goap') share:
- Same entry points (turn system calls decision provider)
- Same exits (all produce atomic actions from `data/mods/*/actions/`)
- Same execution pipeline (all actions go through prerequisite checks and system rules)

This unified architecture is **intentional and must be preserved**.

### Action Discovery Flow

The GOAP controller returns action hints that flow through the standard turn system:

1. **GOAPController.decideTurn()** returns `{ actionHint: { actionId, targetBindings } }`
2. **GoapDecisionProvider** receives indexed actions from `TurnActionChoicePipeline.buildChoices()`
3. **Provider matches** `actionHint.actionId` against available actions
4. **Provider applies** `targetBindings` to filter/prioritize matching actions
5. **Provider returns** `{ index }` of the matching action (standard decision format)
6. **Turn system** executes the action at that index through normal pipeline

### Why This Architecture Works

**Separation of Concerns**:
- **Planning Layer** (GOAP-specific): What high-level tasks to perform
- **Refinement Layer** (GOAP-specific): How tasks decompose to action references
- **Action Discovery Layer** (Unified): What primitive actions are available
- **Execution Layer** (Unified): How actions execute and affect world state

**Benefits**:
- All actions go through same validation (prerequisites, scope checks)
- All actions trigger same system rules (for consistency)
- Mods define actions once, usable by all player types
- No duplicate execution logic for GOAP vs human/LLM

**Action Hint Resolution**:
If the suggested action isn't available (failed prerequisites, out of scope), the GoapDecisionProvider returns `null`, which causes:
1. Actor idles this turn
2. Next turn, GOAPController detects world state change
3. Plan invalidation detector may trigger replanning
4. New plan generated with updated world state

### Action Hint Resolver (Future Component)

**Purpose**: Bridge between GOAP refinement results and turn system action discovery.

**Interface** (to be created in GOAPIMPL-022):
```javascript
interface IActionHintResolver {
  /**
   * Resolve action hint to action index
   * @param actionRef - Action ID from refinement (e.g., "items:consume_item")
   * @param targetBindings - Target entity bindings from refinement
   * @param availableActions - Discovered actions from TurnActionChoicePipeline
   * @returns Index of matching action, or null if no match
   */
  resolveActionFromHint(
    actionRef: string,
    targetBindings: object,
    availableActions: ActionComposite[]
  ): number | null;
}
```

**Responsibilities**:
- Match action references to discovered actions
- Apply target bindings to filter candidates
- Handle ambiguous matches (multiple actions with same ID)
- Return null for unresolvable hints (triggers replanning)

**Used by**: GoapDecisionProvider in GOAPIMPL-022

## Success Validation

✅ **Done when**:
- All unit tests pass with 90%+ coverage
- Integration tests validate complete GOAP cycle
- E2E tests demonstrate goal achievement over multiple turns
- All failure scenarios handled gracefully
- Events dispatched for monitoring
- Plan state persists correctly
- Service integrates with DI container
- Documentation explains GOAP cycle and failure handling
