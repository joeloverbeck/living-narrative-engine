/**
 * @file Error Event Handling Advanced E2E Test
 * @description Comprehensive end-to-end test for advanced error event handling scenarios
 * including console fallback mechanisms, error propagation to UI systems, and system error event flow.
 * This test complements the basic error handling covered in completeEventLifecycle.e2e.test.js.
 * @jest-environment jsdom
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  SYSTEM_WARNING_OCCURRED_ID,
} from '../../../src/constants/systemEventIds.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';

/**
 * Extended test bed for error event system testing
 */
class ErrorEventTestBed extends IntegrationTestBed {
  constructor() {
    super();
    this._customEventBus = null;
    this._customSafeEventDispatcher = null;
    this._customValidatedEventDispatcher = null;
    this.consoleErrorMock = null;
    this.consoleWarnMock = null;
    this.consoleLogMock = null;
    this.originalConsoleError = null;
    this.originalConsoleWarn = null;
    this.originalConsoleLog = null;
  }

  async initialize() {
    await super.initialize();

    // Store original console methods
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
    this.originalConsoleLog = console.log;

    // Create console mocks
    this.consoleErrorMock = jest.fn();
    this.consoleWarnMock = jest.fn();
    this.consoleLogMock = jest.fn();

    // Replace console methods
    console.error = this.consoleErrorMock;
    console.warn = this.consoleWarnMock;
    console.log = this.consoleLogMock;

    // Create real event system components like BatchModeGameLoading test
    this.logger = this.container.resolve(tokens.ILogger);
    this._customEventBus = new EventBus({ logger: this.logger });

    // Create ValidatedEventDispatcher (needed by SafeEventDispatcher)
    const schemaValidator = this.container.resolve(tokens.ISchemaValidator);
    const gameDataRepository = this.container.resolve(
      tokens.IGameDataRepository
    );

    this._customValidatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus: this._customEventBus,
      schemaValidator: schemaValidator,
      gameDataRepository: gameDataRepository,
      logger: this.logger,
    });

    this._customSafeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: this._customValidatedEventDispatcher,
      logger: this.logger,
    });
  }

  async cleanup() {
    // Restore original console methods
    if (this.originalConsoleError) console.error = this.originalConsoleError;
    if (this.originalConsoleWarn) console.warn = this.originalConsoleWarn;
    if (this.originalConsoleLog) console.log = this.originalConsoleLog;

    await super.cleanup();
  }

  get eventBus() {
    return this._customEventBus;
  }

  get safeEventDispatcher() {
    return this._customSafeEventDispatcher;
  }

  get validatedEventDispatcher() {
    return this._customValidatedEventDispatcher;
  }
}

describe('Error Event Handling Advanced E2E Test', () => {
  /** @type {ErrorEventTestBed} */
  let testBed;

  beforeEach(async () => {
    testBed = new ErrorEventTestBed();
    await testBed.initialize();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Console Fallback Mechanism', () => {
    it('should use SafeEventDispatcher console fallback when ValidatedEventDispatcher throws for system error events', async () => {
      // Arrange - Create a ValidatedEventDispatcher that throws exceptions
      const throwingDispatcher = {
        dispatch: jest.fn(() => {
          throw new Error('ValidatedEventDispatcher failure');
        }),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };

      const safeDispatcherWithThrowingVED = new SafeEventDispatcher({
        validatedEventDispatcher: throwingDispatcher,
        logger: testBed.logger,
      });

      const errorPayload = {
        message: 'Test system error',
        context: { source: 'test' },
        timestamp: new Date().toISOString(),
      };

      // Act - dispatch a system error event that should trigger console fallback
      const result = await safeDispatcherWithThrowingVED.dispatch(
        SYSTEM_ERROR_OCCURRED_ID,
        errorPayload
      );

      // Assert
      expect(result).toBe(false); // SafeEventDispatcher should return false after catching exception
      expect(throwingDispatcher.dispatch).toHaveBeenCalled();
      expect(testBed.consoleErrorMock).toHaveBeenCalled();

      // Verify the console error message contains expected content
      const consoleCall = testBed.consoleErrorMock.mock.calls.find(
        (call) =>
          call[0].includes('SafeEventDispatcher') &&
          call[0].includes('system_error_occurred')
      );
      expect(consoleCall).toBeTruthy();
    });

    it('should use SafeEventDispatcher console fallback when ValidatedEventDispatcher throws for events with error keywords', async () => {
      // Arrange
      const errorEvent = 'test:critical_error_occurred';
      const errorPayload = { message: 'Test error with keywords' };

      // Create a ValidatedEventDispatcher that throws exceptions
      const throwingDispatcher = {
        dispatch: jest.fn(() => {
          throw new Error('ValidatedEventDispatcher failure for error event');
        }),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };

      const safeDispatcherWithThrowingVED = new SafeEventDispatcher({
        validatedEventDispatcher: throwingDispatcher,
        logger: testBed.logger,
      });

      // Act
      const result = await safeDispatcherWithThrowingVED.dispatch(
        errorEvent,
        errorPayload
      );

      // Assert
      expect(result).toBe(false);
      expect(throwingDispatcher.dispatch).toHaveBeenCalled();
      expect(testBed.consoleErrorMock).toHaveBeenCalled();

      // Verify console fallback was triggered due to error keywords
      const consoleCall = testBed.consoleErrorMock.mock.calls.find(
        (call) =>
          call[0].includes('SafeEventDispatcher') &&
          call[0].includes('critical_error_occurred')
      );
      expect(consoleCall).toBeTruthy();
    });

    it('should use console fallback when logger fails during error handling', async () => {
      // Arrange - Create a mock logger that throws when called
      const failingLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(() => {
          throw new Error('Logger failure');
        }),
        log: jest.fn(),
      };

      // Create a ValidatedEventDispatcher that throws exceptions (triggering logger usage)
      const throwingDispatcher = {
        dispatch: jest.fn(() => {
          throw new Error('ValidatedEventDispatcher failure to trigger logger');
        }),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };

      // Create SafeEventDispatcher with failing logger and throwing dispatcher
      const safeDispatcherWithFailingLogger = new SafeEventDispatcher({
        validatedEventDispatcher: throwingDispatcher,
        logger: failingLogger,
      });

      const normalEvent = 'test:normal_event';
      const eventPayload = { message: 'Test normal event' };

      // Act
      const result = await safeDispatcherWithFailingLogger.dispatch(
        normalEvent,
        eventPayload
      );

      // Assert
      expect(result).toBe(false);
      expect(throwingDispatcher.dispatch).toHaveBeenCalled();
      expect(failingLogger.error).toHaveBeenCalled();
      expect(testBed.consoleErrorMock).toHaveBeenCalled();

      // Verify console was used as ultimate fallback
      const consoleCall = testBed.consoleErrorMock.mock.calls.find((call) =>
        call[0].includes(
          'SafeEventDispatcher: Logger failed while handling error'
        )
      );
      expect(consoleCall).toBeTruthy();
    });
  });

  describe('System Error Event Flow', () => {
    it('should properly dispatch and handle SYSTEM_ERROR_OCCURRED_ID events through the full event system', async () => {
      // Arrange
      const errorPayload = {
        message: 'Critical system error occurred',
        source: 'ErrorEventHandlingTest',
        severity: 'high',
        context: {
          component: 'SafeEventDispatcher',
          operation: 'error_handling_test',
        },
        timestamp: new Date().toISOString(),
      };

      const systemErrorHandler = jest.fn();
      const wildcardHandler = jest.fn();

      // Subscribe to system error events
      testBed.eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, systemErrorHandler);
      testBed.eventBus.subscribe('*', wildcardHandler);

      // Act
      const result = await testBed.safeEventDispatcher.dispatch(
        SYSTEM_ERROR_OCCURRED_ID,
        errorPayload
      );

      // Assert
      expect(result).toBe(true); // Should succeed with real event system
      expect(systemErrorHandler).toHaveBeenCalledWith({
        type: SYSTEM_ERROR_OCCURRED_ID,
        payload: errorPayload,
      });

      expect(wildcardHandler).toHaveBeenCalledWith({
        type: SYSTEM_ERROR_OCCURRED_ID,
        payload: errorPayload,
      });
    });

    it('should handle SYSTEM_WARNING_OCCURRED_ID events similarly to error events', async () => {
      // Arrange
      const warningPayload = {
        message: 'System warning occurred',
        source: 'test',
        severity: 'low',
        context: { warning: true },
        timestamp: new Date().toISOString(),
      };

      const warningHandler = jest.fn();
      testBed.eventBus.subscribe(SYSTEM_WARNING_OCCURRED_ID, warningHandler);

      // Act
      const result = await testBed.safeEventDispatcher.dispatch(
        SYSTEM_WARNING_OCCURRED_ID,
        warningPayload
      );

      // Assert
      expect(result).toBe(true);
      expect(warningHandler).toHaveBeenCalledWith({
        type: SYSTEM_WARNING_OCCURRED_ID,
        payload: warningPayload,
      });
    });

    it('should validate system error event payload structure through ValidatedEventDispatcher', async () => {
      // Arrange
      const validPayload = {
        message: 'Test error message',
        source: 'test',
        severity: 'medium',
        context: { test: true },
        timestamp: new Date().toISOString(),
      };

      const validEventHandler = jest.fn();
      testBed.eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, validEventHandler);

      // Act & Assert - Valid payload should succeed
      const result = await testBed.safeEventDispatcher.dispatch(
        SYSTEM_ERROR_OCCURRED_ID,
        validPayload
      );

      expect(result).toBe(true);
      expect(validEventHandler).toHaveBeenCalled();
    });
  });

  describe('Error Recovery and System Integrity', () => {
    it('should continue normal operation after error events and maintain system state', async () => {
      // Arrange
      const normalEvent = 'test:normal_operation';
      const errorEvent = 'test:error_operation';

      const normalHandler = jest.fn();
      const errorHandler = jest.fn(() => {
        throw new Error('Intentional error for recovery test');
      });

      testBed.eventBus.subscribe(normalEvent, normalHandler);
      testBed.eventBus.subscribe(errorEvent, errorHandler);

      // Act - Trigger error, then normal operation
      await testBed.safeEventDispatcher.dispatch(errorEvent, {
        message: 'Error test',
      });
      await testBed.safeEventDispatcher.dispatch(normalEvent, {
        message: 'Normal test',
      });

      // Assert
      expect(errorHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();

      // Verify system continues to operate normally
      expect(normalHandler.mock.calls[0][0]).toEqual({
        type: normalEvent,
        payload: { message: 'Normal test' },
      });
    });

    it('should demonstrate SafeEventDispatcher prevents system crashes during event processing', async () => {
      // Arrange - Create a scenario that would crash without SafeEventDispatcher
      const crashingEvent = 'test:crashing_event';
      const followupEvent = 'test:followup_event';

      const crashingHandler = jest.fn(() => {
        throw new Error(
          'This would crash the system without SafeEventDispatcher'
        );
      });
      const followupHandler = jest.fn();

      testBed.eventBus.subscribe(crashingEvent, crashingHandler);
      testBed.eventBus.subscribe(followupEvent, followupHandler);

      // Act - These dispatches should not crash the test
      const crashResult = await testBed.safeEventDispatcher.dispatch(
        crashingEvent,
        { message: 'crash test' }
      );
      const followupResult = await testBed.safeEventDispatcher.dispatch(
        followupEvent,
        { message: 'followup test' }
      );

      // Assert
      expect(crashingHandler).toHaveBeenCalled();
      expect(followupHandler).toHaveBeenCalled();

      // SafeEventDispatcher allows the crash but continues processing
      expect(crashResult).toBe(true); // Event was dispatched (handler throwing doesn't affect dispatch result)
      expect(followupResult).toBe(true);

      // System continues to function normally
      expect(followupHandler.mock.calls[0][0]).toEqual({
        type: followupEvent,
        payload: { message: 'followup test' },
      });
    });
  });
});
