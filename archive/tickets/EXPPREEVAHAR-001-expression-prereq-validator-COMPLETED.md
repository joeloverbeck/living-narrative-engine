# EXPPREEVAHAR-001: Expression Prerequisite Validator in Validation Pipeline

## Summary

Add a dedicated validation pass for expression prerequisites that runs during `npm run validate` and produces actionable violations for missing logic, invalid JSON Logic structure, bad var paths, and range mismatches.

## Background

Expression prerequisite evaluation can silently fail today. A validation pass at validate time should catch structural issues and value range mismatches before runtime.

## File List (Expected to Touch)

### New Files
- `src/validation/expressionPrerequisiteValidator.js`
- `tests/unit/validation/expressionPrerequisiteValidator.test.js`

### Existing Files
- `cli/validation/modValidationOrchestrator.js` (actual orchestrator implementation; `src/validation/modValidationOrchestrator.js` is a re-export)
- `src/validation/violationReporter.js`
- `scripts/validateMods.js`

## Out of Scope (MUST NOT Change)

- Runtime evaluation behavior in `src/expressions/expressionEvaluatorService.js`
- Expression content files in `data/mods/emotions/expressions/`
- JSON Logic operator implementation in `src/logic/jsonLogicEvaluationService.js`

## Implementation Details

- Add a validator that walks each expression's `prerequisites` array and enforces:
  - `logic` is present and is a JSON object.
  - JSON Logic operator and argument counts are valid for the supported operators.
  - `var` references use only approved roots: `actor`, `emotions`, `sexualStates`, `sexualArousal`, `moodAxes`, `previousEmotions`, `previousSexualStates`, `previousMoodAxes`.
  - `var` paths point to known keys (derive keys from existing emotion/state axis registries or data definitions).
  - Numeric thresholds are within expected ranges:
    - `emotions.*`, `sexualStates.*`, `sexualArousal` within `[0, 1]`.
    - `moodAxes.*` within `[-100, 100]`.
  - Warn on vacuous operators like `{ "and": [] }` but do not fail unless strict validation is enabled.
- Wire the validator into the mod validation orchestrator with a new violation type and include expression id + mod source in the report.
- Expression validation should read expression JSON from mod manifests (the validate CLI does not load expression data into the registry today).

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPattern="expressionPrerequisiteValidator"`
2. `npm run validate:fast`

### Invariants That Must Remain True

1. Existing expression evaluation results do not change in non-strict runtime mode.
2. Validation does not mutate expression definitions or registry state.
3. Validator only reports issues; it does not attempt to autocorrect data.

## Status

Completed

## Outcome

- Added a dedicated expression prerequisite validator and wired it into the CLI validation orchestration and reporting pipeline.
- Validation reads expression JSON listed in mod manifests, using lookup-driven keys for emotion and sexual state names plus mood axis ranges.
- Added unit tests for prerequisite validation (missing logic, operator/argument validation, var path validation, range mismatches, and vacuous operator warnings).
## Assumptions Updated (Based on Repository)
- The mod validation orchestrator used by `npm run validate` lives in `cli/validation/modValidationOrchestrator.js`; the `src/validation/modValidationOrchestrator.js` file only re-exports it.
- `modValidationErrorHandler` and `validationErrorContext` are not wired into the validation CLI; reporting should be done through `src/validation/violationReporter.js` or explicit CLI output.
