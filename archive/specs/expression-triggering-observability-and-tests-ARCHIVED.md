# Expression Triggering Observability and Tests

## Context

Expressions are loaded from `data/mods/*/expressions/` by `src/loaders/expressionLoader.js` (registered in `src/dependencyInjection/registrations/loadersRegistrations.js`). They are cached and sorted by priority in `src/expressions/expressionRegistry.js`. When the engine initializes, `src/initializers/services/initializationService.js` attaches `ExpressionPersistenceListener.handleEvent` to `ACTION_DECIDED` events via `setupPersistenceListeners(...)`.

The runtime execution path for expression triggering is:

1. `ExpressionPersistenceListener.handleEvent` (`src/expressions/expressionPersistenceListener.js`)
   - Filters out events without `actorId` or without `extractedData.moodUpdate` / `extractedData.sexualUpdate`.
   - Builds an evaluation context using `ExpressionContextBuilder.buildContext(...)`.
   - Asks `ExpressionEvaluatorService.evaluate(...)` for the highest-priority match.
   - If matched, `ExpressionDispatcher.dispatch(...)` emits a `core:perceptible_event` with the expression payload.

2. `ExpressionContextBuilder.buildContext` (`src/expressions/expressionContextBuilder.js`)
   - Calculates `emotions`, `sexualStates`, `moodAxes`, and previous state snapshots for json-logic evaluation.

3. `ExpressionEvaluatorService.evaluate` (`src/expressions/expressionEvaluatorService.js`)
   - Reads expressions in priority order from `ExpressionRegistry.getExpressionsByPriority()`.
   - Evaluates prerequisites via JsonLogic after resolving condition refs.

4. `ExpressionDispatcher.dispatch` (`src/expressions/expressionDispatcher.js`)
   - Assembles and dispatches a `core:perceptible_event` with `expressionId` in `contextualData`.

## Goals

1. Add integration and e2e tests that lock in expected expression-triggering behavior.
2. Add or promote INFO-level logging that confirms:
   - how many expressions are considered,
   - how many matched (with identifiers),
   - which expression was chosen.

## Test Specifications

### Integration Tests

Create new tests under `tests/integration/expressions/` to validate the expression system at the service-level (no UI):

1. `expressionPersistenceListener.integration.test.js`
   - **Scenario: triggers only on actual state change**
     - Arrange actor with existing mood and sexual_state components.
     - Fire `ACTION_DECIDED` event with `moodUpdate` + `sexualUpdate` identical to current component values.
     - Assert no `core:perceptible_event` is dispatched.
     - Fire another event with a changed `moodUpdate` (e.g., `valence` changes) and assert a perceptible event is dispatched.
     - This ensures we do not emit expressions on no-op updates.
   - **Scenario: uses highest priority match**
     - Inject an expression registry with two expressions whose prerequisites both pass but with different priorities.
     - Assert only the higher priority expression dispatches and that the emitted `contextualData.expressionId` matches it.
   - **Scenario: multiple prerequisites resolution**
     - Expression with multiple prerequisites (all must pass) should match; if any fail, no dispatch.
     - Use a deterministic context to exercise both pass and fail paths.

2. `expressionEvaluatorService.integration.test.js`
   - **Scenario: evaluateAll returns sorted matches**
     - Build a fake registry with several expressions and verify the returned order.
   - **Scenario: condition ref resolution errors do not match**
     - Provide a prerequisite referencing a missing condition; verify it fails without throwing and no match occurs.

3. `expressionDispatcher.integration.test.js`
   - **Scenario: dispatch with placeholder replacement**
     - Provide actor name component, expression with `{actor}` placeholders, and assert final `descriptionText` and `alternateDescriptions` are populated.
   - **Scenario: rate limiting by turn**
     - Same turn number should block the second dispatch; next turn should allow.

### E2E Tests

Add a new E2E suite under `tests/e2e/expressions/ExpressionTriggering.e2e.test.js` using the existing engine initialization harness:

1. **Happy path from LLM update to perceptible event**
   - Initialize a world with the `emotions` mod loaded.
   - Create or select an LLM-controlled actor with mood and sexual_state components.
   - Simulate `ACTION_DECIDED` with `extractedData.moodUpdate` that drives a known expression to pass (choose a specific expression from `data/mods/*/expressions/` with stable prerequisites, e.g., `emotions-positive-affect:quiet_contentment`).
   - Assert `core:perceptible_event` appears with `contextualData.expressionId` matching the expected expression.

2. **Priority selection in full stack**
   - Seed two expressions in test data where both prerequisites pass but priorities differ.
   - Trigger the event and assert only the higher-priority expression is dispatched.

3. **No dispatch on unchanged state**
   - Send `ACTION_DECIDED` with a `moodUpdate` equal to the current component values and verify no perceptible event.
   - Follow with a changed update and verify a single dispatch.

## Logging Specifications

Add INFO-level logs to improve observability of the expression system. The log messages should be structured and report identifiers to be searchable.

1. **ExpressionRegistry**
   - When `getExpressionsByPriority()` is called and cache is built, emit:
     - `ExpressionRegistry: loaded N expressions` (INFO)
   - This confirms expressions are actually in the data registry.

2. **ExpressionEvaluatorService**
   - In `evaluate(context)`:
     - Log `Expression evaluation: considering N expressions` (INFO).
     - When matches are found (use `evaluateAll(context)` or track as you go), log `Expression evaluation: matched M expressions [id1, id2, ...]` (INFO).
     - Log `Expression evaluation: selected expression {id}` (INFO) when the highest-priority match is selected, or `Expression evaluation: no match` (INFO) when none match.

3. **ExpressionPersistenceListener**
   - Optionally promote the existing match log to INFO and include `actorId` and `turnNumber`.

## Acceptance Criteria

- Integration tests confirm expression dispatch only occurs on actual mood/sexual_state changes and that priority selection is deterministic.
- E2E tests prove that a valid expression in `data/mods/*/expressions/` can trigger from an `ACTION_DECIDED` payload and yield a perceptible event.
- INFO logs provide counts and identifiers for expressions considered, matched, and selected, enabling easy validation that expressions are loaded and evaluated.

## Notes / Open Questions

- Current `ExpressionPersistenceListener` does not explicitly compare updates against the previous component values, so tests must drive or enforce a change-detection behavior in the implementation.
- Identify a stable expression in `data/mods/*/expressions/` with prerequisites that are straightforward to satisfy in an E2E fixture, or add a minimal test expression fixture specifically for testing.
