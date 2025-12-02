# Weapon Damage Capabilities System Refactoring Specification

## Document Information

**Version:** 1.0.0
**Status:** Design Specification
**Last Updated:** 2025-12-02
**Author:** System Architect
**Dependencies:** `damage-types` mod (v1.0.0+), `weapons` mod (v1.0.0+), `anatomy` mod (v1.0.0+)
**Related Specs:** `damage-application-mechanics.md`

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solution Overview](#solution-overview)
3. [Current Architecture](#current-architecture)
4. [Target Architecture](#target-architecture)
5. [Component Definitions](#component-definitions)
6. [Schema Definitions](#schema-definitions)
7. [Service Modifications](#service-modifications)
8. [Operation Handler Changes](#operation-handler-changes)
9. [New Operator](#new-operator)
10. [Action and Scope Updates](#action-and-scope-updates)
11. [Rule Modifications](#rule-modifications)
12. [Infrastructure Removal](#infrastructure-removal)
13. [Migration Guide](#migration-guide)
14. [Testing Strategy](#testing-strategy)

---

## Problem Statement

### Current Limitations

1. **No Damage Amounts**: Weapons cannot specify how much damage they deal. Damage amounts are hardcoded in rules.

2. **Binary Capability Markers**: The `damage-types:can_cut` component is a pure marker with no data. Adding support for piercing, bludgeoning, fire, etc. requires creating additional marker components (`can_pierce`, `can_bash`, `can_burn`...).

3. **No Per-Weapon Customization**: Effect thresholds (penetration, bleed severity, dismemberment threshold) are defined globally in damage type definitions. A legendary sword cannot have different dismemberment behavior than a standard sword.

4. **Indirect Coupling**: The `DamageTypeEffectsService` looks up damage types by string name from a registry. If the string doesn't match a loaded definition, effects silently fail.

5. **Critical Bug**: The `handle_swing_at_target.rule.json` never calls the `APPLY_DAMAGE` operation - it only dispatches flavor text events.

### Use Cases Not Supported

- A flaming sword dealing both slashing (4 damage) and fire (3 damage)
- A cursed blade with enhanced bleed severity
- An executioner's axe with lower dismemberment threshold
- A poison-coated dagger with custom poison configuration
- Different damage values for rapier vs longsword

---

## Solution Overview

### Design Principles

1. **Component-Based**: Weapons carry their complete damage capabilities inline as component data
2. **Self-Contained**: No external registry lookups required; all data is on the entity
3. **Multi-Damage**: Weapons can have an array of damage types, all applied per hit
4. **Per-Weapon Customization**: Every effect threshold can be customized per weapon
5. **Action Gating**: Actions check for specific damage type names in the capabilities array

### Key Changes

| Area | Change |
|------|--------|
| Components | Create `damage-types:damage_capabilities` with full damage data |
| Services | `DamageTypeEffectsService` accepts damage entry object directly |
| Operations | `APPLY_DAMAGE` accepts `damage_entry` object parameter |
| Operators | Create `has_damage_capability` for filtering |
| Actions | Gate by component presence + damage type name check |
| Rules | Fix `handle_swing_at_target` to actually call `APPLY_DAMAGE` |
| Infrastructure | Remove `DamageTypeLoader`, registry storage, and `can_cut` |

---

## Current Architecture

### Data Flow (To Be Replaced)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CURRENT SYSTEM                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  data/mods/anatomy/damage-types/                                        │
│  ├── slashing.json ─────┐                                               │
│  ├── piercing.json ─────┼───► DamageTypeLoader ──► IDataRegistry        │
│  └── blunt.json ────────┘     (SimpleItemLoader)   ('damageTypes')      │
│                                                           │             │
│  Damage Type Properties:                                  ▼             │
│  - id, name, description                     DamageTypeEffectsService   │
│  - penetration: 0-1                          #dataRegistry.get()        │
│  - bleed: {enabled, severity, duration}              │                  │
│  - fracture: {enabled, threshold, stun}              ▼                  │
│  - dismember: {enabled, threshold}           ApplyDamageHandler         │
│  - burn: {enabled, dps, duration, stack}     (passes string type)       │
│  - poison: {enabled, tick, duration}                                    │
│                                                                         │
│  Weapons:                                                               │
│  - weapons:weapon (marker)                                              │
│  - damage-types:can_cut (marker, NO DATA)                               │
│  - NO damage amounts                                                    │
│  - NO effect customization                                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Files Involved

| File | Purpose | Status |
|------|---------|--------|
| `src/loaders/damageTypeLoader.js` | Loads damage types into registry | TO REMOVE |
| `data/mods/anatomy/damage-types/*.json` | Global damage definitions | TO REMOVE |
| `data/mods/damage-types/components/can_cut.component.json` | Marker component | TO REMOVE |
| `src/anatomy/services/damageTypeEffectsService.js` | Applies effects from registry | TO MODIFY |

---

## Target Architecture

### Data Flow (New Design)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TARGET SYSTEM                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Weapon Entity Definition:                                              │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ {                                                                 │  │
│  │   "weapons:weapon": {},                                           │  │
│  │   "damage-types:damage_capabilities": {                           │  │
│  │     "entries": [                                                  │  │
│  │       {                                                           │  │
│  │         "name": "slashing",                                       │  │
│  │         "amount": 4,                                              │  │
│  │         "penetration": 0.3,                                       │  │
│  │         "bleed": { "enabled": true, "severity": "moderate" },     │  │
│  │         "dismember": { "enabled": true, "thresholdFraction": 0.6 }│  │
│  │       },                                                          │  │
│  │       {                                                           │  │
│  │         "name": "fire",                                           │  │
│  │         "amount": 3,                                              │  │
│  │         "burn": { "enabled": true, "dps": 2, "durationTurns": 3 } │  │
│  │       }                                                           │  │
│  │     ]                                                             │  │
│  │   }                                                               │  │
│  │ }                                                                 │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│  Action Discovery:                                                      │
│  - Check has_damage_capability(weapon, "slashing")                      │
│                              │                                          │
│                              ▼                                          │
│  Rule Execution:                                                        │
│  - QUERY_COMPONENT → get damage_capabilities.entries                    │
│  - FOR_EACH entry → APPLY_DAMAGE(target, entry)                         │
│                              │                                          │
│                              ▼                                          │
│  DamageTypeEffectsService.applyEffectsForDamage(damageEntry)            │
│  - Uses entry directly (no registry lookup)                             │
│  - Applies: bleed, fracture, burn, poison, dismember                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Definitions

### New: `damage-types:damage_capabilities`

**Purpose**: Defines all damage types a weapon can inflict, with complete effect configuration.

**File**: `data/mods/damage-types/components/damage_capabilities.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "damage-types:damage_capabilities",
  "description": "Defines damage types and amounts a weapon can inflict, including effect configurations",
  "dataSchema": {
    "type": "object",
    "properties": {
      "entries": {
        "type": "array",
        "description": "Array of damage type entries this weapon can inflict",
        "minItems": 1,
        "items": {
          "$ref": "schema://living-narrative-engine/damage-capability-entry.schema.json"
        }
      }
    },
    "required": ["entries"],
    "additionalProperties": false
  }
}
```

### Removed: `damage-types:can_cut`

This marker component is deprecated and removed. Action gating now uses `has_damage_capability` operator.

---

## Schema Definitions

### New: `damage-capability-entry.schema.json`

**File**: `data/schemas/damage-capability-entry.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/damage-capability-entry.schema.json",
  "title": "DamageCapabilityEntry",
  "description": "A single damage type entry with amount and effect configuration",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Damage type identifier (e.g., 'slashing', 'piercing', 'fire')",
      "minLength": 1
    },
    "amount": {
      "type": "number",
      "description": "Base damage amount for this type",
      "minimum": 0
    },
    "penetration": {
      "type": "number",
      "description": "Weighting for internal damage propagation (0-1)",
      "minimum": 0,
      "maximum": 1,
      "default": 0
    },
    "bleed": {
      "type": "object",
      "description": "Bleeding effect configuration",
      "properties": {
        "enabled": { "type": "boolean", "default": false },
        "severity": {
          "type": "string",
          "enum": ["minor", "moderate", "severe"],
          "default": "minor"
        },
        "baseDurationTurns": {
          "type": "integer",
          "minimum": 1,
          "default": 2
        }
      },
      "additionalProperties": false
    },
    "fracture": {
      "type": "object",
      "description": "Bone fracture effect configuration",
      "properties": {
        "enabled": { "type": "boolean", "default": false },
        "thresholdFraction": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "default": 0.5
        },
        "stunChance": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "default": 0.2
        }
      },
      "additionalProperties": false
    },
    "burn": {
      "type": "object",
      "description": "Burning effect configuration",
      "properties": {
        "enabled": { "type": "boolean", "default": false },
        "dps": { "type": "number", "minimum": 0, "default": 1 },
        "durationTurns": { "type": "integer", "minimum": 1, "default": 2 },
        "canStack": { "type": "boolean", "default": false }
      },
      "additionalProperties": false
    },
    "poison": {
      "type": "object",
      "description": "Poison effect configuration",
      "properties": {
        "enabled": { "type": "boolean", "default": false },
        "tickDamage": { "type": "number", "minimum": 0, "default": 1 },
        "durationTurns": { "type": "integer", "minimum": 1, "default": 3 },
        "scope": {
          "type": "string",
          "enum": ["part", "entity"],
          "default": "part"
        }
      },
      "additionalProperties": false
    },
    "dismember": {
      "type": "object",
      "description": "Dismemberment effect configuration",
      "properties": {
        "enabled": { "type": "boolean", "default": false },
        "thresholdFraction": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "default": 0.8,
          "description": "Part must be below this health fraction for dismemberment to trigger"
        }
      },
      "additionalProperties": false
    },
    "flags": {
      "type": "array",
      "description": "Custom extensibility flags (e.g., 'magical', 'holy', 'silver')",
      "items": { "type": "string" },
      "default": []
    }
  },
  "required": ["name", "amount"],
  "additionalProperties": false
}
```

### Updated: `applyDamage.schema.json`

**File**: `data/schemas/operations/applyDamage.schema.json`

Add `damage_entry` parameter:

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

**Behavior**:
- If `damage_entry` provided: use it directly
- If `damage_type` + `amount` provided: legacy mode (emit deprecation warning)

---

## Service Modifications

### DamageTypeEffectsService

**File**: `src/anatomy/services/damageTypeEffectsService.js`

#### Method Signature Change

**Before**:
```javascript
async applyEffectsForDamage({ entityId, partId, amount, damageType, maxHealth, currentHealth })
```

**After**:
```javascript
async applyEffectsForDamage({ entityId, partId, damageEntry, maxHealth, currentHealth })
```

Where `damageEntry` is the complete damage capability entry object:
```javascript
{
  name: "slashing",
  amount: 4,
  penetration: 0.3,
  bleed: { enabled: true, severity: "moderate", baseDurationTurns: 3 },
  dismember: { enabled: true, thresholdFraction: 0.6 }
}
```

#### Remove Registry Lookup

**Before**:
```javascript
const damageTypeDef = this.#dataRegistry.get('damageTypes', damageType);
if (!damageTypeDef) {
  this.#logger.warn(`Unknown damage type "${damageType}"`);
  return;
}
```

**After**:
```javascript
// damageEntry is passed directly - no lookup needed
if (!damageEntry) {
  this.#logger.warn('No damage entry provided');
  return;
}
```

#### Update Internal Methods

All `#checkAndApply*` methods receive `damageEntry` directly:

```javascript
#checkAndApplyDismemberment(damageEntry, partId, currentHealth, maxHealth) {
  if (!damageEntry.dismember?.enabled) return false;
  const threshold = damageEntry.dismember.thresholdFraction ?? 0.8;
  // ... rest of logic
}
```

---

## Operation Handler Changes

### ApplyDamageHandler

**File**: `src/logic/operationHandlers/applyDamageHandler.js`

#### Accept `damage_entry` Parameter

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

---

## New Operator

### `has_damage_capability`

**Purpose**: Check if an entity has a specific damage type in its `damage_capabilities` entries.

**File**: `src/logic/operators/hasDamageCapabilityOperator.js`

```javascript
/**
 * @file Operator to check if entity has a specific damage capability
 */

import BaseOperator from './baseOperator.js';

class HasDamageCapabilityOperator extends BaseOperator {
  static get operatorName() {
    return 'has_damage_capability';
  }

  /**
   * @param {Array} args - [entity_ref, damage_type_name]
   * @param {Object} context - Evaluation context
   * @returns {boolean} True if entity has the damage capability
   */
  execute(args, context) {
    const [entityRef, damageTypeName] = args;

    const entity = this.resolveEntityRef(entityRef, context);
    if (!entity) return false;

    const capabilities = this.#entityManager.getComponent(
      entity.id,
      'damage-types:damage_capabilities'
    );

    if (!capabilities?.entries) return false;

    return capabilities.entries.some(entry => entry.name === damageTypeName);
  }
}

export default HasDamageCapabilityOperator;
```

**Usage in JSON Logic**:
```json
{ "has_damage_capability": ["primary", "slashing"] }
```

**Registration**: Add to `src/logic/jsonLogicCustomOperators.js`

---

## Action and Scope Updates

### swing_at_target.action.json

**File**: `data/mods/weapons/actions/swing_at_target.action.json`

**Before**:
```json
{
  "required_components": {
    "actor": ["positioning:wielding"],
    "primary": ["weapons:weapon", "damage-types:can_cut"]
  }
}
```

**After**:
```json
{
  "required_components": {
    "actor": ["positioning:wielding"],
    "primary": ["weapons:weapon", "damage-types:damage_capabilities"]
  },
  "conditions": [
    {
      "description": "Weapon must have slashing damage capability",
      "expression": { "has_damage_capability": ["primary", "slashing"] }
    }
  ]
}
```

### wielded_cutting_weapons.scope

**File**: `data/mods/weapons/scopes/wielded_cutting_weapons.scope`

**Before**:
```
weapons:wielded_cutting_weapons := actor.components.positioning:wielding.wielded_item_ids[][{
  "and": [
    { "has_component": [".", "weapons:weapon"] },
    { "has_component": [".", "damage-types:can_cut"] }
  ]
}]
```

**After**:
```
weapons:wielded_cutting_weapons := actor.components.positioning:wielding.wielded_item_ids[][{
  "and": [
    { "has_component": [".", "weapons:weapon"] },
    { "has_component": [".", "damage-types:damage_capabilities"] },
    { "has_damage_capability": [".", "slashing"] }
  ]
}]
```

---

## Rule Modifications

### handle_swing_at_target.rule.json (CRITICAL FIX)

**File**: `data/mods/weapons/rules/handle_swing_at_target.rule.json`

The rule currently does NOT call `APPLY_DAMAGE`. This must be fixed.

**Add to SUCCESS branch**:
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

**Add to CRITICAL_SUCCESS branch** (with multiplier):
```json
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

---

## Infrastructure Removal

### Files to Delete

| File | Reason |
|------|--------|
| `src/loaders/damageTypeLoader.js` | No longer loading from registry |
| `data/mods/anatomy/damage-types/slashing.json` | Data now on weapons |
| `data/mods/anatomy/damage-types/piercing.json` | Data now on weapons |
| `data/mods/anatomy/damage-types/blunt.json` | Data now on weapons |
| `data/mods/damage-types/components/can_cut.component.json` | Replaced by damage_capabilities |

### DI Registrations to Remove

**File**: `src/dependencyInjection/registrations/loadersRegistrations.js`

Remove:
```javascript
registerLoader(tokens.DamageTypeLoader, DamageTypeLoader);
```

**File**: `src/dependencyInjection/tokens/tokens-core.js`

Remove:
```javascript
DamageTypeLoader: 'DamageTypeLoader',
```

### Mod Manifest Updates

**File**: `data/mods/anatomy/mod-manifest.json`

Remove `damage-types` from content:
```json
{
  "content": {
    // Remove: "damageTypes": [...]
  }
}
```

---

## Migration Guide

### Migrating Weapon Entities

**Before** (with marker):
```json
{
  "id": "fantasy:vespera_rapier",
  "components": {
    "weapons:weapon": {},
    "damage-types:can_cut": {}
  }
}
```

**After** (with full damage data):
```json
{
  "id": "fantasy:vespera_rapier",
  "components": {
    "weapons:weapon": {},
    "damage-types:damage_capabilities": {
      "entries": [
        {
          "name": "slashing",
          "amount": 3,
          "penetration": 0.3,
          "bleed": {
            "enabled": true,
            "severity": "moderate",
            "baseDurationTurns": 3
          },
          "dismember": {
            "enabled": true,
            "thresholdFraction": 0.8
          }
        }
      ]
    }
  }
}
```

### Weapon Migration Reference

| Weapon | Damage Configuration |
|--------|---------------------|
| Vespera Rapier | slashing: 3, bleed: moderate |
| Vespera Main-Gauche | piercing: 2, bleed: minor, penetration: 0.8 |
| Rill Practice Stick | blunt: 1, fracture: disabled |
| Threadscar Melissa Longsword | slashing: 4, bleed: moderate, dismember: 0.7 |

---

## Testing Strategy

### Unit Tests

#### DamageTypeEffectsService Tests
- Test with full damage entry object
- Test each effect type (bleed, fracture, burn, poison, dismember)
- Test with missing optional fields (uses defaults)
- Test with disabled effects

#### HasDamageCapabilityOperator Tests
- Entity has matching damage type → returns true
- Entity has different damage type → returns false
- Entity has no damage_capabilities → returns false
- Entity has multiple entries → finds correct one

#### ApplyDamageHandler Tests
- Test with `damage_entry` parameter
- Test legacy `damage_type` + `amount` (deprecation warning)
- Test missing required parameters

### Integration Tests

#### Multi-Damage Weapon Test
```javascript
describe('Multi-damage weapon', () => {
  it('should apply all damage types on hit', async () => {
    // Create flaming sword with slashing + fire
    // Execute swing_at_target
    // Verify both damages applied
    // Verify both effects (bleed from slashing, burn from fire)
  });
});
```

#### Action Discovery Test
```javascript
describe('swing_at_target discovery', () => {
  it('should only show for weapons with slashing capability', async () => {
    // Weapon with slashing → action available
    // Weapon with only piercing → action NOT available
  });
});
```

### E2E Tests

#### Complete Combat Flow
1. Create attacker with weapon
2. Create target with anatomy
3. Execute swing_at_target
4. Verify damage applied to target part
5. Verify effects attached (bleeding, etc.)
6. Verify events dispatched

---

## Appendix: Example Weapon Configurations

### Standard Longsword
```json
{
  "damage-types:damage_capabilities": {
    "entries": [
      {
        "name": "slashing",
        "amount": 4,
        "penetration": 0.3,
        "bleed": { "enabled": true, "severity": "moderate", "baseDurationTurns": 3 },
        "dismember": { "enabled": true, "thresholdFraction": 0.8 }
      }
    ]
  }
}
```

### Flaming Sword
```json
{
  "damage-types:damage_capabilities": {
    "entries": [
      {
        "name": "slashing",
        "amount": 3,
        "bleed": { "enabled": true, "severity": "minor", "baseDurationTurns": 2 }
      },
      {
        "name": "fire",
        "amount": 2,
        "burn": { "enabled": true, "dps": 1.5, "durationTurns": 3, "canStack": false }
      }
    ]
  }
}
```

### War Hammer
```json
{
  "damage-types:damage_capabilities": {
    "entries": [
      {
        "name": "blunt",
        "amount": 5,
        "penetration": 0.1,
        "fracture": { "enabled": true, "thresholdFraction": 0.4, "stunChance": 0.3 }
      }
    ]
  }
}
```

### Assassin's Dagger
```json
{
  "damage-types:damage_capabilities": {
    "entries": [
      {
        "name": "piercing",
        "amount": 2,
        "penetration": 0.9,
        "bleed": { "enabled": true, "severity": "minor", "baseDurationTurns": 2 }
      },
      {
        "name": "poison",
        "amount": 0,
        "poison": { "enabled": true, "tickDamage": 2, "durationTurns": 5, "scope": "entity" }
      }
    ]
  }
}
```

### Executioner's Axe
```json
{
  "damage-types:damage_capabilities": {
    "entries": [
      {
        "name": "slashing",
        "amount": 6,
        "penetration": 0.2,
        "bleed": { "enabled": true, "severity": "severe", "baseDurationTurns": 4 },
        "dismember": { "enabled": true, "thresholdFraction": 0.5 }
      }
    ]
  }
}
```
