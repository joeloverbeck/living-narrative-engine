# PERTESFLAANA-004: Add Memory Pressure Monitoring to GOAP System

**Reference**: [Performance Test Flakiness Analysis](../docs/analysis/performance-test-flakiness-analysis.md)

## Status
- Completed

## Summary

The GOAP planner already uses bounded caches and prunes failure history, but we still lack a lightweight way to observe how large those maps are during troubleshooting. Instead of introducing a new monitoring service, expose a small snapshot API so the existing monitoring stack can poll GOAP internals without altering hot paths.

## Problem Statement

- There is currently **no GOAP-specific memory telemetry** even though the planner already bounds its caches.
- Failure tracking maps are pruned by time, but their sizes are opaque to monitoring tools and cannot be used to set safety thresholds.
- The broader platform already has a `MemoryPressureManager`; we only need GOAP to surface metrics, not to add another monitoring loop.

## Files Expected to Touch

- `src/goap/planner/goapPlanner.js`
  - Expose cache sizing information for existing bounded caches.
- `src/goap/controllers/goapController.js`
  - Provide a snapshot helper that aggregates cache and failure-tracking sizes and classifies pressure levels.
- `tests/unit/goap/planner/goapPlanner.memoryMetrics.test.js`
  - Unit coverage for the new planner cache metrics helper.
- `tests/unit/goap/controllers/goapController.memoryMonitoring.test.js`
  - Unit coverage for the controller snapshot and pressure classification.

## Out of Scope

- Adding a new monitoring service or event type.
- Changing cache eviction policies (handled by PERTESFLAANA-001).
- Altering pruning semantics for failure tracking (handled by PERTESFLAANA-002).
- Modifying the planning algorithm, heuristics, or performance thresholds.
- Wiring into the global MemoryPressureManager beyond exposing data.

## Implementation Details

- Add `getCacheMetrics()` (or equivalent) to `GoapPlanner` to return sizes and configured limits for bounded caches.
- Add `getMemoryPressureSnapshot({ thresholds? })` to `GoapController` that returns:
  - Cache metrics from the planner (if supported).
  - Counts for failed goals/tasks and diagnostics maps after pruning.
  - A derived `pressureLevel` of `none | warning | critical` based on optional thresholds (default conservative values).
- Keep the feature opt-in: no behavioural changes to decision making; the helper should be side-effect free aside from optional logging.

## Validation Checklist

- [x] Planner exposes cache metrics without mutating cache behaviour.
- [x] Controller aggregates and classifies metrics into a snapshot helper.
- [x] Unit tests cover normal and threshold-crossing cases.
- [x] Relevant unit test suites pass.

## Future Enhancements

- Emit a dedicated GOAP event for memory pressure once the monitoring bus standardises on an event shape.
- Surface per-actor failure counts if storage ever becomes actor-scoped.

## Outcome

- Added cache metrics exposure to `GoapPlanner` and a snapshot helper on `GoapController` instead of introducing a new monitoring service.
- Documented and tested pressure classification logic with focused unit tests.
