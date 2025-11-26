# PERTESFLAANA-006: Stabilize SlotGenerator Performance Assertions with Percentiles

**Reference**: [Performance Test Flakiness Analysis](./performance-test-flakiness-analysis.md)

## Summary of Revised Scope
- The repository already calculates percentiles in several places (e.g., GOAP performance harnesses, rule testing utilities) and tracks them in `ActionPerformanceAnalyzer`.
- The SlotGenerator performance suite still depends on single aggregated timings per scenario, which remain noisy in CI despite relaxed thresholds from PERTESFLAANA-005.
- Provide a lightweight, test-only percentile helper and apply it to SlotGenerator to gate median/p95 timings across multiple samples instead of a single batch measurement.

## Problem Statement
- Existing SlotGenerator performance cases run one batch (1k iterations) and assert against that single run. Results vary 2-3x between environments.
- There is no shared helper for percentile sampling outside of the GOAP/rules-specific utilities, so performance tests duplicate timing logic.

## Files Expected to Touch
- `tests/helpers/performancePercentiles.js` (new): small utility to sample timings with warmup and calculate median/p95/p99.
- `tests/unit/helpers/performancePercentiles.test.js` (new): unit coverage for the helper (percentile math, warmup handling).
- `tests/performance/anatomy/slotGenerator.performance.test.js`: add a percentile-based assertion path for a representative template to reduce flakiness.

## Out of Scope
- Production code changes.
- Rewriting all performance suites to use the helper (only SlotGenerator is required here).
- Adjusting thresholds covered by PERTESFLAANA-005.

## Implementation Notes
- Use warmup iterations to avoid JIT outliers; keep sample sizes modest (e.g., 5 samples x 100 iterations) to avoid long test times.
- Percentile calculation can be simple (sorted array with ceiling-based rank); return median/p95/p99 along with mean/min/max for debugging.
- Helper should accept an injected `now` function to enable deterministic unit tests.

## Validation Checklist
- [x] Percentile helper implemented with unit tests.
- [x] SlotGenerator performance test includes a percentile-based assertion path using the helper.
- [x] Relevant tests pass (unit + SlotGenerator performance suite).
- [x] Ticket content archived with outcome.

## Outcome
- Added a lightweight percentile sampling helper for tests plus deterministic unit coverage.
- SlotGenerator performance suite now asserts median and p95 timings across multiple samples to limit CI variance.
- Updated ticket scope to reflect existing percentile utilities and focused changes.

## Status
- Completed.
