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
import { SYSTEM_ERROR_OCCURRED_ID } from '../../constants/eventIds.js';

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
    if (!logger || typeof logger.error !== 'function') {
      console.error('CommandOutcomeInterpreter Constructor: Invalid logger.');
      throw new Error('CommandOutcomeInterpreter: Invalid ILogger dependency.');
    }
    this.#logger = logger;
    if (!dispatcher || typeof dispatcher.dispatch !== 'function') {
      this.#logger.error(
        'CommandOutcomeInterpreter Constructor: Invalid ISafeEventDispatcher.'
      );
      throw new Error(
        'CommandOutcomeInterpreter: Invalid ISafeEventDispatcher dependency.'
      );
    }
    this.#dispatcher = dispatcher;
    this.#logger.debug(
      'CommandOutcomeInterpreter: Instance created successfully.'
    );
  }

  async interpret(result, turnContext) {
    if (!turnContext || typeof turnContext.getActor !== 'function') {
      const errorMsg = `CommandOutcomeInterpreter: Invalid turnContext provided.`;
      this.#logger.error(errorMsg, { receivedContextType: typeof turnContext });
      await this.#dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: 'Invalid turn context received by CommandOutcomeInterpreter.',
        details: {
          raw: `turnContext was ${turnContext === null ? 'null' : typeof turnContext}. Expected ITurnContext object.`,
          stack: new Error().stack,
          timestamp: new Date().toISOString(),
        },
      });
      throw new Error(errorMsg);
    }

    const actor = turnContext.getActor();
    if (!actor || !actor.id) {
      const errorMsg = `CommandOutcomeInterpreter: Could not retrieve a valid actor or actor ID from turnContext.`;
      this.#logger.error(errorMsg, { actorInContext: actor });
      await this.#dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: 'Invalid actor in turn context for CommandOutcomeInterpreter.',
        details: {
          raw: `Actor object in context was ${JSON.stringify(actor)}.`,
          stack: new Error().stack,
          timestamp: new Date().toISOString(),
        },
      });
      throw new Error(errorMsg);
    }
    const actorId = actor.id;
    const originalInput = result.originalInput || '';

    if (!result || typeof result.success !== 'boolean') {
      const baseErrorMsg = `CommandOutcomeInterpreter: Invalid CommandResult - 'success' boolean is missing. Actor: ${actorId}.`;
      this.#logger.error(baseErrorMsg, { receivedResult: result });
      await this.#dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: baseErrorMsg,
        details: {
          raw: `Actor ${actorId}, Received Result: ${JSON.stringify(result)}`,
          stack: new Error().stack,
          timestamp: new Date().toISOString(),
        },
      });
      throw new Error(baseErrorMsg);
    }

    // result.turnEnded from CP is true if CP failed, false if CP succeeded.
    const cpFailureEndsTurn =
      typeof result.turnEnded === 'boolean' ? result.turnEnded : true; // Default to true for safety on failure

    this.#logger.debug(
      `CommandOutcomeInterpreter: Interpreting for ${actorId}. CP_Success=${result.success}, CP_TurnEndedOnFail=${cpFailureEndsTurn}, Input="${originalInput}"`
    );

    // Determine a valid actionId
    let processedActionId = result.actionResult?.actionId;
    if (typeof processedActionId !== 'string' || !processedActionId.trim()) {
      const chosenAction = turnContext.getChosenAction(); // Might be null if not set or context changed
      processedActionId =
        chosenAction?.actionDefinitionId || 'core:unknown_action';
      this.#logger.debug(
        `CommandOutcomeInterpreter: actor ${actorId}: result.actionResult.actionId ('${result.actionResult?.actionId}') invalid/missing. Using action identifier: '${processedActionId}'.`
      );
    }

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
