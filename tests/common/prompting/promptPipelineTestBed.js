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
import BaseTestBed from '../baseTestBed.js';

/**
 * @description Utility class for unit tests that need an AIPromptPipeline with common mocks.
 * @class
 */
export class AIPromptPipelineTestBed extends BaseTestBed {
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
    const mocks = {
      llmAdapter: createMockLLMAdapter(),
      gameStateProvider: createMockAIGameStateProvider(),
      promptContentProvider: createMockAIPromptContentProvider(),
      promptBuilder: createMockPromptBuilder(),
      logger: createMockLogger(),
    };
    super(mocks);

    // Preserve direct properties for backward compatibility
    this.llmAdapter = this.mocks.llmAdapter;
    this.gameStateProvider = this.mocks.gameStateProvider;
    this.promptContentProvider = this.mocks.promptContentProvider;
    this.promptBuilder = this.mocks.promptBuilder;
    this.logger = this.mocks.logger;
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
      llmAdapter: this.mocks.llmAdapter,
      gameStateProvider: this.mocks.gameStateProvider,
      promptContentProvider: this.mocks.promptContentProvider,
      promptBuilder: this.mocks.promptBuilder,
      logger: this.mocks.logger,
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
      llmAdapter: this.mocks.llmAdapter,
      gameStateProvider: this.mocks.gameStateProvider,
      promptContentProvider: this.mocks.promptContentProvider,
      promptBuilder: this.mocks.promptBuilder,
      logger: this.mocks.logger,
    };
  }

  /**
   * Clears all jest mocks used by this test bed.
   */
  async cleanup() {
    await super.cleanup();
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
    this.mocks.llmAdapter.getCurrentActiveLlmId.mockResolvedValue(llmId);
    this.mocks.gameStateProvider.buildGameState.mockResolvedValue(gameState);
    this.mocks.promptContentProvider.getPromptData.mockResolvedValue(
      promptData
    );
    this.mocks.promptBuilder.build.mockResolvedValue(finalPrompt);
  }
}

export default AIPromptPipelineTestBed;
