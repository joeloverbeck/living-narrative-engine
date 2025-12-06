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

  it('runs recovery flow through handleError for recoverable categories', () => {
    const recoveryHandler = jest.fn();
    const { strategy } = createStrategy({
      recoveryHandlers: { [ERROR_CATEGORIES.NETWORK]: recoveryHandler },
    });

    strategy.handleError(new Error('network down'), {
      category: ERROR_CATEGORIES.NETWORK,
      showToUser: false,
    });

    expect(recoveryHandler).toHaveBeenCalled();
  });

  it('propagates service errors after logging with system context', () => {
    const { strategy } = createStrategy();
    const spy = jest.spyOn(strategy, 'handleError');
    const error = new Error('service failed');

    expect(() =>
      strategy.handleServiceError(error, 'saveProfile', 'Could not save')
    ).toThrow(error);

    expect(spy).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        operation: 'saveProfile',
        category: ERROR_CATEGORIES.SYSTEM,
        userMessage: 'Could not save',
        showToUser: true,
      })
    );
  });

  it('returns supplied user message directly before category heuristics', () => {
    const { strategy } = createStrategy();
    const message = strategy.generateUserMessage(new Error('ignored'), {
      userMessage: 'Custom user message',
    });

    expect(message).toBe('Custom user message');
  });

  it('covers permission and not found user message branches', () => {
    const { strategy } = createStrategy();
    expect(
      strategy.generateUserMessage(new Error('forbidden'), {
        category: ERROR_CATEGORIES.PERMISSION,
      })
    ).toContain("don't have permission");
    expect(
      strategy.generateUserMessage(new Error('404 item'), {
        category: ERROR_CATEGORIES.NOT_FOUND,
      })
    ).toContain('not found');
  });

  it('logs error details respecting severity levels', () => {
    const { strategy, logger } = createStrategy();
    const baseDetails = {
      message: 'msg',
      operation: 'op',
      category: ERROR_CATEGORIES.SYSTEM,
      metadata: {},
      severity: ERROR_SEVERITY.INFO,
    };

    strategy.logError(baseDetails);
    strategy.logError({ ...baseDetails, severity: ERROR_SEVERITY.WARNING });
    strategy.logError({ ...baseDetails, severity: ERROR_SEVERITY.CRITICAL });
    strategy.logError({ ...baseDetails, severity: 'UNKNOWN' });

    expect(logger.info).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it('surfaces errors to UI through multiple fallback channels', () => {
    const showState = jest.fn();
    const uiStateManager = { showState: jest.fn() };
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { strategy: firstStrategy } = createStrategy({
      showError: null,
      showState,
    });
    firstStrategy.showErrorToUser({
      userMessage: 'state path',
      category: ERROR_CATEGORIES.SYSTEM,
      severity: ERROR_SEVERITY.ERROR,
    });
    expect(showState).toHaveBeenCalledWith('error', {
      message: 'state path',
      category: ERROR_CATEGORIES.SYSTEM,
      severity: ERROR_SEVERITY.ERROR,
    });

    const { strategy: secondStrategy } = createStrategy({
      showError: null,
      showState: null,
      uiStateManager,
    });
    secondStrategy.showErrorToUser({
      userMessage: 'ui manager',
      category: ERROR_CATEGORIES.SYSTEM,
      severity: ERROR_SEVERITY.ERROR,
    });
    expect(uiStateManager.showState).toHaveBeenCalledWith(
      'error',
      'ui manager'
    );

    const { strategy: thirdStrategy } = createStrategy({
      showError: null,
      showState: null,
      uiStateManager: null,
    });
    thirdStrategy.showErrorToUser({
      userMessage: 'console fallback',
      category: ERROR_CATEGORIES.SYSTEM,
      severity: ERROR_SEVERITY.ERROR,
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error display not available:',
      'console fallback'
    );

    consoleSpy.mockRestore();
  });

  it('marks temporary or network errors as recoverable and others as not', () => {
    const { strategy } = createStrategy();
    expect(
      strategy.determineRecoverability(new Error('temporary glitch'), {})
    ).toBe(true);
    expect(
      strategy.determineRecoverability(new Error('no access'), {
        category: ERROR_CATEGORIES.PERMISSION,
      })
    ).toBe(false);
  });

  it('logs recovery handler failures while still continuing flow', () => {
    const failingHandler = jest.fn(() => {
      throw new Error('recovery blew up');
    });
    const { strategy, logger } = createStrategy({
      recoveryHandlers: { [ERROR_CATEGORIES.NETWORK]: failingHandler },
    });

    strategy.attemptErrorRecovery({
      category: ERROR_CATEGORIES.NETWORK,
    });

    expect(logger.info).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('creates wrapped errors with metadata helpers', () => {
    const { strategy } = createStrategy();
    const created = strategy.createError('msg', ERROR_CATEGORIES.SYSTEM, {
      id: 1,
    });
    expect(created.category).toBe(ERROR_CATEGORIES.SYSTEM);
    expect(created.metadata).toEqual({ id: 1 });
    expect(created.controller).toBe('TestController');

    const original = new Error('boom');
    original.stack = 'stacktrace';
    const wrapped = strategy.wrapError(original, 'context');
    expect(wrapped.message).toBe('context: boom');
    expect(wrapped.originalError).toBe(original);
    expect(wrapped.stack).toBe('stacktrace');
  });

  it('resets last error state explicitly', () => {
    const { strategy } = createStrategy();
    strategy.handleError(new Error('oops'));
    expect(strategy.lastError).not.toBeNull();
    strategy.resetLastError();
    expect(strategy.lastError).toBeNull();
  });
});
