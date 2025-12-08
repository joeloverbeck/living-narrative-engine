# PUTONCLOACT-002: Define put on clothing action

Status: Completed

## Summary
- Create `data/mods/clothing/actions/put_on_clothing.action.json` for `clothing:put_on_clothing` with name “Put On Clothing” and template `put on {clothing}` using target placeholder “clothing”.
- Reuse the existing `clothing:inventory_wearables` scope (already defined with no slot/layer filtering) for a single primary target; actor must have `clothing:equipment`.
- Forbidden components should mirror `remove_clothing` (doing_complex_performance, being_restrained, restraining); prerequisite condition matches removal but with a put-on-specific failure message (“You need both hands free to put on clothing.”). Palette should stay consistent with removal actions.

## File list
- `data/mods/clothing/actions/put_on_clothing.action.json`
- `data/mods/clothing/mod-manifest.json` (register new action entry)

## Out of scope
- Rule logic, condition definitions, or operation handlers for equipping clothing.
- Inventory movement, equipment orchestration, or regeneration behaviors.
- UI rendering or designer tooling changes.

## Outcome
- Added `data/mods/clothing/actions/put_on_clothing.action.json` reusing the existing wearable-inventory scope with matching gating, messaging, and palette.
- Registered the action in `data/mods/clothing/mod-manifest.json`. No scope or schema changes required.

## Acceptance criteria
- Tests:
  - `npm run validate:quick` passes.
  - Any scoped lint/JSON validation for `data/mods/clothing/actions` succeeds.
- Invariants:
  - Action remains discoverable even when target slots/layers are occupied (no filtering beyond wearable scope).
  - Forbidden components and prerequisites match the removal actions (`doing_complex_performance`, `being_restrained`, `restraining`, and `anatomy:actor-has-two-free-grabbing-appendages` with appropriate failure message).
  - Visual palette matches removal actions (e.g., #6d4c41 text scheme), and no unintended changes to existing actions or manifests.
