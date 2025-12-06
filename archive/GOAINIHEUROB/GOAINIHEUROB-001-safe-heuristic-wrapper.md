# GOAINIHEUROB-001: Harden #safeHeuristicEstimate contract

## Status

- Completed

## Summary

Reality check: `GoapPlanner.#safeHeuristicEstimate` already clamps NaN/Infinity/negative outputs and thrown heuristics to `SAFE_HEURISTIC_MAX_COST`, tags them with `sanitized`, and returns `{ estimate, sanitized, error }`. The warning dedupe helper (`#warnOnceForHeuristic`) is live and intentionally keyed by `(actorId, goalId, heuristicId)` rather than per phase, matching `archive/GOAINIHEUROB/goap-initial-heuristic-robustness.md`. Existing suites (`tests/unit/goap/planner/goapPlanner.heuristicGuards.test.js` and `goapPlanner.distanceGuard.property.test.js`) already exercise the wrapper, ensuring sanitized guards bypass heuristics without throwing. The ticket scope is therefore to confirm those contracts remain stable—no code rewrite is needed.

## Updated Scope

- Validate the current wrapper behavior via the existing heuristic guard/distance property suites.
- Document that deduped warnings fire once per actor/goal/heuristic tuple instead of per phase (the spec never required phase granularity).
- Leave planner state machine, telemetry payloads, and heuristic registry interfaces untouched.

## Acceptance Criteria

### Tests

- `npm run test:unit -- tests/unit/goap/planner/goapPlanner.heuristicGuards.test.js` still passes, covering NaN/Infinity/throwing heuristics and warning dedupe.
- `npm run test:unit -- tests/unit/goap/planner/goapPlanner.distanceGuard.property.test.js` remains green, proving sanitization never causes the guard to reject a task.

### Invariants

- `#safeHeuristicEstimate` keeps returning `{ estimate, sanitized, error }` without throwing.
- Sanitized estimates continue to equal `SAFE_HEURISTIC_MAX_COST` whenever a warning is emitted; unsanitized estimates remain untouched.
- The heuristic registry interface `(heuristicId, state, goal, taskLibrary)` stays unchanged and gets invoked exactly once per wrapper call.

## Outcome

- Ticket initially requested a wrapper rewrite, but the implementation already matched the spec; scope reduced to validation plus correcting the heuristic guard test so it exercises a non-initial failure path.
- Verified sanitization behavior by running `tests/unit/goap/planner/goapPlanner.heuristicGuards.test.js` and `goapPlanner.distanceGuard.property.test.js` under `npm run test:unit -- --runInBand`.
