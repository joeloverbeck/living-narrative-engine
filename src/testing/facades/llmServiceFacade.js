/**
 * @file LLMServiceFacade - Simplified interface for AI decision making in tests
 * @description Service facade that consolidates LLM-related services into a single,
 * easy-to-use interface for testing. Reduces test complexity by wrapping
 * LLMAdapter, LLMChooser, AIPromptPipeline, LLMResponseProcessor, and LLMDecisionProvider.
 */

/** @typedef {import('../../turns/adapters/llmChooser.js').LLMChooser} LLMChooser */
/** @typedef {import('../../prompting/interfaces/IAIPromptPipeline.js').IAIPromptPipeline} IAIPromptPipeline */
/** @typedef {import('../../turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */
/** @typedef {import('../../turns/interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor */
/** @typedef {import('../../turns/providers/llmDecisionProvider.js').LLMDecisionProvider} LLMDecisionProvider */
/** @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger */

/**
 * Facade providing simplified access to all LLM-related services for testing.
 * This facade reduces the complexity of setting up AI decision making in tests
 * by providing a single interface that coordinates multiple underlying services.
 */
export class LLMServiceFacade {
  #llmAdapter;
  #llmChooser;
  #promptPipeline;
  #responseProcessor;
  #decisionProvider;
  #logger;

  // Test-specific state
  #mockResponses = new Map();
  #currentStrategy = 'tool-calling';

  /**
   * Creates an instance of LLMServiceFacade.
   *
   * @param {object} deps - Dependencies object containing all required LLM services.
   * @param {ILLMAdapter} deps.llmAdapter - The LLM adapter for API communication.
   * @param {LLMChooser} deps.llmChooser - Service for generating prompts and processing responses.
   * @param {IAIPromptPipeline} deps.promptPipeline - Pipeline for prompt generation.
   * @param {ILLMResponseProcessor} deps.responseProcessor - Processor for LLM responses.
   * @param {LLMDecisionProvider} deps.decisionProvider - Provider for LLM decisions.
   * @param {ILogger} deps.logger - Logger for diagnostic output.
   * @throws {Error} If any required dependency is missing or invalid.
   */
  constructor({
    llmAdapter,
    llmChooser,
    promptPipeline,
    responseProcessor,
    decisionProvider,
    logger,
  }) {
    // Validate LLM adapter
    if (!llmAdapter || typeof llmAdapter.getAIDecision !== 'function') {
      throw new Error(
        'LLMServiceFacade: Missing or invalid llmAdapter dependency.'
      );
    }

    // Validate LLM chooser
    if (!llmChooser || typeof llmChooser.getAIChoice !== 'function') {
      throw new Error(
        'LLMServiceFacade: Missing or invalid llmChooser dependency.'
      );
    }

    // Validate prompt pipeline
    if (
      !promptPipeline ||
      typeof promptPipeline.generatePrompt !== 'function'
    ) {
      throw new Error(
        'LLMServiceFacade: Missing or invalid promptPipeline dependency.'
      );
    }

    // Validate response processor
    if (
      !responseProcessor ||
      typeof responseProcessor.processResponse !== 'function'
    ) {
      throw new Error(
        'LLMServiceFacade: Missing or invalid responseProcessor dependency.'
      );
    }

    // Validate decision provider
    if (
      !decisionProvider ||
      typeof decisionProvider.getDecision !== 'function'
    ) {
      throw new Error(
        'LLMServiceFacade: Missing or invalid decisionProvider dependency.'
      );
    }

    // Validate logger
    if (!logger || typeof logger.debug !== 'function') {
      throw new Error(
        'LLMServiceFacade: Missing or invalid logger dependency.'
      );
    }

    this.#llmAdapter = llmAdapter;
    this.#llmChooser = llmChooser;
    this.#promptPipeline = promptPipeline;
    this.#responseProcessor = responseProcessor;
    this.#decisionProvider = decisionProvider;
    this.#logger = logger;
  }

  /**
   * Gets an AI decision for the specified actor.
   * This is the main interface for AI decision making, coordinating
   * prompt generation, LLM invocation, and response processing.
   *
   * @param {string} actorId - The ID of the actor making the decision.
   * @param {object} context - The context for the decision.
   * @param {object} [options] - Optional configuration for the decision.
   * @param {string} [options.strategy] - LLM strategy to use ('tool-calling' or 'json-schema').
   * @returns {Promise<object>} The AI decision result.
   */
  async getAIDecision(actorId, context, options = {}) {
    this.#logger.debug('LLMServiceFacade: Getting AI decision', {
      actorId,
      context,
    });

    try {
      // Check for mock response first (for testing)
      const mockKey = `${actorId}:${this.#currentStrategy}`;
      if (this.#mockResponses.has(mockKey)) {
        const mockResponse = this.#mockResponses.get(mockKey);
        this.#logger.debug('LLMServiceFacade: Using mock response', {
          mockKey,
          mockResponse,
        });
        return mockResponse;
      }

      // Use strategy from options or current default
      const strategy = options.strategy || this.#currentStrategy;

      // Configure LLM strategy if needed
      if (strategy !== this.#currentStrategy) {
        await this.configureLLMStrategy(strategy);
      }

      // Delegate to the decision provider for the full workflow
      const decision = await this.#decisionProvider.getDecision({
        actorId,
        context,
        strategy,
      });

      this.#logger.debug('LLMServiceFacade: AI decision completed', {
        actorId,
        decision,
      });
      return decision;
    } catch (error) {
      this.#logger.error('LLMServiceFacade: Error getting AI decision', error);
      throw error;
    }
  }

  /**
   * Configures the LLM strategy for decision making.
   * Supports 'tool-calling' and 'json-schema' strategies.
   *
   * @param {string} strategy - The strategy to configure ('tool-calling' or 'json-schema').
   * @returns {Promise<void>}
   */
  async configureLLMStrategy(strategy) {
    if (!['tool-calling', 'json-schema'].includes(strategy)) {
      throw new Error(
        `LLMServiceFacade: Invalid strategy '${strategy}'. Must be 'tool-calling' or 'json-schema'.`
      );
    }

    this.#logger.debug('LLMServiceFacade: Configuring LLM strategy', {
      strategy,
    });

    this.#currentStrategy = strategy;

    // Configure the underlying LLM adapter if it supports strategy configuration
    if (typeof this.#llmAdapter.setStrategy === 'function') {
      await this.#llmAdapter.setStrategy(strategy);
    }
  }

  /**
   * Sets a mock response for testing purposes.
   * This allows tests to simulate LLM responses without making actual API calls.
   *
   * @param {string} actorId - The actor ID to mock responses for.
   * @param {object} response - The mock response to return.
   * @param {string} [strategy] - The strategy this mock applies to.
   */
  setMockResponse(actorId, response, strategy = 'tool-calling') {
    const mockKey = `${actorId}:${strategy}`;
    this.#mockResponses.set(mockKey, response);
    this.#logger.debug('LLMServiceFacade: Mock response set', {
      mockKey,
      response,
    });
  }

  /**
   * Clears all mock responses.
   * Useful for test cleanup between test cases.
   */
  clearMockResponses() {
    this.#mockResponses.clear();
    this.#logger.debug('LLMServiceFacade: All mock responses cleared');
  }

  /**
   * Gets the current LLM strategy.
   *
   * @returns {string} The current strategy ('tool-calling' or 'json-schema').
   */
  getCurrentStrategy() {
    return this.#currentStrategy;
  }

  /**
   * Provides direct access to the LLM adapter.
   * Use sparingly - prefer the higher-level getAIDecision method.
   *
   * @returns {ILLMAdapter} The LLM adapter instance.
   */
  get llmAdapter() {
    return this.#llmAdapter;
  }

  /**
   * Provides direct access to the LLM chooser.
   * Use sparingly - prefer the higher-level getAIDecision method.
   *
   * @returns {LLMChooser} The LLM chooser instance.
   */
  get llmChooser() {
    return this.#llmChooser;
  }

  /**
   * Provides direct access to the prompt pipeline.
   * Use sparingly - prefer the higher-level getAIDecision method.
   *
   * @returns {IAIPromptPipeline} The prompt pipeline instance.
   */
  get promptPipeline() {
    return this.#promptPipeline;
  }

  /**
   * Provides direct access to the response processor.
   * Use sparingly - prefer the higher-level getAIDecision method.
   *
   * @returns {ILLMResponseProcessor} The response processor instance.
   */
  get responseProcessor() {
    return this.#responseProcessor;
  }

  /**
   * Provides direct access to the decision provider.
   * Use sparingly - prefer the higher-level getAIDecision method.
   *
   * @returns {LLMDecisionProvider} The decision provider instance.
   */
  get decisionProvider() {
    return this.#decisionProvider;
  }

  /**
   * Dispose method to clean up resources.
   * Call this when the facade is no longer needed.
   */
  dispose() {
    this.#logger.debug('LLMServiceFacade: Disposing resources');

    this.clearMockResponses();

    // Dispose underlying services if they support it
    this.#llmAdapter?.dispose?.();
    this.#llmChooser?.dispose?.();
    this.#promptPipeline?.dispose?.();
    this.#responseProcessor?.dispose?.();
    this.#decisionProvider?.dispose?.();
  }
}
