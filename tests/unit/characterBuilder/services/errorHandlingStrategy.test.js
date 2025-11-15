import { ErrorHandlingStrategy } from '../../../../src/characterBuilder/services/errorHandlingStrategy.js';
import {
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
} from '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';

const createLoggerMock = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createStrategy = (overrides = {}) => {
  const logger = overrides.logger || createLoggerMock();
  const eventBus = overrides.eventBus || { dispatch: jest.fn() };
  const showError = overrides.showError || jest.fn();
  const dispatchErrorEvent = overrides.dispatchErrorEvent || jest.fn();

  const strategy = new ErrorHandlingStrategy({
    logger,
    eventBus,
    controllerName: 'TestController',
    showError,
    dispatchErrorEvent,
    errorCategories: ERROR_CATEGORIES,
    errorSeverity: ERROR_SEVERITY,
    ...overrides,
  });

  return { strategy, logger, eventBus, showError, dispatchErrorEvent };
};

describe('ErrorHandlingStrategy', () => {
  it('categorizes errors using keyword heuristics', () => {
    const { strategy } = createStrategy();
    expect(strategy.categorizeError(new Error('validation failed'))).toBe(
      ERROR_CATEGORIES.VALIDATION
    );
    expect(strategy.categorizeError(new Error('network issue'))).toBe(
      ERROR_CATEGORIES.NETWORK
    );
    expect(strategy.categorizeError(new Error('permission denied'))).toBe(
      ERROR_CATEGORIES.PERMISSION
    );
    expect(strategy.categorizeError(new Error('Resource not found'))).toBe(
      ERROR_CATEGORIES.NOT_FOUND
    );
  });

  it('derives user messages per category when none supplied', () => {
    const { strategy } = createStrategy();
    expect(
      strategy.generateUserMessage(new Error('validation failed'), {
        category: ERROR_CATEGORIES.VALIDATION,
      })
    ).toContain('Please check');
    expect(
      strategy.generateUserMessage(new Error('network down'), {
        category: ERROR_CATEGORIES.NETWORK,
      })
    ).toContain('Connection error');
  });

  it('retries retryable errors and emits metadata for observers', async () => {
    jest.useFakeTimers();
    const dispatchErrorEvent = jest.fn();
    const { strategy, logger } = createStrategy({
      dispatchErrorEvent,
    });
    const operation = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('network timeout');
      })
      .mockResolvedValue('success');

    const executePromise = strategy.executeWithErrorHandling(
      operation,
      'fetchData',
      {
        retries: 2,
        retryDelay: 25,
        userErrorMessage: 'Failed to fetch',
      }
    );

    await jest.advanceTimersByTimeAsync(25);
    const result = await executePromise;

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith(
      'TestController: fetchData succeeded after 1 retries'
    );
    expect(dispatchErrorEvent).toHaveBeenCalled();
    const errorPayload = dispatchErrorEvent.mock.calls[0][0];
    expect(errorPayload.metadata).toEqual(
      expect.objectContaining({ attempt: 1, maxRetries: 2, isRetrying: true })
    );
    jest.useRealTimers();
  });

  it('determines recoverability based on category and severity', () => {
    const { strategy } = createStrategy();
    const networkDetails = strategy.buildErrorDetails(new Error('network'), {
      category: ERROR_CATEGORIES.NETWORK,
    });
    expect(strategy.isRecoverableError(networkDetails)).toBe(true);

    const criticalDetails = {
      ...networkDetails,
      severity: ERROR_SEVERITY.CRITICAL,
    };
    expect(strategy.isRecoverableError(criticalDetails)).toBe(false);
  });

  it('notifies UI via provided showError hook', () => {
    const showError = jest.fn();
    const { strategy } = createStrategy({ showError });
    strategy.handleError(new Error('boom'), { operation: 'load' });
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining('error'),
      expect.objectContaining({ operation: 'load' })
    );
  });

  it('tracks last error and resets after successful operations', async () => {
    const { strategy } = createStrategy();
    const err = new Error('fatal');
    strategy.handleError(err, { operation: 'init' });
    expect(strategy.lastError.message).toBe('fatal');

    const result = await strategy.executeWithErrorHandling(
      async () => 'ok',
      'noop'
    );
    expect(result).toBe('ok');
    expect(strategy.lastError).toBeNull();
  });

  it('invokes registered recovery handlers when recoverable', () => {
    const handler = jest.fn();
    const { strategy } = createStrategy({
      recoveryHandlers: {
        [ERROR_CATEGORIES.NETWORK]: handler,
      },
    });
    const details = strategy.buildErrorDetails(new Error('network'), {
      category: ERROR_CATEGORIES.NETWORK,
    });
    strategy.attemptErrorRecovery(details);
    expect(handler).toHaveBeenCalledWith(details);
  });

  it('emits SYSTEM_ERROR_OCCURRED payload via event bus when no dispatcher provided', () => {
    const eventBus = { dispatch: jest.fn() };
    const { strategy } = createStrategy({
      eventBus,
      dispatchErrorEvent: null,
    });
    strategy.handleError(new Error('boom'), { operation: 'save' });
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      'SYSTEM_ERROR_OCCURRED',
      expect.objectContaining({
        context: 'save',
        category: ERROR_CATEGORIES.SYSTEM,
      })
    );
  });
});
