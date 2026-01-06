# EXPTRIOBSANDTES-001: ExpressionPersistenceListener change detection + integration tests

## Goal
Implement no-op update detection in ExpressionPersistenceListener using prior listener state (not current component state, because mood/sexual updates are already persisted before this listener runs). Extend integration coverage for change detection, priority selection, and multi-prerequisite matching.

## File list it expects to touch
- src/expressions/expressionPersistenceListener.js
- tests/integration/expressions/expressionFlow.integration.test.js
- tests/helpers/ (only if new test helpers are required for the listener harness)

## Out of scope
- Any changes to expression evaluation logic beyond comparing incoming updates to current component state.
- UI behavior or rendering changes.
- Mod data changes outside test-only fixtures.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:integration -- tests/integration/expressions/expressionFlow.integration.test.js --runInBand`

### Invariants that must remain true
- No expression dispatch occurs when the listener receives a change that is identical to its cached prior state (use prior listener snapshot since mood/sexual persistence has already updated components by the time the listener runs).
- If multiple expressions match, only the highest-priority expression dispatches.
- Expressions with multiple prerequisites only match when all prerequisites pass.
- Existing event wiring (`ACTION_DECIDED` -> `ExpressionPersistenceListener.handleEvent`) remains intact.

## Status
Completed

## Outcome
- Updated change detection to compare against the listener's cached prior evaluation state instead of current components.
- Added change-detection and multi-prerequisite integration coverage in the existing expression flow integration suite.
