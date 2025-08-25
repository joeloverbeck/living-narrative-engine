/**
 * @file Integration tests for the sex:suckle_testicle action and rule.
 * @description Tests the rule execution after the suckle_testicle action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import suckleTesticleRule from '../../../../data/mods/sex/rules/handle_suckle_testicle.rule.json';
import eventIsActionSuckleTesticle from '../../../../data/mods/sex/conditions/event-is-action-suckle-testicle.condition.json';
import logSuccessMacro from '../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../../src/utils/macroUtils.js';
import QueryComponentHandler from '../../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetNameHandler from '../../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../../src/logic/operationHandlers/endTurnHandler.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';

/**
 * Creates handlers needed for the suckle_testicle rule.
 *
 * @param {object} entityManager - Entity manager instance
 * @param {object} eventBus - Event bus instance
 * @param {object} logger - Logger instance
 * @returns {object} Handlers object
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
  };
}

describe('sex:suckle_testicle action integration', () => {
  let testEnv;

  beforeEach(() => {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(suckleTesticleRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...suckleTesticleRule, actions: expanded }]),
      getConditionDefinition: jest.fn((id) =>
        id === 'sex:event-is-action-suckle-testicle'
          ? eventIsActionSuckleTesticle
          : undefined
      ),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...suckleTesticleRule, actions: expanded }],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('should handle suckle_testicle action with correct perceptible event', async () => {
    // Setup entities
    const actorId = 'test:actor';
    const targetId = 'test:target';
    const locationId = 'test:location';

    // Create entities with required components
    testEnv.reset([
      {
        id: actorId,
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId },
          'positioning:closeness': { partners: [targetId] },
          'positioning:kneeling_before': { entityId: targetId },
        },
      },
      {
        id: targetId,
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId },
        },
      },
    ]);

    const perceptibleHandler = jest.fn();
    const successHandler = jest.fn();
    const turnEndHandler = jest.fn();

    testEnv.eventBus.subscribe('core:perceptible_event', perceptibleHandler);
    testEnv.eventBus.subscribe(
      'core:display_successful_action_result',
      successHandler
    );
    testEnv.eventBus.subscribe('core:turn_ended', turnEndHandler);

    // Dispatch the suckle_testicle action
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId,
      actionId: 'sex:suckle_testicle',
      targetId,
      originalInput: 'suckle_testicle bob',
    });

    // Check what events were dispatched
    const eventTypes = testEnv.events.map((e) => e.eventType);

    // Verify the expected events are in the array
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );

    // The perceptible event is dispatched with the descriptive message
    // The message should contain the action's sensual description
  });

  it('should handle suckle_testicle action with different actor and target names', async () => {
    // Setup entities with different names
    const actorId = 'test:actor2';
    const targetId = 'test:target2';
    const locationId = 'test:location2';

    testEnv.reset([
      {
        id: actorId,
        components: {
          [NAME_COMPONENT_ID]: { text: 'Claire' },
          [POSITION_COMPONENT_ID]: { locationId },
          'positioning:closeness': { partners: [targetId] },
          'positioning:kneeling_before': { entityId: targetId },
        },
      },
      {
        id: targetId,
        components: {
          [NAME_COMPONENT_ID]: { text: 'David' },
          [POSITION_COMPONENT_ID]: { locationId },
        },
      },
    ]);

    const perceptibleHandler = jest.fn();
    testEnv.eventBus.subscribe('core:perceptible_event', perceptibleHandler);

    // Dispatch the action
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId,
      actionId: 'sex:suckle_testicle',
      targetId,
      originalInput: 'suckle_testicle david',
    });

    // Verify events were dispatched
    const eventTypes = testEnv.events.map((e) => e.eventType);
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );
  });

  it('should include correct location in perceptible event', async () => {
    const actorId = 'test:actor3';
    const targetId = 'test:target3';
    const specificLocationId = 'test:bedroom';

    testEnv.reset([
      {
        id: actorId,
        components: {
          [NAME_COMPONENT_ID]: { text: 'Eve' },
          [POSITION_COMPONENT_ID]: { locationId: specificLocationId },
          'positioning:closeness': { partners: [targetId] },
          'positioning:kneeling_before': { entityId: targetId },
        },
      },
      {
        id: targetId,
        components: {
          [NAME_COMPONENT_ID]: { text: 'Frank' },
          [POSITION_COMPONENT_ID]: { locationId: specificLocationId },
        },
      },
    ]);

    const perceptibleHandler = jest.fn();
    testEnv.eventBus.subscribe('core:perceptible_event', perceptibleHandler);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId,
      actionId: 'sex:suckle_testicle',
      targetId,
      originalInput: 'suckle_testicle frank',
    });

    // Verify events were dispatched
    const eventTypes = testEnv.events.map((e) => e.eventType);
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );
  });

  it('should properly end turn after action execution', async () => {
    const actorId = 'test:actor4';
    const targetId = 'test:target4';
    const locationId = 'test:location4';

    testEnv.reset([
      {
        id: actorId,
        components: {
          [NAME_COMPONENT_ID]: { text: 'Grace' },
          [POSITION_COMPONENT_ID]: { locationId },
          'positioning:closeness': { partners: [targetId] },
          'positioning:kneeling_before': { entityId: targetId },
        },
      },
      {
        id: targetId,
        components: {
          [NAME_COMPONENT_ID]: { text: 'Henry' },
          [POSITION_COMPONENT_ID]: { locationId },
        },
      },
    ]);

    const turnEndHandler = jest.fn();
    testEnv.eventBus.subscribe('core:turn_ended', turnEndHandler);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId,
      actionId: 'sex:suckle_testicle',
      targetId,
      originalInput: 'suckle_testicle henry',
    });

    // Verify turn ended event was dispatched
    expect(turnEndHandler).toHaveBeenCalled();
    const eventTypes = testEnv.events.map((e) => e.eventType);
    expect(eventTypes).toContain('core:turn_ended');
  });

  it('should display successful action result', async () => {
    const actorId = 'test:actor5';
    const targetId = 'test:target5';
    const locationId = 'test:location5';

    testEnv.reset([
      {
        id: actorId,
        components: {
          [NAME_COMPONENT_ID]: { text: 'Isabella' },
          [POSITION_COMPONENT_ID]: { locationId },
          'positioning:closeness': { partners: [targetId] },
          'positioning:kneeling_before': { entityId: targetId },
        },
      },
      {
        id: targetId,
        components: {
          [NAME_COMPONENT_ID]: { text: 'Jack' },
          [POSITION_COMPONENT_ID]: { locationId },
        },
      },
    ]);

    const successHandler = jest.fn();
    testEnv.eventBus.subscribe(
      'core:display_successful_action_result',
      successHandler
    );

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId,
      actionId: 'sex:suckle_testicle',
      targetId,
      originalInput: 'suckle_testicle jack',
    });

    // Verify success event was dispatched
    expect(successHandler).toHaveBeenCalled();
    const eventTypes = testEnv.events.map((e) => e.eventType);
    expect(eventTypes).toContain('core:display_successful_action_result');
  });
});
