# APPGRAOCCSYS-010: Add Grabbing Prerequisites to wield_threateningly Action

**Status**: ✅ COMPLETED

**Originating Document**: `brainstorming/appendage-grabbing-occupation-system.md`

## Summary

Add prerequisites to the `wield_threateningly` action to ensure the actor has at least one free grabbing appendage before the action is presented as available. This completes the integration of the grabbing occupation system with the weapons mod.

## Dependencies

- APPGRAOCCSYS-009 (condition files must exist) ✅ Verified exists: `data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json`

## Assumptions Reassessment (2025-01-XX)

### Original Assumptions vs Reality

| Assumption | Reality | Correction Required |
|------------|---------|---------------------|
| Action has simple structure | Action has `generateCombinations`, `required_components`, `placeholder`, and `visual` properties | ✅ Updated "Before" section below |
| Prerequisites format is string array | Schema requires objects with `logic.condition_ref` and optional `failure_message` | ✅ Updated "After" section below |
| Description: "Brandish a weapon..." | Description: "Wield a weapon in a threatening manner to intimidate" | ✅ Corrected |
| No visual styling | Has Arctic Steel color scheme (`#112a46`, `#e6f1ff`, etc.) | ✅ Corrected |

### Files to Modify

| File | Change |
|------|--------|
| `data/mods/weapons/actions/wield_threateningly.action.json` | Add `prerequisites` array with grabbing condition reference |

## Out of Scope

- DO NOT modify the component schemas (handled in APPGRAOCCSYS-001/002)
- DO NOT modify utility functions (handled in APPGRAOCCSYS-003)
- DO NOT modify operation handlers (handled in APPGRAOCCSYS-004/005)
- DO NOT modify the operator (handled in APPGRAOCCSYS-006)
- DO NOT modify body part entities (handled in APPGRAOCCSYS-007)
- DO NOT modify weapon entities (handled in APPGRAOCCSYS-008)
- DO NOT modify condition files (handled in APPGRAOCCSYS-009)
- DO NOT add prerequisites to other weapon actions (separate tickets if needed)
- DO NOT modify the action's target resolution or template

## Implementation Details

### wield_threateningly.action.json (Actual Before)

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "weapons:wield_threateningly",
  "name": "Wield Threateningly",
  "description": "Wield a weapon in a threatening manner to intimidate",
  "generateCombinations": true,
  "required_components": {
    "actor": [
      "items:inventory"
    ]
  },
  "targets": {
    "primary": {
      "scope": "weapons:weapons_in_inventory",
      "placeholder": "target",
      "description": "Weapon to wield"
    }
  },
  "template": "wield {target} threateningly",
  "visual": {
    "backgroundColor": "#112a46",
    "textColor": "#e6f1ff",
    "hoverBackgroundColor": "#0b3954",
    "hoverTextColor": "#f0f4f8"
  }
}
```

### wield_threateningly.action.json (After)

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "weapons:wield_threateningly",
  "name": "Wield Threateningly",
  "description": "Wield a weapon in a threatening manner to intimidate",
  "generateCombinations": true,
  "required_components": {
    "actor": [
      "items:inventory"
    ]
  },
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
      },
      "failure_message": "You need at least one free hand or appendage to wield a weapon."
    }
  ],
  "targets": {
    "primary": {
      "scope": "weapons:weapons_in_inventory",
      "placeholder": "target",
      "description": "Weapon to wield"
    }
  },
  "template": "wield {target} threateningly",
  "visual": {
    "backgroundColor": "#112a46",
    "textColor": "#e6f1ff",
    "hoverBackgroundColor": "#0b3954",
    "hoverTextColor": "#f0f4f8"
  }
}
```

### Prerequisites Logic

The prerequisite `anatomy:actor-has-free-grabbing-appendage` will:
1. Check if the actor has at least one grabbing appendage (hand, tentacle, etc.)
2. Verify at least one such appendage is not locked (i.e., not already holding an item)
3. If both conditions are met, the action is available
4. If not, the action is filtered out during action discovery

### Schema Compliance Note

The `prerequisites` array requires objects with:
- `logic` (required): Either inline JSON Logic or `{ "condition_ref": "namespace:condition-id" }`
- `failure_message` (optional): Human-readable message for debugging/UI feedback

## Acceptance Criteria

### Tests That Must Pass

1. **Schema Validation**:
   - [x] Modified action file passes JSON schema validation
   - [x] `npm run validate:mod:weapons` passes

2. **Integration Tests**: `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js`
   - [x] Action is available when actor has free grabbing appendage
   - [x] Action is NOT available when actor has no free grabbing appendages
   - [x] Action is NOT available when actor has no grabbing appendages at all
   - [x] Action still correctly targets weapons in inventory
   - [x] Prerequisites are evaluated during action discovery

3. **Existing Tests**:
   - [x] `npm run test:ci` passes
   - [x] `npm run test:unit` passes
   - [x] Existing weapons tests continue to pass

### Invariants That Must Remain True

1. Action ID remains `weapons:wield_threateningly`
2. Action template remains unchanged
3. Target resolution (weapons in inventory) remains unchanged
4. Action description remains unchanged
5. JSON schema reference is preserved
6. Prerequisite references valid condition IDs

## Test File Template

See `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js` for actual implementation.

## Verification Commands

```bash
# Validate weapons mod
npm run validate:mod:weapons

# Run prerequisite tests
npm run test:integration -- tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js

# Run CI tests
npm run test:ci

# Run all weapons tests
npm run test:unit -- --testPathPattern="weapons"
npm run test:integration -- --testPathPattern="weapons"
```

## Future Considerations

- Other weapon actions (draw_weapon, sheathe_weapon, attack, etc.) may need similar prerequisites
- Two-handed weapons should use the `actor-has-two-free-grabbing-appendages` condition
- Consider item-specific prerequisites based on `anatomy:requires_grabbing.handsRequired`
- Dynamic prerequisite generation based on target weapon's requirements could be a future enhancement

## Outcome

**Completion Date**: 2025-11-25

### What Was Changed vs Originally Planned

| Originally Planned | Actual Change |
|-------------------|---------------|
| Add simple prerequisite string array | Added object-format prerequisites with `logic.condition_ref` and `failure_message` per schema requirements |
| Ticket assumed simple action structure | Ticket corrected to document actual structure (with `generateCombinations`, `required_components`, `visual`) |

### Files Modified

1. **`data/mods/weapons/actions/wield_threateningly.action.json`**
   - Added `prerequisites` array with object format
   - Minimal change: only 7 lines added

### Tests Added

1. **`tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js`** (NEW - 285 lines)
   - 14 test cases covering:
     - Action definition structure validation (4 tests)
     - Prerequisite evaluation when appendages available (3 tests)
     - Prerequisite evaluation when no appendages available (2 tests)
     - Edge cases (null actor, undefined id) (2 tests)
     - Condition definition validation (2 tests)

### Test Results

- All 160 weapons tests pass
- All 77 anatomy grabbing tests pass
- Schema validation passes
- No regressions detected
