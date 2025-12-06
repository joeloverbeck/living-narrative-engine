# Implementing the Refinement Engine

## Purpose and Truth Sources

- **Audience**: contributors wiring new refinement methods or debugging the runtime flow between planning and executable actions.
- **Use this guide when** you need a high-level architectural map or to trace the invocation path from `GoapController` through the refinement subsystems. For schema specifics (e.g., how to model parameters, conditional contexts, or action references) defer to:
  - [`docs/goap/refinement-parameter-binding.md`](./refinement-parameter-binding.md)
  - [`docs/goap/refinement-condition-context.md`](./refinement-condition-context.md)
  - [`docs/goap/refinement-action-references.md`](./refinement-action-references.md)
- **Authoritative truth sources** referenced throughout:
  - `src/goap/controllers/goapController.js` (task selection + refinement entry point)
  - `src/goap/refinement/refinementEngine.js` and `src/goap/refinement/refinementStateManager.js`
  - `src/goap/refinement/methodSelectionService.js`
  - `src/goap/refinement/steps/primitiveActionStepExecutor.js`
  - `src/goap/refinement/steps/conditionalStepExecutor.js`
  - `src/goap/services/contextAssemblyService.js` and `src/goap/services/parameterResolutionService.js`

## Component and Responsibility Map

| Component                     | Location                                                   | Responsibilities                                                                                                                                                        | Handoffs / Events                                                                                                                                                               |
| ----------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GoapController`              | `src/goap/controllers/goapController.js`                   | Owns the actor decision cycle. After planning, validates current tasks and invokes `#refineTask`, which forwards to `RefinementEngine.refine(taskId, actorId, params)`. | Emits GOAP controller events, forwards `actorId/taskId` context to refinement, logs diagnostics.                                                                                |
| `RefinementEngine`            | `src/goap/refinement/refinementEngine.js`                  | Orchestrates refinement: loads tasks, selects methods, executes steps, handles fallbacks, and dispatches lifecycle events (`GOAP_EVENTS.REFINEMENT_*`).                 | Depends on MethodSelectionService, ContextAssemblyService, Primitive/Conditional executors, `RefinementStateManager`, ParameterResolutionService (transitively), and event bus. |
| `MethodSelectionService`      | `src/goap/refinement/methodSelectionService.js`            | Loads the task’s `refinementMethods`, evaluates applicability via JSON Logic, and returns the first applicable method plus diagnostics.                                 | Consumes `ContextAssemblyService` for building condition contexts; returns diagnostics used when no method applies.                                                             |
| `RefinementStateManager`      | `src/goap/refinement/refinementStateManager.js`            | Maintains per-execution `localState` (initialize → store → snapshot → clear). Guarantees isolation per refinement run.                                                  | Resolved through the DI container by both the engine and step executors so cached data flows into condition contexts and parameter bindings.                                    |
| `ContextAssemblyService`      | `src/goap/services/contextAssemblyService.js`              | Builds refinement contexts (actor, world, task, localState) and derives flattened condition contexts.                                                                   | Used by `MethodSelectionService`, `RefinementEngine` (per step), `PrimitiveActionStepExecutor`, and `ConditionalStepExecutor`.                                                  |
| `ParameterResolutionService`  | `src/goap/services/parameterResolutionService.js`          | Resolves dot-path references used in `targetBindings`/parameters to actual entities or state data; caches lookups per execution.                                        | Called inside `PrimitiveActionStepExecutor` and any helper needing bound values.                                                                                                |
| `PrimitiveActionStepExecutor` | `src/goap/refinement/steps/primitiveActionStepExecutor.js` | Resolves `storeResultAs` dependencies, binds targets, merges parameters, executes action operations, stores results, and logs per-step outcomes.                        | Emits structured results consumed by `RefinementEngine`. Stores data via `RefinementStateManager` and may log errors rather than throwing.                                      |
| `ConditionalStepExecutor`     | `src/goap/refinement/steps/conditionalStepExecutor.js`     | Evaluates JSON Logic conditions, enforces nesting depth (≤3), selects branches, executes nested steps, and enforces `onFailure` semantics (`fail`, `skip`, `replan`).   | Reuses PrimitiveActionStepExecutor for branch steps and can recurse into additional conditionals. Signals replan/skips to `RefinementEngine` through result payloads.           |

## Invocation Flow (GoapController → Executors)

1. **Plan Execution**: `GoapController.decideTurn` builds or reuses a plan via `GoapPlanner`, validates tasks, and chooses the next task for the actor.
2. **Refinement Entry**: `#refineTask` (see `GoapController` lines around 1030+) asserts the plan task and actor, logs the intent, and calls `refinementEngine.refine(task.taskId, actor.id, task.params)`.
3. **Task Loading**: Inside `RefinementEngine.refine`, the task definition is loaded from the `GameDataRepository`. Missing tasks throw `RefinementError` (`TASK_NOT_FOUND`).
4. **Method Selection**: `MethodSelectionService.selectMethod` receives `taskId`, `actorId`, and resolved `taskParams`. It assembles a refinement context via `ContextAssemblyService`, converts it into a condition context, executes JSON Logic applicability checks per method, and returns `{ selectedMethod, diagnostics }`.
5. **Fallback Handling**: If no method is applicable, `#handleNoApplicableMethod` consults `task.fallbackBehavior` and returns early results (`replan`, `skip`, or throws for `fail`), emitting `GOAP_EVENTS.REFINEMENT_STEP_*` events only if steps ran.
6. **Step Execution Loop**: `#executeMethodSteps` resolves a new `RefinementStateManager` instance from the DI container, initializes it, and iterates each step:
   - Emits `REFINEMENT_STEP_STARTED`.
   - Calls `ContextAssemblyService.assembleRefinementContext` with the current local state snapshot.
   - Routes to `PrimitiveActionStepExecutor` for `primitive_action` or `ConditionalStepExecutor` for `conditional` steps.
   - Collects results, dispatches `REFINEMENT_STEP_COMPLETED` (and `REFINEMENT_STATE_UPDATED` when `storeResultAs` succeeded) or `REFINEMENT_STEP_FAILED` and raises errors for replan/failure signals.
   - On completion, clears the state manager within `finally` to avoid leakage across refinements.
7. **Completion & Diagnostics**: When all steps succeed, `RefinementEngine` emits `REFINEMENT_COMPLETED`, logs duration, and returns `{ success: true, stepResults, methodId, taskId, actorId, timestamp }`. Exceptions trigger `REFINEMENT_FAILED` before rethrowing.

## Sequencing Pseudocode (`RefinementEngine.refine`)

```pseudo
function refine(taskId, actorId, taskParams):
  startTime = now()
  log + emit GOAP_EVENTS.REFINEMENT_STARTED
  task = loadTask(taskId)
  { selectedMethod, diagnostics } = methodSelectionService.selectMethod(taskId, actorId, taskParams, { enableDiagnostics: true })
  if !selectedMethod:
    return handleNoApplicableMethod(task, actorId, diagnostics)

  emit GOAP_EVENTS.METHOD_SELECTED(methodId = selectedMethod.id)
  stepResults = executeMethodSteps(selectedMethod, task, actorId, taskParams)

  emit GOAP_EVENTS.REFINEMENT_COMPLETED(taskId, methodId, stepsExecuted = stepResults.length)
  return { success: true, stepResults, methodId: selectedMethod.id, taskId, actorId, timestamp: now() }

catch (error):
  emit GOAP_EVENTS.REFINEMENT_FAILED(taskId, actorId, reason = error.message)
  throw error
```

`executeMethodSteps` expands as:

```pseudo
resolve tokens.IRefinementStateManager from container
stateManager.initialize()
try:
  for each step with index:
    emit REFINEMENT_STEP_STARTED
    context = contextAssemblyService.assembleRefinementContext(actorId, { id: task.id, params: taskParams }, stateManager.getSnapshot())
    oldValue = stateManager.has(storeResultAs) ? stateManager.get(storeResultAs) : undefined
    if step.stepType === 'primitive_action':
      result = primitiveActionStepExecutor.execute(step, context, index)
    else if step.stepType === 'conditional':
      result = conditionalStepExecutor.execute(step, context, index)
    else throw RefinementError('INVALID_STEP_TYPE')
    emit REFINEMENT_STEP_COMPLETED
    if storeResultAs && result.success:
      emit REFINEMENT_STATE_UPDATED (with old/new values)
    if !result.success and result.data?.replanRequested:
      throw RefinementError('STEP_REPLAN_REQUESTED', ...)
catch (error):
  emit REFINEMENT_STEP_FAILED
  throw
finally:
  stateManager.clear()
```

## Public Entry Point Contracts

### `RefinementEngine.refine(taskId, actorId, taskParams)`

- **Parameters**: string `taskId`, string `actorId`, object `taskParams` (resolved planner params).
- **Returns**: `Promise<{ success, stepResults[], methodId, taskId, actorId, timestamp, replan?, skipped?, error? }>`.
- **Side effects**: Emits `GOAP_EVENTS.REFINEMENT_STARTED|METHOD_SELECTED|STEP_*|COMPLETED|FAILED`, logs info/warn/error lines, and may throw `RefinementError` for critical failures.
- **Notes**: Step results are ordered execution logs that higher layers use to derive action hints; callers should inspect `replan`/`skipped` flags for fallback handling.

### `MethodSelectionService.selectMethod(taskId, actorId, taskParams, { enableDiagnostics = true })`

- **Parameters**: string IDs plus task params; optional diagnostics flag.
- **Returns**: `{ selectedMethod: object|null, diagnostics: { methodsEvaluated, evaluationResults[] } }`.
- **Side effects**: Reads tasks/refinement methods from `GameDataRepository`, uses `ContextAssemblyService` to assemble contexts, and logs warnings when evaluations fail.
- **Failure modes**: Throws `MethodSelectionError` if task/method definitions are missing or mismatched. Does not throw when no method is applicable.

### `PrimitiveActionStepExecutor.execute(step, context, stepIndex)`

- **Parameters**: Step schema object (`stepType = 'primitive_action'`, `actionId`, optional `targetBindings`, `parameters`, `storeResultAs`), refinement context (actor/task/localState), numeric index.
- **Returns**: `Promise<{ success, data, error?, timestamp, actionId }>`; failures return structured result instead of throwing.
- **Side effects**: Resolves actions via `actionIndex`, binds targets through `ParameterResolutionService`, executes operations, stores results in a fresh `RefinementStateManager`, and logs per-step telemetry.
- **Notes**: Throws `StepExecutionError` for invalid action IDs/step shapes; still clears/updates state via the manager before returning failure results.

### `ConditionalStepExecutor.execute(step, context, stepIndex, currentDepth = 0)`

- **Parameters**: Conditional step schema (`condition`, `thenSteps`, optional `elseSteps`, optional `onFailure`, optional `description`), refinement context, step index, recursion depth tracker.
- **Returns**: `Promise<{ success, data: { branch, branchResults[] }, conditionResult }>` or failure payload with `error` and optional `data.replanRequested`.
- **Side effects**: Uses `ContextAssemblyService` → `assembleConditionContext`, calls PrimitiveActionStepExecutor/itself for nested steps, and logs depth/branch decisions.
- **Failure modes**: Throws `StepExecutionError` if nesting exceeds `MAX_NESTING_DEPTH` (3) or schema is invalid; otherwise returns structured failures honoring `onFailure` semantics (e.g., `replan` requests).

### `ParameterResolutionService.resolve(reference, context, options)`

- **Parameters**: dot-notation string reference (e.g., `task.params.targetId`), context from `ContextAssemblyService`, optional `{ validateEntity = true, contextType, stepIndex }`.
- **Returns**: The resolved value (primitive/object) pulled from the provided context.
- **Side effects**: Caches resolved values per reference/contextType/stepIndex combination and logs cache hits/misses. May query the entity manager to ensure entity IDs exist when `validateEntity` is enabled.
- **Failure modes**: Throws `ParameterResolutionError` when the path is invalid, missing, or points to non-existing entities; failures include partial path metadata to aid debugging.

## Related References

- [`docs/goap/refinement-parameter-binding.md`](./refinement-parameter-binding.md) explains how `storeResultAs` data flows into later steps and how to model bindings.
- [`docs/goap/refinement-condition-context.md`](./refinement-condition-context.md) describes the JSON Logic shape assembled by `ContextAssemblyService`.
- [`docs/goap/refinement-action-references.md`](./refinement-action-references.md) covers action registry expectations referenced by `PrimitiveActionStepExecutor`.
- [`archive/GOAPIMPL/goapimpl__residual__refinement-implementation-guide.md`](../archive/GOAPIMPL/goapimpl__residual__refinement-implementation-guide.md) captures the residual requirements that motivated this guide; consult it for historical rationale and future tickets (`GOARESREFIMPGUI-002/003`).

## Fallback Behaviors and Failure Flow

### Task-level `fallbackBehavior`

- **Truth source**: `RefinementEngine.#handleNoApplicableMethod` in `src/goap/refinement/refinementEngine.js` and `GoapController.decideTurn/#handleRefinementFailure` in `src/goap/controllers/goapController.js` lines 560-640 & 1384-1520.
- **When it runs**: triggered when `MethodSelectionService.selectMethod` returns `selectedMethod = null` because no `refinementMethods` were applicable. Diagnostics from method selection are forwarded regardless of fallback.
- **Behaviors**:
  | `task.fallbackBehavior` | Engine result | Controller reaction | Observability |
  | --- | --- | --- | --- |
  | `replan` (default) | `{ success: false, replan: true, reason: 'no_applicable_method' }` | `GoapController.decideTurn` clears the active plan immediately and exits so replanning happens on the next turn. | `GOAP_EVENTS.REFINEMENT_STEP_*` are **not** emitted (no steps ran); `REFINEMENT_STARTED`/`METHOD_SELECTED` fire earlier; `RefinementEngine` logs `No applicable method`. Verified by `tests/unit/goap/refinement/refinementEngine.test.js` "should handle no applicable method with fallbackBehavior=replan".
  | `continue` | `{ success: true, skipped: true }` | Controller advances to the next task without clearing the plan. This path keeps plan metrics intact but dispatches `Task skipped` logs (see `#decideTurn` lines 612-624). | Only lifecycle events around method selection fire; no failure event. Covered by `tests/unit/goap/refinement/refinementEngine.test.js` "fallbackBehavior=continue".
  | `fail` | throws `RefinementError('NO_APPLICABLE_METHOD')` | Controller bubbles the exception; upstream handlers treat it as a critical failure and track failed goals. | `GOAP_EVENTS.REFINEMENT_FAILED` is emitted during the catch block in `RefinementEngine.refine`. Exercised by `tests/unit/goap/refinement/refinementEngine.test.js` "fallbackBehavior=fail".
  | Unknown value | throws `RefinementError('INVALID_FALLBACK_BEHAVIOR')` | Caller should fix the task definition; controller treats it like any refinement failure and replans. | Unit test `should handle unknown fallback behavior` documents the path.

### Conditional-step `onFailure`

- **Truth source**: `ConditionalStepExecutor.#handleStepFailure` in `src/goap/refinement/steps/conditionalStepExecutor.js` lines 250-339.
- **Modes**:
  - `fail`: converts branch failure into a thrown `StepExecutionError`. Because it throws, `RefinementEngine` catches the rejection, emits `REFINEMENT_STEP_FAILED`, and propagates the error to the controller.
  - `skip`: returns `{ success: true, data: { skipped: true } }` so `RefinementEngine` keeps executing later steps. Controller never sees a failure but diagnostic logs explain the skip.
  - `replan` (default): returns `{ success: false, data.replanRequested: true }`. `RefinementEngine.#executeMethodSteps` inspects `result.data.replanRequested` and throws `RefinementError('STEP_REPLAN_REQUESTED')`, which in turn causes `GoapController` to clear the plan and replan. Covered by `tests/unit/goap/refinement/refinementEngine.test.js` "should handle step requesting replan".

### Controller retries and diagnostics visibility

- `GoapController.decideTurn` always checks `refinementResult.replan` before inspecting `success` to guarantee replans happen even when a method partially succeeded (`src/goap/controllers/goapController.js:598-608`).
- When `refinementResult.skipped` is true, the controller advances the plan pointer but keeps refinement diagnostics so tooling can explain why tasks skipped.
- `GoapController.#handleRefinementFailure` maps downstream fallbacks (`replan`, `continue`, `fail`, `idle`) to retries, recursion limits, and goal tracking. Even though `RefinementEngine` only emits `replan/continue/fail` at the task level, the controller normalizes anything missing by treating unknown values as `replan`.
- Method-selection diagnostics (`diagnostics.methodsEvaluated`, `evaluationResults`) are logged regardless of fallback, giving tooling insight without needing to reproduce the full run.

## Refinement Failure Codes and Emitters

| Code / Error                                            | Raised by                                                                                                              | Events dispatched                                                                          | Caller expectation                                                                                                                                          | Tests / References                                                                                                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `TASK_NOT_FOUND`, `TASK_LOAD_ERROR` (`RefinementError`) | `RefinementEngine.#loadTask` when `GameDataRepository.getTask` misses or throws                                        | `GOAP_EVENTS.REFINEMENT_FAILED` with `reason` message                                      | Controller treats as critical failure and clears plan. Verify task IDs before invoking refine.                                                              | `src/goap/refinement/refinementEngine.js` lines 260-314, `tests/e2e/goap/refinementEngine.e2e.test.js` ("missing task" scenario).         |
| `NO_APPLICABLE_METHOD` (`RefinementError`)              | `#handleNoApplicableMethod` when fallback=`fail`                                                                       | `REFINEMENT_FAILED` before the exception propagates                                        | Either add an applicable method or change fallback to `continue/replan`. Controller surfaces this to logging via `GoapController.#handleRefinementFailure`. | `tests/unit/goap/refinement/refinementEngine.test.js` fallback cases.                                                                     |
| `INVALID_FALLBACK_BEHAVIOR` (`RefinementError`)         | `#handleNoApplicableMethod` when fallback value is unrecognized                                                        | `REFINEMENT_FAILED`                                                                        | Fix the task definition; controller treats it like `replan`.                                                                                                | `tests/unit/goap/refinement/refinementEngine.test.js` "unknown fallback behavior".                                                        |
| `INVALID_STEP_TYPE` (`RefinementError`)                 | `#executeMethodSteps` when step.stepType is not `primitive_action` or `conditional`                                    | `REFINEMENT_STEP_FAILED` then `REFINEMENT_FAILED`                                          | Update the method schema or register a new executor. Planner halts the task.                                                                                | `tests/unit/goap/refinement/refinementEngine.test.js` "unknown step type".                                                                |
| `STEP_REPLAN_REQUESTED` (`RefinementError`)             | `#executeMethodSteps` when a conditional returns `{ replanRequested: true }`                                           | `REFINEMENT_STEP_FAILED`, `REFINEMENT_FAILED`                                              | Controller observes `replan` and clears the active plan.                                                                                                    | `tests/unit/goap/refinement/refinementEngine.test.js` "should handle step requesting replan".                                             |
| `GOAP_REFINEMENT_INVALID_STATE_KEY` (`RefinementError`) | `RefinementStateManager.store` when `storeResultAs` is malformed                                                       | No GOAP event; exception bubbles up to `RefinementEngine` and triggers `REFINEMENT_FAILED` | Fix the step schema; diagnostics include the invalid key and regex.                                                                                         | `src/goap/refinement/refinementStateManager.js` lines 64-122 plus `tests/unit/goap/refinement/refinementStateManager.test.js`.            |
| `StepExecutionError` (various reasons)                  | `ConditionalStepExecutor` for excessive nesting, invalid schema, or `onFailure=fail`; also used by primitive executors | `REFINEMENT_STEP_FAILED` (caught by engine) followed by controller fallback handling       | The controller treats thrown step errors as task failures and routes through `#handleRefinementFailure`.                                                    | `src/goap/refinement/steps/conditionalStepExecutor.js`, `tests/unit/goap/refinement/refinementEngine.test.js` (conditional branch tests). |

## Diagnostics and Trace Capture

- **Primary tools**: `GOAPDebugger`, `RefinementTracer`, and `PlanInspector` live under `docs/goap/debugging-tools.md` and `docs/goap/debugging-multi-action.md`. Resolve `tokens.IGOAPDebugger` (preferred) or manually instantiate the debugger/plan inspector/refinement tracer stack shown in the multi-action debugging guide. The tracer already subscribes to the same `createGoapEventDispatcher()` instance that `RefinementEngine` resolves, so calling `goapDebugger.startTrace(actorId)` before `GoapController.decideTurn` mirrors the live event stream.
- **Capture workflow**:
  1. `goapDebugger.startTrace(actorId)` to attach the tracer.
  2. Execute the failing turn (`await goapController.decideTurn(actor, world)`); `RefinementEngine` will emit `GOAP_EVENTS.REFINEMENT_*`/`TASK_REFINED` plus any controller-side failures.
  3. Call `goapDebugger.stopTrace(actorId)` or `generateReport(actorId)` to retrieve the formatted trace + failure history. The report automatically stitches in the controller’s `#handleRefinementFailure` output and the plan inspector snapshot so you can see which method/task combination failed.
  4. When you need structured payloads, use `goapDebugger.getTrace(actorId)` (JSON) or hook `createGoapEventTraceProbe()` directly (see `tests/integration/goap/testFixtures/goapTestSetup.js` for the helper `setup.bootstrapEventTraceProbe()`). The probe surfaces `{ eventType, payload }` exactly as emitted by `RefinementEngine`/`GoapController`.
- **Event-to-tool map** (truth source: `src/goap/events/goapEvents.js`):

  | Event                                                  | Emitted by                                            | Key payload fields                                               | Inspect via                                                  |
  | ------------------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
  | `goap:refinement_started` / `goap:method_selected`     | `RefinementEngine.refine` (lines 220-320)             | `{ actorId, taskId, methodId }`                                  | Refinement Tracer timeline, GOAP event trace probe           |
  | `goap:refinement_step_started/completed/failed`        | `#executeMethodSteps`                                 | `{ stepIndex, step, result/error, duration }`                    | Refinement Tracer, Plan Inspector "Refinement Trace" section |
  | `goap:refinement_state_updated`                        | `RefinementStateManager.store` via `RefinementEngine` | `{ key, oldValue, newValue }`                                    | Refinement Tracer (state delta rows)                         |
  | `goap:refinement_completed` / `goap:refinement_failed` | `RefinementEngine.refine` catch/finally               | `{ success, fallbackBehavior, reason }`                          | GOAPDebugger failure history, event trace probe              |
  | `goap:task_refined` + `goap:action_hint_*`             | `GoapController.decideTurn/#extractActionHint`        | `{ stepsGenerated, actionRefs }`, `{ actionId, targetBindings }` | Action executor logs, Plan Inspector pending actions view    |

- **Planner/event bus/action executor integration**:
  - `GoapController.decideTurn` (`src/goap/controllers/goapController.js:560-720`) dispatches refinement events on the same dispatcher instance that the planner uses (`createGoapEventDispatcher`). Hooking a tracer or probe at the dispatcher level automatically captures planning and refinement events in timestamp order.
  - The controller seals the feedback loop by relaying `RefinementEngine` results to plan advancement and to `#extractActionHint` (`src/goap/controllers/goapController.js:1136-1220`). `GOAP_EVENTS.ACTION_HINT_GENERATED/FAILED` fire immediately before the action executor receives work, so instrumentation added near the action layer can correlate action failures with the trace payload (`actionId`, `targetBindings`).
  - Event payloads follow the `(eventType, payload)` contract enforced by `validateEventBusContract` and `createGoapEventDispatcher` (see `src/goap/debug/goapEventDispatcher.js`). If you add observers, attach them via `createGoapEventTraceProbe()` or the DI-registered `goapEventDispatcher` rather than piping through raw event bus listeners—doing so preserves compliance metrics surfaced in the GOAP debugger diagnostics contract.
- **Discoverability tips**:
  - Cross-link new debugging content back into `docs/goap/debugging-tools.md#refinement-tracer` and `docs/goap/debugging-multi-action.md#using-goap-debugger` so contributors land on the canonical walkthroughs.
  - When filing new issues, include trace IDs or snapshots taken from `goapDebugger.generateReportJSON(actorId)`; downstream maintainers can replay event sequences using the probe fixtures in `tests/integration/goap/testFixtures/goapTestSetup.js`.

## Testing Refinement Changes

- **Canonical suites**:

  | Suite                                                                 | Focus                                                                                                                                | Typical command                                                                        |
  | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
  | `tests/unit/goap/refinement/refinementEngine.test.js`                 | Method selection, fallback handling, state lifecycle, replan/skip flows.                                                             | `npm run test:unit -- refinement/refinement/refinementEngine.test.js --runInBand`      |
  | `tests/integration/goap/refinementEngine.integration.test.js`         | End-to-end refinement through `GoapController` + DI container, verifies GOAP event ordering and Plan Inspector snapshots.            | `npm run test:integration -- refinementEngine.integration.test.js --runInBand`         |
  | `tests/integration/goap/primitiveActionExecution.integration.test.js` | Primitive executor + action registry interactions, including `storeResultAs` serialization and action hint extraction prerequisites. | `npm run test:integration -- primitiveActionExecution.integration.test.js --runInBand` |
  | `tests/integration/goap/parameterResolution.integration.test.js`      | Parameter resolution guarantees, error codes, and entity validation that refinement relies on.                                       | `npm run test:integration -- parameterResolution.integration.test.js --runInBand`      |

  Append `--runInBand` (see `AGENTS.md`) to avoid the known Jest worker force-exit issue when running any subset of these suites locally or in CI.

- **When to add/extend tests**:
  - Add/extend **unit tests** when you touch `RefinementEngine`, `RefinementStateManager`, or `MethodSelectionService` contracts. Use `tests/unit/goap/refinement/__mocks__` and `tests/common/mocks/createEventBusMock.js` to isolate dependencies.
  - Prefer **integration tests** when changes involve event ordering, state snapshots, or the controller/refinement handshake. Bootstrap the harness with `tests/integration/goap/testFixtures/goapTestSetup.js#bootstrapEventTraceProbe()` so your suite benefits from the shared dispatcher + trace probe instrumentation.
  - When expanding primitive or conditional executors, pair doc updates with tests in `tests/integration/goap/primitiveActionExecution.integration.test.js` or `tests/unit/goap/refinement/steps/*.test.js` to capture new edge cases (e.g., new `onFailure` semantics). Document the invariant in the guide, reference the new test name, and keep fixtures inside `tests/integration/goap/testFixtures/` for reusability.
- **Updating fixtures**: any new method/task definitions used by tests should live under `tests/integration/goap/testFixtures/data/mods/` so contributors can run the same commands described above without mutating the production `data/mods` packs.
- **CI expectations**: `npm run lint` and the relevant `test:*` tasks must pass before merging documentation that prescribes new behavior. Include trace samples or Jest output links when referencing new invariants in PRs so reviewers can see how the tests enforce the described behavior.

## Refinement Local State Management

- **Scope**: Every call to `RefinementEngine.refine` resolves a fresh `RefinementStateManager` via the DI container token `IRefinementStateManager` (`src/goap/refinement/refinementEngine.js` lines 411-437). The manager is initialized before the loop and cleared in a `finally` block to guarantee isolation even on exceptions.
- **Consumers**: Primitive and conditional executors store step results through `storeResultAs`. `ContextAssemblyService.assembleRefinementContext` receives `refinementStateManager.getSnapshot()` for each step so condition evaluation always sees the most recent immutable snapshot.
- **Guidelines for new steps / long-running primitives**:
  - Use unique `storeResultAs` identifiers that match the `^[a-zA-Z_][a-zA-Z0-9_]*$` pattern enforced by `RefinementStateManager`. Invalid keys throw immediately, so prefer names like `pickedItem` over `picked-item`.
  - Persist only serializable data (plain objects, numbers, strings). The snapshot is deep-frozen; storing proxies or class instances will break consumers.
  - Never cache the manager instance outside of the executor. Request the container inside `execute` if a new helper needs access so per-run isolation stays intact.
  - Clean up any long-running operations that reference `localState`. When `RefinementEngine` clears the manager after a method, lingering references become stale and should not be reused in later refinements.
- **Tests**: `tests/unit/goap/refinement/refinementEngine.test.js` (state lifecycle, snapshots) and `tests/unit/goap/refinement/refinementStateManager.test.js` cover initialization, storage validation, and cleanup guarantees.

## Current Limitations and Assumptions

- `ContextAssemblyService` currently returns placeholder world data (`world.locations`/`world.time` are empty objects) and knowledge limiting defaults to omniscient mode unless the experimental `enableKnowledgeLimitation` flag is set. Contributors should not rely on full world snapshots yet (`src/goap/services/contextAssemblyService.js`).
- Parameter resolution validates entity existence when `validateEntity` is true, but knowledge-filtered lookups are deferred until GOAPIMPL-023—treat all task parameters as already resolved entity IDs for now (`src/goap/services/parameterResolutionService.js`).
- Only two step types are supported (`primitive_action`, `conditional`). Adding new types requires updating `RefinementEngine.#executeMethodSteps` and registering executors; until then, schema authors must stick to the supported set.
- Diagnostics are opt-out: `MethodSelectionService.selectMethod` forces `{ enableDiagnostics: true }` from the engine. This means mod authors should expect extra log noise when applicability checks fail until we add per-environment toggles.
- Action hint extraction still assumes the first step exposes `actionId`/`targetBindings`; multitask hints are covered by GOARESREFIMPGUI-003, so do not promise hints for conditional-first methods yet.

## Runtime Invariants

- **One state manager per refinement**: `RefinementEngine` resolves the DI token once per `refine` call and clears it in `finally`. `tests/unit/goap/refinement/refinementEngine.test.js` asserts `initialize` happens before any step executes and `clear` always runs.
- **Deterministic event ordering**: Events fire in the sequence `REFINEMENT_STARTED → METHOD_SELECTED → REFINEMENT_STEP_* → REFINEMENT_COMPLETED/FAILED`. Both unit and `tests/e2e/goap/refinementEngine.e2e.test.js` cases assert dispatch order for success and failure runs.
- **Diagnostics enabled by default**: `selectMethod` is always invoked with `{ enableDiagnostics: true }`, so logs and fallback payloads always contain evaluation traces even outside dev builds.
- **Context resolved per step**: Each iteration of `#executeMethodSteps` invokes `ContextAssemblyService.assembleRefinementContext` with the latest snapshot. This guarantees parameter binding sees deterministic state regardless of concurrent refinements.
- **Parameter contexts resolved before execution**: Executors never call into operations until `ContextAssemblyService` returns a full actor/task/refinement object; failures during context assembly bubble up as `ContextAssemblyError`, keeping runtime invariants explicit in logs.
- **Diagnostics visibility**: `GoapController` persists `refinementResult` metadata (methodId, replan/skipped flags, timestamps) for later telemetry even if no action hint is emitted, ensuring tooling can reconstruct what happened from logs alone (`src/goap/controllers/goapController.js:1040-1080`).

Use these invariants as guardrails when extending the system—new features should either uphold them or document why a deviation is intentional.
