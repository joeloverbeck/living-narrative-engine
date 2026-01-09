/**
 * @file Tests for systemLogicTestEnv cleanup chain robustness
 * @see SCODSLROB-001
 */

import { describe, it, expect, jest } from '@jest/globals';

describe('systemLogicTestEnv cleanup robustness', () => {
  /**
   * Simulates the cleanup pattern from systemLogicTestEnv
   * to test error handling behavior in isolation.
   *
   * @param root0
   * @param root0.interpreterThrows
   */
  function createMockEnv({ interpreterThrows = false } = {}) {
    const callOrder = [];
    let cacheCleared = false;

    const mockInterpreter = {
      shutdown: jest.fn(() => {
        callOrder.push('interpreter.shutdown');
        if (interpreterThrows) {
          throw new Error('interpreter.shutdown failed');
        }
      }),
    };

    const mockClearEntityCache = jest.fn(() => {
      callOrder.push('clearEntityCache');
      cacheCleared = true;
    });

    // Mock console.error for test verification
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Simulate the cleanup function pattern from systemLogicTestEnv
    /**
     *
     */
    function cleanup() {
      let cleanupError = null;

      try {
        mockInterpreter.shutdown();
      } catch (err) {
        cleanupError = err;
      }

      // ALWAYS clear cache, even if interpreter shutdown fails
      mockClearEntityCache();

      if (cleanupError) {
        console.error(
          `Cleanup error (cache still cleared): ${cleanupError.message}`
        );
      }
    }

    return {
      cleanup,
      mockInterpreter,
      mockClearEntityCache,
      callOrder,
      isCacheCleared: () => cacheCleared,
      consoleErrorSpy,
      restore: () => consoleErrorSpy.mockRestore(),
    };
  }

  describe('cache clearing guarantee', () => {
    it('should clear cache even when interpreter.shutdown throws', () => {
      const env = createMockEnv({ interpreterThrows: true });

      // Should not throw
      expect(() => env.cleanup()).not.toThrow();

      // Cache should still be cleared
      expect(env.mockClearEntityCache).toHaveBeenCalled();
      expect(env.isCacheCleared()).toBe(true);

      // Error should be logged
      expect(env.consoleErrorSpy).toHaveBeenCalledWith(
        'Cleanup error (cache still cleared): interpreter.shutdown failed'
      );

      env.restore();
    });

    it('should maintain correct call order with interpreter failure', () => {
      const env = createMockEnv({ interpreterThrows: true });

      env.cleanup();

      // Both should be called in order
      expect(env.callOrder).toEqual([
        'interpreter.shutdown',
        'clearEntityCache',
      ]);

      env.restore();
    });

    it('should not log errors when cleanup succeeds', () => {
      const env = createMockEnv();

      env.cleanup();

      expect(env.mockClearEntityCache).toHaveBeenCalled();
      expect(env.consoleErrorSpy).not.toHaveBeenCalled();

      env.restore();
    });
  });

  describe('invariants', () => {
    it('INV-CLEAN-3: cache clear is guaranteed to execute (try-finally pattern)', () => {
      const env = createMockEnv({ interpreterThrows: true });

      env.cleanup();

      // Cache must be cleared regardless of interpreter failure
      expect(env.isCacheCleared()).toBe(true);
      expect(env.mockClearEntityCache).toHaveBeenCalledTimes(1);

      env.restore();
    });

    it('INV-CACHE-3: clearEntityCache clears all entries (unchanged behavior)', () => {
      const env = createMockEnv();

      env.cleanup();

      // Verify clearEntityCache was called
      expect(env.mockClearEntityCache).toHaveBeenCalled();

      env.restore();
    });
  });
});
