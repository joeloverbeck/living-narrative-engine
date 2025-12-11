import { PipelineResult } from '../../PipelineResult.js';
import { validateDependency } from '../../../../utils/dependencyUtils.js';

/**
 * @class TargetResolutionCoordinator
 * @description Coordinates dependency-aware multi-target resolution for pipeline actions.
 */
export default class TargetResolutionCoordinator {
  #dependencyResolver;
  #contextBuilder;
  #nameResolver;
  #unifiedScopeResolver;
  #entityManager;
  #logger;
  #tracingOrchestrator;
  #resultBuilder;

  /**
   * @param {object} deps - Service dependencies.
   * @param {import('../interfaces/ITargetDependencyResolver.js').ITargetDependencyResolver} deps.dependencyResolver
   * @param {import('../interfaces/IScopeContextBuilder.js').IScopeContextBuilder} deps.contextBuilder
   * @param {import('../interfaces/ITargetDisplayNameResolver.js').ITargetDisplayNameResolver} deps.nameResolver
   * @param {import('../../scopes/unifiedScopeResolver.js').UnifiedScopeResolver} deps.unifiedScopeResolver
   * @param {import('../../../../interfaces/coreServices.js').IEntityManager} deps.entityManager
   * @param {import('../../../../interfaces/coreServices.js').ILogger} deps.logger
   * @param {import('../interfaces/ITargetResolutionTracingOrchestrator.js').ITargetResolutionTracingOrchestrator} deps.tracingOrchestrator
   * @param {import('../interfaces/ITargetResolutionResultBuilder.js').default} deps.resultBuilder
   */
  constructor({
    dependencyResolver,
    contextBuilder,
    nameResolver,
    unifiedScopeResolver,
    entityManager,
    logger,
    tracingOrchestrator,
    resultBuilder,
  }) {
    validateDependency(
      dependencyResolver,
      'ITargetDependencyResolver',
      logger,
      {
        requiredMethods: ['getResolutionOrder'],
      }
    );
    validateDependency(contextBuilder, 'IScopeContextBuilder', logger, {
      requiredMethods: [
        'buildScopeContext',
        'buildScopeContextForSpecificPrimary',
      ],
    });
    validateDependency(nameResolver, 'ITargetDisplayNameResolver', logger, {
      requiredMethods: ['getEntityDisplayName'],
    });
    validateDependency(unifiedScopeResolver, 'IUnifiedScopeResolver', logger, {
      requiredMethods: ['resolve'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityInstance'],
    });
    validateDependency(logger, 'ILogger', logger);
    validateDependency(
      tracingOrchestrator,
      'ITargetResolutionTracingOrchestrator',
      logger,
      {
        requiredMethods: [
          'isActionAwareTrace',
          'captureScopeEvaluation',
          'captureMultiTargetResolution',
        ],
      }
    );
    validateDependency(
      resultBuilder,
      'ITargetResolutionResultBuilder',
      logger,
      {
        requiredMethods: ['buildMultiTargetResult'],
      }
    );

    this.#dependencyResolver = dependencyResolver;
    this.#contextBuilder = contextBuilder;
    this.#nameResolver = nameResolver;
    this.#unifiedScopeResolver = unifiedScopeResolver;
    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#tracingOrchestrator = tracingOrchestrator;
    this.#resultBuilder = resultBuilder;
  }

  /**
   * @description Coordinate target resolution for a multi-target action definition.
   * @param {object} context - Pipeline context containing action metadata.
   * @param {import('../../../tracing/traceContext.js').TraceContext} [trace] - Optional trace context.
   * @returns {Promise<PipelineResult>} PipelineResult matching the original stage contract.
   */
  async coordinateResolution(context, trace) {
    const { actionDef, actor, actionContext } = context;
    const targetDefs = actionDef.targets;
    const resolutionStartTime = Date.now();

    this.#logger.debug(
      `\n### #resolveMultiTargets for action: ${actionDef.id} ###`
    );
    this.#logger.debug('targetDefs:', JSON.stringify(targetDefs, null, 2));

    if (!targetDefs || typeof targetDefs !== 'object') {
      return PipelineResult.failure(
        {
          error: 'Invalid targets configuration',
          phase: 'target_resolution',
          actionId: actionDef.id,
          stage: 'MultiTargetResolutionStage',
        },
        { ...context.data, error: 'Invalid targets configuration' }
      );
    }

    let resolutionOrder;
    try {
      resolutionOrder = this.#dependencyResolver.getResolutionOrder(targetDefs);
    } catch (error) {
      return PipelineResult.failure(
        {
          error: error?.message || 'Unknown error getting resolution order',
          phase: 'target_resolution',
          actionId: actionDef.id,
          stage: 'MultiTargetResolutionStage',
        },
        {
          ...context.data,
          error: error?.message || 'Unknown error getting resolution order',
        }
      );
    }

    trace?.info(
      `Target resolution order: ${resolutionOrder.join(', ')}`,
      'MultiTargetResolutionStage'
    );

    const isActionAwareTrace =
      this.#tracingOrchestrator.isActionAwareTrace(trace);

    const resolutionOutcome = await this.resolveWithDependencies({
      context,
      actionDef,
      targetDefs,
      actor,
      actionContext,
      trace,
      resolutionOrder,
      isActionAwareTrace,
    });

    if (resolutionOutcome instanceof PipelineResult) {
      return resolutionOutcome;
    }

    const {
      resolvedTargets,
      resolvedCounts,
      targetContexts,
      detailedResolutionResults,
    } = resolutionOutcome;

    if (isActionAwareTrace) {
      this.#tracingOrchestrator.captureMultiTargetResolution(
        trace,
        actionDef.id,
        {
          targetKeys: Object.keys(targetDefs),
          resolvedCounts,
          totalTargets: Object.values(resolvedCounts).reduce(
            (sum, count) => sum + count,
            0
          ),
          resolutionOrder,
          hasContextDependencies: resolutionOrder.some(
            (key) => targetDefs[key].contextFrom
          ),
          resolutionTimeMs: Date.now() - resolutionStartTime,
        }
      );
    }

    const hasTargets = Object.values(resolvedTargets).some(
      (targets) => targets.length > 0
    );

    if (!hasTargets) {
      return PipelineResult.success({
        data: {
          ...context.data,
          actionsWithTargets: [],
          detailedResolutionResults,
        },
        continueProcessing: false,
      });
    }

    return this.#resultBuilder.buildMultiTargetResult(
      context,
      resolvedTargets,
      targetContexts,
      targetDefs,
      actionDef,
      detailedResolutionResults
    );
  }

  /**
   * @description Resolve targets according to dependency order.
   * @param {object} params - Resolution parameters.
   * @param {object} params.context - Pipeline context containing data payloads.
   * @param {import('../../actionTypes.js').ActionDefinition} params.actionDef - Action definition metadata.
   * @param {Record<string, object>} params.targetDefs - Target definitions map.
   * @param {import('../../../../entities/entity.js').default} params.actor - Acting entity.
   * @param {object} params.actionContext - Action context object.
   * @param {Array<string>} params.resolutionOrder - Dependency-aware order of target keys.
   * @param {import('../../../tracing/traceContext.js').TraceContext} [params.trace] - Optional trace context.
   * @param {boolean} params.isActionAwareTrace - Flag indicating trace support.
   * @returns {Promise<PipelineResult|{resolvedTargets: object, resolvedCounts: object, targetContexts: Array, detailedResolutionResults: object}>}
   */
  async resolveWithDependencies({
    context,
    actionDef,
    targetDefs,
    actor,
    actionContext,
    resolutionOrder,
    trace,
    isActionAwareTrace,
  }) {
    const resolvedTargets = {};
    const resolvedCounts = {};
    const allTargetContexts = [];
    const detailedResolutionResults = {};

    for (const targetKey of resolutionOrder) {
      const targetDef = targetDefs[targetKey];
      const scopeStartTime = Date.now();

      this.#logger.debug(`\n  >> Resolving target key: ${targetKey}`);
      this.#logger.debug(
        '  >> Target def:',
        JSON.stringify(targetDef, null, 2)
      );

      trace?.step(
        `Resolving ${targetKey} target`,
        'MultiTargetResolutionStage'
      );

      const primaryTargets = targetDef.contextFrom
        ? resolvedTargets[targetDef.contextFrom]
        : null;

      if (targetDef.contextFrom && primaryTargets) {
        trace?.info(
          `Resolving ${targetKey} for each ${targetDef.contextFrom} target (${primaryTargets.length} instances)`,
          'MultiTargetResolutionStage'
        );

        const dependentOutcome = await this.resolveDependentTargets({
          targetDef,
          primaryTargets,
          actor,
          actionContext,
          resolvedTargets,
          trace,
          scopeStartTime,
        });

        const {
          resolvedTargets: resolvedSecondaryTargets,
          targetContexts,
          candidatesFound,
          contextEntityIds,
          evaluationTimeMs,
        } = dependentOutcome;

        detailedResolutionResults[targetKey] = {
          scopeId: targetDef.scope,
          contextFrom: targetDef.contextFrom,
          primaryTargetCount: primaryTargets.length,
          candidatesFound,
          candidatesResolved: resolvedSecondaryTargets.length,
          contextEntityIds,
          failureReason: null,
          evaluationTimeMs,
        };

        if (isActionAwareTrace) {
          this.#tracingOrchestrator.captureScopeEvaluation(
            trace,
            actionDef.id,
            targetKey,
            {
              scope: targetDef.scope,
              context: targetDef.contextFrom,
              resultCount: resolvedSecondaryTargets.length,
              evaluationTimeMs,
              cacheHit: false,
              resolvedIds: resolvedSecondaryTargets.map(
                (resolved) => resolved.id
              ),
              contextDetails: {
                primaryTargetIds: primaryTargets.map((target) => target.id),
              },
            }
          );
        }

        if (resolvedSecondaryTargets.length === 0) {
          detailedResolutionResults[targetKey].failureReason =
            `No candidates found for target '${targetKey}' across ${primaryTargets.length} primary target(s)`;

          trace?.failure(
            `No candidates found for target '${targetKey}'`,
            'MultiTargetResolutionStage'
          );

          return PipelineResult.success({
            data: {
              ...context.data,
              actionsWithTargets: [],
              detailedResolutionResults,
            },
            continueProcessing: false,
          });
        }

        resolvedTargets[targetKey] = resolvedSecondaryTargets;
        resolvedCounts[targetKey] = resolvedSecondaryTargets.length;
        allTargetContexts.push(...targetContexts);

        trace?.success(
          `Resolved ${resolvedSecondaryTargets.length} total candidates for ${targetKey} across all ${primaryTargets.length} ${targetDef.contextFrom} targets`,
          'MultiTargetResolutionStage'
        );
      } else {
        detailedResolutionResults[targetKey] = {
          scopeId: targetDef.scope,
          contextFrom: null,
          candidatesFound: 0,
          candidatesResolved: 0,
          failureReason: null,
          evaluationTimeMs: 0,
        };

        const scopeContext = this.#contextBuilder.buildScopeContext(
          actor,
          actionContext,
          resolvedTargets,
          targetDef,
          trace
        );

        const candidates = await this.#resolveScope(
          targetDef.scope,
          scopeContext,
          actor,
          trace
        );

        this.#logger.debug(
          `  >> Scope '${targetDef.scope}' resolved to ${candidates.length} candidates`
        );
        this.#logger.debug('  >> Candidate IDs:', candidates);

        detailedResolutionResults[targetKey].candidatesFound =
          candidates.length;
        detailedResolutionResults[targetKey].evaluationTimeMs =
          Date.now() - scopeStartTime;

        if (isActionAwareTrace) {
          this.#tracingOrchestrator.captureScopeEvaluation(
            trace,
            actionDef.id,
            targetKey,
            {
              scope: targetDef.scope,
              context: 'actor',
              resultCount: candidates.length,
              evaluationTimeMs:
                detailedResolutionResults[targetKey].evaluationTimeMs,
              cacheHit: false,
              resolvedIds: candidates,
              contextDetails: {
                actorId: actor.id,
                resolvedTargetKeys: Object.keys(resolvedTargets),
              },
            }
          );
        }

        if (candidates.length === 0) {
          this.#logger.debug(
            `  ❌ NO CANDIDATES FOUND for target '${targetKey}'`
          );
          this.#logger.debug(`  ❌ Scope: ${targetDef.scope}`);
          this.#logger.debug(
            `  ❌ Action will be filtered out: ${actionDef.id}`
          );

          detailedResolutionResults[targetKey].failureReason =
            `No candidates found for scope '${targetDef.scope}' with actor context`;

          trace?.failure(
            `No candidates found for target '${targetKey}'`,
            'MultiTargetResolutionStage'
          );

          return PipelineResult.success({
            data: {
              ...context.data,
              actionsWithTargets: [],
              detailedResolutionResults,
            },
            continueProcessing: false,
          });
        }

        const hydratedTargets = candidates
          .map((entityId) => this.#toResolvedTarget(entityId))
          .filter(Boolean);

        resolvedTargets[targetKey] = hydratedTargets;
        resolvedCounts[targetKey] = hydratedTargets.length;
        detailedResolutionResults[targetKey].candidatesResolved =
          hydratedTargets.length;

        hydratedTargets.forEach((target) => {
          allTargetContexts.push({
            type: 'entity',
            entityId: target.id,
            displayName: target.displayName,
            placeholder: targetDef.placeholder,
          });
        });

        trace?.success(
          `Resolved ${candidates.length} candidates for ${targetKey}`,
          'MultiTargetResolutionStage'
        );
      }
    }

    return {
      resolvedTargets,
      resolvedCounts,
      targetContexts: allTargetContexts,
      detailedResolutionResults,
      resolutionOrder,
    };
  }

  /**
   * @description Resolve dependent targets by iterating each primary context.
   * @param {object} params - Resolution parameters.
   * @param {object} params.targetDef - Target definition metadata.
   * @param {Array<object>} params.primaryTargets - Previously resolved primary targets.
   * @param {import('../../../../entities/entity.js').default} params.actor - Acting entity.
   * @param {object} params.actionContext - Action context object.
   * @param {object} params.resolvedTargets - Map of resolved targets for dependency lookups.
   * @param {import('../../../tracing/traceContext.js').TraceContext} [params.trace] - Optional trace context.
   * @param {number} params.scopeStartTime - Timestamp when resolution started for this target.
   * @returns {Promise<{resolvedTargets: Array<object>, targetContexts: Array<object>, candidatesFound: number, contextEntityIds: Array<string>, evaluationTimeMs: number}>}
   */
  async resolveDependentTargets({
    targetDef,
    primaryTargets,
    actor,
    actionContext,
    resolvedTargets,
    trace,
    scopeStartTime,
  }) {
    const resolvedSecondaryTargets = [];
    const flatTargetContexts = [];
    let candidatesFound = 0;

    for (const primaryTarget of primaryTargets) {
      const specificContext =
        this.#contextBuilder.buildScopeContextForSpecificPrimary(
          actor,
          actionContext,
          resolvedTargets,
          primaryTarget,
          targetDef,
          trace
        );

      const candidates = await this.#resolveScope(
        targetDef.scope,
        specificContext,
        actor,
        trace
      );

      candidatesFound += candidates.length;

      candidates.forEach((entityId) => {
        const resolvedTarget = this.#toResolvedTarget(
          entityId,
          primaryTarget.id
        );

        if (!resolvedTarget) {
          return;
        }

        resolvedSecondaryTargets.push(resolvedTarget);
        flatTargetContexts.push({
          type: 'entity',
          entityId: resolvedTarget.id,
          displayName: resolvedTarget.displayName,
          placeholder: targetDef.placeholder,
        });
      });
    }

    return {
      resolvedTargets: resolvedSecondaryTargets,
      targetContexts: flatTargetContexts,
      candidatesFound,
      contextEntityIds: primaryTargets.map((target) => target.id),
      evaluationTimeMs: Date.now() - scopeStartTime,
    };
  }

  /**
   * @description Convert an entity identifier to a resolved target structure.
   * @param {string} entityId - Entity identifier.
   * @param {string} [contextFromId] - Optional context identifier for dependent targets.
   * @returns {{id: string, displayName: string, entity: object, contextFromId?: string}|null}
   */
  #toResolvedTarget(entityId, contextFromId) {
    const entity = this.#entityManager.getEntityInstance(entityId);
    if (!entity) {
      return null;
    }

    const displayName = this.#nameResolver.getEntityDisplayName(entityId);

    const target = {
      id: entityId,
      displayName,
      entity,
    };

    if (contextFromId) {
      target.contextFromId = contextFromId;
    }

    return target;
  }

  /**
   * @description Resolve a scope expression to entity IDs using UnifiedScopeResolver.
   * @param {string} scope - Scope identifier.
   * @param {object} context - Scope evaluation context.
   * @param {import('../../../../entities/entity.js').default} actor - Acting entity.
   * @param {import('../../../tracing/traceContext.js').TraceContext} [trace] - Optional trace context.
   * @returns {Promise<Array<string>>} Normalized entity identifiers.
   */
  async #resolveScope(scope, context, actor, trace) {
    try {
      trace?.step(`Evaluating scope '${scope}'`, 'MultiTargetResolutionStage');

      const resolutionContext = {
        ...context,
        actorLocation:
          context.location ||
          context.actionContext?.currentLocation ||
          context.actionContext?.location,
        actionContext: {
          ...context,
          location: context.location,
        },
        trace,
      };

      const result = await this.#unifiedScopeResolver.resolve(
        scope,
        resolutionContext,
        {
          // FIX: Disable caching for context-dependent scopes (e.g., containers-core:container_contents)
          // The cache key doesn't include context.target, so scopes that depend on the specific
          // primary target would incorrectly return cached results from a different primary.
          // This bug caused "take X from Y" actions to generate for items from the wrong container.
          useCache: false,
        }
      );

      if (!result.success) {
        const errorDetails = result.errors || result.error || 'Unknown error';
        const errorMessage =
          Array.isArray(errorDetails) && errorDetails.length > 0
            ? errorDetails[0]?.message || errorDetails[0] || 'Unknown error'
            : typeof errorDetails === 'string'
              ? errorDetails
              : 'Unknown error';

        this.#logger.error(`Failed to resolve scope '${scope}':`, errorDetails);

        const error = new Error(errorMessage);
        error.name = 'ScopeResolutionError';
        error.scopeName = scope;
        error.originalErrors = errorDetails;
        throw error;
      }

      const entityIds = Array.from(result.value);
      const normalizedIds = entityIds
        .map((entry) => {
          if (typeof entry === 'string') {
            return entry;
          }

          if (entry && typeof entry === 'object') {
            if (typeof entry.id === 'string' && entry.id.trim()) {
              return entry.id.trim();
            }

            if (typeof entry.itemId === 'string' && entry.itemId.trim()) {
              return entry.itemId.trim();
            }
          }

          return null;
        })
        .filter((id) => typeof id === 'string' && id.length > 0);

      trace?.info(
        `Scope resolved to ${normalizedIds.length} entities`,
        'MultiTargetResolutionStage'
      );

      return normalizedIds;
    } catch (error) {
      this.#logger.error(`Error evaluating scope '${scope}':`, error);
      trace?.failure(
        `Scope evaluation failed: ${error?.message || 'Unknown error'}`,
        'MultiTargetResolutionStage'
      );
      return [];
    }
  }
}
