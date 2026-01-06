# EXPSYSBRA-011: Unit Tests for Expression Services

## Summary

Audit and close gaps in existing unit tests for expression services: ExpressionRegistry, ExpressionContextBuilder, ExpressionEvaluatorService, ExpressionDispatcher, and ExpressionPersistenceListener. Tests already exist under `tests/unit/expressions/`; focus on missing coverage or incorrect assumptions rather than adding new suites from scratch.

## Background

Unit tests for expression services already exist. This ticket focuses on validating assumptions against current implementations and adding missing edge coverage where appropriate. Tests should follow existing project patterns using Jest and the test utilities in `/tests/common/`.

## File List (Expected to Touch)

### Existing Test Files (May Update)
- `tests/unit/expressions/expressionRegistry.test.js`
- `tests/unit/expressions/expressionContextBuilder.test.js`
- `tests/unit/expressions/expressionEvaluatorService.test.js`
- `tests/unit/expressions/expressionDispatcher.test.js`
- `tests/unit/expressions/expressionPersistenceListener.test.js`

### Files to Read (NOT modify unless required by failing tests)
- `src/expressions/expressionRegistry.js` - Implementation to test
- `src/expressions/expressionContextBuilder.js` - Implementation to test
- `src/expressions/expressionEvaluatorService.js` - Implementation to test
- `src/expressions/expressionDispatcher.js` - Implementation to test
- `src/expressions/expressionPersistenceListener.js` - Implementation to test
- `tests/common/testBed.js` - Test utilities reference

## Out of Scope (MUST NOT Change)

- `src/expressions/*.js` - Service implementations (created in prior tickets), unless a failing test or critical bug demands a minimal fix
- Test utilities in `/tests/common/`
- Production code outside expressions directory

## Implementation Details

### 1. `expressionRegistry.test.js`

Focus on missing edge coverage:
- Cache is built lazily and only once (no repeated `dataRegistry.getAll` calls).
- Invalid/malformed IDs return `null`.
- Invalid/empty tags return empty arrays.

### 2. `expressionContextBuilder.test.js`

Confirm map-to-object fallback behavior and constructor validation for logger. There is no `getPreviousExpressionState` method in the implementation, so tests should not assert it.

### 3. `expressionEvaluatorService.test.js`

Match actual method names and dependencies:
- Public methods: `evaluate(context)` and `evaluateAll(context)`.
- Dependency is `gameDataRepository` (not `conditionRepository`).
- Missing-logic prerequisites are treated as warnings and do not fail the expression.

### 4. `expressionDispatcher.test.js`

Align with current implementation:
- `dispatch(actorId, expression, turnNumber)` is the public method.
- Rate limiting is global per turn number, not per actor.
- There is no `updateActorExpressionState` method in the implementation.

### 5. `expressionPersistenceListener.test.js`

Align with current implementation:
- `handleEvent` does not filter by event type; it processes any event containing `payload.actorId` and mood/sexual updates.
- Turn-based rate limiting is handled by `ExpressionDispatcher` via turn counter; listener increments turn counter per processed event.

## Test Utilities to Use

```javascript
import { createTestBed } from '../../common/testBed.js';
import { createMockLogger } from '../../common/mockLogger.js';
import { createMockEventBus } from '../../common/mockEventBus.js';

// Create mocks using project patterns
const mockLogger = createMockLogger();
const mockDataRegistry = {
  getAll: jest.fn().mockReturnValue([]),
};
const mockEventBus = createMockEventBus();
```

## Acceptance Criteria

### Tests That Must Pass

1. **All Unit Tests Pass**
   - Run: `npm run test:unit -- --testPathPattern="expressions"`
   - All tests in green

2. **Coverage Requirements**
   - No enforced coverage gates for subset runs; coverage thresholds are only enforced on full-suite runs.
   - Aim to add coverage for any newly identified edge cases.

3. **Test Quality**
   - Each service has constructor validation tests
   - Each public method has happy path and error tests
   - Edge cases documented and tested

### Invariants That Must Remain True

1. **Test isolation** - Tests don't depend on each other
2. **Mock completeness** - All dependencies properly mocked
3. **Cleanup** - Tests clean up after themselves
4. **Determinism** - Tests produce consistent results
5. **Performance** - Unit tests complete in <5 seconds total
6. **Pattern consistency** - Tests follow project test patterns

## Estimated Size

- Minor updates to existing tests (targeted additions)

## Dependencies

- Depends on: EXPSYSBRA-001 through EXPSYSBRA-005 (services must exist to test)
- Can run in parallel with: EXPSYSBRA-006, EXPSYSBRA-007

## Notes

- Use existing test patterns from `/tests/unit/` as reference
- Mock all external dependencies
- Test both success and failure paths
- Include edge cases: empty data, null values, malformed input
- Use descriptive test names that document expected behavior
- Follow AAA pattern: Arrange, Act, Assert

## Status

- [x] Completed

## Outcome

- Updated the ticket scope to align with existing test suites and current implementation details.
- Added targeted edge-case coverage to existing unit tests (invalid IDs/tags, cache behavior, logger validation, non-iterable calculator output, non-filtered event types).
