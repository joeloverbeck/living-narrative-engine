import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  safeDispatchError,
  dispatchValidationError,
  InvalidDispatcherError,
} from '../../../src/utils/safeDispatchErrorUtils.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import systemErrorEventDefinition from '../../../data/mods/core/events/system_error_occurred.event.json';

const waitForDispatch = () => new Promise((resolve) => setTimeout(resolve, 0));

const createTestLogger = () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

/**
 *
 */
async function createDispatcherHarness() {
  const logger = createTestLogger();
  const registry = new InMemoryDataRegistry({ logger });
  registry.store(
    'events',
    systemErrorEventDefinition.id,
    systemErrorEventDefinition
  );

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

describe('safeDispatchError integration with real dispatcher stack', () => {
  let dispatcher;
  let eventBus;
  let logger;

  beforeEach(async () => {
    ({ dispatcher, eventBus, logger } = await createDispatcherHarness());
  });

  it('dispatches core:system_error_occurred when given a plain message', async () => {
    const receivedEvents = [];
    eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, (event) => {
      receivedEvents.push(event);
    });

    const success = await safeDispatchError(
      dispatcher,
      'Network request failed',
      {
        statusCode: 503,
        url: 'https://example.com/status',
      }
    );

    expect(success).toBe(true);
    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0]).toMatchObject({
      type: SYSTEM_ERROR_OCCURRED_ID,
      payload: {
        message: 'Network request failed',
        details: {
          statusCode: 503,
          url: 'https://example.com/status',
        },
      },
    });
  });

  it('serialises ActionErrorContext payloads and preserves diagnostic data', async () => {
    const receivedEvents = [];
    eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, (event) => {
      receivedEvents.push(event);
    });

    const actionErrorContext = {
      actionId: 'core:test_action',
      targetId: 'npc-002',
      phase: 'validation',
      error: { message: 'Target missing required component' },
      actionDefinition: { id: 'core:test_action', name: 'Test Action' },
      actorSnapshot: { id: 'actor-001', components: { 'core:actor': {} } },
      evaluationTrace: {
        steps: [],
        failurePoint: 'validation',
        finalContext: {},
      },
      suggestedFixes: [
        {
          type: 'configuration',
          description: 'Attach component',
          confidence: 0.9,
        },
      ],
      environmentContext: { location: 'training-room' },
      timestamp: 1700000000000,
    };

    const result = await safeDispatchError(
      dispatcher,
      actionErrorContext,
      undefined,
      logger
    );

    expect(result).toBe(true);
    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].payload.message).toBe(
      'Target missing required component'
    );
    expect(receivedEvents[0].payload.details).toMatchObject({
      errorContext: actionErrorContext,
      actionId: actionErrorContext.actionId,
      phase: actionErrorContext.phase,
      targetId: actionErrorContext.targetId,
    });
  });

  it('logs and throws when the dispatcher dependency is invalid', async () => {
    const badLogger = createTestLogger();
    await expect(
      safeDispatchError(null, 'no dispatcher available', undefined, badLogger)
    ).rejects.toBeInstanceOf(InvalidDispatcherError);
    expect(badLogger.error).toHaveBeenCalledWith(
      "Invalid or missing method 'dispatch' on dependency 'safeDispatchError: dispatcher'."
    );
  });

  it('dispatchValidationError forwards through the dispatcher and returns the standard result', async () => {
    const receivedEvents = [];
    eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, (event) => {
      receivedEvents.push(event);
    });

    const withDetails = dispatchValidationError(
      dispatcher,
      'Schema validation failed',
      { statusCode: 422, scopeName: 'notes-persistence' },
      logger
    );

    const withoutDetails = dispatchValidationError(
      dispatcher,
      'Entity definition missing',
      undefined,
      logger
    );

    await waitForDispatch();

    expect(withDetails).toEqual({
      ok: false,
      error: 'Schema validation failed',
      details: { statusCode: 422, scopeName: 'notes-persistence' },
    });
    expect(withoutDetails).toEqual({
      ok: false,
      error: 'Entity definition missing',
    });
    expect(receivedEvents).toHaveLength(2);
    expect(receivedEvents[0].payload).toMatchObject({
      message: 'Schema validation failed',
      details: { statusCode: 422, scopeName: 'notes-persistence' },
    });
    expect(receivedEvents[1].payload.message).toBe('Entity definition missing');
    expect(receivedEvents[1].payload.details).toEqual({});
  });
});
