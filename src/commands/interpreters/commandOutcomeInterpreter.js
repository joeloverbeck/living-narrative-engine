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
/** @typedef {import('../../types/commandResult.js').CommandResult} CommandResult */
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
   * Report invalid input by dispatching an error event, logging, and throwing.
   *
   * @param {string} message - Human readable error message.
   * @param {object} [details] - Structured diagnostic details.
   * @returns {never} Throws an error; does not return.
   * @throws {Error} Always throws with the provided message.
   * @private
   */
  #reportInvalidInput(message, details) {
    safeDispatchError(this.#dispatcher, message, details);
    this.#logger.error(message, details);
    throw new Error(message);
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
      const details = {
        raw: `turnContext was ${turnContext === null ? 'null' : typeof turnContext}. Expected ITurnContext object.`,
        stack: new Error().stack,
        timestamp: new Date().toISOString(),
        receivedContextType: typeof turnContext,
      };
      this.#reportInvalidInput(errorMsg, details);
    }

    const actor = turnContext.getActor();
    if (!actor || !actor.id) {
      const errorMsg = `CommandOutcomeInterpreter: Could not retrieve a valid actor or actor ID from turnContext.`;
      const details = {
        raw: `Actor object in context was ${JSON.stringify(actor)}.`,
        stack: new Error().stack,
        timestamp: new Date().toISOString(),
        actorInContext: actor,
      };
      this.#reportInvalidInput(errorMsg, details);
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
      const details = {
        raw: `Actor ${actorId}, Received Result: ${JSON.stringify(result)}`,
        stack: new Error().stack,
        timestamp: new Date().toISOString(),
        receivedResult: result,
      };
      this.#reportInvalidInput(baseErrorMsg, details);
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

  /**
   * Interpret a command processor result to decide the next turn directive.
   *
   * @override
   * @param {CommandResult} result - Result from the command processor.
   * @param {ITurnContext} turnContext - Current turn context for the actor.
   * @returns {Promise<TurnDirective | string>} The resolved turn directive.
   */
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
