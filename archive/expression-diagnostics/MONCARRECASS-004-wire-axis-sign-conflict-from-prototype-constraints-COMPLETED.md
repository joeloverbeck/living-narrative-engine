# MONCARRECASS-004 - Wire axis sign conflict into recommendations

## Goal
Surface axis sign conflicts (positive weight vs low max, negative weight vs high min) in recommendations using PrototypeConstraintAnalyzer output.

## File list it expects to touch
- src/expressionDiagnostics/services/PrototypeConstraintAnalyzer.js
- src/expressionDiagnostics/services/RecommendationFactsBuilder.js
- src/expressionDiagnostics/services/MonteCarloReportGenerator.js
- src/expressionDiagnostics/services/RecommendationEngine.js
- src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js
- src/expression-diagnostics.js
- tests/unit/expressionDiagnostics/services/diagnosticFactsBuilder.test.js
- tests/unit/expressionDiagnostics/services/recommendationEngine.test.js

## Out of scope
- Adding prototype fit ranking or sensitivity analysis into recommendations.
- Changing how PrototypeConstraintAnalyzer calculates compatibility scores.
- Modifying data/mods content.

## Updated assumptions (post-audit)
- RecommendationEngine already avoids gate-mismatch recommendations for `<=` clauses by checking `operator === '>='`.
- RecommendationEngine already emits `gate_incompatibility` recommendations when gate compatibility is negative; recommendations are not limited to `prototype_mismatch`.
- PrototypeConstraintAnalyzer output is currently only used by MonteCarloReportGenerator (report output), not by RecommendationFactsBuilder or RecommendationEngine.
- RecommendationFactsBuilder already captures clause operators/thresholds, so direction-aware logic is possible without additional clause schema changes.

## Updated scope
- Add axis sign conflict facts to diagnostic facts using PrototypeConstraintAnalyzer output (no changes to analyzer math).
- Emit a new recommendation type when axis sign conflicts are present in analyzer output for top-impact prototype clauses.
- Keep existing recommendation gating (top-3 clauses, invariants, gate/threshold logic) unchanged.

## Acceptance criteria
### Specific tests that must pass
- npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/diagnosticFactsBuilder.test.js --coverage=false
- npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/recommendationEngine.test.js --coverage=false

### Invariants that must remain true
- Prototype constraint analysis outputs remain stable for existing tests.
- Recommendations still cap to top three impact clauses.
- No new recommendations are emitted unless a conflict type is present in analyzer output.

## Notes
- Decide whether to pass analyzer output into RecommendationFactsBuilder (preferred) or recompute within it; document the decision in code.
- Include conflict type and contribution delta fields in the facts payload so the engine can craft clear messaging.
