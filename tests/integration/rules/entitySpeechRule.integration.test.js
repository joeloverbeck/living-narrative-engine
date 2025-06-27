/**
 * @file Integration tests for the core entity_speech rule.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import entitySpeechRule from '../../../data/mods/core/rules/entity_speech.rule.json';
import QueryComponentsHandler from '../../../src/logic/operationHandlers/queryComponentsHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import DispatchSpeechHandler from '../../../src/logic/operationHandlers/dispatchSpeechHandler.js';
import { ENTITY_SPOKE_ID } from '../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';

/**
 * Creates handlers needed for the entity_speech rule.
 *
 * @param {object} entityManager - Entity manager instance
 * @param {object} eventBus - Event bus instance
 * @param {object} logger - Logger instance
 * @returns {object} Handlers object
 */
function createHandlers(entityManager, eventBus, logger) {
  const safeDispatcher = {
    dispatch: jest.fn(() => Promise.resolve(true)),
  };

  return {
    QUERY_COMPONENTS: new QueryComponentsHandler({
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
    DISPATCH_SPEECH: new DispatchSpeechHandler({
      dispatcher: eventBus,
      logger,
    }),
  };
}

describe('core_handle_entity_speech rule integration', () => {
  let testEnv;

  beforeEach(() => {
    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([entitySpeechRule]),
      getConditionDefinition: jest.fn(() => undefined),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [entitySpeechRule],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('dispatches perceptible event when entity speaks', () => {
    testEnv.reset([
      {
        id: 'speaker1',
        components: {
          'core:name': { text: 'Speaker' },
          'core:position': { locationId: 'room1' },
        },
      },
    ]);

    testEnv.eventBus.dispatch(ENTITY_SPOKE_ID, {
      entityId: 'speaker1',
      speechContent: 'Hello, world!',
    });

    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toContain('core:perceptible_event');
  });
});
