// src/commands/commandProcessor.js

// --- Static Imports ---
import {
  ATTEMPT_ACTION_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../constants/eventIds.js';
import { ICommandProcessor } from './interfaces/ICommandProcessor.js';
import { validateDependency } from '../utils/validationUtils.js';

// --- Type Imports ---
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('./interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor_Interface */
/** @typedef {import('../turns/interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

// --- Type Definitions ---
/**
 * @typedef {object} CommandResult
 * @description The structure returned by the processCommand method.
 * @property {boolean} success - True if ATTEMPT_ACTION_ID was dispatched successfully. False for pipeline errors.
 * @property {boolean} turnEnded - For successes, this will be false (rules dictate turn end).
 * For failures within CommandProcessor, this will now be true.
 * @property {string} [originalInput] - The original trimmed command string.
 * @property {object} [actionResult] - Additional results, primarily the specific actionId.
 * @property {string} [actionResult.actionId] - The canonical actionId that was processed.
 * @property {string} [error] - User-facing error message for failures.
 * @property {string} [internalError] - Internal error message for logging.
 * @property {Array<{text: string, type?: string}>} [actionResult.messages] - Messages from the action.
 * @property {string} [message] - General message from CommandProcessor.
 */

/**
 * @description Processes raw command strings from actors.
 * @implements {ICommandProcessor_Interface}
 */
class CommandProcessor extends ICommandProcessor {
  /** @type {ILogger} */
  #logger;
  /** @type {ISafeEventDispatcher} */
  #safeEventDispatcher;

  constructor(options) {
    super();

    const { logger, safeEventDispatcher } = options || {};

    this.#logger = logger;

    try {
      validateDependency(
        safeEventDispatcher,
        'safeEventDispatcher',
        this.#logger,
        { requiredMethods: ['dispatch'] }
      );
    } catch (error) {
      this.#logger.error(
        `CommandProcessor Constructor: Dependency validation failed. ${error.message}`
      );
      throw error;
    }

    this.#safeEventDispatcher = safeEventDispatcher;

    this.#logger.debug(
      'CommandProcessor: Instance created and dependencies validated.'
    );
  }

  /**
   * Dispatches a pre-resolved action, bypassing parsing and target resolution.
   * This is the optimized path for AI-driven actions where the action and
   * its parameters are already known.
   * @param {Entity} actor - The entity performing the action.
   * @param {ITurnAction} turnAction - The pre-resolved action object.
   * @returns {Promise<{success: boolean, errorResult: CommandResult | null}>} A promise that resolves to an object indicating the outcome.
   */
  async dispatchAction(actor, turnAction) {
    const { actionDefinitionId, resolvedParameters, commandString } =
      turnAction;
    const actorId = actor.id;
    this.#logger.debug(
      `CommandProcessor.dispatchAction: Dispatching pre-resolved action '${actionDefinitionId}' for actor ${actorId}.`,
      { turnAction }
    );

    // --- Validation ---
    if (!actionDefinitionId) {
      const internalMsg = `dispatchAction failed: ITurnAction for actor ${actorId} is missing actionDefinitionId.`;
      const userMsg = 'Internal error: Malformed action prevented execution.';
      this.#logger.error(internalMsg);
      await this.#dispatchSystemError(userMsg, internalMsg);
      return {
        success: false,
        errorResult: this.#_createFailureResult(userMsg, internalMsg),
      };
    }

    // --- Payload Construction ---
    // The payload for ATTEMPT_ACTION_ID is built directly from the turnAction,
    // bypassing the need for parsing or target resolution.
    const payload = {
      eventName: ATTEMPT_ACTION_ID,
      actorId: actorId,
      actionId: actionDefinitionId,
      targetId: resolvedParameters?.targetId || null,
      direction: resolvedParameters?.direction || null, // Handle potential direction parameter
      originalInput: commandString || actionDefinitionId,
      // Note: If other parameters from `resolvedParameters` need to be passed,
      // the ATTEMPT_ACTION_ID event schema and its handlers must support them.
    };

    // --- Dispatch ---
    const dispatchSuccess = await this.#dispatchWithErrorHandling(
      ATTEMPT_ACTION_ID,
      payload,
      `ATTEMPT_ACTION_ID dispatch for pre-resolved action ${actionDefinitionId}`
    );

    if (dispatchSuccess) {
      this.#logger.debug(
        `CommandProcessor.dispatchAction: Successfully dispatched '${actionDefinitionId}' for actor ${actorId}.`
      );
      return { success: true, errorResult: null };
    } else {
      const internalMsg = `CRITICAL: Failed to dispatch pre-resolved ATTEMPT_ACTION_ID for ${actorId}, action "${actionDefinitionId}". Dispatcher reported failure.`;
      const userMsg = 'Internal error: Failed to initiate action.';
      this.#logger.error(internalMsg, { payload });
      // #dispatchSystemError is called within #dispatchWithErrorHandling on exception, but not on a `false` return.
      await this.#dispatchSystemError(
        userMsg,
        `VED validation likely failed for pre-resolved action. Payload: ${JSON.stringify(
          payload
        )}`
      );

      const failureResult = this.#_createFailureResult(userMsg, internalMsg);
      failureResult.originalInput = commandString;
      failureResult.actionResult = { actionId: actionDefinitionId };
      return { success: false, errorResult: failureResult };
    }
  }

  // --- Private Helper Methods ---

  #_createFailureResult(userError, internalError, turnEnded = true) {
    const result = {
      success: false,
      turnEnded: turnEnded,
      internalError: internalError,
      originalInput: undefined,
      actionResult: undefined,
    };
    if (userError !== undefined) {
      result.error = userError;
    }
    return result;
  }

  async #dispatchWithErrorHandling(eventName, payload, loggingContextName) {
    this.#logger.debug(
      `CommandProcessor.#dispatchWithErrorHandling: Attempting dispatch: ${loggingContextName} ('${eventName}')`
    );
    try {
      // The SafeEventDispatcher.dispatch expects (eventName, payload)
      // The payload here should NOT contain 'eventName' if the schema for 'eventName'
      // (e.g. ATTEMPT_ACTION_ID) requires 'eventName' within its payload.
      // If the schema for event 'eventName' *requires* an 'eventName' field inside its payload,
      // then 'payload' variable must already contain it.
      // The VED error "must have required property 'eventName'" means the payload passed to VED
      // was missing it.
      // The 'payload' constructed in #_dispatchActionAttempt *does* include eventName.

      const success = await this.#safeEventDispatcher.dispatch(
        eventName,
        payload
      );

      if (success) {
        this.#logger.debug(
          `CommandProcessor.#dispatchWithErrorHandling: Dispatch successful for ${loggingContextName}.`
        );
      } else {
        // This 'else' means dispatch returned false, likely because VED returned false.
        this.#logger.warn(
          `CommandProcessor.#dispatchWithErrorHandling: SafeEventDispatcher reported failure for ${loggingContextName} (likely VED validation failure). Payload: ${JSON.stringify(
            payload
          )}`
        );
      }
      return success;
    } catch (dispatchError) {
      this.#logger.error(
        `CommandProcessor.#dispatchWithErrorHandling: CRITICAL - Error during dispatch for ${loggingContextName}. Error: ${dispatchError.message}`,
        dispatchError
      );
      // If dispatch itself throws, it's a more fundamental issue.
      await this.#dispatchSystemError(
        'System error during event dispatch.',
        `Exception in dispatch for ${eventName}`,
        dispatchError
      );
      return false;
    }
  }

  async #dispatchSystemError(
    userMessage,
    internalDetails,
    originalError = null
  ) {
    const payload = {
      message: userMessage,
      details: {
        raw: internalDetails,
        timestamp: new Date().toISOString(),
      },
    };
    if (originalError?.stack) {
      payload.details.stack = originalError.stack;
    } else {
      payload.details.stack = new Error().stack;
    }

    if (originalError) {
      this.#logger.error(
        `CommandProcessor System Error: ${internalDetails}. Original Error: ${originalError.message}`,
        originalError
      );
    } else {
      this.#logger.error(`CommandProcessor System Error: ${internalDetails}`);
    }

    const dispatchSuccess = await this.#safeEventDispatcher.dispatch(
      SYSTEM_ERROR_OCCURRED_ID,
      payload
    );

    if (!dispatchSuccess) {
      this.#logger.error(
        `CommandProcessor: CRITICAL FAILURE - Failed to dispatch SYSTEM_ERROR_OCCURRED_ID event itself. Context: UserMessage='${userMessage}', InternalDetails='${internalDetails}'.`
      );
    }
  }
}

export default CommandProcessor;
