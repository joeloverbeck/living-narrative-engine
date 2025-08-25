/* global expect */

import { createSimpleMock } from './coreServices.js';
import LogCategoryDetector from '../../../src/logging/logCategoryDetector.js';

/**
 * Creates a basic mock logger for standard testing needs.
 *
 * @returns {object} Mock logger with jest.fn methods
 */
export const createMockLogger = () =>
  createSimpleMock([
    // Core ILogger methods
    'info',
    'warn',
    'error',
    'debug',
    // Extended ConsoleLogger methods
    'groupCollapsed',
    'groupEnd',
    'table',
    'setLogLevel',
  ]);

/**
 * Gets all log messages from all levels in the order they were called.
 *
 * @param {object} logger - Mock logger instance
 * @returns {Array<{level: string, message: string, timestamp: number}>} Ordered log entries
 */
function getAllCallsInOrder(logger) {
  const calls = [];

  // Collect calls from all levels
  ['debug', 'info', 'warn', 'error'].forEach((level) => {
    if (logger[level] && logger[level].mock) {
      logger[level].mock.calls.forEach((call, index) => {
        calls.push({
          level,
          message: call[0] || '',
          args: call,
          callIndex: index,
          // Use invocationCallOrder for proper ordering
          timestamp: logger[level].mock.invocationCallOrder?.[index] || 0,
        });
      });
    }
  });

  // Sort by timestamp to maintain call order
  return calls.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Gets all log messages from all levels as a flat array.
 *
 * @param {object} logger - Mock logger instance
 * @returns {string[]} Array of log messages
 */
function getAllLogMessages(logger) {
  const allCalls = getAllCallsInOrder(logger);
  return allCalls.map((call) => call.message);
}

/**
 * Creates an enhanced mock logger with additional testing utilities.
 *
 * @param {object} [defaults] - Optional default implementations
 * @returns {object} Enhanced mock logger with utility methods
 */
export const createEnhancedMockLogger = (defaults = {}) => {
  const baseLogger = createMockLogger();

  // Apply any defaults
  Object.assign(baseLogger, defaults);

  // Test utility methods
  baseLogger.getDebugCalls = () => baseLogger.debug.mock.calls;
  baseLogger.getCallsByLevel = (level) => {
    if (!baseLogger[level] || !baseLogger[level].mock) {
      return [];
    }
    return baseLogger[level].mock.calls;
  };

  baseLogger.clearAllCalls = () => {
    [
      'debug',
      'info',
      'warn',
      'error',
      'groupCollapsed',
      'groupEnd',
      'table',
    ].forEach((level) => {
      if (baseLogger[level] && baseLogger[level].mockClear) {
        baseLogger[level].mockClear();
      }
    });
  };

  // Assertion helper methods (require expect to be available in test context)
  baseLogger.expectDebugMessage = (message) => {
    // Note: This requires expect to be available in the test context where it's called
    if (typeof expect !== 'undefined') {
      expect(baseLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    } else {
      throw new Error(
        'expectDebugMessage requires Jest expect to be available'
      );
    }
  };

  baseLogger.expectNoDebugCalls = () => {
    if (typeof expect !== 'undefined') {
      expect(baseLogger.debug).not.toHaveBeenCalled();
    } else {
      throw new Error(
        'expectNoDebugCalls requires Jest expect to be available'
      );
    }
  };

  baseLogger.expectLogSequence = (sequence) => {
    if (typeof expect !== 'undefined') {
      const allCalls = getAllCallsInOrder(baseLogger);
      sequence.forEach((expected, index) => {
        const actual = allCalls[index];
        expect(actual.level).toBe(expected.level);
        expect(actual.message).toContain(expected.message);
      });
    } else {
      throw new Error('expectLogSequence requires Jest expect to be available');
    }
  };

  // Category analysis using LogCategoryDetector
  baseLogger.getCategories = () => {
    const categoryDetector = new LogCategoryDetector();
    const allMessages = getAllLogMessages(baseLogger);
    const categories = new Set();

    allMessages.forEach((msg) => {
      const category = categoryDetector.detectCategory(msg);
      if (category) categories.add(category);
    });

    return Array.from(categories);
  };

  baseLogger.getLogsByCategory = (category) => {
    const categoryDetector = new LogCategoryDetector();
    return getAllLogMessages(baseLogger).filter(
      (msg) => categoryDetector.detectCategory(msg) === category
    );
  };

  return baseLogger;
};
