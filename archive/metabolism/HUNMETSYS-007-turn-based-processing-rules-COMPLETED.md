# HUNMETSYS-007: Turn-Based Processing Rules

**Status:** ✅ Completed
**Priority:** High
**Estimated Effort:** 5 hours
**Actual Effort:** 3 hours
**Phase:** 2 - Mod Structure
**Dependencies:** HUNMETSYS-003, 004 (BURN_ENERGY, DIGEST_FOOD handlers)
**Completed:** 2025-11-21

## Objective

Create turn-based rules that automatically process energy burn and digestion for all entities with metabolism components each turn.

## Files to Touch

### New Files (3)
- `data/mods/metabolism/rules/turn_1_energy_burn.rule.json`
- `data/mods/metabolism/rules/turn_2_digestion.rule.json`
- `data/mods/metabolism/rules/turn_3_hunger_update.rule.json` (placeholder for HUNMETSYS-014)

### Modified Files (1)
- `data/mods/metabolism/mod-manifest.json` (add rules to content.rules array)

## Out of Scope

- ❌ Hunger state update logic (HUNMETSYS-014 - UPDATE_HUNGER_STATE handler)
- ❌ Body composition update logic (HUNMETSYS-015 - UPDATE_BODY_COMPOSITION handler)
- ❌ Integration tests (HUNMETSYS-017)
- ❌ Turn system implementation (assumed to exist in core mod)

## Implementation Details

### Rule 1: Turn Energy Burn

**File:** `data/mods/metabolism/rules/turn_1_energy_burn.rule.json`

**Triggers:** On `core:turn_started` event for each entity
**Condition:** Entity has both metabolic_store and fuel_converter (using QUERY_COMPONENTS to check existence)
**Action:** Execute BURN_ENERGY with activity_multiplier 1.0 (resting rate)

**Note:** Rule naming uses numeric prefix to ensure correct alphabetical execution order (burn → digest → update).

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "turn_1_energy_burn",
  "comment": "Burns energy each turn for entities with metabolism components",
  "event_type": "core:turn_started",
  "actions": [
    {
      "type": "QUERY_COMPONENTS",
      "comment": "Check if entity has required metabolism components",
      "parameters": {
        "entity_ref": "{event.payload.entityId}",
        "pairs": [
          {
            "component_type": "metabolism:metabolic_store",
            "result_variable": "metabolicStore"
          },
          {
            "component_type": "metabolism:fuel_converter",
            "result_variable": "fuelConverter"
          }
        ]
      }
    },
    {
      "type": "IF",
      "comment": "Only burn energy if entity has both components",
      "parameters": {
        "condition": {
          "and": [
            { "var": "context.metabolicStore" },
            { "var": "context.fuelConverter" }
          ]
        },
        "then_actions": [
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
    }
  ]
}
```

### Rule 2: Turn Digestion

**File:** `data/mods/metabolism/rules/turn_2_digestion.rule.json`

**Triggers:** On `core:turn_started` event for each entity
**Condition:** Entity has metabolism components AND buffer_storage > 0
**Action:** Execute DIGEST_FOOD

**Note:** Must query component first to access buffer_storage field value. The `{component.X}` syntax does not exist in the codebase.

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "turn_2_digestion",
  "comment": "Digests food from buffer storage each turn for entities with metabolism components",
  "event_type": "core:turn_started",
  "actions": [
    {
      "type": "QUERY_COMPONENTS",
      "comment": "Get metabolism components to check existence and buffer_storage value",
      "parameters": {
        "entity_ref": "{event.payload.entityId}",
        "pairs": [
          {
            "component_type": "metabolism:metabolic_store",
            "result_variable": "metabolicStore"
          },
          {
            "component_type": "metabolism:fuel_converter",
            "result_variable": "fuelConverter"
          }
        ]
      }
    },
    {
      "type": "IF",
      "comment": "Only digest if entity has components AND buffer has content",
      "parameters": {
        "condition": {
          "and": [
            { "var": "context.metabolicStore" },
            { "var": "context.fuelConverter" },
            { ">": [{ "var": "context.fuelConverter.buffer_storage" }, 0] }
          ]
        },
        "then_actions": [
          {
            "type": "DIGEST_FOOD",
            "parameters": {
              "entity_ref": "{event.payload.entityId}",
              "turns": 1
            }
          }
        ]
      }
    }
  ]
}
```

### Rule 3: Turn Hunger Update (Placeholder)

**File:** `data/mods/metabolism/rules/turn_3_hunger_update.rule.json`

**Note:** This rule will call UPDATE_HUNGER_STATE operation which will be implemented in HUNMETSYS-014. Creating as placeholder with comment but no operations to avoid validation failure.

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "turn_3_hunger_update",
  "comment": "Placeholder for HUNMETSYS-014 - will update hunger state based on current_energy thresholds",
  "event_type": "core:turn_started",
  "actions": []
}
```

### Processing Order

Rules execute in this order per turn (specified by rule_id alphabetically):
1. **turn_1_energy_burn** - Reduces current_energy
2. **turn_2_digestion** - Converts buffer_storage to current_energy
3. **turn_3_hunger_update** - Recalculates state based on final energy (placeholder)

**Important:** Rule names use numeric prefixes (turn_1_, turn_2_, turn_3_) to ensure correct alphabetical execution order. Without these prefixes, "turn_digestion" would execute before "turn_energy_burn" alphabetically, violating the requirement that energy burn must happen first.

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

- [x] All 3 rule files created with valid structure
- [x] Rules validate with `npm run validate` (0 violations for metabolism mod)
- [x] Mod manifest updated with rules
- [ ] Manual testing shows rules execute each turn (deferred to HUNMETSYS-017)
- [ ] Energy burns correctly each turn (deferred to HUNMETSYS-017)
- [ ] Digestion processes correctly when buffer has content (deferred to HUNMETSYS-017)
- [ ] Committed with message: "feat(metabolism): add turn-based processing rules"

## Outcome

### What Was Changed vs Originally Planned

**Syntax Corrections Made:**
1. **Component reference syntax**: Original ticket used invalid `{component.X}` syntax that doesn't exist in codebase
   - **Fixed**: Use `QUERY_COMPONENTS` to retrieve components, then access via `{context.variableName.field}` or JSON Logic `{"var": "context.variableName.field"}`

2. **Rule execution order**: Original naming (turn_energy_burn, turn_digestion, turn_hunger_update) would execute in wrong alphabetical order
   - **Fixed**: Added numeric prefixes (turn_1_, turn_2_, turn_3_) to ensure burn → digest → update order

3. **Placeholder rule**: Original included non-existent UPDATE_HUNGER_STATE operation that would fail validation
   - **Fixed**: Created placeholder with empty actions array and comment explaining it's for HUNMETSYS-014

**Files Created:**
- ✅ `data/mods/metabolism/rules/turn_1_energy_burn.rule.json`
- ✅ `data/mods/metabolism/rules/turn_2_digestion.rule.json`
- ✅ `data/mods/metabolism/rules/turn_3_hunger_update.rule.json`

**Files Modified:**
- ✅ `data/mods/metabolism/mod-manifest.json` (added 3 rules to content.rules array)

**Validation Results:**
- ✅ All rules validate against schema
- ✅ Metabolism mod has 0 cross-reference violations
- ✅ No syntax errors, all JSON valid

**Key Implementation Details:**
- Rules use `QUERY_COMPONENTS` + `IF` pattern instead of inline `has_component` conditions
- Numeric prefixes ensure deterministic execution order (alphabetically)
- Empty placeholder avoids validation failure while reserving slot for HUNMETSYS-014
- All rules properly reference `{event.payload.entityId}` from core:turn_started event
- Comments explain purpose and future TODO items
