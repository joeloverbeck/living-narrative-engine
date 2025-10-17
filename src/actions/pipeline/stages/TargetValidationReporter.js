/**
 * @file Target validation reporter
 * @description Encapsulates trace and performance reporting for the target component validation stage.
 */

import {
  ACTOR_ROLE,
  ALL_MULTI_TARGET_ROLES,
  LEGACY_TARGET_ROLE,
} from '../TargetRoleRegistry.js';

/**
 * Handles trace logging for the target validation stage while gracefully falling back
 * when tracing is disabled or unsupported.
 *
 * @class TargetValidationReporter
 * @description Centralizes trace and performance reporting for target validation.
 */
export class TargetValidationReporter {
  #logger;

  /**
   * @description Create a reporter instance.
   * @param {object} [options] - Reporter configuration options.
   * @param {import('../../../logging/consoleLogger.js').default} [options.logger] - Logger used for diagnostics.
   * @returns {void}
   */
  constructor({ logger = console } = {}) {
    this.#logger = logger;
  }

  /**
   * @description Report that the stage was skipped.
   * @param {object} params - Reporting parameters.
   * @param {object} params.trace - Trace instance, if available.
   * @param {string} params.source - Stage source identifier.
   * @param {string} params.reason - Reason for skipping validation.
   * @returns {void}
   */
  reportStageSkipped({ trace, source, reason }) {
    if (trace && typeof trace.step === 'function') {
      trace.step(reason, source);
    }
  }

  /**
   * @description Report that the stage has started validation work.
   * @param {object} params - Reporting parameters.
   * @param {object} params.trace - Trace instance, if available.
   * @param {string} params.source - Stage source identifier.
   * @param {number} params.candidateCount - Number of candidate actions being validated.
   * @param {'strict'|'lenient'|'off'} params.strictness - Validation strictness level.
   * @returns {void}
   */
  reportStageStart({ trace, source, candidateCount, strictness }) {
    if (trace && typeof trace.step === 'function') {
      trace.step(
        `Validating target components for ${candidateCount} actions (strictness: ${strictness})`,
        source
      );
    }
  }

  /**
   * @description Report that the stage has completed validation.
   * @param {object} params - Reporting parameters.
   * @param {object} params.trace - Trace instance, if available.
   * @param {string} params.source - Stage source identifier.
   * @param {number} params.candidateCount - Number of input candidates.
   * @param {number} params.filteredCount - Number of candidates that passed validation.
   * @param {number} params.duration - Stage duration in milliseconds.
   * @returns {void}
   */
  reportStageCompletion({
    trace,
    source,
    candidateCount,
    filteredCount,
    duration,
  }) {
    if (trace && typeof trace.success === 'function') {
      trace.success(
        `Target component validation completed: ${filteredCount} of ${candidateCount} actions passed`,
        source,
        {
          inputCount: candidateCount,
          outputCount: filteredCount,
          duration,
        }
      );
    }
  }

  /**
   * @description Report per-action validation analysis.
   * @param {object} params - Reporting parameters.
   * @param {object} params.trace - Trace instance, if available.
   * @param {import('../../../interfaces/IGameDataRepository.js').ActionDefinition} params.actionDef - Action definition being validated.
   * @param {object|null} params.targetEntities - Resolved target entities.
   * @param {{valid: boolean, reason?: string}} params.validation - Validation result.
   * @param {number} params.validationTime - Time taken for validation in milliseconds.
   * @returns {Promise<void>}
   */
  async reportValidationAnalysis({
    trace,
    actionDef,
    targetEntities,
    validation,
    validationTime,
  }) {
    if (!this.#isActionAwareTrace(trace)) {
      return;
    }

    try {
      const forbiddenComponents = actionDef.forbidden_components || {};
      const requiredComponents = actionDef.required_components || {};

      const traceData = {
        stage: 'target_component_validation',
        validationPassed: validation.valid,
        validationReason: validation.reason,
        forbiddenComponents,
        requiredComponents,
        targetEntityIds: this.#getTargetEntityIds(targetEntities),
        validationTime,
        timestamp: Date.now(),
      };

      await trace.captureActionData(
        'target_component_validation',
        actionDef.id,
        traceData
      );
    } catch (error) {
      if (this.#logger && typeof this.#logger.warn === 'function') {
        this.#logger.warn(
          `Failed to capture validation analysis for action '${actionDef.id}': ${error.message}`
        );
      }
    }
  }

  /**
   * @description Report per-action performance data.
   * @param {object} params - Reporting parameters.
   * @param {object} params.trace - Trace instance, if available.
   * @param {import('../../../interfaces/IGameDataRepository.js').ActionDefinition} params.actionDef - Action definition being validated.
   * @param {number} params.startTime - Validation start time.
   * @param {number} params.endTime - Validation end time.
   * @param {number} params.totalCandidates - Total number of candidates processed in the batch.
   * @returns {Promise<void>}
   */
  async reportPerformanceData({
    trace,
    actionDef,
    startTime,
    endTime,
    totalCandidates,
  }) {
    if (!this.#isActionAwareTrace(trace)) {
      return;
    }

    try {
      await trace.captureActionData('stage_performance', actionDef.id, {
        stage: 'target_component_validation',
        duration: endTime - startTime,
        timestamp: Date.now(),
        itemsProcessed: totalCandidates,
        stageName: 'TargetComponentValidation',
      });
    } catch (error) {
      if (this.#logger && typeof this.#logger.debug === 'function') {
        this.#logger.debug(
          `Failed to capture performance data for action '${actionDef.id}': ${error.message}`
        );
      }
    }
  }

  /**
   * @description Determine if the trace supports action-aware capture.
   * @private
   * @param {any} trace - Trace instance.
   * @returns {boolean} True if the trace can capture action data.
   */
  #isActionAwareTrace(trace) {
    return Boolean(trace && typeof trace.captureActionData === 'function');
  }

  /**
   * @description Extract target entity identifiers for trace payloads.
   * @private
   * @param {object|null} targetEntities - Resolved target entities.
   * @returns {object} Map of roles to entity identifiers.
   */
  #getTargetEntityIds(targetEntities) {
    if (!targetEntities) {
      return {};
    }

    const ids = {};

    if (targetEntities[LEGACY_TARGET_ROLE]) {
      let targetData = targetEntities[LEGACY_TARGET_ROLE];
      if (Array.isArray(targetData)) {
        targetData = targetData.length > 0 ? targetData[0] : null;
      }
      ids[LEGACY_TARGET_ROLE] = targetData?.id || 'unknown';
    }

    for (const role of [ACTOR_ROLE, ...ALL_MULTI_TARGET_ROLES]) {
      if (!targetEntities[role]) {
        continue;
      }

      let targetData = targetEntities[role];
      if (Array.isArray(targetData)) {
        targetData = targetData.length > 0 ? targetData[0] : null;
      }

      ids[role] = targetData?.id || 'unknown';
    }

    return ids;
  }
}

export default TargetValidationReporter;
