// src/commands/interpreters/commandOutcomeInterpreter.js

/**
 * @file Implements the CommandOutcomeInterpreter class responsible for
 * translating CommandProcessor results into TurnDirectives and dispatching
 * relevant core events.
 */

// --- Interface/Type Imports for JSDoc ---
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreterType */
/** @typedef {import('../../turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../entities/entity.js').default} Entity */

// --- Constant Imports ---
import TurnDirective from '../../turns/constants/turnDirectives.js';
// --- Interface Imports ---
import { ICommandOutcomeInterpreter } from '../interfaces/ICommandOutcomeInterpreter.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { initLogger } from '../../utils/index.js';
import { validateDependency } from '../../utils/validationUtils.js';

/**
 * @class CommandOutcomeInterpreter
 * @augments {ICommandOutcomeInterpreter}
 * @implements {ICommandOutcomeInterpreterType}
 */
class CommandOutcomeInterpreter extends ICommandOutcomeInterpreter {
  #dispatcher;
  #logger;

  constructor({ dispatcher, logger }) {
    super();

    this.#logger = initLogger('CommandOutcomeInterpreter', logger);

    validateDependency(dispatcher, 'ISafeEventDispatcher', this.#logger, {
      requiredMethods: ['dispatch'],
    });

    this.#dispatcher = dispatcher;
    this.#logger.debug(
      'CommandOutcomeInterpreter: Instance created successfully.'
    );
  }

  /**
   * Validate the provided turn context and return the actor id.
   *
   * @param {ITurnContext} turnContext - Current turn context.
   * @returns {string} Actor identifier from the context.
   * @throws {Error} If the context or actor is invalid.
   * @private
   */
  #validateTurnContext(turnContext) {
    if (!turnContext || typeof turnContext.getActor !== 'function') {
      const errorMsg = `CommandOutcomeInterpreter: Invalid turnContext provided.`;
      this.#logger.error(errorMsg, { receivedContextType: typeof turnContext });
      safeDispatchError(
        this.#dispatcher,
        'Invalid turn context received by CommandOutcomeInterpreter.',
        {
          raw: `turnContext was ${turnContext === null ? 'null' : typeof turnContext}. Expected ITurnContext object.`,
          stack: new Error().stack,
          timestamp: new Date().toISOString(),
        }
      );
      throw new Error(errorMsg);
    }

    const actor = turnContext.getActor();
    if (!actor || !actor.id) {
      const errorMsg = `CommandOutcomeInterpreter: Could not retrieve a valid actor or actor ID from turnContext.`;
      this.#logger.error(errorMsg, { actorInContext: actor });
      safeDispatchError(
        this.#dispatcher,
        'Invalid actor in turn context for CommandOutcomeInterpreter.',
        {
          raw: `Actor object in context was ${JSON.stringify(actor)}.`,
          stack: new Error().stack,
          timestamp: new Date().toISOString(),
        }
      );
      throw new Error(errorMsg);
    }

    return actor.id;
  }

  /**
   * Validate the command processor result object.
   *
   * @param {object} result - Result from the command processor.
   * @param {string} actorId - Actor identifier for diagnostics.
   * @returns {void}
   * @throws {Error} If the result is invalid.
   * @private
   */
  #validateResult(result, actorId) {
    if (!result || typeof result.success !== 'boolean') {
      const baseErrorMsg = `CommandOutcomeInterpreter: Invalid CommandResult - 'success' boolean is missing. Actor: ${actorId}.`;
      this.#logger.error(baseErrorMsg, { receivedResult: result });
      safeDispatchError(this.#dispatcher, baseErrorMsg, {
        raw: `Actor ${actorId}, Received Result: ${JSON.stringify(result)}`,
        stack: new Error().stack,
        timestamp: new Date().toISOString(),
      });
      throw new Error(baseErrorMsg);
    }
  }

  /**
   * Resolve a meaningful actionId from the result and context.
   *
   * @param {object} result - Result from the command processor.
   * @param {ITurnContext} turnContext - Current turn context.
   * @returns {string} The resolved action identifier.
   * @private
   */
  #resolveActionId(result, turnContext) {
    let processedActionId = result.actionResult?.actionId;
    if (typeof processedActionId !== 'string' || !processedActionId.trim()) {
      const actorId = turnContext.getActor().id;
      const chosenAction = turnContext.getChosenAction();
      processedActionId =
        chosenAction?.actionDefinitionId || 'core:unknown_action';
      this.#logger.debug(
        `CommandOutcomeInterpreter: actor ${actorId}: result.actionResult.actionId ('${result.actionResult?.actionId}') invalid/missing. Using action identifier: '${processedActionId}'.`
      );
    }
    return processedActionId;
  }

  async interpret(result, turnContext) {
    const actorId = this.#validateTurnContext(turnContext);
    const originalInput = result.originalInput || '';

    this.#validateResult(result, actorId);

    // result.turnEnded from CP is true if CP failed, false if CP succeeded.
    const cpFailureEndsTurn =
      typeof result.turnEnded === 'boolean' ? result.turnEnded : true; // Default to true for safety on failure

    this.#logger.debug(
      `CommandOutcomeInterpreter: Interpreting for ${actorId}. CP_Success=${result.success}, CP_TurnEndedOnFail=${cpFailureEndsTurn}, Input="${originalInput}"`
    );

    const processedActionId = this.#resolveActionId(result, turnContext);

    if (result.success) {
      const directive = TurnDirective.WAIT_FOR_EVENT;
      this.#logger.debug(
        `Actor ${actorId}: CommandProcessor success for action '${processedActionId}'. Directive: ${directive}.`
      );
      return directive;
    } else {
      // CommandProcessor detected failure

      // Any failure detected by CommandProcessor ends the turn.
      const directive = TurnDirective.END_TURN_FAILURE;
      this.#logger.debug(
        `Actor ${actorId}: CommandProcessor failure for action '${processedActionId}'. Directive: ${directive}.`
      );

      return directive;
    }
  }
}

export default CommandOutcomeInterpreter;
