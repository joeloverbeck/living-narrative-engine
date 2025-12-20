/**
 * @file Integration tests for the core log_perceptible_events rule.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import logPerceptibleEventsRule from '../../../../data/mods/core/rules/log_perceptible_events.rule.json';
import GetTimestampHandler from '../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import AddPerceptionLogEntryHandler from '../../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import SetVariableHandler from '../../../../src/logic/operationHandlers/setVariableHandler.js';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../../src/events/eventBus.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import SystemLogicInterpreter from '../../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import RecipientRoutingPolicyService from '../../../../src/perception/services/recipientRoutingPolicyService.js';
import { deepClone } from '../../../../src/utils/cloneUtils.js';
import accessPointDefinition from '../../../../data/mods/dredgers/entities/definitions/access_point_segment_a.location.json';
import segmentBDefinition from '../../../../data/mods/dredgers/entities/definitions/segment_b.location.json';
import segmentCDefinition from '../../../../data/mods/dredgers/entities/definitions/segment_c.location.json';
import floodedApproachDefinition from '../../../../data/mods/dredgers/entities/definitions/flooded_approach.location.json';
import accessPointInstance from '../../../../data/mods/dredgers/entities/instances/access_point_segment_a.location.json';
import segmentBInstance from '../../../../data/mods/dredgers/entities/instances/segment_b.location.json';
import segmentCInstance from '../../../../data/mods/dredgers/entities/instances/segment_c.location.json';
import floodedApproachInstance from '../../../../data/mods/dredgers/entities/instances/flooded_approach.location.json';

const buildLocationEntity = (definition, instance) => ({
  id: instance.instanceId,
  components: deepClone(definition.components),
});

const createPerceiver = (id, locationId) => ({
  id,
  components: {
    'core:position': { locationId },
    'core:perceiver': {},
    'core:perception_log': { maxEntries: 10, logEntries: [] },
  },
});

const ACCESS_POINT_ID = accessPointInstance.instanceId;
const SEGMENT_B_ID = segmentBInstance.instanceId;
const SEGMENT_C_ID = segmentCInstance.instanceId;
const FLOODED_APPROACH_ID = floodedApproachInstance.instanceId;
const DREDGERS_LOCATIONS = [
  buildLocationEntity(accessPointDefinition, accessPointInstance),
  buildLocationEntity(segmentBDefinition, segmentBInstance),
  buildLocationEntity(segmentCDefinition, segmentCInstance),
  buildLocationEntity(floodedApproachDefinition, floodedApproachInstance),
];

/**
 * Creates handlers needed for the log_perceptible_events rule.
 *
 * @param {object} entityManager - Entity manager instance
 * @param {object} eventBus - Event bus instance
 * @param {object} logger - Logger instance
 * @param {object} validatedEventDispatcher - Validated event dispatcher instance
 * @param {object} safeEventDispatcher - Safe event dispatcher instance
 * @param {object} routingPolicyService - Recipient routing policy service instance
 * @returns {object} Handlers object
 */
function createHandlers(
  entityManager,
  eventBus,
  logger,
  validatedEventDispatcher,
  safeEventDispatcher,
  routingPolicyService
) {
  // Ensure entityManager has getEntitiesInLocation for AddPerceptionLogEntryHandler
  if (typeof entityManager.getEntitiesInLocation !== 'function') {
    entityManager.getEntitiesInLocation = () => [];
  }

  return {
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
    SET_VARIABLE: new SetVariableHandler({ logger }),
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
    ADD_PERCEPTION_LOG_ENTRY: new AddPerceptionLogEntryHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeEventDispatcher,
      routingPolicyService,
    }),
  };
}

describe('core_handle_log_perceptible_events rule integration', () => {
  let testEnv;
  let customEntityManager;

  beforeEach(() => {
    customEntityManager = new SimpleEntityManager([]);
    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([logPerceptibleEventsRule]),
      getConditionDefinition: jest.fn(() => undefined),
      getEventDefinition: jest.fn((eventName) => {
        // Return a basic event definition for common events
        const commonEvents = {
          'core:perception_log_entry': { payloadSchema: null },
          'core:system_error_occurred': { payloadSchema: null },
        };
        return commonEvents[eventName] || null;
      }),
    };

    // Use actual ConsoleLogger instead of mock
    const testLogger = new ConsoleLogger('DEBUG');

    // Use actual EventBus instead of mock
    const bus = new EventBus();

    // Create actual schema validator
    const schemaValidator = new AjvSchemaValidator({ logger: testLogger });

    // Create actual ValidatedEventDispatcher
    const validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus: bus,
      gameDataRepository: dataRegistry,
      schemaValidator: schemaValidator,
      logger: testLogger,
    });

    // Create actual SafeEventDispatcher
    const safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedEventDispatcher,
      logger: testLogger,
    });

    // Create recipient routing policy service for recipient/exclusion validation
    const routingPolicyService = new RecipientRoutingPolicyService({
      logger: testLogger,
      dispatcher: safeEventDispatcher,
    });

    // Create JSON logic evaluation service
    const jsonLogic = new JsonLogicEvaluationService({
      logger: testLogger,
      gameDataRepository: dataRegistry,
    });

    // Create operation registry with our custom entity manager
    const operationRegistry = new OperationRegistry({ logger: testLogger });
    const handlers = createHandlers(
      customEntityManager,
      bus,
      testLogger,
      validatedEventDispatcher,
      safeEventDispatcher,
      routingPolicyService
    );
    for (const [type, handler] of Object.entries(handlers)) {
      operationRegistry.register(type, handler.execute.bind(handler));
    }

    const operationInterpreter = new OperationInterpreter({
      logger: testLogger,
      operationRegistry,
    });

    // Create bodyGraphService mock that checks entity components
    const mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(
        (bodyComponent, componentId, propertyPath, expectedValue) => {
          if (!bodyComponent || !bodyComponent.rootEntityId) {
            return { found: false };
          }

          // Check all entities in the manager
          const allEntities = customEntityManager.getAllEntities();
          for (const entity of allEntities) {
            if (entity.components && entity.components[componentId]) {
              const component = entity.components[componentId];
              const actualValue = propertyPath
                ? component[propertyPath]
                : component;
              if (actualValue === expectedValue) {
                return { found: true, partId: entity.id };
              }
            }
          }

          return { found: false };
        }
      ),
    };

    const interpreter = new SystemLogicInterpreter({
      logger: testLogger,
      eventBus: bus,
      dataRegistry: dataRegistry,
      jsonLogicEvaluationService: jsonLogic,
      entityManager: customEntityManager,
      operationInterpreter,
      bodyGraphService: mockBodyGraphService,
    });

    interpreter.initialize();

    // Create a simple event capture mechanism for testing
    const capturedEvents = [];

    // Subscribe to the specific events we want to capture
    const eventsToCapture = [
      'core:perception_log_entry',
      'core:system_error_occurred',
    ];

    eventsToCapture.forEach((eventType) => {
      bus.subscribe(eventType, (event) => {
        capturedEvents.push({ eventType: event.type, payload: event.payload });
      });
    });

    testEnv = {
      eventBus: bus,
      events: capturedEvents,
      operationRegistry,
      operationInterpreter,
      jsonLogic,
      systemLogicInterpreter: interpreter,
      entityManager: customEntityManager,
      logger: testLogger,
      dataRegistry,
      cleanup: () => {
        interpreter.shutdown();
      },
      reset: (newEntities = []) => {
        testEnv.cleanup();
        // Create new entity manager with the new entities
        customEntityManager = new SimpleEntityManager(newEntities);

        // Recreate handlers with the new entity manager
        const newHandlers = createHandlers(
          customEntityManager,
          bus,
          testLogger,
          validatedEventDispatcher,
          safeEventDispatcher,
          routingPolicyService
        );
        const newOperationRegistry = new OperationRegistry({
          logger: testLogger,
        });
        for (const [type, handler] of Object.entries(newHandlers)) {
          newOperationRegistry.register(type, handler.execute.bind(handler));
        }

        const newOperationInterpreter = new OperationInterpreter({
          logger: testLogger,
          operationRegistry: newOperationRegistry,
        });

        // Create bodyGraphService mock for the new interpreter
        const newMockBodyGraphService = {
          hasPartWithComponentValue: jest.fn(
            (bodyComponent, componentId, propertyPath, expectedValue) => {
              if (!bodyComponent || !bodyComponent.rootEntityId) {
                return { found: false };
              }

              // Check all entities in the manager
              const allEntities = customEntityManager.getAllEntities();
              for (const entity of allEntities) {
                if (entity.components && entity.components[componentId]) {
                  const component = entity.components[componentId];
                  const actualValue = propertyPath
                    ? component[propertyPath]
                    : component;
                  if (actualValue === expectedValue) {
                    return { found: true, partId: entity.id };
                  }
                }
              }

              return { found: false };
            }
          ),
        };

        const newInterpreter = new SystemLogicInterpreter({
          logger: testLogger,
          eventBus: bus,
          dataRegistry: dataRegistry,
          jsonLogicEvaluationService: jsonLogic,
          entityManager: customEntityManager,
          operationInterpreter: newOperationInterpreter,
          bodyGraphService: newMockBodyGraphService,
        });

        newInterpreter.initialize();

        // Update test environment
        testEnv.operationRegistry = newOperationRegistry;
        testEnv.operationInterpreter = newOperationInterpreter;
        testEnv.systemLogicInterpreter = newInterpreter;
        testEnv.entityManager = customEntityManager;

        // Clear events
        capturedEvents.length = 0;
      },
    };
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('dispatches perception_log_entry event when perceptible event is received', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:perceiver': {},
          'core:perception_log': { maxEntries: 10, logEntries: [] },
        },
      },
    ]);
    await testEnv.eventBus.dispatch('core:perceptible_event', {
      locationId: 'room1',
      descriptionText: 'Something happened',
      perceptionType: 'state_change_observable',
      actorId: 'actor1',
      targetId: null,
      involvedEntities: [],
      timestamp: new Date().toISOString(),
    });

    // Check the perception log for the entry
    const log = testEnv.entityManager.getComponentData(
      'actor1',
      'core:perception_log'
    );
    const found =
      log &&
      Array.isArray(log.logEntries) &&
      log.logEntries.some((e) => e.descriptionText === 'Something happened');
    expect(found).toBe(true);
  });

  it('propagates perceptible events across dredgers sensorial links with prefix', async () => {
    const originActorId = 'actor-origin';
    const accessActorId = 'actor-access';
    const segmentCActorId = 'actor-segment-c';
    const floodedActorId = 'actor-flooded';
    const descriptionText = 'A voice carries through the grate.';

    testEnv.reset([
      ...DREDGERS_LOCATIONS,
      createPerceiver(originActorId, SEGMENT_B_ID),
      createPerceiver(accessActorId, ACCESS_POINT_ID),
      createPerceiver(segmentCActorId, SEGMENT_C_ID),
      createPerceiver(floodedActorId, FLOODED_APPROACH_ID),
    ]);

    await testEnv.eventBus.dispatch('core:perceptible_event', {
      locationId: SEGMENT_B_ID,
      originLocationId: SEGMENT_B_ID,
      descriptionText,
      perceptionType: 'communication.speech',
      actorId: originActorId,
      targetId: null,
      involvedEntities: [],
      timestamp: new Date().toISOString(),
    });

    const originLog = testEnv.entityManager.getComponentData(
      originActorId,
      'core:perception_log'
    );
    const accessLog = testEnv.entityManager.getComponentData(
      accessActorId,
      'core:perception_log'
    );
    const segmentCLog = testEnv.entityManager.getComponentData(
      segmentCActorId,
      'core:perception_log'
    );
    const floodedLog = testEnv.entityManager.getComponentData(
      floodedActorId,
      'core:perception_log'
    );

    const prefixed = `(From segment B) ${descriptionText}`;
    expect(originLog.logEntries[0].descriptionText).toBe(descriptionText);
    expect(accessLog.logEntries[0].descriptionText).toBe(prefixed);
    expect(segmentCLog.logEntries[0].descriptionText).toBe(prefixed);
    expect(floodedLog.logEntries[0].descriptionText).toBe(prefixed);
  });

  it('skips sensorial propagation when originLocationId differs', async () => {
    const originActorId = 'actor-origin';
    const linkedActorId = 'actor-linked';
    const descriptionText = 'A distant clang echoes.';

    testEnv.reset([
      ...DREDGERS_LOCATIONS,
      createPerceiver(originActorId, SEGMENT_B_ID),
      createPerceiver(linkedActorId, ACCESS_POINT_ID),
    ]);

    await testEnv.eventBus.dispatch('core:perceptible_event', {
      locationId: SEGMENT_B_ID,
      originLocationId: ACCESS_POINT_ID,
      descriptionText,
      perceptionType: 'state_change_observable',
      actorId: originActorId,
      targetId: null,
      involvedEntities: [],
      timestamp: new Date().toISOString(),
    });

    const originLog = testEnv.entityManager.getComponentData(
      originActorId,
      'core:perception_log'
    );
    const linkedLog = testEnv.entityManager.getComponentData(
      linkedActorId,
      'core:perception_log'
    );

    expect(originLog.logEntries).toHaveLength(1);
    expect(originLog.logEntries[0].descriptionText).toBe(descriptionText);
    expect(linkedLog.logEntries).toHaveLength(0);
  });

  it('does not propagate from locations without sensorial links', async () => {
    const originActorId = 'actor-isolated';
    const otherActorId = 'actor-remote';
    const isolatedLocationId = 'test:isolated_location';
    const otherLocationId = 'test:remote_location';
    const descriptionText = 'A whisper goes nowhere.';

    testEnv.reset([
      {
        id: isolatedLocationId,
        components: {
          'core:name': { text: 'isolated room' },
        },
      },
      {
        id: otherLocationId,
        components: {
          'core:name': { text: 'remote room' },
        },
      },
      createPerceiver(originActorId, isolatedLocationId),
      createPerceiver(otherActorId, otherLocationId),
    ]);

    await testEnv.eventBus.dispatch('core:perceptible_event', {
      locationId: isolatedLocationId,
      originLocationId: isolatedLocationId,
      descriptionText,
      perceptionType: 'state_change_observable',
      actorId: originActorId,
      targetId: null,
      involvedEntities: [],
      timestamp: new Date().toISOString(),
    });

    const originLog = testEnv.entityManager.getComponentData(
      originActorId,
      'core:perception_log'
    );
    const otherLog = testEnv.entityManager.getComponentData(
      otherActorId,
      'core:perception_log'
    );

    expect(originLog.logEntries).toHaveLength(1);
    expect(originLog.logEntries[0].descriptionText).toBe(descriptionText);
    expect(otherLog.logEntries).toHaveLength(0);
  });
});
