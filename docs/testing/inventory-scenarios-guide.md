# Inventory Scenario Helpers

## Overview

The inventory scenario helpers extend the shared mod testing infrastructure with purpose-built entity graphs for
items-focused actions. They eliminate the repetitive setup previously required in tests for `items:pick_up_item`,
`items:drop_item`, `items:give_item`, `items:open_container`, and `items:put_in_container`. For a refresher on the
underlying architecture, see the [Mod Testing Guide](./mod-testing-guide.md).

These helpers mirror the sitting scenarios: each builder returns a fully wired set of entities that can be provided to a
`ModTestFixture` or consumed directly through `ModEntityScenarios`.

## Available Helpers

| Helper | Purpose |
| ------ | ------- |
| `createInventoryLoadout(options)` | Actor with populated inventory and default capacity for ownership tests. |
| `createItemsOnGround(options)` | Loose items positioned in a room with optional observing actor. |
| `createContainerWithContents(options)` | Containers pre-filled with contents and optional key metadata. |
| `createInventoryTransfer(options)` | Two actors configured for `items:give_item` style transfers. |
| `createDropItemScenario(options)` | Actor ready to drop an owned item. |
| `createPickupScenario(options)` | Actor and ground item setup for `items:pick_up_item`. |
| `createOpenContainerScenario(options)` | Actor, container, and optional key for `items:open_container`. |
| `createPutInContainerScenario(options)` | Actor holding an item plus container prepared for storage actions. |

## Static Usage

```javascript
import { ModEntityScenarios } from '../../tests/common/mods/ModEntityBuilder.js';

const scenario = ModEntityScenarios.createInventoryTransfer({
  giverId: 'giver',
  receiverId: 'receiver',
  item: { id: 'artifact', weight: 2 },
});

// scenario.entities is ready to pass into ModEntityBuilder-based tests
```

Each helper returns a structured object with convenience fields such as `room`, `actor`, `items`, `container`, and
`entities`. `entities` always contains the full entity graph in loading order.

## Fixture Usage

```javascript
const fixture = await ModTestFixture.forAction('items', 'items:put_in_container');
const scenario = fixture.createPutInContainerScenario({
  actor: { id: 'actor_putter' },
  container: { id: 'supply_crate' },
  item: { id: 'supply', weight: 0.5 },
});

await fixture.executeAction('actor_putter', 'supply_crate', {
  additionalPayload: { secondaryId: scenario.heldItem.id },
});
```

Calling a fixture helper automatically resets the fixture with the generated entities and returns the same scenario
metadata available from the static helpers.

## Customization Reference

- **Capacity overrides** – Supply `capacity: { maxWeight, maxItems }` to `createInventoryLoadout` or
  `createInventoryTransfer` to adjust inventory limits. Container helpers accept the same shape via
  `capacity`/`container.capacity`.
- **Locked containers** – Provide `requiresKey: true` (or `locked: true` via `createOpenContainerScenario`) and an optional
  `keyItem` definition. Pair the key ID with `actor.inventoryItems` to place the key in the actor’s inventory.
- **Full inventories/containers** – Pass `fullInventory: true` to `createPickupScenario` or `containerFull: true` to
  `createPutInContainerScenario` to generate filler items that exercise capacity failures.
- **Item metadata** – Each item definition supports `itemData`, `portableData`, `weightData`, and `components` for
  granular control.

## Migration Notes

1. Replace manual entity construction in inventory-focused tests with the helper that matches the action under test.
2. Use the returned `entities` array with `fixture.reset([...scenario.entities])` or the fixture convenience methods.
3. Update assertions to use the convenience references (`scenario.heldItem`, `scenario.container`, `scenario.transferItem`).
4. Keep existing assertions intact—helpers preserve IDs and components while reducing boilerplate.

By standardizing inventory setup, new tests align with the shared expectations documented in the Mod Testing Guide and
stay focused on behavior rather than entity plumbing.
