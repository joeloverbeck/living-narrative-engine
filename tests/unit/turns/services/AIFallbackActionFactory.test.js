/**
 * @file Test suite for AIFallbackActionFactory.
 * @see tests/turns/services/AIFallbackActionFactory.test.js
 */

/* eslint-env jest */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { AIFallbackActionFactory } from '../../../../src/turns/services/AIFallbackActionFactory';
import { DEFAULT_FALLBACK_ACTION } from '../../../../src/llms/constants/llmConstants';

// Mock logger to isolate the factory and verify calls
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

/**
 * Test suite for AIFallbackActionFactory.
 */
describe('AIFallbackActionFactory', () => {
  let factory;

  beforeEach(() => {
    // Clear all mocks before each test to ensure isolation
    jest.clearAllMocks();
    // Instantiate a new factory before each test
    factory = new AIFallbackActionFactory({ logger: mockLogger });
  });

  /**
   * Tests for the constructor.
   */
  describe('constructor', () => {
    test('should throw an error if a logger is not provided in dependencies', () => {
      // Expecting the constructor to throw when logger is missing.
      expect(() => new AIFallbackActionFactory({})).toThrow(
        'AIFallbackActionFactory requires a logger.'
      );
    });

    test('should not throw an error if a logger is provided', () => {
      // Should successfully instantiate when dependencies are correct.
      expect(
        () => new AIFallbackActionFactory({ logger: mockLogger })
      ).not.toThrow();
    });
  });

  /**
   * Tests for the create method.
   */
  describe('create', () => {
    const ACTOR_ID = 'test-actor-123';
    const FAILURE_CONTEXT_GENERIC = 'generic_failure';
    const ERROR_GENERIC = new Error('Something unexpected went wrong!');
    ERROR_GENERIC.stack = 'generic-stack-trace';

    test('should create a generic fallback action for an unexpected issue', () => {
      // Act
      const fallbackAction = factory.create(
        FAILURE_CONTEXT_GENERIC,
        ERROR_GENERIC,
        ACTOR_ID
      );

      // Assert
      expect(fallbackAction).toBeDefined();
      expect(fallbackAction.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(fallbackAction.commandString).toBe(
        DEFAULT_FALLBACK_ACTION.commandString
      );
      expect(fallbackAction.speech).toBe(
        'I encountered an unexpected issue and will wait for a moment.'
      );
      expect(fallbackAction.resolvedParameters).toEqual({
        actorId: ACTOR_ID,
        isFallback: true,
        failureReason: FAILURE_CONTEXT_GENERIC,
        diagnostics: {
          originalMessage: ERROR_GENERIC.message,
          stack: [ERROR_GENERIC.stack],
        },
      });
    });

    test('should create a specific fallback for an HTTP 500 error', () => {
      // Arrange
      const failureContext = 'network_failure';
      const error = new Error('A remote call failed with http error 500.');
      error.stack = 'stack-trace-http-500';

      // Act
      const fallbackAction = factory.create(failureContext, error, ACTOR_ID);

      // Assert
      expect(fallbackAction.speech).toBe(
        'I encountered a server connection problem and will wait for a moment.'
      );
      expect(fallbackAction.resolvedParameters.failureReason).toBe(
        failureContext
      );
    });

    test('should create a specific fallback for an llm_response_processing failure', () => {
      // Arrange
      const failureContext = 'llm_response_processing';
      const error = new Error('Could not parse LLM JSON output.');
      error.stack = 'stack-trace-llm';

      // Act
      const fallbackAction = factory.create(failureContext, error, ACTOR_ID);

      // Assert
      expect(fallbackAction.speech).toBe(
        'I encountered a communication issue and will wait for a moment.'
      );
      expect(fallbackAction.resolvedParameters.failureReason).toBe(
        failureContext
      );
    });

    test('should correctly log the error with full context', () => {
      // Arrange
      const failureContext = 'logging_test';
      const error = new Error('This is a test error for logging.');
      error.stack = 'fake-stack-for-logging';

      // Act
      factory.create(failureContext, error, ACTOR_ID);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `AIFallbackActionFactory: Creating fallback for actor ${ACTOR_ID} due to ${failureContext}.`,
        {
          actorId: ACTOR_ID,
          error,
          errorMessage: error.message,
          stack: error.stack,
        }
      );
    });

    test('should include custom details from the error object in diagnostics if they exist', () => {
      // Arrange
      const failureContext = 'details_test';
      const error = new Error('Error with details.');
      error.stack = 'stack-with-details';
      error.details = { llmOutput: '{ "bad": "json" }', reasonCode: 'E_PARSE' };

      // Act
      const fallbackAction = factory.create(failureContext, error, ACTOR_ID);

      // Assert
      expect(fallbackAction.resolvedParameters.diagnostics).toEqual({
        originalMessage: 'Error with details.',
        llmOutput: '{ "bad": "json" }',
        reasonCode: 'E_PARSE',
        stack: ['stack-with-details'],
      });
    });

    test('should handle errors without a stack trace gracefully', () => {
      // Arrange
      const failureContext = 'no_stack_trace';
      const error = new Error('Error without stack.');
      delete error.stack; // Simulate an error object with no stack property

      // Act
      const fallbackAction = factory.create(failureContext, error, ACTOR_ID);

      // Assert
      expect(
        fallbackAction.resolvedParameters.diagnostics.stack
      ).toBeUndefined();
      // Verify logger was still called, but with an undefined stack
      expect(mockLogger.error).toHaveBeenCalledWith(
        `AIFallbackActionFactory: Creating fallback for actor ${ACTOR_ID} due to ${failureContext}.`,
        expect.objectContaining({ stack: undefined })
      );
    });
  });
});
