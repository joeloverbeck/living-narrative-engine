# GOAPLASTOCRIHAR-002 - Guard heuristic results to prevent invalid PlanningNodes

## Status

- Completed: ✅
- Owner update: helper + tests landed, ticket archived with verified runs (`npm run test:unit -- --runInBand goapPlanner.stoppingCriteria`, `npm run test:unit -- --runInBand goapPlanner.heuristicGuards`). Targeted lint run on new tests succeeded; `goapPlanner.js` continues to flag pre-existing `goap/no-raw-state` lint warnings unrelated to this scope.

## Summary (updated after code review)

- All six `heuristicRegistry.calculate` call sites inside `GoapPlanner` currently invoke the registry directly. They simply bubble up thrown errors (wherever the surrounding call happens to catch) and will pass `NaN`, `undefined`, or negative results straight into `PlanningNode`, which then throws due to its strict score validation. `#taskReducesDistance` only guards against non-finite values, so negative heuristics or thrown errors still leak through other call paths.
- To keep planning resilient when heuristics misbehave, add a dedicated `#safeHeuristicEstimate` helper that wraps every `heuristicRegistry.calculate` invocation in `GoapPlanner`. The helper must catch exceptions, coerce non-finite/negative outputs into a bounded non-negative cost (use `Number.MAX_SAFE_INTEGER` as the cap), and remember if it already warned for a particular `(actorId, goalId, heuristicId)` tuple so we only log once per combination.
- The sanitized helper must be used by the feasibility check, the preflight numeric guard evaluation (`#taskReducesDistance`), the initial node creation, the successor expansion loop, and the reuse-distance comparison so PlanningNode never receives invalid scores.
- There is no dedicated heuristic-guard unit suite yet, so create `tests/unit/goap/planner/goapPlanner.heuristicGuards.test.js` to focus on NaN/negative/throwing heuristics. Strengthen the existing stopping-criteria coverage only insofar as it relies on the new helper—do not rewrite unrelated tests.

## Current test and code gaps

- `PlanningNode` already enforces non-negative numeric `gScore`/`hScore`, but there are no Jest tests that simulate misbehaving heuristics flowing through `GoapPlanner` to assert planner resilience.
- The acceptance criteria referenced `goapPlanner.heuristicGuards` despite that suite not existing; it now needs to be added alongside targeted mocks to verify logging and sanitization behavior.
- Logger warnings currently fire every time a heuristic call fails, which can spam logs. Deduplicating warnings inside the new helper must be part of scope.

## File list

- `src/goap/planner/goapPlanner.js`
- `src/goap/planner/planningNode.js`
- `tests/unit/goap/planner/goapPlanner.stoppingCriteria.test.js`
- `tests/unit/goap/planner/goapPlanner.heuristicGuards.test.js`

## Out of scope

- Changing heuristic algorithms themselves or adding new heuristic IDs.
- Relaxing `PlanningNode`'s invariant that `gScore`/`hScore` must be non-negative.

## Acceptance criteria

### Tests

- `npm run test:unit -- goapPlanner.stoppingCriteria`
- `npm run test:unit -- goapPlanner.heuristicGuards`
- `npm run lint` only on the modified files.

### Invariants

- `heuristicRegistry.calculate(heuristicId, state, goal, taskLibrary)` keeps its current signature and still returns plain numbers to callers.
- `PlanningNode` continues to throw if code tries to instantiate it with negative/NaN scores; the new helper must prevent those situations rather than silencing them inside the constructor.
- Planner telemetry (`failureCode`, `failureStats`) is only augmented, never renamed or removed.

## Outcome

- Added `#safeHeuristicEstimate` with per-actor/goal/heuristic warning dedupe, stateful sanitization metadata, and logging so A\* nodes always receive finite, non-negative heuristics.
- Threaded the helper through cost estimation, initial node construction, successor evaluation, numeric guards, and reuse gates; guards now bypass distance comparisons when heuristics misbehave instead of exploding.
- Created `tests/unit/goap/planner/goapPlanner.heuristicGuards.test.js` to exercise NaN/throwing heuristics along with the new warning behavior, and verified existing stopping-criteria suite still passes under the new plumbing.
