# MONCARREGPOP-001: Add shared mood-regime utilities + unit tests

## Goal
Create a shared utility module that extracts, formats, and evaluates mood-regime constraints consistently across simulator/report/UI, with focused unit tests.

## Expected file list
- `src/expressionDiagnostics/utils/moodRegimeUtils.js`
- `tests/unit/expressionDiagnostics/moodRegimeUtils.test.js`

## Work
- Add `moodRegimeUtils` with:
  - `extractMoodConstraints(prerequisites, { includeMoodAlias: true, andOnly: true })`
  - `hasOrMoodConstraints(prerequisites, { includeMoodAlias: true })`
  - `evaluateConstraint(value, operator, threshold)`
  - `filterContextsByConstraints(contexts, constraints)`
  - `formatConstraints(constraints)`
- Ensure extraction handles both `moodAxes.*` and `mood.*` when `includeMoodAlias` is true.
- Ensure `andOnly: true` ignores OR blocks while `hasOrMoodConstraints` reports them explicitly.
- Provide deterministic formatting used by report/UI.

## Out of scope
- Any wiring changes in simulator, report generator, or UI.
- Any UI text or layout changes.
- Any sampling or Monte Carlo logic changes.

## Acceptance criteria
### Tests
- `npm run test:unit -- --testPathPatterns=moodRegimeUtils.test.js --coverage=false`

### Invariants
- Utility extraction for AND-only constraints matches current simulator logic (AND blocks only).
- No change to any runtime behavior outside the new module and its tests.
- Output of `formatConstraints` is stable across runs (no ordering drift).
