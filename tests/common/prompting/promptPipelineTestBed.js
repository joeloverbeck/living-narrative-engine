/**
 * @file Provides a minimal test bed for creating AIPromptPipeline instances with mocked dependencies.
 * @see tests/common/prompting/promptPipelineTestBed.js
 */

import { jest } from '@jest/globals';
import { AIPromptPipeline } from '../../../src/prompting/AIPromptPipeline.js';
import {
  createMockLogger,
  createMockLLMAdapter,
  createMockAIGameStateProvider,
  createMockAIPromptContentProvider,
  createMockPromptBuilder,
  createMockEntity,
} from '../mockFactories.js';
import { clearMockFunctions } from '../jestHelpers.js';

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
  /** @type {import('../../src/entities/entity.js').default} */
  defaultActor;
  /** @type {import('../../src/turns/interfaces/ITurnContext.js').ITurnContext} */
  defaultContext;
  /** @type {import('../../src/turns/dtos/actionComposite.js').ActionComposite[]} */
  defaultActions;

  constructor() {
    this.llmAdapter = createMockLLMAdapter();
    this.gameStateProvider = createMockAIGameStateProvider();
    this.promptContentProvider = createMockAIPromptContentProvider();
    this.promptBuilder = createMockPromptBuilder();
    this.logger = createMockLogger();
    this.defaultActor = createMockEntity('actor');
    this.defaultContext = {};
    this.defaultActions = [];
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
   * Convenience method that creates a pipeline and generates a prompt.
   *
   * @param {import('../../../src/entities/entity.js').default} actor - The actor requesting the prompt.
   * @param {import('../../../src/turns/interfaces/ITurnContext.js').ITurnContext} context - Turn context for the prompt.
   * @param {import('../../../src/turns/dtos/actionComposite.js').ActionComposite[]} actions - Possible actions for the actor.
   * @returns {Promise<string>} The generated prompt string.
   */
  async generate(actor, context, actions) {
    const pipeline = this.createPipeline();
    return pipeline.generatePrompt(actor, context, actions);
  }

  /**
   * Returns the dependency object used to construct the pipeline.
   *
   * @returns {{
   *   llmAdapter: ReturnType<typeof createMockLLMAdapter>,
   *   gameStateProvider: ReturnType<typeof createMockAIGameStateProvider>,
   *   promptContentProvider: ReturnType<typeof createMockAIPromptContentProvider>,
   *   promptBuilder: ReturnType<typeof createMockPromptBuilder>,
   *   logger: ReturnType<typeof createMockLogger>,
   * }} The dependency object.
   */
  getDependencies() {
    return {
      llmAdapter: this.llmAdapter,
      gameStateProvider: this.gameStateProvider,
      promptContentProvider: this.promptContentProvider,
      promptBuilder: this.promptBuilder,
      logger: this.logger,
    };
  }

  /**
   * Clears all jest mocks used by this test bed.
   */
  cleanup() {
    jest.clearAllMocks();
    clearMockFunctions(
      this.llmAdapter,
      this.gameStateProvider,
      this.promptContentProvider,
      this.promptBuilder,
      this.logger
    );
  }

  /**
   * Sets up mock resolved values for a successful pipeline run.
   *
   * @param {object} [options] - Configuration options.
   * @param {string} [options.llmId] - LLM ID returned by the adapter.
   * @param {object} [options.gameState] - Game state returned by the provider.
   * @param {object} [options.promptData] - Prompt data returned by the content provider.
   * @param {string} [options.finalPrompt] - Final prompt string returned by the builder.
   */
  setupMockSuccess({
    llmId = 'llm-id',
    gameState = {},
    promptData = {},
    finalPrompt = 'PROMPT',
  } = {}) {
    this.llmAdapter.getCurrentActiveLlmId.mockResolvedValue(llmId);
    this.gameStateProvider.buildGameState.mockResolvedValue(gameState);
    this.promptContentProvider.getPromptData.mockResolvedValue(promptData);
    this.promptBuilder.build.mockResolvedValue(finalPrompt);
  }
}

export default AIPromptPipelineTestBed;
