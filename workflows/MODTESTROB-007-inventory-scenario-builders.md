# MODTESTROB-007: High-Level Scenario Builders - Inventory Scenarios

**Status:** Ready for Implementation  
**Priority:** P1 (High)  
**Estimated Time:** 3-4 hours  
**Risk Level:** Low  
**Phase:** 2 - Developer Experience

---

## Overview

Extend the shared mod testing infrastructure with high-level inventory scenario builders. The goal is to enrich `ModEntityScenarios`
with inventory- and item-focused helpers that eliminate repetitive entity setup in the items mod tests. These helpers should mirror
how existing sitting scenarios work: they return a complete entity graph that can be loaded into a `ModTestFixture` instance or used
standalone.

### Problem Statement

Item-focused tests currently assemble actors, rooms, inventory components, and container contents by hand. Each test recreates the
same boilerplate: actors with `items:inventory`, items with `items:portable` and `items:weight`, rooms, and containers. This slows
down writing new cases and makes it easy to forget required component properties.

### Target State

Scenario creation is handled via first-class helpers inside `ModEntityScenarios` and exposed on `ModTestFixture`:

```javascript
const fixture = await ModTestFixture.forAction('items', 'items:give_item');
const scenario = fixture.createInventoryTransfer({
  giverId: 'actor_giver',
  receiverId: 'actor_receiver',
  itemId: 'gold_bar',
});

await fixture.executeAction('actor_giver', 'actor_receiver', {
  additionalPayload: { secondaryId: 'gold_bar' },
});
```

The helpers encapsulate inventory capacity defaults, container metadata, and item component wiring so tests only specify intent.

### Benefits

- **Large reduction** in test setup code for inventory actions
- **Consistent inventory semantics** across unit, integration, and regression suites
- **Improved readability** via intention-revealing helpers that match the mod testing guide
- **Shared documentation** for mod authors who need inventory fixtures

---

## Prerequisites

**Required Understanding:**
- `ModEntityBuilder` and existing scenario helpers in `tests/common/mods/ModEntityBuilder.js`
- How `ModTestFixture` loads scenarios and executes mod actions
- Items mod action workflow (`items:pick_up_item`, `items:drop_item`, `items:give_item`, `items:open_container`, `items:put_in_container`)
- Component IDs used by the items mod (`items:inventory`, `items:container`, `items:portable`, `items:weight`, etc.)

**Required Files:**
- `tests/common/mods/ModEntityBuilder.js`
- `tests/common/mods/ModTestFixture.js`
- `tests/common/mods/index.js`
- `tests/unit/common/mods/ModEntityBuilder.test.js`
- `tests/unit/common/mods/sittingScenarios.test.js` (reference for scenario-specific tests)
- `docs/testing/mod-testing-guide.md`

**Development Environment:**
- Node.js 20+
- Jest test runner configured via repository defaults

---

## Detailed Steps

### Step 1: Extend `ModEntityScenarios` with inventory helpers

Add a new section to `tests/common/mods/ModEntityBuilder.js` that defines static helpers for common inventory situations. Follow the
pattern established by the sitting helpers:

1. Build entities using `ModEntityBuilder` so component wiring stays consistent.
2. Return an object that includes the assembled entities array plus convenience references (actor IDs, item IDs, container IDs).
3. Keep helpers pure – they should not mutate the fixture directly.

Recommended helpers (adjust naming if a better `create*` prefix reads clearer):
- `createInventoryLoadout(options)` – actor in a room with an `items:inventory` component pre-populated with items and capacity
  defaults (`capacity: { maxItems, maxWeight }`). Should also build entities for each item in the inventory with `items:item`,
  `items:portable`, and `items:weight`.
- `createItemsOnGround(options)` – loose items at a location without owners; useful for `pick_up_item` scenarios.
- `createContainerWithContents(options)` – container entity with `items:container` and optional locking metadata; include item
  entities that live inside the container.
- `createInventoryTransfer(options)` – two actors that share a room, with the giver holding the specified item.
- `createDropItemScenario(options)` – actor with an inventory entry pointing at the item to drop and a room entity for ground state.
- `createPickupScenario(options)` – combination of a room actor and loose item plus optional toggle for a full inventory to test
  capacity failures.
- `createOpenContainerScenario(options)` – actor plus container, with optional key entity for locked containers.
- `createPutInContainerScenario(options)` – actor holding an item and a target container with adjustable capacity (open/full cases).

Each helper should:
- Use `asRoom` for location entities and `asActor` for actors.
- Populate inventory components with the schema used by `items:inventory` (arrays of item IDs, `capacity.maxItems`,
  `capacity.maxWeight`).
- Create supporting item entities with the portable and weight components so handlers that inspect weight pass validation.
- Provide deterministic defaults (IDs like `actor_inventory`, `item_primary`, `room_inventory`) that tests can override via options.

### Step 2: Expose helpers through `ModTestFixture` and shared exports

1. Add instance methods to `tests/common/mods/ModTestFixture.js` that mirror the new helpers. Each method should:
   - Call the corresponding `ModEntityScenarios.create*` helper.
   - Invoke `this.reset([...scenario.entities])` to hydrate the fixture.
   - Return the scenario object to the caller.

   Example signature:
   ```javascript
   createInventoryLoadout(options = {}) {
     const scenario = ModEntityScenarios.createInventoryLoadout(options);
     this.reset([...scenario.entities]);
     return scenario;
   }
   ```

2. Update `tests/common/mods/index.js` to re-export the new static helpers (similar to how sitting helpers are exposed). This keeps the
   helper set discoverable for tests that use the static factory directly.

### Step 3: Add unit tests for the scenario builders

Create `tests/unit/common/mods/inventoryScenarios.test.js` that mirrors `sittingScenarios.test.js` but exercises the new helpers.
Focus on verifying component wiring and returned metadata:
- `createInventoryLoadout` returns a room, actor, and item entities with correct `items:inventory` capacity values and matching item
  entity IDs.
- `createItemsOnGround` produces entities that share the expected room location and lack owners.
- `createContainerWithContents` sets `items:container.capacity`, `contents`, and optional locked/key state.
- `createInventoryTransfer` wires both actors with the correct inventories and leaves the receiver empty by default.
- Validate option overrides (custom IDs, capacities, locked containers, full inventories, etc.).

Unit tests should import `ModEntityScenarios` from `tests/common/mods/ModEntityBuilder.js` and inspect the returned entity data
without creating a fixture.

### Step 4: Integration tests with real items actions

Add `tests/integration/common/mods/inventoryScenarios.integration.test.js` to prove that the helpers plug into actual items mod
workflows. Use `await ModTestFixture.forAction(modId, actionId, ...)` (auto-loading JSON where convenient) and the new fixture
methods. Suggested coverage:
- `items:pick_up_item`: load a pickup scenario with the item on the ground, execute the action, and assert the item moves into the
  actor's `items:inventory`.
- `items:drop_item`: start from `createDropItemScenario`, execute the action, and verify the inventory removes the item while the
  item's location moves to the room.
- `items:give_item`: use `createInventoryTransfer`, execute the action, and confirm inventories update for both actors.
- `items:open_container`: test both unlocked and locked (with key) variants created via `createOpenContainerScenario`.
- `items:put_in_container`: combine the container helper with actor inventory to ensure items move into the container and capacity
  failures trigger validation errors when requested.

Follow the patterns documented in `docs/testing/mod-testing-guide.md`:
- Always `await ModTestFixture.forAction(...)` and call `cleanup()` in `afterEach`.
- Use `fixture.reset([...scenario.entities])` to load the scenario before executing actions.
- Assert using `fixture.entityManager.getEntityInstance` and the existing domain matchers registered in `jest.setup.js`.

### Step 5: Document the helpers

Create `docs/testing/inventory-scenarios-guide.md` to document available inventory helpers for mod authors. The guide should:
- Introduce the purpose of the helpers and reference `docs/testing/mod-testing-guide.md` for architecture context.
- Provide snippets for both `ModEntityScenarios` static usage and `ModTestFixture` instance usage.
- Outline customization options (overriding capacity, toggling locked containers, simulating full inventory).
- Include migration advice showing how to replace manual entity setup with the new helpers.

---

## Validation Criteria

### Unit Tests

```bash
NODE_ENV=test npx jest tests/unit/common/mods/inventoryScenarios.test.js --runInBand --verbose
```

### Integration Tests

```bash
NODE_ENV=test npx jest tests/integration/common/mods/inventoryScenarios.integration.test.js --runInBand --verbose
```

### Code Quality

```bash
npx eslint \
  tests/common/mods/ModEntityBuilder.js \
  tests/common/mods/ModTestFixture.js \
  tests/common/mods/index.js \
  tests/unit/common/mods/inventoryScenarios.test.js \
  tests/integration/common/mods/inventoryScenarios.integration.test.js
```

---

## Files Created/Modified

### Modified Files
1. `tests/common/mods/ModEntityBuilder.js` – add inventory helper implementations.
2. `tests/common/mods/ModTestFixture.js` – expose new helpers on the fixture API.
3. `tests/common/mods/index.js` – re-export helpers for direct consumption.

### New Files
1. `tests/unit/common/mods/inventoryScenarios.test.js` – unit tests for helper coverage.
2. `tests/integration/common/mods/inventoryScenarios.integration.test.js` – integration scenarios exercising items actions.
3. `docs/testing/inventory-scenarios-guide.md` – documentation for mod authors.

---

## Testing

```bash
NODE_ENV=test npx jest \
  tests/unit/common/mods/inventoryScenarios.test.js \
  tests/integration/common/mods/inventoryScenarios.integration.test.js \
  --runInBand --silent
```

---

## Rollback Plan

```bash
rm tests/unit/common/mods/inventoryScenarios.test.js
rm tests/integration/common/mods/inventoryScenarios.integration.test.js
rm docs/testing/inventory-scenarios-guide.md
# Manually revert edits to ModEntityBuilder.js, ModTestFixture.js, and index.js
NODE_ENV=test npm run test:unit
```

---

## Commit Strategy

### Commit 1: Scenario helpers and tests

```bash
git add \
  tests/common/mods/ModEntityBuilder.js \
  tests/common/mods/ModTestFixture.js \
  tests/common/mods/index.js \
  tests/unit/common/mods/inventoryScenarios.test.js \
  tests/integration/common/mods/inventoryScenarios.integration.test.js \
  docs/testing/inventory-scenarios-guide.md
git commit -m "feat(mod-tests): add shared inventory scenarios"
```

Explain the intent, outline the new helpers, and summarize the new tests in the commit body if additional context is needed.
