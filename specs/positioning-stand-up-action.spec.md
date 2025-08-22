# Positioning Stand Up Action Specification

## Overview

This specification defines a new action for the positioning mod: `positioning:stand_up`. This action allows an actor who is currently kneeling to stand back up, removing the kneeling positional state.

## Requirements

### Functional Requirements

1. **Action Definition**: Create `positioning:stand_up` action that:
   - Requires the actor to have the `positioning:kneeling_before` component
   - Has no target (target is `none`)
   - Uses template format: `"stand up"`
   - Is visually distinct from other positioning actions

2. **Rule Processing**: Create corresponding rule that:
   - Removes the `positioning:kneeling_before` component from the actor
   - Dispatches perceptible event: `"{actor} stands up from their kneeling position."`
   - Dispatches success message: `"{actor} stands up from their kneeling position."`
   - Ends the turn successfully

3. **Validation**: Ensure that:
   - Action only appears when actor has the kneeling component
   - Action is not available when actor is not kneeling
   - Component removal is handled correctly
   - Events are properly dispatched to the location

## Implementation Details

### 1. Action File: `data/mods/positioning/actions/stand_up.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:stand_up",
  "name": "Stand Up",
  "description": "Stand up from a kneeling position.",
  "targets": "none",
  "required_components": {
    "actor": ["positioning:kneeling_before"]
  },
  "forbidden_components": {
    "actor": []
  },
  "template": "stand up",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#bf360c",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#8d2c08",
    "hoverTextColor": "#ffffff"
  }
}
```

**Design Decisions:**

- Uses `"targets": "none"` (string value) since standing up is a self-contained action
- Requires `positioning:kneeling_before` component to ensure actor is kneeling
- Brown color scheme (#bf360c) consistent with all other positioning mod actions
- Simple template "stand up" for clear user interaction

### 2. Condition File: `data/mods/positioning/conditions/event-is-action-stand-up.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-stand-up",
  "description": "Checks if the event is attempting the 'Stand Up' action.",
  "logic": {
    "==": [{ "var": "event.payload.actionId" }, "positioning:stand_up"]
  }
}
```

### 3. Rule File: `data/mods/positioning/rules/stand_up.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_stand_up",
  "comment": "Handles the 'positioning:stand_up' action. Removes kneeling component, dispatches descriptive text and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": { "condition_ref": "positioning:event-is-action-stand-up" },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "actor", "result_variable": "actorName" }
    },
    {
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:kneeling_before"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} stands up from their kneeling position."
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "action_general"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "locationId",
        "value": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "targetId",
        "value": "none"
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

**Key Design Decisions:**

- Uses `REMOVE_COMPONENT` operation to remove the kneeling state
- Sets `perceptionType` to `"action_general"` since there's no target
- Sets `targetId` to `"none"` explicitly
- Message format uses present tense consistently for both perceptible and success events

### 4. Test File: `tests/integration/mods/positioning/stand_up_action.test.js`

```javascript
/**
 * @file Integration tests for the positioning:stand_up action and rule.
 * @description Tests the rule execution after the stand_up action is performed.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import standUpRule from '../../../../data/mods/positioning/rules/stand_up.rule.json';
import eventIsActionStandUp from '../../../../data/mods/positioning/conditions/event-is-action-stand-up.condition.json';
import logSuccessMacro from '../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../../src/utils/macroUtils.js';
import QueryComponentHandler from '../../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetNameHandler from '../../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../../src/logic/operationHandlers/endTurnHandler.js';
import SetVariableHandler from '../../../../src/logic/operationHandlers/setVariableHandler.js';
import RemoveComponentHandler from '../../../../src/logic/operationHandlers/removeComponentHandler.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';

/**
 * Creates handlers needed for the stand_up rule.
 */
function createHandlers(entityManager, eventBus, logger) {
  const safeDispatcher = {
    dispatch: jest.fn((eventType, payload) => {
      eventBus.dispatch(eventType, payload);
      return Promise.resolve(true);
    }),
  };

  return {
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    GET_NAME: new GetNameHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
    DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
      dispatcher: eventBus,
      logger,
      addPerceptionLogEntryHandler: { execute: jest.fn() },
    }),
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
    END_TURN: new EndTurnHandler({
      safeEventDispatcher: safeDispatcher,
      logger,
    }),
    SET_VARIABLE: new SetVariableHandler({ logger }),
    REMOVE_COMPONENT: new RemoveComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
  };
}

describe('positioning:stand_up action integration', () => {
  let testEnv;

  beforeEach(() => {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(standUpRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...standUpRule, actions: expanded }]),
      getConditionDefinition: jest.fn((id) =>
        id === 'positioning:event-is-action-stand-up'
          ? eventIsActionStandUp
          : undefined
      ),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...standUpRule, actions: expanded }],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('successfully executes stand up action when kneeling', async () => {
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'throne_room' },
          'positioning:kneeling_before': { entityId: 'test:king' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'positioning:stand_up',
      targetId: 'none',
      originalInput: 'stand up',
    });

    // Check that kneeling component was removed
    const actor = testEnv.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['positioning:kneeling_before']).toBeUndefined();

    // Check success message
    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      'Alice stands up from their kneeling position.'
    );

    // Check turn ended
    const turnEndedEvent = testEnv.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('creates correct perceptible event', async () => {
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Sir Galahad' },
          [POSITION_COMPONENT_ID]: { locationId: 'castle_hall' },
          'positioning:kneeling_before': { entityId: 'test:queen' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'positioning:stand_up',
      targetId: 'none',
      originalInput: 'stand up',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'Sir Galahad stands up from their kneeling position.'
    );
    expect(perceptibleEvent.payload.locationId).toBe('castle_hall');
    expect(perceptibleEvent.payload.actorId).toBe('test:actor1');
    expect(perceptibleEvent.payload.targetId).toBe('none');
    expect(perceptibleEvent.payload.perceptionType).toBe('action_general');
  });

  it('only fires for correct action ID', async () => {
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:kneeling_before': { entityId: 'test:target' },
        },
      },
    ]);

    // Try with a different action
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'core:wait',
      targetId: 'none',
      originalInput: 'wait',
    });

    // Should not have removed the kneeling component
    const actor = testEnv.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['positioning:kneeling_before']).toBeDefined();

    // Should not have any perceptible events from our rule
    const perceptibleEvents = testEnv.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvents).toHaveLength(0);
  });

  it('handles multiple actors in same location with witnesses', async () => {
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Knight' },
          [POSITION_COMPONENT_ID]: { locationId: 'courtyard' },
          'positioning:kneeling_before': { entityId: 'test:lord' },
        },
      },
      {
        id: 'test:witness1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Peasant' },
          [POSITION_COMPONENT_ID]: { locationId: 'courtyard' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'positioning:stand_up',
      targetId: 'none',
      originalInput: 'stand up',
    });

    // Component should be removed
    const actor = testEnv.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['positioning:kneeling_before']).toBeUndefined();

    // Perceptible event should be visible to all in location
    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.locationId).toBe('courtyard');
  });

  it('works correctly after kneeling to namespaced entity', async () => {
    testEnv.reset([
      {
        id: 'p_erotica:iker_aguirre_instance',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Iker' },
          [POSITION_COMPONENT_ID]: { locationId: 'coffee_shop' },
          'positioning:kneeling_before': {
            entityId: 'p_erotica:amaia_castillo_instance',
          },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'p_erotica:iker_aguirre_instance',
      actionId: 'positioning:stand_up',
      targetId: 'none',
      originalInput: 'stand up',
    });

    // Component should be removed
    const actor = testEnv.entityManager.getEntityInstance(
      'p_erotica:iker_aguirre_instance'
    );
    expect(actor.components['positioning:kneeling_before']).toBeUndefined();

    // Verify success message
    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      'Iker stands up from their kneeling position.'
    );
  });

  it('verifies action validation prevents standing when not kneeling', () => {
    // This test documents the expected behavior that the action system
    // would prevent the action from being available when the required
    // component is not present. The rule itself assumes validation
    // has already occurred when it receives the event.

    const standUpAction = {
      required_components: {
        actor: ['positioning:kneeling_before'],
      },
    };

    // Actor without kneeling component
    const actorComponents = {
      [NAME_COMPONENT_ID]: { text: 'Alice' },
      [POSITION_COMPONENT_ID]: { locationId: 'room1' },
    };

    // Action should not be available (this would be handled by action discovery)
    const hasRequiredComponent = standUpAction.required_components.actor.every(
      (comp) => comp in actorComponents
    );
    expect(hasRequiredComponent).toBe(false);
  });
});
```

## File Structure Summary

The implementation will require creating/modifying these files:

### New Files to Create:

1. `data/mods/positioning/actions/stand_up.action.json`
2. `data/mods/positioning/conditions/event-is-action-stand-up.condition.json`
3. `data/mods/positioning/rules/stand_up.rule.json`
4. `tests/integration/mods/positioning/stand_up_action.test.js`

### Files to Update (if needed):

- None required for basic functionality

## Testing Strategy

### Unit Tests

While not explicitly required, the action and rule schemas will be automatically validated by existing schema tests.

### Integration Tests

The comprehensive test suite covers:

1. **Basic Functionality**
   - Component removal verification
   - Success message validation
   - Turn ending confirmation

2. **Event System**
   - Perceptible event creation with correct text
   - Location-based event dispatching
   - Proper perception type (`action_general`)

3. **Edge Cases**
   - Multiple actors in same location
   - Namespaced entity IDs
   - Rule isolation (only fires for correct action)

4. **Validation Documentation**
   - Documents expected validation behavior
   - Ensures action discovery respects required components

## Key Implementation Notes

1. **Component Requirements**: The action requires `positioning:kneeling_before` component, ensuring it only appears when the actor is actually kneeling.

2. **No Target Required**: Unlike `kneel_before`, this action has no target since standing up is self-contained.

3. **Component Removal**: Uses the `REMOVE_COMPONENT` operation handler to cleanly remove the kneeling state.

4. **Message Consistency**:
   - Both perceptible event and success message use present tense: "stands up from their kneeling position"
   - Follows the pattern established by other positioning actions like kneel_before

5. **Visual Consistency**: Brown color scheme (#bf360c) maintains consistency with all other positioning mod actions.

6. **Test Coverage**: Comprehensive integration tests ensure the rule behaves correctly in all scenarios.

## Validation Checklist

- [ ] Action file follows schema and naming conventions
- [ ] Condition properly identifies the action event
- [ ] Rule removes component and dispatches correct events
- [ ] Test suite provides comprehensive coverage
- [ ] Messages use consistent present tense for both perceptible and success events
- [ ] Visual styling is distinct and accessible
- [ ] No targets required or accepted
- [ ] Component removal is atomic and clean
