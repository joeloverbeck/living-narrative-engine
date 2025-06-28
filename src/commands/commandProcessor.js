// src/commands/commandProcessor.js

// --- Static Imports ---
import { ATTEMPT_ACTION_ID } from '../constants/eventIds.js';
import { ICommandProcessor } from './interfaces/ICommandProcessor.js';
import { initLogger } from '../utils/index.js';
import { validateDependency, assertValidId } from '../utils/dependencyUtils.js';
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';

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

  constructor(options) {
    super();

    const { logger, safeEventDispatcher: dispatcher } = options || {};

    this.#logger = initLogger('CommandProcessor', logger);

    validateDependency(dispatcher, 'safeEventDispatcher', this.#logger, {
      requiredMethods: ['dispatch'],
    });

    this.#safeEventDispatcher = dispatcher;

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
    await safeDispatchError(
      this.#safeEventDispatcher,
      userMsg,
      {
        raw: internalMsg,
        timestamp: new Date().toISOString(),
        stack: new Error().stack,
      },
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
      await safeDispatchError(
        this.#safeEventDispatcher,
        'System error during event dispatch.',
        {
          raw: `Exception in dispatch for ${eventName}`,
          timestamp: new Date().toISOString(),
          stack: dispatchError?.stack || new Error().stack,
        },
        this.#logger
      );
      return false;
    }
  }
}

export default CommandProcessor;
