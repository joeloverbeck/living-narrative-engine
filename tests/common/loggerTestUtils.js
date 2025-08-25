/**
 * @file Logger test utilities for parsing and analyzing mock logger calls
 * @see tests/common/mockFactories/loggerMocks.js
 */

import LogCategoryDetector from '../../src/logging/logCategoryDetector.js';
import { validateDependency } from '../../src/utils/dependencyUtils.js';

/**
 * Validates that a logger mock meets ILogger interface requirements.
 *
 * @param {object} logger - Logger mock to validate
 * @param {string} context - Context for validation errors
 */
export function validateLoggerMock(logger, context) {
  validateDependency(logger, 'ILogger', console, {
    requiredMethods: ['debug', 'info', 'warn', 'error'],
    context,
  });
}

/**
 * Gets all log messages from all levels in the order they were called.
 *
 * @param {object} logger - Mock logger instance
 * @returns {Array<{level: string, message: string, timestamp: number, args: Array}>} Ordered log entries
 */
export function getAllCallsInOrder(logger) {
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
export function getAllLogMessages(logger) {
  const allCalls = getAllCallsInOrder(logger);
  return allCalls.map((call) => call.message);
}

/**
 * Gets all log calls for a specific level.
 *
 * @param {object} logger - Mock logger instance
 * @param {string} level - Log level ('debug', 'info', 'warn', 'error')
 * @returns {Array} Array of calls for the specified level
 */
export function getCallsByLevel(logger, level) {
  if (!logger[level] || !logger[level].mock) {
    return [];
  }
  return logger[level].mock.calls;
}

/**
 * Checks if a logger has been called with a specific message at any level.
 *
 * @param {object} logger - Mock logger instance
 * @param {string} message - Message to search for (partial match)
 * @returns {boolean} True if message was logged at any level
 */
export function hasLoggedMessage(logger, message) {
  const allMessages = getAllLogMessages(logger);
  return allMessages.some((msg) => msg.includes(message));
}

/**
 * Gets all messages that contain a specific substring.
 *
 * @param {object} logger - Mock logger instance
 * @param {string} substring - Substring to search for
 * @returns {Array<{level: string, message: string}>} Matching log entries
 */
export function getLogEntriesContaining(logger, substring) {
  const allCalls = getAllCallsInOrder(logger);
  return allCalls
    .filter((call) => call.message.includes(substring))
    .map((call) => ({ level: call.level, message: call.message }));
}

/**
 * Validates that a sequence of log calls occurred in the expected order.
 *
 * @param {object} logger - Mock logger instance
 * @param {Array<{level: string, message: string}>} expectedSequence - Expected log sequence
 * @returns {{isValid: boolean, errors: string[]}} Validation result
 */
export function validateLogSequence(logger, expectedSequence) {
  const allCalls = getAllCallsInOrder(logger);
  const errors = [];

  if (allCalls.length < expectedSequence.length) {
    errors.push(
      `Expected ${expectedSequence.length} log calls, but got ${allCalls.length}`
    );
    return { isValid: false, errors };
  }

  expectedSequence.forEach((expected, index) => {
    const actual = allCalls[index];

    if (!actual) {
      errors.push(`Expected log call at position ${index}, but no call found`);
      return;
    }

    if (actual.level !== expected.level) {
      errors.push(
        `Expected level '${expected.level}' at position ${index}, but got '${actual.level}'`
      );
    }

    if (!actual.message.includes(expected.message)) {
      errors.push(
        `Expected message containing '${expected.message}' at position ${index}, but got '${actual.message}'`
      );
    }
  });

  return { isValid: errors.length === 0, errors };
}

/**
 * Gets log statistics for analysis.
 *
 * @param {object} logger - Mock logger instance
 * @returns {object} Statistics about log usage
 */
export function getLogStatistics(logger) {
  const stats = {
    totalCalls: 0,
    callsByLevel: {},
    categoryCounts: {},
    uniqueMessages: new Set(),
  };

  ['debug', 'info', 'warn', 'error'].forEach((level) => {
    const calls = getCallsByLevel(logger, level);
    stats.callsByLevel[level] = calls.length;
    stats.totalCalls += calls.length;

    calls.forEach((call) => {
      const message = call[0] || '';
      stats.uniqueMessages.add(message);
    });
  });

  // Convert unique messages to count
  stats.uniqueMessageCount = stats.uniqueMessages.size;
  delete stats.uniqueMessages;

  // Analyze categories if messages exist
  if (stats.totalCalls > 0) {
    const categoryDetector = new LogCategoryDetector();
    const allMessages = getAllLogMessages(logger);

    allMessages.forEach((msg) => {
      const category = categoryDetector.detectCategory(msg);
      if (category) {
        stats.categoryCounts[category] =
          (stats.categoryCounts[category] || 0) + 1;
      }
    });
  }

  return stats;
}

/**
 * Clears all mock call history for a logger.
 *
 * @param {object} logger - Mock logger instance
 */
export function clearAllLoggerCalls(logger) {
  [
    'debug',
    'info',
    'warn',
    'error',
    'groupCollapsed',
    'groupEnd',
    'table',
  ].forEach((level) => {
    if (logger[level] && logger[level].mockClear) {
      logger[level].mockClear();
    }
  });
}

/**
 * Creates a debug representation of all logger calls for troubleshooting.
 *
 * @param {object} logger - Mock logger instance
 * @returns {string} Formatted string showing all calls
 */
export function debugLoggerCalls(logger) {
  const allCalls = getAllCallsInOrder(logger);

  if (allCalls.length === 0) {
    return 'No log calls recorded';
  }

  return allCalls
    .map(
      (call, index) =>
        `${index + 1}. [${call.level.toUpperCase()}] ${call.message}`
    )
    .join('\n');
}

/**
 * Gets all log messages that match a specific category using LogCategoryDetector.
 *
 * @param {object} logger - Mock logger instance
 * @param {string} category - Category to filter by
 * @returns {string[]} Array of messages in the specified category
 */
export function getLogsByCategory(logger, category) {
  const categoryDetector = new LogCategoryDetector();
  return getAllLogMessages(logger).filter(
    (msg) => categoryDetector.detectCategory(msg) === category
  );
}

/**
 * Gets all unique categories detected in the logger messages.
 *
 * @param {object} logger - Mock logger instance
 * @returns {string[]} Array of detected categories
 */
export function getDetectedCategories(logger) {
  const categoryDetector = new LogCategoryDetector();
  const allMessages = getAllLogMessages(logger);
  const categories = new Set();

  allMessages.forEach((msg) => {
    const category = categoryDetector.detectCategory(msg);
    if (category) categories.add(category);
  });

  return Array.from(categories);
}
