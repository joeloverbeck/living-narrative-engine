// tests/turns/strategies/aiPlayerStrategy.createFallbackAction.test.js
// --- FILE START ---

import { AIFallbackActionFactory } from '../../../src/turns/services/AIFallbackActionFactory.js';
import {
  jest,
  describe,
  beforeEach,
  test,
  expect,
  afterEach,
} from '@jest/globals';
import { DEFAULT_FALLBACK_ACTION } from '../../../src/llms/constants/llmConstants.js';

// --- Typedefs for Mocks ---
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */

// --- Mock Implementations ---

/** @returns {jest.Mocked<ILogger>} */
const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('AIFallbackActionFactory', () => {
  /** @type {ReturnType<typeof mockLogger>} */
  let currentLoggerMock;

  beforeEach(() => {
    currentLoggerMock = mockLogger();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    /** @type {AIFallbackActionFactory} */
    let factory;
    beforeEach(() => {
      factory = new AIFallbackActionFactory({ logger: currentLoggerMock });
    });

    // FIX: Updated test case for the new method signature and return structure
    test('should create a fallback with specified actorId and error details', () => {
      const failureContext = 'test_failure_context';
      const error = new Error('A test error occurred.');
      const actorId = 'actor-test-123';

      const fallbackAction = factory.create(failureContext, error, actorId);

      expect(fallbackAction).toEqual({
        actionDefinitionId: DEFAULT_FALLBACK_ACTION.actionDefinitionId,
        commandString: DEFAULT_FALLBACK_ACTION.commandString,
        speech: 'I encountered an unexpected issue and will wait for a moment.',
        resolvedParameters: {
          actorId: actorId,
          isFallback: true,
          failureReason: failureContext,
          diagnostics: {
            originalMessage: error.message,
            stack: expect.any(Array),
          },
        },
      });

      expect(currentLoggerMock.error).toHaveBeenCalledWith(
        `AIFallbackActionFactory: Creating fallback for actor ${actorId} due to ${failureContext}.`,
        expect.objectContaining({
          actorId,
          error,
          errorMessage: error.message,
        })
      );
    });

    // FIX: Updated test case for HTTP 500 error speech
    test('should create a fallback with specific speech for HTTP 500 errors', () => {
      const failureContext = 'http_error';
      const error = new Error('Oh no, HTTP error 500 from upstream!');
      const actorId = 'actor-http-456';

      const fallbackAction = factory.create(failureContext, error, actorId);

      expect(fallbackAction.speech).toBe(
        'I encountered a server connection problem and will wait for a moment.'
      );
      expect(fallbackAction.resolvedParameters.failureReason).toBe(
        failureContext
      );
      expect(
        fallbackAction.resolvedParameters.diagnostics.originalMessage
      ).toBe(error.message);
    });

    // FIX: Updated test case for llm_response_processing context
    test('should create a fallback with specific speech for response processing errors', () => {
      const failureContext = 'llm_response_processing';
      const error = new Error('Could not parse JSON from LLM.');
      error.name = 'LLMProcessingError'; // Simulate a specific error type if needed
      const actorId = 'actor-proc-789';

      const fallbackAction = factory.create(failureContext, error, actorId);

      expect(fallbackAction.speech).toBe(
        'I encountered a communication issue and will wait for a moment.'
      );
      expect(fallbackAction.resolvedParameters.failureReason).toBe(
        failureContext
      );
    });
  });
});

// --- FILE END ---
