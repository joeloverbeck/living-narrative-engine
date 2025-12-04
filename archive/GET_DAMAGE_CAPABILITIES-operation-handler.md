# Specification: GET_DAMAGE_CAPABILITIES Operation Handler

## Overview

This specification defines a new operation handler that retrieves or generates damage capabilities for any entity. The primary use case is supporting **throwing portable objects** where non-weapon items need valid damage capabilities derived from their weight.

## Problem Statement

When implementing throwable objects, many items (books, bottles, rocks, furniture) lack explicit `damage-types:damage_capabilities` components because they weren't designed as weapons. However, any object with mass can inflict blunt damage when thrown. The system needs a consistent way to:

1. Return existing damage capabilities for weapons
2. Generate reasonable blunt damage capabilities for non-weapons based on weight
3. Provide a guaranteed valid damage capability array for use in `APPLY_DAMAGE`

## Proposed Solution

Create a `GET_DAMAGE_CAPABILITIES` operation handler that:

- Accepts an entity reference
- Checks if the entity has `damage-types:damage_capabilities` component
- If present: returns the existing `entries` array unchanged
- If absent: generates blunt damage capabilities from `core:weight` component
- Always returns a valid damage capability array (never null/undefined)

## Technical Design

### Operation Schema

**File**: `data/schemas/operations/getDamageCapabilities.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "GET_DAMAGE_CAPABILITIES Operation",
  "description": "Retrieves damage capabilities from an entity, generating blunt damage from weight if none exist",
  "allOf": [{ "$ref": "../base-operation.schema.json" }],
  "properties": {
    "type": { "const": "GET_DAMAGE_CAPABILITIES" },
    "parameters": { "$ref": "#/$defs/Parameters" }
  },
  "required": ["type", "parameters"],
  "$defs": {
    "Parameters": {
      "type": "object",
      "properties": {
        "entity_ref": {
          "description": "Reference to the entity. Supports entity ID string, keywords (actor/target/primary/secondary/tertiary), or JSON Logic expression.",
          "oneOf": [
            { "type": "string" },
            { "type": "object" }
          ]
        },
        "output_variable": {
          "type": "string",
          "description": "Variable name to store the resulting damage capabilities array in the execution context. The array can then be iterated with FOREACH or accessed via JSON Logic."
        }
      },
      "required": ["entity_ref", "output_variable"],
      "additionalProperties": false
    }
  }
}
```

### Handler Implementation

**File**: `src/logic/operationHandlers/getDamageCapabilitiesHandler.js`

#### Dependencies

| Dependency | Purpose |
|------------|---------|
| `entityManager` | Retrieve entity components |
| `logger` | Contextual logging |
| `safeEventDispatcher` | Error event dispatching |
| `jsonLogicService` | Resolve JSON Logic expressions |

#### Algorithm

```
1. Validate parameters (entity_ref, output_variable)
2. Resolve entity_ref to entity ID
3. Check for damage-types:damage_capabilities component
   a. If present → extract entries array → store in output_variable → return
4. Check for core:weight component
   a. If present → calculate blunt damage from weight → generate entry → store → return
   b. If absent → dispatch warning event → generate minimal fallback entry → store → return
```

#### Weight-to-Damage Conversion Formula

Based on observed weapon weights and damage values:

| Entity | Weight (kg) | Blunt Damage |
|--------|-------------|--------------|
| Practice stick | 0.9 | 5 |
| Rapier | 1.2 | (piercing weapon, N/A) |
| Longsword | 1.8 | (slashing weapon, N/A) |

**Proposed Formula**:

```javascript
function calculateBluntDamage(weightKg) {
  // Base damage: 1 point per 0.2kg, minimum 1, maximum 50
  const baseDamage = Math.ceil(weightKg * 5);
  return Math.max(1, Math.min(50, baseDamage));
}
```

**Rationale**:
- Very light objects (0.1kg book) → 1 damage
- Light objects (0.5kg bottle) → 3 damage
- Medium objects (1kg rock) → 5 damage
- Heavy objects (5kg chair) → 25 damage
- Very heavy objects (10kg+) → capped at 50 damage

**Fracture Calculation** (for heavier objects):

```javascript
function calculateFracture(weightKg) {
  if (weightKg < 1.0) {
    return { enabled: false };
  }
  // Heavier objects more likely to cause fractures
  return {
    enabled: true,
    thresholdFraction: Math.max(0.3, 1.0 - (weightKg * 0.1)), // Lower threshold for heavier
    stunChance: Math.min(0.5, weightKg * 0.05) // Higher stun for heavier
  };
}
```

#### Generated Damage Entry Structure

When generating from weight:

```json
{
  "name": "blunt",
  "amount": 5,
  "penetration": 0,
  "fracture": {
    "enabled": true,
    "thresholdFraction": 0.8,
    "stunChance": 0.1
  },
  "flags": ["improvised"]
}
```

The `"improvised"` flag distinguishes thrown objects from dedicated weapons, allowing rules to differentiate behavior if needed.

#### Fallback Entry (No Weight)

For entities without `core:weight` (edge case):

```json
{
  "name": "blunt",
  "amount": 1,
  "penetration": 0,
  "fracture": { "enabled": false },
  "flags": ["improvised", "weightless"]
}
```

### Registration Requirements

Per CLAUDE.md "Adding New Operations" checklist:

1. **Schema**: `data/schemas/operations/getDamageCapabilities.schema.json`
2. **Schema reference**: Add to `data/schemas/operation.schema.json` anyOf array
3. **Handler**: `src/logic/operationHandlers/getDamageCapabilitiesHandler.js`
4. **DI Token**: Add `GetDamageCapabilitiesHandler` to `tokens-core.js`
5. **Factory registration**: Add to `operationHandlerRegistrations.js`
6. **Operation mapping**: Add to `interpreterRegistrations.js`
7. **Pre-validation whitelist**: Add `'GET_DAMAGE_CAPABILITIES'` to `preValidationUtils.js`
8. **Tests**: Unit and integration tests

## Usage Example

### In a Rule (Throwing Action)

```json
{
  "id": "weapons:handle_throw_item",
  "trigger": {
    "eventType": "ACTION_EXECUTION_STARTED",
    "conditions": [
      { "==": [{ "var": "event.actionId" }, "weapons:throw_item"] }
    ]
  },
  "operations": [
    {
      "type": "GET_DAMAGE_CAPABILITIES",
      "parameters": {
        "entity_ref": { "var": "event.parameters.item" },
        "output_variable": "damage_entries"
      }
    },
    {
      "type": "FOREACH",
      "parameters": {
        "collection": { "var": "damage_entries" },
        "item_variable": "damage_entry",
        "operations": [
          {
            "type": "APPLY_DAMAGE",
            "parameters": {
              "entity_ref": "target",
              "damage_entry": { "var": "damage_entry" },
              "damage_multiplier": { "var": "event.parameters.throw_multiplier" }
            }
          }
        ]
      }
    }
  ]
}
```

### Result Storage

The operation stores results in the execution context under the specified `output_variable`:

```javascript
// After GET_DAMAGE_CAPABILITIES executes with output_variable: "damage_entries"
executionContext.variables.damage_entries = [
  {
    name: "blunt",
    amount: 5,
    penetration: 0,
    fracture: { enabled: true, thresholdFraction: 0.8, stunChance: 0.1 },
    flags: ["improvised"]
  }
];
```

## Test Plan

### Unit Tests

**File**: `tests/unit/logic/operationHandlers/getDamageCapabilitiesHandler.test.js`

| Test Case | Description |
|-----------|-------------|
| Returns existing damage capabilities unchanged | Entity with `damage-types:damage_capabilities` |
| Generates blunt damage from weight | Entity with `core:weight` but no damage capabilities |
| Generates minimal fallback for weightless entities | Entity with neither component |
| Calculates correct damage for various weights | Test conversion formula |
| Enables fracture for heavy objects | Weight >= 1.0kg |
| Disables fracture for light objects | Weight < 1.0kg |
| Resolves JSON Logic entity references | Using JSON Logic expressions |
| Resolves keyword entity references | actor, target, primary, secondary, tertiary |
| Dispatches error for invalid entity | Non-existent entity ID |
| Stores result in output_variable | Verify context variable storage |

### Integration Tests

**File**: `tests/integration/mods/weapons/getDamageCapabilities.integration.test.js`

| Test Case | Description |
|-----------|-------------|
| Works with real weapon entity | Test with vespera_rapier (existing capabilities) |
| Works with non-weapon portable item | Test with coffee_cup or similar |
| Integrates with APPLY_DAMAGE in rule | Full throw action pipeline |
| Handles entities loaded from mods | Real mod loading context |

## Dependencies & Affected Files

### New Files

- `data/schemas/operations/getDamageCapabilities.schema.json`
- `src/logic/operationHandlers/getDamageCapabilitiesHandler.js`
- `tests/unit/logic/operationHandlers/getDamageCapabilitiesHandler.test.js`
- `tests/integration/mods/weapons/getDamageCapabilities.integration.test.js`

### Modified Files

- `data/schemas/operation.schema.json` - Add schema reference
- `src/dependencyInjection/tokens/tokens-core.js` - Add DI token
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` - Add factory
- `src/dependencyInjection/registrations/interpreterRegistrations.js` - Add mapping
- `src/utils/preValidationUtils.js` - Add to whitelist

## Open Questions

1. **Damage cap**: Is 50 max damage appropriate for improvised weapons?
2. **Penetration**: Should thrown objects have any penetration? (Currently 0)
3. **Material bonuses**: Should `core:material` affect damage? (e.g., metal objects deal more)
4. **Size consideration**: Should we factor in dimensions beyond weight?
5. **Velocity factor**: Should the throw action's force/skill affect the generated damage, or just the multiplier in APPLY_DAMAGE?

## Implementation Priority

This operation handler is a prerequisite for the "throw portable objects" feature. Recommended implementation order:

1. GET_DAMAGE_CAPABILITIES operation handler (this spec)
2. Throw action definition (`weapons:throw_item`)
3. Throw action discovery scope
4. Handle throw rule with damage application

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-04 | Claude | Initial specification |
