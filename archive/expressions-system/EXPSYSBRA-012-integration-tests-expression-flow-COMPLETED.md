# EXPSYSBRA-012: Integration Tests for Expression Flow

## Summary

Add focused integration tests that exercise the ACTION_DECIDED -> expression evaluation -> perceptible event dispatch flow using the existing ExpressionPersistenceListener pipeline and real core expression JSON files.

## Background (Reassessed)

- The ACTION_DECIDED hook is handled by `ExpressionPersistenceListener`, which consumes `payload.extractedData.moodUpdate`/`sexualUpdate` and triggers `ExpressionContextBuilder -> ExpressionEvaluatorService -> ExpressionDispatcher`.
- `ExpressionDispatcher` dispatches `core:perceptible_event` with an `eventName` field and `perceptionType` (defaulting to `emotion.expression`).
- IntegrationTestBed wires a DI container but registers a mocked `IEmotionCalculatorService` by default, so tests should set deterministic return values on that mock instead of expecting real emotion calculations.
- Core expression content currently includes `melancholic_disappointment` (not `melancholic_longing`).
- `ExpressionRegistry` sorts by priority and then expression id; mod load order tie-breaking is not implemented here.

## File List (Expected to Touch)

### New Files
- `tests/integration/expressions/expressionFlow.integration.test.js`
- `tests/integration/expressions/expressionContentValidation.integration.test.js`

### Files to Read (NOT modify)
- `src/expressions/*.js` - Service implementations
- `data/mods/core/expressions/*.json` - Expression content
- `tests/common/integrationTestBed.js` - Integration test utilities
- `src/constants/eventIds.js` - ACTION_DECIDED identifier

## Out of Scope (MUST NOT Change)

- `src/expressions/*.js` - Service implementations
- `data/mods/core/expressions/*.json` - Expression content files
- Existing integration tests
- DI registration code
- Any production code

## Implementation Details

### 1. `expressionFlow.integration.test.js`

Tests the end-to-end flow via `ExpressionPersistenceListener` with DI wiring and real expression content.

- Initialize `IntegrationTestBed`, then register expression services explicitly.
- Load real core expression files into the data registry.
- Override `IEntityManager` and `IEventBus` with deterministic test doubles.
- Configure the mocked `IEmotionCalculatorService` to return specific emotion/sexual state maps.
- Verify:
  - `core:explosive_anger` is selected over `core:suppressed_rage` when both match.
  - `core:quiet_contentment` is selected for low-arousal positive state.
  - No dispatch occurs when no expressions match.
  - Dispatch payload includes `{actor}` replacement, `actorDescription`, and `expressionId`.

### 2. `expressionContentValidation.integration.test.js`

Validates that core expression content is consistent and evaluable.

- Load all `data/mods/core/expressions/*.json`.
- Assert unique IDs, required fields present, `{actor}` placeholder in `description_text`, and non-empty `tags`.
- If `perception_type` is present, assert it equals `emotion.expression`.

## Acceptance Criteria

### Tests That Must Pass

1. **All Integration Tests Pass**
   - Run: `npm run test:integration -- --testPathPatterns="tests/integration/expressions"`
   - All tests in green

2. **Real Content Coverage**
   - Tests use actual expression JSON files
   - Tests validate DI wiring of expression services
   - Emotion calculations are driven by the IntegrationTestBed's mock service

3. **Event Flow Verification**
   - `core:perceptible_event` dispatched with expected payload
   - Placeholder substitution verified

### Invariants That Must Remain True

1. **Service isolation** - Tests don't modify global state permanently
2. **Content integrity** - Expression files not modified during tests
3. **DI consistency** - Services resolve as expected
4. **Event correctness** - Events match actual payload shape
5. **Test independence** - Tests can run in any order
6. **Cleanup** - All test resources properly cleaned up

## Estimated Size

- 2 new test files
- ~200-350 lines total

## Dependencies

- Depends on: EXPSYSBRA-006 (DI registration), EXPSYSBRA-007 (perception type)
- Depends on: EXPSYSBRA-008, 009, 010 (expression content files)
- Depends on: EXPSYSBRA-011 (unit tests should pass first)

## Notes

- Use `IntegrationTestBed` for DI setup; register expression services explicitly (base container omits them).
- Load real expression files from `data/mods/core/expressions`.
- Use the mocked `IEmotionCalculatorService` to set deterministic emotion/sexual state values.

## Status

Completed.

## Outcome

- Updated assumptions to match the ExpressionPersistenceListener pipeline and IntegrationTestBed mocks.
- Added integration tests for expression flow and content validation.
- No production code changes required.
