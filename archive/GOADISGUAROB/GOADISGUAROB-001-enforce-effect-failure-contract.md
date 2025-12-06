# GOADISGUAROB-001 Enforce distance guard effect failure contract

Ensure `GoapPlanner.#taskReducesDistance` escalates invalid effect simulations via the documented `INVALID_EFFECT_DEFINITION` failure path instead of swallowing them, so downstream tooling never mistakes fatal content issues for guard results.

## Status

Completed — planner + tests updated per the revised scope.

## Ground truth check (Feb 2025)

- The distance guard already handles `{ success: false }` responses from `planningEffectsSimulator` by calling `#failForInvalidEffect`, and `tests/unit/goap/planner/goapPlanner.actionApplicability.test.js` already covers this path under “throws when effect simulation reports an invalid effect.”
- When `simulateEffects` throws (parameter resolution errors, unexpected runtime faults), `#taskReducesDistance` currently logs `'Failed to check distance reduction'` and returns `false`, which masks fatal authoring issues as guard rejections and never records effect telemetry.

## Revised scope

- `src/goap/planner/goapPlanner.js` — wrap `simulateEffects` with a guard that records telemetry and rethrows via `#failForInvalidEffect` when it throws, ensuring heuristics never run for invalid simulations.
- `tests/unit/goap/planner/goapPlanner.actionApplicability.test.js` — add coverage for thrown simulation errors to prove telemetry + failure propagation. Keep the existing `{ success: false }` test unchanged (already satisfies the contract).

## Out of scope

- Changes to heuristic sanitization or bypass logic (`#safeHeuristicEstimate`) — handled separately.
- Documentation edits in `docs/goap/*.md` — defer to the docs-focused ticket.
- Telemetry schema or logger transport changes outside `GoapPlanner`.

## Acceptance criteria

### Tests

- `npm run test:unit -- goapPlanner.actionApplicability` covers both `{ success: false }` responses and thrown simulation errors, ensuring they surface as planner failures.
- `npm run test:unit -- goapPlanner.heuristicGuards` continues to pass, confirming heuristic behavior is unaffected.

### Invariants

- `testTaskReducesDistance` never returns `false` because of effect failures; instead it throws an `Error` tagged with `code = GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION`.
- When a simulation fails, telemetry from `#recordEffectFailureTelemetry` fires before the error is thrown, and heuristic estimation is not invoked afterward.
- Logger breadcrumb `'Failed to check distance reduction'` appears only when an unexpected runtime exception escapes the simulation guard, preserving observability for rare crashes.

## Outcome

- Original brief asked for `{ success: false }` handling plus thrown simulation guards; investigation confirmed the unsuccessful-result path already threw via `#failForInvalidEffect`, so only the thrown error path plus telemetry/timing gaps required changes.
- Implemented the simulation try/catch guard in `GoapPlanner.#taskReducesDistance`, emitting telemetry and rethrowing via `#failForInvalidEffect` so no heuristic work runs after bad effects.
- Added a targeted unit test in `tests/unit/goap/planner/goapPlanner.actionApplicability.test.js` to prove thrown simulation errors now surface as planner failures and record telemetry, satisfying the new invariant.
