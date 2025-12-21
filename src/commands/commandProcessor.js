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
import { ALL_MULTI_TARGET_ROLES } from '../actions/pipeline/TargetRoleRegistry.js';

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
  /** @type {import('../actions/tracing/actionTraceFilter.js').default} */
  #actionTraceFilter;
  /** @type {import('../actions/tracing/actionExecutionTraceFactory.js').ActionExecutionTraceFactory} */
  #actionExecutionTraceFactory;
  /** @type {import('../actions/tracing/actionTraceOutputService.js').ActionTraceOutputService} */
  #actionTraceOutputService;

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
   * @param {object} [options.actionTraceFilter] - Optional action trace filter.
   * @param {object} [options.actionExecutionTraceFactory] - Optional trace factory.
   * @param {object} [options.actionTraceOutputService] - Optional trace output service.
   * @throws {Error} If required dependencies are missing or lack required methods.
   */
  constructor(options) {
    super();

    const {
      logger,
      safeEventDispatcher,
      eventDispatchService,
      actionTraceFilter,
      actionExecutionTraceFactory,
      actionTraceOutputService,
    } = options || {};

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

    // Optional tracing dependencies - can be null if tracing is disabled
    this.#actionTraceFilter = actionTraceFilter;
    this.#actionExecutionTraceFactory = actionExecutionTraceFactory;
    this.#actionTraceOutputService = actionTraceOutputService;

    // Validate optional tracing dependencies if provided
    if (actionTraceFilter) {
      validateDependency(actionTraceFilter, 'IActionTraceFilter', null, {
        requiredMethods: ['isEnabled', 'shouldTrace'],
      });
    }

    if (actionExecutionTraceFactory) {
      validateDependency(
        actionExecutionTraceFactory,
        'IActionExecutionTraceFactory',
        null,
        {
          requiredMethods: ['createFromTurnAction'],
        }
      );
    }

    if (actionTraceOutputService) {
      validateDependency(
        actionTraceOutputService,
        'IActionTraceOutputService',
        null,
        {
          requiredMethods: ['writeTrace'],
        }
      );
    }

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
    let actionTrace = null;
    const actionId = turnAction?.actionDefinitionId;
    const actorId = actor?.id;

    // Early validation to prevent trace creation with invalid data
    try {
      this.#validateActionInputs(actor, turnAction);
    } catch (err) {
      this.#logger.error(
        'CommandProcessor.dispatchAction: Input validation failed',
        {
          error: err.message,
          actionId,
          actorId,
        }
      );
      return this.#handleDispatchFailure(
        'Internal error: Malformed action prevented execution.',
        err.message,
        turnAction?.commandString,
        actionId
      );
    }

    // Create execution trace if action should be traced
    try {
      if (this.#shouldCreateTrace(actionId)) {
        actionTrace = this.#createExecutionTrace(turnAction, actorId);
        actionTrace.captureDispatchStart();

        this.#logger.debug(
          `Created execution trace for action '${actionId}' by actor '${actorId}'`
        );
      }
    } catch (traceError) {
      // Log trace creation failure but continue execution
      this.#logger.warn('Failed to create execution trace', {
        error: traceError.message,
        actionId,
        actorId,
      });
    }

    this.#logger.debug(
      `CommandProcessor.dispatchAction: Dispatching pre-resolved action '${actionId}' for actor ${actorId}.`,
      { turnAction }
    );

    try {
      // --- Phase 1: Payload Construction ---
      const payload = this.#createAttemptActionPayload(actor, turnAction);

      // Add trace to payload for rule execution
      if (actionTrace) {
        payload.trace = actionTrace;
      }

      // Capture payload in trace
      if (actionTrace) {
        try {
          actionTrace.captureEventPayload(payload);
        } catch (payloadError) {
          this.#logger.warn('Failed to capture event payload in trace', {
            error: payloadError.message,
            actionId,
          });
        }
      }

      // --- Phase 2: Event Dispatch ---
      const dispatchSuccess =
        await this.#eventDispatchService.dispatchWithErrorHandling(
          ATTEMPT_ACTION_ID,
          payload,
          `ATTEMPT_ACTION_ID dispatch for pre-resolved action ${actionId}`
        );

      // --- Phase 3: Result Processing ---
      const dispatchResult = {
        success: dispatchSuccess,
        timestamp: Date.now(),
        metadata: {
          actionId,
          actorId,
          eventType: ATTEMPT_ACTION_ID,
        },
      };

      // Capture result in trace
      if (actionTrace) {
        try {
          actionTrace.captureDispatchResult(dispatchResult);
        } catch (resultError) {
          this.#logger.warn('Failed to capture dispatch result in trace', {
            error: resultError.message,
            actionId,
          });
        }
      }

      // --- Phase 4: Output and Return ---
      if (dispatchSuccess) {
        // Write trace asynchronously (success case)
        if (actionTrace && this.#actionTraceOutputService) {
          this.#writeTraceAsync(actionTrace, actionId);
        }

        this.#logger.debug(
          `CommandProcessor.dispatchAction: Successfully dispatched '${actionId}' for actor ${actorId}.`
        );

        return {
          success: true,
          turnEnded: false,
          originalInput: turnAction.commandString || actionId,
          actionResult: { actionId },
        };
      }

      // Handle dispatch failure
      const internalMsg = `CRITICAL: Failed to dispatch pre-resolved ATTEMPT_ACTION_ID for ${actorId}, action "${actionId}". Dispatcher reported failure.`;

      // Write trace asynchronously (failure case)
      if (actionTrace && this.#actionTraceOutputService) {
        this.#writeTraceAsync(actionTrace, actionId);
      }

      return this.#handleDispatchFailure(
        'Internal error: Failed to initiate action.',
        internalMsg,
        turnAction.commandString,
        actionId,
        { payload }
      );
    } catch (error) {
      // --- Phase 5: Error Handling ---
      this.#logger.error(
        `CommandProcessor.dispatchAction: Error dispatching action '${actionId}':`,
        error
      );

      // Capture error in trace
      if (actionTrace) {
        try {
          actionTrace.captureError(error);
        } catch (errorCaptureError) {
          this.#logger.warn('Failed to capture error in trace', {
            originalError: error.message,
            traceError: errorCaptureError.message,
            actionId,
          });
        }
      }

      // Write trace asynchronously (error case)
      if (actionTrace && this.#actionTraceOutputService) {
        this.#writeTraceAsync(actionTrace, actionId);
      }

      return this.#handleDispatchFailure(
        'Internal error: Action dispatch failed.',
        error.message,
        turnAction.commandString,
        actionId
      );
    }
  }

  // --- Private Helper Methods ---

  /**
   * Determine if execution trace should be created
   *
   * @private
   * @param {string} actionId - Action ID to check
   * @returns {boolean} True if trace should be created
   */
  #shouldCreateTrace(actionId) {
    // Fast path: no tracing infrastructure
    if (!this.#actionTraceFilter || !this.#actionExecutionTraceFactory) {
      return false;
    }

    // Check if tracing is globally enabled
    if (!this.#actionTraceFilter.isEnabled()) {
      return false;
    }

    // Check if this specific action should be traced
    if (!actionId || !this.#actionTraceFilter.shouldTrace(actionId)) {
      return false;
    }

    return true;
  }

  /**
   * Create execution trace instance
   *
   * @private
   * @param {object} turnAction - Turn action to trace
   * @param {string} actorId - Actor performing action
   * @returns {object} New trace instance
   */
  #createExecutionTrace(turnAction, actorId) {
    // Factory existence is guaranteed by #shouldCreateTrace check
    return this.#actionExecutionTraceFactory.createFromTurnAction(
      turnAction,
      actorId
    );
  }

  /**
   * Write trace to output asynchronously
   *
   * @private
   * @param {object} trace - Trace to write
   * @param {string} actionId - Action ID for logging
   */
  #writeTraceAsync(trace, actionId) {
    // Fire and forget - don't wait for trace writing
    this.#actionTraceOutputService.writeTrace(trace).catch((writeError) => {
      this.#logger.warn('Failed to write execution trace', {
        error: writeError.message,
        actionId,
        traceComplete: trace.isComplete,
        hasError: trace.hasError,
      });
    });
  }

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
    let isFallback = false;

    try {
      // Validate inputs
      this.#validatePayloadInputs(actor, turnAction);

      // Create enhanced payload using builder
      const payload = this.#createPayloadWithBuilder(actor, turnAction);

      const duration = performance.now() - startTime;

      // Update metrics and log
      this.#updatePayloadMetrics(payload, null, duration, false);
      this.#logEnhancedPayloadCreation(payload, duration);

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
      this.#updatePayloadMetrics(fallbackPayload, null, duration, true);

      return fallbackPayload;
    }
  }

  /**
   * Creates payload using MultiTargetEventBuilder
   *
   * @param {Entity} actor - Actor entity
   * @param {ITurnAction} turnAction - Turn action with resolved parameters
   * @returns {object} Enhanced event payload
   * @private
   */
  #createPayloadWithBuilder(actor, turnAction) {
    const { actionDefinitionId, resolvedParameters, commandString } =
      turnAction;

    // Create builder instance
    const builder = new MultiTargetEventBuilder({ logger: this.#logger })
      .setActor(actor.id)
      .setAction(actionDefinitionId)
      .setOriginalInput(commandString || actionDefinitionId)
      .setTimestamp();

    // Extract resolved target information
    const targetInfo = this.#extractResolvedTargets(resolvedParameters);

    // Handle different target scenarios
    if (targetInfo.hasMultipleTargets && targetInfo.comprehensiveTargets) {
      // Multi-target: set targets object which will automatically add flattened IDs
      builder.setTargets(targetInfo.comprehensiveTargets);
    } else if (targetInfo.primaryTarget || resolvedParameters?.targetId) {
      // Single target: use legacy method
      const targetId = targetInfo.primaryTarget || resolvedParameters.targetId;
      builder.setLegacyTarget(targetId);
    } else {
      // No targets
      builder.setLegacyTarget(null);
    }

    // Add metadata
    builder.setMetadata({
      resolvedTargetCount: targetInfo.resolvedTargetCount,
      hasContextDependencies: targetInfo.hasContextDependencies,
    });

    // Build and return the validated payload
    return builder.build();
  }

  /**
   * Extracts resolved target information from resolved parameters
   *
   * @param {object} resolvedParameters - Resolved parameters from turn action
   * @returns {object} Extracted target information
   * @private
   */
  #extractResolvedTargets(resolvedParameters) {
    const result = {
      primaryTarget: null,
      legacyFields: {
        primaryId: null,
        secondaryId: null,
        tertiaryId: null,
      },
      comprehensiveTargets: {},
      hasMultipleTargets: false,
      resolvedTargetCount: 0,
      hasContextDependencies: false,
    };

    if (!resolvedParameters) {
      return result;
    }

    // Check if this is a multi-target action
    if (resolvedParameters.isMultiTarget && resolvedParameters.targetIds) {
      result.hasMultipleTargets = true;

      // Handle both standard and custom placeholders
      const standardPlaceholders = ALL_MULTI_TARGET_ROLES;
      const legacyFieldNames = standardPlaceholders.map((role) => `${role}Id`);

      // Safely handle targetIds that might not be a proper object
      if (
        typeof resolvedParameters.targetIds === 'object' &&
        !Array.isArray(resolvedParameters.targetIds)
      ) {
        // Process all placeholders in targetIds
        Object.entries(resolvedParameters.targetIds).forEach(
          ([placeholder, targetList]) => {
            if (
              targetList &&
              Array.isArray(targetList) &&
              targetList.length > 0
            ) {
              const targetItem = targetList[0]; // Take first target

              // Extract entity ID if it's a valid string, skip invalid targets
              let targetId = null;
              if (typeof targetItem === 'string' && targetItem.trim()) {
                targetId = targetItem;
              } else if (
                targetItem &&
                typeof targetItem === 'object' &&
                targetItem.entityId &&
                typeof targetItem.entityId === 'string'
              ) {
                targetId = targetItem.entityId;
              }

              // Only process valid target IDs
              if (targetId) {
                // Set legacy fields only for standard placeholders
                const standardIndex = standardPlaceholders.indexOf(placeholder);
                if (standardIndex !== -1) {
                  result.legacyFields[legacyFieldNames[standardIndex]] =
                    targetId;
                }

                // Build comprehensive target info for all placeholders
                result.comprehensiveTargets[placeholder] = {
                  entityId: targetId,
                  placeholder: placeholder,
                  description: this.#getEntityDescription(targetId),
                  resolvedFromContext: this.#isResolvedFromContext(
                    placeholder,
                    resolvedParameters
                  ),
                  ...(this.#getContextSource(
                    placeholder,
                    resolvedParameters
                  ) && {
                    contextSource: this.#getContextSource(
                      placeholder,
                      resolvedParameters
                    ),
                  }),
                };

                result.resolvedTargetCount++;
              }
            }
          }
        );

        // Determine primary target for backward compatibility
        // Priority: primary > target > first available
        if (result.comprehensiveTargets.primary) {
          result.primaryTarget = result.comprehensiveTargets.primary.entityId;
        } else if (result.comprehensiveTargets.target) {
          result.primaryTarget = result.comprehensiveTargets.target.entityId;
        } else {
          // Use first available target
          const firstTarget = Object.values(result.comprehensiveTargets)[0];
          if (firstTarget && firstTarget.entityId) {
            result.primaryTarget = firstTarget.entityId;
          }
        }
      }

      // Check for context dependencies
      result.hasContextDependencies = Object.values(
        result.comprehensiveTargets
      ).some((target) => target.resolvedFromContext);
    } else if (resolvedParameters.targetId) {
      // Legacy single target
      result.primaryTarget = resolvedParameters.targetId;
      result.legacyFields.primaryId = resolvedParameters.targetId;
      result.resolvedTargetCount = 1;
    }

    return result;
  }

  /**
   * Get entity description for display
   *
   * @param {string} entityId - Entity ID
   * @returns {string} Entity description or ID if not found
   * @private
   */
  #getEntityDescription(entityId) {
    // For now, return the entity ID
    // In a full implementation, we would query the entity manager
    // But we need to avoid circular dependencies
    return entityId;
  }

  /**
   * Check if target was resolved from context
   *
   * @param {string} placeholder - Target placeholder (primary, secondary, etc)
   * @param {object} resolvedParameters - Resolved parameters
   * @returns {boolean} True if resolved from context
   * @private
   */
  #isResolvedFromContext(placeholder, resolvedParameters) {
    // Check if we have context dependency information
    // This would be enhanced based on actual data from MultiTargetResolutionStage
    if (placeholder === 'secondary' && resolvedParameters.targetIds?.primary) {
      // Secondary often depends on primary context
      return true;
    }
    return false;
  }

  /**
   * Get context source for a target
   *
   * @param {string} placeholder - Target placeholder
   * @param {object} resolvedParameters - Resolved parameters
   * @returns {string|null} Context source or null
   * @private
   */
  #getContextSource(placeholder, resolvedParameters) {
    // This would be enhanced with actual context dependency data
    if (
      placeholder === 'secondary' &&
      this.#isResolvedFromContext(placeholder, resolvedParameters)
    ) {
      return 'primary';
    }
    return null;
  }

  /**
   * Logs enhanced payload creation details
   *
   * @param {object} payload - Created payload
   * @param {number} duration - Creation duration in ms
   * @private
   */
  #logEnhancedPayloadCreation(payload, duration) {
    const logData = {
      eventName: payload.eventName,
      actorId: payload.actorId,
      actionId: payload.actionId,
      hasTargets: !!payload.targets,
      hasMultipleTargets:
        !!payload.targets && Object.keys(payload.targets).length > 1,
      targetCount: payload.resolvedTargetCount || 0,
      resolvedTargetCount: payload.resolvedTargetCount,
      hasContextDependencies: payload.hasContextDependencies,
      creationTime: duration.toFixed(2),
    };

    // Determine log level and message based on target type
    if (payload.targets && Object.keys(payload.targets).length > 1) {
      logData.targetPlaceholders = Object.keys(payload.targets);
      this.#logger.debug('Enhanced multi-target payload created', logData);
    } else if (payload.targetId !== null && payload.targetId !== undefined) {
      this.#logger.debug('Legacy-compatible payload created', logData);
    } else {
      this.#logger.debug('Standard payload created', logData);
    }

    // Performance warning - updated threshold to 10ms to match test expectations
    if (duration > 10) {
      this.#logger.warn('Payload creation took longer than expected', {
        duration: duration.toFixed(2),
        target: '< 10ms',
      });
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

    // Note: The check for commandString is redundant since we already verified actionDefinitionId exists
    // If actionDefinitionId is missing, we throw above. If it exists, this condition can never be true.
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
      // Add legacy fields as null for consistency
      primaryId: resolvedParameters?.targetId || null,
      secondaryId: null,
      tertiaryId: null,
      // Add metadata fields
      resolvedTargetCount: resolvedParameters?.targetId ? 1 : 0,
      hasContextDependencies: false,
    };
  }

  /**
   * Updates payload creation metrics
   *
   * @param {object} payload - Created payload
   * @param {TargetExtractionResult} extractionResult - Extraction result (unused, kept for compatibility)
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
    } else if (payload.targets && Object.keys(payload.targets).length > 0) {
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
