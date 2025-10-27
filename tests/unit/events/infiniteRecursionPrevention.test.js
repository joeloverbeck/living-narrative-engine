/**
 * @file Tests for infinite recursion prevention in EventBus batch mode
 * @see src/events/eventBus.js, src/utils/safeErrorLogger.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import createSafeErrorLogger from '../../../src/utils/safeErrorLogger.js';

describe('EventBus Infinite Recursion Prevention', () => {
  let eventBus;
  let validatedEventDispatcher;
  let safeEventDispatcher;
  let mockLogger;
  let mockGameDataRepository;
  let mockSchemaValidator;
  let safeErrorLogger;

  beforeEach(() => {
    jest.useFakeTimers();
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock dependencies for ValidatedEventDispatcher
    mockGameDataRepository = {
      getEventDefinition: jest.fn().mockReturnValue(null), // Most events won't have definitions in unit tests
    };

    mockSchemaValidator = {
      isSchemaLoaded: jest.fn().mockReturnValue(false),
      validate: jest.fn(),
    };

    // Create the chain of dispatchers
    eventBus = new EventBus({ logger: mockLogger });

    validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository: mockGameDataRepository,
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
    });

    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger: mockLogger,
    });

    // Now create safeErrorLogger with the correct parameter
    safeErrorLogger = createSafeErrorLogger({
      logger: mockLogger,
      safeEventDispatcher,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Batch Mode Functionality', () => {
    it('should enable and disable batch mode correctly', () => {
      expect(eventBus.isBatchModeEnabled()).toBe(false);
      expect(eventBus.getBatchModeOptions()).toBeNull();

      eventBus.setBatchMode(true, {
        maxRecursionDepth: 15,
        maxGlobalRecursion: 30,
        context: 'test-mode',
      });

      expect(eventBus.isBatchModeEnabled()).toBe(true);
      expect(eventBus.getBatchModeOptions()).toMatchObject({
        maxRecursionDepth: 15,
        maxGlobalRecursion: 30,
        context: 'test-mode',
      });

      eventBus.setBatchMode(false);

      expect(eventBus.isBatchModeEnabled()).toBe(false);
      expect(eventBus.getBatchModeOptions()).toBeNull();
    });

    it('should auto-disable batch mode after timeout', () => {
      eventBus.setBatchMode(true, {
        timeoutMs: 5000,
        context: 'timeout-test',
      });

      expect(eventBus.isBatchModeEnabled()).toBe(true);

      // Fast forward past timeout
      jest.advanceTimersByTime(5001);

      expect(eventBus.isBatchModeEnabled()).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Auto-disabling batch mode after 5000ms timeout'
        )
      );
    });

    it('should not change state when setting same batch mode twice', () => {
      const spy = jest.spyOn(mockLogger, 'debug');

      eventBus.setBatchMode(true, { context: 'test' });
      spy.mockClear();

      // Setting to same state should be no-op
      eventBus.setBatchMode(true, { context: 'test' });

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining(
          'EventBus: Batch mode timeout refreshed for context: test'
        )
      );
    });
  });

  describe('Recursion Protection in Normal Mode', () => {
    let dateSpy;

    beforeEach(() => {
      dateSpy = jest.spyOn(Date, 'now');
      let current = 0;
      dateSpy.mockImplementation(() => {
        current += 20;
        return current;
      });
    });

    afterEach(() => {
      dateSpy.mockRestore();
    });
    it('should block events exceeding normal recursion depth (15)', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      let dispatchCount = 0;

      // Create a listener that triggers more dispatches
      eventBus.subscribe('test:recursive', async () => {
        dispatchCount++;
        if (dispatchCount < 20) {
          await eventBus.dispatch('test:recursive', { count: dispatchCount });
        }
      });

      await eventBus.dispatch('test:recursive', { count: 0 });

      // Should stop at depth 10 (reduced from 15 for non-workflow events)
      expect(dispatchCount).toBe(10);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Maximum recursion depth (10) exceeded for event "test:recursive"'
        ),
        expect.any(String),
        expect.any(String)
      );

      consoleSpy.mockRestore();
    });

    it('should treat system error events same as regular events (depth 15)', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      let dispatchCount = 0;

      eventBus.subscribe('core:system_error_occurred', async () => {
        dispatchCount++;
        if (dispatchCount < 20) {
          await eventBus.dispatch('core:system_error_occurred', {
            count: dispatchCount,
          });
        }
      });

      await eventBus.dispatch('core:system_error_occurred', {
        message: 'test',
      });

      // System error events are no longer treated as critical - same limit as regular events
      expect(dispatchCount).toBe(10);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Maximum recursion depth (10) exceeded for event "core:system_error_occurred"'
        ),
        expect.any(String),
        expect.any(String)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Recursion Protection in Batch Mode', () => {
    let dateSpy;

    beforeEach(() => {
      dateSpy = jest.spyOn(Date, 'now');
      let current = 0;
      dateSpy.mockImplementation(() => {
        current += 20;
        return current;
      });
    });

    afterEach(() => {
      dateSpy.mockRestore();
    });
    it('should allow higher recursion depth in batch mode', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      let dispatchCount = 0;

      // Enable batch mode with higher limits
      eventBus.setBatchMode(true, {
        maxRecursionDepth: 8,
        maxGlobalRecursion: 20,
        context: 'test-batch',
      });

      // Create a listener that triggers more dispatches
      eventBus.subscribe('test:batch_recursive', async () => {
        dispatchCount++;
        if (dispatchCount < 15) {
          await eventBus.dispatch('test:batch_recursive', {
            count: dispatchCount,
          });
        }
      });

      await eventBus.dispatch('test:batch_recursive', { count: 0 });

      // Should allow up to depth 8 in batch mode
      expect(dispatchCount).toBe(8);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Maximum recursion depth (8) exceeded for event "test:batch_recursive" (batch mode: test-batch)'
        ),
        expect.any(String),
        expect.any(String)
      );

      consoleSpy.mockRestore();
    });

    it('should allow system error events up to batch mode limit', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      let dispatchCount = 0;

      // Enable batch mode
      eventBus.setBatchMode(true, {
        maxRecursionDepth: 10,
        context: 'system-error-test',
      });

      eventBus.subscribe('core:system_error_occurred', async () => {
        dispatchCount++;
        if (dispatchCount < 15) {
          await eventBus.dispatch('core:system_error_occurred', {
            count: dispatchCount,
          });
        }
      });

      await eventBus.dispatch('core:system_error_occurred', {
        message: 'test',
      });

      // System error events are no longer critical - should use batch mode limit
      expect(dispatchCount).toBe(10);

      consoleSpy.mockRestore();
    });

    it('should respect global recursion limits in batch mode', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      let totalDispatches = 0;

      // Enable batch mode with low global limit for testing
      eventBus.setBatchMode(true, {
        maxRecursionDepth: 5,
        maxGlobalRecursion: 10,
        context: 'global-limit-test',
      });

      // Create multiple event types that dispatch each other
      ['event:a', 'event:b', 'event:c'].forEach((eventName) => {
        eventBus.subscribe(eventName, async () => {
          totalDispatches++;
          if (totalDispatches < 20) {
            // Dispatch a different event to build up global recursion
            const nextEvent =
              eventName === 'event:a'
                ? 'event:b'
                : eventName === 'event:b'
                  ? 'event:c'
                  : 'event:a';
            await eventBus.dispatch(nextEvent, { from: eventName });
          }
        });
      });

      await eventBus.dispatch('event:a', { start: true });

      // Should stop when global recursion limit (10) is reached
      expect(totalDispatches).toBeLessThanOrEqual(10);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Global recursion limit (10) exceeded for non-workflow/non-component events (batch mode: global-limit-test)'
        )
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Component Addition Scenario', () => {
    let dateSpy;

    beforeEach(() => {
      dateSpy = jest.spyOn(Date, 'now');
      let current = 0;
      dateSpy.mockImplementation(() => {
        current += 20;
        return current;
      });
    });

    afterEach(() => {
      dateSpy.mockRestore();
    });
    it('should allow legitimate bulk component additions in batch mode', async () => {
      let componentAddedCount = 0;
      const maxComponents = 15; // Higher than normal recursion limit (3)

      // Enable batch mode for component loading
      eventBus.setBatchMode(true, {
        maxRecursionDepth: 20,
        maxGlobalRecursion: 50,
        context: 'component-loading',
      });

      // Simulate component addition chain reaction
      eventBus.subscribe('core:component_added', async () => {
        componentAddedCount++;

        // Simulate systems that react to component additions by adding more components
        if (componentAddedCount < maxComponents) {
          await eventBus.dispatch('core:component_added', {
            entityId: `entity-${componentAddedCount}`,
            componentTypeId: 'core:position',
            componentData: { x: componentAddedCount, y: componentAddedCount },
          });
        }
      });

      // Start the component addition chain
      await eventBus.dispatch('core:component_added', {
        entityId: 'entity-0',
        componentTypeId: 'core:name',
        componentData: { text: 'Initial Entity' },
      });

      // Should allow all legitimate component additions
      expect(componentAddedCount).toBe(maxComponents);
    });
  });

  describe('Safe Error Logger Integration', () => {
    it('should enable and disable game loading mode', () => {
      expect(safeErrorLogger.isGameLoadingActive()).toBe(false);
      expect(eventBus.isBatchModeEnabled()).toBe(false);

      safeErrorLogger.enableGameLoadingMode({
        context: 'test-game-load',
        timeoutMs: 10000,
      });

      expect(safeErrorLogger.isGameLoadingActive()).toBe(true);
      expect(eventBus.isBatchModeEnabled()).toBe(true);

      safeErrorLogger.disableGameLoadingMode();

      expect(safeErrorLogger.isGameLoadingActive()).toBe(false);
      expect(eventBus.isBatchModeEnabled()).toBe(false);
    });

    it('should automatically manage batch mode with withGameLoadingMode', async () => {
      expect(eventBus.isBatchModeEnabled()).toBe(false);

      let batchModeWasEnabled = false;

      await safeErrorLogger.withGameLoadingMode(
        async () => {
          batchModeWasEnabled = eventBus.isBatchModeEnabled();
          // No need for setTimeout in fake timer environment
        },
        {
          context: 'with-loading-test',
          timeoutMs: 5000,
        }
      );

      expect(batchModeWasEnabled).toBe(true);
      expect(eventBus.isBatchModeEnabled()).toBe(false);
    });

    it('maintains batch mode across nested withGameLoadingMode calls', async () => {
      expect(eventBus.isBatchModeEnabled()).toBe(false);

      await safeErrorLogger.withGameLoadingMode(
        async () => {
          expect(eventBus.isBatchModeEnabled()).toBe(true);

          await safeErrorLogger.withGameLoadingMode(
            async () => {
              expect(eventBus.isBatchModeEnabled()).toBe(true);
            },
            { context: 'nested-loading-test', timeoutMs: 2000 }
          );

          expect(eventBus.isBatchModeEnabled()).toBe(true);
        },
        { context: 'outer-loading-test', timeoutMs: 2000 }
      );

      expect(eventBus.isBatchModeEnabled()).toBe(false);
    });

    it('keeps game loading mode active when nested enables are torn down', () => {
      safeErrorLogger.enableGameLoadingMode({
        context: 'outer-manual',
        timeoutMs: 4000,
      });
      safeErrorLogger.enableGameLoadingMode({
        context: 'inner-manual',
        timeoutMs: 4000,
      });

      expect(eventBus.isBatchModeEnabled()).toBe(true);

      safeErrorLogger.disableGameLoadingMode();

      expect(eventBus.isBatchModeEnabled()).toBe(true);
      expect(safeErrorLogger.isGameLoadingActive()).toBe(true);

      safeErrorLogger.disableGameLoadingMode();

      expect(eventBus.isBatchModeEnabled()).toBe(false);
      expect(safeErrorLogger.isGameLoadingActive()).toBe(false);
    });

    it('should disable batch mode even if function throws', async () => {
      expect(eventBus.isBatchModeEnabled()).toBe(false);

      await expect(
        safeErrorLogger.withGameLoadingMode(
          async () => {
            expect(eventBus.isBatchModeEnabled()).toBe(true);
            throw new Error('Test error');
          },
          { context: 'error-test' }
        )
      ).rejects.toThrow('Test error');

      // Batch mode should be disabled even after error
      expect(eventBus.isBatchModeEnabled()).toBe(false);
    });

    it('should auto-disable after timeout', () => {
      safeErrorLogger.enableGameLoadingMode({
        timeoutMs: 3000,
        context: 'timeout-test',
      });

      expect(safeErrorLogger.isGameLoadingActive()).toBe(true);
      expect(eventBus.isBatchModeEnabled()).toBe(true);

      // Fast forward past timeout
      jest.advanceTimersByTime(3001);

      expect(safeErrorLogger.isGameLoadingActive()).toBe(false);
      expect(eventBus.isBatchModeEnabled()).toBe(false);
    });
  });

  describe('Error Handling During Recursion', () => {
    it('should use console.error when logger fails during high recursion', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Mock logger to fail
      mockLogger.error.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      let errorCount = 0;
      eventBus.subscribe('test:error_event', async () => {
        errorCount++;
        throw new Error(`Test error ${errorCount}`);
      });

      await eventBus.dispatch('test:error_event', {});

      // Updated to match actual production error message format
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'EventBus: Logger failed while handling error in "test:error_event" listener. Original error:'
        ),
        expect.any(Error),
        expect.stringContaining('Logger error:'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should safely log errors with safeError utility', () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Mock logger to fail
      mockLogger.error.mockImplementation(() => {
        throw new Error('Logger recursion');
      });

      const testError = new Error('Test error');
      safeErrorLogger.safeError('Test message', testError, { context: 'test' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Logger failed. Original error: Test message'),
        testError,
        expect.stringContaining('Logger error:'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
