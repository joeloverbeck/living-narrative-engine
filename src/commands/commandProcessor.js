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
import { createErrorDetails } from '../utils/errorDetails.js';
import EventDispatchService from '../events/eventDispatchService.js';

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
  /** @type {EventDispatchService} */
  #eventDispatchService;

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

    const { logger, safeEventDispatcher, eventDispatchService } = options || {};

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
    this.#eventDispatchService =
      eventDispatchService ?? new EventDispatchService();

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
      return this.#handleDispatchFailure(
        'Internal error: Malformed action prevented execution.',
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
    const dispatchSuccess = await this.#eventDispatchService.dispatch(
      this.#safeEventDispatcher,
      ATTEMPT_ACTION_ID,
      payload,
      {
        logger: this.#logger,
        context: `ATTEMPT_ACTION_ID dispatch for pre-resolved action ${actionId}`,
        errorDetails: createErrorDetails(
          `Exception in dispatch for ${ATTEMPT_ACTION_ID}`,
          undefined
        ),
      }
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
    return this.#handleDispatchFailure(
      'Internal error: Failed to initiate action.',
      internalMsg,
      commandString,
      actionId,
      { payload }
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

  /**
   * @description Handles failures during dispatch by logging, dispatching a
   * system error and returning a standardized failure result.
   * @param {string} userMsg - User-facing error message.
   * @param {string} internalMsg - Detailed internal error message.
   * @param {string} [commandString] - Original command string processed.
   * @param {string} [actionId] - Identifier of the attempted action.
   * @param {object} [logContext] - Optional logger context.
   * @returns {CommandResult} The standardized failure result.
   */
  #handleDispatchFailure(
    userMsg,
    internalMsg,
    commandString,
    actionId,
    logContext
  ) {
    if (logContext) {
      this.#logger.error(internalMsg, logContext);
    }
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
}

export default CommandProcessor;
