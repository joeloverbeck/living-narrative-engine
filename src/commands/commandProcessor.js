// src/commands/commandProcessor.js

// --- Static Imports ---
import { ATTEMPT_ACTION_ID } from '../constants/eventIds.js';
import { ICommandProcessor } from './interfaces/ICommandProcessor.js';
import { initLogger } from '../utils/index.js';
import { validateDependency, assertValidId } from '../utils/dependencyUtils.js';
import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import {
  createFailureResult,
  dispatchFailure,
} from './helpers/commandResultUtils.js';
import { dispatchWithErrorHandling as dispatchEventWithErrorHandling } from '../utils/eventDispatchHelper.js';

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
    try {
      this.#validateActionInputs(actor, turnAction);
    } catch (err) {
      const userMsg = 'Internal error: Malformed action prevented execution.';
      dispatchFailure(
        this.#logger,
        this.#safeEventDispatcher,
        userMsg,
        err.message
      );
      return this.#buildFailureResult(
        userMsg,
        err.message,
        turnAction?.commandString,
        turnAction?.actionDefinitionId
      );
    }

    const actorId = actor.id;
    const { actionDefinitionId: actionId, commandString } = turnAction;
    this.#logger.debug(
      `CommandProcessor.dispatchAction: Dispatching pre-resolved action '${actionId}' for actor ${actorId}.`,
      { turnAction }
    );

    // --- Payload Construction ---
    const payload = this.#createAttemptActionPayload(actor, turnAction);

    // --- Dispatch ---
    const dispatchSuccess = await dispatchEventWithErrorHandling(
      this.#safeEventDispatcher,
      ATTEMPT_ACTION_ID,
      payload,
      this.#logger,
      `ATTEMPT_ACTION_ID dispatch for pre-resolved action ${actionId}`
    );

    if (dispatchSuccess) {
      this.#logger.debug(
        `CommandProcessor.dispatchAction: Successfully dispatched '${actionId}' for actor ${actorId}.`
      );
      return {
        success: true,
        turnEnded: false,
        originalInput: commandString || actionId,
        actionResult: { actionId },
      };
    }

    const internalMsg = `CRITICAL: Failed to dispatch pre-resolved ATTEMPT_ACTION_ID for ${actorId}, action "${actionId}". Dispatcher reported failure.`;
    const userMsg = 'Internal error: Failed to initiate action.';
    this.#logger.error(internalMsg, { payload });
    dispatchFailure(
      this.#logger,
      this.#safeEventDispatcher,
      userMsg,
      internalMsg
    );
    return this.#buildFailureResult(
      userMsg,
      internalMsg,
      commandString,
      actionId
    );
  }

  // --- Private Helper Methods ---

  /**
   * @description Validates actor and action inputs for dispatchAction.
   * @param {Entity} actor - The entity performing the action.
   * @param {ITurnAction} turnAction - The proposed action object.
   * @throws {InvalidArgumentError} When either input is invalid.
   * @returns {void}
   */
  #validateActionInputs(actor, turnAction) {
    const actorId = actor?.id;
    const hasActionDefId =
      turnAction &&
      typeof turnAction === 'object' &&
      'actionDefinitionId' in turnAction;

    if (!actorId || !hasActionDefId) {
      throw new InvalidArgumentError(
        'actor must have id and turnAction must include actionDefinitionId.'
      );
    }

    assertValidId(actorId, 'CommandProcessor.dispatchAction', this.#logger);
    assertValidId(
      turnAction.actionDefinitionId,
      'CommandProcessor.dispatchAction',
      this.#logger
    );
  }

  /**
   * @description Builds a standardized failure result.
   * @param {string} userMsg - User-facing error message.
   * @param {string} internalMsg - Detailed internal error message.
   * @param {string} [commandString] - Original command string that was processed.
   * @param {string} [actionId] - Identifier of the attempted action.
   * @returns {CommandResult} The failure result object.
   */
  #buildFailureResult(userMsg, internalMsg, commandString, actionId) {
    return createFailureResult(userMsg, internalMsg, commandString, actionId);
  }

  /**
   * @description Creates the payload for an action attempt dispatch.
   * @param {Entity} actor - The entity performing the action.
   * @param {ITurnAction} turnAction - The resolved turn action.
   * @returns {object} The payload for the `ATTEMPT_ACTION_ID` event.
   */
  #createAttemptActionPayload(actor, turnAction) {
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
}

export default CommandProcessor;
