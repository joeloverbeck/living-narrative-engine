// src/turns/strategies/aiPlayerStrategy.js
// --- FILE START ---

/**
 * @file This module implements the IActorTurnStrategy for AI-controlled characters
 * using an indexed action selection model.
 * @see src/turns/strategies/aiPlayerStrategy.js
 */

// --- JSDoc Imports ---
/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').AIStrategyDecision} AIStrategyDecision */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../prompting/interfaces/IAIPromptPipeline.js').IAIPromptPipeline} IAIPromptPipeline */
/** @typedef {import('../interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */
/** @typedef {import('../interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor */
/** @typedef {import('../interfaces/IAIFallbackActionFactory.js').IAIFallbackActionFactory} IAIFallbackActionFactory */
/** @typedef {import('../../interfaces/IActionDiscoveryService.js').IActionDiscoveryService} IActionDiscoveryService */
/** @typedef {import('../dtos/actionComposite.js').ActionComposite} ActionComposite */
/** @typedef {import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo} DiscoveredActionInfo */

// --- Module Imports ---
import { IActorTurnStrategy } from '../interfaces/IActorTurnStrategy.js';
import { validateDependency } from '../../utils/validationUtils.js';

/**
 * @class AIPlayerStrategy
 * @implements {IActorTurnStrategy}
 * @description
 * Implements the turn strategy for an AI-controlled actor. This strategy orchestrates
 * the AI's decision-making process by discovering available actions, presenting them
 * to an LLM for selection via an index, and processing the structured response to
 * form a final, executable turn action.
 */
export class AIPlayerStrategy extends IActorTurnStrategy {
  /** @type {ILLMAdapter} */
  #llmAdapter;
  /** @type {IAIPromptPipeline} */
  #aiPromptPipeline;
  /** @type {ILLMResponseProcessor} */
  #llmResponseProcessor;
  /** @type {IAIFallbackActionFactory} */
  #aiFallbackActionFactory;
  /** @type {ILogger} */
  #logger;

  /**
   * Creates an instance of AIPlayerStrategy.
   *
   * @param {object} dependencies - The dependencies for this strategy.
   * @param {ILLMAdapter} dependencies.llmAdapter - Adapter for LLM communication.
   * @param {IAIPromptPipeline} dependencies.aiPromptPipeline - Facade for generating the final prompt.
   * @param {ILLMResponseProcessor} dependencies.llmResponseProcessor - Processor for LLM responses.
   * @param {IAIFallbackActionFactory} dependencies.aiFallbackActionFactory - Factory for creating fallback actions.
   * @param {ILogger} dependencies.logger - Logger instance.
   * @throws {Error} If any dependency is invalid.
   */
  constructor({
    llmAdapter,
    aiPromptPipeline,
    llmResponseProcessor,
    aiFallbackActionFactory,
    logger,
  }) {
    super();
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    this.#logger = logger;

    try {
      validateDependency(llmAdapter, 'ILLMAdapter', this.#logger, {
        requiredMethods: ['getAIDecision'],
      });
      validateDependency(aiPromptPipeline, 'IAIPromptPipeline', this.#logger, {
        requiredMethods: ['generatePrompt'],
      });
      validateDependency(
        llmResponseProcessor,
        'ILLMResponseProcessor',
        this.#logger,
        { requiredMethods: ['processResponse'] }
      );
      validateDependency(
        aiFallbackActionFactory,
        'IAIFallbackActionFactory',
        this.#logger,
        { requiredMethods: ['create'] }
      );
    } catch (err) {
      this.#logger.error(`AIPlayerStrategy Constructor: ${err.message}`);
      throw err;
    }

    this.#llmAdapter = llmAdapter;
    this.#aiPromptPipeline = aiPromptPipeline;
    this.#llmResponseProcessor = llmResponseProcessor;
    this.#aiFallbackActionFactory = aiFallbackActionFactory;

    this.#logger.debug('AIPlayerStrategy initialized.');
  }

  /**
   * Orchestrates the AI's decision-making process for a single turn.
   *
   * @param {ITurnContext} context - The context for the current turn.
   * @returns {Promise<AIStrategyDecision>} A promise that resolves to the AI's decided action and auxiliary data.
   */
  async decideAction(context) {
    // 1. --- Precondition Validation ---
    if (!context) {
      throw new Error('AIPlayerStrategy received an invalid ITurnContext.');
    }
    const actor = context.getActor();
    if (!actor || !actor.id) {
      throw new Error(
        'AIPlayerStrategy could not retrieve a valid actor from the context.'
      );
    }
    const actorId = actor.id;

    try {
      this.#logger.debug(
        `AIPlayerStrategy: Starting action decision for actor ${actorId}.`
      );

      // 2. --- Discover Available Actions ---
      const availableActions = await this._getAvailableActions(actor, context);
      if (!availableActions) {
        return this._createFallbackDecision(
          'no_available_actions',
          new Error('No actions were discovered for the actor.'),
          actorId
        );
      }

      // 3. --- Query LLM for a Choice ---
      const llmResult = await this._queryLLM(actor, context, availableActions);
      const chosenIndex = llmResult?.action?.chosenIndex;
      const speech = llmResult?.action?.speech || null;

      // 4. --- Validate and Resolve the Choice ---
      const chosenComposite =
        Number.isInteger(chosenIndex) &&
        chosenIndex > 0 &&
        chosenIndex <= availableActions.length
          ? availableActions[chosenIndex - 1]
          : null;

      if (!chosenComposite) {
        const error = new Error(
          `LLM returned an invalid or out-of-bounds index: ${chosenIndex}. Total actions: ${availableActions.length}.`
        );
        return this._createFallbackDecision(
          'llm_invalid_index',
          error,
          actorId,
          speech // Preserve speech even on this type of failure
        );
      }

      // 5. --- Construct and Return Final Decision ---
      const turnAction = this._buildTurnActionFromComposite(chosenComposite);
      if (speech && typeof speech === 'string' && speech.trim().length > 0) {
        turnAction.speech = speech.trim();
        this.#logger.debug(`Actor ${actorId}: Attached speech to turnAction.`);
      }

      this.#logger.info(
        `Actor ${actorId}: Successfully resolved action. Index: ${chosenIndex}, Action ID: ${turnAction.actionDefinitionId}`
      );

      return {
        action: turnAction,
        extractedData: { speech },
      };
    } catch (error) {
      // MASTER ERROR HANDLER for unexpected failures (e.g., service unavailable)
      this.#logger.error(
        `AIPlayerStrategy: Critical error during action decision for actor ${actorId}.`,
        error
      );
      const failureContext =
        error.name === 'LLMProcessingError'
          ? 'llm_response_processing'
          : 'unhandled_strategy_error';
      return this._createFallbackDecision(failureContext, error, actorId);
    }
  }

  /**
   * Encapsulates the logic to convert an ActionComposite into a valid ITurnAction.
   * @private
   * @param {ActionComposite} composite - The chosen action composite.
   * @returns {ITurnAction} A valid turn action object.
   */
  _buildTurnActionFromComposite(composite) {
    return {
      actionDefinitionId: composite.actionId,
      resolvedParameters: composite.params,
      commandString: composite.commandString,
    };
  }

  /**
   * Creates and logs a fallback action decision.
   * @private
   * @param {string} reason - The context/reason for the fallback (for the factory).
   * @param {Error} error - The underlying error object.
   * @param {string} actorId - The ID of the actor for logging and the factory.
   * @param {string | null} [speech=null] - Any speech extracted before the failure.
   * @returns {AIStrategyDecision} The structured decision object containing the fallback action.
   */
  _createFallbackDecision(reason, error, actorId, speech = null) {
    this.#logger.warn(
      `Actor ${actorId}: Triggering fallback for reason '${reason}'. Error: ${error.message}`
    );
    const fallbackAction = this.#aiFallbackActionFactory.create(
      reason,
      error,
      actorId
    );
    return {
      action: fallbackAction,
      extractedData: { speech },
    };
  }

  /**
   * Discovers and prepares available actions for the AI.
   * @private
   * @param {Entity} actor - The actor making the decision.
   * @param {ITurnContext} context - The current turn context.
   * @returns {Promise<ActionComposite[] | null>} A promise that resolves to the list of available actions, or null if no valid actions are found.
   * @throws {Error} If the ActionDiscoveryService is not available in the context.
   */
  async _getAvailableActions(actor, context) {
    const actionDiscoveryService = context.getActionDiscoveryService();
    if (!actionDiscoveryService) {
      throw new Error('ActionDiscoveryService not found in the turn context.');
    }

    const discoveredActions = await actionDiscoveryService.getValidActions(
      actor,
      context
    );

    if (!discoveredActions || discoveredActions.length === 0) {
      return null;
    }

    return discoveredActions.map((action, index) => ({
      index: index + 1,
      actionId: action.id,
      commandString: action.command,
      params: action.params,
      description: action.description || action.name,
    }));
  }

  /**
   * Generates a prompt, queries the LLM, and processes the structured response.
   * @private
   * @param {Entity} actor - The actor for whom the prompt is generated.
   * @param {ITurnContext} context - The current turn context.
   * @param {ActionComposite[]} availableActions - The list of actions to include in the prompt.
   * @returns {Promise<object>} A promise that resolves to the processed LLM result object.
   * @throws {Error} If the prompt pipeline returns an empty prompt.
   */
  async _queryLLM(actor, context, availableActions) {
    const finalPromptString = await this.#aiPromptPipeline.generatePrompt(
      actor,
      context,
      availableActions
    );

    if (!finalPromptString) {
      throw new Error('AIPromptPipeline returned an empty or invalid prompt.');
    }

    this.#logger.debug(`Actor ${actor.id}: Generated prompt for LLM.`);

    const llmJsonResponse =
      await this.#llmAdapter.getAIDecision(finalPromptString);

    this.#logger.debug(
      `Actor ${actor.id}: Received LLM JSON response: ${llmJsonResponse}`
    );

    return this.#llmResponseProcessor.processResponse(
      llmJsonResponse,
      actor.id
    );
  }
}
// --- FILE END ---
