# PUTONCLOACT-003: Wire up put-on clothing flow

## Status
Completed.

## Current reality check
- The `clothing:put_on_clothing` action and its `clothing:inventory_wearables` scope already exist and are listed in the clothing mod manifest, but no condition or rule is present, so the action can never execute.
- There is no `EQUIP_CLOTHING` operation, schema, or handler in the engine. Without it the rule cannot equip items or move conflicts.
- The manifest currently lacks entries for the missing condition/rule.

## Updated scope
- Add `event-is-action-put-on-clothing.condition.json` to gate the rule on `clothing:put_on_clothing` attempts (mirror existing clothing action conditions).
- Add `handle_put_on_clothing.rule.json` to call a new `EQUIP_CLOTHING` operation, emit success/perception logs matching removal flows, regenerate descriptions on success, and emit `core:action_execution_failed` without ending the turn on failure.
- Implement `EQUIP_CLOTHING` support: schema, handler, DI registrations, whitelist/static config wiring. Handler must remove the equipped item from inventory, rely on the orchestrator for equip logic, and place displaced conflicts into inventory when possible (fallback to ground).
- Register the new condition and rule in `data/mods/clothing/mod-manifest.json`.

## File list
- `data/mods/clothing/conditions/event-is-action-put-on-clothing.condition.json`
- `data/mods/clothing/rules/handle_put_on_clothing.rule.json`
- `data/mods/clothing/mod-manifest.json` (register condition/rule; action already present)
- `data/schemas/operations/equipClothing.schema.json`
- `src/logic/operationHandlers/equipClothingHandler.js`
- DI/schema wiring: `src/dependencyInjection/tokens/tokens-core.js`, `src/dependencyInjection/registrations/operationHandlerRegistrations.js`, `src/dependencyInjection/registrations/interpreterRegistrations.js`, `src/configuration/staticConfiguration.js`, `src/utils/preValidationUtils.js`, `data/schemas/operation.schema.json`

## Out of scope
- UI discovery tweaks beyond the existing action/scope definition.
- Broader perception/log formatting or macro changes outside this rule.

## Acceptance criteria
- Success and perceptible messages are exactly `{actor} puts on {clothing}.`
- Rule calls `REGENERATE_DESCRIPTION` after successful equip and does not end the turn on failed equips.
- Failure path dispatches `core:action_execution_failed` (e.g., reason `equip_failed`) without mutating actor state; success path sets log/perception variables before ending the turn.
- `EQUIP_CLOTHING` removes the equipped item from inventory and relocates displaced conflicts to inventory when present, otherwise the ground.
- Relevant tests (unit + integration for the new operation/rule) pass.

## Outcome
- Added the missing condition and rule for `clothing:put_on_clothing`, including success/failure logging and description regeneration.
- Implemented and wired the new `EQUIP_CLOTHING` operation (schema, handler, DI, whitelist/static config) to handle inventory removal and displaced item placement.
- Registered the new content in the clothing mod manifest and added unit/integration coverage for the handler and rule.
