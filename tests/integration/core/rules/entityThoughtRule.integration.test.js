/**
 * @file Integration tests for the core entity_thought rule.
 */

import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import entityThoughtRule from '../../../../data/mods/core/rules/entity_thought.rule.json';
import logPerceptibleEventsRule from '../../../../data/mods/core/rules/log_perceptible_events.rule.json';
import QueryComponentsHandler from '../../../../src/logic/operationHandlers/queryComponentsHandler.js';
import GetTimestampHandler from '../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchPerceptibleEventHandler from '../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import DispatchThoughtHandler from '../../../../src/logic/operationHandlers/dispatchThoughtHandler.js';
import AddPerceptionLogEntryHandler from '../../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import { ENTITY_THOUGHT_ID } from '../../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';
import RecipientRoutingPolicyService from '../../../../src/perception/services/recipientRoutingPolicyService.js';
import RecipientSetBuilder from '../../../../src/perception/services/recipientSetBuilder.js';
import PerceptionEntryBuilder from '../../../../src/perception/services/perceptionEntryBuilder.js';
import SensorialPropagationService from '../../../../src/perception/services/sensorialPropagationService.js';

const createPerceiver = (id, locationId, name) => ({
  id,
  components: {
    'core:name': { text: name },
    'core:position': { locationId },
    'core:perception_log': { maxEntries: 10, logEntries: [] },
  },
});

/**
 * Creates handlers needed for the entity_thought rule.
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

  const routingPolicyService = new RecipientRoutingPolicyService({
    dispatcher: safeDispatcher,
    logger,
  });

  const recipientSetBuilder = new RecipientSetBuilder({
    entityManager,
    logger,
  });

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
      routingPolicyService,
      recipientSetBuilder,
    }),
    DISPATCH_THOUGHT: new DispatchThoughtHandler({
      dispatcher: eventBus,
      logger,
    }),
    ADD_PERCEPTION_LOG_ENTRY: new AddPerceptionLogEntryHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
      routingPolicyService,
      perceptionEntryBuilder: new PerceptionEntryBuilder({ logger }),
      sensorialPropagationService: new SensorialPropagationService({
        entityManager,
        recipientSetBuilder,
        logger,
      }),
    }),
  };
}

describe('core_handle_entity_thought rule integration', () => {
  let testEnv;

  beforeEach(() => {
    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([entityThoughtRule, logPerceptibleEventsRule]),
      getConditionDefinition: jest.fn(() => undefined),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [entityThoughtRule, logPerceptibleEventsRule],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('excludes thinker from lost-in-thought perception log', async () => {
    const thinkerId = 'thinker1';
    const observerId = 'observer1';
    const locationId = 'room1';
    const thoughtText = 'I should be careful.';

    testEnv.reset([
      createPerceiver(thinkerId, locationId, 'Thinker'),
      createPerceiver(observerId, locationId, 'Observer'),
    ]);

    await testEnv.eventBus.dispatch(ENTITY_THOUGHT_ID, {
      entityId: thinkerId,
      thoughts: thoughtText,
    });

    const thinkerLog = testEnv.entityManager.getComponentData(
      thinkerId,
      'core:perception_log'
    );
    const observerLog = testEnv.entityManager.getComponentData(
      observerId,
      'core:perception_log'
    );

    const observerEntry = observerLog.logEntries.find(
      (entry) => entry.descriptionText === 'Thinker is lost in thought.'
    );
    const thinkerEntry = thinkerLog.logEntries.find(
      (entry) => entry.descriptionText === 'Thinker is lost in thought.'
    );

    expect(observerEntry).toBeDefined();
    expect(thinkerEntry).toBeUndefined();
  });
});
