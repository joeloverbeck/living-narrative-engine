/**
 * Additional coverage tests for ValidatedEventDispatcher focusing on
 * resilience and fallback behavior within the private #emitEvent flow.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';

describe('ValidatedEventDispatcher - emit event resilience', () => {
  let validatedEventDispatcher;
  let mockEventBus;
  let mockGameDataRepository;
  let mockSchemaValidator;
  let mockLogger;

  const configureSuccessfulValidation = (eventId = 'test:event') => {
    mockGameDataRepository.getEventDefinition.mockReturnValue({
      id: eventId,
      payloadSchema: { type: 'object' },
    });
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
    mockSchemaValidator.validate.mockReturnValue({ isValid: true });
  };

  beforeEach(() => {
    mockEventBus = {
      dispatch: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    mockGameDataRepository = {
      getEventDefinition: jest.fn(),
    };

    mockSchemaValidator = {
      isSchemaLoaded: jest.fn(),
      validate: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus: mockEventBus,
      gameDataRepository: mockGameDataRepository,
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('falls back to console.debug when logger.debug throws before dispatching', async () => {
    configureSuccessfulValidation();

    const consoleDebugSpy = jest
      .spyOn(console, 'debug')
      .mockImplementation(() => {});

    mockLogger.debug.mockImplementation((message) => {
      if (
        typeof message === 'string' &&
        message.includes("Dispatching event 'test:event' via EventBus")
      ) {
        throw new Error('logger debug failure');
      }
    });

    const payload = { id: 'abc-123' };
    const result = await validatedEventDispatcher.dispatch(
      'test:event',
      payload
    );

    expect(result).toBe(true);
    expect(mockEventBus.dispatch).toHaveBeenCalledWith('test:event', payload);
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      "VED: Logger failed, using console: Dispatching event 'test:event' via EventBus..."
    );
  });

  it('falls back to console.debug when logger.debug throws after dispatch success', async () => {
    configureSuccessfulValidation();

    const consoleDebugSpy = jest
      .spyOn(console, 'debug')
      .mockImplementation(() => {});

    mockLogger.debug.mockImplementation((message) => {
      if (
        typeof message === 'string' &&
        message.includes("Event 'test:event' dispatch successful.")
      ) {
        throw new Error('post-dispatch debug failure');
      }
    });

    const payload = { id: 'xyz-789' };
    const result = await validatedEventDispatcher.dispatch(
      'test:event',
      payload
    );

    expect(result).toBe(true);
    expect(mockEventBus.dispatch).toHaveBeenCalledWith('test:event', payload);
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      "VED: Event 'test:event' dispatch successful (logger failed)."
    );
  });

  it('logs to console.error when dispatching an error event fails', async () => {
    mockGameDataRepository.getEventDefinition.mockReturnValue(null);
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

    const dispatchError = new Error('bus failure');
    mockEventBus.dispatch.mockRejectedValue(dispatchError);

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const result = await validatedEventDispatcher.dispatch(
      'core:system_error_occurred',
      { reason: 'boom' }
    );

    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'VED: Error during error event dispatch (using console to prevent recursion):',
      dispatchError
    );
  });

  it('falls back to console.error when logger.error fails during dispatch errors', async () => {
    configureSuccessfulValidation('regular:event');

    const dispatchError = new Error('dispatch blew up');
    const loggerError = new Error('logger blew up');
    mockEventBus.dispatch.mockRejectedValue(dispatchError);
    mockLogger.error.mockImplementation(() => {
      throw loggerError;
    });

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const result = await validatedEventDispatcher.dispatch('regular:event', {
      status: 'failing',
    });

    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "VED: Logger failed during error handling for 'regular:event'. Original error:",
      dispatchError,
      'Logger error:',
      loggerError
    );
  });

  it('delegates unsubscribe to the underlying EventBus with logging', () => {
    const listener = jest.fn();
    mockEventBus.unsubscribe.mockReturnValue(true);

    const result = validatedEventDispatcher.unsubscribe('some:event', listener);

    expect(result).toBe(true);
    expect(mockEventBus.unsubscribe).toHaveBeenCalledWith(
      'some:event',
      listener
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'VED: Delegating unsubscription for event "some:event" to EventBus.'
    );
  });
});
