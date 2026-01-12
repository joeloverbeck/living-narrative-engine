# MONCARREGPOP-005: Align prototype constraint extraction with mood regime predicate
Status: Completed

## Goal
Ensure prototype-fit analysis uses the same AND-only mood-regime predicate as simulator/report, or explicitly labels its broader constraint envelope if OR blocks are intentionally included.

## Expected file list
- `src/expressionDiagnostics/services/PrototypeConstraintAnalyzer.js`
- `src/expressionDiagnostics/utils/moodRegimeUtils.js` (already exists; reuse)
- `tests/unit/expressionDiagnostics/services/prototypeConstraintAnalyzer.test.js`

## Work
- Decide and implement one of the two explicit behaviors:
  1) **Alignment path (preferred):** use `moodRegimeUtils.extractMoodConstraints` with `andOnly: true` inside `PrototypeConstraintAnalyzer.extractAxisConstraints` so prototype-fit analysis matches simulator/report regime definition.
  2) **Labeling path (if OR constraints must remain):** keep existing extraction but update labeling in analyzer output to "Axis constraint envelope (includes OR blocks)" and add a warning when OR-based mood constraints are detected.
- Note: `PrototypeConstraintAnalyzer` currently normalizes mood-axis thresholds to `[-1, 1]` and only recognizes `moodAxes.*`. If using the alignment path, map both `moodAxes.*` and `mood.*` var paths to axis names and preserve the normalization step.
- Ensure any warning text is shared with the UI/report where applicable for consistent phrasing.

## Out of scope
- Any changes to Monte Carlo sampling or stored context limits.
- Any non-mood constraint extraction changes in `PrototypeConstraintAnalyzer`.
- Any UI layout changes (text updates only if needed).

## Acceptance criteria
### Tests
- `npm run test:unit -- --testPathPatterns=prototypeConstraintAnalyzer.test.js --coverage=false`

### Invariants
- Prototype-fit results remain deterministic for the same inputs.
- If the alignment path is chosen, the analyzer uses the same AND-only predicate as simulator/report (both `moodAxes.*` and `mood.*`).
- If the labeling path is chosen, the output explicitly communicates it uses an OR-inclusive envelope.

### Note from designer

I don't know which of the two explicit behaviors is better, so please analyze and determine which is actually better for our case.

## Outcome
- Chosen path: alignment with AND-only mood-regime constraints (including `mood.*` alias support) via shared extraction utility.
- Tests updated to reflect AND-only behavior and to cover `mood.*` extraction.
