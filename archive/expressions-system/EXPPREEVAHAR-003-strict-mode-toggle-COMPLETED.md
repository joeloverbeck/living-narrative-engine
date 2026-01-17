# EXPPREEVAHAR-003: Strict Mode Toggle for Expression Prerequisites

## Summary

Add a strict mode configuration flag for expression prerequisite evaluation that throws on any validation or evaluation error (handled per-expression so unrelated expressions still evaluate), and wire it through dependency injection.

## Background

Strict mode enables fail-fast behavior in dev/test so bad expression prerequisites are surfaced immediately instead of being silently dropped.

### Current State Notes (As Observed)
- `ExpressionEvaluatorService` already emits structured prerequisite error payloads via `ExpressionPrerequisiteError` and logs them.
- `JsonLogicEvaluationService` validates allowed operators internally and returns `false` on validation/evaluation errors; it does not throw.
- `config/validation-config.json` is scoped to anatomy validation and is not used by expression evaluation.

## File List (Expected to Touch)

### New Files
- `src/config/expressionPrerequisiteConfig.js`

### Existing Files
- `src/dependencyInjection/registrations/expressionsRegistrations.js`
- `src/expressions/expressionEvaluatorService.js`
- `tests/unit/expressions/expressionEvaluatorService.test.js`

## Out of Scope (MUST NOT Change)

- Validation pipeline wiring (handled in EXPPREEVAHAR-001)
- Structured error payload format (handled in EXPPREEVAHAR-002)
- Expression content files in `data/mods/emotions/expressions/`

## Implementation Details

- Introduce a config getter that reads a strict flag from environment (e.g., `EXPRESSION_PREREQ_STRICT`) via `environmentUtils`.
- Pass the strict flag into `ExpressionEvaluatorService` via DI (no usage of `config/validation-config.json`).
- In strict mode:
  - Missing `logic`, invalid JSON Logic structure, disallowed operators, invalid var paths, or evaluation errors throw an `ExpressionPrerequisiteError` and mark the expression invalid for the session.
  - Strict mode errors should be isolated per expression so unrelated expressions continue evaluating.
- In non-strict mode:
  - Behavior remains the same (log + return false/skip).

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPatterns="expressionEvaluatorService" --coverage=false`

### Invariants That Must Remain True

1. Default configuration remains non-strict unless explicitly enabled.
2. Strict mode failures do not crash unrelated expression evaluation.
3. Strict mode failures still emit the structured error payload defined in EXPPREEVAHAR-002.

## Status

Completed

## Outcome

- Added an environment-backed strict mode config module and DI wiring (no `validation-config.json` usage).
- Expression prerequisite evaluation now throws `ExpressionPrerequisiteError` in strict mode while isolating failures per expression.
- Added unit coverage for strict mode isolation on missing logic and evaluation errors.
