# Put-On Clothing Action (clothing mod)

## Context and Findings
- Removal-only flow: `clothing:remove_clothing`/`remove_others_clothing` use `UNEQUIP_CLOTHING` and drop items to the ground; no complementary “put on” action exists in `data/mods/clothing`.
- Clothing data path: Recipes such as `data/mods/fantasy/recipes/vespera_nightwhisper.recipe.json` and `threadscar_melissa.recipe.json` equip outfits during anatomy generation via `ClothingInstantiationService` → `EquipmentOrchestrator`. The equipment component is `clothing:equipment` (slot → layer map).
- UI flow: Selecting an entity in `anatomy-visualizer.html` triggers entity creation; `AnatomyVisualizerUI` renders anatomy and reads equipment through `ClothingManagementService.getEquippedItems`, but there is no way to re-equip removed clothing.
- Services: `ClothingManagementService.equipClothing` delegates to `EquipmentOrchestrator`, which auto-removes layer conflicts but does not expose an operation handler or rule for player-driven equipping. Conflict auto-removal currently just deletes entries from `clothing:equipment` without relocating the displaced item.
- Inventory: Actors carry items in `items:inventory`; the existing `UNEQUIP_CLOTHING` handler writes to `core:inventory` when destination is inventory, so we need to be explicit about which inventory component to touch.

## Goal
Provide an action/rule in `data/mods/clothing` that lets actors put on clothing items from their own inventory, regenerates descriptions, and works even when the target slot/layer is already occupied (the action should still be discoverable in that case).

## Scope & Targeting
- New scope `clothing:inventory_wearables` in `data/mods/clothing/scopes/` that returns all entities in `actor.components.items:inventory.items[]` with a `clothing:wearable` component. Do **not** filter by slot availability or layer occupancy to keep the action discoverable when slots are full. Consider a graceful fallback to `core:inventory.items` if that component exists on the actor.
- Target description placeholder: “clothing”.

## Action Definition
- File: `data/mods/clothing/actions/put_on_clothing.action.json`.
- id/name/template: `clothing:put_on_clothing`, name “Put On Clothing”, template `put on {clothing}`.
- Targets: single primary target using `clothing:inventory_wearables`.
- required_components: actor must have `clothing:equipment` (per request).
- forbidden_components: copy from `remove_clothing.action.json` (doing_complex_performance, being_restrained, restraining).
- prerequisites: same as removal actions (`anatomy:actor-has-two-free-grabbing-appendages`) with an appropriate failure message.
- Visual palette: same colors as removal actions (#6d4c41 text scheme).

## Rule Behavior
- File: `data/mods/clothing/rules/handle_put_on_clothing.rule.json`.
- Condition: new condition file `event-is-action-put-on-clothing.condition.json` mirroring the existing clothing action conditions.
- Flow:
  - GET_NAME actor and clothing for logging.
  - QUERY_COMPONENT actor `core:position` for perception logging.
  - Invoke an `EQUIP_CLOTHING` operation (see Operations below) on the actor with the target clothing id.
    - On success: remove the item from inventory (handled inside the operation handler), call `REGENERATE_DESCRIPTION` on the actor, set log/perception variables, and run `core:logSuccessAndEndTurn`. Success and perceptible messages must be exactly `{actor} puts on {clothing}.`
    - On failure: dispatch `core:action_execution_failed` (e.g., reason `equip_failed`) with a meaningful message (surface layer conflict errors), and skip ending the turn as successful.
- Ensure the displaced item (if any layer conflict auto-removal occurs) is placed somewhere consistent (inventory or ground) instead of disappearing.

## Operations/Handler Work
- Add a new operation schema `operations/equipClothing.schema.json` and a handler `src/logic/operationHandlers/equipClothingHandler.js`.
  - Parameters: `entity_ref`, `clothing_item_id`; optional `destination` for displaced conflicts (inventory|ground, default inventory); optional `remove_from_inventory` (default true) to pull the equipped item out of `items:inventory` (and fallback to `core:inventory` if present).
  - Behavior: validate params, verify `clothing:equipment` exists, delegate to `EquipmentOrchestrator.orchestrateEquipment` (or `ClothingManagementService` if preferred), translate conflict failures into warnings, and handle placement of any auto-removed conflicting items (ideally reuse the existing UNEQUIP flow for placement rather than silently deleting them).
  - On success, strip the equipped item from inventory to avoid it being simultaneously equipped and carried.
- Register the new operation in DI (`tokens`, `operationHandlerRegistrations`, `interpreterRegistrations`), schema config (`configuration/staticConfiguration.js`), and whitelist (`preValidationUtils.KNOWN_OPERATION_TYPES`).

## Manifest Updates
- Add the new action, rule, condition, and scope to `data/mods/clothing/mod-manifest.json`.

## Testing
- Unit tests for `equipClothingHandler` covering: param validation, missing `clothing:equipment`, inventory removal, conflict removal placement, and error propagation when `EquipmentOrchestrator` fails.
- Integration tests under `tests/integration/mods/clothing/`:
  - Action discovery: actor with `items:inventory` containing wearable items and occupied slot still sees `clothing:put_on_clothing`; forbidden/prerequisite checks mirror removal actions.
  - Rule execution success: item moves from inventory to `clothing:equipment`, conflicting item is relocated (inventory or ground), `clothing:equipped` event fires, description regeneration happens, and success log message matches `{actor} puts on {clothing}.`
  - Failure path: equipping an incompatible/invalid item logs an action_execution_failed event and leaves state unchanged.
- Add a small end-to-end harness (similar to `unequipClothingAction` tests) to assert action availability and execution after a clothing removal + pick-up flow (remove to ground → pick up → put on).
