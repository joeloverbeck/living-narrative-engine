# MODTESTROB-010-04: Migrate `giveItemRuleExecution` Suite to Inventory Transfer Helpers

## Summary
Transition `tests/integration/mods/items/giveItemRuleExecution.test.js` to use the `ModTestFixture` inventory transfer helpers and domain matchers for consistent giver/receiver flows.

## Dependencies
- MODTESTROB-010-01 baseline established.

## Tasks
1. Review current entity setup to understand giver, receiver, and item relationships constructed by `ModEntityBuilder`.
2. Replace manual setup with `fixture.createInventoryTransfer` ensuring actor and item metadata align with original expectations.
3. Call `fixture.reset(scenario.entities)` before executing the action with helper-provided IDs and payloads.
4. Update assertions to leverage:
   - Inventory expectations using helper-provided collections (`scenario.giverItems`, `scenario.receiverItems`).
   - Domain matchers for verifying action success and inventory state.
5. Remove legacy helper imports and unused utilities once the helper integration is complete.
6. Confirm any negative or edge-case tests still pass by adjusting helper configuration (e.g., additional inventory items) rather than rebuilding entities manually.

## Acceptance Criteria
- Suite no longer references `ModEntityBuilder` or `ModAssertionHelpers`.
- Inventory setup relies entirely on `createInventoryTransfer` outputs.
- Assertions rely on domain matchers and helper-derived data structures.
- Suite passes via `npm run test:integration -- tests/integration/mods/items/giveItemRuleExecution.test.js`.

## Validation
- Attach command output showing the suite passes post-refactor.
- Note any helper enhancements needed for broader migrations and forward to MODTESTROB-010-06.
