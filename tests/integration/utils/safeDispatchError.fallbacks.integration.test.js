import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  safeDispatchError,
  InvalidDispatcherError,
} from '../../../src/utils/safeDispatchErrorUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import systemErrorEventDefinition from '../../../data/mods/core/events/system_error_occurred.event.json';

const createTestLogger = () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

async function createDispatcherHarness() {
  const logger = createTestLogger();
  const registry = new InMemoryDataRegistry({ logger });
  registry.store('events', systemErrorEventDefinition.id, systemErrorEventDefinition);

  const repository = new GameDataRepository(registry, logger);
  const schemaValidator = new AjvSchemaValidator({ logger });
  await schemaValidator.addSchema(
    systemErrorEventDefinition.payloadSchema,
    `${systemErrorEventDefinition.id}#payload`
  );

  const eventBus = new EventBus({ logger });
  const validatedDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: repository,
    schemaValidator,
    logger,
  });

  const dispatcher = new SafeEventDispatcher({
    validatedEventDispatcher: validatedDispatcher,
    logger,
  });

  return { dispatcher, eventBus, logger };
}

describe('safeDispatchError edge cases', () => {
  let dispatcher;
  let eventBus;
  let logger;

  beforeEach(async () => {
    ({ dispatcher, eventBus, logger } = await createDispatcherHarness());
  });

  it('falls back to a default message when ActionErrorContext omits error.message', async () => {
    const receivedEvents = [];
    eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, (event) => {
      receivedEvents.push(event);
    });

    const actionErrorContext = {
      actionId: 'core:fallback-test',
      targetId: 'actor-777',
      phase: 'execution',
      error: {},
      suggestedFixes: [],
      evaluationTrace: { steps: [] },
    };

    const success = await safeDispatchError(
      dispatcher,
      actionErrorContext,
      undefined,
      logger
    );

    expect(success).toBe(true);
    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].payload.message).toBe(
      'An error occurred in the action system'
    );
    expect(receivedEvents[0].payload.details).toMatchObject({
      actionId: actionErrorContext.actionId,
      errorContext: actionErrorContext,
    });
  });

  it('gracefully handles null message payloads without throwing', async () => {
    const receivedEvents = [];
    eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, (event) => {
      receivedEvents.push(event);
    });

    await expect(
      safeDispatchError(dispatcher, null, undefined, logger)
    ).resolves.toBe(false);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('safeDispatchError: Dispatcher reported failure'),
      expect.objectContaining({ dispatchResult: false })
    );

    expect(receivedEvents).toHaveLength(0);
  });

  it('defaults InvalidDispatcherError details to an empty object when omitted', () => {
    const error = new InvalidDispatcherError('Dispatcher unavailable');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('InvalidDispatcherError');
    expect(error.details).toEqual({});
  });
});
