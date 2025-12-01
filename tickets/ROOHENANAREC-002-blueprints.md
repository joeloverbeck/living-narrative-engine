# ROOHENANAREC-002: Chicken Blueprints

## Description
Create the skeletal structure (blueprints) for the Rooster and Hen, strictly following the slot definitions in `specs/rooster-hen-anatomy-recipes.md`. The Rooster includes a spur slot, while the Hen does not.

## File List
*   `data/mods/anatomy/blueprints/rooster.blueprint.json`
*   `data/mods/anatomy/blueprints/hen.blueprint.json`

## Out of Scope
*   Creating part definitions (`*.entity.json`)
*   Creating recipes (`*.recipe.json`)
*   Modifying generic slot libraries (e.g., `humanoid_slots`)

## Acceptance Criteria

### Specific Tests
*   Run `npm run validate:ecosystem` to ensure blueprints are valid and references to parts/slots are resolvable.

### Invariants
*   **Rooster Blueprint**:
    *   Root is `anatomy:chicken_torso`.
    *   Has slots for `head`, `left_wing`, `right_wing`, `left_leg`, `right_leg`, `tail`.
    *   Legs have `foot` and `spur` slots.
    *   Head has `beak`, `left_eye`, `right_eye`, `comb`, `wattle` slots.
*   **Hen Blueprint**:
    *   Structure is identical to Rooster *except* it omits the `spur` slot on the legs.
