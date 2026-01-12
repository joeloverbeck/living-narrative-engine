# MONCARIMPCLAASS-002: Carry population hash through sweeps + display metadata

## Goal
Attach population identifiers/hashes to sweep results and surface them in report + non-report UI so readers can validate population consistency across sections.

## Scope
- Add `populationHash` (and label if needed) to sweep results emitted by sensitivity analysis.
- Ensure both sweep sections (marginal + expression-level) surface population metadata; report already renders stored-context population headers with hashes, so only fill gaps if metadata is missing.
- Surface the population hash/label in the interactive UI for stored-context sections (implemented in `ExpressionDiagnosticsController` and `expression-diagnostics.html`, not `src/expression-diagnostics.js`).
- Note: there is no existing cross-section comparison logic between sweep sections, so no gating changes are required.

## Tasks
- Extend sensitivity result structures to carry population metadata from stored contexts.
- Ensure `MonteCarloReportGenerator` still renders population metadata for both sweep types (already uses stored-context population headers with hashes).
- Add a short metadata line to the interactive UI section(s) in `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` (and `expression-diagnostics.html` if needed).

## File list it expects to touch
- `src/expressionDiagnostics/services/SensitivityAnalyzer.js`
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`
- `expression-diagnostics.html`

## Out of scope
- No changes to how population hashes are computed.
- No changes to sampling, seeding, or stored-context selection.
- No additional integrity warnings beyond population identity (handled by another ticket).

## Acceptance criteria
### Specific tests that must pass
- `npm run test:integration -- --testPathPatterns=tests/integration/expression-diagnostics/sensitivityAnalysis.integration.test.js --coverage=false`
- `npm run test:unit -- --testPathPatterns=tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.labels.test.js --coverage=false`

### Invariants that must remain true
- Existing population label formatting remains available and unchanged for report consumers.
- Report output still renders when no sensitivity data is available.

## Status
Completed

## Outcome
- Added stored-context population hashes to sensitivity results and surfaced the hash in the interactive UI stored-context labels.
- Report sweep sections already render stored-context population headers with hashes; no report label changes were needed.
- No cross-section sweep comparison logic exists, so no gating change was required.
