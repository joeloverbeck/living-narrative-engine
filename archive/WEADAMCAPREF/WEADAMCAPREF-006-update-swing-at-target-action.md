# WEADAMCAPREF-006: Update swing_at_target action

## Summary

Update the `swing_at_target` action to require the new `damage-types:damage_capabilities` component instead of the marker `damage-types:can_cut` component. Add a condition using the `has_damage_capability` operator to ensure the weapon has slashing capability.

## Dependencies

- WEADAMCAPREF-002 (damage_capabilities component must exist)
- WEADAMCAPREF-003 (has_damage_capability operator must exist)

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `data/mods/weapons/actions/swing_at_target.action.json` | UPDATE | Change required_components and add condition |

## Out of Scope

- Rule modifications (WEADAMCAPREF-008)
- Scope updates (WEADAMCAPREF-007)
- Weapon entity migrations (WEADAMCAPREF-009)
- Any JavaScript/TypeScript code changes
- Other weapon actions

## Implementation Details

### Before

```json
{
  "required_components": {
    "actor": ["positioning:wielding"],
    "primary": ["weapons:weapon", "damage-types:can_cut"]
  }
}
```

### After

```json
{
  "required_components": {
    "actor": ["positioning:wielding"],
    "primary": ["weapons:weapon", "damage-types:damage_capabilities"]
  },
  "conditions": [
    {
      "description": "Weapon must have slashing damage capability",
      "expression": { "has_damage_capability": ["primary", "slashing"] }
    }
  ]
}
```

### Key Changes

1. Replace `damage-types:can_cut` with `damage-types:damage_capabilities` in `required_components.primary`
2. Add `conditions` array with `has_damage_capability` check for "slashing"
3. Keep `weapons:weapon` requirement unchanged

## Acceptance Criteria

### Tests That Must Pass

1. `npm run validate` - All mod validation passes
2. `npm run validate:mod:weapons` - Specific mod validation (if exists)

### Integration Tests (Run after WEADAMCAPREF-009)

After weapons are migrated:
- Action discovery shows `swing_at_target` for weapons with slashing capability
- Action discovery hides `swing_at_target` for weapons without slashing (e.g., practice stick with only blunt)

### Invariants That Must Remain True

1. Action still requires `weapons:weapon` component on primary target
2. Action still requires `positioning:wielding` component on actor
3. Action file remains valid JSON with proper structure
4. Existing action behavior (targeting, resolution) unchanged
5. Action ID remains `weapons:swing_at_target`

## Estimated Size

- 1 action file (~5-10 lines changed)
