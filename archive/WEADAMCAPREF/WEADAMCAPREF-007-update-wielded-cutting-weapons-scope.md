# WEADAMCAPREF-007: Update wielded_cutting_weapons scope

## Summary

Update the `wielded_cutting_weapons` scope to check for the new `damage-types:damage_capabilities` component and use the `has_damage_capability` operator to filter for weapons with slashing capability.

## Dependencies

- WEADAMCAPREF-002 (damage_capabilities component must exist)
- WEADAMCAPREF-003 (has_damage_capability operator must exist)

## Files to Touch

| File                                                     | Action | Description                             |
| -------------------------------------------------------- | ------ | --------------------------------------- |
| `data/mods/weapons/scopes/wielded_cutting_weapons.scope` | UPDATE | Change component check and add operator |

## Out of Scope

- Action changes (WEADAMCAPREF-006)
- Rule changes (WEADAMCAPREF-008)
- Component definitions
- Weapon entity migrations (WEADAMCAPREF-009)
- Other weapon scopes

## Implementation Details

### Before

```
weapons:wielded_cutting_weapons := actor.components.positioning:wielding.wielded_item_ids[][{
  "and": [
    { "has_component": [".", "weapons:weapon"] },
    { "has_component": [".", "damage-types:can_cut"] }
  ]
}]
```

### After

```
weapons:wielded_cutting_weapons := actor.components.positioning:wielding.wielded_item_ids[][{
  "and": [
    { "has_component": [".", "weapons:weapon"] },
    { "has_component": [".", "damage-types:damage_capabilities"] },
    { "has_damage_capability": [".", "slashing"] }
  ]
}]
```

### Key Changes

1. Replace `damage-types:can_cut` check with `damage-types:damage_capabilities` check
2. Add third condition using `has_damage_capability` operator for "slashing"
3. Keep `weapons:weapon` check unchanged

## Acceptance Criteria

### Tests That Must Pass

1. `npm run scope:lint` - Scope DSL validation passes

### Integration Tests (Run after WEADAMCAPREF-009)

After weapons are migrated:

- Scope resolves to weapons with slashing damage capability
- Scope excludes weapons without slashing (e.g., blunt-only weapons)
- Scope correctly filters from wielded items

Test cases:

- Actor wielding rapier (slashing) → included in scope
- Actor wielding longsword (slashing) → included in scope
- Actor wielding practice stick (blunt only) → excluded from scope
- Actor wielding nothing → empty scope

### Invariants That Must Remain True

1. Scope name remains `weapons:wielded_cutting_weapons`
2. Scope still filters from `positioning:wielding.wielded_item_ids`
3. Scope still requires `weapons:weapon` component
4. Scope file remains valid scope DSL syntax
5. Performance characteristics remain acceptable (no exponential filtering)

## Estimated Size

- 1 scope file (~3-5 lines changed)
