/**
 * @file Pipeline stage for validating target entity components against forbidden constraints
 * @see ./ComponentFilteringStage.js
 */

import { PipelineStage } from '../PipelineStage.js';
import { PipelineResult } from '../PipelineResult.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';

/** @typedef {import('../../validation/TargetComponentValidator.js').TargetComponentValidator} ITargetComponentValidator */
/** @typedef {import('../../../logging/consoleLogger.js').default} ILogger */
/** @typedef {import('../../errors/actionErrorContextBuilder.js').ActionErrorContextBuilder} ActionErrorContextBuilder */
/** @typedef {import('../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../interfaces/IGameDataRepository.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../../tracing/actionAwareStructuredTrace.js').default} ActionAwareStructuredTrace */

/**
 * @class TargetComponentValidationStage
 * @augments PipelineStage
 * @description Filters actions based on target entity forbidden component constraints.
 * Supports both legacy single-target and multi-target action formats.
 * Enhanced with action-aware tracing for debugging.
 */
export class TargetComponentValidationStage extends PipelineStage {
  #targetComponentValidator;
  #logger;
  #actionErrorContextBuilder;

  /**
   * Creates a TargetComponentValidationStage instance
   *
   * @param {object} dependencies - Constructor dependencies
   * @param {ITargetComponentValidator} dependencies.targetComponentValidator - Validator service
   * @param {ILogger} dependencies.logger - Logger service
   * @param {ActionErrorContextBuilder} dependencies.actionErrorContextBuilder - Error context builder
   */
  constructor({ targetComponentValidator, logger, actionErrorContextBuilder }) {
    super('TargetComponentValidation');

    validateDependency(targetComponentValidator, 'ITargetComponentValidator', console, {
      requiredMethods: ['validateTargetComponents']
    });
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(actionErrorContextBuilder, 'IActionErrorContextBuilder', console, {
      requiredMethods: ['buildErrorContext']
    });

    this.#targetComponentValidator = targetComponentValidator;
    this.#logger = logger;
    this.#actionErrorContextBuilder = actionErrorContextBuilder;
  }

  /**
   * Internal execution of the target component validation stage
   *
   * @param {object} context - The pipeline context
   * @param {import('../../../entities/entity.js').default} context.actor - The actor entity
   * @param {ActionDefinition[]} context.candidateActions - Candidate action definitions
   * @param {EntityManager} [context.entityManager] - Entity manager for lookups
   * @param {ActionAwareStructuredTrace} [context.trace] - Optional trace context
   * @returns {Promise<PipelineResult>} The filtered candidate actions
   */
  async executeInternal(context) {
    const { candidateActions, actor, trace } = context;
    const source = `${this.name}Stage.execute`;
    const startPerformanceTime = performance.now();

    // Check if we have action-aware tracing
    const isActionAwareTrace = this.#isActionAwareTrace(trace);

    trace?.step(
      `Validating target components for ${candidateActions.length} actions`,
      source
    );

    try {
      const validatedActions = await this.#validateActions(candidateActions, context, isActionAwareTrace, trace);

      const duration = performance.now() - startPerformanceTime;

      // Log performance metrics if slow
      if (duration > 5) {
        this.#logger.debug(
          `Target component validation took ${duration.toFixed(2)}ms for ${candidateActions.length} actions`
        );
      }

      this.#logger.debug(
        `Validated ${candidateActions.length} actions, ${validatedActions.length} passed validation`
      );

      // Add trace event for completion
      trace?.success(
        `Target component validation completed: ${validatedActions.length} of ${candidateActions.length} actions passed`,
        source,
        {
          inputCount: candidateActions.length,
          outputCount: validatedActions.length,
          duration
        }
      );

      return PipelineResult.success({
        data: { candidateActions: validatedActions },
        continueProcessing: validatedActions.length > 0
      });
    } catch (error) {
      // Build error context
      const errorContext = this.#actionErrorContextBuilder.buildErrorContext({
        error,
        actionDef: { id: 'targetValidation', name: 'Target Component Validation' },
        actorId: actor.id,
        phase: 'discovery',
        trace,
        additionalContext: {
          stage: 'target_component_validation',
          candidateCount: candidateActions.length
        }
      });

      this.#logger.error(
        `Error during target component validation: ${error.message}`,
        error
      );

      return PipelineResult.failure([errorContext]);
    }
  }

  /**
   * Validate actions through target component constraints
   *
   * @private
   * @param {ActionDefinition[]} candidateActions - Actions to validate
   * @param {object} context - Pipeline context
   * @param {boolean} isActionAwareTrace - Whether trace is action-aware
   * @param {any} trace - Trace object
   * @returns {Promise<ActionDefinition[]>} Filtered actions
   */
  async #validateActions(candidateActions, context, isActionAwareTrace, trace) {
    const validatedActions = [];

    for (const actionDef of candidateActions) {
      const startTime = performance.now();

      // Get target entities from the action (may already be resolved)
      const targetEntities = this.#extractTargetEntities(actionDef, context);

      // Validate target components
      const validation = this.#targetComponentValidator.validateTargetComponents(
        actionDef,
        targetEntities
      );

      const validationTime = performance.now() - startTime;

      // Capture action data for tracing if available
      if (isActionAwareTrace && trace?.captureActionData) {
        await this.#captureValidationAnalysis(
          trace,
          actionDef,
          targetEntities,
          validation,
          validationTime
        );

        // Capture performance data
        await this.#capturePerformanceData(
          trace,
          actionDef,
          startTime,
          performance.now(),
          candidateActions.length
        );
      }

      if (validation.valid) {
        validatedActions.push(actionDef);
      } else {
        this.#logger.debug(
          `Action '${actionDef.id}' filtered out: ${validation.reason}`
        );
      }
    }

    return validatedActions;
  }

  /**
   * Extract target entities from action definition
   *
   * @private
   * @param {ActionDefinition} actionDef - Action definition
   * @param {object} context - Pipeline context
   * @returns {object} Target entities by role
   */
  #extractTargetEntities(actionDef, context) {
    // Check if action has already resolved targets
    if (actionDef.resolvedTargets) {
      return actionDef.resolvedTargets;
    }

    // Check for legacy single-target format
    if (actionDef.target_entity) {
      return { target: actionDef.target_entity };
    }

    // Check for multi-target format
    const targets = {};
    if (actionDef.target_entities) {
      if (actionDef.target_entities.primary) {
        targets.primary = actionDef.target_entities.primary;
      }
      if (actionDef.target_entities.secondary) {
        targets.secondary = actionDef.target_entities.secondary;
      }
      if (actionDef.target_entities.tertiary) {
        targets.tertiary = actionDef.target_entities.tertiary;
      }
    }

    return Object.keys(targets).length > 0 ? targets : null;
  }

  /**
   * Check if the trace is an ActionAwareStructuredTrace
   *
   * @private
   * @param {any} trace - The trace object to check
   * @returns {boolean} True if trace is action-aware
   */
  #isActionAwareTrace(trace) {
    return trace && typeof trace.captureActionData === 'function';
  }

  /**
   * Capture validation analysis data for action tracing
   *
   * @private
   * @param {ActionAwareStructuredTrace} trace - The action-aware trace
   * @param {ActionDefinition} actionDef - The action definition
   * @param {object} targetEntities - The target entities
   * @param {object} validation - Validation result
   * @param {number} validationTime - Time taken for validation
   * @returns {Promise<void>}
   */
  async #captureValidationAnalysis(trace, actionDef, targetEntities, validation, validationTime) {
    try {
      const forbiddenComponents = actionDef.forbidden_components || {};

      // Build trace data
      const traceData = {
        stage: 'target_component_validation',
        validationPassed: validation.valid,
        validationReason: validation.reason,
        forbiddenComponents,
        targetEntityIds: this.#getTargetEntityIds(targetEntities),
        validationTime,
        timestamp: Date.now()
      };

      await trace.captureActionData(
        'target_component_validation',
        actionDef.id,
        traceData
      );
    } catch (error) {
      this.#logger.warn(
        `Failed to capture validation analysis for action '${actionDef.id}': ${error.message}`
      );
    }
  }

  /**
   * Get target entity IDs for tracing
   *
   * @private
   * @param {object} targetEntities - Target entities
   * @returns {object} Target entity IDs
   */
  #getTargetEntityIds(targetEntities) {
    if (!targetEntities) return {};

    const ids = {};

    // Handle legacy format
    if (targetEntities.target) {
      ids.target = targetEntities.target.id || 'unknown';
    }

    // Handle multi-target format
    for (const role of ['primary', 'secondary', 'tertiary']) {
      if (targetEntities[role]) {
        ids[role] = targetEntities[role].id || 'unknown';
      }
    }

    return ids;
  }

  /**
   * Capture performance data for action tracing
   *
   * @private
   * @param {ActionAwareStructuredTrace} trace - The action-aware trace
   * @param {ActionDefinition} actionDef - The action definition
   * @param {number} startTime - Start performance time
   * @param {number} endTime - End performance time
   * @param {number} totalCandidates - Total number of candidates processed
   * @returns {Promise<void>}
   */
  async #capturePerformanceData(trace, actionDef, startTime, endTime, totalCandidates) {
    try {
      if (trace && trace.captureActionData) {
        await trace.captureActionData('stage_performance', actionDef.id, {
          stage: 'target_component_validation',
          duration: endTime - startTime,
          timestamp: Date.now(),
          itemsProcessed: totalCandidates,
          stageName: this.name
        });
      }
    } catch (error) {
      this.#logger.debug(
        `Failed to capture performance data for action '${actionDef.id}': ${error.message}`
      );
    }
  }
}

export default TargetComponentValidationStage;