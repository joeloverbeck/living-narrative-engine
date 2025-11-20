# HUNMETSYS-007: Turn-Based Processing Rules

**Status:** Ready  
**Priority:** High  
**Estimated Effort:** 5 hours  
**Phase:** 2 - Mod Structure  
**Dependencies:** HUNMETSYS-003, 004 (BURN_ENERGY, DIGEST_FOOD handlers)

## Objective

Create turn-based rules that automatically process energy burn and digestion for all entities with metabolism components each turn.

## Files to Touch

### New Files (3)
- `data/mods/metabolism/rules/turn_energy_burn.rule.json`
- `data/mods/metabolism/rules/turn_digestion.rule.json`
- `data/mods/metabolism/rules/turn_hunger_update.rule.json` (placeholder for HUNMETSYS-014)

### Modified Files (1)
- `data/mods/metabolism/mod-manifest.json` (add rules to content.rules array)

## Out of Scope

- ❌ Hunger state update logic (HUNMETSYS-014 - UPDATE_HUNGER_STATE handler)
- ❌ Body composition update logic (HUNMETSYS-015 - UPDATE_BODY_COMPOSITION handler)
- ❌ Integration tests (HUNMETSYS-017)
- ❌ Turn system implementation (assumed to exist in core mod)

## Implementation Details

### Rule 1: Turn Energy Burn

**File:** `data/mods/metabolism/rules/turn_energy_burn.rule.json`

**Triggers:** On `core:turn_started` event for each entity
**Condition:** Entity has both metabolic_store and fuel_converter
**Action:** Execute BURN_ENERGY with activity_multiplier 1.0 (resting rate)

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "turn_energy_burn",
  "event_type": "core:turn_started",
  "condition": {
    "and": [
      { "has_component": ["{event.payload.entityId}", "metabolism:metabolic_store"] },
      { "has_component": ["{event.payload.entityId}", "metabolism:fuel_converter"] }
    ]
  },
  "actions": [
    {
      "type": "BURN_ENERGY",
      "parameters": {
        "entity_ref": "{event.payload.entityId}",
        "activity_multiplier": 1.0,
        "turns": 1
      }
    }
  ]
}
```

### Rule 2: Turn Digestion

**File:** `data/mods/metabolism/rules/turn_digestion.rule.json`

**Triggers:** On `core:turn_started` event for each entity
**Condition:** Entity has metabolism components AND buffer_storage > 0
**Action:** Execute DIGEST_FOOD

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "turn_digestion",
  "event_type": "core:turn_started",
  "condition": {
    "and": [
      { "has_component": ["{event.payload.entityId}", "metabolism:fuel_converter"] },
      { "has_component": ["{event.payload.entityId}", "metabolism:metabolic_store"] },
      { ">": ["{component.metabolism:fuel_converter.buffer_storage}", 0] }
    ]
  },
  "actions": [
    {
      "type": "DIGEST_FOOD",
      "parameters": {
        "entity_ref": "{event.payload.entityId}",
        "turns": 1
      }
    }
  ]
}
```

### Rule 3: Turn Hunger Update (Placeholder)

**File:** `data/mods/metabolism/rules/turn_hunger_update.rule.json`

**Note:** This rule will call UPDATE_HUNGER_STATE and UPDATE_BODY_COMPOSITION operations which will be implemented in HUNMETSYS-014 and HUNMETSYS-015. Create as placeholder with TODO comment.

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "turn_hunger_update",
  "event_type": "core:turn_started",
  "condition": {
    "has_component": ["{event.payload.entityId}", "metabolism:metabolic_store"]
  },
  "actions": [
    {
      "type": "UPDATE_HUNGER_STATE",
      "parameters": {
        "entity_ref": "{event.payload.entityId}"
      }
    }
  ]
}
```

### Processing Order

Rules execute in this order per turn (specified by rule_id alphabetically or via priority):
1. **turn_energy_burn** - Reduces current_energy
2. **turn_digestion** - Converts buffer_storage to current_energy
3. **turn_hunger_update** - Recalculates state based on final energy

This order ensures energy burn happens before digestion replenishment.

## Acceptance Criteria

### Rule Files
- [ ] All 3 rule files created with valid JSON
- [ ] Rules validate against rule.schema.json
- [ ] Event types correctly reference core:turn_started
- [ ] Conditions use correct component checks
- [ ] Parameters use correct entity reference syntax

### Rule Logic
- [ ] Energy burn rule triggers for all entities with metabolism
- [ ] Digestion rule only triggers when buffer_storage > 0
- [ ] Hunger update rule triggers for all entities with metabolic_store
- [ ] Rules use correct operation types (BURN_ENERGY, DIGEST_FOOD)
- [ ] Entity references correctly passed to operations

### Mod Manifest
- [ ] All 3 rules added to content.rules array in mod-manifest.json
- [ ] Manifest still validates after update

### Validation
```bash
npm run validate           # All rules validate
npm run scope:lint        # If using scope DSL expressions
```

## Invariants

### Must Remain True
- Energy burn must happen before digestion each turn
- Rules must not modify components directly (use operations)
- Each rule must be idempotent (safe to run multiple times)
- Rules must check for component existence before operation

### System Invariants
- Turn system continues functioning correctly
- Other turn-based rules continue executing
- Rule execution order is deterministic
- No circular dependencies between rules

## Testing Notes

**Manual Testing:**
1. Create entity with metabolism components
2. Advance one turn
3. Verify energy decreased by base_burn_rate
4. Verify buffer digested if had content
5. Verify hunger state updated (once HUNMETSYS-014 complete)

**Unit tests will be in HUNMETSYS-017** covering:
- Rules trigger on correct events
- Rules execute correct operations
- Processing order is maintained
- Multiple entities process correctly

## References

- Spec: Lines 840-936 (Turn System Integration)
- Spec: Lines 2696-2711 (Turn Processing Order)
- Related: HUNMETSYS-003 (BURN_ENERGY handler)
- Related: HUNMETSYS-004 (DIGEST_FOOD handler)
- Related: HUNMETSYS-014 (UPDATE_HUNGER_STATE - future)

## Definition of Done

- [ ] All 3 rule files created with valid structure
- [ ] Rules validate with `npm run validate`
- [ ] Mod manifest updated with rules
- [ ] Manual testing shows rules execute each turn
- [ ] Energy burns correctly each turn
- [ ] Digestion processes correctly when buffer has content
- [ ] Committed with message: "feat(metabolism): add turn-based processing rules"
