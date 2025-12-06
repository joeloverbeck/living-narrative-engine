# GOAPLASTOCRIHAR-003 - Harden stopping criteria telemetry and numeric guard failures

## Status

Completed

## Summary

- Verified that the current planner already bypasses feasibility gates when `maxCost` is `Infinity`, and fails fast with `ESTIMATED_COST_EXCEEDS_LIMIT` when `maxCost` is `0`; no behavioral change is required for those pre-checks, but telemetry must document these cases.
- Standardize every stopping-criteria exit (cost pruning, action pruning, node limit, numeric guard exhaustion, and explicit node/time limit guards) so they emit a single structured `logger.warn` payload that always includes `actorId`, `goalId`, `nodesExpanded`, `closedSetSize`, normalized `maxCost`, normalized `maxActions`, `failureStats`, and a `failureCode` drawn from `GOAP_PLANNER_FAILURES`.
- Track cost-limit and action-limit pruning in `failureStats`, add dedicated failure codes for those scenarios, and make sure `this.#lastFailure` captures the enriched details for debugger tooling.
- Refresh the stopping-criteria unit tests to assert on the exact warn payloads (message, `failureCode`, stats) for cost-limit, action-limit, infinity-limit, zero-limit, and numeric guard exhaustion scenarios.

## File list

- `src/goap/planner/goapPlanner.js`
- `src/goap/planner/goapPlannerFailureReasons.js`
- `tests/unit/goap/planner/goapPlanner.stoppingCriteria.test.js`

## Out of scope

- Modifying how tasks are simulated or how heuristic costs are computed (covered by other tickets).
- Reworking the format of `GoapPlanner.plan` return values beyond adding diagnostic metadata inside log messages.
- Adding new numeric-goal guard helper modules beyond the telemetry hooks described above.

## Acceptance criteria

### Tests

- `npm run test:unit -- goapPlanner.stoppingCriteria`
- `npm run lint -- tests/unit/goap/planner/goapPlanner.stoppingCriteria.test.js`

### Invariants

- `GOAP_PLANNER_FAILURES` enum values and identifiers continue to exist; new failure codes (if any) must be additive, not replacements.
- Planner logs still leverage `logger.warn` / `logger.debug` from the injected logger rather than hard-coding console calls.
- Search metrics such as `nodesExpanded` and `closedSetSize` continue to reflect the actual exploration counts (no resetting just to satisfy logging).

## Outcome

- Added structured logging helpers inside `GoapPlanner` so every stop condition (quick cost fail, node/time limit exits, and open-list exhaustion due to numeric/cost/action guards) emits payloads with `actorId`, `goalId`, normalized `maxCost`, normalized `maxActions`, search stats, and `failureCode`.
- Introduced additive failure codes for cost-limit and action-limit exhaustion, tracked new stats (`costLimitHit`, `actionLimitHit`), and ensured `this.#lastFailure` captures the enriched diagnostics.
- Strengthened `goapPlanner.stoppingCriteria` unit tests to assert on warn payloads for cost, action, infinity, zero-limit, and numeric guard scenarios, plus lint coverage for the suite.
