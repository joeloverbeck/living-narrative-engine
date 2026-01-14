# MONCARSIMIMPREP-004: Gate vs Threshold Choke Classification

## Summary

Classify recommendation choke types (gate, threshold, mixed) and gate axis-sign-conflict recommendations based on feasibility, aligning evidence text with the classification.

## Reference

- `reports/monte-carlo-simulator-improvements-report.md` (the improvements report lives in `reports/`, not `specs/`).

## Current Behavior Notes

- `RecommendationEngine` evidence currently mixes gate + threshold metrics regardless of choke type.
- `axis_sign_conflict` triggers solely on operator + conflicts, without pass|gate feasibility gating.

## Priority: High | Effort: Medium

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/RecommendationEngine.js` | Update |
| `tests/unit/expressionDiagnostics/services/recommendationEngine.chokeType.test.js` | Create |
| `tests/unit/expressionDiagnostics/services/recommendationEngine.test.js` | Update |

## Out of Scope

- **DO NOT** introduce new recommendation categories beyond the existing set.
- **DO NOT** change clause evaluation math or gate/threshold definitions.
- **DO NOT** modify report rendering or UI templates.
- **DO NOT** adjust simulator sampling logic.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns=recommendationEngine.chokeType.test.js --coverage=false
```

### Invariants That Must Remain True

- `axis_sign_conflict` is suppressed when `passGivenGate` is high and the choke is gate-only.
- Evidence output references only gate metrics for gate chokes, threshold metrics for threshold chokes, and both for mixed.
- Recommendation ordering remains stable aside from the new choke-type logic.

## Status

Completed.

## Outcome

- Updated `RecommendationEngine` choke classification, evidence gating, and axis-sign-conflict suppression per pass|gate feasibility.
- Added choke-type unit coverage and fixed the axis-conflict population expectation to match the existing evidence payload.
- Originally planned only the new choke-type test file; outcome also included an update to the existing recommendation engine test.
