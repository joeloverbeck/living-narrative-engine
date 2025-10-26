/**
 * @file Unit tests for EventBus batch mode and progressive recursion warnings
 * @description Tests that EventBus correctly handles batch mode limits and provides
 * progressive warnings at 50%, 75%, and 90% of recursion limits
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

describe('EventBus Batch Mode and Warnings', () => {
  let eventBus;
  let mockLogger;
  let consoleSpy;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Spy on console methods since warnings use console directly
    consoleSpy = {
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
    };

    eventBus = new EventBus({ logger: mockLogger });
  });

  afterEach(() => {
    // Clean up console spies
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
  });

  describe('Batch Mode Configuration', () => {
    it('should enable batch mode with custom limits', () => {
      // Act
      eventBus.setBatchMode(true, {
        maxRecursionDepth: 15,
        maxGlobalRecursion: 50,
        timeoutMs: 60000,
        context: 'game-initialization',
      });

      // Assert
      expect(eventBus.isBatchModeEnabled()).toBe(true);
      expect(eventBus.getBatchModeOptions()).toEqual({
        maxRecursionDepth: 15,
        maxGlobalRecursion: 50,
        timeoutMs: 60000,
        context: 'game-initialization',
      });
    });

    it('should disable batch mode and clear options', () => {
      // Arrange
      eventBus.setBatchMode(true, { context: 'test' });

      // Act
      eventBus.setBatchMode(false);

      // Assert
      expect(eventBus.isBatchModeEnabled()).toBe(false);
      expect(eventBus.getBatchModeOptions()).toBeNull();
    });

    it('should auto-disable batch mode after timeout', (done) => {
      // Arrange
      const shortTimeout = 100;
      eventBus.setBatchMode(true, {
        timeoutMs: shortTimeout,
        context: 'timeout-test',
      });

      // Assert
      expect(eventBus.isBatchModeEnabled()).toBe(true);

      setTimeout(() => {
        expect(eventBus.isBatchModeEnabled()).toBe(false);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Auto-disabling batch mode after')
        );
        done();
      }, shortTimeout + 50);
    });
  });

  describe('Progressive Recursion Warnings', () => {
    it('should warn at 50% of recursion depth limit', async () => {
      // Arrange - Set batch mode with depth limit of 10
      eventBus.setBatchMode(true, {
        maxRecursionDepth: 10,
        maxGlobalRecursion: 20,
        context: 'warning-test',
      });

      // Create a recursive event scenario
      let recursionCount = 0;
      eventBus.subscribe('test:recursive', async () => {
        recursionCount++;
        if (recursionCount <= 5) {
          // Continue until depth 5 to trigger 50% warning
          await eventBus.dispatch('test:recursive');
        }
      });

      // Act
      await eventBus.dispatch('test:recursive');

      // Assert - Should warn at 50% (5 out of 10)
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Recursion depth warning - 50% of limit reached'
        )
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('test:recursive')
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('batch mode: warning-test')
      );
    });

    it('should warn at 75% of global recursion limit', async () => {
      // Arrange - Set batch mode with global limit of 20
      eventBus.setBatchMode(true, {
        maxRecursionDepth: 10,
        maxGlobalRecursion: 20,
        context: 'global-warning-test',
      });

      // Create multiple events to reach global recursion limit
      const eventNames = ['event1', 'event2', 'event3', 'event4'];
      let dispatchedCount = 0;

      eventNames.forEach((eventName) => {
        eventBus.subscribe(eventName, async () => {
          dispatchedCount++;
          if (dispatchedCount <= 15) {
            // Continue until 15 to trigger 75% warning
            const nextEvent = eventNames[dispatchedCount % eventNames.length];
            await eventBus.dispatch(nextEvent);
          }
        });
      });

      // Act
      await eventBus.dispatch('event1');

      // Assert - Should warn at 75% (15 out of 20)
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Global recursion warning - 75% of limit reached'
        )
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('(15/20)')
      );
    });

    it('should warn at 90% of recursion depth limit', async () => {
      // Arrange - Set batch mode with depth limit of 10
      eventBus.setBatchMode(true, {
        maxRecursionDepth: 10,
        maxGlobalRecursion: 50,
        context: '90percent-test',
      });

      let recursionCount = 0;
      eventBus.subscribe('test:90percent', async () => {
        recursionCount++;
        if (recursionCount <= 9) {
          // Continue until depth 9 to trigger 90% warning
          await eventBus.dispatch('test:90percent');
        }
      });

      // Act
      await eventBus.dispatch('test:90percent');

      // Assert - Should warn at 90% (9 out of 10)
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Recursion depth warning - 90% of limit reached'
        )
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('(9/10)')
      );
    });
  });

  describe('Recursion Limit Enforcement', () => {
    it('should block recursion when depth limit is exceeded in batch mode', async () => {
      // Arrange
      eventBus.setBatchMode(true, {
        maxRecursionDepth: 3,
        maxGlobalRecursion: 10,
        context: 'limit-test',
      });

      let callCount = 0;
      eventBus.subscribe('test:limit', async () => {
        callCount++;
        await eventBus.dispatch('test:limit');
      });

      // Act
      await eventBus.dispatch('test:limit');

      // Assert
      expect(callCount).toBe(3); // Should be limited to 3 calls
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Maximum recursion depth (3) exceeded'),
        expect.any(String),
        expect.any(String)
      );
      // Check that the error message includes batch mode context
      expect(consoleSpy.error.mock.calls[0][0]).toContain('batch mode: limit-test');
    });

    it('should block recursion when global limit is exceeded in batch mode', async () => {
      // Arrange
      eventBus.setBatchMode(true, {
        maxRecursionDepth: 10,
        maxGlobalRecursion: 5,
        context: 'global-limit-test',
      });

      const eventNames = ['event1', 'event2'];
      let totalCalls = 0;

      eventNames.forEach((eventName) => {
        eventBus.subscribe(eventName, async () => {
          totalCalls++;
          const nextEvent = eventNames[totalCalls % eventNames.length];
          await eventBus.dispatch(nextEvent);
        });
      });

      // Act
      await eventBus.dispatch('event1');

      // Assert - Should be limited by global limit
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Global recursion limit (5) exceeded')
      );
      // Check that the error message includes batch mode context
      expect(consoleSpy.error.mock.calls[0][0]).toContain('batch mode: global-limit-test');
    });
  });

  describe('Normal Mode vs Batch Mode Limits', () => {
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
    it('should use lower limits in normal mode', async () => {
      // Arrange - Normal mode (no batch mode enabled)
      let callCount = 0;
      eventBus.subscribe('test:normal', async () => {
        callCount++;
        await eventBus.dispatch('test:normal');
      });

      // Act
      await eventBus.dispatch('test:normal');

      // Assert - Should be limited to 10 in normal mode for non-workflow events
      expect(callCount).toBe(10);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Maximum recursion depth (10) exceeded'),
        expect.any(String),
        expect.any(String)
      );
      // Should not contain batch mode in error message since not in batch mode
      expect(consoleSpy.error.mock.calls[0][0]).not.toContain('batch mode:');
    });

    it('should use higher limits in batch mode', async () => {
      // Arrange - Batch mode enabled
      eventBus.setBatchMode(true, {
        maxRecursionDepth: 5,
        maxGlobalRecursion: 10,
        context: 'batch-limits',
      });

      let callCount = 0;
      eventBus.subscribe('test:batch', async () => {
        callCount++;
        await eventBus.dispatch('test:batch');
      });

      // Act
      await eventBus.dispatch('test:batch');

      // Assert - Should be limited to 5 in batch mode
      expect(callCount).toBe(5);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Maximum recursion depth (5) exceeded'),
        expect.any(String),
        expect.any(String)
      );
      // Check that the error message includes batch mode context
      expect(consoleSpy.error.mock.calls[0][0]).toContain('batch mode: batch-limits');
    });
  });

  describe('Critical Event Protection', () => {
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
    it('should use batch mode limits for error events (no longer treated as critical)', async () => {
      // Arrange
      eventBus.setBatchMode(true, {
        maxRecursionDepth: 10,
        maxGlobalRecursion: 20,
        context: 'critical-test',
      });

      let callCount = 0;
      eventBus.subscribe('core:system_error_occurred', async () => {
        callCount++;
        await eventBus.dispatch('core:system_error_occurred');
      });

      // Act
      await eventBus.dispatch('core:system_error_occurred');

      // Assert - Error events should use batch mode limits (10), no longer treated as critical
      expect(callCount).toBe(10);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Maximum recursion depth (10) exceeded'),
        expect.any(String),
        expect.any(String)
      );
    });
  });
});
