import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { PerceptionLogProvider } from '../../../src/data/providers/perceptionLogProvider.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';
import Entity from '../../../src/entities/entity.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { PERCEPTION_LOG_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { DEFAULT_FALLBACK_EVENT_DESCRIPTION_RAW } from '../../../src/constants/textDefaults.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createEventInfrastructure = (logger) => {
  const registry = new InMemoryDataRegistry({ logger });
  registry.setEventDefinition(SYSTEM_ERROR_OCCURRED_ID, {
    id: SYSTEM_ERROR_OCCURRED_ID,
    description: 'System error notification',
  });

  const gameDataRepository = new GameDataRepository(registry, logger);
  const schemaValidator = new AjvSchemaValidator({ logger });
  const eventBus = new EventBus({ logger });
  const validatedDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository,
    schemaValidator,
    logger,
  });

  const safeDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher: validatedDispatcher,
    logger,
  });

  return { safeDispatcher, eventBus };
};

const createActor = (logger, overrides = {}) => {
  const definition = new EntityDefinition('test:actor', {
    description: 'Test actor',
    components: {},
  });

  const instanceData = new EntityInstanceData(
    'actor-1',
    definition,
    overrides,
    logger
  );

  return new Entity(instanceData);
};

describe('PerceptionLogProvider integration', () => {
  let logger;
  let provider;
  let safeDispatcher;

  beforeEach(() => {
    logger = createLogger();
    ({ safeDispatcher } = createEventInfrastructure(logger));
    provider = new PerceptionLogProvider();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns normalized perception log entries with fallbacks', async () => {
    const overrides = {
      [PERCEPTION_LOG_COMPONENT_ID]: {
        logEntries: [
          {
            descriptionText: 'Noticed movement',
            timestamp: 123,
            perceptionType: 'visual',
          },
          {
            // Missing fields should fall back to defaults
          },
        ],
      },
    };

    const actor = createActor(logger, overrides);
    const before = Date.now();
    const entries = await provider.get(actor, logger, safeDispatcher);
    const after = Date.now();

    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      descriptionText: 'Noticed movement',
      timestamp: 123,
      perceptionType: 'visual',
    });

    expect(entries[1].descriptionText).toBe(
      DEFAULT_FALLBACK_EVENT_DESCRIPTION_RAW
    );
    expect(entries[1].perceptionType).toBe('unknown');
    expect(typeof entries[1].timestamp).toBe('number');
    expect(entries[1].timestamp).toBeGreaterThanOrEqual(before);
    expect(entries[1].timestamp).toBeLessThanOrEqual(after);
  });

  it('returns an empty array when no perception log component exists', async () => {
    const actor = createActor(logger);
    const entries = await provider.get(actor, logger, safeDispatcher);
    expect(entries).toEqual([]);
  });

  it('dispatches a system error event when retrieval fails', async () => {
    const overrides = {
      [PERCEPTION_LOG_COMPONENT_ID]: {
        logEntries: [
          {
            descriptionText: 'Initial entry',
            timestamp: 500,
            perceptionType: 'auditory',
          },
        ],
      },
    };

    const actor = createActor(logger, overrides);
    const error = new Error('Component access failed');
    actor.getComponentData = () => {
      throw error;
    };

    const dispatchedEvents = [];
    const unsubscribe = safeDispatcher.subscribe(
      SYSTEM_ERROR_OCCURRED_ID,
      (event) => {
        dispatchedEvents.push(event);
      }
    );

    const entries = await provider.get(actor, logger, safeDispatcher);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(entries).toEqual([]);
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0]).toMatchObject({
      type: SYSTEM_ERROR_OCCURRED_ID,
      payload: {
        message: expect.stringContaining(
          'PerceptionLogProvider: Error retrieving perception log'
        ),
        details: {
          error,
        },
      },
    });

    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
  });
});
