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
// AIPromptContentProvider import is not needed here as we are not spying on its static methods for these tests.
// import {AIPromptContentProvider} from "../../../src/services/AIPromptContentProvider.js";

// --- Typedefs for Mocks ---
/** @typedef {import('../../../src/turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */
/** @typedef {import('../../../src/turns/interfaces/IAIGameStateProvider.js').IAIGameStateProvider} IAIGameStateProvider */
/** @typedef {import('../../../src/turns/interfaces/IAIPromptContentProvider.js').IAIPromptContentProvider} IAIPromptContentProvider */
/** @typedef {import('../../../src/services/promptBuilder.js').PromptBuilder} PromptBuilder */
/** @typedef {import('../../../src/turns/interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor */
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
// Unused typedefs removed
// /** @typedef {import('../../../src/types/promptData.js').PromptData} PromptData */
// /** @typedef {import('../../../src/turns/dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO_Test */

// --- Mock Implementations ---

/**
 * @returns {jest.Mocked<ILLMAdapter>}
 */
const mockLlmAdapter = () => ({
  getAIDecision: jest.fn(),
  getCurrentActiveLlmId: jest.fn(),
});

/**
 * @returns {jest.Mocked<IAIGameStateProvider>}
 */
const mockGameStateProvider = () => ({
  buildGameState: jest.fn(),
});

/**
 * @returns {jest.Mocked<IAIPromptContentProvider>}
 */
const mockAIPromptContentProvider = () => ({
  getPromptData: jest.fn(),
  // validateGameStateForPrompting is not relevant for _createFallbackAction tests
});

/**
 * @returns {jest.Mocked<PromptBuilder>}
 */
const mockPromptBuilder = () => ({
  build: jest.fn(),
});

/**
 * @returns {jest.Mocked<ILLMResponseProcessor>}
 */
const mockLlmResponseProcessor = () => ({
  processResponse: jest.fn(),
});

/**
 * @returns {jest.Mocked<ILogger>}
 */
const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

// MockEntity and createMockActor are not needed for _createFallbackAction tests, so they can be removed if not used elsewhere.
// For now, keeping them in case other describe blocks in this file might use them (though unlikely for a focused test file).
class MockEntity {
  /**
   * @param {string} id
   * @param {Record<string, any>} componentsData
   */
  constructor(
    id = `mock-entity-${Math.random().toString(36).substring(2, 9)}`,
    componentsData = {}
  ) {
    this.id = id;
    // @ts-ignore
    this.name = componentsData.name?.text || `Mock Entity ${id}`;
  }
}

/**
 * Creates a mock actor instance.
 *
 * @param {string} [id]
 * @returns {MockEntity}
 */
const createMockActor = (id = 'actor1') => {
  return new MockEntity(id);
};

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
  // Removed checkCriticalGameStateSpy as it's not relevant for _createFallbackAction tests
  // /** @type {jest.SpyInstance} */
  // let checkCriticalGameStateSpy;

  beforeEach(() => {
    llmAdapter = mockLlmAdapter();
    gameStateProvider = mockGameStateProvider();
    promptContentProvider = mockAIPromptContentProvider();
    promptBuilder = mockPromptBuilder();
    llmResponseProcessor = mockLlmResponseProcessor();
    currentLoggerMock = mockLogger();

    jest.clearAllMocks();
    // The spy on AIPromptContentProvider.checkCriticalGameState is removed
    // as it's irrelevant for testing _createFallbackAction.
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('_createFallbackAction', () => {
    /** @type {AIPlayerStrategy} */
    let instance_cf; // Renamed to avoid conflict if other describe blocks use 'instance'
    beforeEach(() => {
      // Instance is created using mocks from the outer scope
      instance_cf = new AIPlayerStrategy({
        llmAdapter,
        gameStateProvider,
        promptContentProvider,
        promptBuilder,
        llmResponseProcessor,
        logger: currentLoggerMock,
      });
    });

    test('should create a fallback action with default actorId and given errorContext', () => {
      const errorContext = 'test_error_context';
      const fallbackAction = instance_cf._createFallbackAction(errorContext);
      expect(fallbackAction).toEqual({
        actionDefinitionId: DEFAULT_FALLBACK_ACTION.actionDefinitionId,
        commandString: DEFAULT_FALLBACK_ACTION.commandString,
        speech: 'I encountered an unexpected issue and will wait.',
        resolvedParameters: {
          errorContext: `AI Error for UnknownActor: ${errorContext}. Waiting.`,
          actorId: 'UnknownActor',
        },
      });
      expect(currentLoggerMock.debug).toHaveBeenCalledWith(
        `AIPlayerStrategy: Creating fallback action. Error: "${errorContext}", Actor: UnknownActor`
      );
    });

    test('should create a fallback action with specified actorId and errorContext', () => {
      const errorContext = 'specific_error';
      const actorId = 'actor123';
      const fallbackAction = instance_cf._createFallbackAction(
        errorContext,
        actorId
      );
      expect(fallbackAction).toEqual({
        actionDefinitionId: DEFAULT_FALLBACK_ACTION.actionDefinitionId,
        commandString: DEFAULT_FALLBACK_ACTION.commandString,
        speech: 'I encountered an unexpected issue and will wait.',
        resolvedParameters: {
          errorContext: `AI Error for ${actorId}: ${errorContext}. Waiting.`,
          actorId: actorId,
        },
      });
      expect(currentLoggerMock.debug).toHaveBeenCalledWith(
        `AIPlayerStrategy: Creating fallback action. Error: "${errorContext}", Actor: ${actorId}`
      );
    });

    test('should create a fallback action with specific speech for HTTP 500 errors', () => {
      const errorContext = 'Oh no, HTTP error 500 from upstream!';
      const fallbackAction = instance_cf._createFallbackAction(
        errorContext,
        'actorHTTP'
      );
      expect(fallbackAction.speech).toBe(
        'I encountered a connection problem and will wait.'
      );
      expect(currentLoggerMock.debug).toHaveBeenCalledWith(
        `AIPlayerStrategy: Creating fallback action. Error: "${errorContext}", Actor: actorHTTP`
      );
    });
  });
});

// --- FILE END ---
