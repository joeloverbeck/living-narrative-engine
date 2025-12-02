# Chicken Recipe Regression Test

## Files to Touch
- `tests/unit/anatomy/chicken.recipe.test.js`

## Out of Scope
- Modifying `data/mods/anatomy/recipes/chicken.recipe.json` (unless it actually uses properties incorrectly).
- Changing other tests in the file.

## Acceptance Criteria

### Specific Tests
- **Unit Test:**
    - Load the chicken recipe.
    - Verify that no slot in the recipe uses the `properties` field.
    - Assertion: `expect(slot.properties).toBeUndefined()` for all slots.

### Invariants
- Ensure this test fails if someone adds `properties` to the chicken recipe in the future (protecting against the "Failure 3" scenario where it was misused).
