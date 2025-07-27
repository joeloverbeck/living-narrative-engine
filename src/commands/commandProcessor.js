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
import MultiTargetEventBuilder from '../entities/multiTarget/multiTargetEventBuilder.js';
import TargetExtractionResult from '../entities/multiTarget/targetExtractionResult.js';

// --- Type Imports ---
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('./interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor_Interface */
/** @typedef {import('../turns/interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../utils/eventDispatchService.js').EventDispatchService} EventDispatchService */
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

  // Performance metrics
  #payloadCreationCount = 0;
  #multiTargetPayloadCount = 0;
  #legacyPayloadCount = 0;
  #fallbackPayloadCount = 0;
  #totalPayloadCreationTime = 0;
  #averagePayloadCreationTime = 0;

  /**
   * Creates an instance of CommandProcessor.
   *
   * @param {object} options - Configuration options for the processor.
   * @param {ISafeEventDispatcher} options.safeEventDispatcher - Required event dispatcher that must implement `dispatch`.
   * @param {EventDispatchService} options.eventDispatchService - Required event dispatch service.
   * @param {ILogger} [options.logger] - Optional logger instance.
   * @throws {Error} If required dependencies are missing or lack required methods.
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

    validateDependency(
      eventDispatchService,
      'eventDispatchService',
      this.#logger,
      {
        requiredMethods: ['dispatchWithErrorHandling'],
      }
    );

    this.#safeEventDispatcher = safeEventDispatcher;
    this.#eventDispatchService = eventDispatchService;

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
    const dispatchSuccess =
      await this.#eventDispatchService.dispatchWithErrorHandling(
        ATTEMPT_ACTION_ID,
        payload,
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
   * Enhanced attempt action payload creation with multi-target support
   *
   * @param {Entity} actor - Actor entity performing the action
   * @param {ITurnAction} turnAction - Turn action data from discovery pipeline
   * @returns {object} Enhanced event payload with multi-target support
   */
  #createAttemptActionPayload(actor, turnAction) {
    const startTime = performance.now();
    let extractionResult = null;
    let isFallback = false;

    try {
      // Validate inputs
      this.#validatePayloadInputs(actor, turnAction);

      // Extract target data using existing TargetExtractionResult
      extractionResult = TargetExtractionResult.fromResolvedParameters(
        turnAction.resolvedParameters,
        this.#logger
      );

      // Create event payload using the builder pattern
      const eventBuilder = MultiTargetEventBuilder.fromTurnAction(
        actor,
        turnAction,
        extractionResult,
        this.#logger
      );

      const payload = eventBuilder.build();
      const duration = performance.now() - startTime;

      // Update metrics and log
      this.#updatePayloadMetrics(payload, extractionResult, duration, false);
      this.#logPayloadCreation(payload, extractionResult, duration);

      return payload;
    } catch (error) {
      const duration = performance.now() - startTime;
      isFallback = true;

      this.#logger.error('Enhanced payload creation failed, using fallback', {
        error: error.message,
        actorId: actor?.id,
        actionId: turnAction?.actionDefinitionId,
        duration: duration.toFixed(2),
      });

      // Create fallback payload
      const fallbackPayload = this.#createFallbackPayload(actor, turnAction);
      this.#updatePayloadMetrics(
        fallbackPayload,
        extractionResult,
        duration,
        true
      );

      return fallbackPayload;
    }
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

  /**
   * Validates inputs for payload creation
   *
   * @param {Entity} actor - Actor entity
   * @param {ITurnAction} turnAction - Turn action data
   * @throws {Error} If inputs are invalid
   */
  #validatePayloadInputs(actor, turnAction) {
    if (!actor || !actor.id) {
      throw new Error('Valid actor with ID is required for payload creation');
    }

    if (!turnAction || !turnAction.actionDefinitionId) {
      throw new Error('Valid turn action with actionDefinitionId is required');
    }

    if (!turnAction.commandString && !turnAction.actionDefinitionId) {
      throw new Error(
        'Turn action must have either commandString or actionDefinitionId'
      );
    }
  }

  /**
   * Creates a fallback payload when enhanced creation fails
   *
   * @param {Entity} actor - Actor entity
   * @param {ITurnAction} turnAction - Turn action data
   * @returns {object} Basic event payload
   */
  #createFallbackPayload(actor, turnAction) {
    this.#logger.warn(
      'Creating fallback payload due to enhanced creation failure'
    );

    // Use original simple payload creation as fallback
    const { actionDefinitionId, resolvedParameters, commandString } =
      turnAction;

    return {
      eventName: ATTEMPT_ACTION_ID,
      actorId: actor.id,
      actionId: actionDefinitionId,
      targetId: resolvedParameters?.targetId || null,
      originalInput: commandString || actionDefinitionId,
      timestamp: Date.now(),
    };
  }

  /**
   * Logs payload creation details
   *
   * @param {object} payload - Created payload
   * @param {TargetExtractionResult} extractionResult - Target extraction result
   * @param {number} duration - Creation duration in ms
   */
  #logPayloadCreation(payload, extractionResult, duration) {
    const logData = {
      eventName: payload.eventName,
      actorId: payload.actorId,
      actionId: payload.actionId,
      hasMultipleTargets: extractionResult.hasMultipleTargets(),
      targetCount: extractionResult.getTargetCount(),
      primaryTarget: extractionResult.getPrimaryTarget(),
      extractionSource: extractionResult.getMetadata('source'),
      creationTime: duration.toFixed(2),
    };

    if (extractionResult.hasMultipleTargets()) {
      logData.targets = extractionResult.getTargets();
      this.#logger.info('Enhanced multi-target payload created', logData);
    } else {
      this.#logger.debug('Legacy-compatible payload created', logData);
    }

    // Performance warning for slow payload creation
    if (duration > 10) {
      this.#logger.warn('Payload creation took longer than expected', {
        duration: duration.toFixed(2),
        target: '< 10ms',
      });
    }
  }

  /**
   * Updates payload creation metrics
   *
   * @param {object} payload - Created payload
   * @param {TargetExtractionResult} extractionResult - Extraction result
   * @param {number} duration - Creation duration
   * @param {boolean} isFallback - Whether this was a fallback creation
   */
  #updatePayloadMetrics(
    payload,
    extractionResult,
    duration,
    isFallback = false
  ) {
    this.#payloadCreationCount++;
    this.#totalPayloadCreationTime += duration;
    this.#averagePayloadCreationTime =
      this.#totalPayloadCreationTime / this.#payloadCreationCount;

    if (isFallback) {
      this.#fallbackPayloadCount++;
    } else if (extractionResult && extractionResult.hasMultipleTargets()) {
      this.#multiTargetPayloadCount++;
    } else {
      this.#legacyPayloadCount++;
    }

    // Log metrics periodically
    if (this.#payloadCreationCount % 100 === 0) {
      this.#logger.info(
        'Payload creation metrics update',
        this.getPayloadCreationStatistics()
      );
    }
  }

  /**
   * Gets payload creation statistics for monitoring
   *
   * @returns {object} Payload creation statistics
   */
  getPayloadCreationStatistics() {
    return {
      totalPayloadsCreated: this.#payloadCreationCount || 0,
      multiTargetPayloads: this.#multiTargetPayloadCount || 0,
      legacyPayloads: this.#legacyPayloadCount || 0,
      fallbackPayloads: this.#fallbackPayloadCount || 0,
      averageCreationTime: this.#averagePayloadCreationTime || 0,
    };
  }

  /**
   * Resets payload creation statistics
   */
  resetPayloadCreationStatistics() {
    this.#payloadCreationCount = 0;
    this.#multiTargetPayloadCount = 0;
    this.#legacyPayloadCount = 0;
    this.#fallbackPayloadCount = 0;
    this.#totalPayloadCreationTime = 0;
    this.#averagePayloadCreationTime = 0;
  }
}

export default CommandProcessor;
