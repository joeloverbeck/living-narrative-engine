/**
 * @file Custom Jest matchers for logger testing
 * @see tests/common/actionResultMatchers.js
 */

import { expect } from '@jest/globals';
import LogCategoryDetector from '../../src/logging/logCategoryDetector.js';
import {
  validateLoggerMock,
  getAllLogMessages,
  getCallsByLevel,
} from './loggerTestUtils.js';

/**
 * Custom Jest matchers for logger testing
 */
export const loggerMatchers = {
  /**
   * Matches that a logger was called with a debug message containing specific text.
   *
   * @param {object} received - The logger mock to test
   * @param {string} message - Expected message content (partial match)
   * @returns {object} Jest matcher result
   */
  toHaveLoggedDebug(received, message) {
    try {
      validateLoggerMock(received, 'toHaveLoggedDebug');
    } catch (error) {
      return {
        pass: false,
        message: () =>
          `Expected a valid logger mock, but got error: ${error.message}`,
      };
    }

    const calls = getCallsByLevel(received, 'debug');
    const pass = calls.some(
      ([msg]) => typeof msg === 'string' && msg.includes(message)
    );

    return {
      pass,
      message: () =>
        pass
          ? `Expected not to log debug message containing: "${message}"`
          : `Expected to log debug message containing: "${message}"\nActual debug calls: ${JSON.stringify(calls.map((call) => call[0]))}`,
    };
  },

  /**
   * Matches that a logger was called with an info message containing specific text.
   *
   * @param {object} received - The logger mock to test
   * @param {string} message - Expected message content (partial match)
   * @returns {object} Jest matcher result
   */
  toHaveLoggedInfo(received, message) {
    try {
      validateLoggerMock(received, 'toHaveLoggedInfo');
    } catch (error) {
      return {
        pass: false,
        message: () =>
          `Expected a valid logger mock, but got error: ${error.message}`,
      };
    }

    const calls = getCallsByLevel(received, 'info');
    const pass = calls.some(
      ([msg]) => typeof msg === 'string' && msg.includes(message)
    );

    return {
      pass,
      message: () =>
        pass
          ? `Expected not to log info message containing: "${message}"`
          : `Expected to log info message containing: "${message}"\nActual info calls: ${JSON.stringify(calls.map((call) => call[0]))}`,
    };
  },

  /**
   * Matches that a logger was called with a warning message containing specific text.
   *
   * @param {object} received - The logger mock to test
   * @param {string} message - Expected message content (partial match)
   * @returns {object} Jest matcher result
   */
  toHaveLoggedWarning(received, message) {
    try {
      validateLoggerMock(received, 'toHaveLoggedWarning');
    } catch (error) {
      return {
        pass: false,
        message: () =>
          `Expected a valid logger mock, but got error: ${error.message}`,
      };
    }

    const calls = getCallsByLevel(received, 'warn');
    const pass = calls.some(
      ([msg]) => typeof msg === 'string' && msg.includes(message)
    );

    return {
      pass,
      message: () =>
        pass
          ? `Expected not to log warning message containing: "${message}"`
          : `Expected to log warning message containing: "${message}"\nActual warning calls: ${JSON.stringify(calls.map((call) => call[0]))}`,
    };
  },

  /**
   * Matches that a logger was called with an error message containing specific text.
   *
   * @param {object} received - The logger mock to test
   * @param {string} message - Expected message content (partial match)
   * @returns {object} Jest matcher result
   */
  toHaveLoggedError(received, message) {
    try {
      validateLoggerMock(received, 'toHaveLoggedError');
    } catch (error) {
      return {
        pass: false,
        message: () =>
          `Expected a valid logger mock, but got error: ${error.message}`,
      };
    }

    const calls = getCallsByLevel(received, 'error');
    const pass = calls.some(
      ([msg]) => typeof msg === 'string' && msg.includes(message)
    );

    return {
      pass,
      message: () =>
        pass
          ? `Expected not to log error message containing: "${message}"`
          : `Expected to log error message containing: "${message}"\nActual error calls: ${JSON.stringify(calls.map((call) => call[0]))}`,
    };
  },

  /**
   * Matches that a logger has messages belonging to a specific category using LogCategoryDetector.
   *
   * @param {object} received - The logger mock to test
   * @param {string} expectedCategory - Expected log category
   * @returns {object} Jest matcher result
   */
  toHaveLoggedCategory(received, expectedCategory) {
    try {
      validateLoggerMock(received, 'toHaveLoggedCategory');
    } catch (error) {
      return {
        pass: false,
        message: () =>
          `Expected a valid logger mock, but got error: ${error.message}`,
      };
    }

    const categoryDetector = new LogCategoryDetector();
    const allMessages = getAllLogMessages(received);

    const pass = allMessages.some(
      (msg) => categoryDetector.detectCategory(msg) === expectedCategory
    );

    const detectedCategories = [
      ...new Set(
        allMessages
          .map((msg) => categoryDetector.detectCategory(msg))
          .filter((cat) => cat)
      ),
    ];

    return {
      pass,
      message: () =>
        pass
          ? `Expected not to log category: "${expectedCategory}"`
          : `Expected to log category: "${expectedCategory}"\nDetected categories: [${detectedCategories.join(', ')}]\nAll messages: ${JSON.stringify(allMessages)}`,
    };
  },

  /**
   * Matches that a logger was not called at all for a specific level.
   *
   * @param {object} received - The logger mock to test
   * @param {string} level - Log level to check ('debug', 'info', 'warn', 'error')
   * @returns {object} Jest matcher result
   */
  toNotHaveLoggedAtLevel(received, level) {
    try {
      validateLoggerMock(received, 'toNotHaveLoggedAtLevel');
    } catch (error) {
      return {
        pass: false,
        message: () =>
          `Expected a valid logger mock, but got error: ${error.message}`,
      };
    }

    if (!['debug', 'info', 'warn', 'error'].includes(level)) {
      return {
        pass: false,
        message: () =>
          `Invalid log level: "${level}". Must be one of: debug, info, warn, error`,
      };
    }

    const calls = getCallsByLevel(received, level);
    const pass = calls.length === 0;

    return {
      pass,
      message: () =>
        pass
          ? `Expected to have logged at level "${level}", but no calls were made`
          : `Expected not to have logged at level "${level}", but found ${calls.length} calls: ${JSON.stringify(calls.map((call) => call[0]))}`,
    };
  },

  /**
   * Matches that a logger has a specific number of calls at a given level.
   *
   * @param {object} received - The logger mock to test
   * @param {string} level - Log level to check
   * @param {number} expectedCount - Expected number of calls
   * @returns {object} Jest matcher result
   */
  toHaveLoggedCountAtLevel(received, level, expectedCount) {
    try {
      validateLoggerMock(received, 'toHaveLoggedCountAtLevel');
    } catch (error) {
      return {
        pass: false,
        message: () =>
          `Expected a valid logger mock, but got error: ${error.message}`,
      };
    }

    if (!['debug', 'info', 'warn', 'error'].includes(level)) {
      return {
        pass: false,
        message: () =>
          `Invalid log level: "${level}". Must be one of: debug, info, warn, error`,
      };
    }

    const calls = getCallsByLevel(received, level);
    const actualCount = calls.length;
    const pass = actualCount === expectedCount;

    return {
      pass,
      message: () =>
        pass
          ? `Expected not to have ${expectedCount} calls at level "${level}", but found exactly that many`
          : `Expected ${expectedCount} calls at level "${level}", but found ${actualCount} calls`,
    };
  },

  /**
   * Matches that a logger contains messages in a specific sequence.
   *
   * @param {object} received - The logger mock to test
   * @param {Array<{level: string, message: string}>} expectedSequence - Expected log sequence
   * @returns {object} Jest matcher result
   */
  toHaveLoggedSequence(received, expectedSequence) {
    try {
      validateLoggerMock(received, 'toHaveLoggedSequence');
    } catch (error) {
      return {
        pass: false,
        message: () =>
          `Expected a valid logger mock, but got error: ${error.message}`,
      };
    }

    const allCalls = [];

    // Collect calls from all levels in order
    ['debug', 'info', 'warn', 'error'].forEach((level) => {
      if (received[level] && received[level].mock) {
        received[level].mock.calls.forEach((call, index) => {
          allCalls.push({
            level,
            message: call[0] || '',
            timestamp: received[level].mock.invocationCallOrder?.[index] || 0,
          });
        });
      }
    });

    // Sort by timestamp to maintain call order
    allCalls.sort((a, b) => a.timestamp - b.timestamp);

    const pass = expectedSequence.every((expected, index) => {
      const actual = allCalls[index];
      return (
        actual &&
        actual.level === expected.level &&
        actual.message.includes(expected.message)
      );
    });

    const actualSequence = allCalls
      .slice(0, expectedSequence.length)
      .map((call) => ({
        level: call.level,
        message: call.message,
      }));

    return {
      pass,
      message: () =>
        pass
          ? `Expected not to match log sequence, but it did`
          : `Expected log sequence to match:\n${JSON.stringify(expectedSequence, null, 2)}\nActual sequence:\n${JSON.stringify(actualSequence, null, 2)}`,
    };
  },
};

/**
 * Extends Jest's expect with custom logger matchers
 */
export function extendExpectWithLoggerMatchers() {
  expect.extend(loggerMatchers);
}

// Auto-extend when imported
extendExpectWithLoggerMatchers();

export default loggerMatchers;
