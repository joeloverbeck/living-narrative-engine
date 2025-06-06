// tests/turns/strategies/aiPlayerStrategy.createFallbackAction.test.js
// --- FILE START ---

import { AIPlayerStrategy } from '../../../src/turns/strategies/aiPlayerStrategy.js';
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
/** @typedef {import('../../../src/turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */
/** @typedef {import('../../../src/turns/interfaces/IAIGameStateProvider.js').IAIGameStateProvider} IAIGameStateProvider */
/** @typedef {import('../../../src/turns/interfaces/IAIPromptContentProvider.js').IAIPromptContentProvider} IAIPromptContentProvider */
/** @typedef {import('../../../src/prompting/promptBuilder.js').PromptBuilder} PromptBuilder */
/** @typedef {import('../../../src/turns/interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor */
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */

// --- Mock Implementations ---

/** @returns {jest.Mocked<ILLMAdapter>} */
const mockLlmAdapter = () => ({
  getAIDecision: jest.fn(),
  getCurrentActiveLlmId: jest.fn(),
});

/** @returns {jest.Mocked<IAIGameStateProvider>} */
const mockGameStateProvider = () => ({
  buildGameState: jest.fn(),
});

/** @returns {jest.Mocked<IAIPromptContentProvider>} */
const mockAIPromptContentProvider = () => ({
  getPromptData: jest.fn(),
});

/** @returns {jest.Mocked<PromptBuilder>} */
const mockPromptBuilder = () => ({
  build: jest.fn(),
});

/** @returns {jest.Mocked<ILLMResponseProcessor>} */
const mockLlmResponseProcessor = () => ({
  processResponse: jest.fn(),
});

/** @returns {jest.Mocked<ILogger>} */
const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('AIPlayerStrategy', () => {
  /** @type {ReturnType<typeof mockLlmAdapter>} */
  let llmAdapter;
  /** @type {ReturnType<typeof mockGameStateProvider>} */
  let gameStateProvider;
  /** @type {ReturnType<typeof mockAIPromptContentProvider>} */
  let promptContentProvider;
  /** @type {ReturnType<typeof mockPromptBuilder>} */
  let promptBuilder;
  /** @type {ReturnType<typeof mockLlmResponseProcessor>} */
  let llmResponseProcessor;
  /** @type {ReturnType<typeof mockLogger>} */
  let currentLoggerMock;

  beforeEach(() => {
    llmAdapter = mockLlmAdapter();
    gameStateProvider = mockGameStateProvider();
    promptContentProvider = mockAIPromptContentProvider();
    promptBuilder = mockPromptBuilder();
    llmResponseProcessor = mockLlmResponseProcessor();
    currentLoggerMock = mockLogger();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // FIX: Test the new canonical fallback creation method
  describe('_createCanonicalFallbackAction', () => {
    /** @type {AIPlayerStrategy} */
    let instance_cf;
    beforeEach(() => {
      instance_cf = new AIPlayerStrategy({
        llmAdapter,
        gameStateProvider,
        promptContentProvider,
        promptBuilder,
        llmResponseProcessor,
        logger: currentLoggerMock,
      });
    });

    // FIX: Updated test case for the new method signature and return structure
    test('should create a fallback with specified actorId and error details', () => {
      const failureContext = 'test_failure_context';
      const error = new Error('A test error occurred.');
      const actorId = 'actor-test-123';

      // @ts-ignore - Testing a private method
      const fallbackAction = instance_cf._createCanonicalFallbackAction(
        failureContext,
        error,
        actorId
      );

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
        `AIPlayerStrategy: Creating canonical fallback action for actor ${actorId} due to ${failureContext}.`,
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

      // @ts-ignore - Testing a private method
      const fallbackAction = instance_cf._createCanonicalFallbackAction(
        failureContext,
        error,
        actorId
      );

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

      // @ts-ignore - Testing a private method
      const fallbackAction = instance_cf._createCanonicalFallbackAction(
        failureContext,
        error,
        actorId
      );

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
