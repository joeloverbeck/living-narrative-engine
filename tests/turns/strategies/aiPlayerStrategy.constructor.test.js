import { AIPlayerStrategy } from '../../../src/turns/strategies/aiPlayerStrategy.js';
import {
  jest,
  describe,
  beforeEach,
  test,
  expect,
  afterEach,
} from '@jest/globals';

/** @typedef {import('../../../src/turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */
/** @typedef {import('../../../src/prompting/interfaces/IAIPromptPipeline.js').IAIPromptPipeline} IAIPromptPipeline */
/** @typedef {import('../../../src/turns/interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor */
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/turns/interfaces/IAIFallbackActionFactory.js').IAIFallbackActionFactory} IAIFallbackActionFactory */

const mockLlmAdapter = () => ({
  getAIDecision: jest.fn(),
  getCurrentActiveLlmId: jest.fn(),
});

const mockAiPromptPipeline = () => ({
  generatePrompt: jest.fn(),
});

const mockLlmResponseProcessor = () => ({
  processResponse: jest.fn(),
});

const mockAIFallbackActionFactory = () => ({
  create: jest.fn(),
});

const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('AIPlayerStrategy constructor', () => {
  /** @type {ReturnType<typeof mockLlmAdapter>} */
  let llmAdapter;
  /** @type {ReturnType<typeof mockAiPromptPipeline>} */
  let aiPromptPipeline;
  /** @type {ReturnType<typeof mockLlmResponseProcessor>} */
  let llmResponseProcessor;
  /** @type {ReturnType<typeof mockAIFallbackActionFactory>} */
  let aiFallbackActionFactory;
  /** @type {ReturnType<typeof mockLogger>} */
  let logger;

  beforeEach(() => {
    llmAdapter = mockLlmAdapter();
    aiPromptPipeline = mockAiPromptPipeline();
    llmResponseProcessor = mockLlmResponseProcessor();
    aiFallbackActionFactory = mockAIFallbackActionFactory();
    logger = mockLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('creates instance with valid dependencies', () => {
    const instance = new AIPlayerStrategy({
      llmAdapter,
      aiPromptPipeline,
      llmResponseProcessor,
      aiFallbackActionFactory,
      logger,
    });
    expect(instance).toBeInstanceOf(AIPlayerStrategy);
  });

  test('throws if aiPromptPipeline is missing', () => {
    expect(
      () =>
        new AIPlayerStrategy({
          llmAdapter,
          aiPromptPipeline: null,
          llmResponseProcessor,
          aiFallbackActionFactory,
          logger,
        })
    ).toThrow('Missing required dependency: IAIPromptPipeline.');
  });

  test('throws if llmAdapter is missing', () => {
    expect(
      () =>
        new AIPlayerStrategy({
          llmAdapter: null,
          aiPromptPipeline,
          llmResponseProcessor,
          aiFallbackActionFactory,
          logger,
        })
    ).toThrow('Missing required dependency: ILLMAdapter.');
  });

  test('throws if llmResponseProcessor missing', () => {
    expect(
      () =>
        new AIPlayerStrategy({
          llmAdapter,
          aiPromptPipeline,
          llmResponseProcessor: null,
          aiFallbackActionFactory,
          logger,
        })
    ).toThrow('Missing required dependency: ILLMResponseProcessor.');
  });

  test('throws if aiFallbackActionFactory missing', () => {
    expect(
      () =>
        new AIPlayerStrategy({
          llmAdapter,
          aiPromptPipeline,
          llmResponseProcessor,
          aiFallbackActionFactory: null,
          logger,
        })
    ).toThrow('Missing required dependency: IAIFallbackActionFactory.');
  });

  test('throws if logger missing', () => {
    // Suppress console.error for this specific test case, as the validator logs before throwing.
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    expect(
      () =>
        new AIPlayerStrategy({
          llmAdapter,
          aiPromptPipeline,
          llmResponseProcessor,
          aiFallbackActionFactory,
          logger: null,
        })
    ).toThrow('Missing required dependency: ILogger.');
    consoleErrorSpy.mockRestore();
  });
});
