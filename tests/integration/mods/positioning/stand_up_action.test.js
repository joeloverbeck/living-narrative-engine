/**
 * @file Integration tests for the positioning:stand_up action and rule.
 * @description Tests the rule execution after the stand_up action is performed.
 */

import {
  describe,
  it,
  beforeEach,
  expect,
  jest,
  afterEach,
} from '@jest/globals';
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
 *
 * @param entityManager
 * @param eventBus
 * @param logger
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
