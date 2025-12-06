/**
 * @file ITargetResolutionTracingOrchestrator - Interface describing tracing capture operations
 * for the multi-target resolution pipeline stage.
 * @see MultiTargetResolutionStage.js
 */

/**
 * @interface ITargetResolutionTracingOrchestrator
 * @description Defines the tracing operations required by the multi-target resolution stage.
 */
export class ITargetResolutionTracingOrchestrator {
  /**
   * @description Determine whether the provided trace supports action-aware capture.
   * @param {import('../../../tracing/actionAwareStructuredTrace.js').default|object} _trace - Trace instance to inspect
   * @returns {boolean} True if the trace supports action-aware capture
   */
  isActionAwareTrace(_trace) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * @description Capture legacy action detection before conversion.
   * @param {object} _trace - Trace instance used to capture telemetry
   * @param {string} _actionId - Identifier of the action being evaluated
   * @param {object} _detectionData - Data describing the detection step
   * @returns {void}
   */
  captureLegacyDetection(_trace, _actionId, _detectionData) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * @description Capture legacy conversion result from LegacyTargetCompatibilityLayer.
   * @param {object} _trace - Trace instance used to capture telemetry
   * @param {string} _actionId - Identifier of the action being evaluated
   * @param {object} _conversionData - Data describing the conversion step
   * @returns {void}
   */
  captureLegacyConversion(_trace, _actionId, _conversionData) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * @description Capture scope evaluation output for a specific target key.
   * @param {object} _trace - Trace instance used to capture telemetry
   * @param {string} _actionId - Identifier of the action being evaluated
   * @param {string} _targetKey - Target key being resolved
   * @param {object} _evaluationData - Data describing the evaluation step
   * @returns {void}
   */
  captureScopeEvaluation(_trace, _actionId, _targetKey, _evaluationData) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * @description Capture multi-target resolution summary for an action.
   * @param {object} _trace - Trace instance used to capture telemetry
   * @param {string} _actionId - Identifier of the action being evaluated
   * @param {object} _resolutionData - Summary data about the resolution outcome
   * @returns {void}
   */
  captureMultiTargetResolution(_trace, _actionId, _resolutionData) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * @description Capture detailed resolution data for either legacy or multi-target flows.
   * @param {object} _trace - Trace instance used to capture telemetry
   * @param {import('../../../actionTypes.js').ActionDefinition} _actionDef - Definition of the action being resolved
   * @param {import('../../../../entities/entity.js').default} _actor - Actor whose action is being resolved
   * @param {object} _resolutionData - Summary of the resolution results
   * @param {object} [_detailedResults] - Optional detailed results payload
   * @returns {void}
   */
  captureResolutionData(
    _trace,
    _actionDef,
    _actor,
    _resolutionData,
    _detailedResults
  ) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * @description Capture target resolution error data.
   * @param {object} _trace - Trace instance used to capture telemetry
   * @param {import('../../../actionTypes.js').ActionDefinition} _actionDef - Definition of the action being resolved
   * @param {import('../../../../entities/entity.js').default} _actor - Actor whose action is being resolved
   * @param {Error} _error - Error encountered during resolution
   * @returns {void}
   */
  captureResolutionError(_trace, _actionDef, _actor, _error) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * @description Capture post-resolution summary metrics (counts, legacy usage, timing).
   * @param {object} _trace - Trace instance used to capture telemetry
   * @param {import('../../../../entities/entity.js').default} _actor - Actor whose action is being resolved
   * @param {number} _originalCount - Number of original candidates processed
   * @param {number} _resolvedCount - Number of candidates resolved
   * @param {boolean} _hasLegacy - Whether legacy resolution was used
   * @param {boolean} _hasMultiTarget - Whether multi-target resolution was used
   * @param {number} _stageDurationMs - Duration of the stage in milliseconds
   * @returns {void}
   */
  capturePostResolutionSummary(
    _trace,
    _actor,
    _originalCount,
    _resolvedCount,
    _hasLegacy,
    _hasMultiTarget,
    _stageDurationMs
  ) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * @description Capture stage performance metrics as used by ACTTRA-018.
   * @param {object} _trace - Trace instance used to capture telemetry
   * @param {import('../../../actionTypes.js').ActionDefinition} _actionDef - Definition of the action being resolved
   * @param {number} _startTime - Stage start timestamp
   * @param {number} _endTime - Stage end timestamp
   * @param {number} _totalCandidates - Total candidates processed
   * @param {number} _actionsWithTargets - Number of actions that resolved to targets
   * @returns {Promise<void>} Resolves when performance capture completes
   */
  async capturePerformanceData(
    _trace,
    _actionDef,
    _startTime,
    _endTime,
    _totalCandidates,
    _actionsWithTargets
  ) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * @description Analyze legacy action formats for tracing metadata.
   * @param {import('../../../actionTypes.js').ActionDefinition} _action - Action definition being analyzed
   * @returns {string} Description of the legacy format for tracing
   */
  analyzeLegacyFormat(_action) {
    throw new Error('Method must be implemented by concrete class');
  }
}
