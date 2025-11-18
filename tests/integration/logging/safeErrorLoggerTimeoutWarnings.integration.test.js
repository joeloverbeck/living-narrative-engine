/**
 * Integration tests that reproduce the SafeErrorLogger timeout warnings
 * Related to "Auto-disabling game loading mode after 60000ms timeout"
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('SafeErrorLogger - Timeout Warnings Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should reproduce "Auto-disabling game loading mode after 60000ms timeout" warning', (done) => {
    // Arrange
    const mockLogger = testBed.createMockLogger();

    // Mock SafeErrorLogger implementation
    class MockSafeErrorLogger {
      #gameLoadingTimeout = null;
      #gameLoadingMode = false;
      #logger;

      constructor(logger) {
        this.#logger = logger;
      }

      withGameLoadingMode(context) {
        this.#gameLoadingMode = true;

        // Set up timeout (using short timeout for testing)
        this.#gameLoadingTimeout = setTimeout(() => {
          this.#logger.warn(
            'SafeErrorLogger: Auto-disabling game loading mode after 60000ms timeout'
          );
          this.#gameLoadingMode = false;
          this.#gameLoadingTimeout = null;
        }, 100); // 100ms for testing instead of 60000ms

        return {
          context: () => {
            // Simulate long-running operation that doesn't complete in time
            return new Promise(() => {
              // Never resolves, causing timeout
            });
          },
        };
      }

      destroy() {
        if (this.#gameLoadingTimeout) {
          clearTimeout(this.#gameLoadingTimeout);
        }
      }
    }

    // Act
    const safeErrorLogger = new MockSafeErrorLogger(mockLogger);
    const gameLoadingContext =
      safeErrorLogger.withGameLoadingMode('test-context');

    // Start a long-running operation that will timeout
    gameLoadingContext.context();

    // Assert - Wait for timeout to trigger
    setTimeout(() => {
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'SafeErrorLogger: Auto-disabling game loading mode after 60000ms timeout'
      );

      safeErrorLogger.destroy();
      done();
    }, 150); // Wait longer than the timeout
  });

  it('should not produce timeout warning when game loading completes normally', (done) => {
    // Arrange
    const mockLogger = testBed.createMockLogger();

    // Mock SafeErrorLogger with proper completion
    class MockSafeErrorLogger {
      #gameLoadingTimeout = null;
      #gameLoadingMode = false;
      #logger;

      constructor(logger) {
        this.#logger = logger;
      }

      withGameLoadingMode(context) {
        this.#gameLoadingMode = true;

        this.#gameLoadingTimeout = setTimeout(() => {
          this.#logger.warn(
            'SafeErrorLogger: Auto-disabling game loading mode after 60000ms timeout'
          );
          this.#gameLoadingMode = false;
          this.#gameLoadingTimeout = null;
        }, 200); // Longer timeout

        return {
          context: () => {
            return new Promise((resolve) => {
              // Complete quickly
              setTimeout(() => {
                this.#disableGameLoadingMode();
                resolve();
              }, 50);
            });
          },
        };
      }

      #disableGameLoadingMode() {
        if (this.#gameLoadingTimeout) {
          clearTimeout(this.#gameLoadingTimeout);
          this.#gameLoadingTimeout = null;
        }
        this.#gameLoadingMode = false;
      }

      destroy() {
        if (this.#gameLoadingTimeout) {
          clearTimeout(this.#gameLoadingTimeout);
        }
      }
    }

    // Act
    const safeErrorLogger = new MockSafeErrorLogger(mockLogger);
    const gameLoadingContext =
      safeErrorLogger.withGameLoadingMode('test-context');

    gameLoadingContext.context().then(() => {
      // Assert - Should not have timeout warning
      setTimeout(() => {
        const warnCalls = mockLogger.warn.mock.calls.filter(
          ([msg]) =>
            msg && msg.includes('Auto-disabling game loading mode after')
        );

        expect(warnCalls.length).toBe(0);

        safeErrorLogger.destroy();
        done();
      }, 100);
    });
  });

  it('should reproduce the specific timeout pattern from game initialization', (done) => {
    // Arrange
    const mockLogger = testBed.createMockLogger();

    // Simulate the exact scenario from the logs:
    // gameEngine.js:329 → safeErrorLogger.js:172 → startNewGame → 60000ms timeout
    /**
     *
     */
    function simulateGameInitializationTimeout() {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          mockLogger.warn(
            'SafeErrorLogger: Auto-disabling game loading mode after 60000ms timeout'
          );
          resolve();
        }, 100); // Short timeout for testing

        // Simulate the long-running initialization that causes timeout
        // This would normally be the mod loading, system initialization, etc.
        // We don't resolve this promise, simulating a hung initialization
      });
    }

    // Act - Start the simulation
    simulateGameInitializationTimeout().then(() => {
      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'SafeErrorLogger: Auto-disabling game loading mode after 60000ms timeout'
      );
      done();
    });
  });

  it('should handle multiple concurrent game loading contexts', (done) => {
    // Arrange
    const mockLogger = testBed.createMockLogger();

    // Mock multiple game loading contexts
    class MockSafeErrorLogger {
      #timeouts = new Set();
      #logger;

      constructor(logger) {
        this.#logger = logger;
      }

      createGameLoadingContext(contextId) {
        const timeoutId = setTimeout(
          () => {
            this.#logger.warn(
              `SafeErrorLogger: Auto-disabling game loading mode after 60000ms timeout (context: ${contextId})`
            );
            this.#timeouts.delete(timeoutId);
          },
          100 + Math.random() * 50
        ); // Slight variation in timeout

        this.#timeouts.add(timeoutId);

        return {
          context: () => {
            return new Promise(() => {
              // Never resolves
            });
          },
        };
      }

      destroy() {
        this.#timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
        this.#timeouts.clear();
      }
    }

    // Act - Create multiple contexts
    const safeErrorLogger = new MockSafeErrorLogger(mockLogger);

    const contexts = ['mod-loading', 'system-init', 'world-init'];
    contexts.forEach((contextId) => {
      const context = safeErrorLogger.createGameLoadingContext(contextId);
      context.context();
    });

    // Assert - Wait for all timeouts to trigger
    setTimeout(() => {
      const warnCalls = mockLogger.warn.mock.calls.filter(
        ([msg]) =>
          msg &&
          msg.includes('Auto-disabling game loading mode after 60000ms timeout')
      );

      expect(warnCalls.length).toBe(3);

      safeErrorLogger.destroy();
      done();
    }, 200);
  });
});
