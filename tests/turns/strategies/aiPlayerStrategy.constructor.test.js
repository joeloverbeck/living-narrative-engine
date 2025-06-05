// tests/turns/strategies/aiPlayerStrategy.constructor.test.js
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
// Removed DEFAULT_FALLBACK_ACTION as it's not directly used in constructor tests
// import {DEFAULT_FALLBACK_ACTION} from "../../../src/llms/constants/llmConstants.js";
// Removed AIPromptContentProvider import as its static method is no longer spied on here
// import {AIPromptContentProvider} from "../../../src/services/AIPromptContentProvider.js";

// --- Typedefs for Mocks ---
/** @typedef {import('../../../src/turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */
/** @typedef {import('../../../src/turns/interfaces/IAIGameStateProvider.js').IAIGameStateProvider} IAIGameStateProvider */
/** @typedef {import('../../../src/turns/interfaces/IAIPromptContentProvider.js').IAIPromptContentProvider} IAIPromptContentProvider */
/** @typedef {import('../../../src/prompting/promptBuilder.js').PromptBuilder} PromptBuilder */
/** @typedef {import('../../../src/turns/interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor */
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
// Removed unused typedefs for PromptData and AIGameStateDTO_Test as they are not relevant for constructor tests
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
  // validateGameStateForPrompting: jest.fn(), // Not needed for constructor tests
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

// Removed MockEntity and createMockActor as they are not used in constructor tests

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
  // Removed checkCriticalGameStateSpy as it's not relevant for constructor tests
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
    // as it's not used by the AIPlayerStrategy constructor and the method no longer exists.
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('should successfully create an instance with valid dependencies', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            gameStateProvider,
            promptContentProvider,
            promptBuilder,
            llmResponseProcessor,
            logger: currentLoggerMock,
          })
      ).not.toThrow();
      const instance = new AIPlayerStrategy({
        llmAdapter,
        gameStateProvider,
        promptContentProvider,
        promptBuilder,
        llmResponseProcessor,
        logger: currentLoggerMock,
      });
      expect(instance).toBeInstanceOf(AIPlayerStrategy);
    });

    const commonILLMAdapterError =
      'AIPlayerStrategy: Constructor requires a valid ILLMAdapter.';
    test('should throw an error if llmAdapter is not provided', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            // llmAdapter missing
            gameStateProvider,
            promptContentProvider,
            promptBuilder,
            llmResponseProcessor,
            logger: currentLoggerMock,
          })
      ).toThrow(commonILLMAdapterError);
    });
    test('should throw an error if llmAdapter is null', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter: null,
            gameStateProvider,
            promptContentProvider,
            promptBuilder,
            llmResponseProcessor,
            logger: currentLoggerMock,
          })
      ).toThrow(commonILLMAdapterError);
    });
    test('should throw an error if llmAdapter does not have getAIDecision method', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            // @ts-ignore
            llmAdapter: { getCurrentActiveLlmId: jest.fn() },
            gameStateProvider,
            promptContentProvider,
            promptBuilder,
            llmResponseProcessor,
            logger: currentLoggerMock,
          })
      ).toThrow(commonILLMAdapterError);
    });
    test('should throw an error if llmAdapter.getAIDecision is not a function', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            // @ts-ignore
            llmAdapter: {
              getAIDecision: 'not-a-function',
              getCurrentActiveLlmId: jest.fn(),
            },
            gameStateProvider,
            promptContentProvider,
            promptBuilder,
            llmResponseProcessor,
            logger: currentLoggerMock,
          })
      ).toThrow(commonILLMAdapterError);
    });
    test('should throw an error if llmAdapter does not have getCurrentActiveLlmId method', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            // @ts-ignore
            llmAdapter: { getAIDecision: jest.fn() },
            gameStateProvider,
            promptContentProvider,
            promptBuilder,
            llmResponseProcessor,
            logger: currentLoggerMock,
          })
      ).toThrow(commonILLMAdapterError);
    });
    test('should throw an error if llmAdapter.getCurrentActiveLlmId is not a function', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            // @ts-ignore
            llmAdapter: {
              getAIDecision: jest.fn(),
              getCurrentActiveLlmId: 'not-a-function',
            },
            gameStateProvider,
            promptContentProvider,
            promptBuilder,
            llmResponseProcessor,
            logger: currentLoggerMock,
          })
      ).toThrow(commonILLMAdapterError);
    });

    const commonIAIGameStateProviderError =
      'AIPlayerStrategy: Constructor requires a valid IAIGameStateProvider.';
    test('should throw an error if gameStateProvider is not provided', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            // gameStateProvider missing
            promptContentProvider,
            promptBuilder,
            llmResponseProcessor,
            logger: currentLoggerMock,
          })
      ).toThrow(commonIAIGameStateProviderError);
    });
    test('should throw an error if gameStateProvider is null', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            gameStateProvider: null,
            promptContentProvider,
            promptBuilder,
            llmResponseProcessor,
            logger: currentLoggerMock,
          })
      ).toThrow(commonIAIGameStateProviderError);
    });
    test('should throw an error if gameStateProvider does not have buildGameState method', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            // @ts-ignore
            gameStateProvider: {},
            promptContentProvider,
            promptBuilder,
            llmResponseProcessor,
            logger: currentLoggerMock,
          })
      ).toThrow(commonIAIGameStateProviderError);
    });
    test('should throw an error if gameStateProvider.buildGameState is not a function', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            // @ts-ignore
            gameStateProvider: { buildGameState: 'not-a-function' },
            promptContentProvider,
            promptBuilder,
            llmResponseProcessor,
            logger: currentLoggerMock,
          })
      ).toThrow(commonIAIGameStateProviderError);
    });

    const commonAIPromptContentProviderError =
      'AIPlayerStrategy: Constructor requires a valid IAIPromptContentProvider instance with a getPromptData method.';
    test('should throw an error if promptContentProvider is not provided', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            gameStateProvider,
            // promptContentProvider missing
            promptBuilder,
            llmResponseProcessor,
            logger: currentLoggerMock,
          })
      ).toThrow(commonAIPromptContentProviderError);
    });
    test('should throw an error if promptContentProvider is null', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            gameStateProvider,
            promptContentProvider: null,
            promptBuilder,
            llmResponseProcessor,
            logger: currentLoggerMock,
          })
      ).toThrow(commonAIPromptContentProviderError);
    });
    test('should throw an error if promptContentProvider does not have getPromptData method', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            gameStateProvider,
            // @ts-ignore
            promptContentProvider: {}, // Missing getPromptData
            promptBuilder,
            llmResponseProcessor,
            logger: currentLoggerMock,
          })
      ).toThrow(commonAIPromptContentProviderError);
    });
    test('should throw an error if promptContentProvider.getPromptData is not a function', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            gameStateProvider,
            // @ts-ignore
            promptContentProvider: { getPromptData: 'not-a-function' },
            promptBuilder,
            llmResponseProcessor,
            logger: currentLoggerMock,
          })
      ).toThrow(commonAIPromptContentProviderError);
    });

    const commonPromptBuilderError =
      'AIPlayerStrategy: Constructor requires a valid IPromptBuilder instance with a build method.';
    test('should throw an error if promptBuilder is not provided', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            gameStateProvider,
            promptContentProvider,
            // promptBuilder missing
            llmResponseProcessor,
            logger: currentLoggerMock,
          })
      ).toThrow(commonPromptBuilderError);
    });
    test('should throw an error if promptBuilder is null', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            gameStateProvider,
            promptContentProvider,
            promptBuilder: null,
            llmResponseProcessor,
            logger: currentLoggerMock,
          })
      ).toThrow(commonPromptBuilderError);
    });
    test('should throw an error if promptBuilder does not have build method', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            gameStateProvider,
            promptContentProvider,
            // @ts-ignore
            promptBuilder: {}, // Missing build method
            llmResponseProcessor,
            logger: currentLoggerMock,
          })
      ).toThrow(commonPromptBuilderError);
    });
    test('should throw an error if promptBuilder.build is not a function', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            gameStateProvider,
            promptContentProvider,
            // @ts-ignore
            promptBuilder: { build: 'not-a-function' },
            llmResponseProcessor,
            logger: currentLoggerMock,
          })
      ).toThrow(commonPromptBuilderError);
    });

    const commonILLMResponseProcessorError =
      'AIPlayerStrategy: Constructor requires a valid ILLMResponseProcessor.';
    test('should throw an error if llmResponseProcessor is not provided', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            gameStateProvider,
            promptContentProvider,
            promptBuilder,
            // llmResponseProcessor missing
            logger: currentLoggerMock,
          })
      ).toThrow(commonILLMResponseProcessorError);
    });
    test('should throw an error if llmResponseProcessor is null', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            gameStateProvider,
            promptContentProvider,
            promptBuilder,
            llmResponseProcessor: null,
            logger: currentLoggerMock,
          })
      ).toThrow(commonILLMResponseProcessorError);
    });
    test('should throw an error if llmResponseProcessor does not have processResponse method', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            gameStateProvider,
            promptContentProvider,
            promptBuilder,
            // @ts-ignore
            llmResponseProcessor: {}, // Missing processResponse method
            logger: currentLoggerMock,
          })
      ).toThrow(commonILLMResponseProcessorError);
    });
    test('should throw an error if llmResponseProcessor.processResponse is not a function', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            gameStateProvider,
            promptContentProvider,
            promptBuilder,
            // @ts-ignore
            llmResponseProcessor: { processResponse: 'not-a-function' },
            logger: currentLoggerMock,
          })
      ).toThrow(commonILLMResponseProcessorError);
    });

    const commonILoggerError =
      'AIPlayerStrategy: Constructor requires a valid ILogger instance.';
    test('should throw an error if logger is not provided', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            gameStateProvider,
            promptContentProvider,
            promptBuilder,
            llmResponseProcessor,
            // logger missing
          })
      ).toThrow(commonILoggerError);
    });
    test('should throw an error if logger is null', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            gameStateProvider,
            promptContentProvider,
            promptBuilder,
            llmResponseProcessor,
            logger: null,
          })
      ).toThrow(commonILoggerError);
    });
    test('should throw an error if logger does not have an info method', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            gameStateProvider,
            promptContentProvider,
            promptBuilder,
            llmResponseProcessor,
            // @ts-ignore
            logger: { error: jest.fn(), debug: jest.fn(), warn: jest.fn() }, // Missing info
          })
      ).toThrow(commonILoggerError);
    });
    test('should throw an error if logger.info is not a function', () => {
      expect(
        () =>
          new AIPlayerStrategy({
            llmAdapter,
            gameStateProvider,
            promptContentProvider,
            promptBuilder,
            llmResponseProcessor,
            // @ts-ignore
            logger: { info: 'not-a-function' },
          })
      ).toThrow(commonILoggerError);
    });
  });
});

// --- FILE END ---
