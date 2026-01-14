# PROCRESUGREC-005: Add Integration Tests for Prototype Creation Recommendation

## Summary

Add integration coverage for the prototype creation recommendation within the expression diagnostics report pipeline, ensuring schema-valid payloads and stable ordering.

## Priority: Medium | Effort: Medium

## Rationale

Integration tests validate the full diagnostics flow (facts -> ranking -> recommendation emission) and ensure the recommendation behaves correctly with real report inputs.

## Dependencies

- PROCRESUGREC-001 (facts builder)
- PROCRESUGREC-003 (recommendation emission)

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/integration/expression-diagnostics/monteCarloReportRecommendations.integration.test.js` | **Update** |
| `tests/fixtures/expressionDiagnostics/prototypeCreateSuggestion.fixture.json` | **Create** (if fixture data needed) |

## Out of Scope

- **DO NOT** modify existing integration test harnesses or DI wiring
- **DO NOT** change MonteCarlo report schemas
- **DO NOT** add performance or memory tests

## Implementation Details

- Add integration cases:
  - Recommendation present with schema-valid payload.
  - No emission when fit is good and gap is low.
  - Stable sorting when multiple recommendations exist.
- Use fixtures that exercise both A/B and C paths.
- Verify deterministic `id`, `type`, and `relatedClauseIds` ordering.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportRecommendations.integration.test.js --coverage=false
```

### Invariants That Must Remain True

- No changes to existing report ordering across unrelated recommendations.
- Integration test uses deterministic fixtures and fixed sample sizes.
- Recommendation payloads are schema-valid and numeric metrics are finite.

## Definition of Done

- [ ] Integration tests cover emit and no-emit cases.
- [ ] Sorting stability is asserted when multiple recommendations exist.
- [ ] All specified integration tests pass.
