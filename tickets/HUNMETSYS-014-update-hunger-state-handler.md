# HUNMETSYS-014: Operation Handler - UPDATE_HUNGER_STATE

**Status:** Not Started  
**Phase:** 4 - Visual Integration  
**Priority:** High  
**Estimated Effort:** 6 hours  
**Dependencies:** HUNMETSYS-002 (Hunger State component)

## Objective

Implement UPDATE_HUNGER_STATE operation that calculates hunger state from energy thresholds and applies appropriate gameplay states.

## Context

The hunger state system translates numerical energy values into meaningful gameplay states (satiated, hungry, starving, etc.). This operation recalculates the state based on current energy percentage and tracks time spent in each state for body composition updates.

**State Thresholds:**
- Gluttonous: >100% energy
- Satiated: 75-100%
- Neutral: 30-75%
- Hungry: 10-30%
- Starving: 0.1-10%
- Critical: ≤0%

## Files to Touch

Follow the standard operation handler checklist from CLAUDE.md:

### New Files (2)
1. **`data/schemas/operations/updateHungerState.schema.json`**
2. **`src/logic/operationHandlers/updateHungerStateHandler.js`**
3. **`tests/unit/logic/operationHandlers/updateHungerStateHandler.test.js`**

### Modified Files (5)
1. **`data/schemas/operation.schema.json`** (add $ref)
2. **`src/dependencyInjection/tokens/tokens-core.js`** (add token)
3. **`src/dependencyInjection/registrations/operationHandlerRegistrations.js`** (add factory)
4. **`src/dependencyInjection/registrations/interpreterRegistrations.js`** (add mapping)
5. **`src/utils/preValidationUtils.js`** (add to KNOWN_OPERATION_TYPES)

## Implementation Details

### updateHungerState.schema.json
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "UPDATE_HUNGER_STATE Operation",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "UPDATE_HUNGER_STATE" },
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
          "description": "Entity to update hunger state"
        }
      },
      "required": ["entity_ref"]
    }
  }
}
```

### updateHungerStateHandler.js (Core Logic)
```javascript
/**
 * Calculate hunger state from energy percentage
 */
#calculateHungerState(energyPercentage) {
  if (energyPercentage > 100) return 'gluttonous';
  if (energyPercentage >= 75) return 'satiated';
  if (energyPercentage >= 30) return 'neutral';
  if (energyPercentage >= 10) return 'hungry';
  if (energyPercentage > 0) return 'starving';
  return 'critical';
}

async execute(params, executionContext) {
  const { entity_ref } = params;
  const entityId = resolveEntityReference(entity_ref, executionContext);

  // Get components
  const store = this.#entityManager.getComponent(entityId, 'metabolism:metabolic_store');
  const hungerState = this.#entityManager.getComponent(entityId, 'metabolism:hunger_state');

  if (!store || !hungerState) {
    throw new Error(`Entity ${entityId} missing required metabolism components`);
  }

  // Calculate energy percentage
  const energyPercentage = (store.current_energy / store.max_energy) * 100;

  // Calculate new state
  const newState = this.#calculateHungerState(energyPercentage);
  const previousState = hungerState.state;

  // Update turns_in_state
  const turnsInState = (newState === previousState) 
    ? hungerState.turns_in_state + 1 
    : 0;

  // Update component
  await this.#entityManager.modifyComponent(
    entityId,
    'metabolism:hunger_state',
    {
      state: newState,
      energy_percentage: energyPercentage,
      turns_in_state: turnsInState
    }
  );

  // Dispatch state change event if changed
  if (newState !== previousState) {
    this.#dispatcher.dispatch({
      type: 'metabolism:hunger_state_changed',
      payload: {
        entityId,
        previousState,
        newState,
        energyPercentage,
        turnsInPreviousState: hungerState.turns_in_state
      }
    });
  }
}
```

## Out of Scope

**Not Included:**
- ❌ State effects application (handled by other systems)
- ❌ Body composition updates (HUNMETSYS-015)
- ❌ UI/audio feedback (future work)
- ❌ Configurable thresholds (hardcoded for now)

## Acceptance Criteria

**Must Have:**
- ✅ Operation schema validates
- ✅ Handler calculates energy percentage correctly
- ✅ Handler maps percentage to correct state
- ✅ Handler tracks turns_in_state (increment or reset to 0)
- ✅ Handler dispatches state change event when state changes
- ✅ Handler does NOT dispatch event if state unchanged
- ✅ All DI registrations complete
- ✅ Added to KNOWN_OPERATION_TYPES
- ✅ Unit tests cover all states and transitions
- ✅ Test coverage 90%+

## References

- **Spec:** Section "Threshold System" (p. 27-28)
- **Spec:** Section "Operation Handlers - UPDATE_HUNGER_STATE" (p. 19)
- **CLAUDE.md:** "Adding New Operations - Complete Checklist"
- **Previous:** HUNMETSYS-002 (Hunger State component)
- **Next:** HUNMETSYS-015 (UPDATE_BODY_COMPOSITION)
