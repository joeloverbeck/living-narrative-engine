# PUTONCLOACT-006: Integration and e2e coverage for put-on clothing flow

## Status
Completed

## Reality check
- The action, condition, rule, handler, and scope already exist and are listed in the clothing manifest (`clothing:put_on_clothing` is discoverable via `clothing:inventory_wearables`).
- There is already an integration test at `tests/integration/mods/clothing/put_on_clothing_rule_execution.test.js` that covers a happy path (equips from items:inventory, logs/perception) and a basic failure path (invalid target dispatches `core:action_execution_failed`), but it does not assert conflict relocation or state integrity on failure.
- There is no action-discovery coverage for `clothing:put_on_clothing`, and no end-to-end flow; the only clothing e2e coverage targets `remove_clothing`.

## Updated scope
- Add action discovery coverage under `tests/integration/mods/clothing/` confirming `clothing:put_on_clothing` is offered when a wearable is in inventory even if the target slot/layer is occupied, and that existing forbidden/prerequisite gating still applies.
- Extend `tests/integration/mods/clothing/put_on_clothing_rule_execution.test.js` to assert displaced/conflicting items are relocated (inventory/ground as applicable) and that failed equips leave equipment/inventory unchanged while still dispatching `core:action_execution_failed`.
- Add a small end-to-end harness that mirrors the unequip flow: remove clothing to ground → pick it up → put it on; assert the success log/perception (`{actor} puts on {clothing}.`) and description regeneration.
- Reuse existing mod test fixtures/builders; add only minimal new fixtures if strictly needed for inventory/equipment setup.

## File list
- `tests/integration/mods/clothing/put_on_clothing_action_discovery.test.js` (new)
- `tests/integration/mods/clothing/put_on_clothing_rule_execution.test.js` (extend)
- `tests/integration/mods/clothing/put_on_clothing_e2e.test.js` (new)
- `tests/fixtures/**` only if needed for inventory/equipment setup (expected to reuse existing builders)

## Out of scope
- Production behavior changes unrelated to covering the above flows.
- Refactors to existing removal/unequip suites.
- UI/front-end harnesses beyond the described integration/e2e paths.

## Acceptance criteria
- `npm run test:integration -- --runInBand --testPathPattern="put_on_clothing"` passes.
- Any touched test utilities/fixtures stay lint-clean (`npm run lint -- tests/integration/mods/clothing tests/fixtures` if modified).
- Invariants: action discoverable with occupied slot; successful equip moves item from inventory to `clothing:equipment`, relocates displaced items, fires `clothing:equipped`, logs/perception, regenerates description; failure leaves state untouched and dispatches `core:action_execution_failed`; end-to-end flow logs `{actor} puts on {clothing}.`.

## Outcome
- Added action discovery coverage, extended rule execution checks for displacement/failure state integrity, and created an end-to-end harness exercising remove → pick up → put on with success messaging.
- No production code changes were required; all work stayed within integration/e2e tests.
- Verified with `npm run test:integration -- --runInBand --coverage=false --testPathPatterns="put_on_clothing"` (coverage disabled to avoid global thresholds on partial suite) and linted the modified test folder.
