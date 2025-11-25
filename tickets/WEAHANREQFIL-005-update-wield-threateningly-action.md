# WEAHANREQFIL-005: Update wield_threateningly Action to Use New Scope

## Summary

Update the `wield_threateningly` action to use the new `weapons:grabbable_weapons_in_inventory` scope instead of `weapons:weapons_in_inventory`.

## Context

This is the final ticket in the WEAHANREQFIL series. With the new scope in place (WEAHANREQFIL-004), the action can now correctly filter weapons based on hand requirements, ensuring:
- A longsword (2 hands) won't appear when actor has only 1 free hand
- Already-wielded weapons won't appear in the target list

## Files to Touch

| File | Action | Purpose |
|------|--------|---------|
| `data/mods/weapons/actions/wield_threateningly.action.json` | MODIFY | Update target scope |
| `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js` | MODIFY | Update/add tests for new filtering |

## Out of Scope

- **DO NOT** modify the scope files
- **DO NOT** modify the operators
- **DO NOT** modify the rule file (`handle_wield_threateningly.rule.json`)
- **DO NOT** modify the condition file
- **DO NOT** change any other action properties (prerequisites, template, visual, etc.)

## Implementation Details

### Action File Update
Modify `data/mods/weapons/actions/wield_threateningly.action.json`:

Change (around line 22):
```json
"targets": {
  "primary": {
    "scope": "weapons:weapons_in_inventory",
    "placeholder": "target",
    "description": "Weapon to wield"
  }
}
```

To:
```json
"targets": {
  "primary": {
    "scope": "weapons:grabbable_weapons_in_inventory",
    "placeholder": "target",
    "description": "Weapon to wield"
  }
}
```

### Test Updates
Update `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js`:

Add tests for the new scope behavior:
1. `should only show weapons actor can grab`
2. `should hide 2-hand weapons when actor has only 1 free hand`
3. `should show 2-hand weapons when actor has 2 free hands`
4. `should hide weapons already being wielded`

## Acceptance Criteria

### Tests That Must Pass

1. **Existing Tests**
   - All existing `wield_threateningly` tests must pass
   - Action validation must pass

2. **New Filtering Behavior Tests**
   - `should discover action with 1-hand weapon when actor has 1 free hand`
   - `should NOT discover action with 2-hand weapon when actor has only 1 free hand`
   - `should discover action with 2-hand weapon when actor has 2 free hands`
   - `should NOT include weapons already being held`

3. **Edge Cases**
   - `should handle weapons without handsRequired (defaults to 1)`
   - `should handle actors with more than 2 grabbing appendages`

### Invariants That Must Remain True

1. Action schema validation passes
2. Action prerequisites unchanged (still requires free grabbing appendage)
3. Action template unchanged
4. Action visual properties unchanged
5. Rule execution unchanged (only target filtering changes)
6. All existing functionality preserved for valid weapon selections
7. `npm run validate:mod:weapons` passes

## Dependencies

- **Requires**: WEAHANREQFIL-004 (scope must exist)
- **Blocked by**: WEAHANREQFIL-001, WEAHANREQFIL-002, WEAHANREQFIL-003, WEAHANREQFIL-004

## Estimated Scope

- 1 line changed in action file
- ~50 lines of test updates/additions
- Very small, focused change
- Final integration point for the feature
