/**
 * @file Provides a minimal test bed for creating AIPromptPipeline instances with mocked dependencies.
 * @see tests/common/prompting/promptPipelineTestBed.js
 */
/* eslint-env jest */

import { AIPromptPipeline } from '../../../src/prompting/AIPromptPipeline.js';
import { expect } from '@jest/globals';
import {
  createMockLogger,
  createMockLLMAdapter,
  createMockAIGameStateProvider,
  createMockAIPromptContentProvider,
  createMockPromptBuilder,
  createMockEntity,
} from '../mockFactories';
import FactoryTestBed from '../factoryTestBed.js';
import { createDescribeTestBedSuite } from '../describeSuite.js';

/**
 * @typedef {object} DependencySpecEntry
 * @property {RegExp} error - Expected error when dependency is missing.
 * @property {string[]} methods - Methods required on the dependency.
 */

/**
 * @description Defines how {@link AIPromptPipeline} constructor dependencies
 * should be validated within tests. Each property specifies the expected error
 * regex and required method names for that dependency.
 * @type {Object<string, DependencySpecEntry>}
 */
export const AIPromptPipelineDependencySpec = {
  llmAdapter: {
    error: /ILLMAdapter/,
    methods: ['getAIDecision', 'getCurrentActiveLlmId'],
  },
  gameStateProvider: {
    error: /IAIGameStateProvider/,
    methods: ['buildGameState'],
  },
  promptContentProvider: {
    error: /IAIPromptContentProvider/,
    methods: ['getPromptData'],
  },
  promptBuilder: {
    error: /IPromptBuilder/,
    methods: ['build'],
  },
  logger: { error: /ILogger/, methods: ['info'] },
};

/**
 * @description Utility class for unit tests that need an AIPromptPipeline with common mocks.
 * @class
 */
export class AIPromptPipelineTestBed extends FactoryTestBed {
  /** @type {import('../../src/entities/entity.js').default} */
  defaultActor;
  /** @type {import('../../src/turns/interfaces/ITurnContext.js').ITurnContext} */
  defaultContext;
  /** @type {import('../../src/turns/dtos/actionComposite.js').ActionComposite[]} */
  defaultActions;

  constructor() {
    super({
      llmAdapter: createMockLLMAdapter,
      gameStateProvider: createMockAIGameStateProvider,
      promptContentProvider: createMockAIPromptContentProvider,
      promptBuilder: createMockPromptBuilder,
      logger: createMockLogger,
    });
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
    this._successOptions = { llmId, gameState, promptData, finalPrompt };
    this.mocks.llmAdapter.getCurrentActiveLlmId.mockResolvedValue(llmId);
    this.mocks.gameStateProvider.buildGameState.mockResolvedValue(gameState);
    this.mocks.promptContentProvider.getPromptData.mockResolvedValue(
      promptData
    );
    this.mocks.promptBuilder.build.mockResolvedValue(finalPrompt);
  }

  /**
   * Generates a prompt and verifies that all mocked dependencies were called
   * with the values configured by setupMockSuccess.
   *
   * @param {object} params - Options for generation and assertions.
   * @param {import('../../../src/entities/entity.js').default} params.actor - Actor for the prompt.
   * @param {import('../../../src/turns/interfaces/ITurnContext.js').ITurnContext} params.context - Turn context.
   * @param {import('../../../src/turns/dtos/actionComposite.js').ActionComposite[]} params.actions - Available actions.
   * @param {string} params.expectedPrompt - Expected final prompt string.
   * @param {string} [params.llmId] - Optional LLM ID override.
   * @param {object} [params.gameState] - Optional game state override.
   * @param {object} [params.promptData] - Optional prompt data override.
   * @param {string} [params.finalPrompt] - Optional final prompt override.
   * @returns {Promise<void>} Resolves when assertions pass.
   */
  async expectSuccessfulGeneration({
    actor,
    context,
    actions,
    expectedPrompt,
    llmId,
    gameState,
    promptData,
    finalPrompt,
  }) {
    this.setupMockSuccess({ llmId, gameState, promptData, finalPrompt });
    const prompt = await this.generate(actor, context, actions);
    expect(prompt).toBe(expectedPrompt);

    const {
      llmId: _llmId,
      gameState: _gameState,
      promptData: _promptData,
    } = this._successOptions;
    expect(this.llmAdapter.getCurrentActiveLlmId).toHaveBeenCalledTimes(1);
    expect(this.gameStateProvider.buildGameState).toHaveBeenCalledWith(
      actor,
      context,
      this.logger
    );
    expect(this.promptContentProvider.getPromptData).toHaveBeenCalledWith(
      expect.objectContaining({ ..._gameState, availableActions: actions }),
      this.logger
    );
    expect(this.promptBuilder.build).toHaveBeenCalledWith(_llmId, _promptData);
  }

  /**
   * Applies a mutation to the test bed's mocks and expects generation to fail.
   *
   * @description Applies a mutation to the mocks and verifies that
   *   {@link AIPromptPipelineTestBed#generateDefault} rejects with the given
   *   error.
   * @param {(bed: this) => void} mutateFn - Function that mutates the test
   *   bed's mocks before generation.
   * @param {string|RegExp|Error} expectedError - Error expected from the
   *   generation call.
   * @returns {Promise<void>} Resolves when the assertion completes.
   */
  async expectGenerationFailure(mutateFn, expectedError) {
    mutateFn(this);
    await expect(this.generateDefault()).rejects.toThrow(expectedError);
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
export const describeAIPromptPipelineSuite = createDescribeTestBedSuite(
  AIPromptPipelineTestBed,
  {
    beforeEachHook(bed) {
      bed.setupMockSuccess();
    },
  }
);

export default AIPromptPipelineTestBed;
