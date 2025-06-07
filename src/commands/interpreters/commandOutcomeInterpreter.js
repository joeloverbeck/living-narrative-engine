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

/**
 * @typedef {object} CommandResult Expected from CommandProcessor
 * @property {boolean} success - True if CommandProcessor successfully dispatched core:attempt_action.
 * @property {boolean} turnEnded - From CommandProcessor: false for success, true for its internal failures.
 * @property {string} [originalInput] - The original command string.
 * @property {object} [actionResult] - Contains actionId.
 * @property {string} [actionResult.actionId] - The ID of the action processed/attempted.
 * @property {Array<{text: string, type?: string}>} [actionResult.messages] - Optional messages (usually empty from CP).
 * @property {string} [error] - User-facing error message if CommandProcessor failed.
 * @property {string} [internalError] - Internal error details if CommandProcessor failed.
 * @property {string} [message] - General message (usually empty from CP).
 */
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

    let eventName = '';
    let eventPayload = {};
    let directive;

    let processedActionId = result.actionResult?.actionId;
    if (typeof processedActionId !== 'string' || !processedActionId.trim()) {
      const chosenAction = turnContext.getChosenAction(); // Might be null if not set or context changed
      processedActionId =
        chosenAction?.actionDefinitionId || 'core:unknown_action';
      this.#logger.debug(
        `CommandOutcomeInterpreter: actor ${actorId}: result.actionResult.actionId ('${result.actionResult?.actionId}') invalid/missing. Using chosenActionId: '${processedActionId}'.`
      );
    }

    if (result.success) {
      eventName = 'core:action_executed';
      const resultFieldMessages = [];
      if (
        result.actionResult?.messages &&
        Array.isArray(result.actionResult.messages)
      ) {
        result.actionResult.messages.forEach((msg) => {
          if (msg && typeof msg.text === 'string') {
            resultFieldMessages.push({
              text: msg.text,
              type: typeof msg.type === 'string' ? msg.type : 'info',
            });
          }
        });
      }
      // If CommandProcessor itself had a general message (though not typical for success)
      if (resultFieldMessages.length === 0 && result.message) {
        resultFieldMessages.push({
          text: String(result.message),
          type: 'info',
        });
      }

      eventPayload = {
        actorId: actorId,
        actionId: processedActionId,
        result: { success: true, messages: resultFieldMessages }, // Matching core:action_executed schema
        originalInput: originalInput, // Added as per schema update for core:action_executed
      };

      // For successful command processing (core:attempt_action dispatched),
      // always wait for rules to dispatch core:turn_ended.
      directive = TurnDirective.WAIT_FOR_EVENT;
      this.#logger.info(
        `Actor ${actorId}: CommandProcessor success for action '${processedActionId}'. Directive: ${directive}.`
      );
    } else {
      // result.success is false (failure within CommandProcessor pipeline)
      eventName = 'core:action_failed';
      const userFacingError =
        result.error || 'The action could not be completed.';

      // Construct payload for core:action_failed to match its schema
      eventPayload = {
        actorId: actorId,
        actionId: processedActionId, // Action ID that was being attempted
        commandString: originalInput, // Schema field name
        error: userFacingError, // Schema field name
        isExecutionError: false, // Failures from CP pipeline are not runtime execution errors of an action's own logic
      };

      // Per design: any failure detected by CommandProcessor ends the turn.
      // CommandProcessor now sets result.turnEnded = true for its failures.
      if (cpFailureEndsTurn) {
        directive = TurnDirective.END_TURN_FAILURE;
      } else {
        // This branch should ideally not be hit if CP is consistent.
        this.#logger.warn(
          `Actor ${actorId}: CommandProcessor failure for action '${processedActionId}' but CP_TurnEndedOnFail was false. Forcing END_TURN_FAILURE.`
        );
        directive = TurnDirective.END_TURN_FAILURE;
      }
      this.#logger.info(
        `Actor ${actorId}: CommandProcessor failure for action '${processedActionId}'. Directive: ${directive}.`
      );
    }

    this.#logger.debug(
      `CommandOutcomeInterpreter: Dispatching event '${eventName}' for actor ${actorId}.`
    );
    await this.#dispatcher.dispatch(eventName, eventPayload);

    this.#logger.debug(
      `CommandOutcomeInterpreter: Returning directive '${directive}' for actor ${actorId}.`
    );
    return directive;
  }
}

export default CommandOutcomeInterpreter;
