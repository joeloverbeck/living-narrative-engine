# OXYDROSYS-018: Create hypoxia progression and damage rules

## Description

Create rules for hypoxia severity escalation and anoxic brain damage.

## Files to Create

- `data/mods/breathing/rules/handle_hypoxia_progression.rule.json`
- `data/mods/breathing/rules/handle_anoxic_damage.rule.json`

## Files to Modify

- `data/mods/breathing/mod-manifest.json` - Add rules

## Out of Scope

- HypoxiaTickSystem (handles the complex logic)
- These rules may be stubs if tick system handles progression

## Acceptance Criteria

1. **Progression rule**: May dispatch events for tick system to process
2. **Damage rule**: Applies anoxic damage to brain when unconscious
3. **Valid schemas**: Both rules pass validation

## Tests That Must Pass

- `npm run validate` - Schema validation

## Invariants

- Brain damage targets brain organ specifically
- Follows existing damage application patterns

## Outcome

**Status**: ✅ COMPLETED

### Files Created

1. **`data/mods/breathing/rules/handle_hypoxia_progression.rule.json`**
   - Stub rule dispatching `breathing:hypoxia_started` event for HypoxiaTickSystem
   - Triggers on `core:turn_ended` when entity has `breathing:hypoxic` component

2. **`data/mods/breathing/rules/handle_anoxic_damage.rule.json`**
   - Stub rule dispatching `breathing:brain_damage_started` event for HypoxiaTickSystem
   - Triggers on `core:turn_ended` when entity has `breathing:unconscious_anoxia` component

### Files Modified

- **`data/mods/breathing/mod-manifest.json`** - Added both rules to the `content.rules` array

### Tests Created

- `tests/integration/mods/breathing/hypoxiaProgressionRule.integration.test.js` (3 tests)
- `tests/integration/mods/breathing/anoxicDamageRule.integration.test.js` (4 tests)

### Validation

- ✅ Schema validation passes (`npm run validate`)
- ✅ All 7 integration tests pass

### Notes

- Rules are designed as stubs that dispatch events for the HypoxiaTickSystem (OXYDROSYS-019) to process
- Actual severity escalation and brain damage application logic will be in the tick system
