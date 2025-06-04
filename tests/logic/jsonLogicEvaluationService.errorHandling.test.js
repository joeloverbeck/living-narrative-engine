// src/tests/logic/jsonLogicEvaluationService.errorHandling.test.js

/**
 * @jest-environment node
 */
import {
  describe,
  expect,
  test,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import jsonLogic from 'json-logic-js'; // Import the actual library to spy on
import JsonLogicEvaluationService from '../../src/logic/jsonLogicEvaluationService.js'; // Adjust path as needed

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */

// --- Mock Dependencies ---

// Mock ILogger (Required by Service)
/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// --- Helper Functions for Assertions ---
// (Keep these helpers as they are used in logging assertions for other test cases)
/**
 * Creates a simplified summary of a JSON Logic rule (e.g., for logging).
 *
 * @param {JSONLogicRule | any} rule The rule object.
 * @returns {string} A string summary.
 */
const getRuleSummary = (rule) => {
  try {
    if (rule === null) return 'null';
    const str = JSON.stringify(rule);
    if (typeof str !== 'string') return '[Unserializable Rule]';
    return str.length > 150 ? str.substring(0, 147) + '...' : str;
  } catch (e) {
    return '[Unserializable Rule]';
  }
};

/**
 * Gets the top-level keys from the context object as a string (e.g., for logging).
 *
 * @param {JsonLogicEvaluationContext | any} context The context object.
 * @returns {string} Comma-separated string of top-level keys.
 */
const getContextKeysString = (context) => {
  if (!context || typeof context !== 'object') {
    return '';
  }
  return Object.keys(context).join(', ');
};

// --- Test Suite for Error Handling Scenarios ---

describe('JsonLogicEvaluationService - Error Handling (Ticket 2.6.5)', () => {
  let service;
  /** @type {jest.SpyInstance} */
  let applySpy; // To hold the spy for jsonLogic.apply

  /** @type {JSONLogicRule} */
  const dummyRule = { '==': [1, 1] }; // Simple valid rule structure
  /** @type {JsonLogicEvaluationContext} */
  const dummyContext = {
    event: { type: 'DUMMY', payload: {} },
    actor: null,
    target: null,
    context: { turn: 1 },
    globals: { gameVersion: '1.0' },
    entities: {},
  };
  const expectedRuleSummary = getRuleSummary(dummyRule);
  const expectedContextKeysStr = getContextKeysString(dummyContext);

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
    service = new JsonLogicEvaluationService({ logger: mockLogger });
    mockLogger.info.mockClear();
    applySpy = jest.spyOn(jsonLogic, 'apply');
  });

  afterEach(() => {
    if (applySpy) {
      applySpy.mockRestore();
    }
  });

  // --- Test Case: Exception during evaluation ---
  // (This suite should remain the same, as the original code handles exceptions correctly)
  describe('when jsonLogic.apply throws an error', () => {
    const evaluationError = new Error('Evaluation Failed!');

    beforeEach(() => {
      applySpy.mockImplementation(() => {
        throw evaluationError;
      });
    });

    test('should return false', () => {
      const result = service.evaluate(dummyRule, dummyContext);
      expect(result).toBe(false); // Correct: catch block returns false
    });

    test('should call jsonLogic.apply once with the rule and context', () => {
      service.evaluate(dummyRule, dummyContext);
      expect(applySpy).toHaveBeenCalledTimes(1);
      expect(applySpy).toHaveBeenCalledWith(dummyRule, dummyContext);
    });

    test('should log an error message indicating evaluation failure, including rule/context info and the error', () => {
      service.evaluate(dummyRule, dummyContext);
      expect(mockLogger.error).toHaveBeenCalledTimes(1); // Correct: catch block logs error
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error evaluating JSON Logic rule: ${expectedRuleSummary}. Context keys: ${expectedContextKeysStr}`,
        evaluationError // Correct: catch block logs the error object
      );
    });
  });

  // --- Test Case: Non-boolean return type from evaluation (MODIFIED) ---
  // Tests are adjusted to expect the truthy/falsy conversion performed by `!!rawResult`
  // and to NOT expect an error log in these cases.
  describe('when jsonLogic.apply returns a non-boolean value', () => {
    // Define test cases including their expected boolean result based on truthiness
    const nonBooleanTestCases = [
      // Truthy values
      {
        value: 123,
        type: 'number',
        description: 'a number (123)',
        expectedResult: true,
      },
      {
        value: 'unexpected',
        type: 'string',
        description: 'a string ("unexpected")',
        expectedResult: true,
      },
      {
        value: {},
        type: 'object',
        description: 'an object ({})',
        expectedResult: true,
      },
      {
        value: [],
        type: 'object',
        description: 'an array ([])',
        expectedResult: true,
      }, // Empty array is truthy
      // Falsy values
      {
        value: 0,
        type: 'number',
        description: 'a number (0)',
        expectedResult: false,
      },
      {
        value: null,
        type: 'object',
        description: 'null',
        expectedResult: false,
      },
      {
        value: undefined,
        type: 'undefined',
        description: 'undefined',
        expectedResult: false,
      },
      // { value: "",          type: 'string',    description: 'an empty string ("")',   expectedResult: false }, // Optional: Add empty string if relevant
      // { value: NaN,         type: 'number',    description: 'NaN',                     expectedResult: false }, // Optional: Add NaN if relevant
    ];

    // Use test.each to run the modified assertions
    test.each(nonBooleanTestCases)(
      'should return $expectedResult (truthiness of $description) and NOT log an error when jsonLogic.apply returns $description',
      ({ value, type, description, expectedResult }) => {
        // Added expectedResult
        // Configure the mock to return the specific non-boolean value
        applySpy.mockReturnValue(value);

        const result = service.evaluate(dummyRule, dummyContext);

        // --- MODIFIED ASSERTIONS ---
        expect(result).toBe(expectedResult); // Assert based on truthiness conversion (!!value)

        expect(applySpy).toHaveBeenCalledTimes(1); // Apply should still have been called
        expect(applySpy).toHaveBeenCalledWith(dummyRule, dummyContext);

        expect(mockLogger.error).not.toHaveBeenCalled(); // Assert that error logger was NOT called
        // logger.debug *would* be called by the original code, but we aren't testing debug logs here.
      }
    );
  });

  // --- Test Case: Invalid Inputs Passed to Service ---
  // (This suite should remain the same, as it tests the behavior when jsonLogic.apply *throws* due to bad inputs,
  // which is handled by the catch block in the original code)
  describe('when evaluate is called with invalid arguments', () => {
    // Test case: Rule is null
    test('should return false and log error if the rule is null (causing jsonLogic.apply to throw)', () => {
      const invalidRule = null;
      const invalidRuleSummary = getRuleSummary(invalidRule);
      const expectedContextKeysStr = getContextKeysString(dummyContext);
      let capturedError = null;

      applySpy.mockImplementation(() => {
        const err = new TypeError('Simulated error: Invalid rule: null'); // Simulate json-logic-js throwing
        capturedError = err;
        throw err;
      });

      const result = service.evaluate(invalidRule, dummyContext);

      expect(result).toBe(false); // Correct: catch block returns false
      expect(applySpy).toHaveBeenCalledTimes(1);
      expect(applySpy).toHaveBeenCalledWith(invalidRule, dummyContext);
      expect(mockLogger.error).toHaveBeenCalledTimes(1); // Correct: catch block logs error
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error evaluating JSON Logic rule: ${invalidRuleSummary}. Context keys: ${expectedContextKeysStr}`,
        capturedError // Correct: catch block logs the error
      );
    });

    // Test case: Rule is not an object (e.g., a string)
    test('should return false and log error if the rule is not an object (causing jsonLogic.apply to throw)', () => {
      const invalidRule = 'this is not a rule object';
      const invalidRuleSummary = getRuleSummary(invalidRule);
      const expectedContextKeysStr = getContextKeysString(dummyContext);
      let capturedError = null;

      applySpy.mockImplementation(() => {
        const err = new TypeError(
          `Simulated error: Invalid rule: ${invalidRule}`
        );
        capturedError = err;
        throw err;
      });

      const result = service.evaluate(invalidRule, dummyContext);

      expect(result).toBe(false); // Correct: catch block returns false
      expect(applySpy).toHaveBeenCalledTimes(1);
      expect(applySpy).toHaveBeenCalledWith(invalidRule, dummyContext);
      expect(mockLogger.error).toHaveBeenCalledTimes(1); // Correct: catch block logs error
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error evaluating JSON Logic rule: ${invalidRuleSummary}. Context keys: ${expectedContextKeysStr}`,
        capturedError
      );
    });

    // Test case: Context is null
    test('should return false and log error if the context is null (causing jsonLogic.apply to throw)', () => {
      const invalidContext = null;
      const expectedRuleSummary = getRuleSummary(dummyRule);
      const expectedContextKeysStr = getContextKeysString(invalidContext); // ""
      let capturedError = null;

      applySpy.mockImplementation(() => {
        const err = new TypeError('Simulated error: Invalid context: null');
        capturedError = err;
        throw err;
      });

      const result = service.evaluate(dummyRule, invalidContext);

      expect(result).toBe(false); // Correct: catch block returns false
      expect(applySpy).toHaveBeenCalledTimes(1);
      expect(applySpy).toHaveBeenCalledWith(dummyRule, invalidContext);
      expect(mockLogger.error).toHaveBeenCalledTimes(1); // Correct: catch block logs error
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error evaluating JSON Logic rule: ${expectedRuleSummary}. Context keys: ${expectedContextKeysStr}`,
        capturedError
      );
    });

    // Test case: Context is not an object (e.g., a number)
    test('should return false and log error if the context is not an object (causing jsonLogic.apply to throw)', () => {
      const invalidContext = 12345;
      const expectedRuleSummary = getRuleSummary(dummyRule);
      const expectedContextKeysStr = getContextKeysString(invalidContext); // ""
      let capturedError = null;

      applySpy.mockImplementation(() => {
        const err = new TypeError(
          `Simulated error: Invalid context: ${invalidContext}`
        );
        capturedError = err;
        throw err;
      });

      const result = service.evaluate(dummyRule, invalidContext);

      expect(result).toBe(false); // Correct: catch block returns false
      expect(applySpy).toHaveBeenCalledTimes(1);
      expect(applySpy).toHaveBeenCalledWith(dummyRule, invalidContext);
      expect(mockLogger.error).toHaveBeenCalledTimes(1); // Correct: catch block logs error
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error evaluating JSON Logic rule: ${expectedRuleSummary}. Context keys: ${expectedContextKeysStr}`,
        capturedError
      );
    });
  });
}); // End describe JsonLogicEvaluationService - Error Handling
