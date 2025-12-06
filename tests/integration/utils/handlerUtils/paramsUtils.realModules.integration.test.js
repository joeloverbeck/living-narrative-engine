import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  assertParamsObject,
  validateStringParam,
} from '../../../../src/utils/handlerUtils/paramsUtils.js';
import ConsoleLogger, {
  LogLevel,
} from '../../../../src/logging/consoleLogger.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import { GameDataRepository } from '../../../../src/data/gameDataRepository.js';
import EventBus from '../../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/systemEventIds.js';

/**
 * Utility to wait for microtasks to flush when SafeEventDispatcher performs async dispatch.
 *
 * @returns {Promise<void>}
 */
function flushAsync() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

describe('handlerUtils/paramsUtils real module integration', () => {
  let logger;
  let registry;
  let repository;
  let schemaValidator;
  let eventBus;
  let validatedDispatcher;
  let safeDispatcher;

  beforeEach(() => {
    logger = new ConsoleLogger(LogLevel.INFO);
    registry = new InMemoryDataRegistry({ logger });
    repository = new GameDataRepository(registry, logger);

    schemaValidator = {
      isSchemaLoaded: (schemaId) =>
        schemaId === `${SYSTEM_ERROR_OCCURRED_ID}#payload`,
      validate: (schemaId, payload) => ({
        isValid:
          schemaId === `${SYSTEM_ERROR_OCCURRED_ID}#payload` &&
          typeof payload?.message === 'string' &&
          typeof payload?.details === 'object',
      }),
    };

    eventBus = new EventBus({ logger });
    validatedDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository: repository,
      schemaValidator,
      logger,
    });
    safeDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });

    registry.store('events', SYSTEM_ERROR_OCCURRED_ID, {
      id: SYSTEM_ERROR_OCCURRED_ID,
      name: SYSTEM_ERROR_OCCURRED_ID,
      description: 'System error event for params utils integration test',
      payloadSchema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          details: { type: 'object' },
        },
        required: ['message', 'details'],
        additionalProperties: true,
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns true for valid params and warns via real logger for invalid inputs', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(assertParamsObject({ name: 'ok' }, logger, 'ValidateOp')).toBe(true);

    const result = assertParamsObject(undefined, logger, 'ValidateOp');
    expect(result).toBe(false);

    expect(warnSpy).toHaveBeenCalledWith(
      'ValidateOp: params missing or invalid.',
      { params: undefined }
    );
  });

  it('falls back to console.warn when neither logger nor dispatcher is provided', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = assertParamsObject(null, null, 'ConsoleOp');
    expect(result).toBe(false);

    expect(warnSpy).toHaveBeenCalledWith(
      'ConsoleOp: params missing or invalid.',
      { params: null }
    );
  });

  it('dispatches system errors when only a dispatcher is provided', async () => {
    const received = [];
    const unsubscribe = safeDispatcher.subscribe(
      SYSTEM_ERROR_OCCURRED_ID,
      ({ payload }) => {
        received.push(payload);
      }
    );

    const result = assertParamsObject(null, safeDispatcher, 'DispatchOp');
    expect(result).toBe(false);

    await flushAsync();

    expect(received).toHaveLength(1);
    expect(received[0].message).toContain(
      'DispatchOp: params missing or invalid.'
    );
    expect(received[0].details).toEqual({ params: null });

    unsubscribe?.();
  });

  it('validates string parameters and trims values when valid', () => {
    const trimmed = validateStringParam(
      '  hello  ',
      'greeting',
      logger,
      safeDispatcher
    );
    expect(trimmed).toBe('hello');
  });

  it('dispatches validation errors for invalid strings when dispatcher present', async () => {
    const received = [];
    const unsubscribe = safeDispatcher.subscribe(
      SYSTEM_ERROR_OCCURRED_ID,
      ({ payload }) => {
        received.push(payload);
      }
    );

    const result = validateStringParam('', 'title', logger, safeDispatcher);
    expect(result).toBeNull();

    await flushAsync();

    expect(received).toHaveLength(1);
    expect(received[0].message).toContain('Invalid "title" parameter');
    unsubscribe?.();
  });

  it('falls back to logger warnings when dispatcher is missing', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = validateStringParam('', 'nickname', logger, null);
    expect(result).toBeNull();

    expect(warnSpy).toHaveBeenCalledWith('Invalid "nickname" parameter', {
      nickname: '',
    });
  });
});
