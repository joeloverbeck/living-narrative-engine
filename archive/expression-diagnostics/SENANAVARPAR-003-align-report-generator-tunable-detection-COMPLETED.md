# SENANAVARPAR-003: Align Report Generator Tunable Detection

## Summary
Refactor `MonteCarloReportGenerator` variable extraction to use the centralized tunable helper while keeping prototype-based sections limited to emotion/sexual-state paths.

## Status
Completed

## Assumptions Recheck
- The centralized tunable helper (`getTunableVariableInfo` / `isTunableVariable`) already exists in `advancedMetricsConfig.js`.
- The report generator uses two inline regexes, but they are for prototype analysis/last-mile decomposition rather than generic tunable detection.
- Scalar variables like `sexualArousal` are tunable elsewhere, but they are not valid inputs for prototype weight analysis.

## File List
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js`

## Out of Scope
- Do not modify sensitivity analyzer logic or config helpers.
- Do not change report formatting or section ordering.
- Do not adjust sampling/analysis algorithms.
- Do not include scalar tunables (e.g., `sexualArousal`) in prototype-based report sections.

## Acceptance Criteria

### Specific tests that must pass
- `npm run test:unit -- --testPathPattern="monteCarloReportGenerator"`

### Invariants that must remain true
- Report output structure remains stable (no headings removed or renamed).
- Existing emotion/sexualStates extraction behavior is preserved.
- Most-tunable computation still considers all leaves (no new filtering added).
- Prototype analysis continues to ignore non-prototype scalar paths.

## Implementation Notes
- Replace inline regex checks with `getTunableVariableInfo` in the two extraction sites.
- Map tunable info to the existing emotion/sexual and sexualStates logic; ignore scalar domains.
- Update or add unit coverage only if existing tests do not already guard emotion/sexualStates behavior.

## Outcome
- Updated report generator extraction to use centralized tunable helper while preserving existing emotion/sexualState behavior.
- Scope corrected to exclude scalar tunables from prototype-based sections, since they are not valid inputs for prototype weights.
