# WEADAMCAPREF-005: Update ApplyDamageHandler for damage_entry

## Summary

Update `ApplyDamageHandler` to accept a `damage_entry` parameter containing the full damage entry object from a weapon's `damage_capabilities` component. Maintain backward compatibility with legacy `damage_type` + `amount` parameters while emitting deprecation warnings.

## Dependencies

- WEADAMCAPREF-001 (schema for damage entry structure)
- WEADAMCAPREF-004 (DamageTypeEffectsService accepts damageEntry)

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `src/logic/operationHandlers/applyDamageHandler.js` | UPDATE | Accept damage_entry parameter |
| `data/schemas/operations/applyDamage.schema.json` | UPDATE | Add damage_entry to schema |
| `tests/unit/logic/operationHandlers/applyDamageHandler.test.js` | UPDATE | Test new and legacy modes |

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
        { "$ref": "schema://living-narrative-engine/damage-capability-entry.schema.json" },
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
