# ROOHENANAREC-003: Chicken Recipes

**STATUS: COMPLETED**

## Description
Create the recipes for `anatomy:rooster` and `anatomy:hen`. These recipes map the specific chicken parts (created in ticket 001) to the blueprints (created in ticket 002), defining the final composition of the entities.

## File List
*   `data/mods/anatomy/recipes/rooster.recipe.json`
*   `data/mods/anatomy/recipes/hen.recipe.json`

## Out of Scope
*   Creating part definitions
*   Creating blueprints

## Acceptance Criteria

### Specific Tests
*   Run `npm run validate:recipe` (if available) or `npm run validate:ecosystem`.
*   Verify that generating an entity from `anatomy:rooster` results in an entity with spurs (left and right) and large comb/wattle.
*   Verify that generating an entity from `anatomy:hen` results in an entity without spurs and with small comb/wattle.

### Invariants
*   **Rooster Recipe**:
    *   Uses `anatomy:rooster` blueprint.
    *   Uses `anatomy:chicken_comb` with "large" size property override.
    *   Uses `anatomy:chicken_wattle` with "large" size property override.
    *   Uses `anatomy:chicken_tail` with "long" length property override (sickle feathers).
    *   Includes `anatomy:chicken_spur` for both `left_spur` and `right_spur` slots.
*   **Hen Recipe**:
    *   Uses `anatomy:hen` blueprint.
    *   Uses `anatomy:chicken_comb` with "small" size property override.
    *   Uses `anatomy:chicken_wattle` with "small" size property override.
    *   Uses `anatomy:chicken_tail` with no override (standard).
    *   Does *not* map spurs (slots don't exist on hen blueprint).

## Notes on Assumptions (Corrected During Implementation)
*   Original ticket mentioned a single `spur` slot, but the `anatomy:rooster` blueprint has TWO spur slots: `left_spur` and `right_spur`.
*   Size descriptors (Large/Small) are applied via the recipe's `properties` field using `descriptors:size_category`, not separate entity definitions.
*   Length descriptors for tail are applied via `properties` using `descriptors:length_category`.

---

## Outcome

### What Was Changed vs Originally Planned

**Original Plan:**
- Create rooster and hen recipes with single `spur` slot for rooster
- Size variations handled via separate entity definitions

**Actual Implementation:**
- Created `rooster.recipe.json` with `left_spur` AND `right_spur` slots (matching the blueprint's actual structure)
- Created `hen.recipe.json` without spur slots (matching the blueprint)
- Used `properties` field with `descriptors:size_category` for Large/Small comb and wattle variations
- Used `properties` field with `descriptors:length_category` for Long tail on rooster
- Used `anatomy:feline_eye_amber_slit` as placeholder for avian eyes (no dedicated chicken eye entity exists yet)

**Files Created:**
1. `data/mods/anatomy/recipes/rooster.recipe.json` - Full rooster anatomy with large comb/wattle, long tail, and bilateral spurs
2. `data/mods/anatomy/recipes/hen.recipe.json` - Full hen anatomy with small comb/wattle, standard tail, no spurs

**Tests Created:**
1. `tests/unit/anatomy/chicken.recipe.test.js` - 42 test cases covering:
   - Basic recipe structure validation
   - Slot property overrides (size, length)
   - Spur presence/absence difference between rooster and hen
   - Pattern definitions for bilateral body parts
   - Recipe-blueprint slot coverage validation

**Validation:**
- `npm run validate:ecosystem` - PASSED (0 violations across 47 mods)
- All 166 chicken-related tests pass
- Recipe schema validation tests pass

**Key Corrections Made to Ticket:**
- Updated assumption about single `spur` slot to correctly describe TWO spur slots (`left_spur`, `right_spur`)
- Clarified how size/length descriptors are applied via properties field rather than separate entities
