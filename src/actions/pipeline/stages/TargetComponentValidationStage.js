/**
 * @file Pipeline stage for validating target entity components against forbidden constraints
 * @see ./ComponentFilteringStage.js
 */

import { PipelineStage } from '../PipelineStage.js';
import { PipelineResult } from '../PipelineResult.js';
import TargetValidationIOAdapter from '../adapters/TargetValidationIOAdapter.js';
import {
  ACTOR_ROLE,
  ALL_MULTI_TARGET_ROLES,
  LEGACY_TARGET_ROLE,
  getPlaceholderForRole,
  getRolesWithRequirements,
} from '../TargetRoleRegistry.js';
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
    const { actor, trace } = context;
    const adapter = new TargetValidationIOAdapter();
    const { format, items, metadata } = adapter.normalize(context);
    const candidateCount = items.length;

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

      const rebuilt = adapter.rebuild({
        format,
        items,
        metadata,
        validatedItems: items,
      });

      return PipelineResult.success({
        data: rebuilt.data,
        continueProcessing: rebuilt.continueProcessing,
      });
    }

    // Check if we have action-aware tracing
    const isActionAwareTrace = this.#isActionAwareTrace(trace);
    const config = targetValidationConfig() || {};
    const strictness = getValidationStrictness();

    trace?.step(
      `Validating target components for ${candidateCount} actions (strictness: ${strictness})`,
      source
    );

    try {
      const validatedItems = await this.#validateActions(items, metadata, isActionAwareTrace, trace);

      const filteredItems = this.#filterItemsMissingRequiredTargets({
        format,
        items: validatedItems,
      });

      const duration = performance.now() - startPerformanceTime;

      // Log performance metrics if slow (based on config threshold)
      const performanceThreshold = config.performanceThreshold || 5;
      if (duration > performanceThreshold) {
        this.#logger.debug(
          `Target component validation took ${duration.toFixed(2)}ms for ${candidateCount} actions`
        );
      }

      if (config.logDetails) {
        this.#logger.debug(
          `Validated ${candidateCount} actions, ${filteredItems.length} passed validation (strictness: ${strictness})`
        );
      }

      // Add trace event for completion
      trace?.success(
        `Target component validation completed: ${filteredItems.length} of ${candidateCount} actions passed`,
        source,
        {
          inputCount: candidateCount,
          outputCount: filteredItems.length,
          duration
        }
      );

      const rebuilt = adapter.rebuild({
        format,
        items,
        metadata,
        validatedItems: filteredItems,
      });

      const outputData = rebuilt.data;
      const outputCount =
        format === 'actionsWithTargets'
          ? outputData.actionsWithTargets?.length || 0
          : outputData.candidateActions?.length || 0;

      return PipelineResult.success({
        data: outputData,
        continueProcessing: rebuilt.continueProcessing && outputCount > 0
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
          candidateCount,
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
  async #validateActions(items, metadata, isActionAwareTrace, trace) {
    const validatedItems = [];
    const config = targetValidationConfig() || {};
    const strictness = getValidationStrictness();

    for (const item of items) {
      const { actionDef } = item;
      // Check if validation should be skipped for this specific action
      if (shouldSkipValidation(actionDef)) {
        if (config.logDetails) {
          this.#logger.debug(
            `Skipping validation for action '${actionDef.id}' based on configuration`
          );
        }
        validatedItems.push(item);
        continue;
      }

      const startTime = performance.now();

      let targetEntities = item.resolvedTargets;

      const { targetEntities: filteredTargetEntities, removalReasons } =
        this.#filterTargetsByRequiredComponents(item, metadata);
      targetEntities = filteredTargetEntities;
      item.resolvedTargets = targetEntities;

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

      // Validate required components on targets after filtering
      let requiredValidation = this.#targetRequiredComponentsValidator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      if (!requiredValidation.valid && removalReasons.length > 0) {
        requiredValidation = {
          ...requiredValidation,
          reason: removalReasons[0],
        };
      }

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
          items.length
        );
      }

      if (validation.valid) {
        validatedItems.push(item);
      } else {
        this.#logger.debug(
          `Action '${actionDef.id}' filtered out: ${validation.reason}`
        );
      }
    }

    return validatedItems;
  }

  /**
   * Filters resolved targets so that only candidates with required components remain.
   *
   * @private
   * @param {ActionDefinition} actionDef - The action definition being validated.
   * @param {object} context - Pipeline context containing resolved target metadata.
   * @param {object|null} targetEntities - The resolved target entities map.
   * @returns {object|null} Updated target entities map reflecting filtered candidates.
   */
  #filterTargetsByRequiredComponents(item, metadata) {
    const { actionDef } = item;
    let targetEntities = item.resolvedTargets;

    if (!targetEntities || !actionDef?.required_components) {
      return { targetEntities, removalReasons: [] };
    }

    const requirements = actionDef.required_components;
    const rolesToCheck = getRolesWithRequirements(requirements);

    if (rolesToCheck.length === 0) {
      return { targetEntities, removalReasons: [] };
    }

    const placeholderSource = item.placeholderSource || actionDef.targetDefinitions || actionDef.targets || {};
    const placeholderEntityMap = new Map();
    let targetsFiltered = false;
    const removalReasons = [];
    const roleRemovalReasons = new Map();

    for (const role of rolesToCheck) {
      const existing = targetEntities[role];
      if (!existing) {
        continue;
      }

      const candidates = Array.isArray(existing) ? existing : [existing];
      const requiredComponents = requirements[role] || [];
      const validCandidates = [];

      for (const candidate of candidates) {
        const { valid, reason } = this.#candidateHasRequiredComponents(
          candidate,
          requiredComponents,
          role
        );

        if (valid) {
          validCandidates.push(candidate);
        } else if (reason) {
          roleRemovalReasons.set(role, reason);
          this.#logger.debug(reason);
        }
      }

      if (validCandidates.length !== candidates.length) {
        targetsFiltered = true;
      }

      const hasValidCandidates = validCandidates.length > 0;

      const normalizedValue = Array.isArray(existing)
        ? validCandidates
        : hasValidCandidates
          ? validCandidates[0]
          : null;

      targetEntities[role] = normalizedValue;

      if (!hasValidCandidates) {
        const recordedReason =
          roleRemovalReasons.get(role) ||
          `No ${role} target available for validation`;
        removalReasons.push(recordedReason);
      }

      const placeholder = getPlaceholderForRole(role, placeholderSource);
      if (placeholder) {
        const allowedIds = new Set(
          validCandidates
            .map((candidate) => this.#extractCandidateId(candidate))
            .filter((id) => typeof id === 'string' && id.length > 0)
        );
        placeholderEntityMap.set(placeholder, allowedIds);
      }
    }

    if (targetsFiltered) {
      this.#synchronizeFilteredTargets(
        item,
        rolesToCheck,
        targetEntities,
        placeholderEntityMap,
        metadata
      );
    }

    return { targetEntities, removalReasons };
  }

  /**
   * Remove actions that no longer have resolved candidates for required targets.
   *
   * @private
   * @param {object} params - Filtering parameters
   * @param {'actionsWithTargets'|'candidateActions'|'empty'} params.inputFormat - Input format identifier
   * @param {Array<object>} params.validatedActionsWithTargets - Actions with per-action metadata
   * @param {Array<ActionDefinition>} params.validatedActionDefs - Validated action definitions
   * @param {object} params.context - Pipeline context
   * @returns {{actionsWithTargets: Array<object>, candidateActions: Array<ActionDefinition>}} Filtered results
   */
  #filterItemsMissingRequiredTargets({ format, items }) {
    if (format === 'empty') {
      return [];
    }

    const hasRequiredTargets = (actionDef, resolvedTargets, targetDefinitions) => {
      if (!targetDefinitions || typeof targetDefinitions !== 'object') {
        return true;
      }

      if (!resolvedTargets || typeof resolvedTargets !== 'object') {
        return true;
      }

      const entries = Object.entries(targetDefinitions);
      if (entries.length === 0) {
        return true;
      }

      for (const [targetKey, definition] of entries) {
        if (definition?.optional) {
          continue;
        }

        const targetValue = resolvedTargets[targetKey];
        const candidateCount = Array.isArray(targetValue)
          ? targetValue.length
          : targetValue
            ? 1
            : 0;

        if (candidateCount === 0) {
          this.#logger.debug(
            `Filtering action '${actionDef.id}' - missing resolved candidates for required target '${targetKey}'`
          );
          return false;
        }
      }

      return true;
    };

    const filtered = [];
    for (const item of items) {
      const targetDefs =
        item.targetDefinitions || item.actionDef?.targetDefinitions || item.actionDef?.targets;
      const resolved = item.resolvedTargets || item.actionDef?.resolvedTargets;

      if (hasRequiredTargets(item.actionDef, resolved, targetDefs)) {
        filtered.push(item);
      }
    }

    return filtered;
  }

  /**
   * Determines if a resolved target candidate satisfies required component constraints.
   *
   * @private
   * @param {object} candidate - Candidate target instance.
   * @param {string[]} requiredComponents - Required component identifiers.
   * @returns {boolean} True if candidate has all required components.
   */
  #candidateHasRequiredComponents(candidate, requiredComponents, role) {
    if (!Array.isArray(requiredComponents) || requiredComponents.length === 0) {
      return { valid: true };
    }

    if (!candidate) {
      return { valid: false, reason: `No ${role} target available for validation` };
    }

    const targetEntity = candidate.entity || candidate;
    if (!targetEntity) {
      return { valid: false, reason: `No ${role} target available for validation` };
    }

    for (const componentId of requiredComponents) {
      if (!componentId) {
        continue;
      }

      if (targetEntity.components && targetEntity.components[componentId]) {
        continue;
      }

      if (typeof targetEntity.hasComponent === 'function') {
        try {
          if (targetEntity.hasComponent(componentId)) {
            continue;
          }
        } catch (error) {
          this.#logger.debug(
            `Error checking hasComponent('${componentId}') on ${targetEntity.id || 'unknown'}: ${error.message}`
          );
        }
      }

      const entityId = targetEntity.id || 'unknown';
      this.#logger.debug(
        `Target entity ${entityId} missing required component: ${componentId}`
      );
      return {
        valid: false,
        reason: `Target (${role}) must have component: ${componentId}`,
      };
    }

    return { valid: true };
  }

  /**
   * Synchronizes filtered targets with the broader pipeline context and trace metadata.
   *
   * @private
   * @param {ActionDefinition} actionDef - The action definition being updated.
   * @param {object} context - Pipeline context containing resolved target data.
   * @param {string[]} roles - Target roles that were evaluated.
   * @param {object} targetEntities - Updated target entities map.
   * @param {Map<string, Set<string>>} placeholderEntityMap - Allowed entity IDs grouped by placeholder.
   * @returns {void}
   */
  #synchronizeFilteredTargets(
    item,
    roles,
    targetEntities,
    placeholderEntityMap,
    metadata
  ) {
    if (!item) {
      return;
    }

    if (
      placeholderEntityMap &&
      placeholderEntityMap.size > 0 &&
      Array.isArray(item.targetContexts)
    ) {
      item.targetContexts = item.targetContexts.filter((ctx) => {
        if (ctx.type !== 'entity' || !ctx.placeholder) {
          return true;
        }

        const allowedSet = placeholderEntityMap.get(ctx.placeholder);
        if (!allowedSet) {
          return true;
        }

        return allowedSet.has(ctx.entityId);
      });
    }

    if (item.actionDef?.resolvedTargets) {
      for (const role of roles) {
        if (!Object.prototype.hasOwnProperty.call(targetEntities, role)) {
          continue;
        }

        const normalizedValue = targetEntities[role];
        if (role === LEGACY_TARGET_ROLE) {
          const normalizedArray = Array.isArray(normalizedValue)
            ? normalizedValue
            : normalizedValue
              ? [normalizedValue]
              : [];
          item.actionDef.resolvedTargets[LEGACY_TARGET_ROLE] = normalizedArray;
        } else if (Array.isArray(item.actionDef.resolvedTargets[role])) {
          item.actionDef.resolvedTargets[role] = Array.isArray(normalizedValue)
            ? normalizedValue
            : normalizedValue
              ? [normalizedValue]
              : [];
        } else {
          item.actionDef.resolvedTargets[role] = normalizedValue;
        }
      }
    }

    if (item.originalRef?.resolvedTargets) {
      for (const role of roles) {
        if (!Object.prototype.hasOwnProperty.call(targetEntities, role)) {
          continue;
        }

        item.originalRef.resolvedTargets[role] = targetEntities[role];
      }
    }

    if (item.sourceFormat === 'candidateActions' && metadata?.sharedResolvedTargetsRef) {
      for (const role of roles) {
        if (!Object.prototype.hasOwnProperty.call(targetEntities, role)) {
          continue;
        }

        metadata.sharedResolvedTargetsRef[role] = targetEntities[role];
      }
    }
  }

  /**
   * Extracts the identifier for a resolved target candidate.
   *
   * @private
   * @param {object} candidate - Target candidate to inspect.
   * @returns {string|null} Candidate entity identifier when available.
   */
  #extractCandidateId(candidate) {
    if (!candidate) {
      return null;
    }

    if (typeof candidate.id === 'string' && candidate.id.length > 0) {
      return candidate.id;
    }

    if (candidate.entity && typeof candidate.entity.id === 'string') {
      return candidate.entity.id;
    }

    return null;
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
    if (targetEntities[LEGACY_TARGET_ROLE]) {
      let targetData = targetEntities[LEGACY_TARGET_ROLE];
      // Handle arrays
      if (Array.isArray(targetData)) {
        targetData = targetData.length > 0 ? targetData[0] : null;
      }
      ids[LEGACY_TARGET_ROLE] = targetData?.id || 'unknown';
    }

    // Handle multi-target format
    for (const role of [ACTOR_ROLE, ...ALL_MULTI_TARGET_ROLES]) {
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
