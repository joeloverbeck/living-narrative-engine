/**
 * @file Pipeline stage for validating target entity components against forbidden constraints
 * @see ./ComponentFilteringStage.js
 */

import { PipelineStage } from '../PipelineStage.js';
import { PipelineResult } from '../PipelineResult.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import {
  isTargetValidationEnabled,
  shouldSkipValidation,
  targetValidationConfig,
  getValidationStrictness
} from '../../../config/actionPipelineConfig.js';

/** @typedef {import('../../validation/TargetComponentValidator.js').TargetComponentValidator} ITargetComponentValidator */
/** @typedef {import('../../validation/TargetRequiredComponentsValidator.js').default} ITargetRequiredComponentsValidator */
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
  #targetRequiredComponentsValidator;
  #logger;
  #actionErrorContextBuilder;

  /**
   * Creates a TargetComponentValidationStage instance
   *
   * @param {object} dependencies - Constructor dependencies
   * @param {ITargetComponentValidator} dependencies.targetComponentValidator - Validator service
   * @param {ITargetRequiredComponentsValidator} dependencies.targetRequiredComponentsValidator - Required components validator
   * @param {ILogger} dependencies.logger - Logger service
   * @param {ActionErrorContextBuilder} dependencies.actionErrorContextBuilder - Error context builder
   */
  constructor({ targetComponentValidator, targetRequiredComponentsValidator, logger, actionErrorContextBuilder }) {
    super('TargetComponentValidation');

    validateDependency(targetComponentValidator, 'ITargetComponentValidator', console, {
      requiredMethods: ['validateTargetComponents']
    });
    validateDependency(targetRequiredComponentsValidator, 'ITargetRequiredComponentsValidator', console, {
      requiredMethods: ['validateTargetRequirements']
    });
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(actionErrorContextBuilder, 'IActionErrorContextBuilder', console, {
      requiredMethods: ['buildErrorContext']
    });

    this.#targetComponentValidator = targetComponentValidator;
    this.#targetRequiredComponentsValidator = targetRequiredComponentsValidator;
    this.#logger = logger;
    this.#actionErrorContextBuilder = actionErrorContextBuilder;
  }

  /**
   * Internal execution of the target component validation stage
   *
   * @param {object} context - The pipeline context
   * @param {import('../../../entities/entity.js').default} context.actor - The actor entity
   * @param {Array<{actionDef: ActionDefinition, targetContexts: object[]}>} context.actionsWithTargets - Actions with resolved targets
   * @param {EntityManager} [context.entityManager] - Entity manager for lookups
   * @param {ActionAwareStructuredTrace} [context.trace] - Optional trace context
   * @returns {Promise<PipelineResult>} The filtered actions with targets
   */
  async executeInternal(context) {
    const { actionsWithTargets, candidateActions: rawCandidateActions, actor, trace } = context;

    // Support both input formats:
    // 1. actionsWithTargets (from MultiTargetResolutionStage) - NEW format
    // 2. candidateActions (legacy/test format) - OLD format
    let candidateActions;
    let inputFormat;

    if (actionsWithTargets && actionsWithTargets.length > 0) {
      candidateActions = actionsWithTargets.map(awt => awt.actionDef);
      inputFormat = 'actionsWithTargets';
    } else if (rawCandidateActions && rawCandidateActions.length > 0) {
      candidateActions = rawCandidateActions;
      inputFormat = 'candidateActions';
    } else {
      candidateActions = [];
      inputFormat = 'empty';
    }

    const source = `${this.name}Stage.execute`;
    const startPerformanceTime = performance.now();

    // Check if validation is enabled via configuration
    if (!isTargetValidationEnabled()) {
      const config = targetValidationConfig() || {};
      if (config.logDetails) {
        this.#logger.debug('Target component validation is disabled via configuration');
      }

      trace?.step(
        `Target component validation skipped (disabled in config)`,
        source
      );

      // Return data in the same format as input
      const outputData = inputFormat === 'actionsWithTargets'
        ? { actionsWithTargets }
        : { candidateActions };

      return PipelineResult.success({
        data: outputData,
        continueProcessing: candidateActions.length > 0
      });
    }

    // Check if we have action-aware tracing
    const isActionAwareTrace = this.#isActionAwareTrace(trace);
    const config = targetValidationConfig() || {};
    const strictness = getValidationStrictness();

    trace?.step(
      `Validating target components for ${candidateActions.length} actions (strictness: ${strictness})`,
      source
    );

    try {
      const validatedActionDefs = await this.#validateActions(candidateActions, context, isActionAwareTrace, trace);

      // Filter actionsWithTargets to only include actions that passed validation (only if using actionsWithTargets format)
      const validatedActionDefIds = new Set(validatedActionDefs.map(a => a.id));
      const validatedActionsWithTargets = inputFormat === 'actionsWithTargets' && actionsWithTargets
        ? actionsWithTargets.filter(awt => validatedActionDefIds.has(awt.actionDef.id))
        : [];

      const duration = performance.now() - startPerformanceTime;

      // Log performance metrics if slow (based on config threshold)
      const performanceThreshold = config.performanceThreshold || 5;
      if (duration > performanceThreshold) {
        this.#logger.debug(
          `Target component validation took ${duration.toFixed(2)}ms for ${candidateActions.length} actions`
        );
      }

      if (config.logDetails) {
        this.#logger.debug(
          `Validated ${candidateActions.length} actions, ${validatedActionDefs.length} passed validation (strictness: ${strictness})`
        );
      }

      // Add trace event for completion
      trace?.success(
        `Target component validation completed: ${validatedActionDefs.length} of ${candidateActions.length} actions passed`,
        source,
        {
          inputCount: candidateActions.length,
          outputCount: validatedActionDefs.length,
          duration
        }
      );

      // Return data in the same format as input
      const outputData = inputFormat === 'actionsWithTargets'
        ? { actionsWithTargets: validatedActionsWithTargets }
        : { candidateActions: validatedActionDefs };

      const outputCount = inputFormat === 'actionsWithTargets'
        ? validatedActionsWithTargets.length
        : validatedActionDefs.length;

      return PipelineResult.success({
        data: outputData,
        continueProcessing: outputCount > 0
      });
    } catch (error) {
      // Build error context
      const errorContext = this.#actionErrorContextBuilder.buildErrorContext({
        error,
        actionDef: { id: 'targetValidation', name: 'Target Component Validation' },
        actorId: actor?.id,
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
    const config = targetValidationConfig() || {};
    const strictness = getValidationStrictness();

    for (const actionDef of candidateActions) {
      // Check if validation should be skipped for this specific action
      if (shouldSkipValidation(actionDef)) {
        if (config.logDetails) {
          this.#logger.debug(
            `Skipping validation for action '${actionDef.id}' based on configuration`
          );
        }
        validatedActions.push(actionDef);
        continue;
      }

      const startTime = performance.now();

      // Get target entities from the action (may already be resolved)
      const targetEntities = this.#extractTargetEntities(actionDef, context);

      // Validate forbidden target components (apply strictness level)
      let forbiddenValidation = this.#targetComponentValidator.validateTargetComponents(
        actionDef,
        targetEntities
      );

      // Apply lenient mode if configured
      if (strictness === 'lenient' && !forbiddenValidation.valid) {
        // In lenient mode, allow actions with certain types of failures
        if (forbiddenValidation.reason && forbiddenValidation.reason.includes('non-critical')) {
          forbiddenValidation = { valid: true, reason: 'Allowed in lenient mode' };
          if (config.logDetails) {
            this.#logger.debug(
              `Action '${actionDef.id}' allowed in lenient mode despite: ${forbiddenValidation.reason}`
            );
          }
        }
      }

      // Validate required components on targets
      const requiredValidation = this.#targetRequiredComponentsValidator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      // Combine validation results
      const validation = forbiddenValidation.valid && requiredValidation.valid
        ? { valid: true }
        : {
            valid: false,
            reason: !forbiddenValidation.valid
              ? forbiddenValidation.reason
              : requiredValidation.reason
          };

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
   * @returns {object} Target entities by role including the actor when available
   */
  #extractTargetEntities(actionDef, context) {
    const { actor } = context || {};

    // Check if action has already resolved targets
    if (actionDef.resolvedTargets) {
      const targets = { ...actionDef.resolvedTargets };
      if (actor) {
        targets.actor = actor;
      }
      return targets;
    }

    // Check for legacy single-target format
    if (actionDef.target_entity) {
      const targets = { target: actionDef.target_entity };
      if (actor) {
        targets.actor = actor;
      }
      return targets;
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

    if (actor) {
      targets.actor = actor;
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
      const requiredComponents = actionDef.required_components || {};

      // Build trace data
      const traceData = {
        stage: 'target_component_validation',
        validationPassed: validation.valid,
        validationReason: validation.reason,
        forbiddenComponents,
        requiredComponents,
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
      let targetData = targetEntities.target;
      // Handle arrays
      if (Array.isArray(targetData)) {
        targetData = targetData.length > 0 ? targetData[0] : null;
      }
      ids.target = targetData?.id || 'unknown';
    }

    // Handle multi-target format
    for (const role of ['actor', 'primary', 'secondary', 'tertiary']) {
      if (targetEntities[role]) {
        let targetData = targetEntities[role];
        // Handle arrays - extract first element
        if (Array.isArray(targetData)) {
          targetData = targetData.length > 0 ? targetData[0] : null;
        }
        ids[role] = targetData?.id || 'unknown';
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