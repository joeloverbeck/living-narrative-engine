// src/commands/commandProcessor.js

// --- Static Imports ---
import { ATTEMPT_ACTION_ID } from '../constants/eventIds.js';
import { ICommandProcessor } from './interfaces/ICommandProcessor.js';
import { initLogger } from '../utils/index.js';
import { validateDependency, assertValidId } from '../utils/dependencyUtils.js';
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';
import { createErrorDetails } from '../utils/errorDetails.js';

// --- Type Imports ---
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('./interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor_Interface */
/** @typedef {import('../turns/interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../types/commandResult.js').CommandResult} CommandResult */

/**
 * @description Processes raw command strings from actors.
 * @implements {ICommandProcessor_Interface}
 */
class CommandProcessor extends ICommandProcessor {
  /** @type {ILogger} */
  #logger;
  /** @type {ISafeEventDispatcher} */
  #safeEventDispatcher;

  /**
   * Creates an instance of CommandProcessor.
   *
   * @param {object} options - Configuration options for the processor.
   * @param {ISafeEventDispatcher} options.safeEventDispatcher - Required event dispatcher that must implement `dispatch`.
   * @param {ILogger} [options.logger] - Optional logger instance.
   * @throws {Error} If `safeEventDispatcher` is missing or lacks a `dispatch` method.
   */
  constructor(options) {
    super();

    const { logger, safeEventDispatcher } = options || {};

    this.#logger = initLogger('CommandProcessor', logger);

    validateDependency(
      safeEventDispatcher,
      'safeEventDispatcher',
      this.#logger,
      {
        requiredMethods: ['dispatch'],
      }
    );

    this.#safeEventDispatcher = safeEventDispatcher;

    this.#logger.debug(
      'CommandProcessor: Instance created and dependencies validated.'
    );
  }

  /**
   * Dispatches a pre-resolved action, bypassing parsing and target resolution.
   * This is the optimized path for AI-driven actions where the action and
   * its parameters are already known.
   *
   * @param {Entity} actor - The entity performing the action.
   * @param {ITurnAction} turnAction - The pre-resolved action object.
   * @returns {Promise<CommandResult>} A promise that resolves to the command result.
   */
  async dispatchAction(actor, turnAction) {
    const validationError = this.#validateActionInputs(actor, turnAction);
    if (validationError) {
      return this.#handleDispatchFailure({
        ...validationError,
        commandString: turnAction?.commandString,
      });
    }

    const actorId = actor.id;
    const { actionDefinitionId, commandString } = turnAction;
    this.#logger.debug(
      `CommandProcessor.dispatchAction: Dispatching pre-resolved action '${actionDefinitionId}' for actor ${actorId}.`,
      { turnAction }
    );

    // --- Payload Construction ---
    const payload = this.#buildAttemptActionPayload(actor, turnAction);

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
      return {
        success: true,
        turnEnded: false,
        originalInput: commandString || actionDefinitionId,
        actionResult: { actionId: actionDefinitionId },
      };
    }

    const internalMsg = `CRITICAL: Failed to dispatch pre-resolved ATTEMPT_ACTION_ID for ${actorId}, action "${actionDefinitionId}". Dispatcher reported failure.`;
    const userMsg = 'Internal error: Failed to initiate action.';
    this.#logger.error(internalMsg, { payload });
    return this.#handleDispatchFailure({
      userMsg,
      internalMsg,
      commandString,
      actionId: actionDefinitionId,
    });
  }

  // --- Private Helper Methods ---

  /**
   * @description Validates actor and action inputs for dispatchAction.
   * @param {Entity} actor - The entity performing the action.
   * @param {ITurnAction} turnAction - The proposed action object.
   * @returns {{userMsg: string, internalMsg: string}|null} Error details when invalid, otherwise null.
   */
  #validateActionInputs(actor, turnAction) {
    const actorId = actor?.id;
    const hasActionDefId =
      turnAction &&
      typeof turnAction === 'object' &&
      'actionDefinitionId' in turnAction;

    if (!actorId || !hasActionDefId) {
      return {
        userMsg: 'Internal error: Malformed action prevented execution.',
        internalMsg:
          'dispatchAction failed: actor must have id and turnAction must include actionDefinitionId.',
      };
    }

    try {
      assertValidId(actorId, 'CommandProcessor.dispatchAction', this.#logger);
      assertValidId(
        turnAction.actionDefinitionId,
        'CommandProcessor.dispatchAction',
        this.#logger
      );
    } catch (err) {
      return {
        userMsg: 'Internal error: Malformed action prevented execution.',
        internalMsg: `dispatchAction failed: ${err.message}`,
      };
    }

    return null;
  }

  /**
   * @description Handle a dispatch failure uniformly.
   * @param {object} opts Failure options.
   * @param {string} opts.userMsg User-facing error message.
   * @param {string} opts.internalMsg Detailed internal error message.
   * @param {string} [opts.commandString] Original command string.
   * @param {string} [opts.actionId] Action identifier.
   * @returns {Promise<CommandResult>} Failure result object.
   */
  async #handleDispatchFailure({
    userMsg,
    internalMsg,
    commandString,
    actionId,
  }) {
    this.#logger.error(internalMsg);
    safeDispatchError(
      this.#safeEventDispatcher,
      userMsg,
      createErrorDetails(internalMsg),
      this.#logger
    );
    return this.#createFailureResult(
      userMsg,
      internalMsg,
      commandString,
      actionId
    );
  }

  /**
   * @description Builds the payload for an action attempt dispatch.
   * @param {Entity} actor - The entity performing the action.
   * @param {ITurnAction} turnAction - The resolved turn action.
   * @returns {object} The payload for the `ATTEMPT_ACTION_ID` event.
   */
  #buildAttemptActionPayload(actor, turnAction) {
    const { actionDefinitionId, resolvedParameters, commandString } =
      turnAction;
    return {
      eventName: ATTEMPT_ACTION_ID,
      actorId: actor.id,
      actionId: actionDefinitionId,
      targetId: resolvedParameters?.targetId || null,
      originalInput: commandString || actionDefinitionId,
    };
  }

  /**
   * @description Creates a standardized failure {@link CommandResult}.
   * @param {string} [userError] - User-facing error message.
   * @param {string} [internalError] - Internal error message for logging.
   * @param {string} [originalInput] - The command string that was processed.
   * @param {string} [actionId] - Identifier of the attempted action.
   * @param {boolean} [turnEnded] - Indicates if the turn should end.
   * @returns {CommandResult} The failure result object.
   */
  #createFailureResult(
    userError,
    internalError,
    originalInput,
    actionId,
    turnEnded = true
  ) {
    const result = {
      success: false,
      turnEnded: turnEnded,
      internalError: internalError,
      originalInput,
      actionResult: actionId ? { actionId } : undefined,
    };
    if (userError !== undefined) {
      result.error = userError;
    }
    return result;
  }

  /**
   * @description Logs a successful dispatch.
   * @param {string} context - Logging context name.
   * @returns {void}
   */
  #logDispatchSuccess(context) {
    this.#logger.debug(
      `CommandProcessor.#dispatchWithErrorHandling: Dispatch successful for ${context}.`
    );
  }

  /**
   * @description Logs a failed dispatch when the dispatcher returns `false`.
   * @param {string} context - Logging context name.
   * @param {object} payload - Payload that was dispatched.
   * @returns {void}
   */
  #logDispatchFailure(context, payload) {
    this.#logger.warn(
      `CommandProcessor.#dispatchWithErrorHandling: SafeEventDispatcher reported failure for ${context} (likely VED validation failure). Payload: ${JSON.stringify(
        payload
      )}`
    );
  }

  /**
   * @description Handles exceptions thrown during dispatch and emits a safe error event.
   * @param {string} eventName - The event name being dispatched.
   * @param {string} context - Logging context name.
   * @param {Error} error - The thrown error.
   * @returns {void}
   */
  #handleDispatchException(eventName, context, error) {
    this.#logger.error(
      `CommandProcessor.#dispatchWithErrorHandling: CRITICAL - Error during dispatch for ${context}. Error: ${error.message}`,
      error
    );
    safeDispatchError(
      this.#safeEventDispatcher,
      'System error during event dispatch.',
      createErrorDetails(
        `Exception in dispatch for ${eventName}`,
        error?.stack || new Error().stack
      ),
      this.#logger
    );
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

      const success = await this.#safeEventDispatcher.dispatch(
        eventName,
        payload
      );

      if (success) {
        this.#logDispatchSuccess(loggingContextName);
      } else {
        // Dispatch returned false, likely due to validation failure.
        this.#logDispatchFailure(loggingContextName, payload);
      }
      return success;
    } catch (dispatchError) {
      this.#handleDispatchException(
        eventName,
        loggingContextName,
        dispatchError
      );
      return false;
    }
  }
}

export default CommandProcessor;
