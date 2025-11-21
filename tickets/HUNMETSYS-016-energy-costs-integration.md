# HUNMETSYS-016: Energy Costs for Movement & Exercise

**Status:** Not Started  
**Phase:** 5 - Action Energy Costs  
**Priority:** Medium  
**Estimated Effort:** 5 hours  
**Dependencies:** HUNMETSYS-003 (BURN_ENERGY), HUNMETSYS-007 (Turn processing rules)

## Objective

Integrate BURN_ENERGY operation into existing movement and exercise action rules to make actions consume energy, creating strategic gameplay decisions around energy management.

## Context

With the BURN_ENERGY operation handler created and turn-based energy burn working, we now add energy costs to user actions. This creates strategic depth: running costs more than walking, exercise drains energy quickly, and players must plan around their energy reserves.

**Energy Cost Multipliers (from spec):**
- Walking: 1.2x base burn rate
- Running: 2.0x base burn rate
- Ballet/Gymnastics: 3.0x base burn rate
- Combat: 2.5x base burn rate (if applicable)
- Sex: 2.5x base burn rate (if applicable)

## Files to Touch

### Modified Files (6+)
**Movement Mod:**
1. `data/mods/movement/rules/go.rule.json` (1.2x multiplier)
2. `data/mods/movement/rules/run.rule.json` (2.0x multiplier - if exists)

**Exercise Mods:**
3. `data/mods/ballet/rules/*` (3.0x multiplier - all ballet actions)
4. `data/mods/gymnastics/rules/*` (3.0x multiplier - all gymnastics actions)

**Optional (if mods exist):**
5. Combat mod rules (2.5x multiplier)
6. Sex mod rules (2.5x multiplier)

## Implementation Pattern

### Example: go.rule.json
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_go",
  "event_type": "core:attempt_action",
  "condition": {
    "==": ["{event.payload.actionId}", "movement:go"]
  },
  "actions": [
    {
      "type": "CHANGE_LOCATION",
      "parameters": {
        "entity_ref": "{event.payload.actorId}",
        "target_location": "{event.payload.targetLocation}"
      }
    },
    {
      "type": "BURN_ENERGY",
      "parameters": {
        "entity_ref": "{event.payload.actorId}",
        "activity_multiplier": 1.2
      }
    },
    {
      "type": "DISPATCH_EVENT",
      "parameters": {
        "event_type": "core:action_completed",
        "payload": {
          "actorId": "{event.payload.actorId}",
          "actionId": "movement:go",
          "success": true
        }
      }
    }
  ]
}
```

### Pattern for All Mods
1. Add BURN_ENERGY operation to `actions` array
2. Set appropriate `activity_multiplier`
3. Keep all existing operations intact (additive not replacement)

## Out of Scope

**Not Included:**
- ❌ Creating new actions
- ❌ Modifying action prerequisites (no minimum energy requirements yet)
- ❌ Gameplay balancing (use spec values as starting point)
- ❌ Variable energy costs based on conditions (fixed multipliers for now)
- ❌ Energy recovery mechanics (already handled by rest action)

## Acceptance Criteria

**Must Have:**
- ✅ All movement action rules include BURN_ENERGY
- ✅ All exercise action rules include BURN_ENERGY
- ✅ Correct multipliers applied per action type
- ✅ Existing action logic preserved (operations added, not replaced)
- ✅ All modified rules validate against schema
- ✅ Mods load successfully
- ✅ Manual testing shows energy decreasing after actions

**Nice to Have:**
- Consider: Minimum energy prerequisites for strenuous actions
- Consider: Variable costs based on actor condition (injured, tired, etc.)

## Testing Strategy

### Manual Validation
1. **Schema Validation:**
   ```bash
   npm run validate
   ```

2. **Manual Testing:**
   - Create actor with metabolic_store (energy: 1000)
   - Perform walking action → verify energy decreased by ~1.2 units
   - Perform running action → verify energy decreased by ~2.0 units
   - Perform ballet action → verify energy decreased by ~3.0 units
   - Verify energy never goes below 0

### Verification Script
```bash
# Check all modified rules still validate
npm run validate

# Verify BURN_ENERGY added to movement rules
grep -r "BURN_ENERGY" data/mods/movement/rules/

# Verify BURN_ENERGY added to exercise rules
grep -r "BURN_ENERGY" data/mods/ballet/rules/
grep -r "BURN_ENERGY" data/mods/gymnastics/rules/

# Check multipliers are correct
grep -A 2 "BURN_ENERGY" data/mods/movement/rules/go.rule.json | grep "1.2"
grep -A 2 "BURN_ENERGY" data/mods/ballet/rules/*.rule.json | grep "3.0"
```

## Invariants

**Rule Structure:**
1. BURN_ENERGY must be added to actions array, not replace existing operations
2. activity_multiplier must be >= 1.0 (actions always burn more than resting)
3. BURN_ENERGY should come after primary action logic but before action_completed event

**Energy Behavior:**
- Energy decreases immediately when action attempted
- Energy cannot go below 0 (clamped by BURN_ENERGY handler)
- Base burn rate comes from metabolic_store component
- Multiplier scales the burn for this specific action

## Edge Cases

1. **Missing metabolic_store Component:**
   - BURN_ENERGY handler throws error
   - Action fails (desired behavior - non-metabolic entities can't perform metabolic actions)

2. **Energy Reaches Zero:**
   - BURN_ENERGY clamps to 0
   - Hunger state becomes "critical"
   - Future work: block strenuous actions when critical

3. **Multiple Actions Same Turn:**
   - Each action burns energy independently
   - Total burn accumulates correctly

## References

- **Spec:** Section "Action Integration" (p. 18-19)
- **Spec:** Section "Implementation Phases - Phase 5" (p. 34)
- **Previous:** HUNMETSYS-003 (BURN_ENERGY handler)
- **Next:** HUNMETSYS-017 (Integration tests)

## Notes

**Implementation Priority:**
1. Movement mod (go, run) - highest impact
2. Exercise mods (ballet, gymnastics) - high visibility
3. Combat/sex mods - if they exist

**Balancing Notes:**
- Values from spec are starting points
- May need tuning after playtesting
- Consider: Make multipliers configurable in mod manifest
- Future: Energy costs could be per-action rather than per-mod

**Integration Considerations:**
- Maintain backward compatibility (actions work without metabolism mod)
- BURN_ENERGY should fail gracefully if components missing
- Don't break existing gameplay loops
