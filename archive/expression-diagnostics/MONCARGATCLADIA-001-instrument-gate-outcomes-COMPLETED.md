# MONCARGATCLADIA-001: Instrument Gate Outcomes In Monte Carlo Simulation

## Summary

Instrument Monte Carlo clause evaluation with gate pass/fail outcomes for emotion-threshold clauses so diagnostics can distinguish gate clamps vs. threshold misses, without changing evaluation logic or UI output.

## Priority: High | Effort: Medium

## Rationale

Gate clamp diagnostics require access to per-sample gate outcomes that match runtime behavior. Without this instrumentation, gate clamp rates and failed gate breakdowns cannot be computed reliably.

## Assumptions & Notes

- Gate enforcement already happens via `EmotionCalculatorService`; this work only instruments outcomes and must not alter trigger rates.
- Gate outcomes should be derived with the same normalization/axis resolution behavior used in diagnostics helpers (matching runtime gating semantics for Monte Carlo contexts).
- Gate outcomes are only required for direct emotion-threshold leaf clauses (e.g., `emotions.fear >= 0.4`), not arbitrary arithmetic expressions.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | **Modify** |
| `src/expressionDiagnostics/models/HierarchicalClauseNode.js` | **Modify** |
| `src/expressionDiagnostics/models/DiagnosticResult.js` | **Modify** (types only, if needed) |
| `src/expressionDiagnostics/config/advancedMetricsConfig.js` | **Do not modify** (no new toggles) |

## Out of Scope

- **DO NOT** change UI rendering or HTML templates
- **DO NOT** modify report generation output
- **DO NOT** add or change Monte Carlo sampling distributions
- **DO NOT** change gate evaluation logic; only capture outcomes from the existing logic

## Acceptance Criteria

### Tests

- `npm run test:unit -- --testPathPatterns=tests/unit/expressionDiagnostics/services/monteCarloSimulator.gateEnforcement.test.js --coverage=false`
- `npm run test:unit -- --testPathPatterns=tests/unit/expressionDiagnostics/models/DiagnosticResult.test.js --coverage=false`
- Add/adjust unit coverage for new gate outcome counters in Monte Carlo clause results.

### Invariants

- Gate evaluation used for diagnostics matches the runtime gate logic exactly.
- For samples where any gate fails, the final intensity used by Monte Carlo is clamped to 0.
- Gate outcome instrumentation does not alter simulation results (trigger rate and clause failure rates unchanged).

## Status: Completed

## Outcome

- Changed: added gate pass/clamp counters for emotion-threshold leaf clauses in Monte Carlo clause results and hierarchical breakdowns.
- Changed: documented new clause failure fields and added unit coverage for gate outcome metrics.
- Unchanged: gate evaluation logic, report/UI output, sampling distributions.
