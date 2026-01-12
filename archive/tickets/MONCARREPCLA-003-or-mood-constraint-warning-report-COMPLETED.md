# MONCARREPCLA-003: Detect OR mood constraints and warn in report sections

## Goal
Detect OR-based mood-axis constraints in expression logic and surface a conservative-analysis warning in report sections that assume AND-only constraints.

## Assumptions (updated)
- Spec reference is `specs/monte-carlo-report-clarifications.md` (plural filename).
- `MonteCarloReportGenerator` already detects OR mood constraints and injects warnings in all target sections.
- Existing unit coverage only asserts the warning for Conditional Pass Rates; remaining sections need explicit tests.

## File list (expected to touch)
- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js
- src/expressionDiagnostics/services/MonteCarloReportGenerator.js (only if gaps found)

## Work items
- Confirm OR mood constraint detection + warning placement matches the spec.
- Add unit coverage for warning placement in Prototype Fit Analysis, Implied Prototype, and Prototype Math Analysis.
- Ensure the warning copy matches the spec and is omitted entirely when no OR mood constraints exist.

## Out of scope
- Any UI changes or HTML/CSS adjustments.
- Changes to simulator logic or hierarchical clause data.
- Modifying existing section ordering or titles beyond inserting the warning paragraph.

## Acceptance criteria
### Tests that must pass
- `npm run test:unit -- --testPathPatterns="monteCarloReportGenerator" --coverage=false`

### Invariants that must remain true
- Report output remains valid markdown with the same section ordering.
- Warning text appears only when OR-based mood constraints are present.
- No changes to computed values for conditional pass rates or prototype analyses.

## Status
- [x] Completed

## Outcome
Warning logic was already implemented in `MonteCarloReportGenerator`, so no production code changes were needed. Scope shifted to correcting spec assumptions and adding unit coverage for Prototype Fit, Implied Prototype, and Prototype Math warning placement.
