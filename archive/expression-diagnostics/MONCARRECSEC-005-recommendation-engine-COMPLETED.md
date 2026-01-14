# MONCARRECSEC-005: Recommendation Engine (Prototype Mismatch)

## Summary

Add a deterministic recommendation engine that emits the prototype mismatch recommendation with confidence, evidence, and actions.

## Priority: High | Effort: Medium

## Files to Touch

| File | Change Type |
| --- | --- |
| `src/expressionDiagnostics/services/RecommendationEngine.js` | Create |
| `src/expressionDiagnostics/services/RecommendationFactsBuilder.js` | Update |
| `src/expressionDiagnostics/services/index.js` | Update |
| `tests/unit/expressionDiagnostics/recommendationEngine.test.js` | Create |

## Out of Scope

- Do not add recommendation types beyond `prototype_mismatch`.
- Do not alter UI or report formatting.
- Do not bypass invariant suppression logic.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns recommendationEngine --coverage=false
```

### Invariants That Must Remain True

- Each emitted recommendation includes `id`, `confidence`, and at least two evidence items with denominators.
- Gate mismatch includes the most frequent failed gate evidence when triggered.
- Recommendations are sorted deterministically (severity, impact, then id).

## Assumptions + Scope Updates

- `RecommendationFactsBuilder` already exists and is the facts source; there is no `MonteCarloDiagnosticsService` to update.
- Threshold comparisons for the weight/threshold mismatch use the leaf clause `thresholdValue` from the hierarchical breakdown.
- Severity uses a deterministic impact-based tiering to keep sorting stable without altering public APIs.

## Implementation Notes

- Emit when prototype-linked clause is in top-3 impact and one of:
  - `gateFailRate >= 0.25`
  - `pThreshGivenGate <= 0.10` and `meanValueGivenGate <= threshold - 0.15`
  - `compatibilityScore <= -0.25`
- Confidence: High if `moodSampleCount >= 500`, Medium if `200 <= N < 500`, Low otherwise.
- If confidence is low, add explicit uncertainty text in `why` or a dedicated evidence line.

## Status

Completed.

## Outcome

- Implemented `RecommendationEngine` and exported it via the services barrel.
- Added `thresholdValue` to clause facts to support threshold mismatch detection.
- Added unit tests for gate mismatch, threshold mismatch, invariant suppression, and sorting.
