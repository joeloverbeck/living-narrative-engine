# ITESYSIMP-018: Phase 4 Comprehensive Test Suite

**Phase:** 4 - Advanced Features
**Priority:** High
**Estimated Effort:** 2 hours

## Goal

Create comprehensive Phase 4 coverage for the items mod using the existing `ModTestFixture`
infrastructure. Phase 4 combines the `items:examine_item` and `items:put_in_container`
features with the previously delivered container workflow, so the focus is on
strengthening the integration suites that already live in `tests/integration/mods/items/`.

## Context

- `tests/integration/mods/items/examineItemActionDiscovery.test.js` and
  `examineItemRuleExecution.test.js` already exercise the examine action using
  `ModTestFixture.forAction('items', 'items:examine_item')` and `ModEntityBuilder`.
- `tests/integration/mods/items/putInContainerActionDiscovery.test.js` and
  `putInContainerRuleExecution.test.js` cover the container placement rule. They rely on
  `additionalPayload.secondaryId` rather than a bespoke `secondaryTargetId` argument.
- `tests/integration/mods/items/containerWorkflow.test.js` (Phase 3) and
  `fullSystemIntegration.test.js` (Phases 1-3) need to be extended so that the Phase 4
  workflow (take ↔ put with examination) is exercised end-to-end.

Use the existing helpers instead of inventing new `createActorWithInventory` or
`testBed.performAction` APIs—those do not exist in this repository.

## Tasks

### 1. Extend examine item coverage

- Update `tests/integration/mods/items/examineItemRuleExecution.test.js` to ensure the Phase 4
  edge cases are covered. The rule currently ends the actor's turn after logging the
  perception event—assert `core:turn_ended` with `success: true` instead of treating examine
  as a free action.
- Add or confirm coverage for:
  - Inventory vs. location targets (the test fixture already provides helpers through
    `ModEntityBuilder`—keep using them).
  - Multi-item scenarios to ensure sequential examinations keep dispatching
    `core:perceptible_event` with `perceptionType: 'item_examined'`.
  - Perception logging visibility via `AddPerceptionLogEntryHandler` so only the acting player
    receives the detailed description.
- In `tests/integration/mods/items/examineItemActionDiscovery.test.js`, verify the discovery
  scopes block items that lack `core:description` rather than expecting runtime failures.

> Template snippet (for reference only):
>
> ```javascript
> const fixture = await ModTestFixture.forAction('items', 'items:examine_item');
> fixture.reset([room, actor, ...items]);
> await fixture.executeAction('test:actor1', 'letter-1');
> const turnEnded = fixture.events.find((e) => e.eventType === 'core:turn_ended');
> expect(turnEnded?.payload.success).toBe(true);
> ```

### 2. Harden put-in-container scenarios

- Work within `tests/integration/mods/items/putInContainerRuleExecution.test.js` using the
  existing `ModTestFixture` pattern. Ensure the tests cover:
  - Successful transfers that populate `items:container.contents` while removing the item from
    the actor inventory.
  - Capacity failures (both max items and max weight) validating the
    `put_in_container_failed` perceptible event and a `core:turn_ended` with `success: false`.
  - Sequential placements and perception log generation (the file already contains helper
    builders—extend those rather than rebuilding new factories).
- In `tests/integration/mods/items/putInContainerActionDiscovery.test.js`, confirm that discovery
  still filters closed containers and actors without inventory. Adjust expectations to use the
  `action.id` property returned by the fixture (`ModTestFixture.discoverActions`).

### 3. Bidirectional container workflow

- Extend `tests/integration/mods/items/containerWorkflow.test.js` (or add a new describe block in
  the same file) to cover the full take → put cycle now that Phase 4 is active. Reuse the open
  fixture from Phase 3 to open a container, then use the put fixture to return the item and
  verify contents.
- Ensure the workflow asserts:
  - Item state after both operations.
  - Emitted events (`items:item_put_in_container` as well as the existing
    `items:item_taken_from_container`).
  - Turn management (each action ends the turn and reports success).

### 4. Full system integration (Phase 1-4)

- Update `tests/integration/mods/items/fullSystemIntegration.test.js` to add a Phase 4 scenario.
  The existing suite stops at `take_from_container`; extend it to:
  1. Examine the retrieved item (using the examine fixture) before or after transferring it.
  2. Place the item back into the container with `items:put_in_container`.
  3. Assert that the same entity instance maintains its components throughout the lifecycle.
- The additional scenario should share entity state between fixtures just like the current test
  shares actors between open/take/give. Remember to call `cleanup()` on any new fixtures.

## Validation

- [ ] `examineItemActionDiscovery.test.js` verifies scope union (inventory + location) and rejects
      items missing `core:description`.
- [ ] `examineItemRuleExecution.test.js` asserts perception logging and turn completion behaviour.
- [ ] `putInContainerActionDiscovery.test.js` only exposes open containers with available inventory
      items.
- [ ] `putInContainerRuleExecution.test.js` covers success, capacity, and perception logging paths.
- [ ] `containerWorkflow.test.js` exercises the take → put cycle with Phase 4 expectations.
- [ ] `fullSystemIntegration.test.js` now walks through Phases 1-4 in a single scenario.
- [ ] Perception logging verified for all involved actions.
- [ ] All relevant tests pass (unit + integration suites touched by the change).
