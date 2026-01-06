# EXPSIM-004: Expression evaluation and perceptible messages

## Goal
Add evaluation flow for expressions, display matching/selected expressions, and generate actor/observer perceptible event messages when triggered.

## File list
- src/domUI/expressions-simulator/ExpressionsSimulatorController.js
- src/expressions-simulator.js
- expressions-simulator.html
- css/expressions-simulator.css
- tests/unit/domUI/expressionsSimulatorController.test.js
- tests/integration/expressions/expressionsSimulator.integration.test.js

## Out of scope
- No changes to expression data packs.
- No changes to expression evaluation logic or registry behavior.
- No modifications to runtime game UI outside the simulator page.

## Acceptance criteria
### Specific tests that must pass
- New unit tests covering evaluation flow, previous-state caching, and message rendering.
- New integration test verifying expression registry counts and dispatch output via the event bus.
- Existing lint/test suites must remain green when run by the team.

### Invariants that must remain true
- Matching expressions are displayed in descending priority order.
- The selected expression is always the first match (or "none").
- Actor and observer messages are generated via `PerceptionEntryBuilder.buildForRecipient(...)` using the dispatched payload.
- If no matches exist, selected expression and messages are cleared.

## Implementation notes
- Use `ExpressionContextBuilder.buildContext(...)` with the stored `previousState` object.
- Store `previousState` only when the Trigger button is pressed.
- Use `ExpressionRegistry.getAllExpressions().length` for totals.
- Use `ExpressionDispatcher.dispatch(...)` and capture the emitted `core:perceptible_event` locally (listener/stub) via `IEventBus.subscribe(...)`.
- Use a simulator-owned actor and observer entity via `EntityManager.createEntityInstance` and shared `core:position`.
- Register a minimal runtime entity definition in the data registry if a simulator definition is missing.
- Build messages via `PerceptionEntryBuilder.buildForRecipient(...)` using the dispatched payload (requires resolving `IPerceptionEntryBuilder`).

## Status
Completed.

## Outcome
- Added simulator-owned entities, event capture, and perceptible message rendering to the controller, plus wiring for `IEventBus` and `IPerceptionEntryBuilder`.
- Extended the simulator page outputs and styling to surface totals, matches, selections, and messages.
- Added unit and integration coverage for evaluation flow, previous-state caching, and dispatch output.
