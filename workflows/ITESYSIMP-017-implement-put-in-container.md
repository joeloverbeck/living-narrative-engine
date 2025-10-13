# ITESYSIMP-017: Implement Put In Container Action

**Phase:** 4 - Advanced Features
**Priority:** Medium
**Estimated Effort:** 2 hours

## Goal

Implement the `put_in_container` action so actors can move items from their inventory into open containers while respecting container capacity limits.

## Context

`take_from_container` already lets actors retrieve stored items. This ticket completes the loop by letting them stash belongings for later. The implementation needs to follow the current handler architecture (single directory, `BaseOperationHandler` subclasses, safe dispatching) and extend the Phase 4 data model that already exists in `data/mods/items`.

## Tasks

### 1. Implement `PUT_IN_CONTAINER` operation handler

Create `src/logic/operationHandlers/putInContainerHandler.js` (note: handlers live directly under `operationHandlers/`, not an `items/` sub-folder) using the same structure as `takeFromContainerHandler`:

- Extend `BaseOperationHandler` and accept `{ logger, entityManager, safeEventDispatcher }` in the constructor. Validate dependencies the same way as other handlers (see `openContainerHandler`).
- Validate parameters with `assertParamsObject`/`safeDispatchError`. Required fields: `actorEntity`, `containerEntity`, `itemEntity`, optional `result_variable` to expose the outcome to the rule context via `tryWriteContextVariable`.
- Use `entityManager.getComponentData` to read:
  - Actor inventory (`items:inventory`).
  - Container state (`items:container`).
- Ensure:
  - Inventory exists and contains the item.
  - Container exists, is open, and has a `contents` array.
- Prepare updates using the optimized batch format already used by `takeFromContainerHandler` (i.e. `instanceId`, `componentTypeId`, `componentData`) and call `batchAddComponentsOptimized(updates, true)` to keep caches coherent.
- Dispatch `items:item_put_in_container` via `safeEventDispatcher` and log success/failure using the logger obtained through `this.getLogger(executionContext)`.
- Return `{ success: boolean, error?: string }`. When `result_variable` is provided write the result into the execution context with `tryWriteContextVariable`.

### 2. Implement `VALIDATE_CONTAINER_CAPACITY` handler

Create `src/logic/operationHandlers/validateContainerCapacityHandler.js` mirroring the patterns from `validateInventoryCapacityHandler`:

- Extend `BaseOperationHandler`, inject `{ logger, entityManager, safeEventDispatcher }`.
- Parameters: `containerEntity`, `itemEntity`, `result_variable` (mandatory, the handler should always write a `{ valid: boolean, reason?: string }` object to the supplied variable).
- Use `entityManager.getComponentData` for the container (`items:container`) and item weight (`items:weight`).
- Fail fast if required components are missing, the container is closed, or `capacity` is undefined.
- Validate both max item count (`contents.length`) and total weight (sum weight components for existing contents + new item). Reuse `tryWriteContextVariable` so the caller can branch on the result.

### 3. Provide JSON schemas for the new operations

Add:

- `data/schemas/operations/putInContainer.schema.json`
- `data/schemas/operations/validateContainerCapacity.schema.json`

Both should extend `../base-operation.schema.json`, fix the `type` constant, and describe the required parameters noted above. Follow the conventions in `takeFromContainer.schema.json` and `validateInventoryCapacity.schema.json`.

### 4. Wire handlers into DI and validation infrastructure

Update the following to register the new operations alongside the existing items handlers:

- `src/dependencyInjection/tokens/tokens-core.js`
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js`
- `src/dependencyInjection/registrations/interpreterRegistrations.js`
- `tests/common/mods/ModTestHandlerFactory.js`
- `src/utils/preValidationUtils.js` (+ its accompanying unit tests) so the operations are recognised during rule pre-validation.

### 5. Add `open_containers_at_location` scope

Create `data/mods/items/scopes/open_containers_at_location.scope` that filters the existing `items:openable_containers_at_location` scope for containers where `items:container.isOpen === true`:

```
items:open_containers_at_location := items:openable_containers_at_location[{"==": [{"var": "entity.components.items:container.isOpen"}, true]}]
```

### 6. Define the `put_in_container` action

Create `data/mods/items/actions/put_in_container.action.json` using the current action schema conventions:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:put_in_container",
  "name": "Put In Container",
  "description": "Store an item from your inventory inside an open container",
  "generateCombinations": true,
  "required_components": {
    "actor": ["items:inventory"]
  },
  "targets": {
    "primary": {
      "scope": "items:open_containers_at_location",
      "placeholder": "container",
      "description": "Container to store the item in"
    },
    "secondary": {
      "scope": "items:actor_inventory_items",
      "placeholder": "item",
      "description": "Inventory item to store"
    }
  },
  "template": "Put {secondary.name} in {primary.name}"
}
```

### 7. Add condition and rule

- Condition: `data/mods/items/conditions/event-is-action-put-in-container.condition.json` copying the structure of the other `event-is-action-*` conditions.
- Rule: `data/mods/items/rules/handle_put_in_container.rule.json` that:
  1. Calls `VALIDATE_CONTAINER_CAPACITY` with `result_variable: "capacityCheck"`.
  2. Uses an `IF` block on `context.capacityCheck.valid === false` to log failure (`DISPATCH_PERCEPTIBLE_EVENT` with `perception_type: "put_in_container_failed"`) and end the turn.
  3. In the success branch:
     - Executes `PUT_IN_CONTAINER` (store the result if you need to check it later).
     - Queries actor position and resolves actor/container/item names for narrative text (reuse `QUERY_COMPONENT`, `GET_NAME`, and `SET_VARIABLE`).
     - Dispatches a perceptible event with `perception_type: "item_put_in_container"` and ends the turn successfully.
  4. Include contextual data such as failure reasons in the logged event, matching the style used in `handle_take_from_container.rule.json`.

### 8. Define events and perception types

- Create `data/mods/items/events/item_put_in_container.event.json` mirroring `item_taken_from_container.event.json`.
- Update `data/mods/core/events/perceptible_event.event.json` to add the new `perceptionType` enum values `"put_in_container_failed"` and `"item_put_in_container"`.

### 9. Update mod manifest

Append the new files to the appropriate arrays in `data/mods/items/mod-manifest.json` (actions, rules, conditions, scopes, events).

### 10. Tests

Add or extend integration tests under `tests/integration/mods/items/` to cover:

- Successful storage of an item in an open container (item removed from inventory, added to contents, perception logged, turn ends).
- Attempting to store an item when the container is closed.
- Capacity validation failures (weight and item count).
- Event dispatch checks (`item_put_in_container`, `put_in_container_failed`).

Reuse the existing test bed utilities introduced for `take_from_container` where possible.

## Validation

- [ ] Handlers extend `BaseOperationHandler` and use `safeEventDispatcher`
- [ ] `PUT_IN_CONTAINER` returns success/failure and writes to the result variable when provided
- [ ] `VALIDATE_CONTAINER_CAPACITY` checks both weight and max item limits
- [ ] Scope only surfaces open containers in the actor's location
- [ ] Action definition follows current schema (`template`, `required_components`, `generateCombinations`)
- [ ] Rule covers success and failure paths, dispatching the correct perceptible events
- [ ] New perception types added to `core:perceptible_event`
- [ ] Mod manifest lists all new resources
- [ ] Operation schemas, DI registrations, and pre-validation utilities recognise the new operations
- [ ] Integration tests cover the scenarios above and pass locally

## Dependencies

- ITESYSIMP-012: Container component must exist
- ITESYSIMP-013: Open container action must exist
- ITESYSIMP-003: Inventory component must exist

## Next Steps

After completion, proceed to:
- ITESYSIMP-018: Phase 4 comprehensive tests
- ITESYSIMP-019: Final integration and documentation
