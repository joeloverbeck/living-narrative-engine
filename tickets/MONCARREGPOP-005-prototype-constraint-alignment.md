# MONCARREGPOP-005: Align prototype constraint extraction with mood regime predicate

## Goal
Ensure prototype-fit analysis uses the same AND-only mood-regime predicate as simulator/report, or explicitly labels its broader constraint envelope if OR blocks are intentionally included.

## Expected file list
- `src/expressionDiagnostics/PrototypeConstraintAnalyzer.js`
- `src/expressionDiagnostics/utils/moodRegimeUtils.js`
- `tests/unit/expressionDiagnostics/prototypeConstraintAnalyzer.moodRegime.test.js`

## Work
- Decide and implement one of the two explicit behaviors:
  1) **Alignment path (preferred):** use `moodRegimeUtils.extractMoodConstraints` with `andOnly: true` so prototype-fit analysis matches simulator/report regime definition.
  2) **Labeling path (if OR constraints must remain):** keep existing extraction but update labeling in analyzer output to "Axis constraint envelope (includes OR blocks)" and add a warning when OR-based mood constraints are detected.
- Ensure any warning text is shared with the UI/report where applicable for consistent phrasing.

## Out of scope
- Any changes to Monte Carlo sampling or stored context limits.
- Any non-mood constraint extraction changes in `PrototypeConstraintAnalyzer`.
- Any UI layout changes (text updates only if needed).

## Acceptance criteria
### Tests
- `npm run test:unit -- --testPathPatterns=prototypeConstraintAnalyzer.moodRegime.test.js --coverage=false`

### Invariants
- Prototype-fit results remain deterministic for the same inputs.
- If the alignment path is chosen, the analyzer uses the same AND-only predicate as simulator/report.
- If the labeling path is chosen, the output explicitly communicates it uses an OR-inclusive envelope.

### Note from designer

I don't know which of the two explicit behaviors is better, so please analyze and determine which is actually better for our case.