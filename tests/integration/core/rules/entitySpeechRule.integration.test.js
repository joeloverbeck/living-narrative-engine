/**
 * @file Integration tests for the core entity_speech rule.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import entitySpeechRule from '../../../../data/mods/core/rules/entity_speech.rule.json';
import logPerceptibleEventsRule from '../../../../data/mods/core/rules/log_perceptible_events.rule.json';
import QueryComponentsHandler from '../../../../src/logic/operationHandlers/queryComponentsHandler.js';
import GetTimestampHandler from '../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchPerceptibleEventHandler from '../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import DispatchSpeechHandler from '../../../../src/logic/operationHandlers/dispatchSpeechHandler.js';
import AddPerceptionLogEntryHandler from '../../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import { ENTITY_SPOKE_ID } from '../../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';
import { deepClone } from '../../../../src/utils/cloneUtils.js';
import RecipientRoutingPolicyService from '../../../../src/perception/services/recipientRoutingPolicyService.js';
import RecipientSetBuilder from '../../../../src/perception/services/recipientSetBuilder.js';
import accessPointDefinition from '../../../../data/mods/dredgers/entities/definitions/access_point_segment_a.location.json';
import segmentBDefinition from '../../../../data/mods/dredgers/entities/definitions/segment_b.location.json';
import accessPointInstance from '../../../../data/mods/dredgers/entities/instances/access_point_segment_a.location.json';
import segmentBInstance from '../../../../data/mods/dredgers/entities/instances/segment_b.location.json';

const buildLocationEntity = (definition, instance) => ({
  id: instance.instanceId,
  components: deepClone(definition.components),
});

const createPerceiver = (id, locationId, name) => ({
  id,
  components: {
    'core:name': { text: name },
    'core:position': { locationId },
    'core:perception_log': { maxEntries: 10, logEntries: [] },
  },
});

const ACCESS_POINT_ID = accessPointInstance.instanceId;
const SEGMENT_B_ID = segmentBInstance.instanceId;

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
    DISPATCH_SPEECH: new DispatchSpeechHandler({
      dispatcher: eventBus,
      logger,
    }),
    ADD_PERCEPTION_LOG_ENTRY: new AddPerceptionLogEntryHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
      routingPolicyService,
      recipientSetBuilder,
    }),
  };
}

describe('core_handle_entity_speech rule integration', () => {
  let testEnv;

  beforeEach(() => {
    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([entitySpeechRule, logPerceptibleEventsRule]),
      getConditionDefinition: jest.fn(() => undefined),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [entitySpeechRule, logPerceptibleEventsRule],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('dispatches perceptible event when entity speaks', async () => {
    testEnv.reset([
      {
        id: 'speaker1',
        components: {
          'core:name': { text: 'Speaker' },
          'core:position': { locationId: 'room1' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ENTITY_SPOKE_ID, {
      entityId: 'speaker1',
      speechContent: 'Hello, world!',
    });

    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toContain('core:perceptible_event');
  });

  it('propagates speech logs across sensorial links with origin prefix', async () => {
    const speakerId = 'speaker1';
    const observerId = 'observer1';
    const linkedId = 'linked1';
    const speechContent = 'Hello there.';

    testEnv.reset([
      buildLocationEntity(accessPointDefinition, accessPointInstance),
      buildLocationEntity(segmentBDefinition, segmentBInstance),
      createPerceiver(speakerId, ACCESS_POINT_ID, 'Speaker'),
      createPerceiver(observerId, ACCESS_POINT_ID, 'Observer'),
      createPerceiver(linkedId, SEGMENT_B_ID, 'Listener'),
    ]);

    await testEnv.eventBus.dispatch(ENTITY_SPOKE_ID, {
      entityId: speakerId,
      speechContent,
    });

    const speakerLog = testEnv.entityManager.getComponentData(
      speakerId,
      'core:perception_log'
    );
    const observerLog = testEnv.entityManager.getComponentData(
      observerId,
      'core:perception_log'
    );
    const linkedLog = testEnv.entityManager.getComponentData(
      linkedId,
      'core:perception_log'
    );

    expect(speakerLog.logEntries[0].descriptionText).toBe(
      `I say: "${speechContent}"`
    );
    expect(observerLog.logEntries[0].descriptionText).toBe(
      `Speaker says: "${speechContent}"`
    );
    expect(linkedLog.logEntries[0].descriptionText).toBe(
      `(From access point (segment A)) Speaker says: "${speechContent}"`
    );
  });
});
