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
 * Pipeline stage that orchestrates target resolution using specialized services
 * Refactored from 748-line class to lightweight orchestrator
 */
export class MultiTargetResolutionStage extends PipelineStage {
  #dependencyResolver;
  #legacyLayer;
  #contextBuilder;
  #nameResolver;
  #unifiedScopeResolver;
  #entityManager;
  #targetResolver;
  #logger;

  /**
   * @param {object} deps - Service dependencies
   * @param {ITargetDependencyResolver} deps.targetDependencyResolver
   * @param {ILegacyTargetCompatibilityLayer} deps.legacyTargetCompatibilityLayer
   * @param {IScopeContextBuilder} deps.scopeContextBuilder
   * @param {ITargetDisplayNameResolver} deps.targetDisplayNameResolver
   * @param {UnifiedScopeResolver} deps.unifiedScopeResolver
   * @param {IEntityManager} deps.entityManager
   * @param {ITargetResolutionService} deps.targetResolver
   * @param {TargetContextBuilder} deps.targetContextBuilder
   * @param {ILogger} deps.logger
   */
  constructor({
    targetDependencyResolver,
    legacyTargetCompatibilityLayer,
    scopeContextBuilder,
    targetDisplayNameResolver,
    unifiedScopeResolver,
    entityManager,
    targetResolver,
    targetContextBuilder,
    logger,
  }) {
    super('MultiTargetResolution');

    // Validate all service dependencies
    validateDependency(targetDependencyResolver, 'ITargetDependencyResolver');
    validateDependency(
      legacyTargetCompatibilityLayer,
      'ILegacyTargetCompatibilityLayer'
    );
    validateDependency(scopeContextBuilder, 'IScopeContextBuilder');
    validateDependency(targetDisplayNameResolver, 'ITargetDisplayNameResolver');
    validateDependency(unifiedScopeResolver, 'IUnifiedScopeResolver');
    validateDependency(entityManager, 'IEntityManager');
    validateDependency(targetResolver, 'ITargetResolutionService');
    validateDependency(logger, 'ILogger');

    // Store service references
    this.#dependencyResolver = targetDependencyResolver;
    this.#legacyLayer = legacyTargetCompatibilityLayer;
    this.#contextBuilder = scopeContextBuilder;
    this.#nameResolver = targetDisplayNameResolver;
    this.#unifiedScopeResolver = unifiedScopeResolver;
    this.#entityManager = entityManager;
    this.#targetResolver = targetResolver;
    this.#logger = logger;
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

    console.log('\n=== MULTITARGETRESOLUTIONSTAGE ENTRY ===');
    console.log('Candidate actions count:', candidateActions.length);
    console.log('Candidate action IDs:', candidateActions.map(a => a.id));
    console.log('Actor ID:', actor.id);
    console.log('=== END ENTRY ===\n');

    trace?.step(
      `Resolving targets for ${candidateActions.length} candidate actions`,
      'MultiTargetResolutionStage'
    );

    // Check if we have action-aware tracing capability
    const isActionAwareTrace = this.#isActionAwareTrace(trace);

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
      console.log(`\n--- Processing action: ${actionDef.id} ---`);
      console.log('Action has targets?', !!actionDef.targets);
      console.log('Targets:', JSON.stringify(actionDef.targets, null, 2));

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

        // Capture legacy detection if action-aware tracing is enabled
        if (isActionAwareTrace && trace.captureLegacyDetection) {
          trace.captureLegacyDetection(actionDef.id, {
            hasStringTargets: typeof actionDef.targets === 'string',
            hasScopeOnly: !!(actionDef.scope && !actionDef.targets),
            hasLegacyFields: !!(actionDef.targetType || actionDef.targetCount),
            detectedFormat: this.#analyzeLegacyFormat(actionDef),
            requiresConversion: isLegacy,
          });
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
          if (isActionAwareTrace && trace.captureLegacyConversion) {
            trace.captureLegacyConversion(actionDef.id, {
              isLegacy: true,
              originalAction: actionDef,
              targetDefinitions: conversionResult.targetDefinitions,
              processingTime,
              error: conversionResult.error,
              migrationSuggestion:
                this.#legacyLayer.getMigrationSuggestion(actionDef),
              success: result.success,
            });
          }

          // Capture tracing data for legacy action if enabled
          if (isActionAwareTrace && trace.captureActionData) {
            this.#captureTargetResolutionData(trace, actionDef, actor, {
              isLegacy: true,
              resolutionSuccess: result.success,
              resolutionTimeMs: Date.now() - resolutionStartTime,
              targetCount: result.data?.resolvedTargets?.primary?.length || 0,
              scope:
                result.data?.targetDefinitions?.primary?.scope ||
                actionDef.scope ||
                actionDef.targets,
            });
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
          // Resolve multi-target action
          hasMultiTargetActions = true;
          const result = await this.#resolveMultiTargets(
            actionProcessContext,
            trace
          );

          // Capture tracing data for multi-target action if enabled
          if (isActionAwareTrace && trace.captureActionData) {
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

            this.#captureTargetResolutionData(
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
        if (isActionAwareTrace && trace.captureActionData) {
          this.#captureTargetResolutionError(trace, actionDef, actor, error);
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
      this.#capturePostResolutionSummary(
        trace,
        actor,
        candidateActions.length,
        allActionsWithTargets.length,
        hasLegacyActions,
        hasMultiTargetActions,
        Date.now() - stageStartTime
      );
    }

    console.log('\n=== MULTITARGETRESOLUTIONSTAGE EXIT ===');
    console.log('Actions with resolved targets:', allActionsWithTargets.length);
    console.log('Action IDs with targets:', allActionsWithTargets.map(awt => awt.actionDef.id));
    console.log('=== END EXIT ===\n');

    trace?.info(
      `Target resolution completed: ${allActionsWithTargets.length} actions with targets`,
      'MultiTargetResolutionStage'
    );

    // ACTTRA-018: Capture performance data for each action
    const endPerformanceTime = performance.now();
    if (isActionAwareTrace && trace.captureActionData) {
      for (const actionDef of candidateActions) {
        await this.#capturePerformanceData(
          trace,
          actionDef,
          startPerformanceTime,
          endPerformanceTime,
          candidateActions.length,
          allActionsWithTargets.length
        );
      }
    }

    // Build final result data
    const resultData = {
      ...context.data,
      actionsWithTargets: allActionsWithTargets,
    };

    // Add backward compatibility fields if we have target data
    if (allTargetContexts.length > 0) {
      resultData.targetContexts = allTargetContexts;
    }
    // Keep global metadata for backward compatibility but it's no longer required
    // Each action now has its own metadata attached
    if (lastResolvedTargets && lastTargetDefinitions) {
      resultData.resolvedTargets = lastResolvedTargets;
      resultData.targetDefinitions = lastTargetDefinitions;
    }

    return PipelineResult.success({
      data: resultData,
      errors,
    });
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

    trace?.step(
      `Resolving legacy scope '${scope}'`,
      'MultiTargetResolutionStage'
    );

    // Use existing target resolver for compatibility
    const result = await this.#targetResolver.resolveTargets(
      scope,
      actor,
      actionContext,
      trace,
      actionDef.id
    );

    if (!result.success) {
      return PipelineResult.failure(result.errors, context.data);
    }

    const targetContexts = result.value;

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
          this.#nameResolver.getEntityDisplayName(tc.entityId) || tc.entityId,
        entity: tc.entityId
          ? this.#entityManager.getEntityInstance(tc.entityId)
          : null,
      })),
    };

    // Get the placeholder from the conversion result
    const placeholder =
      conversionResult.targetDefinitions?.primary?.placeholder || 'target';

    return PipelineResult.success({
      data: {
        ...context.data,
        resolvedTargets,
        targetContexts, // Keep for backward compatibility
        actionsWithTargets: [
          {
            actionDef,
            targetContexts,
            // Attach metadata for consistency with multi-target actions
            resolvedTargets,
            targetDefinitions: conversionResult.targetDefinitions || {
              primary: { scope: scope, placeholder: placeholder },
            },
            isMultiTarget: false,
          },
        ],
      },
    });
  }

  /**
   * Resolve multi-target action
   *
   * @param context
   * @param trace
   * @private
   */
  async #resolveMultiTargets(context, trace) {
    const { actionDef, actor, actionContext } = context;
    const targetDefs = actionDef.targets;
    const resolutionStartTime = Date.now();

    console.log(`\n### #resolveMultiTargets for action: ${actionDef.id} ###`);
    console.log('targetDefs:', JSON.stringify(targetDefs, null, 2));

    // Validate targets object
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

    // Get resolution order based on dependencies
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

    // Check if trace supports multi-target capture
    const isActionAwareTrace =
      trace && typeof trace.captureMultiTargetResolution === 'function';

    // Resolve targets sequentially
    const resolvedTargets = {};
    const resolvedCounts = {};
    const allTargetContexts = []; // For backward compatibility

    // Track detailed resolution information for enhanced tracing
    const detailedResolutionResults = {};

    for (const targetKey of resolutionOrder) {
      const targetDef = targetDefs[targetKey];
      const scopeStartTime = Date.now();

      console.log(`\n  >> Resolving target key: ${targetKey}`);
      console.log('  >> Target def:', JSON.stringify(targetDef, null, 2));

      trace?.step(
        `Resolving ${targetKey} target`,
        'MultiTargetResolutionStage'
      );

      // Check if this target depends on another target's context
      if (targetDef.contextFrom && resolvedTargets[targetDef.contextFrom]) {
        // Resolve this target for each instance of the contextFrom target
        const primaryTargets = resolvedTargets[targetDef.contextFrom];
        const resolvedSecondaryTargets = [];

        // Initialize detailed results for this target
        detailedResolutionResults[targetKey] = {
          scopeId: targetDef.scope,
          contextFrom: targetDef.contextFrom,
          primaryTargetCount: primaryTargets.length,
          candidatesFound: 0,
          candidatesResolved: 0,
          contextEntityIds: primaryTargets.map((t) => t.id),
          failureReason: null,
          evaluationTimeMs: 0,
        };

        trace?.info(
          `Resolving ${targetKey} for each ${targetDef.contextFrom} target (${primaryTargets.length} instances)`,
          'MultiTargetResolutionStage'
        );

        for (const primaryTarget of primaryTargets) {
          // Build context specific to this primary target
          const specificContext =
            this.#contextBuilder.buildScopeContextForSpecificPrimary(
              actor,
              actionContext,
              resolvedTargets,
              primaryTarget,
              targetDef,
              trace
            );

          // Resolve scope for this specific primary
          const candidates = await this.#resolveScope(
            targetDef.scope,
            specificContext,
            actor,
            trace
          );

          detailedResolutionResults[targetKey].candidatesFound +=
            candidates.length;

          // Store resolved targets with reference to their primary
          candidates.forEach((entityId) => {
            const entity = this.#entityManager.getEntityInstance(entityId);
            if (!entity) return; // Skip missing entities

            const displayName =
              this.#nameResolver.getEntityDisplayName(entityId);

            resolvedSecondaryTargets.push({
              id: entityId,
              displayName,
              entity,
              contextFromId: primaryTarget.id, // Track which primary this belongs to
            });
          });
        }

        detailedResolutionResults[targetKey].candidatesResolved =
          resolvedSecondaryTargets.length;
        detailedResolutionResults[targetKey].evaluationTimeMs =
          Date.now() - scopeStartTime;

        // Capture scope evaluation BEFORE early return (for 0-result debugging)
        if (isActionAwareTrace && trace.captureScopeEvaluation) {
          trace.captureScopeEvaluation(actionDef.id, targetKey, {
            scope: targetDef.scope,
            context: targetDef.contextFrom,
            resultCount: resolvedSecondaryTargets.length,
            evaluationTimeMs: Date.now() - scopeStartTime,
            cacheHit: false, // We don't have cache info for contextFrom targets yet
          });
        }

        // Check if we found no candidates for any primary
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
              detailedResolutionResults, // Include detailed results even on failure
            },
            continueProcessing: false,
          });
        }

        resolvedTargets[targetKey] = resolvedSecondaryTargets;
        resolvedCounts[targetKey] = resolvedSecondaryTargets.length;

        // Add to flat list for backward compatibility
        resolvedSecondaryTargets.forEach((target) => {
          allTargetContexts.push({
            type: 'entity',
            entityId: target.id,
            displayName: target.displayName,
            placeholder: targetDef.placeholder,
          });
        });

        trace?.success(
          `Resolved ${resolvedSecondaryTargets.length} total candidates for ${targetKey} across all ${primaryTargets.length} ${targetDef.contextFrom} targets`,
          'MultiTargetResolutionStage'
        );
      } else {
        // Original logic for targets without contextFrom
        // Initialize detailed results for this target
        detailedResolutionResults[targetKey] = {
          scopeId: targetDef.scope,
          contextFrom: null,
          candidatesFound: 0,
          candidatesResolved: 0,
          failureReason: null,
          evaluationTimeMs: 0,
        };

        // Build scope context
        const scopeContext = this.#contextBuilder.buildScopeContext(
          actor,
          actionContext,
          resolvedTargets,
          targetDef,
          trace
        );

        // Resolve scope
        const candidates = await this.#resolveScope(
          targetDef.scope,
          scopeContext,
          actor,
          trace
        );

        console.log(`  >> Scope '${targetDef.scope}' resolved to ${candidates.length} candidates`);
        console.log('  >> Candidate IDs:', candidates);

        detailedResolutionResults[targetKey].candidatesFound =
          candidates.length;
        detailedResolutionResults[targetKey].evaluationTimeMs =
          Date.now() - scopeStartTime;

        // Capture scope evaluation BEFORE early return (for 0-result debugging)
        if (isActionAwareTrace && trace.captureScopeEvaluation) {
          trace.captureScopeEvaluation(actionDef.id, targetKey, {
            scope: targetDef.scope,
            context: 'actor', // Default context when no contextFrom
            resultCount: candidates.length,
            evaluationTimeMs: Date.now() - scopeStartTime,
            cacheHit: false, // We'll need to get this from UnifiedScopeResolver
          });
        }

        // Check if we found no candidates
        if (candidates.length === 0) {
          console.log(`  ❌ NO CANDIDATES FOUND for target '${targetKey}'`);
          console.log(`  ❌ Scope: ${targetDef.scope}`);
          console.log(`  ❌ Action will be filtered out: ${actionDef.id}`);

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
              detailedResolutionResults, // Include detailed results even on failure
            },
            continueProcessing: false,
          });
        }

        // Store resolved targets
        resolvedTargets[targetKey] = candidates
          .map((entityId) => {
            const entity = this.#entityManager.getEntityInstance(entityId);
            if (!entity) {
              return null; // Filter out missing entities
            }

            const displayName =
              this.#nameResolver.getEntityDisplayName(entityId);

            return {
              id: entityId,
              displayName,
              entity,
            };
          })
          .filter(Boolean); // Remove null entries

        resolvedCounts[targetKey] = resolvedTargets[targetKey].length;

        detailedResolutionResults[targetKey].candidatesResolved =
          resolvedTargets[targetKey].length;

        // Add to flat list for backward compatibility
        resolvedTargets[targetKey].forEach((target) => {
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

    // Update final resolution time if using multi-target tracing
    if (isActionAwareTrace) {
      trace.captureMultiTargetResolution(actionDef.id, {
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
      });
    }

    // Check if we have at least one valid target
    const hasTargets = Object.values(resolvedTargets).some(
      (targets) => targets.length > 0
    );

    if (!hasTargets) {
      return PipelineResult.success({
        data: {
          ...context.data,
          actionsWithTargets: [],
          detailedResolutionResults, // Include detailed results even when no targets found
        },
        continueProcessing: false,
      });
    }

    // Attach resolved targets directly to actionDef for downstream stages
    // This is critical for TargetComponentValidationStage which expects actionDef.resolvedTargets
    actionDef.resolvedTargets = resolvedTargets;
    actionDef.targetDefinitions = targetDefs;
    actionDef.isMultiTarget = true;

    const actionsWithTargets = [
      {
        actionDef,
        targetContexts: allTargetContexts,
        resolvedTargets,
        targetDefinitions: targetDefs,
        isMultiTarget: true,
      },
    ];

    return PipelineResult.success({
      data: {
        ...context.data,
        resolvedTargets,
        targetContexts: allTargetContexts, // Backward compatibility
        targetDefinitions: targetDefs, // Pass definitions for formatting
        detailedResolutionResults, // Include detailed resolution results
        actionsWithTargets,
      },
    });
  }

  /**
   * Resolve a scope expression to entity IDs
   *
   * @param scope
   * @param context
   * @param actor
   * @param trace
   * @private
   */
  async #resolveScope(scope, context, actor, trace) {
    try {
      trace?.step(`Evaluating scope '${scope}'`, 'MultiTargetResolutionStage');

      // Create resolution context for UnifiedScopeResolver
      // Preserve the context.actor format from TargetContextBuilder
      const resolutionContext = {
        ...context, // Include all fields from the scope context
        // Don't override context.actor - it's already in the correct format from TargetContextBuilder
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

      // Resolve scope using UnifiedScopeResolver

      const result = await this.#unifiedScopeResolver.resolve(
        scope,
        resolutionContext,
        {
          useCache: true,
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

        // Throw error to be caught by calling method
        const error = new Error(errorMessage);
        error.name = 'ScopeResolutionError';
        error.scopeName = scope;
        error.originalErrors = errorDetails;
        throw error;
      }

      // Convert Set to array of entity IDs, normalizing inventory references
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

  /**
   * Check if trace is ActionAwareStructuredTrace
   *
   * @private
   * @param {object} trace - Trace instance to check
   * @returns {boolean}
   */
  #isActionAwareTrace(trace) {
    return trace && typeof trace.captureActionData === 'function';
  }

  /**
   * Capture target resolution data for traced action
   *
   * @private
   * @param {object} trace - Trace instance
   * @param {object} actionDef - Action definition
   * @param {object} actor - Actor entity
   * @param {object} data - Resolution data to capture
   * @param {object} [detailedResults] - Optional detailed resolution results per target
   */
  #captureTargetResolutionData(
    trace,
    actionDef,
    actor,
    data,
    detailedResults = null
  ) {
    try {
      const traceData = {
        stage: 'target_resolution',
        actorId: actor.id,
        ...data,
        timestamp: Date.now(),
      };

      // Add detailed target resolution information if available
      if (detailedResults) {
        traceData.targetResolutionDetails = detailedResults;
      }

      trace.captureActionData('target_resolution', actionDef.id, traceData);

      this.#logger.debug(
        `MultiTargetResolutionStage: Captured target resolution data for action '${actionDef.id}'`,
        {
          actionId: actionDef.id,
          isLegacy: data.isLegacy,
          success: data.resolutionSuccess,
          hasDetailedResults: !!detailedResults,
        }
      );
    } catch (error) {
      // Don't throw - tracing failures shouldn't break the pipeline
      this.#logger.warn(
        `Failed to capture target resolution data for action '${actionDef.id}'`,
        error
      );
    }
  }

  /**
   * Capture target resolution error
   *
   * @private
   * @param {object} trace - Trace instance
   * @param {object} actionDef - Action definition
   * @param {object} actor - Actor entity
   * @param {Error} error - Error that occurred
   */
  #captureTargetResolutionError(trace, actionDef, actor, error) {
    try {
      const errorData = {
        stage: 'target_resolution',
        actorId: actor.id,
        resolutionFailed: true,
        error: error.message,
        errorType: error.constructor.name,
        scopeName: error.scopeName,
        timestamp: Date.now(),
      };

      trace.captureActionData('target_resolution', actionDef.id, errorData);

      this.#logger.debug(
        `MultiTargetResolutionStage: Captured target resolution error for action '${actionDef.id}'`,
        { actionId: actionDef.id, error: error.message }
      );
    } catch (traceError) {
      this.#logger.warn(
        `Failed to capture target resolution error data for action '${actionDef.id}'`,
        traceError
      );
    }
  }

  /**
   * Capture post-resolution summary data
   *
   * @private
   * @param {object} trace - Trace instance
   * @param {object} actor - Actor entity
   * @param {number} originalCount - Original candidate action count
   * @param {number} resolvedCount - Actions with resolved targets count
   * @param {boolean} hasLegacy - Whether legacy actions were processed
   * @param {boolean} hasMultiTarget - Whether multi-target actions were processed
   * @param {number} stageDuration - Time taken for stage execution
   */
  #capturePostResolutionSummary(
    trace,
    actor,
    originalCount,
    resolvedCount,
    hasLegacy,
    hasMultiTarget,
    stageDuration
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
        stageDurationMs: stageDuration,
        timestamp: Date.now(),
      };

      // Note: Summary data is not action-specific, so we don't pass an actionId
      // This could be logged differently or sent to a different trace method if available
      this.#logger.debug(
        'MultiTargetResolutionStage: Captured post-resolution summary',
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
   * Helper method to analyze legacy format for tracing
   *
   * @private
   * @param {object} action - Action definition to analyze
   * @returns {string} Detected legacy format type
   */
  #analyzeLegacyFormat(action) {
    if (typeof action.targets === 'string') return 'string_targets';
    if (action.scope && !action.targets) return 'scope_property';
    if (action.targetType || action.targetCount) return 'legacy_target_type';
    return 'modern';
  }

  /**
   * Capture performance data for ACTTRA-018
   *
   * @private
   * @param {import('../../tracing/actionAwareStructuredTrace.js').default} trace - The action-aware trace
   * @param {object} actionDef - The action definition
   * @param {number} startTime - Start performance time
   * @param {number} endTime - End performance time
   * @param {number} totalCandidates - Total number of candidates processed
   * @param {number} actionsWithTargets - Number of actions that successfully resolved targets
   * @returns {Promise<void>}
   */
  async #capturePerformanceData(
    trace,
    actionDef,
    startTime,
    endTime,
    totalCandidates,
    actionsWithTargets
  ) {
    try {
      if (trace && trace.captureActionData) {
        await trace.captureActionData('stage_performance', actionDef.id, {
          stage: 'multi_target_resolution',
          duration: endTime - startTime,
          timestamp: Date.now(),
          itemsProcessed: totalCandidates,
          itemsResolved: actionsWithTargets,
          stageName: this.name,
        });
      }
    } catch (error) {
      this.#logger.debug(
        `Failed to capture performance data for action '${actionDef.id}': ${error.message}`
      );
    }
  }
}

export default MultiTargetResolutionStage;
