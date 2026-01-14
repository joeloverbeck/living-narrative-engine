# MONCARSIMIMPREP-008: Raw + Normalized Unit Display For Constraints

## Summary

Display raw and normalized ranges together when printing mood constraints to remove ambiguity.

## Status

Completed.

## Priority: Low | Effort: Small

## Reference

- Use `brainstorming/improvements-monte-carlo-simulator.md` (section 4.2) as the source spec for this change.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/utils/moodRegimeUtils.js` | Update |
| `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.constraintUnits.test.js` | Create |

## Out of Scope

- **DO NOT** change normalization math or clamping behavior.
- **DO NOT** alter constraint semantics or evaluation logic.
- **DO NOT** reformat unrelated report sections.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns=monteCarloReportGenerator.constraintUnits.test.js --coverage=false
```

### Invariants That Must Remain True

- Normalized values use the existing mood-axis normalization rules (raw / 100).
- Raw values remain unchanged and are displayed alongside normalized values only.

## Outcome

- Added raw + normalized mood constraint formatting in `src/expressionDiagnostics/utils/moodRegimeUtils.js` (report output unchanged elsewhere).
- Added a focused report generator unit test to assert raw/normalized display in the conditional pass rates section.
