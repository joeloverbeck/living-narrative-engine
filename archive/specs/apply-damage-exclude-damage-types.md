# APPLY_DAMAGE Excluded Damage Types Specification

## Document Information

**Version:** 1.0.0
**Status:** Design Specification
**Last Updated:** 2025-12-03
**Author:** System Architect
**Dependencies:** `weapons` mod, `damage-types` mod, `anatomy` mod (v1.0.0+)

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solution Overview](#solution-overview)
3. [Schema Changes](#schema-changes)
4. [Handler Modifications](#handler-modifications)
5. [Rule Usage Examples](#rule-usage-examples)
6. [Testing Strategy](#testing-strategy)
7. [Implementation Checklist](#implementation-checklist)

---

## Problem Statement

### Current Behavior

The `APPLY_DAMAGE` operation currently applies **all** damage entries from a weapon's `damage-types:damage_capabilities` component. When a rule iterates through `weaponDamage.entries` and calls `APPLY_DAMAGE` for each entry, every damage type is applied.

**Example Scenario - The Problem:**

Consider a weapon with multiple damage capabilities:
```json
{
  "damage-types:damage_capabilities": {
    "entries": [
      { "name": "slashing", "amount": 4, ... },
      { "name": "piercing", "amount": 3, ... },
      { "name": "fire", "amount": 2, ... },
      { "name": "corruption", "amount": 1, ... }
    ]
  }
}
```

The action `swing_at_target` represents a **swinging motion** which should realistically only apply **slashing** damage, not piercing damage. However, the current implementation applies all damage types because there's no way to filter them based on the physical action being performed.

### Real-World Examples

| Action | Physical Motion | Should Apply | Should NOT Apply |
|--------|----------------|--------------|------------------|
| `swing_at_target` | Swinging/cutting | slashing, fire, corruption | piercing |
| `thrust_at_target` | Thrusting/stabbing | piercing, fire, corruption | slashing |
| `bash_with_shield` | Blunt impact | bludgeoning | slashing, piercing |

### Current Code Analysis

**File:** `data/mods/weapons/rules/handle_swing_at_target.rule.json`

The rule currently iterates all damage entries without filtering:
```json
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

**File:** `src/logic/operationHandlers/applyDamageHandler.js`

The handler processes whatever `damage_entry` is passed without any exclusion logic (lines 259-280).

---

## Solution Overview

### Approach: Exclusion List in APPLY_DAMAGE

Add an optional `exclude_damage_types` parameter to the `APPLY_DAMAGE` operation that specifies which damage type names should be **skipped** when processing.

**Rationale for Exclusion (vs Inclusion):**

1. **Flexibility:** A weapon may have 10 damage types but only 1-2 should be excluded for a specific action
2. **Future-Proofing:** New damage types (magical, elemental) are automatically included unless explicitly excluded
3. **Simpler Rules:** Mod authors don't need to enumerate every allowed type

### Data Flow

```
Rule: swing_at_target
    ↓
FOR_EACH damage_entry
    ↓
APPLY_DAMAGE(damage_entry, exclude_damage_types: ["piercing"])
    ↓
Handler checks: damage_entry.name in exclude_damage_types?
    ↓ YES → Skip, log debug message
    ↓ NO → Apply damage normally
```

---

## Schema Changes

### File: `data/schemas/operations/applyDamage.schema.json`

Add new optional parameter:

```json
{
  "$defs": {
    "Parameters": {
      "type": "object",
      "properties": {
        "entity_ref": { ... },
        "part_ref": { ... },
        "damage_entry": { ... },
        "damage_multiplier": { ... },
        "exclude_damage_types": {
          "description": "Array of damage type names (e.g., 'piercing', 'slashing') to skip. If the damage_entry's name matches any value in this array, the damage is not applied.",
          "oneOf": [
            {
              "type": "array",
              "items": { "type": "string" },
              "uniqueItems": true
            },
            { "type": "object" }
          ]
        },
        "amount": { ... },
        "damage_type": { ... }
      },
      "required": ["entity_ref"],
      "additionalProperties": false
    }
  }
}
```

### Schema Validation Rules

- `exclude_damage_types` is **optional**
- When provided as an array, must contain **unique string values**
- Can be a JSON Logic expression (resolves to array at runtime)
- An empty array `[]` means no exclusions (apply all)

---

## Handler Modifications

### File: `src/logic/operationHandlers/applyDamageHandler.js`

#### Location: After damage_entry resolution (after line 280)

Add exclusion check:

```javascript
// 3b. Check exclusion list
const excludeTypes = params.exclude_damage_types;
if (excludeTypes) {
  let resolvedExcludeTypes = excludeTypes;

  // Resolve JSON Logic if needed
  if (typeof excludeTypes === 'object' && !Array.isArray(excludeTypes)) {
    try {
      resolvedExcludeTypes = this.#jsonLogicService.evaluate(excludeTypes, executionContext);
    } catch (err) {
      log.warn('APPLY_DAMAGE: Failed to evaluate exclude_damage_types', { error: err.message });
      resolvedExcludeTypes = [];
    }
  }

  // Validate and check
  if (Array.isArray(resolvedExcludeTypes) && resolvedExcludeTypes.length > 0) {
    const damageTypeName = resolvedDamageEntry.name;
    if (resolvedExcludeTypes.includes(damageTypeName)) {
      log.debug(`APPLY_DAMAGE: Skipping excluded damage type '${damageTypeName}'`, {
        excluded: resolvedExcludeTypes
      });
      return; // Early return - do not apply this damage
    }
  }
}
```

#### Insertion Point

Insert between:
- Line 280: `if (!resolvedDamageEntry.name) { ... }`
- Line 281 (current 302): `// 3a. Resolve optional damage multiplier`

The new code block should be inserted as step `3b` before the multiplier resolution.

---

## Rule Usage Examples

### Example 1: swing_at_target (Exclude Piercing)

**File:** `data/mods/weapons/rules/handle_swing_at_target.rule.json`

```json
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
          "damage_entry": { "var": "context.dmgEntry" },
          "exclude_damage_types": ["piercing"]
        }
      }
    ]
  }
}
```

### Example 2: thrust_at_target (Exclude Slashing)

**File (future):** `data/mods/weapons/rules/handle_thrust_at_target.rule.json`

```json
{
  "type": "APPLY_DAMAGE",
  "parameters": {
    "entity_ref": "secondary",
    "damage_entry": { "var": "context.dmgEntry" },
    "exclude_damage_types": ["slashing"]
  }
}
```

### Example 3: Dynamic Exclusion via JSON Logic

For complex scenarios where exclusions depend on context:

```json
{
  "type": "APPLY_DAMAGE",
  "parameters": {
    "entity_ref": "secondary",
    "damage_entry": { "var": "context.dmgEntry" },
    "exclude_damage_types": {
      "if": [
        { "var": "context.isSwingAction" },
        ["piercing", "bludgeoning"],
        ["slashing"]
      ]
    }
  }
}
```

---

## Testing Strategy

### Unit Tests

**File:** `tests/unit/logic/operationHandlers/applyDamageHandler.test.js`

#### Test Group: "exclude_damage_types parameter"

1. **should skip damage when type is in exclusion list**
   - Setup: Create damage_entry with `name: "piercing"`
   - Execute: APPLY_DAMAGE with `exclude_damage_types: ["piercing"]`
   - Assert: No damage applied, no health changed, debug log emitted

2. **should apply damage when type is NOT in exclusion list**
   - Setup: Create damage_entry with `name: "slashing"`
   - Execute: APPLY_DAMAGE with `exclude_damage_types: ["piercing"]`
   - Assert: Damage applied normally, health reduced

3. **should apply damage when exclusion list is empty**
   - Setup: Create damage_entry with `name: "slashing"`
   - Execute: APPLY_DAMAGE with `exclude_damage_types: []`
   - Assert: Damage applied normally

4. **should apply damage when exclusion list is undefined**
   - Setup: Create damage_entry with `name: "slashing"`
   - Execute: APPLY_DAMAGE without `exclude_damage_types` parameter
   - Assert: Damage applied normally (backward compatibility)

5. **should handle multiple exclusions correctly**
   - Setup: Weapon with entries: `["slashing", "piercing", "fire"]`
   - Execute: APPLY_DAMAGE with `exclude_damage_types: ["piercing", "fire"]`
   - Assert: Only slashing damage applied

6. **should resolve JSON Logic expression for exclusions**
   - Setup: Context with `isSwingAction: true`
   - Execute: APPLY_DAMAGE with `exclude_damage_types: {"if": [{"var": "isSwingAction"}, ["piercing"], []]}`
   - Assert: Piercing damage skipped when condition is true

7. **should handle JSON Logic evaluation failure gracefully**
   - Setup: Malformed JSON Logic expression
   - Execute: APPLY_DAMAGE with invalid `exclude_damage_types` expression
   - Assert: Warning logged, damage applied (fail-open for safety)

8. **should be case-sensitive for damage type names**
   - Setup: Create damage_entry with `name: "Piercing"` (capital P)
   - Execute: APPLY_DAMAGE with `exclude_damage_types: ["piercing"]` (lowercase)
   - Assert: Damage applied (no match due to case difference)

9. **should skip all matching damage types in FOR_EACH iteration**
   - Setup: Weapon with 4 damage entries, 2 excluded
   - Execute: FOR_EACH calling APPLY_DAMAGE with exclusions
   - Assert: Only 2 damage applications occurred

10. **should not affect damage_multiplier when exclusion applies**
    - Setup: damage_entry with `name: "piercing"`, `damage_multiplier: 1.5`
    - Execute: APPLY_DAMAGE with `exclude_damage_types: ["piercing"]`
    - Assert: No damage applied, multiplier calculation never reached

### Integration Tests

**File:** `tests/integration/mods/weapons/applyDamageExclusionIntegration.test.js`

#### Test Group: "swing_at_target with exclusions"

1. **should only apply slashing damage from multi-capability weapon**
   - Setup: Create weapon with `["slashing", "piercing", "fire"]` capabilities
   - Execute: Full `swing_at_target` action with exclusion
   - Assert: Target receives slashing and fire damage, NOT piercing

2. **should apply all capabilities when no exclusion specified**
   - Setup: Same weapon, rule without exclusion
   - Execute: Full action
   - Assert: All 3 damage types applied

3. **should respect exclusion across critical success multiplier**
   - Setup: Force CRITICAL_SUCCESS outcome (1.5x multiplier)
   - Execute: Action with piercing exclusion
   - Assert: Slashing damage is 1.5x, no piercing damage at all

4. **should properly dispatch events only for applied damage types**
   - Setup: Mock event dispatcher, weapon with multiple types
   - Execute: Action with exclusions
   - Assert: `anatomy:damage_applied` events only for non-excluded types

### E2E Tests (Optional but Recommended)

**File:** `tests/e2e/weapons/damageTypeExclusionE2E.test.js`

1. **Complete combat scenario with swing and thrust actions**
   - Setup: Actor with sword (slashing + piercing), target with anatomy
   - Execute: Swing action → verify only slashing applied
   - Execute: Thrust action → verify only piercing applied
   - Assert: Health changes match expected damage types

### Schema Validation Tests

**File:** `tests/unit/validation/applyDamageSchemaValidation.test.js`

1. **should validate exclude_damage_types as string array**
2. **should reject exclude_damage_types with non-string items**
3. **should validate exclude_damage_types as JSON Logic object**
4. **should allow missing exclude_damage_types (optional)**

---

## Implementation Checklist

### Phase 1: Schema Update

- [ ] Update `data/schemas/operations/applyDamage.schema.json`
  - Add `exclude_damage_types` property definition
  - Support both array and JSON Logic object types

- [ ] Run `npm run validate` to ensure schema is valid

### Phase 2: Handler Implementation

- [ ] Modify `src/logic/operationHandlers/applyDamageHandler.js`
  - Add exclusion logic after damage_entry resolution
  - Handle both direct array and JSON Logic expression
  - Add debug logging for skipped damage types
  - Ensure early return path is clean

- [ ] Run `npm run typecheck` to verify types

### Phase 3: Unit Tests

- [ ] Add test cases to `tests/unit/logic/operationHandlers/applyDamageHandler.test.js`
  - All 10 unit test cases as specified above
  - Maintain 80%+ branch coverage

- [ ] Run `npm run test:unit -- tests/unit/logic/operationHandlers/applyDamageHandler.test.js`

### Phase 4: Integration Tests

- [ ] Create `tests/integration/mods/weapons/applyDamageExclusionIntegration.test.js`
  - All 4 integration test cases as specified above

- [ ] Run `npm run test:integration -- tests/integration/mods/weapons/`

### Phase 5: Update Existing Rules (Optional - Phase 2)

- [ ] Update `data/mods/weapons/rules/handle_swing_at_target.rule.json`
  - Add `exclude_damage_types: ["piercing"]` to APPLY_DAMAGE calls

- [ ] Create future actions (thrust_at_target, etc.) with appropriate exclusions

### Phase 6: Documentation

- [ ] Update inline JSDoc in applyDamageHandler.js
- [ ] Add usage example to existing damage-application-mechanics.md spec

---

## Key Files Reference

| File | Purpose | Change Type |
|------|---------|-------------|
| `data/schemas/operations/applyDamage.schema.json` | Operation schema | Add property |
| `src/logic/operationHandlers/applyDamageHandler.js` | Handler implementation | Add exclusion logic |
| `data/mods/weapons/rules/handle_swing_at_target.rule.json` | Swing action rule | Add exclusion param |
| `tests/unit/logic/operationHandlers/applyDamageHandler.test.js` | Unit tests | Add test cases |
| `tests/integration/mods/weapons/applyDamageExclusionIntegration.test.js` | Integration tests | New file |

---

## Backward Compatibility

- **No breaking changes:** `exclude_damage_types` is optional
- Existing rules without this parameter continue to work identically
- Existing weapons with single damage type are unaffected
- All current tests should pass without modification

---

## Future Considerations

1. **Include List Alternative:** Could add `include_damage_types` for allow-list scenarios
2. **Damage Type Categories:** Could define categories (physical, elemental, magical) for bulk filtering
3. **Action-Level Defaults:** Could define default exclusions at action definition level rather than rule level
