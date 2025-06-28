// src/commands/commandProcessor.js

// --- Static Imports ---
import { ATTEMPT_ACTION_ID } from '../constants/eventIds.js';
import { ICommandProcessor } from './interfaces/ICommandProcessor.js';
import { initLogger } from '../utils/index.js';
import { validateDependency } from '../utils/validationUtils.js';
import { dispatchSystemErrorEvent } from '../utils/systemErrorDispatchUtils.js';

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
      await dispatchSystemErrorEvent(
        this.#safeEventDispatcher,
        userMsg,
        {
          raw: internalMsg,
          timestamp: new Date().toISOString(),
          stack: new Error().stack,
        },
        this.#logger
      );
      return {
        success: false,
        errorResult: this.#createFailureResult(
          userMsg,
          internalMsg,
          commandString,
          undefined
        ),
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
      // dispatchSystemErrorEvent is called within #dispatchWithErrorHandling on exception, but not on a `false` return.
      await dispatchSystemErrorEvent(
        this.#safeEventDispatcher,
        userMsg,
        {
          raw: `VED validation likely failed for pre-resolved action. Payload: ${JSON.stringify(
            payload
          )}`,
          timestamp: new Date().toISOString(),
          stack: new Error().stack,
        },
        this.#logger
      );

      const failureResult = this.#createFailureResult(
        userMsg,
        internalMsg,
        commandString,
        actionDefinitionId
      );
      return { success: false, errorResult: failureResult };
    }
  }

  // --- Private Helper Methods ---

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
      await dispatchSystemErrorEvent(
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
