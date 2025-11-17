# GOAP Planning Preconditions Normalization

## Background
Recent failures in `tests/integration/goap/replanning.integration.test.js` highlighted that some test tasks (and by extension legacy mods) still define task gating rules under a plain `preconditions` array. The modern GOAP pipeline described in `specs/goap-system-specs.md` expects every planner-facing task to expose structured `planningPreconditions`. Because the planner and `PlanInvalidationDetector` only consumed `planningPreconditions`, tasks that still used the legacy field were silently accepted during planning and never re-validated during turn two, causing undetected plan drift.

## Goals
- Guarantee that every planner entry point (applicability filtering, relaxed planning graph heuristic, plan invalidation) evaluates the same normalized set of preconditions.
- Preserve backwards compatibility with mods/tests that have not migrated to `planningPreconditions`, while surfacing deprecation warnings so content authors can detect the mismatch immediately (see diagnostics guidance in `docs/goap/debugging-tools.md`).
- Keep the normalization logic centralized so future components (e.g., refinement fallback, diagnostics exporters) cannot drift again.

## Functional Requirements
1. Introduce a shared helper (currently `normalizePlanningPreconditions`) that:
   - Returns canonical `{ description, condition }` entries.
   - Falls back to `preconditions` when `planningPreconditions` is absent, logging a one-time warning per task ID.
   - Deep-clones condition payloads so downstream evaluators cannot mutate shared references.
2. `GoapPlanner.#getApplicableTasks`, `PlanInvalidationDetector.checkPlanValidity`, and any other planner heuristics must consume the helper’s output exclusively; no module should read `task.planningPreconditions` directly.
3. When `GOAP_STATE_ASSERT=1` is enabled, the warning emitted for legacy tasks should be promoted to a test failure so CI catches regressions early.
4. Diagnostics payloads produced by `GOAPDebugger` must include the normalized view so instrumenting tools show the exact conditions used during evaluation, matching the contracts documented in `docs/goap/debugging-tools.md#diagnostics-contract`.

## Observability & Alerts
- Emit `goap:task_preconditions_normalized` events (or extend existing diagnostics) whenever a task is auto-converted. Include `taskId`, `sourceField` (`preconditions` vs `planningPreconditions`), and the number of entries converted.
- Surface the one-time warning in both the logger and the GOAP diagnostics contract so the Designer UI highlights misconfigured tasks even outside Jest.
- Extend integration tests to assert that the warning is produced when legacy fields are encountered, ensuring we immediately notice if logging is removed.

## Testing Strategy
- Maintain `tests/integration/goap/replanning.integration.test.js` as the primary guard for mid-turn invalidation.
- Add a focused unit test for `normalizePlanningPreconditions` that covers:
  1. Modern `{ description, condition }` entries.
  2. Legacy JSON Logic blobs.
  3. Entries that only carry `description` (ensure fallback condition is tautological instead of crashing).
- Augment planner/invalidation detector tests to assert they call the helper by stubbing it (or by inspecting warnings) so future refactors cannot bypass the shim.

## Migration Expectations
- Content authors must migrate mods to the `planningPreconditions` schema. The helper is a safety net, not a permanent API.
- When the mod ecosystem is fully migrated, consider flipping the helper to throw (instead of warn) whenever `preconditions` is used, and update `docs/goap/modding` accordingly.

By centralizing the normalization logic and treating the warnings as part of the diagnostics contract, we make the production code both more flexible (legacy content still works) and more observable (we know immediately when the wrong field is used), preventing the replanning regressions described in this incident.
