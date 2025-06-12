/**
 * @file Unit tests for AIPlayerStrategy constructor validation.
 */
import { AIPlayerStrategy } from '../../../src/turns/strategies/aiPlayerStrategy.js';
import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';

/** Mock factories for constructor dependencies **/
const mockLlmAdapter = () => ({
  getAIDecision: jest.fn(),
  getCurrentActiveLlmId: jest.fn(),
});
const mockAiPromptPipeline = () => ({ generatePrompt: jest.fn() });
const mockLlmResponseProcessor = () => ({ processResponse: jest.fn() });
const mockAIFallbackActionFactory = () => ({ create: jest.fn() });
const mockActionDiscoveryService = () => ({ getValidActions: jest.fn() });
const mockActionIndexingService = () => ({ indexActions: jest.fn() });
const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('AIPlayerStrategy constructor', () => {
  let llmAdapter;
  let aiPromptPipeline;
  let llmResponseProcessor;
  let aiFallbackActionFactory;
  let actionDiscoveryService;
  let actionIndexingService;
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    llmAdapter = mockLlmAdapter();
    aiPromptPipeline = mockAiPromptPipeline();
    llmResponseProcessor = mockLlmResponseProcessor();
    aiFallbackActionFactory = mockAIFallbackActionFactory();
    actionDiscoveryService = mockActionDiscoveryService();
    actionIndexingService = mockActionIndexingService();
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
      actionDiscoveryService,
      actionIndexingService,
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
          actionDiscoveryService,
          actionIndexingService,
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
          actionDiscoveryService,
          actionIndexingService,
          logger,
        })
    ).toThrow('Missing required dependency: ILLMAdapter.');
  });

  test('throws if llmResponseProcessor is missing', () => {
    expect(
      () =>
        new AIPlayerStrategy({
          llmAdapter,
          aiPromptPipeline,
          llmResponseProcessor: null,
          aiFallbackActionFactory,
          actionDiscoveryService,
          actionIndexingService,
          logger,
        })
    ).toThrow('Missing required dependency: ILLMResponseProcessor.');
  });

  test('throws if aiFallbackActionFactory is missing', () => {
    expect(
      () =>
        new AIPlayerStrategy({
          llmAdapter,
          aiPromptPipeline,
          llmResponseProcessor,
          aiFallbackActionFactory: null,
          actionDiscoveryService,
          actionIndexingService,
          logger,
        })
    ).toThrow('Missing required dependency: IAIFallbackActionFactory.');
  });

  test('throws if actionDiscoveryService is missing', () => {
    expect(
      () =>
        new AIPlayerStrategy({
          llmAdapter,
          aiPromptPipeline,
          llmResponseProcessor,
          aiFallbackActionFactory,
          actionDiscoveryService: null,
          actionIndexingService,
          logger,
        })
    ).toThrow('Missing required dependency: IActionDiscoveryService.');
  });

  test('throws if actionIndexingService is missing', () => {
    expect(
      () =>
        new AIPlayerStrategy({
          llmAdapter,
          aiPromptPipeline,
          llmResponseProcessor,
          aiFallbackActionFactory,
          actionDiscoveryService,
          actionIndexingService: null,
          logger,
        })
    ).toThrow('Missing required dependency: ActionIndexingService.');
  });

  test('throws if logger is missing', () => {
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
          actionDiscoveryService,
          actionIndexingService,
          logger: null,
        })
    ).toThrow('Missing required dependency: ILogger.');
    consoleErrorSpy.mockRestore();
  });
});
