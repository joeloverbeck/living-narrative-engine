# PUTONCLOACT-006: Integration and e2e coverage for put-on clothing flow

## Summary
- Add integration tests under `tests/integration/mods/clothing/` to cover action discovery (wearables in inventory, slots occupied), rule success (equipment update, conflict relocation, events/logging), and failure paths (invalid/incompatible clothing leaves state unchanged).
- Build a small end-to-end harness (mirroring `unequip` flows) that removes clothing to the ground, picks it up, and successfully equips it via the new action, asserting logs/perception and description regeneration.
- Introduce any required fixtures/mocks for inventory setup and clothing conflicts while reusing existing clothing test helpers where possible.

## File list
- `tests/integration/mods/clothing/put_on_clothing_action_discovery.test.js`
- `tests/integration/mods/clothing/put_on_clothing_rule_execution.test.js`
- `tests/integration/mods/clothing/put_on_clothing_e2e.test.js`
- `tests/fixtures/**` or shared helpers (only if new fixtures are needed for inventory/equipment setups)

## Out of scope
- Production code changes to action/rule/operation behavior beyond minimal fixes to satisfy new tests.
- Refactoring existing removal tests or unrelated clothing mod suites.
- UI/front-end test harnesses outside the integration/e2e scope described.

## Acceptance criteria
- Tests:
  - `npm run test:integration -- --runInBand --testPathPattern="put_on_clothing"` passes.
  - Any new fixtures/helpers lint cleanly (`npm run lint -- tests/integration/mods/clothing tests/fixtures` if modified).
- Invariants:
  - Action remains discoverable even when target slot/layer is occupied, sourcing wearables from inventory scope.
  - Successful execution moves the item from inventory to `clothing:equipment`, relocates displaced items (inventory or ground), fires the appropriate `clothing:equipped`/log/perception events, and regenerates description; failure path leaves state untouched and dispatches `core:action_execution_failed`.
  - End-to-end harness validates the flow: remove clothing to ground → pick up → put on, with log message `{actor} puts on {clothing}.` observed.
