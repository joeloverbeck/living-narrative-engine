import { describe, it, expect, beforeEach } from '@jest/globals';
import { dispatchSystemErrorEvent } from '../../../src/utils/systemErrorDispatchUtils.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

class RecordingLogger {
  constructor() {
    this.entries = { debug: [], info: [], warn: [], error: [] };
  }

  debug(...args) {
    this.entries.debug.push(args);
  }

  info(...args) {
    this.entries.info.push(args);
  }

  warn(...args) {
    this.entries.warn.push(args);
  }

  error(...args) {
    this.entries.error.push(args);
  }
}

class TestSchemaValidator {
  constructor() {
    this.schemas = new Map();
  }

  register(schemaId, validationResult) {
    this.schemas.set(schemaId, validationResult);
  }

  isSchemaLoaded(schemaId) {
    return this.schemas.has(schemaId);
  }

  validate(schemaId) {
    const entry = this.schemas.get(schemaId);
    if (!entry) {
      return { isValid: true, errors: [] };
    }
    if (typeof entry === 'function') {
      return entry();
    }
    return {
      isValid: entry.isValid !== false,
      errors: entry.errors || [],
    };
  }
}

const registerEventDefinition = (registry, eventId) => {
  registry.store('events', eventId, {
    id: eventId,
    name: eventId,
    description: 'integration-test-event',
  });
};

const createDispatcherEnvironment = () => {
  const logger = new RecordingLogger();
  const registry = new InMemoryDataRegistry({ logger });
  const repository = new GameDataRepository(registry, logger);
  const schemaValidator = new TestSchemaValidator();
  const eventBus = new EventBus({ logger });
  const dispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: repository,
    schemaValidator,
    logger,
  });

  return {
    logger,
    registry,
    repository,
    schemaValidator,
    eventBus,
    dispatcher,
  };
};

describe('dispatchSystemErrorEvent integration', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('dispatches a system error event through the validated dispatcher infrastructure', async () => {
    const env = createDispatcherEnvironment();
    registerEventDefinition(env.registry, 'core:system_error_occurred');

    const receivedPayloads = [];
    env.dispatcher.subscribe('core:system_error_occurred', (event) => {
      receivedPayloads.push(event.payload);
    });

    const details = { severity: 'critical', code: 'E500' };
    await dispatchSystemErrorEvent(
      env.dispatcher,
      'Disk failure detected',
      details,
      env.logger
    );

    expect(receivedPayloads).toEqual([
      {
        message: 'Disk failure detected',
        details,
      },
    ]);
  });

  it('logs a failure when the dispatcher rejects while preserving original details', async () => {
    const env = createDispatcherEnvironment();
    registerEventDefinition(env.registry, 'core:system_error_occurred');

    const rejection = new Error('simulated dispatch failure');
    const dispatchSpy = jest
      .spyOn(env.dispatcher, 'dispatch')
      .mockRejectedValueOnce(rejection);

    await dispatchSystemErrorEvent(
      env.dispatcher,
      'Renderer crash',
      { scene: 'intro' },
      env.logger
    );

    expect(env.logger.entries.error).toEqual([
      [
        'Failed to dispatch system error event: Renderer crash',
        {
          originalDetails: { scene: 'intro' },
          dispatchError: rejection,
        },
      ],
    ]);

    expect(dispatchSpy).toHaveBeenCalledWith('core:system_error_occurred', {
      message: 'Renderer crash',
      details: { scene: 'intro' },
    });
  });

  it('swallows dispatch failures when no logger is provided', async () => {
    const env = createDispatcherEnvironment();
    registerEventDefinition(env.registry, 'core:system_error_occurred');

    const rejection = new Error('network unreachable');
    jest.spyOn(env.dispatcher, 'dispatch').mockRejectedValueOnce(rejection);

    await dispatchSystemErrorEvent(
      env.dispatcher,
      'Autosave failed',
      { slot: 'auto-1' },
      undefined
    );

    expect(env.logger.entries.error).toEqual([]);
  });
});
