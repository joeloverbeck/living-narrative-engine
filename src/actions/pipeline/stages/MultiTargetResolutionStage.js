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

    trace?.step(
      `Resolving targets for ${candidateActions.length} candidate actions`,
      'MultiTargetResolutionStage'
    );

    const allActionsWithTargets = [];
    const errors = [];
    let lastResolvedTargets = null;
    let lastTargetDefinitions = null;
    let allTargetContexts = [];
    let hasLegacyActions = false;
    let hasMultiTargetActions = false;

    // Process each candidate action
    for (const actionDef of candidateActions) {
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
        if (this.#legacyLayer.isLegacyAction(actionDef)) {
          hasLegacyActions = true;
          const result = await this.#resolveLegacyTarget(
            actionProcessContext,
            trace
          );
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
        const errorMessage = error.scopeName
          ? `Scope resolution failed for '${error.scopeName}': ${error.message}`
          : error.message;

        this.#logger.error(
          `Error resolving targets for action '${actionDef.id}':`,
          error
        );
        errors.push({
          error: errorMessage,
          phase: 'target_resolution',
          actionId: actionDef.id,
          stage: 'MultiTargetResolutionStage',
          scopeName: error.scopeName,
        });
      }
    }

    trace?.info(
      `Target resolution completed: ${allActionsWithTargets.length} actions with targets`,
      'MultiTargetResolutionStage'
    );

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

    // Use legacy compatibility layer to get the scope
    const conversionResult = this.#legacyLayer.convertLegacyFormat(
      actionDef,
      actor
    );
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
              primary: { scope: scope, placeholder: 'target' },
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
          error: error.message,
          phase: 'target_resolution',
          actionId: actionDef.id,
          stage: 'MultiTargetResolutionStage',
        },
        { ...context.data, error: error.message }
      );
    }

    trace?.info(
      `Target resolution order: ${resolutionOrder.join(', ')}`,
      'MultiTargetResolutionStage'
    );

    // Resolve targets sequentially
    const resolvedTargets = {};
    const allTargetContexts = []; // For backward compatibility

    for (const targetKey of resolutionOrder) {
      const targetDef = targetDefs[targetKey];

      trace?.step(
        `Resolving ${targetKey} target`,
        'MultiTargetResolutionStage'
      );

      // Check if this target depends on another target's context
      if (targetDef.contextFrom && resolvedTargets[targetDef.contextFrom]) {
        // Resolve this target for each instance of the contextFrom target
        const primaryTargets = resolvedTargets[targetDef.contextFrom];
        const resolvedSecondaryTargets = [];

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

        // Check if target is required and we found no candidates for any primary
        if (!targetDef.optional && resolvedSecondaryTargets.length === 0) {
          trace?.failure(
            `No candidates found for required target '${targetKey}'`,
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

        resolvedTargets[targetKey] = resolvedSecondaryTargets;

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

        // Check if target is required
        if (!targetDef.optional && candidates.length === 0) {
          trace?.failure(
            `No candidates found for required target '${targetKey}'`,
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

    // Check if we have at least one valid target
    const hasTargets = Object.values(resolvedTargets).some(
      (targets) => targets.length > 0
    );

    if (!hasTargets) {
      return PipelineResult.success({
        data: {
          ...context.data,
          actionsWithTargets: [],
        },
        continueProcessing: false,
      });
    }

    return PipelineResult.success({
      data: {
        ...context.data,
        resolvedTargets,
        targetContexts: allTargetContexts, // Backward compatibility
        targetDefinitions: targetDefs, // Pass definitions for formatting
        actionsWithTargets: [
          {
            actionDef,
            targetContexts: allTargetContexts,
          },
        ],
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
            ? errorDetails[0].message
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

      // Convert Set to array of entity IDs
      const entityIds = Array.from(result.value);

      trace?.info(
        `Scope resolved to ${entityIds.length} entities`,
        'MultiTargetResolutionStage'
      );

      return entityIds;
    } catch (error) {
      this.#logger.error(`Error evaluating scope '${scope}':`, error);
      trace?.failure(
        `Scope evaluation failed: ${error.message}`,
        'MultiTargetResolutionStage'
      );
      return [];
    }
  }
}

export default MultiTargetResolutionStage;
