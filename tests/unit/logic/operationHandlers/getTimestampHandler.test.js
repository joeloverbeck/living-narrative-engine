/**
 * @file Test suite that proves the behavior of GetTimestampHandler.
 * @see tests/logic/operationHandlers/getTimestampHandler.tests.js
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import GetTimestampHandler from '../../../../src/logic/operationHandlers/getTimestampHandler.js';
import { LOGGER_INFO_METHOD_ERROR } from '../../../common/constants.js';

/**
 * Creates a mock ILogger.
 *
 * @returns {import('../../../../src/interfaces/coreServices.js').ILogger}
 */
const makeMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('GetTimestampHandler', () => {
  let mockLogger;
  let handler;
  let mockExecutionContext;
  const ISO_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  beforeEach(() => {
    mockLogger = makeMockLogger();
    handler = new GetTimestampHandler({ logger: mockLogger });
    mockExecutionContext = {
      evaluationContext: {
        context: {},
      },
      logger: mockLogger, // Assuming the exec context also has a logger
    };
  });

  afterEach(() => {
    jest.useRealTimers(); // Restore real timers after each test
    jest.clearAllMocks();
  });

  // 1. Constructor Tests
  // -----------------------------------------------------------------------------
  describe('Constructor', () => {
    test('should throw an error if the logger dependency is missing or invalid', () => {
      // Test with no logger
      expect(() => new GetTimestampHandler({})).toThrow(
        LOGGER_INFO_METHOD_ERROR
      );
      // Test with a logger that doesn't have the required methods
      expect(() => new GetTimestampHandler({ logger: {} })).toThrow(
        LOGGER_INFO_METHOD_ERROR
      );
    });

    test('should initialize successfully with a valid logger', () => {
      expect(
        () => new GetTimestampHandler({ logger: mockLogger })
      ).not.toThrow();
    });
  });

  // 2. Execution Logic Tests
  // -----------------------------------------------------------------------------
  describe('Execution Logic', () => {
    test('should write a valid ISO 8601 timestamp to the context', () => {
      // Arrange
      const params = { result_variable: 'current_time' };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      const storedTimestamp =
        mockExecutionContext.evaluationContext.context.current_time;
      expect(storedTimestamp).toBeDefined();
      expect(storedTimestamp).toMatch(ISO_TIMESTAMP_REGEX);
    });

    test('should use a predictable timestamp when timers are faked', () => {
      // Arrange
      const fixedDate = new Date('2023-10-27T10:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(fixedDate);

      const params = { result_variable: 'fixed_time' };
      const expectedTimestamp = fixedDate.toISOString(); // "2023-10-27T10:00:00.000Z"

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      const storedTimestamp =
        mockExecutionContext.evaluationContext.context.fixed_time;
      expect(storedTimestamp).toBe(expectedTimestamp);
    });

    test('should correctly trim whitespace from the result_variable name', () => {
      // Arrange
      const params = { result_variable: '  padded_variable  ' };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      expect(mockExecutionContext.evaluationContext.context).toHaveProperty(
        'padded_variable'
      );
      expect(
        mockExecutionContext.evaluationContext.context['  padded_variable  ']
      ).toBeUndefined();
      expect(
        mockExecutionContext.evaluationContext.context.padded_variable
      ).toMatch(ISO_TIMESTAMP_REGEX);
    });

    test('should log the operation with the correct variable and value', () => {
      // Arrange
      const fixedDate = new Date('2024-01-01T12:30:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(fixedDate);

      const params = { result_variable: 'log_test_var' };
      const expectedTimestamp = fixedDate.toISOString();

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `GET_TIMESTAMP → log_test_var = ${expectedTimestamp}`
      );
    });
  });

  // 3. Error Handling and Edge Cases
  // -----------------------------------------------------------------------------
  describe('Error Handling and Edge Cases', () => {
    test('should warn and return if the params object is null', () => {
      handler.execute(null, mockExecutionContext);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'GET_TIMESTAMP: params missing or invalid.',
        { params: null }
      );
    });

    test('should throw a TypeError if result_variable is missing from params', () => {
      // Arrange
      const params = {}; // Missing result_variable

      // Act & Assert
      expect(() => handler.execute(params, mockExecutionContext)).toThrow(
        "Cannot read properties of undefined (reading 'trim')"
      );
    });

    test('should handle a malformed execution context gracefully', () => {
      // Arrange
      const params = { result_variable: 'any_var' };
      const malformedExecCtx = {
        evaluationContext: {
          // context is missing
        },
      };

      // Act
      expect(() => handler.execute(params, malformedExecCtx)).not.toThrow();

      // Assert
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });
});
