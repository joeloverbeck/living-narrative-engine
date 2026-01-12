# MONCARREGPOP-001: Add shared mood-regime utilities + unit tests

## Goal
Create a shared utility module that extracts, formats, and evaluates mood-regime constraints consistently across simulator/report/UI, with focused unit tests.

## Assumptions rechecked
- Duplicate mood-regime extraction/evaluation already exists in `MonteCarloSimulator`, `MonteCarloReportGenerator`, and `ExpressionDiagnosticsController`.
- UI extraction currently ignores `mood.*` alias paths, while simulator/report include them.
- The spec calls for a shared utility and predicate alignment across simulator, report, and UI; keeping wiring out of scope would not satisfy that alignment.

## Expected file list
- `src/expressionDiagnostics/utils/moodRegimeUtils.js`
- `src/expressionDiagnostics/services/MonteCarloSimulator.js`
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`
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
- Use the shared utility in the simulator, report generator, and expression diagnostics UI for mood-regime extraction, OR detection, and filtering/evaluation.
- Provide deterministic formatting used by report/UI.

## Out of scope
- Any UI text or layout changes beyond existing string composition.
- Any sampling or Monte Carlo logic changes.
- Prototype constraint analysis refactors (e.g., `PrototypeConstraintAnalyzer` and `PrototypeFitRankingService`).
- Population summary/report labeling changes.

## Acceptance criteria
### Tests
- `npm run test:unit -- --testPathPatterns=moodRegimeUtils.test.js --coverage=false`

### Invariants
- Utility extraction for AND-only constraints matches current simulator logic (AND blocks only).
- No change to runtime behavior outside the touched mood-regime extraction/evaluation logic and its tests, except that UI now also respects `mood.*` alias constraints.
- Output of `formatConstraints` is stable across runs (no ordering drift).

## Status
Completed.

## Outcome
- Added shared mood-regime utilities and wired them into simulator, report generator, and UI extraction/filtering paths.
- Preserved existing AND-only regime semantics while aligning UI to accept `mood.*` alias constraints.
- Added unit coverage for extraction, OR detection, evaluation, filtering, and formatting.
