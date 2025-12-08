# PUTONCLOACT-001: Add inventory wearables scope (Completed)

Status: Completed

## Summary
- Define `clothing:inventory_wearables` scope in clothing mod that returns all wearable items from an actor's carried items.
- Use the canonical inventory component (`items:inventory.items`) — there is no usable `core:inventory` path in this mod set, so no fallback is expected.
- Mirror existing scope conventions (structure and target placeholder “clothing”) to align with other clothing scopes.

## File list
- `data/mods/clothing/scopes/inventory_wearables.scope`
- `data/mods/clothing/mod-manifest.json` (register new scope entry only)

## Out of scope
- Action, condition, rule, or operation definitions for putting on clothing.
- Changes to inventory or equipment schemas, handlers, or orchestrators.
- Broader manifest cleanups unrelated to the new scope entry.

## Acceptance criteria
- Tests:
  - `npm run validate:quick` passes.
  - Any existing linting/validation that touches `data/mods/clothing` continues to pass (no new warnings).
- Invariants:
  - Scope does not filter out wearables due to occupied slots or layers; it purely enumerates carried wearables.
  - Scope reads from `items:inventory.items` (the only supported inventory component for clothing content in this repository).
  - No behavioral changes to other clothing scopes or existing action/recipe behaviors.

## Outcome
- Added `clothing:inventory_wearables` scope that enumerates `clothing:wearable` items from `items:inventory.items` without any `core:inventory` fallback, and registered it in the clothing mod manifest. No other clothing behaviors were modified.
