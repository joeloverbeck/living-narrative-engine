# HUNMETSYS-015: Operation Handler - UPDATE_BODY_COMPOSITION

**Status:** Not Started  
**Phase:** 4 - Visual Integration  
**Priority:** Medium  
**Estimated Effort:** 7 hours  
**Dependencies:** HUNMETSYS-014 (UPDATE_HUNGER_STATE), anatomy mod

## Objective

Implement UPDATE_BODY_COMPOSITION operation that modifies anatomy:body component's composition descriptor based on prolonged hunger states, providing visual feedback for starvation.

## Context

Prolonged starvation should have visible consequences. After an entity spends many turns in critical/starving/gluttonous states, their body composition descriptor should change to reflect their metabolic condition (emaciated, skeletal, overweight, etc.).

**Composition Thresholds (from spec):**
- Critical 20+ turns → desiccated
- Critical 15 turns → skeletal
- Starving 30+ turns → wasted
- Gluttonous 50+ turns → overweight

## Files to Touch

Follow the standard operation handler checklist:

### New Files (3)
1. **`data/schemas/operations/updateBodyComposition.schema.json`**
2. **`src/logic/operationHandlers/updateBodyCompositionHandler.js`**
3. **`tests/unit/logic/operationHandlers/updateBodyCompositionHandler.test.js`**

### Modified Files (6)
1. **`data/schemas/operation.schema.json`** (add $ref)
2. **`src/dependencyInjection/tokens/tokens-core.js`** (add token)
3. **`src/dependencyInjection/registrations/operationHandlerRegistrations.js`** (add factory)
4. **`src/dependencyInjection/registrations/interpreterRegistrations.js`** (add mapping)
5. **`src/utils/preValidationUtils.js`** (add to KNOWN_OPERATION_TYPES)
6. **`data/mods/metabolism/rules/turn_hunger_update.rule.json`** (add operation call)

## Implementation Details

### updateBodyComposition.schema.json
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "UPDATE_BODY_COMPOSITION Operation",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "UPDATE_BODY_COMPOSITION" },
        "parameters": { "$ref": "#/$defs/Parameters" }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "type": "object",
      "properties": {
        "entity_ref": {
          "$ref": "../common.schema.json#/definitions/entityReference",
          "description": "Entity with anatomy:body component"
        },
        "hunger_state": {
          "type": "string",
          "enum": ["gluttonous", "satiated", "neutral", "hungry", "starving", "critical"],
          "description": "Current hunger state"
        },
        "turns_in_state": {
          "type": "number",
          "description": "Consecutive turns in this state",
          "minimum": 0
        }
      },
      "required": ["entity_ref", "hunger_state", "turns_in_state"]
    }
  }
}
```

### updateBodyCompositionHandler.js (Key Logic)
```javascript
/**
 * Composition thresholds for each hunger state
 */
#compositionThresholds = {
  critical: {
    20: 'desiccated',
    15: 'skeletal',
    10: 'emaciated',
    5: 'wasted'
  },
  starving: {
    30: 'wasted',
    20: 'emaciated',
    10: 'malnourished'
  },
  gluttonous: {
    50: 'overweight',
    30: 'soft',
    10: 'soft'
  }
};

/**
 * Get appropriate composition for state and duration
 */
#getCompositionForState(state, turnsInState) {
  const thresholds = this.#compositionThresholds[state];
  if (!thresholds) return null;

  // Find highest threshold met
  const sortedThresholds = Object.keys(thresholds)
    .map(Number)
    .sort((a, b) => b - a);

  for (const threshold of sortedThresholds) {
    if (turnsInState >= threshold) {
      return thresholds[threshold];
    }
  }

  return null;
}

async execute(params, executionContext) {
  const { entity_ref, hunger_state, turns_in_state } = params;
  const entityId = resolveEntityReference(entity_ref, executionContext);

  // Get anatomy:body component
  const body = this.#entityManager.getComponent(entityId, 'anatomy:body');

  // If no body component, entity doesn't have anatomy system
  if (!body) {
    this.#logger.debug(`Entity ${entityId} missing anatomy:body, skipping composition update`);
    return;
  }

  // Calculate new composition
  const newComposition = this.#getCompositionForState(hunger_state, turns_in_state);

  // Only update if composition should change
  if (newComposition && body.composition !== newComposition) {
    const previousComposition = body.composition;

    await this.#entityManager.modifyComponent(
      entityId,
      'anatomy:body',
      { composition: newComposition }
    );

    // Dispatch change event
    this.#dispatcher.dispatch({
      type: 'anatomy:body_composition_changed',
      payload: {
        entityId,
        previousComposition,
        newComposition,
        cause: 'metabolism',
        hungerState: hunger_state
      }
    });
  }
}
```

### Modified turn_hunger_update.rule.json
```json
{
  "actions": [
    {
      "type": "UPDATE_HUNGER_STATE",
      "parameters": {
        "entity_ref": "{event.payload.entityId}"
      }
    },
    {
      "type": "UPDATE_BODY_COMPOSITION",
      "parameters": {
        "entity_ref": "{event.payload.entityId}",
        "hunger_state": "{component.metabolism:hunger_state.state}",
        "turns_in_state": "{component.metabolism:hunger_state.turns_in_state}"
      }
    }
  ]
}
```

## Out of Scope

**Not Included:**
- ❌ New body descriptors (use existing from anatomy mod)
- ❌ Hair density/other descriptor changes
- ❌ Immediate visual feedback (UI layer)
- ❌ Recovery mechanics (composition normalization)
- ❌ Gradual transition animations

## Acceptance Criteria

**Must Have:**
- ✅ Operation schema validates
- ✅ Handler only updates if entity has anatomy:body
- ✅ Handler maps hunger state + turns to correct composition
- ✅ Handler only updates when composition changes
- ✅ Handler dispatches anatomy:body_composition_changed event
- ✅ All DI registrations complete
- ✅ Added to KNOWN_OPERATION_TYPES
- ✅ turn_hunger_update rule calls both operations
- ✅ Unit tests cover all threshold mappings
- ✅ Test coverage 90%+

## References

- **Spec:** Section "UPDATE_BODY_COMPOSITION Operation" (p. 20)
- **Spec:** Section "Body Descriptor Integration" (p. 27)
- **Previous:** HUNMETSYS-014 (UPDATE_HUNGER_STATE)
- **Next:** HUNMETSYS-016 (Energy costs integration)
