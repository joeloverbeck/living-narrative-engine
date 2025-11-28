/**
 * @file MultiTargetResolutionStage - Lightweight orchestrator for target resolution
 * Refactored from 748-line class to use specialized services
 */

// Type imports
/** @typedef {import('../../actionTypes.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../../../entities/entity.js').default} Entity */
/** @typedef {import('../../../interfaces/coreServices.js').IEntityManager} IEntityManager */
/** @typedef {import('../../../interfaces/ITargetResolutionService.js').ITargetResolutionService} ITargetResolutionService */
/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../tracing/traceContext.js').TraceContext} TraceContext */
/** @typedef {import('../../../scopeDsl/utils/targetContextBuilder.js').default} TargetContextBuilder */
/** @typedef {import('../../scopes/unifiedScopeResolver.js').UnifiedScopeResolver} UnifiedScopeResolver */
/** @typedef {import('../services/interfaces/ITargetDependencyResolver.js').ITargetDependencyResolver} ITargetDependencyResolver */
/** @typedef {import('../services/interfaces/ILegacyTargetCompatibilityLayer.js').ILegacyTargetCompatibilityLayer} ILegacyTargetCompatibilityLayer */
/** @typedef {import('../services/interfaces/IScopeContextBuilder.js').IScopeContextBuilder} IScopeContextBuilder */
/** @typedef {import('../services/interfaces/ITargetDisplayNameResolver.js').ITargetDisplayNameResolver} ITargetDisplayNameResolver */
/** @typedef {import('../services/interfaces/ITargetResolutionTracingOrchestrator.js').ITargetResolutionTracingOrchestrator} ITargetResolutionTracingOrchestrator */
/** @typedef {import('../services/interfaces/ITargetResolutionResultBuilder.js').default} ITargetResolutionResultBuilder */
/** @typedef {import('../services/interfaces/ITargetResolutionCoordinator.js').default} ITargetResolutionCoordinator */

import { PipelineStage } from '../PipelineStage.js';
import { PipelineResult } from '../PipelineResult.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {object} TargetDefinition
 * @property {string} scope - Scope ID or expression
 * @property {string} placeholder - Template placeholder name
 * @property {string} [description] - Human-readable description
 * @property {string} [contextFrom] - Use another target as context
 * @property {boolean} [optional] - Whether target is optional
 */

/**
 * @typedef {object} ResolvedTarget
 * @property {string} id - Entity ID
 * @property {string} displayName - Display name for formatting
 * @property {object} entity - Full entity object
 */

/**
 * @class MultiTargetResolutionStage
 * @augments PipelineStage
 * Pipeline stage responsible for resolving targets for candidate actions.
 *
 * This stage acts as a pure orchestrator, delegating all concerns to specialized services:
 * - **TargetResolutionTracingOrchestrator**: Handles all tracing instrumentation
 * - **TargetResolutionResultBuilder**: Handles result assembly and backward compatibility
 * - **TargetResolutionCoordinator**: Handles target resolution coordination and dependencies
 *
 * ## Architecture
 *
 * The stage follows a service-oriented design with clear separation of concerns:
 * 1. **Legacy Detection** - Identifies legacy single-target vs. multi-target actions
 * 2. **Target Resolution** - Coordinates dependency-aware resolution via coordinator
 * 3. **Tracing** - Captures telemetry via tracing orchestrator
 * 4. **Result Building** - Assembles consistent results via result builder
 *
 * ## Refactoring History
 *
 * - **Before**: ~1,085 lines with mixed concerns
 * - **After**: 556 lines focused on orchestration (~49% reduction)
 * - **Extracted**: 3 specialized services (~530 lines total)
 * @example
 * // Stage is injected with all required services via DI
 * const stage = new MultiTargetResolutionStage({
 *   legacyTargetCompatibilityLayer,
 *   targetDisplayNameResolver,
 *   unifiedScopeResolver,
 *   entityManager,
 *   targetResolver,
 *   logger,
 *   tracingOrchestrator,
 *   targetResolutionResultBuilder,
 *   targetResolutionCoordinator
 * });
 *
 * // Execute returns pipeline result with resolved targets
 * const result = await stage.execute(context);
 * // result.data.candidateActions - actions with resolvedTargets
 * // result.data.targetContexts - backward compatibility
 * @see TargetResolutionTracingOrchestrator for tracing implementation
 * @see TargetResolutionResultBuilder for result assembly
 * @see TargetResolutionCoordinator for resolution coordination
 */
export class MultiTargetResolutionStage extends PipelineStage {
  #legacyLayer;
  #nameResolver;
  #unifiedScopeResolver;
  #entityManager;
  #targetResolver;
  #logger;
  #tracingOrchestrator;
  #resultBuilder;
  #resolutionCoordinator;

  /**
   * @param {object} deps - Service dependencies
   * @param {ILegacyTargetCompatibilityLayer} deps.legacyTargetCompatibilityLayer - Legacy action compatibility
   * @param {ITargetDisplayNameResolver} deps.targetDisplayNameResolver - Entity display name resolution
   * @param {UnifiedScopeResolver} deps.unifiedScopeResolver - Scope resolution (legacy path)
   * @param {IEntityManager} deps.entityManager - Entity instance management
   * @param {ITargetResolutionService} deps.targetResolver - Target resolution (legacy path)
   * @param {ILogger} deps.logger - Logging service
   * @param {ITargetResolutionTracingOrchestrator} deps.tracingOrchestrator - Tracing orchestration
   * @param {ITargetResolutionResultBuilder} deps.targetResolutionResultBuilder - Result builder
   * @param {ITargetResolutionCoordinator} deps.targetResolutionCoordinator - Multi-target coordination
   */
  constructor({
    legacyTargetCompatibilityLayer,
    targetDisplayNameResolver,
    unifiedScopeResolver,
    entityManager,
    targetResolver,
    logger,
    tracingOrchestrator,
    targetResolutionResultBuilder,
    targetResolutionCoordinator,
  }) {
    super('MultiTargetResolution');

    // Validate all service dependencies
    validateDependency(
      legacyTargetCompatibilityLayer,
      'ILegacyTargetCompatibilityLayer'
    );
    validateDependency(targetDisplayNameResolver, 'ITargetDisplayNameResolver');
    validateDependency(unifiedScopeResolver, 'IUnifiedScopeResolver');
    validateDependency(entityManager, 'IEntityManager');
    validateDependency(targetResolver, 'ITargetResolutionService');
    validateDependency(logger, 'ILogger');
    validateDependency(
      tracingOrchestrator,
      'ITargetResolutionTracingOrchestrator',
      logger,
      {
        requiredMethods: [
          'isActionAwareTrace',
          'captureLegacyDetection',
          'captureLegacyConversion',
          'captureScopeEvaluation',
          'captureMultiTargetResolution',
          'captureResolutionData',
          'captureResolutionError',
          'capturePostResolutionSummary',
          'capturePerformanceData',
          'analyzeLegacyFormat',
        ],
      }
    );

    // Store service references
    this.#legacyLayer = legacyTargetCompatibilityLayer;
    this.#nameResolver = targetDisplayNameResolver;
    this.#unifiedScopeResolver = unifiedScopeResolver;
    this.#entityManager = entityManager;
    this.#targetResolver = targetResolver;
    this.#logger = logger;
    this.#tracingOrchestrator = tracingOrchestrator;
    validateDependency(
      targetResolutionResultBuilder,
      'ITargetResolutionResultBuilder',
      logger,
      {
        requiredMethods: [
          'buildFinalResult',
          'buildLegacyResult',
          'buildMultiTargetResult',
          'attachMetadata',
        ],
      }
    );
    validateDependency(
      targetResolutionCoordinator,
      'ITargetResolutionCoordinator',
      logger,
      {
        requiredMethods: ['coordinateResolution'],
      }
    );
    this.#resultBuilder = targetResolutionResultBuilder;
    this.#resolutionCoordinator = targetResolutionCoordinator;
  }

  /**
   * Execute target resolution
   *
   * @param {object} context - Pipeline context
   * @param {ActionDefinition} context.actionDef - Action definition
   * @param {Entity} context.actor - Acting entity
   * @param {object} context.actionContext - Action discovery context
   * @param {TraceContext} [context.trace] - Trace context
   * @returns {Promise<PipelineResult>}
   */
  async executeInternal(context) {
    const { candidateActions = [], actor, actionContext, trace } = context;
    const stageStartTime = Date.now();
    const startPerformanceTime = performance.now(); // ACTTRA-018: Performance timing

    this.#logger.debug('\n=== MULTITARGETRESOLUTIONSTAGE ENTRY ===');
    this.#logger.debug('Candidate actions count:', candidateActions.length);
    this.#logger.debug('Candidate action IDs:', candidateActions.map(a => a.id));
    this.#logger.debug('Actor ID:', actor.id);
    this.#logger.debug('=== END ENTRY ===\n');

    trace?.step(
      `Resolving targets for ${candidateActions.length} candidate actions`,
      'MultiTargetResolutionStage'
    );

    // Check if we have action-aware tracing capability
    const isActionAwareTrace =
      this.#tracingOrchestrator.isActionAwareTrace(trace);

    if (isActionAwareTrace) {
      this.#logger.debug(
        `MultiTargetResolutionStage: Action tracing enabled for actor ${actor.id}`,
        { actorId: actor.id, candidateActionCount: candidateActions.length }
      );
    }

    const allActionsWithTargets = [];
    const errors = [];
    let lastResolvedTargets = null;
    let lastTargetDefinitions = null;
    let allTargetContexts = [];
    let hasLegacyActions = false;
    let hasMultiTargetActions = false;
    let tracedActionCount = 0;

    // Process each candidate action
    for (const actionDef of candidateActions) {
      this.#logger.debug(`\n--- Processing action: ${actionDef.id} ---`);
      this.#logger.debug('Action has targets?', !!actionDef.targets);
      this.#logger.debug('Targets:', JSON.stringify(actionDef.targets, null, 2));

      try {
        trace?.step(
          `Resolving targets for action '${actionDef.id}'`,
          'MultiTargetResolutionStage'
        );

        // Create a context for this specific action
        const actionProcessContext = {
          ...context,
          actionDef,
        };

        // Check if this is a legacy single-target action
        const isLegacy = this.#legacyLayer.isLegacyAction(actionDef);
        const resolutionStartTime = Date.now();

        // TEMPORARY DIAGNOSTIC: Log which resolution path is taken
        this.#logger.debug(`[DIAGNOSTIC] Action ${actionDef.id} resolution path:`, {
          isLegacy,
          hasStringTargets: typeof actionDef.targets === 'string',
          targets: actionDef.targets,
          scope: actionDef.scope,
        });

        // Capture legacy detection if action-aware tracing is enabled
        if (isActionAwareTrace) {
          this.#tracingOrchestrator.captureLegacyDetection(
            trace,
            actionDef.id,
            {
              isLegacy,
              hasStringTargets: typeof actionDef.targets === 'string',
              hasScopeOnly: !!(actionDef.scope && !actionDef.targets),
              hasLegacyFields: !!(actionDef.targetType || actionDef.targetCount),
              detectedFormat: this.#tracingOrchestrator.analyzeLegacyFormat(
                actionDef
              ),
              requiresConversion: isLegacy,
            }
          );
        }

        if (isLegacy) {
          hasLegacyActions = true;
          const conversionStartTime = performance.now();

          // Get conversion data from legacy layer
          const conversionResult = this.#legacyLayer.convertLegacyFormat(
            actionDef,
            actor
          );

          const result = await this.#resolveLegacyTarget(
            actionProcessContext,
            trace
          );

          const processingTime = performance.now() - conversionStartTime;

          // Capture legacy conversion if action-aware tracing is enabled
          if (isActionAwareTrace) {
            this.#tracingOrchestrator.captureLegacyConversion(
              trace,
              actionDef.id,
              {
                isLegacy: true,
                originalAction: actionDef,
                targetDefinitions: conversionResult.targetDefinitions,
                processingTime,
                error: conversionResult.error,
                migrationSuggestion:
                  this.#legacyLayer.getMigrationSuggestion(actionDef),
                success: result.success,
              }
            );
          }

          // Capture tracing data for legacy action if enabled
          if (isActionAwareTrace) {
            this.#tracingOrchestrator.captureResolutionData(
              trace,
              actionDef,
              actor,
              {
                isLegacy: true,
                resolutionSuccess: result.success,
                resolutionTimeMs: Date.now() - resolutionStartTime,
                targetCount:
                  result.data?.resolvedTargets?.primary?.length || 0,
                scope:
                  result.data?.targetDefinitions?.primary?.scope ||
                  actionDef.scope ||
                  actionDef.targets,
              }
            );
            tracedActionCount++;
          }

          if (result.success && result.data.actionsWithTargets) {
            allActionsWithTargets.push(...result.data.actionsWithTargets);
            // For backward compatibility, merge target contexts
            if (result.data.targetContexts) {
              allTargetContexts.push(...result.data.targetContexts);
            }
          }
        } else {
          // Resolve multi-target action using coordinator
          hasMultiTargetActions = true;
          const result = await this.#resolutionCoordinator.coordinateResolution(
            actionProcessContext,
            trace
          );

          // Capture tracing data for multi-target action if enabled
          if (isActionAwareTrace) {
            const targetKeys = actionDef.targets
              ? Object.keys(actionDef.targets)
              : [];
            const resolvedTargetCounts = {};

            if (result.data?.resolvedTargets) {
              for (const [key, targets] of Object.entries(
                result.data.resolvedTargets
              )) {
                resolvedTargetCounts[key] = targets.length;
              }
            }

            this.#tracingOrchestrator.captureResolutionData(
              trace,
              actionDef,
              actor,
              {
                isLegacy: false,
                resolutionSuccess: result.success,
                resolutionTimeMs: Date.now() - resolutionStartTime,
                targetKeys,
                resolvedTargetCounts,
                resolvedTargets: result.data?.resolvedTargets || {},
                targetCount: Object.values(resolvedTargetCounts).reduce(
                  (sum, count) => sum + count,
                  0
                ),
              },
              result.data?.detailedResolutionResults
            );
            tracedActionCount++;
          }

          if (result.success && result.data.actionsWithTargets) {
            // Attach metadata to each action instead of globally
            result.data.actionsWithTargets.forEach((awt) => {
              if (
                result.data.resolvedTargets &&
                result.data.targetDefinitions
              ) {
                awt.resolvedTargets = result.data.resolvedTargets;
                awt.targetDefinitions = result.data.targetDefinitions;
                awt.isMultiTarget = true;
              }
            });
            allActionsWithTargets.push(...result.data.actionsWithTargets);
            // Store the last resolved targets and contexts for top-level access
            if (result.data.resolvedTargets) {
              lastResolvedTargets = result.data.resolvedTargets;
            }
            if (result.data.targetDefinitions) {
              lastTargetDefinitions = result.data.targetDefinitions;
            }
            if (result.data.targetContexts) {
              allTargetContexts.push(...result.data.targetContexts);
            }
          }
        }
      } catch (error) {
        const errorMessage = error?.scopeName
          ? `Scope resolution failed for '${error.scopeName}': ${error?.message || 'Unknown error'}`
          : error?.message ||
            String(error) ||
            'Unknown error during target resolution';

        this.#logger.error(
          `Error resolving targets for action '${actionDef.id}':`,
          error
        );

        // Capture error in tracing if available
        if (isActionAwareTrace) {
          this.#tracingOrchestrator.captureResolutionError(
            trace,
            actionDef,
            actor,
            error
          );
        }

        errors.push({
          error: errorMessage,
          phase: 'target_resolution',
          actionId: actionDef.id,
          stage: 'MultiTargetResolutionStage',
          scopeName: error?.scopeName,
        });
      }
    }

    // Capture post-resolution summary if tracing enabled
    if (isActionAwareTrace && tracedActionCount > 0) {
      this.#tracingOrchestrator.capturePostResolutionSummary(
        trace,
        actor,
        candidateActions.length,
        allActionsWithTargets.length,
        hasLegacyActions,
        hasMultiTargetActions,
        Date.now() - stageStartTime
      );
    }

    this.#logger.debug('\n=== MULTITARGETRESOLUTIONSTAGE EXIT ===');
    this.#logger.debug('Actions with resolved targets:', allActionsWithTargets.length);
    this.#logger.debug(
      'Action IDs with targets:',
      allActionsWithTargets.map(awt => awt.actionDef.id)
    );
    this.#logger.debug('=== END EXIT ===\n');

    trace?.info(
      `Target resolution completed: ${allActionsWithTargets.length} actions with targets`,
      'MultiTargetResolutionStage'
    );

    // ACTTRA-018: Capture performance data for each action
    const endPerformanceTime = performance.now();
    if (isActionAwareTrace) {
      for (const actionDef of candidateActions) {
        await this.#tracingOrchestrator.capturePerformanceData(
          trace,
          actionDef,
          startPerformanceTime,
          endPerformanceTime,
          candidateActions.length,
          allActionsWithTargets.length
        );
      }
    }

    return this.#resultBuilder.buildFinalResult(
      context,
      allActionsWithTargets,
      allTargetContexts,
      lastResolvedTargets,
      lastTargetDefinitions,
      errors
    );
  }

  /**
   * Resolve legacy single-target action for backward compatibility
   *
   * @param context
   * @param trace
   * @private
   */
  async #resolveLegacyTarget(context, trace) {
    const { actionDef, actor, actionContext } = context;

    // Use legacy compatibility layer to convert to multi-target format
    const conversionResult = this.#legacyLayer.convertLegacyFormat(
      actionDef,
      actor
    );

    // If conversion failed, return failure
    if (conversionResult.error) {
      return PipelineResult.failure(
        {
          error: conversionResult.error,
          phase: 'target_resolution',
          actionId: actionDef.id,
          stage: 'MultiTargetResolutionStage',
        },
        context.data
      );
    }

    const scope =
      conversionResult.targetDefinitions?.primary?.scope ||
      actionDef.targets ||
      actionDef.scope;

    // TEMPORARY DIAGNOSTIC: Log legacy resolution details
    this.#logger.debug(`[DIAGNOSTIC] Legacy resolution for ${actionDef.id}:`, {
      scope,
      actorId: actor.id,
      hasActionContext: !!actionContext,
      actionContextKeys: actionContext ? Object.keys(actionContext) : [],
    });

    trace?.step(
      `Resolving legacy scope '${scope}'`,
      'MultiTargetResolutionStage'
    );

    // TEMPORARY DIAGNOSTIC: About to call resolveTargets
    this.#logger.debug(
      `[DIAGNOSTIC] About to call targetResolver.resolveTargets for ${actionDef.id}`
    );

    // Use existing target resolver for compatibility
    const result = await this.#targetResolver.resolveTargets(
      scope,
      actor,
      actionContext,
      trace,
      actionDef.id
    );

    // TEMPORARY DIAGNOSTIC: resolveTargets returned
    this.#logger.debug(
      `[DIAGNOSTIC] targetResolver.resolveTargets returned for ${actionDef.id}`
    );

    // TEMPORARY DIAGNOSTIC: Log resolution result
    this.#logger.debug(`[DIAGNOSTIC] Legacy resolution result for ${actionDef.id}:`, {
      success: result.success,
      hasValue: !!result.value,
      targetContextsLength: result.value?.length || 0,
      targetContexts: result.value || [],
    });

    if (!result.success) {
      return PipelineResult.failure(result.errors, context.data);
    }

    const targetContexts = result.value;
    const placeholder =
      conversionResult.targetDefinitions?.primary?.placeholder || 'target';

    // Annotate legacy contexts with placeholder and display metadata so
    // downstream formatters can substitute the correct entity names.
    for (const targetContext of targetContexts) {
      if (!targetContext || typeof targetContext !== 'object') {
        continue;
      }

      targetContext.placeholder = placeholder;

      if (targetContext.entityId) {
        const existingDisplayName =
          typeof targetContext.displayName === 'string' &&
          targetContext.displayName.length > 0
            ? targetContext.displayName
            : null;

        const resolvedDisplayName =
          existingDisplayName ||
          this.#nameResolver.getEntityDisplayName(targetContext.entityId) ||
          targetContext.entityId;

        targetContext.displayName = resolvedDisplayName;
      }
    }

    // For actions with 'none' scope, we still need to include them
    // even though they have no actual targets
    if (targetContexts.length === 0 && scope !== 'none') {
      trace?.info(
        'No targets found for legacy action',
        'MultiTargetResolutionStage'
      );
      return PipelineResult.success({
        data: {
          ...context.data,
          actionsWithTargets: [],
        },
        continueProcessing: false,
      });
    }

    // Convert to multi-target format for consistency
    const resolvedTargets = {
      primary: targetContexts.map((tc) => ({
        id: tc.entityId,
        displayName:
          tc.displayName ||
          this.#nameResolver.getEntityDisplayName(tc.entityId) ||
          tc.entityId,
        entity: tc.entityId
          ? this.#entityManager.getEntityInstance(tc.entityId)
          : null,
      })),
    };

    return this.#resultBuilder.buildLegacyResult(
      context,
      resolvedTargets,
      targetContexts,
      {
        ...conversionResult,
        targetDefinitions:
          conversionResult.targetDefinitions || {
            primary: { scope, placeholder },
          },
      },
      actionDef
    );
  }
}

export default MultiTargetResolutionStage;
