# WEADAMCAPREF-005: Update ApplyDamageHandler for damage_entry

## Summary

Update `ApplyDamageHandler` to accept a `damage_entry` parameter containing the full damage entry object from a weapon's `damage_capabilities` component. Maintain backward compatibility with legacy `damage_type` + `amount` parameters while emitting deprecation warnings.

## Dependencies

- WEADAMCAPREF-001 (schema for damage entry structure)
- WEADAMCAPREF-004 (DamageTypeEffectsService accepts damageEntry)

## Assumption Corrections (Discovered During Implementation)

**Critical Bug Found**: The current `ApplyDamageHandler` passes incompatible parameters to `DamageTypeEffectsService`.

| Assumption                                        | Actual State                                     |
| ------------------------------------------------- | ------------------------------------------------ |
| Handler passes `amount` + `damageType` to service | ❌ Service signature changed in WEADAMCAPREF-004 |
| Service expects `amount` and `damageType`         | ❌ Service now expects `damageEntry` object      |
| This is only a feature addition                   | ❌ **Also a critical bug fix**                   |

**Current broken call** (line ~348):

```javascript
await this.#damageTypeEffectsService.applyEffectsForDamage({
  entityId,
  partId,
  amount: damageAmount,
  damageType,
  maxHealth,
  currentHealth,
});
```

**Service now expects**:

```javascript
await this.#damageTypeEffectsService.applyEffectsForDamage({
  entityId,
  partId,
  damageEntry: { name, amount, ...effects },
  maxHealth,
  currentHealth,
});
```

**Impact**: All damage type effects (bleed, burn, fracture, dismember, poison) are non-functional until this ticket is completed.

## Files to Touch

| File                                                            | Action | Description                   |
| --------------------------------------------------------------- | ------ | ----------------------------- |
| `src/logic/operationHandlers/applyDamageHandler.js`             | UPDATE | Accept damage_entry parameter |
| `data/schemas/operations/applyDamage.schema.json`               | UPDATE | Add damage_entry to schema    |
| `tests/unit/logic/operationHandlers/applyDamageHandler.test.js` | UPDATE | Test new and legacy modes     |

## Out of Scope

- Rule modifications (WEADAMCAPREF-008)
- Action/scope updates (WEADAMCAPREF-006, WEADAMCAPREF-007)
- DamageTypeEffectsService changes (done in WEADAMCAPREF-004)
- Removing legacy parameter support (permanent backward compatibility)

## Implementation Details

### Handler Logic

```javascript
async execute(context) {
  const { entity_ref, part_ref, damage_entry, amount, damage_type } = this.#resolveParameters(context);

  // Resolve entity and part
  const entityId = this.#resolveEntityRef(entity_ref, context);
  const partId = part_ref ? this.#resolvePartRef(part_ref, context) : await this.#resolveHitLocation(entityId);

  // Determine damage entry
  let resolvedDamageEntry;
  if (damage_entry) {
    resolvedDamageEntry = damage_entry;
  } else if (damage_type && amount !== undefined) {
    // Legacy mode - construct minimal entry
    this.#logger.warn('DEPRECATED: Using damage_type string. Migrate to damage_entry object.');
    resolvedDamageEntry = { name: damage_type, amount };
  } else {
    throw new Error('Either damage_entry or (damage_type + amount) required');
  }

  // Get health info
  const partHealth = this.#entityManager.getComponent(partId, 'anatomy:part_health');
  const { currentHealth, maxHealth } = partHealth;

  // Apply damage
  const newHealth = Math.max(0, currentHealth - resolvedDamageEntry.amount);
  // ... update health component

  // Apply effects
  await this.#damageTypeEffectsService.applyEffectsForDamage({
    entityId,
    partId,
    damageEntry: resolvedDamageEntry,
    maxHealth,
    currentHealth
  });
}
```

### Schema Update

Add to `data/schemas/operations/applyDamage.schema.json`:

```json
{
  "properties": {
    "damage_entry": {
      "description": "Full damage entry object from weapon's damage_capabilities component",
      "oneOf": [
        {
          "$ref": "schema://living-narrative-engine/damage-capability-entry.schema.json"
        },
        { "$ref": "#/$defs/JSONLogic" }
      ]
    },
    "damage_type": {
      "description": "DEPRECATED: Use damage_entry instead. String reference to damage type.",
      "type": "string"
    },
    "amount": {
      "description": "DEPRECATED when using damage_entry. Damage amount (use damage_entry.amount).",
      "type": ["number", "object"]
    }
  }
}
```

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- tests/unit/logic/operationHandlers/applyDamageHandler.test.js`

Test cases:

- Handler accepts `damage_entry` parameter and applies damage correctly
- Handler extracts amount from `damage_entry.amount`
- Handler calls DamageTypeEffectsService with damageEntry object
- Legacy `damage_type` + `amount` still works
- Legacy mode emits deprecation warning to logger
- Missing both `damage_entry` and `damage_type`/`amount` throws error
- Handler resolves JSON Logic expressions in `damage_entry` parameter

2. `npm run validate` - Schema validation passes

3. `npm run typecheck` - No type errors

### Invariants That Must Remain True

1. Health reduction calculation remains identical (`currentHealth - amount`)
2. Part resolution logic unchanged (hit location resolution works)
3. Events dispatched by handler remain unchanged
4. Legacy callers using `damage_type` + `amount` continue to work
5. Schema validation allows both new and legacy parameter combinations
6. No breaking changes to existing APPLY_DAMAGE operations in rules

## Estimated Size

- 1 handler file (~30-50 lines changed)
- 1 schema file (~20 lines added)
- 1 test file (~80-120 lines changed/added)

---

## Outcome (Completed)

### Status: ✅ COMPLETED

### What Was Actually Changed vs Originally Planned

**Originally Planned:**

- Add `damage_entry` parameter support to ApplyDamageHandler
- Update schema to include `damage_entry`
- Add tests for new functionality

**Actually Changed (exceeded scope due to critical bug fix):**

1. **`data/schemas/operations/applyDamage.schema.json`**
   - Added `damage_entry` property with reference to `damage-capability-entry.schema.json`
   - Updated `damage_type` and `amount` descriptions with DEPRECATED notes
   - Changed `required` from `["entity_ref", "amount", "damage_type"]` to `["entity_ref"]`

2. **`src/logic/operationHandlers/applyDamageHandler.js`**
   - Added `damage_entry` parameter extraction
   - Added resolution logic for `damage_entry` (supports direct object or JSON Logic)
   - Added validation for required `name` and `amount` fields
   - Legacy mode now constructs `resolvedDamageEntry` from `damage_type` + `amount` with deprecation warning
   - **Fixed critical bug**: Service call now passes `damageEntry: resolvedDamageEntry` instead of `amount`/`damageType`
   - Updated propagation to use `damage_entry` structure internally

3. **`src/configuration/staticConfiguration.js`** (additional change needed)
   - Added `damage-capability-entry.schema.json` to schema files list for proper schema loading

4. **`tests/unit/logic/operationHandlers/applyDamageHandler.test.js`**
   - Added new `describe` block: `damage_entry parameter (WEADAMCAPREF-005)`
   - 11 new test cases covering all acceptance criteria

### Test Results

| Test                                                           | Result |
| -------------------------------------------------------------- | ------ |
| Handler accepts `damage_entry` and applies damage correctly    | ✅     |
| Handler calls DamageTypeEffectsService with damageEntry object | ✅     |
| Legacy `damage_type` + `amount` backward compatibility         | ✅     |
| Deprecation warning for legacy mode                            | ✅     |
| Error when missing both parameter modes                        | ✅     |
| JSON Logic resolution in `damage_entry`                        | ✅     |
| Validation for missing `amount` field                          | ✅     |
| Validation for missing `name` field                            | ✅     |
| Full effect configuration handling                             | ✅     |
| Damage propagation with new structure                          | ✅     |
| Schema validation passes                                       | ✅     |

### Critical Bug Fixed

This ticket also fixed a **critical integration bug** where all damage type effects (bleed, burn, fracture, dismember, poison) were non-functional due to incompatible parameters being passed to `DamageTypeEffectsService` after WEADAMCAPREF-004 was completed.

### All Invariants Preserved

- Health reduction calculation remains identical
- Part resolution logic unchanged
- Events dispatched remain unchanged
- Legacy callers continue to work
- No breaking changes to existing rules
