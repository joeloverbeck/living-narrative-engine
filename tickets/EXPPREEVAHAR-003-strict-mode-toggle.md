# EXPPREEVAHAR-003: Strict Mode Toggle for Expression Prerequisites

## Summary

Add a strict mode configuration flag for expression prerequisite evaluation that throws on any validation or evaluation error, and wire it through dependency injection.

## Background

Strict mode enables fail-fast behavior in dev/test so bad expression prerequisites are surfaced immediately instead of being silently dropped.

## File List (Expected to Touch)

### New Files
- `src/config/expressionPrerequisiteConfig.js`

### Existing Files
- `src/dependencyInjection/registrations/expressionsRegistrations.js`
- `src/expressions/expressionEvaluatorService.js`
- `config/validation-config.json`
- `tests/unit/expressions/expressionEvaluatorService.test.js`

## Out of Scope (MUST NOT Change)

- Validation pipeline wiring (handled in EXPPREEVAHAR-001)
- Structured error payload format (handled in EXPPREEVAHAR-002)
- Expression content files in `data/mods/emotions/expressions/`

## Implementation Details

- Introduce a config getter that reads a strict flag (e.g., `process.env.EXPRESSION_PREREQ_STRICT` or `config/validation-config.json`).
- Pass the strict flag into `ExpressionEvaluatorService` via DI.
- In strict mode:
  - Missing `logic`, invalid JSON Logic structure, disallowed operators, invalid var paths, or evaluation errors throw and mark the expression invalid for the session.
- In non-strict mode:
  - Behavior remains the same (log + return false).

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPattern="expressionEvaluatorService"`

### Invariants That Must Remain True

1. Default configuration remains non-strict unless explicitly enabled.
2. Strict mode failures do not crash unrelated expression evaluation.
3. Strict mode failures still emit the structured error payload defined in EXPPREEVAHAR-002.

