/**
 * @file TargetResolutionTracingOrchestrator - Centralizes all tracing logic for the
 * multi-target resolution stage so orchestration can remain lightweight.
 */

/** @typedef {import('../../../actionTypes.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../../../../entities/entity.js').default} Entity */
/** @typedef {import('../../../tracing/actionAwareStructuredTrace.js').default} ActionAwareStructuredTrace */
/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */

import { validateDependency } from '../../../../utils/dependencyUtils.js';

/**
 * @typedef {ActionAwareStructuredTrace | { captureActionData?: Function }} TraceLike
 */

/**
 * @class TargetResolutionTracingOrchestrator
 * @implements {import('../interfaces/ITargetResolutionTracingOrchestrator.js').ITargetResolutionTracingOrchestrator}
 */
export default class TargetResolutionTracingOrchestrator {
  #logger;

  /**
   * @param {object} deps - Service dependencies
   * @param {ILogger} deps.logger - Logger implementation
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#logger = logger;
  }

  /**
   * @description Determine whether the provided trace supports action-aware capture.
   * @param {TraceLike} trace - Trace instance to inspect
   * @returns {boolean} True if the trace supports action-aware capture
   */
  isActionAwareTrace(trace) {
    return Boolean(trace && typeof trace.captureActionData === 'function');
  }

  /**
   * @description Capture legacy action detection before conversion.
   * @param {TraceLike} trace - Trace instance used to capture telemetry
   * @param {string} actionId - Identifier of the action being evaluated
   * @param {object} detectionData - Data describing the detection step
   * @returns {void}
   */
  captureLegacyDetection(trace, actionId, detectionData) {
    if (!this.isActionAwareTrace(trace)) return;
    if (typeof trace.captureLegacyDetection !== 'function') {
      this.#logger.warn(
        'Action-aware trace missing captureLegacyDetection implementation'
      );
      return;
    }

    try {
      trace.captureLegacyDetection(actionId, { ...detectionData });
      this.#logger.debug(
        `TargetResolutionTracingOrchestrator: Legacy detection captured for action '${actionId}'`
      );
    } catch (error) {
      this.#logger.warn(
        `Failed to capture legacy detection for action '${actionId}'`,
        error
      );
    }
  }

  /**
   * @description Capture legacy conversion result from LegacyTargetCompatibilityLayer.
   * @param {TraceLike} trace - Trace instance used to capture telemetry
   * @param {string} actionId - Identifier of the action being evaluated
   * @param {object} conversionData - Data describing the conversion step
   * @returns {void}
   */
  captureLegacyConversion(trace, actionId, conversionData) {
    if (!this.isActionAwareTrace(trace)) return;
    if (typeof trace.captureLegacyConversion !== 'function') {
      this.#logger.warn(
        'Action-aware trace missing captureLegacyConversion implementation'
      );
      return;
    }

    try {
      trace.captureLegacyConversion(actionId, { ...conversionData });
      this.#logger.debug(
        `TargetResolutionTracingOrchestrator: Legacy conversion captured for action '${actionId}'`
      );
    } catch (error) {
      this.#logger.warn(
        `Failed to capture legacy conversion for action '${actionId}'`,
        error
      );
    }
  }

  /**
   * @description Capture scope evaluation output for a specific target key.
   * @param {TraceLike} trace - Trace instance used to capture telemetry
   * @param {string} actionId - Identifier of the action being evaluated
   * @param {string} targetKey - Target key being resolved
   * @param {object} evaluationData - Data describing the evaluation step
   * @returns {void}
   */
  captureScopeEvaluation(trace, actionId, targetKey, evaluationData) {
    if (!this.isActionAwareTrace(trace)) return;
    if (typeof trace.captureScopeEvaluation !== 'function') {
      this.#logger.warn(
        'Action-aware trace missing captureScopeEvaluation implementation'
      );
      return;
    }

    try {
      trace.captureScopeEvaluation(actionId, targetKey, {
        ...evaluationData,
      });
      this.#logger.debug(
        `TargetResolutionTracingOrchestrator: Scope evaluation captured for action '${actionId}' target '${targetKey}'`
      );
    } catch (error) {
      this.#logger.warn(
        `Failed to capture scope evaluation for action '${actionId}' target '${targetKey}'`,
        error
      );
    }
  }

  /**
   * @description Capture multi-target resolution summary for an action.
   * @param {TraceLike} trace - Trace instance used to capture telemetry
   * @param {string} actionId - Identifier of the action being evaluated
   * @param {object} resolutionData - Summary data about the resolution outcome
   * @returns {void}
   */
  captureMultiTargetResolution(trace, actionId, resolutionData) {
    if (!this.isActionAwareTrace(trace)) return;
    if (typeof trace.captureMultiTargetResolution !== 'function') {
      this.#logger.warn(
        'Action-aware trace missing captureMultiTargetResolution implementation'
      );
      return;
    }

    try {
      trace.captureMultiTargetResolution(actionId, { ...resolutionData });
      this.#logger.debug(
        `TargetResolutionTracingOrchestrator: Multi-target summary captured for action '${actionId}'`
      );
    } catch (error) {
      this.#logger.warn(
        `Failed to capture multi-target resolution for action '${actionId}'`,
        error
      );
    }
  }

  /**
   * @description Capture detailed resolution data for either legacy or multi-target flows.
   * @param {TraceLike} trace - Trace instance used to capture telemetry
   * @param {ActionDefinition} actionDef - Definition of the action being resolved
   * @param {Entity} actor - Actor whose action is being resolved
   * @param {object} resolutionData - Summary of the resolution results
   * @param {object} [detailedResults] - Optional detailed results payload
   * @returns {void}
   */
  captureResolutionData(
    trace,
    actionDef,
    actor,
    resolutionData,
    detailedResults
  ) {
    if (!this.isActionAwareTrace(trace)) return;

    const traceData = {
      stage: 'target_resolution',
      actorId: actor.id,
      ...resolutionData,
      timestamp: Date.now(),
    };

    if (detailedResults) {
      traceData.targetResolutionDetails = detailedResults;
    }

    this.#safeCaptureActionData(
      trace,
      'target_resolution',
      actionDef.id,
      traceData,
      {
        successMessage: `Captured target resolution data for action '${actionDef.id}'`,
        failureMessage: `Failed to capture target resolution data for action '${actionDef.id}'`,
      }
    );
  }

  /**
   * @description Capture target resolution error data.
   * @param {TraceLike} trace - Trace instance used to capture telemetry
   * @param {ActionDefinition} actionDef - Definition of the action being resolved
   * @param {Entity} actor - Actor whose action is being resolved
   * @param {Error} error - Error encountered during resolution
   * @returns {void}
   */
  captureResolutionError(trace, actionDef, actor, error) {
    if (!this.isActionAwareTrace(trace)) return;

    const errorData = {
      stage: 'target_resolution',
      actorId: actor.id,
      resolutionFailed: true,
      error: error.message,
      errorType: error.constructor?.name,
      scopeName: error.scopeName,
      timestamp: Date.now(),
    };

    this.#safeCaptureActionData(
      trace,
      'target_resolution',
      actionDef.id,
      errorData,
      {
        successMessage: `Captured target resolution error for action '${actionDef.id}'`,
        failureMessage: `Failed to capture target resolution error for action '${actionDef.id}'`,
      }
    );
  }

  /**
   * @description Capture post-resolution summary metrics (counts, legacy usage, timing).
   * @param {TraceLike} _trace - Trace instance used to capture telemetry
   * @param {Entity} actor - Actor whose action is being resolved
   * @param {number} originalCount - Number of original candidates processed
   * @param {number} resolvedCount - Number of candidates resolved
   * @param {boolean} hasLegacy - Whether legacy resolution was used
   * @param {boolean} hasMultiTarget - Whether multi-target resolution was used
   * @param {number} stageDurationMs - Duration of the stage in milliseconds
   * @returns {void}
   */
  capturePostResolutionSummary(
    _trace,
    actor,
    originalCount,
    resolvedCount,
    hasLegacy,
    hasMultiTarget,
    stageDurationMs
  ) {
    try {
      const summaryData = {
        stage: 'target_resolution_summary',
        actorId: actor.id,
        originalActionCount: originalCount,
        resolvedActionCount: resolvedCount,
        hasLegacyActions: hasLegacy,
        hasMultiTargetActions: hasMultiTarget,
        resolutionSuccessRate:
          originalCount > 0 ? resolvedCount / originalCount : 1.0,
        stageDurationMs,
        timestamp: Date.now(),
      };

      this.#logger.debug(
        'TargetResolutionTracingOrchestrator: Captured post-resolution summary',
        summaryData
      );
    } catch (error) {
      this.#logger.warn(
        'Failed to capture post-resolution summary for tracing',
        error
      );
    }
  }

  /**
   * @description Capture stage performance metrics as used by ACTTRA-018.
   * @param {TraceLike} trace - Trace instance used to capture telemetry
   * @param {ActionDefinition} actionDef - Definition of the action being resolved
   * @param {number} startTime - Stage start timestamp
   * @param {number} endTime - Stage end timestamp
   * @param {number} totalCandidates - Total candidates processed
   * @param {number} actionsWithTargets - Number of actions that resolved to targets
   * @returns {Promise<void>} Resolves when performance capture completes
   */
  async capturePerformanceData(
    trace,
    actionDef,
    startTime,
    endTime,
    totalCandidates,
    actionsWithTargets
  ) {
    if (!this.isActionAwareTrace(trace)) return;

    const payload = {
      stage: 'multi_target_resolution',
      duration: endTime - startTime,
      timestamp: Date.now(),
      itemsProcessed: totalCandidates,
      itemsResolved: actionsWithTargets,
      stageName: 'MultiTargetResolution',
    };

    await this.#safeCaptureActionData(
      trace,
      'stage_performance',
      actionDef.id,
      payload,
      {
        successMessage: `Captured performance data for action '${actionDef.id}'`,
        failureMessage: `Failed to capture performance data for action '${actionDef.id}'`,
        suppressLoggerOnSuccess: true,
      }
    );
  }

  /**
   * @description Analyze legacy action formats for tracing metadata.
   * @param {ActionDefinition} action - Action definition being analyzed
   * @returns {string} Description of the legacy format for tracing
   */
  analyzeLegacyFormat(action) {
    if (typeof action.targets === 'string') return 'string_targets';
    if (action.scope && !action.targets) return 'scope_property';
    if (action.targetType || action.targetCount) return 'legacy_target_type';
    return 'modern';
  }

  /**
   * @private
   * @param {TraceLike} trace - Trace instance
   * @param {string} eventName - Trace event name
   * @param {string} actionId - Action identifier
   * @param {object} payload - Payload to send to captureActionData
   * @param {object} messages - Log message options
   * @param {string} messages.successMessage - Message for successful capture
   * @param {string} messages.failureMessage - Message for failed capture
   * @param {boolean} [messages.suppressLoggerOnSuccess] - Whether to skip debug logging on success
   * @returns {Promise<void>}
   */
  async #safeCaptureActionData(
    trace,
    eventName,
    actionId,
    payload,
    { successMessage, failureMessage, suppressLoggerOnSuccess = false }
  ) {
    if (typeof trace?.captureActionData !== 'function') {
      this.#logger.warn(
        'Action-aware trace missing captureActionData implementation'
      );
      return;
    }

    try {
      await trace.captureActionData(eventName, actionId, payload);
      if (!suppressLoggerOnSuccess) {
        this.#logger.debug(
          `TargetResolutionTracingOrchestrator: ${successMessage}`,
          payload
        );
      }
    } catch (error) {
      this.#logger.warn(
        `TargetResolutionTracingOrchestrator: ${failureMessage}`,
        error
      );
    }
  }
}
