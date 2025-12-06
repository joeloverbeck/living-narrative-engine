import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  createFailureResult,
  dispatchFailure,
} from '../../../src/commands/helpers/commandResultUtils.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import systemErrorEventDefinition from '../../../data/mods/core/events/system_error_occurred.event.json';

/**
 *
 * @param label
 */
function createRecordingLogger(label = 'integration-logger') {
  const entries = {
    debug: [],
    info: [],
    warn: [],
    error: [],
  };

  const logger = {
    debug(message, ...args) {
      entries.debug.push({ label, message, args });
    },
    info(message, ...args) {
      entries.info.push({ label, message, args });
    },
    warn(message, ...args) {
      entries.warn.push({ label, message, args });
    },
    error(message, ...args) {
      entries.error.push({ label, message, args });
    },
  };

  return { logger, entries };
}

/**
 *
 */
async function createDispatcherEnvironment() {
  const recording = createRecordingLogger('dispatcher');
  const registry = new InMemoryDataRegistry({ logger: recording.logger });
  registry.store(
    'events',
    systemErrorEventDefinition.id,
    systemErrorEventDefinition
  );

  const repository = new GameDataRepository(registry, recording.logger);
  const schemaValidator = new AjvSchemaValidator({ logger: recording.logger });
  await schemaValidator.addSchema(
    systemErrorEventDefinition.payloadSchema,
    `${systemErrorEventDefinition.id}#payload`
  );

  const eventBus = new EventBus({ logger: recording.logger });
  const validatedDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: repository,
    schemaValidator,
    logger: recording.logger,
  });

  const dispatcher = new SafeEventDispatcher({
    validatedEventDispatcher: validatedDispatcher,
    logger: recording.logger,
  });

  const capturedEvents = [];
  eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, (event) => {
    capturedEvents.push(event);
  });

  return {
    dispatcher,
    eventBus,
    logger: recording.logger,
    logEntries: recording.entries,
    capturedEvents,
  };
}

const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

describe('commandResultUtils integration', () => {
  let dispatcher;
  let logger;
  let logEntries;
  let capturedEvents;

  beforeEach(async () => {
    ({ dispatcher, logger, logEntries, capturedEvents } =
      await createDispatcherEnvironment());
  });

  it('creates a comprehensive failure result and dispatches structured error details', async () => {
    const failure = createFailureResult(
      'Unable to comply with the command.',
      'Command processor encountered an unexpected condition.',
      'look around',
      'action-42',
      false
    );

    dispatchFailure(logger, dispatcher, failure.error, failure.internalError);

    await flushAsync();

    expect(failure).toEqual({
      success: false,
      turnEnded: false,
      internalError: 'Command processor encountered an unexpected condition.',
      originalInput: 'look around',
      actionResult: { actionId: 'action-42' },
      error: 'Unable to comply with the command.',
    });

    expect(
      logEntries.error.some(
        (entry) =>
          entry.message ===
          'Command processor encountered an unexpected condition.'
      )
    ).toBe(true);

    expect(capturedEvents).toHaveLength(1);
    const [event] = capturedEvents;
    expect(event.type).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(event.payload.message).toBe('Unable to comply with the command.');
    expect(event.payload.details.raw).toBe(
      'Command processor encountered an unexpected condition.'
    );
    expect(new Date(event.payload.details.timestamp).toISOString()).toBe(
      event.payload.details.timestamp
    );
    expect(typeof event.payload.details.stack).toBe('string');
    expect(event.payload.details.stack).toEqual(
      expect.stringContaining('Error')
    );
  });

  it('omits optional result fields while still dispatching actionable diagnostics', async () => {
    const failure = createFailureResult(
      undefined,
      'Internal failure without user-facing copy.',
      undefined,
      undefined
    );

    dispatchFailure(
      logger,
      dispatcher,
      'A fallback message was shown to the player.',
      failure.internalError
    );

    await flushAsync();

    expect(failure.success).toBe(false);
    expect(failure.turnEnded).toBe(true);
    expect(failure.error).toBeUndefined();
    expect(failure.actionResult).toBeUndefined();
    expect(failure.originalInput).toBeUndefined();

    expect(capturedEvents).toHaveLength(1);
    const [event] = capturedEvents;
    expect(event.payload.message).toBe(
      'A fallback message was shown to the player.'
    );
    expect(event.payload.details.raw).toBe(
      'Internal failure without user-facing copy.'
    );
    expect(event.payload.details.timestamp).toEqual(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    );
    expect(typeof event.payload.details.stack).toBe('string');

    expect(
      logEntries.error.some(
        (entry) =>
          entry.message === 'Internal failure without user-facing copy.'
      )
    ).toBe(true);
  });
});
