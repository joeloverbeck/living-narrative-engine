# WEAHANREQFIL-005: Update wield_threateningly Action to Use New Scope

**Status**: ✅ COMPLETED

## Summary

Update the `wield_threateningly` action to use the new `weapons:grabbable_weapons_in_inventory` scope instead of `weapons:weapons_in_inventory`.

## Context

This is the final ticket in the WEAHANREQFIL series. With the new scope in place (WEAHANREQFIL-004), the action can now correctly filter weapons based on hand requirements, ensuring:

- A longsword (2 hands) won't appear when actor has only 1 free hand
- Already-wielded weapons won't appear in the target list

## Files to Touch

| File                                                                       | Action | Purpose                             |
| -------------------------------------------------------------------------- | ------ | ----------------------------------- |
| `data/mods/weapons/actions/wield_threateningly.action.json`                | MODIFY | Update target scope                 |
| `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js` | MODIFY | Update assertion for new scope name |

## Assumptions Reassessed

**Original assumption**: Add ~50 lines of tests for new filtering behavior in `wield_threateningly_prerequisites.test.js`

**Corrected understanding**: The scope filtering behavior is already comprehensively tested in `tests/integration/mods/weapons/grabbable_weapons_scope.integration.test.js` (created in WEAHANREQFIL-004) which covers:

- Hand requirement filtering
- Already-held item exclusion
- Edge cases (no hands, default handsRequired, handsRequired: 0)
- Multi-appendage actors

The `wield_threateningly_prerequisites.test.js` file tests **prerequisites** (free grabbing appendage check), not target scope resolution. The only change needed is updating the assertion that checks the scope name (line 140-141).

## Out of Scope

- **DO NOT** modify the scope files
- **DO NOT** modify the operators
- **DO NOT** modify the rule file (`handle_wield_threateningly.rule.json`)
- **DO NOT** modify the condition file
- **DO NOT** change any other action properties (prerequisites, template, visual, etc.)

## Implementation Details

### Action File Update

Modify `data/mods/weapons/actions/wield_threateningly.action.json`:

Change (line 22):

```json
"scope": "weapons:weapons_in_inventory",
```

To:

```json
"scope": "weapons:grabbable_weapons_in_inventory",
```

### Test Updates

Update `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js`:

Update line 140-141 assertion from:

```javascript
expect(wieldThreateninglyAction.targets.primary.scope).toBe(
  'weapons:weapons_in_inventory'
);
```

To:

```javascript
expect(wieldThreateninglyAction.targets.primary.scope).toBe(
  'weapons:grabbable_weapons_in_inventory'
);
```

## Acceptance Criteria

### Tests That Must Pass

1. **Existing Tests**
   - All existing `wield_threateningly` tests must pass
   - Action validation must pass
   - All `grabbable_weapons_scope.integration.test.js` tests must pass

2. **Scope Filtering Tests** (already in `grabbable_weapons_scope.integration.test.js`)
   - ✅ `should exclude weapons requiring more hands than actor has free`
   - ✅ `should exclude weapons already being held`
   - ✅ `should default to 1 hand for weapons without anatomy:requires_grabbing`
   - ✅ `should handle actor with multiple grabbing appendages`

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
- 1 line changed in test file (update scope name assertion)
- Very small, focused change
- Final integration point for the feature

---

## Outcome

### What Changed vs Originally Planned

**Originally Planned:**

- 1 line change in action file
- ~50 lines of new tests for filtering behavior

**Actually Changed:**

- 1 line change in action file (scope name update)
- 1 line change in test file (scope name assertion update)

**Reason for Difference:**
The ticket's original assumption that ~50 lines of tests needed to be added was incorrect. Upon code review, it was found that:

1. The `wield_threateningly_prerequisites.test.js` file tests **prerequisite evaluation** (free grabbing appendage check), not target scope resolution
2. The scope filtering behavior was already comprehensively tested in `grabbable_weapons_scope.integration.test.js` (created in WEAHANREQFIL-004) with 13 test cases covering all scenarios mentioned in the ticket

### Files Modified

| File                                                                       | Change                                                                                          |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `data/mods/weapons/actions/wield_threateningly.action.json`                | Changed `scope` from `weapons:weapons_in_inventory` to `weapons:grabbable_weapons_in_inventory` |
| `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js` | Updated assertion to expect new scope name                                                      |

### Verification

- ✅ All 27 tests pass (13 scope tests + 14 prerequisite tests)
- ✅ Scope lint passes (103/103 scope files valid)
- ✅ Action schema validation passes (225/225 action files valid)
- ✅ ESLint passes (no errors, only pre-existing JSDoc warnings)
