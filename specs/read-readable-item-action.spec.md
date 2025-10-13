# Read Readable Item Action Specification

## Summary
- Add a new `items:read_item` action that allows actors to read items carrying the new `items:readable` component containing readable text.
- Introduce the `items:readable` component definition and ensure items that should be readable include both `items:item` and `items:readable`.
- Create a rule handling the new action that dispatches a perceptible event only to the acting actor with the readable text, ending the actor's turn on success.
- Provide comprehensive integration test coverage for action discoverability and the new rule execution, following the existing patterns for `items:examine_item`.

## Motivation
Players need a dedicated mechanic to read in-game documents or other readable items. While `items:examine_item` surfaces descriptions publicly, a read-focused interaction should:
- Gate availability to items that explicitly expose readable content.
- Deliver the readable text directly to the acting actor without broadcasting to observers.
- Offer parity with existing items system capabilities (manifest registration, rule processing, discoverability tests).

## Scope
- **Mods content**: new component, action, rule, condition, and any supporting assets under `data/mods/items/`.
- **Testing**: new integration suites under `tests/integration/mods/items/` plus any shared test helpers required for readable items.
- **Documentation/spec alignment**: update manifests or references so the new action is discoverable by the mod loader and testing utilities.

## Detailed Requirements

### Component Definition (`data/mods/items/components/items:readable`)
- File name: `readable.component.json`.
- Schema: `schema://living-narrative-engine/component.schema.json`.
- Expose at least one required property, e.g. `text` (string, non-empty) representing the readable content.
- Disallow additional properties to keep the structure strict (mirror existing component definitions).
- Update `data/mods/items/mod-manifest.json` to include the new component in `content.components`.

### Action Definition (`data/mods/items/actions/read_item.action.json`)
- Schema: `schema://living-narrative-engine/action.schema.json`.
- `id`: `items:read_item`; name "Read Item"; description describing reading readable items.
- Targets: single primary target using the existing `items:examinable_items` scope (keeps parity with examine) unless a dedicated readable scope is required (see below).
  - Placeholder `item`; description clarifying the target must be readable.
- Required components for the primary target must include `items:item` and `items:readable`. Consider whether `core:description` should remain optional; the action should not depend on it.
- `template`: `read {item}`.
- If action discovery should skip non-readable items in the same scope, either rely on the required components or introduce a new scope (e.g. `items:readable_items`). If a new scope is needed, define it (likely a DSL union similar to `examinable_items`) and add to manifest.
- Register the action in the mod manifest `content.actions`.

### Condition Definition (`data/mods/items/conditions/event-is-action-read-item.condition.json`)
- Schema: `schema://living-narrative-engine/condition.schema.json`.
- Mirror the structure of `event-is-action-examine-item.condition.json` but target `items:read_item`.
- Add to the manifest `content.conditions`.

### Rule Definition (`data/mods/items/rules/handle_read_item.rule.json`)
- Schema: `schema://living-narrative-engine/rule.schema.json`.
- Triggered on `core:attempt_action` when the new condition matches.
- Operations should:
  1. Capture the actor and item names (via `GET_NAME`).
  2. Fetch the actor position (`core:position`) if needed for logging parity with other perceptible events.
  3. Query the new `items:readable` component on the target to retrieve the `text` payload.
  4. Dispatch a `core:perceptible_event` using `DISPATCH_PERCEPTIBLE_EVENT` with description text formatted as "{actorName} reads {itemName}: {readableText}".
     - Ensure `contextual_data.recipientIds` includes only `{event.payload.actorId}` so the message is private to the acting actor (match the pattern used in `handle_examine_item.rule.json`).
     - Choose a new `perception_type` such as `item_read`.
  5. Optionally send a follow-up `core:display_successful_action_result` brief message (e.g. "{actorName} reads {itemName}.") to keep UI feedback consistent with other item actions.
  6. End the actor's turn with success.
- Register the rule in `content.rules` and ensure any new perception type is documented if needed.

### Optional Scope Definition
- If action discovery should be restricted before component requirement checks, introduce `readable_items.scope` combining inventory/location scopes, similar to `examinable_items.scope`. Add to manifest `content.scopes` if created.

### Entity Examples
- Consider adding or updating sample item entities (e.g., `letter_to_sheriff.entity.json`) to include the `items:readable` component with sample text, demonstrating in-mod usage. Update tests accordingly if they rely on entity definitions.

## Testing Strategy

### Integration Tests for Action Discoverability
- Create a new suite `tests/integration/mods/items/readItemActionDiscovery.test.js` using `ModTestFixture.forAction('items', 'items:read_item')`.
- Mirror structure of `examineItemActionDiscovery.test.js`:
  - Verify static action metadata (id, name, description, template, required components, scope).
  - Configure the action index using the new action definition to match existing test harness behavior.
  - Cover scenarios:
    - Action appears when actor has a readable item in inventory.
    - Action appears when a readable item is present at the actor's location.
    - Action is absent when items lack the `items:readable` component (even if they have `core:description`).
    - Action is absent when no qualifying items are available.
  - Include edge cases like empty `text` or missing component data if validation rejects them.

### Integration Tests for Rule Execution
- Create `tests/integration/mods/items/readItemRuleExecution.test.js` modeled after `examineItemRuleExecution.test.js`.
- Validate that executing the action:
  - Dispatches a `core:perceptible_event` with `perceptionType` `item_read` and description text "{actorName} reads {itemName}: {readableText}".
  - Emits the event only to the acting actor (recipient IDs array equals `[actorId]`).
  - Generates any success UI message if implemented and ends the turn successfully.
  - Leaves item state unchanged (remains in inventory or on the ground).
  - Handles multi-sentence text correctly without trimming.
- Include tests ensuring non-readable items cause action execution to fail gracefully if attempted (verify error or failure event depending on engine conventions).

### Shared Test Utilities
- Extend `ModEntityBuilder` or test data builders only if necessary to easily attach `items:readable` components (e.g. add a helper `withReadableText(text)`). Update documentation/comments if new helpers are added.

### Validation & Tooling
- Run `npm run test:integration` after implementing tests to ensure suites pass.
- If new manifest entries affect validation, run `npm run validate` to confirm the mod still loads successfully.

## Dependencies & Integration Notes
- Ensure the new component ID is exported where necessary (e.g., `src/constants/componentIds.js`) so runtime systems and tests can reference it cleanly.
- Confirm any command or operation introduced in the rule (e.g., `DISPATCH_PERCEPTIBLE_EVENT`) matches existing usage; reuse event structure from `handle_examine_item.rule.json` for consistency.
- Document the new perception type (`item_read`) if analytics or UI layers rely on enumerated values.

## Open Questions
- Should the read action be discoverable for all examinable items with readable components or require a dedicated scope? Decision impacts scope definitions and tests.
- Do we need to support localization or formatting beyond a simple text field in `items:readable`? If so, expand the component schema accordingly.
- Should failure feedback differ from examine (e.g., when text is missing)? Clarify expected behavior before implementation.

