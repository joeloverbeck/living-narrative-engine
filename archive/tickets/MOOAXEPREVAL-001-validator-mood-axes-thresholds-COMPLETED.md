# MOOAXEPREVAL-001: Nested Mood Axes Threshold Validation

## Summary

Harden ExpressionPrerequisiteValidator so any comparison that references mood axes (including nested JSON Logic) enforces integer-only raw thresholds in -100..100 and flags mixed-scale comparisons.

Status: Completed.

## Background

Current range checks only inspect direct comparisons that include a top-level `var` argument. Nested expressions (`max`, arithmetic) bypass the check, which lets normalized mood axes thresholds slip through. Fractional values like `0.45` currently pass because the validator only enforces numeric ranges, not integer-only thresholds, for mood axes.

## File List (Expected to Touch)

### Existing Files
- `src/validation/expressionPrerequisiteValidator.js`
- `tests/unit/validation/expressionPrerequisiteValidator.test.js`

## Out of Scope (MUST NOT Change)

- Expression content in `data/mods/`
- CLI validation orchestration in `cli/validation/modValidationOrchestrator.js`
- Modding docs in `docs/`

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPattern="expressionPrerequisiteValidator"`

### Invariants That Must Remain True

1. Existing range checks for `emotions`, `sexualStates`, and `sexualArousal` still apply and do not change their ranges.
2. Only comparisons that include `moodAxes` or `previousMoodAxes` enforce integer-only numeric literals in the comparison subtree (including nested JSON Logic).
3. Mixed-scale comparisons (mood axes with emotions/sexual states/previous variants in the same comparison) produce warnings in non-strict mode and violations in strict mode, without changing other warning behaviors.
4. Only unit tests are required for this ticket; data packs and validation pipeline behavior are out of scope.

## Outcome

- Implemented nested mood axes threshold checks with integer-only enforcement and mixed-scale warnings.
- Added unit tests for fractional, nested, and mixed-scale comparisons without changing data packs or validation orchestration.
