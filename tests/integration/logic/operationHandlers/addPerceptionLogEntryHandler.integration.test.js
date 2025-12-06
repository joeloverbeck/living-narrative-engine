import { describe, test, expect, jest } from '@jest/globals';

import EventBus from '../../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import GameDataRepository from '../../../../src/data/gameDataRepository.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import AddPerceptionLogEntryHandler from '../../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/systemEventIds.js';
import { PERCEPTION_LOG_COMPONENT_ID } from '../../../../src/constants/componentIds.js';
import { SimpleEntityManager } from '../../../common/entities/index.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const registerSystemErrorEvent = (registry) => {
  registry.store('events', SYSTEM_ERROR_OCCURRED_ID, {
    id: SYSTEM_ERROR_OCCURRED_ID,
    name: 'System Error Occurred',
    payloadSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        details: { type: 'object' },
      },
    },
  });
};

const createIntegrationHarness = (entityManager) => {
  const logger = createLogger();
  const eventBus = new EventBus({ logger });
  const dataRegistry = new InMemoryDataRegistry({ logger });
  registerSystemErrorEvent(dataRegistry);
  const gameDataRepository = new GameDataRepository(dataRegistry, logger);
  const schemaValidator = new AjvSchemaValidator({ logger });
  const validatedEventDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository,
    schemaValidator,
    logger,
  });
  const safeEventDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher,
    logger,
  });

  const recordedErrors = [];
  const unsubscribeErrors =
    safeEventDispatcher.subscribe(SYSTEM_ERROR_OCCURRED_ID, (event) => {
      recordedErrors.push(event);
    }) || (() => {});

  const handler = new AddPerceptionLogEntryHandler({
    logger,
    entityManager,
    safeEventDispatcher,
  });

  const flushAsync = async () => {
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
  };

  return {
    logger,
    entityManager,
    safeEventDispatcher,
    handler,
    recordedErrors,
    unsubscribeErrors,
    flushAsync,
  };
};

const baseEntry = {
  descriptionText: 'A distant bell chimes.',
  timestamp: '2024-05-01T12:00:00.000Z',
  perceptionType: 'ambient_sound',
  actorId: 'npc:bell-ringer',
  targetId: 'structure:bell-tower',
};

describe('AddPerceptionLogEntryHandler integration', () => {
  test('dispatches system error events for invalid parameters', async () => {
    const entityManager = new SimpleEntityManager();
    const env = createIntegrationHarness(entityManager);

    try {
      await env.handler.execute(/** @type {any} */ (null));
      await env.flushAsync();
      expect(env.recordedErrors[0]?.payload.message).toContain(
        'ADD_PERCEPTION_LOG_ENTRY: params missing or invalid.'
      );

      await env.handler.execute({
        location_id: '',
        entry: { ...baseEntry },
      });
      await env.flushAsync();
      expect(env.recordedErrors[1]?.payload.message).toContain(
        'ADD_PERCEPTION_LOG_ENTRY: location_id is required'
      );

      await env.handler.execute({
        location_id: 'observatory',
        entry: /** @type {any} */ (null),
      });
      await env.flushAsync();
      expect(env.recordedErrors[2]?.payload.message).toContain(
        'ADD_PERCEPTION_LOG_ENTRY: entry object is required'
      );

      expect(
        entityManager.getComponentData('ghost', PERCEPTION_LOG_COMPONENT_ID)
      ).toBeNull();
    } finally {
      env.unsubscribeErrors();
    }
  });

  test('targets explicit recipients, repairs corrupted data, and reports batch errors', async () => {
    class InstrumentedEntityManager extends SimpleEntityManager {
      constructor(entities) {
        super(entities);
      }

      async batchAddComponentsOptimized(componentSpecs, emitBatchEvent) {
        const result = await super.batchAddComponentsOptimized(
          componentSpecs,
          emitBatchEvent
        );
        const errors =
          componentSpecs.length > 1
            ? [
                {
                  spec: componentSpecs[1],
                  error: new Error('write failed'),
                },
              ]
            : [];
        return { ...result, errors };
      }
    }

    const entityManager = new InstrumentedEntityManager([
      {
        id: 'perceiver-1',
        components: {
          [PERCEPTION_LOG_COMPONENT_ID]: {
            maxEntries: 1,
            logEntries: ['older event'],
          },
        },
      },
      {
        id: 'perceiver-2',
        components: {
          [PERCEPTION_LOG_COMPONENT_ID]: {
            maxEntries: 'corrupt',
            logEntries: 'not-an-array',
          },
        },
      },
    ]);

    const env = createIntegrationHarness(entityManager);

    try {
      await env.handler.execute(
        {
          location_id: 'bell-tower',
          entry: { ...baseEntry },
          recipient_ids: ['  perceiver-1  ', 'perceiver-2', 'missing-entity'],
          excluded_actor_ids: ['  other-npc  '],
        },
        {}
      );

      await env.flushAsync();

      expect(
        env.logger.warn.mock.calls.some(([message]) =>
          String(message).includes(
            'ADD_PERCEPTION_LOG_ENTRY: recipientIds and excludedActorIds both provided; using recipientIds only'
          )
        )
      ).toBe(true);

      const updatedOne = entityManager.getComponentData(
        'perceiver-1',
        PERCEPTION_LOG_COMPONENT_ID
      );
      expect(updatedOne?.logEntries).toEqual([{ ...baseEntry }]);
      expect(updatedOne?.maxEntries).toBe(1);

      const updatedTwo = entityManager.getComponentData(
        'perceiver-2',
        PERCEPTION_LOG_COMPONENT_ID
      );
      expect(updatedTwo?.logEntries).toEqual([{ ...baseEntry }]);
      expect(updatedTwo?.maxEntries).toBe(50);

      expect(
        entityManager.getComponentData(
          'missing-entity',
          PERCEPTION_LOG_COMPONENT_ID
        )
      ).toBeNull();

      expect(
        env.logger.debug.mock.calls.some(([message]) =>
          message.includes('perceivers (targeted) (batch mode)')
        )
      ).toBe(true);

      expect(
        env.recordedErrors.some((event) =>
          event.payload.message.includes(
            'failed to update perceiver-2: write failed'
          )
        )
      ).toBe(true);
    } finally {
      env.unsubscribeErrors();
    }
  });

  test('broadcasts to location residents when batch API is unavailable', async () => {
    class LegacyEntityManager extends SimpleEntityManager {
      constructor(entities) {
        super(entities);
        this.batchAddComponentsOptimized = undefined;
        this.addCalls = [];
      }

      async addComponent(instanceId, componentTypeId, componentData) {
        this.addCalls.push({ instanceId, componentTypeId, componentData });
        return super.addComponent(instanceId, componentTypeId, componentData);
      }
    }

    const entityManager = new LegacyEntityManager([
      {
        id: 'resident-alpha',
        components: {
          'core:position': { locationId: 'lobby' },
          [PERCEPTION_LOG_COMPONENT_ID]: { maxEntries: 3, logEntries: [] },
        },
      },
      {
        id: 'resident-beta',
        components: {
          'core:position': { locationId: 'lobby' },
          [PERCEPTION_LOG_COMPONENT_ID]: { maxEntries: 3, logEntries: [] },
        },
      },
      {
        id: 'resident-gamma',
        components: {
          'core:position': { locationId: 'lobby' },
          [PERCEPTION_LOG_COMPONENT_ID]: { maxEntries: 3, logEntries: [] },
        },
      },
    ]);

    const env = createIntegrationHarness(entityManager);

    try {
      await env.handler.execute(
        {
          location_id: 'lobby',
          entry: { ...baseEntry },
          excluded_actor_ids: [' resident-beta '],
        },
        {}
      );

      await env.flushAsync();

      expect(entityManager.addCalls.map((call) => call.instanceId)).toEqual([
        'resident-alpha',
        'resident-gamma',
      ]);

      expect(
        env.logger.debug.mock.calls.some(([message]) =>
          message.includes('perceivers in lobby')
        )
      ).toBe(true);

      expect(
        entityManager.getComponentData(
          'resident-beta',
          PERCEPTION_LOG_COMPONENT_ID
        )?.logEntries
      ).toEqual([]);
    } finally {
      env.unsubscribeErrors();
    }
  });

  test('falls back to per-entity updates when optimized batch fails', async () => {
    class FlakyEntityManager extends SimpleEntityManager {
      constructor(entities) {
        super(entities);
      }

      async batchAddComponentsOptimized() {
        throw new Error('batch exploded');
      }

      async addComponent(instanceId, componentTypeId, componentData) {
        if (instanceId === 'observer-2') {
          throw new Error('write fail');
        }
        return super.addComponent(instanceId, componentTypeId, componentData);
      }
    }

    const entityManager = new FlakyEntityManager([
      {
        id: 'observer-1',
        components: {
          'core:position': { locationId: 'plaza' },
          [PERCEPTION_LOG_COMPONENT_ID]: { maxEntries: 2, logEntries: [] },
        },
      },
      {
        id: 'observer-2',
        components: {
          'core:position': { locationId: 'plaza' },
          [PERCEPTION_LOG_COMPONENT_ID]: { maxEntries: 2, logEntries: [] },
        },
      },
    ]);

    const env = createIntegrationHarness(entityManager);

    try {
      await env.handler.execute(
        {
          location_id: 'plaza',
          entry: { ...baseEntry },
        },
        {}
      );

      await env.flushAsync();

      expect(
        env.logger.error.mock.calls.some(([message]) =>
          message.includes('ADD_PERCEPTION_LOG_ENTRY: Batch update failed')
        )
      ).toBe(true);

      expect(
        env.logger.debug.mock.calls.some(([message]) =>
          message.includes('(fallback mode)')
        )
      ).toBe(true);

      expect(
        env.recordedErrors.some((event) =>
          event.payload.message.includes(
            'failed to update observer-2: write fail'
          )
        )
      ).toBe(true);

      expect(
        entityManager.getComponentData(
          'observer-1',
          PERCEPTION_LOG_COMPONENT_ID
        )?.logEntries
      ).toEqual([{ ...baseEntry }]);

      expect(
        entityManager.getComponentData(
          'observer-2',
          PERCEPTION_LOG_COMPONENT_ID
        )?.logEntries
      ).toEqual([]);
    } finally {
      env.unsubscribeErrors();
    }
  });

  test('logs informative messages when no perceivers are updated', async () => {
    const entityManager = new SimpleEntityManager([
      {
        id: 'warehouse-guard',
        components: {
          'core:position': { locationId: 'warehouse' },
        },
      },
    ]);

    const env = createIntegrationHarness(entityManager);

    try {
      await env.handler.execute(
        {
          location_id: 'warehouse',
          entry: { ...baseEntry },
        },
        {}
      );
      await env.flushAsync();
      expect(
        env.logger.debug.mock.calls.some(([message]) =>
          message.includes('No perceivers found in location warehouse')
        )
      ).toBe(true);

      env.logger.debug.mockClear();

      await env.handler.execute(
        {
          location_id: 'warehouse',
          entry: { ...baseEntry },
          excluded_actor_ids: ['warehouse-guard'],
        },
        {}
      );
      await env.flushAsync();
      expect(
        env.logger.debug.mock.calls.some(([message]) =>
          message.includes('All actors excluded for warehouse')
        )
      ).toBe(true);

      env.logger.debug.mockClear();

      await env.handler.execute(
        {
          location_id: 'empty-room',
          entry: { ...baseEntry },
        },
        {}
      );
      await env.flushAsync();
      expect(
        env.logger.debug.mock.calls.some(([message]) =>
          message.includes('No entities in location empty-room')
        )
      ).toBe(true);
    } finally {
      env.unsubscribeErrors();
    }
  });
});
