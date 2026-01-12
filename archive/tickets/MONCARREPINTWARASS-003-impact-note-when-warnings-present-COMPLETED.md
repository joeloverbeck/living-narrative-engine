# MONCARREPINTWARASS-003: Add integrity warning impact note in report and UI

## Goal
Confirm the impact note for integrity warnings is present and consistent between the report modal and the non-report Monte Carlo results UI, and ensure tests cover the behavior.

## Reassessment (2026-01-12)
- Impact note already exists in the report output (`MonteCarloReportGenerator`) and the non-report UI (`ExpressionDiagnosticsController` + `expression-diagnostics.html`).
- The non-report UI already renders the impact note and has unit coverage in `ExpressionDiagnosticsController.test.js`.
- The report output already appends the impact note and has unit coverage in `monteCarloReportGenerator.warnings.test.js`.
- No changes to warning generation or simulation outputs are required.

## File list it expects to touch
- tickets/MONCARREPINTWARASS-003-impact-note-when-warnings-present.md (this ticket)
- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.warnings.test.js (existing coverage)
- tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js (existing coverage)

## Out of scope
- Do not change the warning generation logic.
- Do not alter the semantics of pass-rate calculations or blocker logic.
- Do not add new data fields to stored contexts.
- Do not refactor report or UI formatting beyond verifying the existing impact note.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- --testPathPatterns MonteCarloReportModal --coverage=false`
- `npm run test:unit -- --testPathPatterns ExpressionDiagnosticsController --coverage=false`
- `npm run test:unit -- --testPathPatterns monteCarloReportGenerator.warnings --coverage=false`

### Invariants that must remain true
- The impact note is only shown when at least one integrity warning exists.
- The note text is consistent between report and non-report UI.
- No changes are made to the Monte Carlo simulation inputs or outputs.

## Status
Completed (2026-01-12)

## Outcome
The impact note and integrity warning surfacing were already implemented in both the report and non-report UI, with existing unit coverage. No code changes were required beyond updating this ticket to reflect the current state and running the targeted tests.
