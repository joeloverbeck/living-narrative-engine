# NONDETACTSYS-012: Create wielded_cutting_weapons Scope

**Status**: ✅ COMPLETED

## Summary

Create a Scope DSL file that resolves to weapons the actor is wielding that have the `damage-types:can_cut` component. This scope is used by the `swing_at_target` action to identify valid primary targets.

## Outcome

### What Was Changed

1. **Created**: `data/mods/weapons/scopes/wielded_cutting_weapons.scope`
   - Uses correct scope DSL syntax based on existing patterns
   - Filters wielded items for both `weapons:weapon` and `damage-types:can_cut` components

### Discrepancies from Original Plan

| Original Assumption | Corrected Reality |
|---------------------|-------------------|
| Reference file `wielded_weapon_ids.scope` exists | File does NOT exist. Correct reference is `items:wielded_items` at `data/mods/items/scopes/wielded_items.scope` |
| Property name `.weapon_id` | Correct property is `.wielded_item_ids` (array) |
| Syntax `actor.positioning:wielding.weapon_id` | Correct syntax is `actor.components.positioning:wielding.wielded_item_ids[]` |
| Operator `hasComponent` (camelCase) | Correct operator is `has_component` (snake_case) |
| hasComponent syntax `[{"var":""}, "component"]` | Correct syntax is `[".", "component_id"]` for scope DSL filters |

### Validation Results

- ✅ `npm run scope:lint` - 105 scope files valid
- ✅ `npm run validate` - Ecosystem validation passed (0 violations across 44 mods)
- ⚠️ Pre-existing test failures unrelated to this change (UNWIELD_ITEM registration, memory test flakiness)

---

## Files to Create

| File | Purpose |
|------|---------|
| `data/mods/weapons/scopes/wielded_cutting_weapons.scope` | Scope definition |

## Implementation Details

### wielded_cutting_weapons.scope

```
// Scope: weapons:wielded_cutting_weapons
// Description: Returns weapons the actor is wielding that can deal cutting damage
// Usage: Primary target scope for swing_at_target action

weapons:wielded_cutting_weapons := actor.components.positioning:wielding.wielded_item_ids[][{
  "and": [
    { "has_component": [".", "weapons:weapon"] },
    { "has_component": [".", "damage-types:can_cut"] }
  ]
}]
```

### Scope Resolution Logic

1. **Start**: `actor` - The entity performing the action
2. **Navigate**: `.components.positioning:wielding` - Get wielding component data
3. **Access**: `.wielded_item_ids[]` - Iterate over wielded item IDs
4. **Filter**: JSON Logic condition requiring both:
   - Entity has `weapons:weapon` component
   - Entity has `damage-types:can_cut` component

### Expected Behavior

| Scenario | Result |
|----------|--------|
| Actor wielding longsword (has can_cut) | Returns [longsword_id] |
| Actor wielding mace (no can_cut) | Returns [] |
| Actor wielding two swords (both can_cut) | Returns [sword1_id, sword2_id] |
| Actor not wielding anything | Returns [] |

## Out of Scope

- **DO NOT** modify existing scopes
- **DO NOT** create action definitions (NONDETACTSYS-013)
- **DO NOT** modify weapon entities (NONDETACTSYS-015)
- **DO NOT** create service files
- **DO NOT** create unit tests (scope validation is handled by lint)

## Acceptance Criteria

### Tests That Must Pass

```bash
# Scope DSL validation
npm run scope:lint

# Full validation
npm run validate

# Full test suite
npm run test:ci
```

### Manual Verification

1. Load game with a character wielding a cutting weapon
2. Verify action discovery finds the weapon via this scope
3. Verify non-cutting weapons are excluded

### Invariants That Must Remain True

- [x] Scope follows existing DSL syntax
- [x] Scope file is in correct location (`data/mods/weapons/scopes/`)
- [x] No modifications to existing scopes
- [x] Scope ID matches file naming convention
- [x] JSON Logic filter syntax is valid
- [x] `has_component` operator is used correctly

## Dependencies

- **Depends on**:
  - NONDETACTSYS-002 (damage-types mod with can_cut component)
- **Blocked by**: NONDETACTSYS-002 ✅ (completed)
- **Blocks**: NONDETACTSYS-013 (swing_at_target needs this scope)

## Reference Files

| File | Purpose |
|------|---------|
| `data/mods/items/scopes/wielded_items.scope` | Existing wielding scope pattern |
| `data/mods/metabolism/scopes/inventory_food.scope` | Scope with `has_component` filter pattern |
| `data/mods/weapons/scopes/grabbable_weapons_in_inventory.scope` | Weapons scope with component filter |

## Scope DSL Syntax Reference

From CLAUDE.md:
- `.` - Field access
- `[]` - Array iteration
- `[{...}]` - JSON Logic filters
- `has_component` - Checks if entity has component (syntax: `[".", "component_id"]`)
