/**
 * @file Provides a minimal test bed for creating AIPromptPipeline instances with mocked dependencies.
 * @see tests/common/prompting/promptPipelineTestBed.js
 */
/* eslint-env jest */
/* global beforeEach */

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
import { describeSuite } from '../describeSuite.js';

/**
 * @description Utility class for unit tests that need an AIPromptPipeline with common mocks.
 * @class
 */
export class AIPromptPipelineTestBed extends BaseTestBed {
  /** @type {import('../../src/entities/entity.js').default} */
  defaultActor;
  /** @type {import('../../src/turns/interfaces/ITurnContext.js').ITurnContext} */
  defaultContext;
  /** @type {import('../../src/turns/dtos/actionComposite.js').ActionComposite[]} */
  defaultActions;

  constructor() {
    const { mocks } = BaseTestBed.fromFactories({
      llmAdapter: createMockLLMAdapter,
      gameStateProvider: createMockAIGameStateProvider,
      promptContentProvider: createMockAIPromptContentProvider,
      promptBuilder: createMockPromptBuilder,
      logger: createMockLogger,
    });
    super(mocks);
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
   * @description Convenience wrapper over {@link generate} using the default
   * actor, context and actions provided by the test bed.
   * @returns {Promise<string>} The generated prompt string.
   */
  async generateDefault() {
    return this.generate(
      this.defaultActor,
      this.defaultContext,
      this.defaultActions
    );
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

/**
 * Defines a test suite with automatic {@link AIPromptPipelineTestBed} setup.
 *
 * @param {string} title - Suite title passed to `describe`.
 * @param {(getBed: () => AIPromptPipelineTestBed) => void} suiteFn - Callback
 *   containing the tests. Receives a getter for the active test bed.
 * @returns {void}
 */
function describeAIPromptPipelineSuite(title, suiteFn) {
  describeSuite(title, AIPromptPipelineTestBed, (getBed) => {
    beforeEach(() => {
      getBed().setupMockSuccess();
    });
    suiteFn(getBed);
  });
}

export { describeAIPromptPipelineSuite };

export default AIPromptPipelineTestBed;
