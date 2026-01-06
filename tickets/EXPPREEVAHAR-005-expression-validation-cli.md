# EXPPREEVAHAR-005: Expression Validation CLI (validate:expressions)

## Summary

Add a dedicated CLI entry point that runs the expression prerequisite validator against expression packs and prints actionable errors (with suggestions when possible).

## Background

A focused validation command makes it easier for content authors to check expression prerequisites without running the full mod validation suite.

## File List (Expected to Touch)

### New Files
- `scripts/validateExpressions.js`
- `tests/integration/validation/validateExpressions.test.js`
- `tests/fixtures/expressions/invalid-expression.json`

### Existing Files
- `package.json`
- `src/validation/expressionPrerequisiteValidator.js`

## Out of Scope (MUST NOT Change)

- Runtime evaluation behavior in `src/expressions/expressionEvaluatorService.js`
- Mod validation CLI behavior in `scripts/validateMods.js`
- Expression content files in `data/mods/emotions/expressions/`

## Implementation Details

- Implement `scripts/validateExpressions.js` to:
  - Load schemas and expression data from `data/mods/emotions/expressions/`.
  - Run `expressionPrerequisiteValidator` against each expression.
  - Print errors with expression id, file path, and a short fix hint.
  - Exit non-zero if violations are found.
- Add `npm run validate:expressions` script in `package.json`.
- Create a small invalid fixture to exercise the CLI in tests.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:integration -- --runInBand --testPathPattern="validateExpressions"`

### Invariants That Must Remain True

1. CLI does not mutate expression files or the data registry.
2. Running `npm run validate` is unchanged and still validates the full ecosystem.
3. Output includes file path + expression id for every violation.

