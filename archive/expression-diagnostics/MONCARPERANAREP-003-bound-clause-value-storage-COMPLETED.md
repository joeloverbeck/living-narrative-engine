# MONCARPERANAREP-003: Bound observed/violation value storage in HierarchicalClauseNode

## Goal
Prevent unbounded memory growth by limiting stored observed and violation values using a bounded sampling strategy, while preserving accurate min/max tracking and representative percentiles.

## Assumptions (reassessed)
- `HierarchicalClauseNode` currently stores *all* violation and observed values with no cap; there is no existing sampling mechanism for either array.
- `advancedMetricsConfig` only includes `maxViolationsSampled` (set to `Infinity`) and does **not** provide a limit for observed values.
- There is no separate total-count tracking for sampled arrays (only array length is available).
- The existing percentiles are derived from whatever values are stored in the arrays.

## Scope updates
- Add a bounded sampling strategy for **both** violation values and observed values.
- Track total counts for violations/observations separately from sampled storage (to document representativeness).
- Wire new observed sampling limit to `advancedMetricsConfig` alongside `maxViolationsSampled`.
- Update/extend unit tests that explicitly assert sample sizes or serialization payloads.

## File list (expected to touch)
- src/expressionDiagnostics/models/HierarchicalClauseNode.js
- src/expressionDiagnostics/config/advancedMetricsConfig.js
- tests/unit/expressionDiagnostics/models/HierarchicalClauseNode.test.js

## Work items
- Implement bounded storage for observed values and violation values (e.g., reservoir sampling or a fixed-size cap).
- Track total counts separately from stored samples so percentile estimates are still representative.
- Wire the maximum sample size to `advancedMetricsConfig` (set a reasonable default limit).
- Ensure min/max tracking remains accurate regardless of sampling.

## Out of scope
- Any changes to Monte Carlo evaluation logic or context building.
- Changes to report formatting or UI presentation.
- Modifying test data or fixtures unrelated to clause metrics.

## Acceptance criteria
### Tests that must pass
- `npm run test:unit -- --testPathPatterns="HierarchicalClauseNode" --coverage=false`
- `npm run test:unit -- --testPathPatterns="monteCarloSimulator" --coverage=false`

### Invariants that must remain true
- Percentile calculations are computed from the stored sample without errors.
- Min and max observed values remain exact across all samples.
- Memory usage for stored values is bounded by the configured limit.
- Total sample counts are tracked separately from stored samples.

## Status
Completed.

## Outcome
- Implemented reservoir sampling for violation and observed values with new total-count tracking fields.
- Added `maxObservedSampled` to `advancedMetricsConfig` and set bounded defaults (2000) for both violation/observed samples.
- Updated unit tests to cover bounded sampling and expanded serialization expectations.
