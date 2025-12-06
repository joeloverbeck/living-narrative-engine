# HUNMETSYS-009: Action Rule Handlers

**Status:** In Progress
**Phase:** 2 - Mod Structure
**Priority:** High
**Estimated Effort:** 7 hours (revised from 5 hours)
**Dependencies:** HUNMETSYS-005 (CONSUME_ITEM), HUNMETSYS-008 (Action Definitions)

## Objective

Create rule handlers that execute when eat, drink, and rest actions are attempted, implementing the behavior specified for each action type with proper perception logging and turn management following established patterns.

## Context

With action definitions created in HUNMETSYS-008 and the CONSUME_ITEM operation handler from HUNMETSYS-005, we now need to connect user actions to the metabolism system by creating rules that respond to action attempt events.

**Key Behaviors:**

- **Eat/Drink Rules:** Call CONSUME_ITEM operation to transfer fuel to buffer
- **Rest Rule:** Reset energy to maxEnergy and reset metabolic_efficiency_multiplier to 1.0
- **All rules:** Use `core:logSuccessAndEndTurn` macro for consistent event flow and turn management

**Corrected Pattern Understanding:**

- Rules use condition references (separate condition files)
- Rules must dispatch perceptible events for NPC observation
- Rules must set up context variables before calling macros
- Rules use `core:logSuccessAndEndTurn` macro (not direct END_TURN)
- The macro handles: perceptible events, UI feedback, action success tracking, turn ending

## Files to Touch

### New Files (6, revised from 3)

**Condition Files (3):**

1. **`data/mods/metabolism/conditions/event-is-action-eat.condition.json`**
   - Matches `metabolism:eat` action ID

2. **`data/mods/metabolism/conditions/event-is-action-drink-beverage.condition.json`**
   - Matches `metabolism:drink_beverage` action ID

3. **`data/mods/metabolism/conditions/event-is-action-rest.condition.json`**
   - Matches `metabolism:rest` action ID

**Rule Files (3):**

1. **`data/mods/metabolism/rules/handle_eat_food.rule.json`**
   - Triggers on `core:attempt_action` for `metabolism:eat`
   - Calls CONSUME_ITEM operation
   - Sets up context variables for macro
   - Uses `core:logSuccessAndEndTurn` macro

2. **`data/mods/metabolism/rules/handle_drink_beverage.rule.json`**
   - Triggers on `core:attempt_action` for `metabolism:drink_beverage`
   - Calls CONSUME_ITEM operation
   - Sets up context variables for macro
   - Uses `core:logSuccessAndEndTurn` macro

3. **`data/mods/metabolism/rules/handle_rest.rule.json`**
   - Triggers on `core:attempt_action` for `metabolism:rest`
   - Queries metabolic_store component
   - Resets current_energy to max_energy
   - Resets metabolic_efficiency_multiplier to 1.0
   - Sets up context variables for macro
   - Uses `core:logSuccessAndEndTurn` macro

### Modified Files (1)

1. **`data/mods/metabolism/mod-manifest.json`**
   - Add all three conditions to `content.conditions` array
   - Add all three rules to `content.rules` array
   - Keep alphabetically sorted

## Implementation Details

### Condition Files

All conditions follow the same pattern:

**event-is-action-eat.condition.json:**

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "condition_id": "event-is-action-eat",
  "description": "Matches eat action attempt events",
  "condition": {
    "==": ["{event.payload.actionId}", "metabolism:eat"]
  }
}
```

**event-is-action-drink-beverage.condition.json:**

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "condition_id": "event-is-action-drink-beverage",
  "description": "Matches drink beverage action attempt events",
  "condition": {
    "==": ["{event.payload.actionId}", "metabolism:drink_beverage"]
  }
}
```

**event-is-action-rest.condition.json:**

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "condition_id": "event-is-action-rest",
  "description": "Matches rest action attempt events",
  "condition": {
    "==": ["{event.payload.actionId}", "metabolism:rest"]
  }
}
```

### handle_eat_food.rule.json

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_eat_food",
  "comment": "Handles eat action by consuming food item and logging perception",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "metabolism:event-is-action-eat"
  },
  "actions": [
    {
      "type": "CONSUME_ITEM",
      "comment": "Transfer food nutrients to metabolic buffer",
      "parameters": {
        "consumer_ref": "{event.payload.actorId}",
        "item_ref": "{event.payload.targetId}"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get actor position for perception logging",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "GET_NAME",
      "comment": "Get actor name for message",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "GET_NAME",
      "comment": "Get food item name for message",
      "parameters": {
        "entity_ref": "target",
        "result_variable": "itemName"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Prepare log message for macro",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} eats {context.itemName}."
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Set perception type for macro",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "food_consumed"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Set location for macro",
      "parameters": {
        "variable_name": "locationId",
        "value": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Set target for macro",
      "parameters": {
        "variable_name": "targetId",
        "value": "{event.payload.targetId}"
      }
    },
    {
      "comment": "Log success, dispatch events, and end turn",
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

### handle_drink_beverage.rule.json

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_drink_beverage",
  "comment": "Handles drink action by consuming beverage and logging perception",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "metabolism:event-is-action-drink-beverage"
  },
  "actions": [
    {
      "type": "CONSUME_ITEM",
      "comment": "Transfer beverage nutrients to metabolic buffer",
      "parameters": {
        "consumer_ref": "{event.payload.actorId}",
        "item_ref": "{event.payload.targetId}"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get actor position for perception logging",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "GET_NAME",
      "comment": "Get actor name for message",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "GET_NAME",
      "comment": "Get beverage name for message",
      "parameters": {
        "entity_ref": "target",
        "result_variable": "itemName"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Prepare log message for macro",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} drinks {context.itemName}."
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Set perception type for macro",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "drink_consumed"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Set location for macro",
      "parameters": {
        "variable_name": "locationId",
        "value": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Set target for macro",
      "parameters": {
        "variable_name": "targetId",
        "value": "{event.payload.targetId}"
      }
    },
    {
      "comment": "Log success, dispatch events, and end turn",
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

### handle_rest.rule.json

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_rest",
  "comment": "Handles rest action by resetting energy and efficiency multiplier",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "metabolism:event-is-action-rest"
  },
  "actions": [
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get current metabolic state",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "metabolism:metabolic_store",
        "result_variable": "metabolicStore"
      }
    },
    {
      "type": "MODIFY_COMPONENT",
      "comment": "Reset energy to maximum",
      "parameters": {
        "entity_ref": "{event.payload.actorId}",
        "component_type": "metabolism:metabolic_store",
        "field": "current_energy",
        "mode": "set",
        "value": "{context.metabolicStore.max_energy}"
      }
    },
    {
      "type": "MODIFY_COMPONENT",
      "comment": "Reset efficiency multiplier to baseline",
      "parameters": {
        "entity_ref": "{event.payload.actorId}",
        "component_type": "metabolism:fuel_converter",
        "field": "metabolic_efficiency_multiplier",
        "mode": "set",
        "value": 1.0
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get actor position for perception logging",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "GET_NAME",
      "comment": "Get actor name for message",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Prepare log message for macro",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} rests and recovers energy."
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Set perception type for macro",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "rest_action"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Set location for macro",
      "parameters": {
        "variable_name": "locationId",
        "value": "{context.actorPosition.locationId}"
      }
    },
    {
      "comment": "Log success, dispatch events, and end turn",
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

### Rest Mechanic Notes (Revised)

- Resets energy to max_energy (not fixed 50 points)
- Resets metabolic_efficiency_multiplier to 1.0 (baseline, not boost)
- Represents complete recovery during rest period
- Energy reset provides full recovery regardless of current state
- Multiplier reset clears any active metabolic effects

## Out of Scope

**Not Included:**

- ❌ Error handling for CONSUME_ITEM failures (handled by operation dispatcher)
- ❌ Integration tests (this ticket now includes tests)
- ❌ Energy costs on movement/exercise actions (HUNMETSYS-016)
- ❌ Overeating penalties (handled by CONSUME_ITEM validation)
- ❌ Vomit mechanic (future extension)
- ❌ Rest action variations (sleep, nap, etc.)
- ❌ Activity multiplier boost mechanics (saved for future enhancement)

**Dependencies Not Ready:**

- ❌ GOAP integration (HUNMETSYS-013)
- ❌ UI feedback (future work)

## Acceptance Criteria

**Must Have:**

- ✅ All three condition files created and validate against condition schema
- ✅ All three rule files created and validate against rule schema
- ✅ Conditions and rules added to mod manifest (alphabetically sorted)
- ✅ Eat rule calls CONSUME_ITEM with correct parameters
- ✅ Drink rule calls CONSUME_ITEM with correct parameters
- ✅ Rest rule resets energy to max_energy
- ✅ Rest rule resets metabolic_efficiency_multiplier to 1.0
- ✅ All rules use `core:logSuccessAndEndTurn` macro
- ✅ All rules set up required context variables (logMessage, perceptionType, locationId, targetId)
- ✅ All rules dispatch perceptible events via macro
- ✅ Rules trigger only for their specific action IDs
- ✅ No schema validation errors
- ✅ Mod loads successfully with all rules and conditions
- ✅ Integration tests verify event dispatching and turn ending

**Nice to Have:**

- Consider: Different rest durations with varying energy amounts
- Consider: Activity multiplier boost system with duration tracking

## Testing Strategy

### Integration Tests (3 new test suites)

**tests/integration/mods/metabolism/handleEatFood.integration.test.js:**

- Verify CONSUME_ITEM called with correct parameters
- Verify perceptible_event dispatched with food_consumed type
- Verify display_successful_action_result dispatched
- Verify action_success dispatched
- Verify turn ended with success: true
- Verify message format: "{actorName} eats {itemName}."

**tests/integration/mods/metabolism/handleDrinkBeverage.integration.test.js:**

- Verify CONSUME_ITEM called with correct parameters
- Verify perceptible_event dispatched with drink_consumed type
- Verify display_successful_action_result dispatched
- Verify action_success dispatched
- Verify turn ended with success: true
- Verify message format: "{actorName} drinks {itemName}."

**tests/integration/mods/metabolism/handleRest.integration.test.js:**

- Verify current_energy reset to max_energy
- Verify metabolic_efficiency_multiplier reset to 1.0
- Verify perceptible_event dispatched with rest_action type
- Verify display_successful_action_result dispatched
- Verify action_success dispatched
- Verify turn ended with success: true
- Verify message format: "{actorName} rests and recovers energy."

### Manual Validation

1. **Schema Validation:**

   ```bash
   npm run validate
   ```

2. **Mod Loading:**

   ```bash
   npm run start
   # Verify metabolism mod loads without errors
   ```

3. **Rule Execution:**
   ```bash
   npm run test:integration -- tests/integration/mods/metabolism/
   ```

### Verification Commands

```bash
# Validate all schemas
npm run validate

# Check mod manifest includes all files
cat data/mods/metabolism/mod-manifest.json | grep -A 10 "conditions\|rules"

# Verify files exist
ls -la data/mods/metabolism/conditions/event-is-action-*.condition.json
ls -la data/mods/metabolism/rules/handle_*.rule.json

# Run integration tests
npm run test:integration -- tests/integration/mods/metabolism/
```

## Invariants

**Rule Behavior:**

1. Rules must only trigger for their specific action ID
2. CONSUME_ITEM must receive correct entity references
3. Perceptible events must always be dispatched (via macro)
4. Turn must always end after action execution (via macro)
5. Context variables must be set before macro invocation

**Event Flow (Corrected):**

```
core:attempt_action
  ↓
Rule Condition Check (condition_ref)
  ↓
Execute Operations (CONSUME_ITEM or MODIFY_COMPONENT)
  ↓
Query/Get Context (position, names)
  ↓
Set Variables (logMessage, perceptionType, locationId, targetId)
  ↓
Invoke Macro: core:logSuccessAndEndTurn
  ├─ GET_TIMESTAMP
  ├─ DISPATCH_PERCEPTIBLE_EVENT (for observers)
  ├─ DISPATCH_EVENT (core:display_successful_action_result)
  ├─ DISPATCH_EVENT (core:action_success)
  └─ END_TURN (success: true)
```

**Data Integrity:**

- Eat/Drink: Food item must exist before consumption
- Rest: metabolic_store and fuel_converter must exist
- All: Entity references must resolve correctly
- Macro expects: logMessage, perceptionType, locationId in context

## Edge Cases

1. **Missing Components:**
   - Handled by CONSUME_ITEM operation validation
   - Operation dispatches error events via safeEventDispatcher
   - No rule-level IF branching needed

2. **Invalid Item:**
   - Handled by CONSUME_ITEM fuel tag validation
   - Will dispatch error and reject if fuel tags don't match

3. **Full Stomach:**
   - Handled by CONSUME_ITEM capacity checking
   - Will dispatch error and reject if buffer + item.bulk > capacity

4. **Missing Metabolic Store (Rest):**
   - QUERY_COMPONENT will fail if component missing
   - Should be validated during entity creation

## References

- **Spec:** Section "Action Integration" (p. 18-20)
- **Spec:** Section "Mod Structure" (p. 11-12)
- **Previous:** HUNMETSYS-005 (CONSUME_ITEM handler)
- **Previous:** HUNMETSYS-008 (Action definitions)
- **Next:** HUNMETSYS-010 (Sample food entities)
- **Pattern:** `data/mods/items/rules/handle_pick_up_item.rule.json` (validation example)
- **Pattern:** `data/mods/affection/rules/handle_pat_head_affectionately.rule.json` (simple action)

## Notes

- Rest mechanic resets energy to maximum (not fixed amount)
- Rest resets metabolic efficiency to baseline (not boost)
- Eat and drink are functionally identical (both call CONSUME_ITEM)
- All actions follow consistent perception logging pattern via macro
- CONSUME_ITEM handles its own error dispatching (no IF branches needed in rules)
- Condition files are required (not inline conditions)
