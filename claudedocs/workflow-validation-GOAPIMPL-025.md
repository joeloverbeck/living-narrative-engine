# Workflow Validation Report: GOAPIMPL-025

**Validation Date**: 2025-11-16
**Workflow File**: tickets/GOAPIMPL-025-goap-debugging-tools.md
**Primary Spec**: specs/goap-system-specs.md lines 507-516

## Executive Summary

**Overall Assessment**: WORKFLOW REQUIRES SIGNIFICANT CORRECTIONS

The workflow contains multiple outdated assumptions about file paths, interface names, and implementation details. The GOAP system has been substantially implemented since this workflow was written, including controller, planner, refinement engine, and event system.

**Critical Issues Found**: 15
**Corrections Required**: Yes

---

## Incorrect Assumptions Found

### 1. File Structure - Debug Tools Directory

**Assumption**:
```
Files to Create:
- src/goap/debug/planInspector.js
- src/goap/debug/stateDiffViewer.js
- src/goap/debug/searchSpaceVisualizer.js
- src/goap/debug/refinementTracer.js
- src/goap/debug/goapDebugger.js
```

**Reality**:
- Directory `src/goap/debug/` **DOES NOT EXIST**
- Current GOAP structure has 27 files across:
  - `src/goap/controllers/` (GoapController)
  - `src/goap/planner/` (9 files including GoapPlanner, heuristics, etc.)
  - `src/goap/refinement/` (3 files including RefinementEngine)
  - `src/goap/services/` (3 files)
  - `src/goap/events/` (goapEvents.js)
  - `src/goap/errors/` (7 error types)
  - `src/goap/loaders/` (RefinementMethodLoader)

**Correction**: Create new directory `src/goap/debug/` for debug tools.

---

### 2. DI Tokens - Missing Debug Token

**Assumption**:
```
container.resolve('GOAPDebugger');
```

**Reality**:
- No `IGOAPDebugger` or `GOAPDebugger` token exists in `tokens-core.js`
- Existing GOAP tokens:
  - `IGoapController`
  - `IGoapPlanner`
  - `IRefinementEngine`
  - `IPlanInvalidationDetector`
  - `ITaskLibraryConstructor`
  - `IContextAssemblyService`
  - `IParameterResolutionService`
  - `IKnowledgeManager`
  - `IPlanningEffectsSimulator`
  - And others (see goapRegistrations.js)

**Correction**: Add `IGOAPDebugger: 'IGOAPDebugger'` to tokens-core.js

---

### 3. Event Integration - Existing Events System

**Assumption**:
```
Optionally add debug hooks to planner, refinement engine, etc.
```

**Reality**:
- GOAP event system **ALREADY EXISTS** at `src/goap/events/goapEvents.js`
- Comprehensive events already defined:
  - `GOAL_SELECTED`
  - `PLANNING_STARTED` / `PLANNING_COMPLETED` / `PLANNING_FAILED`
  - `PLAN_INVALIDATED`
  - `REPLANNING_STARTED`
  - `TASK_REFINED`
  - `REFINEMENT_FAILED`
  - `ACTION_HINT_GENERATED` / `ACTION_HINT_FAILED`
  - `GOAL_ACHIEVED`
- Events already dispatched from GoapController (lines 178-186, 232-233, etc.)

**Correction**: Debug tools should **CONSUME** existing events, not create hooks. Events are already being dispatched throughout the GOAP lifecycle.

---

### 4. Plan Structure - Actual Implementation

**Assumption**:
```
planInspector.inspect(plan, options = {});
planInspector.inspectCurrent(actor);
```

**Reality**:
- Active plan structure (from GoapController.js lines 491-507):
  ```javascript
  {
    goal: goal,           // Goal object with id, priority
    tasks: tasks,         // Array of task objects
    currentStep: 0,       // Current task index
    actorId: actorId,     // Actor entity ID
    createdAt: timestamp,
    lastValidated: timestamp
  }
  ```
- Tasks have structure:
  ```javascript
  {
    taskId: string,       // Task identifier
    params: object        // Resolved parameters
  }
  ```
- Plan is **private** field `#activePlan` in GoapController - not directly accessible

**Correction**: Debug API must access plan through GoapController method, not direct access.

---

### 5. Search Space - Planner Implementation

**Assumption**:
```
searchSpaceVisualizer.visualize(searchResult);
```

**Reality**:
- GoapPlanner uses A* search with `PlanningNode` class (src/goap/planner/planningNode.js)
- Planning nodes have structure:
  ```javascript
  {
    state: object,        // World state hash
    task: object,         // Applied task
    parent: PlanningNode, // Previous node
    g: number,            // Cost from start
    h: number,            // Heuristic estimate
    f: number             // g + h
  }
  ```
- Planner returns only final plan, **NOT** full search tree
- Closed set tracking happens internally, not exposed

**Correction**: Search space visualization requires planner modification to **capture and return** search metadata (explored nodes, open set, closed set).

---

### 6. State Diff - Planning vs Execution States

**Assumption**:
```
State Diff: Node 5 → Node 6
Added Facts:
  + actor-1:core:has_resources = true
```

**Reality**:
- Planning uses **symbolic state hash** (key-value pairs)
- Execution uses **ECS components** (entity-component pairs)
- PlanningEffectsSimulator transforms state immutably (src/goap/planner/planningEffectsSimulator.js)
- No "node-to-node" diff exists - only initial state → simulated state

**Correction**: State diff viewer must work with state hashes (not nodes), and understand difference between planning state and ECS state.

---

### 7. Refinement Tracing - RefinementEngine Structure

**Assumption**:
```
refinementTracer.trace(task, context);
refinementTracer.enable();
refinementTracer.disable();
```

**Reality**:
- RefinementEngine returns result structure (RefinementEngine.js lines 689-718):
  ```javascript
  {
    success: boolean,
    stepResults: Array,   // NOT exposed externally
    methodId: string,
    taskId: string,
    actorId: string,
    timestamp: number,
    replan?: boolean,
    skipped?: boolean,
    error?: string
  }
  ```
- Step execution happens via:
  - `PrimitiveActionStepExecutor` (for primitive actions)
  - `ConditionalStepExecutor` (for conditionals)
- Local state managed by `RefinementStateManager` (transient lifecycle)
- **Step results are NOT exposed** in return value (only metadata)

**Correction**: Tracing requires:
1. Event-based capture (not return value inspection)
2. New events for step-level execution (currently only task-level events exist)
3. Access to RefinementStateManager state (requires API change)

---

### 8. GoapController Interface

**Assumption**:
```
class GOAPDebugger {
  inspectPlan(actor);
  inspectCurrentGoal(actor);
  showWorldState(actor);
}
```

**Reality**:
- GoapController interface (from goapController.js):
  ```javascript
  async decideTurn(actor, world) // Only public method
  ```
- All plan state is **private** (`#activePlan`, `#failedGoals`, `#failedTasks`)
- No getter methods for plan inspection
- No API for external plan queries

**Correction**: GoapController needs new **debug API methods**:
```javascript
getActivePlan(actorId)     // Returns plan or null
getFailedGoals(actorId)    // Returns failure history
getFailedTasks(actorId)    // Returns failure history
getCurrentTask(actorId)    // Returns current task
```

---

### 9. Required Services - Injection Dependencies

**Assumption**:
```
Required Services (inject):
- IGOAPController - Access to planning/refinement
- ILogger - Logging integration

Optional Services:
- ICommandRegistry - Register debug commands
```

**Reality**:
- Required dependencies for full debug capability:
  - `IGoapController` - Access to plans (requires new API)
  - `IGoapPlanner` - Access to planning (requires search capture)
  - `IRefinementEngine` - Access to refinement (requires step events)
  - `IEventBus` - Listen to GOAP events
  - `ILogger` - Logging
  - `IDataRegistry` - Access to goals/tasks definitions
  - `IEntityManager` - Access to actor entities
  - `IContextAssemblyService` - Build evaluation contexts
- ICommandRegistry **DOES NOT EXIST** in codebase (no command system)

**Correction**: Remove ICommandRegistry dependency. Add missing required services.

---

### 10. Test File Location

**Assumption**:
```
tests/unit/goap/debug/goapDebugger.test.js
```

**Reality**:
- Current test structure for GOAP:
  - `tests/unit/goap/controllers/` (3 test files for GoapController)
  - `tests/unit/goap/services/` (3 test files)
  - `tests/unit/goap/planner/` (9 test files)
  - `tests/integration/goap/` (9 test files)
  - `tests/e2e/goap/` (1 test file)

**Correction**: Test file location is correct, directory will be created.

---

### 11. World State Structure

**Assumption**:
```
showWorldState(actor);
```

**Reality**:
- World structure passed to GoapController (goapController.js line 262):
  ```javascript
  const initialState = world.state || world;
  ```
- World can be:
  1. Object with `.state` property (symbolic state hash)
  2. Direct state hash
- No standard "world" object - structure is TBD (see comment line 210)
- Planning state is **symbolic hash** (not full ECS)

**Correction**: World state display must handle both world formats and explain planning state vs ECS state difference.

---

### 12. Task Parameters - Resolution Context

**Assumption**:
```
Task Applied: gather_resources
Target Bindings:
  item: task.params.item → "food-1" (entity-123)
```

**Reality**:
- Task parameters are **already resolved** when in plan (from GoapController.js line 287):
  ```javascript
  const task = this.#getCurrentTask();
  // task = { taskId: string, params: object }
  ```
- Parameter resolution happens during:
  1. Planning (scope resolution via GoapPlanner)
  2. Refinement (placeholder resolution via ParameterResolutionService)
- Tasks in plan have concrete entity IDs, not placeholders

**Correction**: Parameter display should show resolved bindings, not resolution process.

---

### 13. Failure Tracking - Implementation Details

**Assumption**:
```
No mention of failure tracking in workflow
```

**Reality**:
- GoapController has sophisticated failure tracking (lines 159-163, 868-958):
  - `#failedGoals` - Map of goal failures with timestamps
  - `#failedTasks` - Map of task failures with timestamps
  - Failure expiry: 5 minutes
  - Max failures: 3 before giving up
  - Recursion depth tracking for 'continue' fallback

**Correction**: Debug tools should visualize failure tracking state.

---

### 14. Heuristic Information

**Assumption**:
```
Search Space shows h=3, h=2, h=0 values
```

**Reality**:
- Heuristic system exists (src/goap/planner/heuristicRegistry.js):
  - `GoalDistanceHeuristic` - counts unsatisfied conditions
  - `RelaxedPlanningGraphHeuristic` - builds relaxed planning graph
  - Heuristic selection: 'goal-distance', 'rpg', 'zero' (Dijkstra)
- Heuristics are **configurable** (not hardcoded to one type)
- Heuristic registry manages multiple strategies

**Correction**: Search visualization should show which heuristic was used.

---

### 15. Cost Calculation

**Assumption**:
```
Estimated Cost: 3.0
```

**Reality**:
- Tasks have **no explicit cost field** in schema (data/schemas/task.schema.json)
- A* uses uniform cost (1 per task) unless costs are added later
- PlanningNode tracks g-cost (actual), h-cost (heuristic), f-cost (total)

**Correction**: Cost display should clarify cost model (uniform vs weighted).

---

## Corrected Workflow

Due to the extensive changes needed, the corrected workflow is provided as a separate file below.

---

## Implementation Dependencies Not in Workflow

### Missing Prerequisites

1. **GoapController Debug API** - Add public methods for plan inspection
2. **Planner Search Capture** - Modify GoapPlanner to optionally capture search metadata
3. **Refinement Step Events** - Add events for individual step execution
4. **RefinementStateManager Access** - Add read-only API for state inspection

### Integration Points

1. **Event System** - Already complete, ready for consumption
2. **DI Registration** - goapRegistrations.js exists, ready for debug service
3. **Token System** - tokens-core.js ready for new token

---

## Validation Checklist

- [ ] Debug tools directory created: `src/goap/debug/`
- [ ] Token added: `IGOAPDebugger` in tokens-core.js
- [ ] GoapController debug API implemented
- [ ] Planner search capture implemented
- [ ] Refinement step events added to goapEvents.js
- [ ] All debug tools consume GOAP events
- [ ] State diff handles both planning and ECS states
- [ ] Plan inspector handles private plan structure
- [ ] Search visualizer works with captured search data
- [ ] Refinement tracer uses step events
- [ ] Tests created in tests/unit/goap/debug/
- [ ] Manual testing procedures documented

---

## References

- GoapController: src/goap/controllers/goapController.js
- GOAP Events: src/goap/events/goapEvents.js
- GOAP Registrations: src/dependencyInjection/registrations/goapRegistrations.js
- Tokens: src/dependencyInjection/tokens/tokens-core.js
- Implementation Status: docs/goap/IMPLEMENTATION-STATUS.md
- Specs: specs/goap-system-specs.md

---

**Validator**: Claude Code (Workflow Assumptions Validator)
**Next Action**: Update workflow file with corrections
