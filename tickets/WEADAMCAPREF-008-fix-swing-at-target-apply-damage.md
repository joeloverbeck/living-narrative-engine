# WEADAMCAPREF-008: Fix handle_swing_at_target rule to call APPLY_DAMAGE

## Summary

**CRITICAL BUG FIX**: The `handle_swing_at_target.rule.json` currently does NOT call the `APPLY_DAMAGE` operation - it only dispatches flavor text events. This ticket adds the missing damage application logic using `QUERY_COMPONENT` to get weapon damage data and `FOR_EACH` to apply each damage entry.

## Dependencies

- WEADAMCAPREF-002 (damage_capabilities component must exist)
- WEADAMCAPREF-005 (ApplyDamageHandler accepts damage_entry)
- WEADAMCAPREF-009 (weapons must have damage_capabilities component)

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `data/mods/weapons/rules/handle_swing_at_target.rule.json` | UPDATE | Add APPLY_DAMAGE operations to SUCCESS and CRITICAL_SUCCESS branches |
| `tests/integration/mods/weapons/swingAtTargetDamageApplication.integration.test.js` | CREATE | Integration test verifying damage is applied |

## Out of Scope

- Service changes (WEADAMCAPREF-004)
- Schema changes (WEADAMCAPREF-001)
- Weapon entity migrations (WEADAMCAPREF-009 - weapons must be migrated first or simultaneously)
- Other rules
- FAILURE and FUMBLE branches (no damage applied in these cases)

## Implementation Details

### Add to SUCCESS Branch

```json
{
  "type": "QUERY_COMPONENT",
  "parameters": {
    "entity_ref": "primary",
    "component_type": "damage-types:damage_capabilities",
    "result_variable": "weaponDamage"
  }
},
{
  "type": "FOR_EACH",
  "parameters": {
    "collection": { "var": "context.weaponDamage.entries" },
    "item_variable": "dmgEntry",
    "actions": [
      {
        "type": "APPLY_DAMAGE",
        "parameters": {
          "entity_ref": "secondary",
          "damage_entry": { "var": "context.dmgEntry" }
        }
      }
    ]
  }
}
```

### Add to CRITICAL_SUCCESS Branch (with 1.5x multiplier)

```json
{
  "type": "QUERY_COMPONENT",
  "parameters": {
    "entity_ref": "primary",
    "component_type": "damage-types:damage_capabilities",
    "result_variable": "weaponDamage"
  }
},
{
  "type": "FOR_EACH",
  "parameters": {
    "collection": { "var": "context.weaponDamage.entries" },
    "item_variable": "dmgEntry",
    "actions": [
      {
        "type": "SET_VARIABLE",
        "parameters": {
          "name": "critAmount",
          "value": { "*": [{ "var": "context.dmgEntry.amount" }, 1.5] }
        }
      },
      {
        "type": "APPLY_DAMAGE",
        "parameters": {
          "entity_ref": "secondary",
          "damage_entry": {
            "merge": [
              { "var": "context.dmgEntry" },
              { "amount": { "var": "context.critAmount" } }
            ]
          }
        }
      }
    ]
  }
}
```

### Branch Behavior Summary

| Branch | Damage Applied | Multiplier |
|--------|---------------|------------|
| SUCCESS | Yes | 1.0x |
| CRITICAL_SUCCESS | Yes | 1.5x |
| FAILURE | No | N/A |
| FUMBLE | No | N/A |

## Acceptance Criteria

### Tests That Must Pass

1. `npm run validate` - Rule validation passes

2. `npm run test:integration -- tests/integration/mods/weapons/swingAtTargetDamageApplication.integration.test.js`

Test cases:
- SUCCESS outcome applies weapon damage to target
- CRITICAL_SUCCESS outcome applies 1.5x weapon damage to target
- FAILURE outcome does not apply damage
- FUMBLE outcome does not apply damage
- Multi-damage weapon (if exists) applies all damage entries
- Damage effects (bleed, dismember) are triggered when configured

### Invariants That Must Remain True

1. Existing event dispatches (`COMBAT_HIT_ANNOUNCED`, etc.) still occur
2. FAILURE and FUMBLE branches remain unchanged (no damage)
3. Rule ID remains unchanged
4. Rule condition matching remains unchanged
5. Target resolution (secondary target) remains unchanged
6. All JSON Logic expressions evaluate correctly

## Integration Test Template

```javascript
describe('swing_at_target damage application', () => {
  it('should apply weapon damage on SUCCESS', async () => {
    // Setup: Actor wielding weapon, target with health
    // Execute: Trigger swing_at_target with SUCCESS outcome
    // Verify: Target health reduced by weapon damage amount
  });

  it('should apply 1.5x damage on CRITICAL_SUCCESS', async () => {
    // Setup: Actor wielding weapon, target with health
    // Execute: Trigger swing_at_target with CRITICAL_SUCCESS outcome
    // Verify: Target health reduced by 1.5x weapon damage amount
  });

  it('should NOT apply damage on FAILURE', async () => {
    // Setup: Actor wielding weapon, target with health
    // Execute: Trigger swing_at_target with FAILURE outcome
    // Verify: Target health unchanged
  });

  it('should trigger damage effects when configured', async () => {
    // Setup: Actor wielding weapon with bleed enabled, target
    // Execute: Trigger swing_at_target with SUCCESS
    // Verify: Bleed effect applied to target
  });
});
```

## Estimated Size

- 1 rule file (~40-60 lines added)
- 1 new test file (~150-200 lines)
