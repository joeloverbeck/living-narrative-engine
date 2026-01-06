# EXPPREEVAHAR-002: Structured Expression Prerequisite Errors

## Summary

Introduce a structured `ExpressionPrerequisiteError` payload and consistent logging so evaluation failures include expression id, prerequisite index, logic summary, and relevant context values.

## Background

Evaluation errors currently collapse to a `false` result with minimal context. This makes it hard to identify invalid JSON Logic, missing vars, or range issues at runtime.

## File List (Expected to Touch)

### New Files
- `src/expressions/ExpressionPrerequisiteError.js`

### Existing Files
- `src/expressions/expressionEvaluatorService.js`
- `src/logic/jsonLogicEvaluationService.js`
- `src/logging/loggerStrategy.js`
- `tests/unit/expressions/expressionEvaluatorService.test.js`

## Out of Scope (MUST NOT Change)

- Strict-mode evaluation behavior (handled in EXPPREEVAHAR-003)
- Validation pipeline changes (handled in EXPPREEVAHAR-001)
- Expression content files in `data/mods/emotions/expressions/`

## Implementation Details

- Add a lightweight error class or factory that captures:
  - Expression id and mod id.
  - Prerequisite index (1-based).
  - Compact JSON summary of the logic (single-line string).
  - Resolved logic (if condition refs exist).
  - Vars referenced and their resolved values.
  - Error category: `invalid-logic`, `missing-var`, `range-mismatch`, `evaluation-error`.
- Update `expressionEvaluatorService` to construct and log this payload on evaluation failure.
- Ensure logs use a stable prefix (for grepability) like `EXPR_PREREQ_ERROR` and include an error code.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPattern="expressionEvaluatorService"`

### Invariants That Must Remain True

1. Non-strict evaluation still returns `false` on errors (no throw).
2. Logging uses a stable prefix and error code across failures.
3. Errors do not leak full context data beyond the referenced var paths.

