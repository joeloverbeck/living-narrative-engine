/**
 * @file Provides a minimal test bed for creating AIPromptPipeline instances with mocked dependencies.
 * @see tests/common/prompting/promptPipelineTestBed.js
 */
/* eslint-env jest */

import { AIPromptPipeline } from '../../../src/prompting/AIPromptPipeline.js';
import { expect } from '@jest/globals';
import {
  AIPromptPipelineDependencySpec,
  expectSuccessfulGeneration,
  expectGenerationFailure,
} from './pipelineHelpers.js';
import {
  createMockLogger,
  createMockLLMAdapter,
  createMockAIGameStateProvider,
  createMockAIPromptContentProvider,
  createMockPromptBuilder,
  createMockEntity,
} from '../mockFactories';
import FactoryTestBed from '../factoryTestBed.js';
import { createServiceFactoryMixin } from '../serviceFactoryTestBedMixin.js';
import { createTestBedHelpers } from '../createTestBedHelpers.js';

const PipelineFactoryMixin = createServiceFactoryMixin(
  {
    llmAdapter: createMockLLMAdapter,
    gameStateProvider: createMockAIGameStateProvider,
    promptContentProvider: createMockAIPromptContentProvider,
    promptBuilder: createMockPromptBuilder,
    logger: createMockLogger,
  },
  (mocks) =>
    new AIPromptPipeline({
      llmAdapter: mocks.llmAdapter,
      gameStateProvider: mocks.gameStateProvider,
      promptContentProvider: mocks.promptContentProvider,
      promptBuilder: mocks.promptBuilder,
      logger: mocks.logger,
    }),
  'pipeline'
);

/**
 * @description Utility class for unit tests that need an AIPromptPipeline with common mocks.
 * @class
 */
export class AIPromptPipelineTestBed extends PipelineFactoryMixin(
  FactoryTestBed
) {
  /** @type {import('../../src/entities/entity.js').default} */
  defaultActor;
  /** @type {import('../../src/turns/interfaces/ITurnContext.js').ITurnContext} */
  defaultContext;
  /** @type {import('../../src/turns/dtos/actionComposite.js').ActionComposite[]} */
  defaultActions;

  constructor() {
    super();
    this.defaultActor = createMockEntity('actor');
    this.defaultContext = {};
    this.defaultActions = [];
    /** @private */
    this._successOptions = {
      llmId: 'llm-id',
      gameState: {},
      promptData: {},
      finalPrompt: 'PROMPT',
    };
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
    return this.pipeline.generatePrompt(actor, context, actions);
  }

  /**
   * Convenience wrapper that delegates to the {@code generate} method using the
   * default actor, context and actions provided by the test bed.
   *
   * @description Convenience wrapper over generate using default values.
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
    return this.mocks;
  }

  /**
   * Sets up mock resolved values for a successful pipeline run.
   *
   * @param {object} [pipelineOptions] - Configuration options.
   * @param {string} [pipelineOptions.llmId] - LLM ID returned by the adapter.
   * @param {object} [pipelineOptions.gameState] - Game state returned by the provider.
   * @param {object} [pipelineOptions.promptData] - Prompt data returned by the content provider.
   * @param {string} [pipelineOptions.finalPrompt] - Final prompt string returned by the builder.
   */
  setupMockSuccess(pipelineOptions = {}) {
    const {
      llmId = 'llm-id',
      gameState = {},
      promptData = {},
      finalPrompt = 'PROMPT',
    } = pipelineOptions;
    this._successOptions = { llmId, gameState, promptData, finalPrompt };
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
 * @param {(bed: AIPromptPipelineTestBed) => void} suiteFn - Callback
 *   containing the tests. Receives the active test bed instance.
 * @param overrides
 * @returns {void}
 */

export const {
  createBed: createAIPromptPipelineBed,
  describeSuite: describeAIPromptPipelineSuite,
} = createTestBedHelpers(AIPromptPipelineTestBed, {
  beforeEachHook(bed) {
    bed.setupMockSuccess();
  },
});

export {
  AIPromptPipelineDependencySpec,
  expectSuccessfulGeneration,
  expectGenerationFailure,
};
export default AIPromptPipelineTestBed;
