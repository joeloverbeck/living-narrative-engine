# WOUBODPAROPE-007: Use `isSlotExposed` for Torso Clothing Scopes

**Goal:** Swap manual `hasClothingInSlot` checks in torso-clothing scopes to the new `isSlotExposed` operator (with layer defaults) to align with wounded operator semantics and reduce duplication.

## File list
- `data/mods/distress/scopes/close_actors_facing_each_other_with_torso_clothing.scope`
- `data/mods/caressing/scopes/close_actors_facing_each_other_with_torso_clothing.scope`
- `tests/integration/mods/distress` (fixtures/expectations referencing the above scope)
- `tests/integration/mods/caressing` (fixtures/expectations referencing the above scope)

## Out of scope
- Any socket-based visibility scopes (handled separately)
- Changing clothing slot IDs or adding new layer concepts
- Altering action definitions or narrative outcomes

## Acceptance criteria
- Tests:
  - `npm run test:integration -- --runInBand tests/integration/mods/distress` passes
  - `npm run test:integration -- --runInBand tests/integration/mods/caressing` passes
- Invariants:
  - Scopes still differentiate between “clothed” vs “unclothed” torso exactly as before (default base/outer/armor considered covering)
  - No new dependencies or operator renames introduced in unrelated scopes
  - Scope JSON remains valid and registered under the same mod IDs
