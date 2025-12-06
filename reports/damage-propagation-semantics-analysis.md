# Damage Propagation Semantics Analysis

## Executive Summary

The damage propagation system has a **critical semantic mismatch** between the code expectations and the entity data format:

- **Code expects**: `propagationRules` as an **object keyed by `childPartId`** with flat rules containing `probability`, `damage_fraction`, `damage_types[]`
- **Schema & Data use**: **Array of rule objects** with `childSocketId`, `baseProbability`, `damageFraction`, `damageTypeModifiers{}`

This analysis provides a detailed breakdown and proposes a "best of both worlds" solution.

---

## 1. Code Expectations (Current Implementation)

### DamagePropagationService - What It Actually Expects

**Location**: `src/anatomy/services/damagePropagationService.js:74-95`

```javascript
propagateDamage(
  parentPartId,
  damageAmount,
  damageTypeId,
  ownerEntityId,
  propagationRules  // <-- expects OBJECT (keyed by childPartId)
) {
  if (!propagationRules || typeof propagationRules !== 'object') {
    return [];
  }

  const entries = Object.entries(propagationRules);  // <-- iterates as object.entries

  for (const [childPartId, rule] of entries) {  // <-- destructures key as childPartId
    // Process each rule
  }
}
```

**Expected rule structure per child:**

```javascript
{
  childPartId: {
    probability: 0.3,           // Direct probability value
    damage_fraction: 0.5,       // Direct fraction value
    damage_types: ['piercing', 'slashing']  // Simple array of type names
  }
}
```

**How it uses fields**:

- `probability` (property name) → used directly in `#passesProbabilityCheck()`
- `damage_fraction` (property name) → used directly in `#calculatePropagatedAmount()`
- `damage_types` (array) → checked with `Array.includes(damageTypeId)` in `#passesDamageTypeFilter()`
- **Never uses**: `damageTypeModifiers`, `baseProbability`, `childSocketId`

---

## 2. Schema & Entity Data Format (Current)

### Component Schema

**Location**: `data/mods/anatomy/components/damage_propagation.component.json`

```json
{
  "dataSchema": {
    "properties": {
      "rules": {
        "type": "array",
        "items": {
          "properties": {
            "childSocketId": { "type": "string" },
            "baseProbability": { "type": "number", "minimum": 0, "maximum": 1 },
            "damageFraction": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "default": 0.5
            },
            "damageTypeModifiers": {
              "type": "object",
              "additionalProperties": { "type": "number", "minimum": 0 }
            }
          },
          "required": ["childSocketId", "baseProbability"]
        }
      }
    },
    "required": ["rules"]
  }
}
```

### Real Entity Data Example

**Location**: `data/mods/anatomy/entities/definitions/human_male_torso_thick_hairy_overweight.entity.json`

```json
{
  "anatomy:damage_propagation": {
    "rules": [
      {
        "childSocketId": "heart_socket",
        "baseProbability": 0.3,
        "damageFraction": 0.5,
        "damageTypeModifiers": {
          "piercing": 1.5,
          "blunt": 0.3,
          "slashing": 0.8
        }
      },
      {
        "childSocketId": "spine_socket",
        "baseProbability": 0.2,
        "damageFraction": 0.5,
        "damageTypeModifiers": {
          "piercing": 1.2,
          "blunt": 0.5,
          "slashing": 0.6
        }
      }
    ]
  }
}
```

---

## 3. The Semantic Mismatch

### Format Mismatch

| Aspect          | Code Expects               | Schema Defines               | Data Uses                    |
| --------------- | -------------------------- | ---------------------------- | ---------------------------- |
| Structure       | Object (keyed)             | Array of objects             | Array of objects             |
| Child ref       | Object key (implicit)      | `childSocketId` property     | `childSocketId` property     |
| Probability     | `probability` property     | `baseProbability` property   | `baseProbability` property   |
| Damage fraction | `damage_fraction` property | `damageFraction` property    | `damageFraction` property    |
| Type filtering  | `damage_types` array       | Not present                  | Not present                  |
| Type modifiers  | Not used                   | `damageTypeModifiers` object | `damageTypeModifiers` object |

### Impact on Current System

**Status**: 🔴 **BROKEN - Not actually working with real data**

When `ApplyDamageHandler` calls the service:

```javascript
const propagationResults = this.#damagePropagationService.propagateDamage(
  parentPartId,
  damageAmount,
  damageType,
  entityId,
  propagationRules // This comes from: partComponent?.damage_propagation
);
```

With real entity data (`{ rules: [...] }`):

- `Object.entries(propagationRules)` returns `[["rules", [...]]]` instead of individual rules
- The loop tries to process `rules` as a `childPartId`
- Never actually processes the array items
- **Result**: No damage propagation occurs

---

## 4. Current Test Coverage Analysis

### Unit Tests (DamagePropagationService)

**Location**: `tests/unit/anatomy/services/damagePropagationService.test.js`

The tests use the **code-expected format** (object keyed by childPartId):

```javascript
const rules = {
  'child-part-1': {
    probability: 1,
    damage_fraction: 0.5,
    damage_types: ['piercing'],
  },
};

const result = service.propagateDamage(
  'parent-part-1',
  10,
  'slashing',
  'entity-1',
  rules // <-- Object format, not array
);
```

**Tests pass** ✅ but only because they use the object format that the code expects.

### Integration Tests

**Location**: `tests/integration/anatomy/vitalOrganEntities.integration.test.js`

These tests verify the **schema format** (array with `baseProbability`, etc.):

```javascript
const rules = content.components['anatomy:damage_propagation'].rules;
for (const rule of rules) {
  expect(rule.baseProbability).toBeGreaterThan(0);
  expect(rule.damageTypeModifiers).toBeDefined();
}
```

**Tests pass** ✅ for schema validation, but **don't test actual damage propagation behavior**.

### Result

- ✅ Unit tests pass (but test wrong format)
- ✅ Schema validation passes (array format is correct)
- ❌ Integration tests don't verify propagation actually works
- ❌ Real gameplay broken (data format incompatible with code)

---

## 5. Semantic Design: Two Valid Approaches

### Approach A: Simple Type Filtering (Current Code Intention)

**Use case**: "This damage type can propagate to this child or not"

```json
{
  "damage_types": ["piercing", "slashing"], // Types that propagate
  "probability": 0.5,
  "damage_fraction": 0.3
}
```

**Logic**:

- If damage type in `damage_types` array → propagate with fixed probability
- Otherwise → no propagation

**Pros**: Simple, predictable, clear
**Cons**: No nuance for different damage types

### Approach B: Type-Based Probability Modifiers (Current Data Design)

**Use case**: "Each damage type has a different probability multiplier"

```json
{
  "baseProbability": 0.3,
  "damageTypeModifiers": {
    "piercing": 1.5, // 30% * 1.5 = 45%
    "blunt": 0.3, // 30% * 0.3 = 9%
    "slashing": 0.8 // 30% * 0.8 = 24%
  },
  "damageFraction": 0.5
}
```

**Logic**:

- Get base probability (0.3)
- Get modifier for damage type (or default 1.0 if not specified)
- Calculate effective probability = baseProbability \* modifier
- Roll against that probability

**Pros**: Nuanced, type-aware, matches real-world anatomy
**Cons**: More complex, requires modifier object

---

## 6. Recommended Solution: Support Both Semantics

### "Best of Both Worlds" Schema Design

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:damage_propagation",
  "description": "Configures internal damage propagation when this part is hit.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "rules": {
        "type": "array",
        "description": "Propagation rules for each child socket",
        "items": {
          "oneOf": [
            {
              "type": "object",
              "title": "Simple Type Filter Rule",
              "properties": {
                "childSocketId": { "type": "string" },
                "probability": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 1,
                  "description": "Base probability (0-1)"
                },
                "damage_fraction": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 1,
                  "default": 0.5,
                  "description": "Fraction of parent damage"
                },
                "damage_types": {
                  "type": "array",
                  "items": { "type": "string" },
                  "description": "Allowed damage types (optional; empty = all types allowed)"
                }
              },
              "required": ["childSocketId", "probability"],
              "additionalProperties": false
            },
            {
              "type": "object",
              "title": "Type-Based Modifier Rule",
              "properties": {
                "childSocketId": { "type": "string" },
                "baseProbability": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 1,
                  "description": "Base probability before modifiers"
                },
                "damageFraction": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 1,
                  "default": 0.5,
                  "description": "Fraction of parent damage"
                },
                "damageTypeModifiers": {
                  "type": "object",
                  "description": "Probability multipliers per damage type",
                  "additionalProperties": {
                    "type": "number",
                    "minimum": 0
                  }
                }
              },
              "required": ["childSocketId", "baseProbability"],
              "additionalProperties": false
            }
          ]
        }
      }
    },
    "required": ["rules"],
    "additionalProperties": false
  }
}
```

### Service Implementation Changes

**File**: `src/anatomy/services/damagePropagationService.js`

The key change is handling array format directly and supporting type modifiers:

```javascript
propagateDamage(parentPartId, damageAmount, damageTypeId, ownerEntityId, propagationRules) {
  // Handle array format (new/preferred)
  if (!Array.isArray(propagationRules?.rules)) {
    return [];
  }

  const results = [];
  for (const rule of propagationRules.rules) {
    const propagationResult = this.#evaluatePropagationRule({
      parentPartId,
      childSocketId: rule.childSocketId,
      rule,
      damageAmount,
      damageTypeId,
      ownerEntityId,
    });

    if (propagationResult) {
      results.push(propagationResult);
    }
  }
  return results;
}

#passesDamageTypeFilter(rule, damageTypeId) {
  // Semantic A: Simple type filtering
  if (Array.isArray(rule.damage_types) && rule.damage_types.length > 0) {
    return rule.damage_types.includes(damageTypeId);
  }

  // Semantic B: Type-based modifiers (allows any type if no modifier, uses default 1.0)
  if (rule.damageTypeModifiers && typeof rule.damageTypeModifiers === 'object') {
    return true;
  }

  // No filter specified = allow all types
  return true;
}

#passesProbabilityCheck(rule, damageTypeId) {
  // Get base probability
  const probabilityRaw =
    typeof rule.baseProbability === 'number' ? rule.baseProbability :
    typeof rule.probability === 'number' ? rule.probability :
    1;

  const baseProbability = Math.min(1, Math.max(0, probabilityRaw));

  // Apply type-based modifier if present
  let effectiveProbability = baseProbability;
  if (rule.damageTypeModifiers && typeof rule.damageTypeModifiers === 'object') {
    const modifier = rule.damageTypeModifiers[damageTypeId] ?? 1.0;
    effectiveProbability = baseProbability * modifier;
  }

  return Math.random() <= effectiveProbability;
}
```

**Key Design Decisions**:

1. **Array format**: Data structure is array (matches schema and real data)
2. **Flexible probability**: Accepts `probability` OR `baseProbability`
3. **Flexible damage calculation**: Accepts `damage_fraction` OR `damageFraction`
4. **Type-aware filtering**: Supports both simple filtering (array) and modifier-based (object)
5. **Default modifier**: If type not in `damageTypeModifiers`, use 1.0 (no modification)

---

## 7. Migration Path

### Phase 1: Support Both Formats (Non-breaking)

- Update service to handle array format properly
- Support type modifiers in probability calculation
- Update unit tests to test both formats
- Update integration tests to verify real behavior

### Phase 2: Verify All Tests Pass

- Unit tests for both semantic approaches
- Integration tests with real entity data
- Performance tests (no regressions)

### Phase 3: Deprecate Legacy Support (Future)

- After all new code uses array format
- Remove legacy object format handling
- Simplify code to array-only

---

## 8. Testing Strategy

### Unit Tests Updates

```javascript
describe('DamagePropagationService - Format Support', () => {
  describe('Array format (new/preferred)', () => {
    it('should process array of rules with childSocketId', () => {
      const propagationRules = {
        rules: [
          {
            childSocketId: 'heart_socket',
            baseProbability: 0.3,
            damageFraction: 0.5,
            damageTypeModifiers: { piercing: 1.5 },
          },
        ],
      };
      // Test propagation with real array format
    });
  });

  describe('Type-based probability modifiers', () => {
    it('should apply modifier to baseProbability', () => {
      const propagationRules = {
        rules: [
          {
            childSocketId: 'heart_socket',
            baseProbability: 0.3,
            damageTypeModifiers: { piercing: 1.5 },
          },
        ],
      };
      // Damage type: piercing → effective probability = 0.3 * 1.5 = 0.45
    });

    it('should use default modifier 1.0 for unlisted types', () => {
      // Type not in modifiers → use 1.0 (no modification)
    });
  });

  describe('Simple type filtering', () => {
    it('should filter by damage_types array', () => {
      const propagationRules = {
        rules: [
          {
            childSocketId: 'head_socket',
            probability: 0.5,
            damage_types: ['piercing', 'slashing'],
          },
        ],
      };
      // Blunt damage → blocked by filter
      // Piercing damage → allowed
    });
  });
});
```

### Integration Tests Updates

```javascript
describe('Vital Organ Entities - Damage Propagation', () => {
  it('should propagate damage to heart with piercing modifier', async () => {
    // Create character with heart in torso socket
    // Apply piercing damage to torso
    // Verify heart receives 0.5 * 0.3 * 1.5 damage (fraction, base prob, modifier)
  });

  it('should propagate damage to spine with blunt modifier', async () => {
    // Create character with spine in torso socket
    // Apply blunt damage to torso
    // Verify spine receives 0.5 * 0.2 * 0.5 damage
  });
});
```

---

## 9. Code Changes Summary

### Files to Modify

| File                                                               | Change                                        | Complexity |
| ------------------------------------------------------------------ | --------------------------------------------- | ---------- |
| `src/anatomy/services/damagePropagationService.js`                 | Support array format, add type modifier logic | Medium     |
| `tests/unit/anatomy/services/damagePropagationService.test.js`     | Update tests for array format                 | Medium     |
| `tests/integration/anatomy/vitalOrganEntities.integration.test.js` | Add actual propagation behavior tests         | Medium     |
| `data/mods/anatomy/components/damage_propagation.component.json`   | Update schema with `oneOf`                    | Low        |
| `tests/integration/anatomy/damage-application.integration.test.js` | Verify real propagation works                 | Medium     |

### Files NOT to Change

- Entity definitions (`data/mods/anatomy/entities/definitions/*.entity.json`) - Already correct format
- `ApplyDamageHandler` - Already passes data correctly
- Operation schemas - No changes needed

---

## 10. Detailed Specification: Probability Modifier Logic

### Calculation Algorithm

When evaluating a rule for damage propagation:

```
Effective Probability = Base Probability × Type Modifier

Base Probability:
  - Use `baseProbability` if present
  - Otherwise use `probability` (legacy format)
  - Default: 1.0

Type Modifier:
  - If `damageTypeModifiers` object exists:
    - Use modifier[damageTypeId] if present
    - Otherwise use 1.0
  - If `damageTypeModifiers` doesn't exist:
    - If `damage_types` array exists and has items:
      - Use 1.0 if damageTypeId in array (allows propagation)
      - Block propagation if damageTypeId NOT in array
    - Otherwise use 1.0

Example 1: Piercing to heart (baseProbability=0.3, modifier=1.5)
  Effective Probability = 0.3 × 1.5 = 0.45 (45% chance)

Example 2: Blunt to heart (baseProbability=0.3, modifier=0.3)
  Effective Probability = 0.3 × 0.3 = 0.09 (9% chance)

Example 3: Fire to heart (no modifier specified, baseProbability=0.3)
  Effective Probability = 0.3 × 1.0 = 0.3 (30% chance)

Example 4: Piercing to head (probability=0.5, damage_types=['piercing'])
  Effective Probability = 0.5 × 1.0 = 0.5 (50% chance)

Example 5: Blunt to same head (probability=0.5, damage_types=['piercing'])
  Blocked: Type not in filter, no propagation
```

---

## 11. Socket ID vs Part ID Terminology

### Current Confusion

The code refers to propagation targets as `childPartId`, but the schema uses `childSocketId`.

### Clarification

- `childSocketId` is the **socket on the parent part** (where the child is mounted)
- Example: `heart_socket` is the socket on the torso where the heart is mounted
- The propagation service works with **socket IDs**, not part IDs
- Return value should be the socket ID that received propagated damage

---

## Summary Table: Current vs Proposed

| Aspect            | Current Code           | Current Schema/Data            | Proposed Solution        |
| ----------------- | ---------------------- | ------------------------------ | ------------------------ |
| Format            | Object (keyed) - WRONG | Array - CORRECT                | Array (primary) + legacy |
| Child ID field    | Object key (implicit)  | `childSocketId`                | `childSocketId`          |
| Probability field | `probability`          | `baseProbability`              | Support both             |
| Fraction field    | `damage_fraction`      | `damageFraction`               | Support both             |
| Type filtering    | `damage_types[]` array | `damageTypeModifiers{}` object | Support both             |
| Modifier logic    | Not implemented        | Defined in data                | Implement in code        |
| Tests pass        | ✅ Yes (wrong format)  | ✅ Schema valid                | ✅ All formats           |
| Real data works   | ❌ No                  | N/A                            | ✅ Yes                   |

---

## Implementation Checklist

- [ ] Update schema with `oneOf` to support both formats
- [ ] Update `DamagePropagationService.propagateDamage()` to handle array format
- [ ] Update `#passesProbabilityCheck()` to apply type modifiers
- [ ] Update `#passesDamageTypeFilter()` to handle both semantics
- [ ] Update unit tests for array format
- [ ] Add tests for type modifier calculation
- [ ] Add integration tests for actual propagation with real entities
- [ ] Verify all tests pass
- [ ] Update inline documentation
- [ ] Test with real entities (torso → heart, brain, spine)
