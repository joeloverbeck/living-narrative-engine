/**
 * @file Pipeline stage for validating target entity components against forbidden constraints
 * @see ./ComponentFilteringStage.js
 */

import { PipelineStage } from '../PipelineStage.js';
import { PipelineResult } from '../PipelineResult.js';
import TargetValidationIOAdapter from '../adapters/TargetValidationIOAdapter.js';
import { getPlaceholderForRole } from '../TargetRoleRegistry.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import TargetValidationConfigProvider from './TargetValidationConfigProvider.js';
import TargetValidationReporter from './TargetValidationReporter.js';
import TargetCandidatePruner from '../services/implementations/TargetCandidatePruner.js';
import { extractCandidateId } from '../utils/targetCandidateUtils.js';
import ContextUpdateEmitter from '../services/implementations/ContextUpdateEmitter.js';

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
  #targetCandidatePruner;
  #configProvider;
  #validationReporter;
  #contextUpdateEmitter;

  /**
   * Creates a TargetComponentValidationStage instance
   *
   * @param {object} dependencies - Constructor dependencies
   * @param {ITargetComponentValidator} dependencies.targetComponentValidator - Validator service
   * @param {ITargetRequiredComponentsValidator} dependencies.targetRequiredComponentsValidator - Required components validator
   * @param {ILogger} dependencies.logger - Logger service
   * @param {ActionErrorContextBuilder} dependencies.actionErrorContextBuilder - Error context builder
   * @param {TargetCandidatePruner} [dependencies.targetCandidatePruner] - Optional candidate pruning service
   * @param {TargetValidationConfigProvider} [dependencies.configProvider] - Optional configuration snapshot provider.
   * @param {TargetValidationReporter} [dependencies.validationReporter] - Optional reporter for trace events.
   * @param {ContextUpdateEmitter} [dependencies.contextUpdateEmitter] - Optional context update emitter override.
   */
  constructor({
    targetComponentValidator,
    targetRequiredComponentsValidator,
    logger,
    actionErrorContextBuilder,
    targetCandidatePruner = null,
    configProvider = null,
    validationReporter = null,
    contextUpdateEmitter = null,
  }) {
    super('TargetComponentValidation');

    validateDependency(
      targetComponentValidator,
      'ITargetComponentValidator',
      console,
      {
        requiredMethods: ['validateTargetComponents'],
      }
    );
    validateDependency(
      targetRequiredComponentsValidator,
      'ITargetRequiredComponentsValidator',
      console,
      {
        requiredMethods: ['validateTargetRequirements'],
      }
    );
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(
      actionErrorContextBuilder,
      'IActionErrorContextBuilder',
      console,
      {
        requiredMethods: ['buildErrorContext'],
      }
    );

    this.#targetComponentValidator = targetComponentValidator;
    this.#targetRequiredComponentsValidator = targetRequiredComponentsValidator;
    this.#logger = logger;
    this.#actionErrorContextBuilder = actionErrorContextBuilder;
    if (targetCandidatePruner) {
      validateDependency(
        targetCandidatePruner,
        'ITargetCandidatePruner',
        console,
        {
          requiredMethods: ['prune'],
        }
      );
      this.#targetCandidatePruner = targetCandidatePruner;
    } else {
      this.#targetCandidatePruner = new TargetCandidatePruner({ logger });
    }

    if (configProvider) {
      validateDependency(
        configProvider,
        'ITargetValidationConfigProvider',
        console,
        {
          requiredMethods: ['getSnapshot'],
        }
      );
      this.#configProvider = configProvider;
    } else {
      this.#configProvider = new TargetValidationConfigProvider();
    }

    if (validationReporter) {
      validateDependency(
        validationReporter,
        'ITargetValidationReporter',
        console,
        {
          requiredMethods: [
            'reportStageSkipped',
            'reportStageStart',
            'reportStageCompletion',
            'reportValidationAnalysis',
            'reportPerformanceData',
          ],
        }
      );
      this.#validationReporter = validationReporter;
    } else {
      this.#validationReporter = new TargetValidationReporter({ logger });
    }

    if (contextUpdateEmitter) {
      validateDependency(
        contextUpdateEmitter,
        'IContextUpdateEmitter',
        console,
        {
          requiredMethods: ['applyTargetValidationResults'],
        }
      );
      this.#contextUpdateEmitter = contextUpdateEmitter;
    } else {
      this.#contextUpdateEmitter = new ContextUpdateEmitter();
    }
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
    const configSnapshot = this.#configProvider.getSnapshot();

    // Check if validation is enabled via configuration
    if (configSnapshot.skipValidation) {
      if (configSnapshot.logDetails) {
        this.#logger.debug(
          'Target component validation is disabled via configuration'
        );
      }

      this.#validationReporter.reportStageSkipped({
        trace,
        source,
        reason: 'Target component validation skipped (disabled in config)',
      });

      this.#contextUpdateEmitter.applyTargetValidationResults({
        context,
        format,
        items,
        metadata,
        validatedItems: items,
      });

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

    const strictness = configSnapshot.strictness;

    this.#validationReporter.reportStageStart({
      trace,
      source,
      candidateCount,
      strictness,
    });

    try {
      const validatedItems = await this.#validateActions(
        items,
        metadata,
        configSnapshot,
        trace
      );

      const filteredItems = this.#filterItemsMissingRequiredTargets({
        format,
        items: validatedItems,
      });

      const duration = performance.now() - startPerformanceTime;

      // Log performance metrics if slow (based on config threshold)
      const performanceThreshold = configSnapshot.performanceThreshold || 5;
      if (duration > performanceThreshold) {
        this.#logger.debug(
          `Target component validation took ${duration.toFixed(2)}ms for ${candidateCount} actions`
        );
      }

      if (configSnapshot.logDetails) {
        this.#logger.debug(
          `Validated ${candidateCount} actions, ${filteredItems.length} passed validation (strictness: ${strictness})`
        );
      }

      this.#validationReporter.reportStageCompletion({
        trace,
        source,
        candidateCount,
        filteredCount: filteredItems.length,
        duration,
      });

      this.#contextUpdateEmitter.applyTargetValidationResults({
        context,
        format,
        items,
        metadata,
        validatedItems: filteredItems,
      });

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
        continueProcessing: rebuilt.continueProcessing && outputCount > 0,
      });
    } catch (error) {
      // Build error context
      const errorContext = this.#actionErrorContextBuilder.buildErrorContext({
        error,
        actionDef: {
          id: 'targetValidation',
          name: 'Target Component Validation',
        },
        actorId: actor?.id,
        phase: 'discovery',
        trace,
        additionalContext: {
          stage: 'target_component_validation',
          candidateCount,
        },
      });

      this.#logger.error(
        `Error during target component validation: ${error.message}`,
        error
      );

      return PipelineResult.failure([errorContext]);
    }
  }

  /**
   * @description Validate actions through target component constraints.
   * @private
   * @param {Array<object>} items - Normalized pipeline items being validated.
   * @param {object} metadata - Stage metadata container.
   * @param {object} configSnapshot - Cached configuration snapshot.
   * @param {any} trace - Trace object
   * @returns {Promise<ActionDefinition[]>} Filtered actions
   */
  async #validateActions(items, metadata, configSnapshot, trace) {
    const validatedItems = [];
    const config = configSnapshot;
    const strictness = configSnapshot.strictness;

    for (const item of items) {
      const { actionDef } = item;
      // Check if validation should be skipped for this specific action
      if (config.shouldSkipAction(actionDef)) {
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
      let forbiddenValidation =
        this.#targetComponentValidator.validateTargetComponents(
          actionDef,
          targetEntities
        );

      // Apply lenient mode if configured
      if (strictness === 'lenient' && !forbiddenValidation.valid) {
        // In lenient mode, allow actions with certain types of failures
        if (
          forbiddenValidation.reason &&
          forbiddenValidation.reason.includes('non-critical')
        ) {
          forbiddenValidation = {
            valid: true,
            reason: 'Allowed in lenient mode',
          };
          if (config.logDetails) {
            this.#logger.debug(
              `Action '${actionDef.id}' allowed in lenient mode despite: ${forbiddenValidation.reason}`
            );
          }
        }
      }

      // Validate required components on targets after filtering
      let requiredValidation =
        this.#targetRequiredComponentsValidator.validateTargetRequirements(
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
      const validation =
        forbiddenValidation.valid && requiredValidation.valid
          ? { valid: true }
          : {
              valid: false,
              reason: !forbiddenValidation.valid
                ? forbiddenValidation.reason
                : requiredValidation.reason,
            };

      const endTime = performance.now();
      const validationTime = endTime - startTime;

      await this.#validationReporter.reportValidationAnalysis({
        trace,
        actionDef,
        targetEntities,
        validation,
        validationTime,
      });

      await this.#validationReporter.reportPerformanceData({
        trace,
        actionDef,
        startTime,
        endTime,
        totalCandidates: items.length,
      });

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
   * @param {object} item - Normalized pipeline item being processed.
   * @param {object} metadata - Stage metadata container.
   * @returns {{targetEntities: object|null, removalReasons: string[]}} Updated targets and removal reasons.
   */
  #filterTargetsByRequiredComponents(item, metadata) {
    const { actionDef } = item;
    const placeholderSource =
      item.placeholderSource ||
      actionDef?.targetDefinitions ||
      actionDef?.targets ||
      null;

    const pruningResult = this.#targetCandidatePruner.prune({
      actionDef,
      resolvedTargets: item.resolvedTargets,
      targetContexts: item.targetContexts,
      config: { placeholderSource },
    });

    const filteredContexts = this.#filterTargetContexts({
      targetContexts: item.targetContexts,
      keptTargets: pruningResult.keptTargets,
      placeholderSource,
    });

    item.targetContexts = filteredContexts;
    item.resolvedTargets = pruningResult.keptTargets;

    this.#recordPruningUpdate(metadata, actionDef, pruningResult);

    return {
      targetEntities: pruningResult.keptTargets,
      removalReasons: pruningResult.removalReasons,
    };
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
   * @param params.format
   * @param params.items
   * @returns {{actionsWithTargets: Array<object>, candidateActions: Array<ActionDefinition>}} Filtered results
   */
  #filterItemsMissingRequiredTargets({ format, items }) {
    if (format === 'empty') {
      return [];
    }

    const hasRequiredTargets = (
      actionDef,
      resolvedTargets,
      targetDefinitions
    ) => {
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
        // Skip optional targets (e.g., 'none' scope actions from legacy layer)
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
        item.targetDefinitions ||
        item.actionDef?.targetDefinitions ||
        item.actionDef?.targets;
      const resolved = item.resolvedTargets || item.actionDef?.resolvedTargets;

      if (hasRequiredTargets(item.actionDef, resolved, targetDefs)) {
        filtered.push(item);
      }
    }

    return filtered;
  }

  /**
   * Filter target contexts to ensure they align with pruned targets.
   *
   * @private
   * @param {object} params - Filtering parameters.
   * @param {Array<object>|undefined} params.targetContexts - Target context entries.
   * @param {object|null} params.keptTargets - Pruned target map.
   * @param {object|null} params.placeholderSource - Placeholder metadata.
   * @returns {Array<object>} Filtered context collection.
   */
  #filterTargetContexts({ targetContexts, keptTargets, placeholderSource }) {
    if (!Array.isArray(targetContexts) || targetContexts.length === 0) {
      return Array.isArray(targetContexts) ? [...targetContexts] : [];
    }

    if (!keptTargets || typeof keptTargets !== 'object') {
      return [...targetContexts];
    }

    const allowedEntityIdsByPlaceholder = new Map();
    for (const [role, value] of Object.entries(keptTargets)) {
      const placeholder = getPlaceholderForRole(role, placeholderSource);
      if (!placeholder) {
        continue;
      }

      const candidates = Array.isArray(value) ? value : value ? [value] : [];
      if (candidates.length === 0) {
        allowedEntityIdsByPlaceholder.set(placeholder, new Set());
        continue;
      }

      const allowedIds =
        allowedEntityIdsByPlaceholder.get(placeholder) ?? new Set();
      for (const candidate of candidates) {
        const candidateId = extractCandidateId(candidate);
        if (candidateId) {
          allowedIds.add(candidateId);
        }
      }
      allowedEntityIdsByPlaceholder.set(placeholder, allowedIds);
    }

    if (allowedEntityIdsByPlaceholder.size === 0) {
      return [...targetContexts];
    }

    return targetContexts.filter((ctx) => {
      if (!ctx || ctx.type !== 'entity' || !ctx.placeholder) {
        return true;
      }

      const allowedSet = allowedEntityIdsByPlaceholder.get(ctx.placeholder);
      if (!allowedSet) {
        return true;
      }

      return allowedSet.has(ctx.entityId);
    });
  }

  /**
   * Record pruning metadata for downstream consumers.
   *
   * @private
   * @param {object} metadata - Stage metadata container.
   * @param {ActionDefinition} actionDef - Current action definition.
   * @param {{keptTargets: object|null, removedTargets: Array<object>, removalReasons: string[]}} pruningResult - Pruner output summary.
   */
  #recordPruningUpdate(metadata, actionDef, pruningResult) {
    if (!metadata) {
      return;
    }

    if (!metadata.stageUpdates) {
      metadata.stageUpdates = [];
    }

    metadata.stageUpdates.push({
      stage: this.name,
      type: 'targetCandidatePruner',
      actionId: actionDef?.id ?? null,
      removedTargets: pruningResult.removedTargets.map((entry) => ({
        ...entry,
      })),
      removalReasons: [...pruningResult.removalReasons],
    });
  }
}

export default TargetComponentValidationStage;
