# MONCARGATCLADIA-002: Compute Gate Clamp And Conditional Pass Metrics

## Summary

Validate and test existing per-clause Monte Carlo gate clamp metrics (gate clamp rate, pass-given-gate rate, and mood-regime denominators) for emotion-threshold clauses, aligning behavior and assumptions with the spec.

## Priority: High | Effort: Medium

## Rationale

Content authors need to separate gate mismatch from threshold difficulty. These metrics provide that signal and support the funnel framing described in the spec.

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js` | **Modify** |

## Assumptions & Scope Updates

- Gate clamp metrics are already computed in `MonteCarloSimulator` + `HierarchicalClauseNode`; no production code changes required unless tests expose a mismatch.
- Clause results always include the gate metric fields, but they are `null` when gate evaluation is not applicable (e.g., mood-only clauses).
- Report/UI additions from the spec are deferred to a separate ticket.

## Out of Scope

- **DO NOT** render or format new metrics in the report
- **DO NOT** update UI tables or tooltips
- **DO NOT** add per-gate breakdown UI
- **DO NOT** change metrics for mood-only constraints

## Acceptance Criteria

### Tests

- `npm run test:unit -- --testPathPatterns=tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js --coverage=false`

### Invariants

- Gate clamp metrics are computed only for emotion-threshold clauses; mood-only clauses return `null` for the gate fields.
- All denominators for gate clamp and pass-given-gate metrics use the mood-regime subset.
- Conditional pass rate equals `gatePassAndClausePassInRegimeCount / gatePassInRegimeCount` and is `null` when `gatePassInRegimeCount` is 0.

## Status: Completed

## Outcome

Gate clamp metrics were already implemented; added unit coverage for in-regime gate clamp counts/rates, the null conditional pass edge case, and confirmed mood-only clauses keep gate fields null. No production code changes were required.
