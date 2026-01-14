# MONCARRECSECASS-005: Report Rendering for Gate-Clamp Regime Permissive

## Summary

Validate that the generic recommendation card renderer already covers the gate-clamp permissive type and that evidence/action lines include denominators and confidence, then add a focused rendering test.

## Priority: Medium | Effort: Medium

## Rationale

The recommendation must be actionable and authoritative in the Monte Carlo report output, with clear evidence and copy/paste constraints.

## Dependencies

- **MONCARRECSECASS-004** (engine emits new recommendation type)

## File List It Expects To Touch

| File | Change Type |
| --- | --- |
| `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.recommendations.test.js` | **Add** (recommendations rendering coverage for gate-clamp) |

## Out of Scope

- **DO NOT** modify `RecommendationEngine` emission logic
- **DO NOT** change Monte Carlo simulation behavior
- **DO NOT** update DOM controller behavior beyond report output

## Implementation Details

- No formatter branch is required; `MonteCarloReportGenerator` already renders recommendation cards generically from `RecommendationEngine` evidence/action payloads.
- Ensure evidence lines include denominators for clamp rate and keep ratio (already emitted by the engine payload).
- Actions should include a mood constraint string in raw units (already emitted by the engine payload).
- Add a rendering unit test that asserts the gate-clamp recommendation card prints denominators and confidence.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns monteCarloReportGenerator --coverage=false
```

### Invariants That Must Remain True

- Recommendations section still suppresses output when invariants fail.
- Existing recommendation card formats remain unchanged for other types.
- Evidence lines always include denominators for clamp rate and keep ratio.

## Status

Completed.

## Outcome

- Confirmed the report generator already formats gate-clamp recommendations via the shared card renderer (no special-case branch needed).
- Added a focused rendering unit test that asserts denominators and confidence appear in the gate-clamp recommendation output.
