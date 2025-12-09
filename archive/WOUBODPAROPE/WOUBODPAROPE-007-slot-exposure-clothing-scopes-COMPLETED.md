# WOUBODPAROPE-007: Torso Clothing Scope Coverage (Revised)

**Status:** Completed

**Goal (corrected):** Keep the torso clothing scopes “clothed” semantics but switch to the shared slot-exposure operator to enforce default covering layers. A direct `hasClothingInSlot` → `isSlotExposed` swap would invert the logic (because `isSlotExposed` reports uncovered slots) and break existing tests that require clothing to be present; instead, negate `isSlotExposed` to express “slot is covered by base/outer/armor”.

**Context check:**
- Current scopes already pass integration tests that assert clothing presence (`hasClothingInSlot`).
- `isSlotExposed` defaults to base/outer/armor and ignores underwear/accessories unless opted in, matching the wounded-operator refactor intent for “covered vs exposed”.
- There is no manual per-layer duplication in these scopes; the only change is adopting the shared operator without flipping semantics.

## File list
- `data/mods/distress/scopes/close_actors_facing_each_other_with_torso_clothing.scope`
- `data/mods/caressing/scopes/close_actors_facing_each_other_with_torso_clothing.scope`
- `tests/integration/mods/distress` (fixtures/expectations referencing the above scope)
- `tests/integration/mods/caressing` (fixtures/expectations referencing the above scope)
- `tests/integration/scopes/clothingSpecificScope.integration.test.js` (covers the caressing scope)

## Out of scope
- Any socket-based visibility scopes (handled separately)
- Changing clothing slot IDs or adding new layer concepts
- Altering action definitions or narrative outcomes

## Acceptance criteria
- Logic updates:
  - Torso clothing scopes use `!isSlotExposed` (with defaults) to represent “clothed”, preserving facing/closeness behavior.
  - Underwear-only setups should not satisfy the scope (since defaults ignore underwear unless explicitly included).
- Tests:
  - `npm run test:integration -- --runInBand tests/integration/mods/distress` passes
  - `npm run test:integration -- --runInBand tests/integration/mods/caressing` passes
  - Add/adjust integration coverage proving underwear-only equipment does not match the torso clothing scope
- Invariants:
  - Scope IDs and registration stay the same
  - No new operator names or unrelated scope changes

## Outcome
- Updated both torso clothing scopes to negate `isSlotExposed`, keeping “clothed” semantics while reusing the shared exposure operator and its default covering layers.
- Added integration coverage showing underwear-only torso items no longer satisfy the scope, guarding against regression to the old `hasClothingInSlot` behavior.

## Tests
- `npm run test:integration -- --runInBand tests/integration/mods/distress`
- `npm run test:integration -- --runInBand tests/integration/mods/caressing`
- `npm run test:integration -- --runInBand tests/integration/scopes/clothingSpecificScope.integration.test.js`
