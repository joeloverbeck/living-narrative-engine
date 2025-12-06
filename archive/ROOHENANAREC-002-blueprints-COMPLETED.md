# ROOHENANAREC-002: Chicken Blueprints

## Status: COMPLETED ✅

## Description

Create the skeletal structure (blueprints) for the Rooster and Hen, strictly following the slot definitions in `specs/rooster-hen-anatomy-recipes.md`. The Rooster includes a spur slot, while the Hen does not.

## File List

- `data/mods/anatomy/blueprints/rooster.blueprint.json`
- `data/mods/anatomy/blueprints/hen.blueprint.json`

## Out of Scope

- Creating part definitions (`*.entity.json`)
- Creating recipes (`*.recipe.json`)
- Modifying generic slot libraries (e.g., `humanoid_slots`)
- Creating a new avian structure template

## Implementation Notes (Post-Analysis)

### Schema Version Decision

Since no avian structure template exists and creating one is out of scope, the blueprints use **schemaVersion 1.0** (the default) with explicit `slots` definitions. This follows the pattern used by `human_male.blueprint.json`.

### Eye Slots

The spec mentions `left_eye` and `right_eye` slots, but no `chicken_eye` entity exists. The blueprint defines slots with `partType: "eye"` - the recipe will need to fill these with compatible eye entities. This is consistent with how blueprints define requirements and recipes fulfill them.

### Slot Hierarchy

- Slots without `parent` are attached directly to the root (torso)
- Nested slots (e.g., `beak`, `comb`, `wattle`) specify `parent: "head"`
- Leg sub-slots (`left_foot`, `right_foot`, `left_spur`, `right_spur`) specify parent as their respective leg

## Acceptance Criteria

### Specific Tests

- Run `npm run validate:ecosystem` to ensure blueprints are valid and references to parts/slots are resolvable.

### Invariants

- **Rooster Blueprint**:
  - Root is `anatomy:chicken_torso`.
  - Has slots for `head`, `left_wing`, `right_wing`, `left_leg`, `right_leg`, `tail`.
  - Legs have `foot` and `spur` slots.
  - Head has `beak`, `left_eye`, `right_eye`, `comb`, `wattle` slots.
- **Hen Blueprint**:
  - Structure is identical to Rooster _except_ it omits the `spur` slot on the legs.

## Outcome

### What Was Actually Changed

1. **Created `rooster.blueprint.json`** (16 slots):
   - Root: `anatomy:chicken_torso`
   - Main body: `head`, `left_wing`, `right_wing`, `left_leg`, `right_leg`, `tail`
   - Head attachments: `beak`, `left_eye`, `right_eye`, `comb`, `wattle`
   - Leg attachments: `left_foot`, `right_foot`, `left_spur`, `right_spur`

2. **Created `hen.blueprint.json`** (14 slots):
   - Identical to rooster except **no spur slots** (`left_spur`, `right_spur` omitted)

3. **Created test file** `tests/unit/anatomy/chicken.blueprint.test.js`:
   - 30 tests covering all blueprint invariants
   - Tests rooster structure, hen structure, and rooster vs hen comparison

### Differences from Original Plan

1. **Schema Version**: Used v1 format (explicit `slots`) instead of v2 (structureTemplate) since no avian structure template exists and creating one was out of scope.

2. **Eye partType**: Used generic `"eye"` instead of `"chicken_eye"` since no chicken-specific eye entity exists. The recipe will fill these slots with compatible eye entities.

3. **Added comprehensive test coverage** beyond the original acceptance criteria (30 tests for all invariants).

### Validation Results

- `npm run validate:ecosystem`: ✅ PASSED (0 violations)
- Blueprint schema tests: ✅ 21 passed
- Blueprint compatibility tests: ✅ 13 passed
- All anatomy tests: ✅ 5405 passed
- New chicken blueprint tests: ✅ 30 passed
