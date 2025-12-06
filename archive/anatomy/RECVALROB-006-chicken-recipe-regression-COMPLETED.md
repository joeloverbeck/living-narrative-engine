# Base Chicken Recipe Simplicity Test

**Status:** ✅ COMPLETED (2024-12-02)

## Important Clarification

**The `properties` field is a VALID and useful feature.** It is used extensively in character recipes (e.g., `data/mods/fantasy/recipes/`) to filter entities by component values such as eye color, hair type, skin tone, etc.

This ticket is specifically about the **base chicken recipes** (`anatomy:rooster`, `anatomy:hen`) which should NOT use `properties` because no chicken part entity variants exist to filter between. Using `properties` on these recipes would cause validation failures.

## Files to Touch

- `tests/unit/anatomy/chicken.recipe.test.js`

## Out of Scope

- Modifying `data/mods/anatomy/recipes/rooster.recipe.json` or `data/mods/anatomy/recipes/hen.recipe.json` (unless they actually use properties incorrectly).
- Changing other tests in the file.

## Assumptions Verified (2024-12-02)

- The test file `tests/unit/anatomy/chicken.recipe.test.js` exists and contains 33 existing tests
- No actual `chicken.recipe.json` file exists - the recipes are `rooster.recipe.json` and `hen.recipe.json`
- Neither recipe currently uses the `properties` field in any slot or pattern (correct for base recipes)
- The `properties` field can appear in both `slots` and `patterns` - both should be checked
- No chicken part entity variants exist (e.g., no `large_comb` vs `small_comb`), so `properties` filtering would fail

## Acceptance Criteria

### Specific Tests

- **Unit Test (Rooster):**
  - Load the rooster recipe.
  - Verify that no slot in the recipe uses the `properties` field.
  - Verify that no pattern in the recipe uses the `properties` field.
  - Assertion: `expect(slot.properties).toBeUndefined()` for all slots.
  - Assertion: `expect(pattern.properties).toBeUndefined()` for all patterns.

- **Unit Test (Hen):**
  - Load the hen recipe.
  - Verify that no slot in the recipe uses the `properties` field.
  - Verify that no pattern in the recipe uses the `properties` field.
  - Assertion: `expect(slot.properties).toBeUndefined()` for all slots.
  - Assertion: `expect(pattern.properties).toBeUndefined()` for all patterns.

### Invariants

- Ensure this test fails if someone adds `properties` to base chicken recipe slots/patterns without first creating the corresponding entity variants to match against.
- **Note:** If chicken part variants are added in the future (e.g., `large_comb`, `small_comb`), using `properties` to filter between them would be appropriate and these tests should be updated.

---

## Outcome

### What was actually changed vs originally planned

**Original Plan:**

- Create test to verify chicken recipe doesn't use `properties` field in slots

**Discrepancies Found:**

1. Ticket originally referenced a non-existent `chicken.recipe.json` file - actual files are `rooster.recipe.json` and `hen.recipe.json`
2. Ticket didn't account for `patterns` array - the `properties` field could also be misused there
3. Original ticket wording implied `properties` was always wrong - clarified that it's valid when matching entities exist (used extensively in fantasy recipes)

**Actual Changes:**

1. Updated ticket scope to correctly reference the two recipe files (rooster and hen)
2. Extended tests to cover both `slots` and `patterns` arrays
3. Added 4 new regression tests to `tests/unit/anatomy/chicken.recipe.test.js`:
   - `should not use properties field in any slot` (rooster)
   - `should not use properties field in any pattern` (rooster)
   - `should not use properties field in any slot` (hen)
   - `should not use properties field in any pattern` (hen)
4. Updated test comments to clarify that `properties` is a valid feature used elsewhere, and these tests are specifically for base chicken recipes which lack entity variants

**Test Results:**

- All 37 tests pass (33 existing + 4 new)
- ESLint passes with no warnings
- No code changes required - recipes were already correct
