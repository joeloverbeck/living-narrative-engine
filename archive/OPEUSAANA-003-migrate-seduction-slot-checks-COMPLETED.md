# OPEUSAANA-003: Migrate seduction action prerequisites to isSlotExposed

**Status:** Completed
**Priority:** Medium
**Estimated Effort:** 0.5 day
**Dependencies:** None (can run before operator deletions)

---

## Objective

Replace the three seduction action prerequisites that use `hasClothingInSlot` with the `!isSlotExposed` pattern (with appropriate layer options) to align all clothing slot coverage checks on a single operator family.

---

## Files to Touch

### Modified
- `data/mods/seduction/actions/draw_attention_to_ass.action.json`
- `data/mods/seduction/actions/draw_attention_to_breasts.action.json`
- `data/mods/seduction/actions/grab_crotch_draw_attention.action.json`
- `tests/integration/mods/seduction/draw_attention_to_ass_action.test.js`
- `tests/integration/mods/seduction/draw_attention_to_ass_action_discovery.test.js`
- `tests/integration/mods/seduction/draw_attention_to_breasts_action.test.js`
- `tests/integration/actions/prerequisiteDebugger.integration.test.js` (message expectations)
- `tests/unit/actions/validation/prerequisiteDebugger.test.js`
- `tests/unit/actions/validation/prerequisiteErrorMessages.test.js`

### Added/Removed
- None

---

## Out of Scope
- Do not delete the `hasClothingInSlot` operator (handled in a follow-up ticket).
- Do not change other mods’ clothing prerequisites or socket exposure logic.
- Do not alter prerequisite debugger behaviors unrelated to clothing slot coverage.

---

## Acceptance Criteria

### Tests That Must Pass
1. `npm run test:integration -- tests/integration/mods/seduction --runInBand`
2. `npm run test:integration -- tests/integration/actions/prerequisiteDebugger.integration.test.js --runInBand`
3. `npm run test:unit -- tests/unit/actions/validation/prerequisiteDebugger.test.js --runInBand`
4. `npm run test:unit -- tests/unit/actions/validation/prerequisiteErrorMessages.test.js --runInBand`

### Invariants That Must Remain True
- Seduction actions still require covered torso slots with the same gameplay intent (no easier/harder activation without intentional change).
- Prerequisite debugger messaging stays accurate and actionable for clothing coverage failures.
- No other actions or scopes gain new dependencies on `hasClothingInSlot`.

---

## Notes
- Use the same layer assumptions currently implied by the actions (include underwear/accessories if needed) to avoid changing allowed outfits.

---

## Outcome
- Migrated 3 seduction actions to use `!isSlotExposed` with `includeUnderwear` and `includeAccessories` enabled, maintaining behavioral parity.
- Updated `PrerequisiteDebugger` to support `isSlotExposed` and negated operators (`!`), providing clear hints when coverage checks fail.
- Updated unit and integration tests to verify the new action structure and debugger logic.
- All specified tests passed.
