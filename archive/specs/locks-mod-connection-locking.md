# Locks Mod – Keyed Connection Actions

## Background

- `data/mods/patrol/entities/definitions/perimeter_of_rip_in_reality.location.json` and `.../eldritch_dimension.location.json` demonstrate how `movement:exits` specify `direction`, `target`, and a `blocker` entity ID. Blocking currently works as an all-or-nothing flag: any exit that names a blocker disappears from `movement:clear_directions` because its filter (`data/mods/movement/scopes/clear_directions.scope`) only passes exits where `movement:exit-is-unblocked` resolves truthy.
- `data/mods/movement/conditions/exit-is-unblocked.condition.json` simply checks `!entity.blocker`, which means there is no way to have a tangible blocker entity that can be toggled from a locked to unlocked state. `go.action.json` and `teleport.action.json` both rely on `movement:clear_directions`, so their action buttons vanish entirely when a blocker exists.
- `travel_through_dimensions.action.json` sidesteps normal exits by using `movement:dimensional_portals`, which accepts exits whose `blocker` carries `movement:is_dimensional_portal`. This pattern shows we can interrogate blocker components from scope logic.
- Inventory-aware actions in `data/mods/items/actions/*.json` (e.g., `pick_up_item`, `open_container`) require the actor to own `items:inventory` and filter candidates using scopes like `items:actor_inventory_items.scope`. Their rules (such as `handle_open_container.rule.json`) demonstrate how to gate behavior behind a specific key item ID stored either on the container component (`containers-core:container.keyItemId`) or in the actor inventory list.
- There is already an `items:openable` marker component (`data/mods/items/components/openable.component.json`), but it is an empty schema and does not track lock state; container state is stored on `containers-core:container.isOpen`. We need a stateful component dedicated to exit blockers so actions can flip a boolean and downstream movement scopes can react.

## Goals

1. Introduce a `locks` mod under `data/mods/` that encapsulates keyed door logic without bloating `movement` or `items`.
2. Provide two player-facing actions—`unlock connection` and `lock connection`—that operate on a blocker entity plus a key entity in inventory, using templates `unlock {blocker} with {key}` / `lock {blocker} with {key}`.
3. Store lock state and required key metadata on a reusable component so every exit that references a blocker with that component shares the same locked/unlocked state.
4. Update the movement scopes/conditions so that normal `go`/`teleport` actions respect the lock state instead of treating any blocker reference as permanent.

## Locks Mod Layout

Create `data/mods/locks/` with the usual structure:

```
locks/
  mod-manifest.json
  README.md (short description of keyed exits)
  components/
  actions/
  conditions/
  rules/
  scopes/
  entities/ (optional sample blocker definition & instance later)
```

`mod-manifest.json` should declare dependencies on `core`, `movement`, and `items` (the actions and conditions rely on exit metadata plus inventory data). List the new component, scopes, actions, rules, and conditions explicitly in the manifest's `content` block.

## Component: `mechanisms:openable`

Create `data/mods/locks/components/openable.component.json` with fields that describe a lockable connection:

- `isLocked` (boolean, required) — true when the blocker should hide all exits pointing through it from `movement:clear_directions`. Default true so doors start locked unless specified otherwise.
- `isOpen` (boolean, optional) — placeholder to decouple "open but unlocked" from "closed but unlocked"; defaults to false for now but lets future content combine open/closed visuals with lock state.
- `requiredKeyId` (string, required) — namespaced entity ID of the key item definition or instance that can operate the lock. We can follow the existing `containers-core:container.keyItemId` naming to stay consistent.
- `lockLabel` (string, optional) — short descriptive text ("heavy iron door lock") for UI/perception lines so we do not have to infer from the blocker name for every message.
- `lastChangedBy` (string, optional) — stores the entity ID of the actor who last locked/unlocked the door for logging/quest hooks (rules can update it each time the state flips).

Every blocker entity that should behave as a keyed door/portal must include this component. Because `perimeter_of_rip_in_reality` currently lists the same `patrol:dimensional_rift_blocker_instance` blocker on multiple exits, that single instance would represent the shared lock state across all referencing exits once we add the component.

## Scopes & Conditions

### Scopes

1. `locks:blockers_actor_can_unlock`
   - DSL sketch: `locks:blockers_actor_can_unlock := location.movement:exits[{ "and": [ { "var": "entity.blocker" }, { "condition_ref": "locks:blocker-is-locked" }, { "condition_ref": "locks:actor-has-key-for-blocker" } ] }].blocker`
   - Returns actual blocker entity IDs for exits in the actor's current location where: (a) the exit lists a blocker, (b) the blocker carries `mechanisms:openable.isLocked === true`, and (c) the actor possesses the required key.

2. `locks:blockers_actor_can_lock`
   - Same pattern but filtering on `locks:blocker-is-unlocked` so actors only see blockers currently unlocked (and therefore eligible to lock). Use the same `locks:actor-has-key-for-blocker` condition so PCs cannot lock something without the matching key.

3. `locks:keys_for_blocker`
   - Multi-target helper used via `contextFrom: "primary"`. DSL sketch: `locks:keys_for_blocker := actor.components.items:inventory.items[][ { "==": [ { "var": "itemId" }, { "var": "context.primary.components.mechanisms:openable.requiredKeyId" } ] } ] | actor.components.items:inventory.items[].itemId`
   - Produces the concrete key entity IDs from the actor's inventory that satisfy the selected blocker.

### Conditions

Add JSON conditions under `data/mods/locks/conditions/`:

- `locks:event-is-action-lock-connection` / `locks:event-is-action-unlock-connection` — mirror the patterns in `data/mods/movement/conditions/event-is-action-*.condition.json` so rules can subscribe to `core:attempt_action`.
- `locks:blocker-has-openable` — `has_component(entity.blocker, "mechanisms:openable")`.
- `locks:blocker-is-locked` — uses `locks:blocker-has-openable` and checks `{ "==": [ { "component": { "entity": { "var": "entity.blocker" }, "component": "mechanisms:openable", "path": "isLocked" } }, true ] }`. This is referenced from scopes and from rule guard clauses.
- `locks:blocker-is-unlocked` — identical but matches `false`.
- `locks:actor-has-key-for-blocker` — iterates `actor.components.items:inventory.items` and checks that `requiredKeyId` is included. Use `contains`/`in` logic consistent with other scope DSL expressions; when the blocker stores a definition ID but the actor inventory contains instance IDs, also accept matches on the owning definition if necessary (the rule can fallback to definition comparison by loading the target entity).

## Actions

Create two actions in `data/mods/locks/actions/`:

1. `lock_connection.action.json`
   - `id`: `locks:lock_connection`, `name`: "Lock Connection".
   - `generateCombinations: true` because we have two targets.
   - `required_components.actor`: `["items:inventory", "core:position"]` to ensure we can read the inventory and know their location.
   - Targets:
     - `primary`: scope `locks:blockers_actor_can_lock`, placeholder `blocker`.
     - `secondary`: scope `locks:keys_for_blocker`, placeholder `key`, `contextFrom: "primary"`.
   - Template: `lock {blocker} with {key}` as requested.

2. `unlock_connection.action.json`
   - Mirrors the structure but `primary.scope = locks:blockers_actor_can_unlock`.
   - Template: `unlock {blocker} with {key}`.

Both actions should include short descriptions for UI clarity ("Secure an exit by turning the matching key" etc.). Add `forbidden_components.actor` if we want to forbid locking/unlocking while restrained later; for now keep empty to reduce scope.

## Rules

Place rules under `data/mods/locks/rules/` and wire them in `mod-manifest.json`.

### handle_unlock_connection.rule.json

Event: `core:attempt_action` filtered by `locks:event-is-action-unlock-connection`.

1. Resolve `blockerEntityId` (`event.payload.targetId` should point to the blocker) and the `keyEntityId` from `event.payload.secondaryTargetId` or `event.payload.targets.secondary` depending on our action event format (match the multi-target format used elsewhere).
2. `QUERY_COMPONENT` to fetch `mechanisms:openable` from the blocker. If missing, fail gracefully (`core:display_failed_action_result`).
3. Verify `isLocked === true`; if already unlocked, inform the player ("The door is already unlocked.") and end the turn with `success: false`.
4. Confirm the actor inventory still contains the referenced key entity ID (or at least an item matching the stored `requiredKeyId`). Use `QUERY_COMPONENT` on the actor to read `items:inventory` and search for the ID; bail out if the key has been removed mid-turn.
5. With validations passed:
   - `MODIFY_COMPONENT` on the blocker, setting `mechanisms:openable.isLocked` to `false` and `mechanisms:openable.lastChangedBy` to the actor ID.
   - Optionally set `mechanisms:openable.isOpen` to `true` if we want unlocking to open by default, or leave closed (call out in spec whichever we prefer—recommend leaving `isOpen` unchanged so future open/close actions stay meaningful).
   - `DISPATCH_PERCEPTIBLE_EVENT` at the actor's location describing the action ("{actor} unlocks {blocker} with {key}.") to mirror `handle_open_container` logging.
   - `BURN_ENERGY` or `macro core:displaySuccessAndEndTurn` to show a success message and end the turn.

### handle_lock_connection.rule.json

Identical structure but flips the logic:

1. Guard that `mechanisms:openable.isLocked === false` before proceeding.
2. Same key validation to ensure the actor holds the appropriate key.
3. `MODIFY_COMPONENT` to set `isLocked: true`, optionally `isOpen: false`.
4. Dispatch a perceptible event ("{actor} locks {blocker}.") and optionally a distinct perception type like `connection_locked`.
5. End the turn successfully.

Both rules should share utility macros when possible (`core:display_failed_action_result`, `core:logSuccessAndEndTurn`). Include error handling for mismatched keys ("That key does not fit this lock"), using `DISPATCH_EVENT` to communicate to the UI just like `handle_open_container` uses custom messages when the key is missing.

## Movement Integration

1. Update `data/mods/movement/conditions/exit-is-unblocked.condition.json`:
   - Replace the current `!entity.blocker` test with a composite condition: allow exits where `entity.blocker` is falsy **or** where the blocker entity exists and either lacks `mechanisms:openable` (legacy behavior: treat as still blocked unless another mod-specific action—such as `travel_through_dimensions`—handles it) **or** has `mechanisms:openable.isLocked === false`.
   - Introduce a helper condition `locks:blocker-permits-entry` that checks `mechanisms:openable.isLocked === false`. The updated movement condition can reference it via `condition_ref` inside an `or` clause. Because movement is a base mod, document in the manifest that it now has an optional dependency on `locks` for this condition ID. Alternatively, the logic can be embedded directly using `has_component` guards so the `movement` mod does not need to import `locks`; the spec should call out whichever approach we adopt (recommended: inline logic with `has_component` checks so the movement mod does not need to declare a dependency—`mechanisms:openable` simply won't be present if the mod is disabled).
2. `movement:clear_directions` remains unchanged because its filter automatically re-evaluates `movement:exit-is-unblocked`. Once a blocker toggles `isLocked`, the exit will immediately show or hide from go/teleport action discovery. Teleport should respect the same gating because it shares the scope.
3. Dimensional travel remains unaffected: `movement:dimensional_portals` filters on blockers that have `movement:is_dimensional_portal`, and `travel_through_dimensions` does not rely on `exit-is-unblocked`. Document that `mechanisms:openable` should not be applied to portal blockers unless we explicitly want to require a key.

## Content Guidelines

- When defining a door-like blocker entity (e.g., `data/mods/locks/entities/definitions/steel_security_door.entity.json`), include `mechanisms:openable` with a `requiredKeyId` such as `items:brass_key`. Provide one or more instances (e.g., `locks:steel_security_door.instance.json`) so locations can reference them via the `movement:exits[].blocker` field.
- If multiple exits share the same blocker, they all inherit the same state. This mirrors how `perimeter_of_rip_in_reality` references `patrol:dimensional_rift_blocker_instance` from both sides; once we add `mechanisms:openable`, locking it from one side prevents traversal from all connected locations until someone unlocks it.
- Keys can be existing items (definitions from `data/mods/items/entities/definitions/*.json`) or new ones introduced alongside the lock. Because inventory items store their unique instance IDs in `items:inventory.items`, set `requiredKeyId` to the expected instance ID for handcrafted story locks or to a definition ID and have the rule treat definition matches as valid (document whichever path we commit to in code comments and tests).

## Testing

1. **Unit tests (scope & conditions):** Add coverage similar to `tests/unit/mods/movement/scopes.test.js` ensuring `locks:blockers_actor_can_unlock` returns blockers only when the actor holds the proper key and `isLocked === true`.
2. **Rule tests:** Mirror `data/mods/items/rules/handle_open_container` tests to verify both rules set `mechanisms:openable.isLocked` appropriately, emit the right perceptible events, and fail when the key is missing or the state is already in the desired configuration.
3. **Integration tests:** Extend `tests/integration/actions/targetResolutionService.realModules.integration.test.js` or create new integration tests under `tests/integration/locks/` to ensure `go.action` only surfaces exits when `mechanisms:openable.isLocked === false`. Include regression coverage for dimensional portal exits to confirm they still hide from `go` regardless of lock state.
4. **Content validation:** Create fixture data that adds a blocker with `mechanisms:openable` and ensure `npm run validate:ecosystem` catches schema regressions (the new component schema should be referenced in the validation harness).

With this spec in place, we can implement the `locks` mod incrementally: start by shipping the component and movement condition update, then wire up scopes/actions/rules, and finally add narrative content that uses the new functionality.
