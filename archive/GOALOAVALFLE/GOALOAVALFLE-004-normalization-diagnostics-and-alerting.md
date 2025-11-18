# GOALOAVALFLE-004: Normalization Diagnostics and Alerting

**Status**: Completed
**Priority**: Medium
**Spec Reference**: `archive/GOALOAVALFLE/GOALOAVALFLE-001-goal-loader-validation-flexibility.md`

## Reality Check (May 2025)
- `normalizeGoalData` already returns `{ mutations, warnings }` and GoalLoader attaches that metadata to `_normalization`, but the loader only emits a single summary log (`Applied goal normalization mutations.`) with counts. Individual mutations—especially ones injected by extensions—never surface through diagnostics.
- Built-in normalization warnings (priority coercion, default scaffolding) log at `warn` level, yet they are unrelated to the mutation list and therefore unusable for counters like “fields auto-filled”.
- No aggregate counters or accessors exist; there is no place in the loader API/tests to assert how many goals mutated or were rejected during normalization.
- There is no switch to mute normalization diagnostics when designers intentionally fuzz payloads, even though the spec’s scope assumed one existed.

The ticket therefore needs to add instrumentation rather than just toggling a missing flag.

## Objective
Implement the observability hooks from Section 3.4 so normalization activity is transparent to designers, CI, and telemetry tooling.

## Scope & Tasks
1. Emit structured debug-level events for every mutation/warning returned by `normalizeGoalData`, including `modId`, `filename`, the mutation payload, and whether permissive mode (`GOAL_LOADER_ALLOW_DEFAULTS`) enabled the change. Cover extension hook output so nothing silently disappears.
2. Track per-session aggregate counters on the loader (`goalsProcessed`, `goalsWithMutations`, `goalsRejected`, `fieldsAutoFilled`, total mutations, warnings) that reset each time `loadItemsForMod` runs. Expose them via both structured logs and a `getNormalizationDiagnosticsSnapshot()` helper for CI dashboards.
3. Add an opt-out switch (`GOAL_LOADER_NORMALIZATION_DIAGNOSTICS=0`) that suppresses the per-mutation debug chatter but still maintains counters and emits the session summary at the end.
4. Extend the unit/contract suites to verify per-mutation logging payloads, counter math (including rejection paths), and the disable switch behavior.
5. Update documentation (GOAP debugging guide or README diagnostics section) showing how to enable/disable the logs, interpret the summary payload, and consume the accessor in CI.

## Deliverables
- Loader instrumentation for per-goal debug events + aggregate stats.
- Tests covering event emission and counter accuracy.
- Documentation describing how to observe normalization behavior locally and in CI.

## Acceptance Criteria
- Every normalization mutation results in a machine- and human-readable debug entry.
- Aggregate stats are exposed in at least one existing diagnostics channel and can trigger CI/pipeline alerts when thresholds exceed expectations.
- Tests prevent regressions in counter math or logging payloads.

## Dependencies / Notes
- Relies on normalization metadata from GOALOAVALFLE-002 and structured errors from GOALOAVALFLE-001.
- Consider pending answers to spec Open Question #3 before wiring HUD integration; leave TODOs if the decision is deferred.

## Outcome
- Implemented the missing instrumentation rather than flipping a flag: `GoalLoader` now logs every mutation/warning via `goal-normalization.*` events, tracks per-session counters with a reset per `loadItemsForMod`, and exposes a `getNormalizationDiagnosticsSnapshot()` helper for CI.
- Added the opt-out switch `GOAL_LOADER_NORMALIZATION_DIAGNOSTICS=0`, session-summary logging, doc updates showing how to consume the telemetry, and unit tests covering logging payloads, counter math, and rejection handling.
