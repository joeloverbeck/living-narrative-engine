# HUNMETSYS-016: Energy Costs for Movement & Exercise

**Status:** Completed
**Phase:** 5 - Action Energy Costs
**Priority:** Medium
**Estimated Effort:** 3 hours (reduced from 5h - fewer files than anticipated)
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

### Verified Files (14 total)

**Movement Mod (1 file):**
1. `data/mods/movement/rules/go.rule.json` (1.2x multiplier)
   - ~~`run.rule.json` does NOT exist~~ - walking is the only movement action

**Exercise Mod (1 file):**
2. `data/mods/exercise/rules/handle_show_off_biceps.rule.json` (2.0x multiplier - moderate activity)

**Ballet Mod (10 files):**
3. `data/mods/ballet/rules/handle_do_bourree_couru_on_pointe.rule.json`
4. `data/mods/ballet/rules/handle_do_developpe_a_la_seconde.rule.json`
5. `data/mods/ballet/rules/handle_do_entrechat_six.rule.json`
6. `data/mods/ballet/rules/handle_do_fouette_turns.rule.json`
7. `data/mods/ballet/rules/handle_do_grand_jete.rule.json`
8. `data/mods/ballet/rules/handle_do_pirouette_en_dehors_from_fourth.rule.json`
9. `data/mods/ballet/rules/handle_do_plies_in_fifth.rule.json`
10. `data/mods/ballet/rules/handle_do_rond_de_jambe_a_terre.rule.json`
11. `data/mods/ballet/rules/handle_do_tendus_en_croix.rule.json`
12. `data/mods/ballet/rules/handle_hold_arabesque_penche.rule.json`
(All 3.0x multiplier - strenuous activity)

**Gymnastics Mod (3 files):**
13. `data/mods/gymnastics/rules/handle_do_backward_roll.rule.json`
14. `data/mods/gymnastics/rules/handle_do_cartwheel.rule.json`
15. `data/mods/gymnastics/rules/handle_do_forward_roll.rule.json`
(All 3.0x multiplier - strenuous activity)

### Excluded Files (not implementing)
- Combat mod rules: Not part of this ticket (separate mod, separate ticket if needed)
- Sex mod rules: Not part of this ticket (separate mod, separate ticket if needed)
- `handle_teleport.rule.json`: Teleportation doesn't burn energy (instant)
- `handle_travel_through_dimensions.rule.json`: Magical travel doesn't burn energy

## Implementation Pattern

### Pattern for Exercise/Ballet/Gymnastics Rules

These rules use `{ "macro": "core:logSuccessAndEndTurn" }`. Add BURN_ENERGY **immediately before** the macro call:

```json
{
  "actions": [
    // ... existing operations ...
    {
      "type": "BURN_ENERGY",
      "parameters": {
        "entity_ref": "actor",
        "activity_multiplier": 3.0
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### Pattern for Movement go.rule.json

The go rule has nested IF structures. Add BURN_ENERGY in the successful path, **before** the `{ "macro": "core:displaySuccessAndEndTurn" }` macro call.

### Implementation Notes
1. Add BURN_ENERGY operation to `actions` array, before terminal macro
2. Use `entity_ref: "actor"` (resolved automatically from event context)
3. Set appropriate `activity_multiplier` per action type
4. Keep all existing operations intact (additive not replacement)
5. BURN_ENERGY fails gracefully if entity lacks metabolic_store component

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

---

## Outcome

**Completed:** 2025-11-25

### What Changed vs. Originally Planned

**Original Plan:**
- Ticket assumed 16 files including `run.rule.json` (does not exist)
- Estimated 5 hours effort

**Actual Implementation:**
- 15 files modified (no run action exists - walking is the only movement)
- 3 hours effort (reduced scope)

### Files Modified (15 total)

| File | Multiplier | Category |
|------|-----------|----------|
| `data/mods/movement/rules/go.rule.json` | 1.2x | Walking |
| `data/mods/exercise/rules/handle_show_off_biceps.rule.json` | 2.0x | Moderate exercise |
| `data/mods/ballet/rules/handle_do_bourree_couru_on_pointe.rule.json` | 3.0x | Strenuous |
| `data/mods/ballet/rules/handle_do_developpe_a_la_seconde.rule.json` | 3.0x | Strenuous |
| `data/mods/ballet/rules/handle_do_entrechat_six.rule.json` | 3.0x | Strenuous |
| `data/mods/ballet/rules/handle_do_fouette_turns.rule.json` | 3.0x | Strenuous |
| `data/mods/ballet/rules/handle_do_grand_jete.rule.json` | 3.0x | Strenuous |
| `data/mods/ballet/rules/handle_do_pirouette_en_dehors_from_fourth.rule.json` | 3.0x | Strenuous |
| `data/mods/ballet/rules/handle_do_plies_in_fifth.rule.json` | 3.0x | Strenuous |
| `data/mods/ballet/rules/handle_do_rond_de_jambe_a_terre.rule.json` | 3.0x | Strenuous |
| `data/mods/ballet/rules/handle_do_tendus_en_croix.rule.json` | 3.0x | Strenuous |
| `data/mods/ballet/rules/handle_hold_arabesque_penche.rule.json` | 3.0x | Strenuous |
| `data/mods/gymnastics/rules/handle_do_backward_roll.rule.json` | 3.0x | Strenuous |
| `data/mods/gymnastics/rules/handle_do_cartwheel.rule.json` | 3.0x | Strenuous |
| `data/mods/gymnastics/rules/handle_do_forward_roll.rule.json` | 3.0x | Strenuous |

### Validation Results

- ✅ `npm run validate` passed (10 pre-existing violations unrelated to changes)
- ✅ BurnEnergyHandler unit tests: 17/17 passed
- ✅ All 15 JSON files validated for syntax correctness

### Tests

No new tests were added. The existing `tests/unit/logic/operationHandlers/burnEnergyHandler.test.js` test suite (17 tests) already comprehensively covers:
- Basic energy burning with multipliers
- Entity reference resolution
- Edge cases (missing components, zero energy)
- Multi-turn burning
- Error handling

Integration testing will be covered by HUNMETSYS-017 (Integration tests ticket).
