/**
 * @file Provides a minimal test bed for creating AIPromptPipeline instances with mocked dependencies.
 * @see tests/common/prompting/promptPipelineTestBed.js
 */

import { jest } from '@jest/globals';
import { AIPromptPipeline } from '../../../src/prompting/AIPromptPipeline.js';
import { createMockLogger } from '../mockFactories.js';

/**
 * @description Utility class for unit tests that need an AIPromptPipeline with common mocks.
 * @class
 */
export class AIPromptPipelineTestBed {
  /** @type {jest.Mocked<import('../../src/turns/interfaces/ILLMAdapter.js').ILLMAdapter>} */
  llmAdapter;
  /** @type {jest.Mocked<import('../../src/turns/interfaces/IAIGameStateProvider.js').IAIGameStateProvider>} */
  gameStateProvider;
  /** @type {jest.Mocked<import('../../src/turns/interfaces/IAIPromptContentProvider.js').IAIPromptContentProvider>} */
  promptContentProvider;
  /** @type {jest.Mocked<import('../../src/interfaces/IPromptBuilder.js').IPromptBuilder>} */
  promptBuilder;
  /** @type {jest.Mocked<import('../../src/interfaces/coreServices.js').ILogger>} */
  logger;

  constructor() {
    this.llmAdapter = {
      getAIDecision: jest.fn(),
      getCurrentActiveLlmId: jest.fn(),
    };
    this.gameStateProvider = {
      buildGameState: jest.fn(),
    };
    this.promptContentProvider = {
      getPromptData: jest.fn(),
    };
    this.promptBuilder = {
      build: jest.fn(),
    };
    this.logger = createMockLogger();
  }

  /**
   * Creates a new {@link AIPromptPipeline} instance using the internally
   * constructed mocks.
   *
   * @returns {AIPromptPipeline} The pipeline under test.
   */
  createPipeline() {
    return new AIPromptPipeline({
      llmAdapter: this.llmAdapter,
      gameStateProvider: this.gameStateProvider,
      promptContentProvider: this.promptContentProvider,
      promptBuilder: this.promptBuilder,
      logger: this.logger,
    });
  }

  /**
   * Clears all jest mocks used by this test bed.
   */
  cleanup() {
    jest.clearAllMocks();
  }
}

export default AIPromptPipelineTestBed;
