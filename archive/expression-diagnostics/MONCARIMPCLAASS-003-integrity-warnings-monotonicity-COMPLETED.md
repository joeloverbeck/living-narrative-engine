# MONCARIMPCLAASS-003: Add integrity warnings (AND-only + monotonicity)

Status: Completed

## Goal
Add integrity warnings for marginal and expression-level sweeps when invariants are violated, including AND-only guardrails and monotonicity checks.

## Scope
- Detect AND-only clause structures using hierarchical breakdowns (no OR nodes; leaf-level threshold comparisons only).
- Emit warnings in the report for marginal and expression-level sweeps when:
  - S1: stored-context trigger rate exceeds a required clause pass rate (AND-only; compares stored-context trigger baseline to marginal pass rate).
  - S4: sweep pass-rate/trigger-rate is not monotonic for single-threshold clauses (direction derived from operator).
- Emit warnings in the interactive UI only for expression-level sweeps (global sensitivity panel) since there is no marginal sweep panel today.
- Present warnings as inline notes near the sweep output (per-sweep table), and also surface them in the report integrity warnings section.

## Tasks
- Add helpers to detect AND-only clause structures and sweep monotonicity direction.
- Add monotonicity check utility that operates on sweep grid order (sorted by threshold).
- Compute stored-context baseline trigger rate from expression-level sweep data for S1 checks.
- Surface warnings in `MonteCarloReportGenerator` and in the global sensitivity panel UI.

## File list it expects to touch
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `src/expressionDiagnostics/services/SensitivityAnalyzer.js`
- `src/expression-diagnostics.js`
- `src/expressionDiagnostics/utils/sweepIntegrityUtils.js`
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`

## Out of scope
- No changes to clause evaluation logic or predicate rewriting.
- No changes to sampling counts or stored context limits.
- No changes to unrelated report sections (Blocker Analysis, Last-Mile, etc.).
- No new marginal sweep panel in the interactive UI.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:integration -- --testPathPatterns=tests/integration/expression-diagnostics/sensitivityAnalysis.integration.test.js --coverage=false`
- `npm run test:integration -- --testPathPatterns=tests/integration/expression-diagnostics/advancedMetrics.integration.test.js --coverage=false`
- `npm run test:unit -- --testPathPatterns=tests/unit/expression-diagnostics/sweepIntegrityUtils.test.js --coverage=false`

### Invariants that must remain true
- Warnings are advisory only; they do not block report generation.
- Warnings only appear for AND-only and/or single-threshold sweeps as specified.

## Outcome
- Added sweep integrity utilities and inline warning rendering in report sensitivity sections.
- Added non-monotonic sweep warnings to the global sensitivity UI (no marginal sweep UI added).
- Added unit tests for sweep integrity utilities.
