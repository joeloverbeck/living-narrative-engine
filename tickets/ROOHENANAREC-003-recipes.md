# ROOHENANAREC-003: Chicken Recipes

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
*   Verify that generating an entity from `anatomy:rooster` results in an entity with a spur and large comb/wattle.
*   Verify that generating an entity from `anatomy:hen` results in an entity without a spur and with small comb/wattle.

### Invariants
*   **Rooster Recipe**:
    *   Uses `anatomy:rooster` blueprint.
    *   Uses `anatomy:chicken_comb` (Large).
    *   Uses `anatomy:chicken_wattle` (Large).
    *   Uses `anatomy:chicken_tail` (Long/Sickle feathers).
    *   Includes `anatomy:chicken_spur`.
*   **Hen Recipe**:
    *   Uses `anatomy:hen` blueprint.
    *   Uses `anatomy:chicken_comb` (Small).
    *   Uses `anatomy:chicken_wattle` (Small).
    *   Uses `anatomy:chicken_tail` (Standard).
    *   Does *not* map a spur (slot shouldn't exist on blueprint).
