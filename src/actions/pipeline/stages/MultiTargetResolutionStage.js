/**
 * @file MultiTargetResolutionStage - Pipeline stage for resolving multi-target actions
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
 * Pipeline stage that resolves action targets using scope DSL
 * Supports both single-target (legacy) and multi-target actions
 */
export class MultiTargetResolutionStage extends PipelineStage {
  #unifiedScopeResolver;
  #entityManager;
  #targetResolver;
  #contextBuilder;
  #logger;

  /**
   * @param {object} deps
   * @param {UnifiedScopeResolver} deps.unifiedScopeResolver
   * @param {IEntityManager} deps.entityManager
   * @param {ITargetResolutionService} deps.targetResolver
   * @param {TargetContextBuilder} deps.targetContextBuilder
   * @param {ILogger} deps.logger
   */
  constructor({
    unifiedScopeResolver,
    entityManager,
    targetResolver,
    targetContextBuilder,
    logger,
  }) {
    super('MultiTargetResolution');
    validateDependency(unifiedScopeResolver, 'IUnifiedScopeResolver');
    validateDependency(entityManager, 'IEntityManager');
    validateDependency(targetResolver, 'ITargetResolutionService');
    validateDependency(targetContextBuilder, 'ITargetContextBuilder');
    validateDependency(logger, 'ILogger');

    this.#unifiedScopeResolver = unifiedScopeResolver;
    this.#entityManager = entityManager;
    this.#targetResolver = targetResolver;
    this.#contextBuilder = targetContextBuilder;
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
        if (this.#isLegacyAction(actionDef)) {
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
        this.#logger.error(
          `Error resolving targets for action '${actionDef.id}':`,
          error
        );
        errors.push({
          error: error.message,
          phase: 'target_resolution',
          actionId: actionDef.id,
          stage: 'MultiTargetResolutionStage',
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
   * Check if action uses legacy single-target format
   *
   * @param actionDef
   * @private
   */
  #isLegacyAction(actionDef) {
    return (
      typeof actionDef.targets === 'string' ||
      (actionDef.scope && !actionDef.targets)
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
    const scope = actionDef.targets || actionDef.scope;

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
        displayName: tc.displayName || tc.entityId,
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
            targetDefinitions: {
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
      resolutionOrder = this.#getResolutionOrder(targetDefs);
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
          const specificContext = this.#buildScopeContextForSpecificPrimary(
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

            const displayName = this.#getEntityDisplayName(entityId);

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
        const scopeContext = this.#buildScopeContext(
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
            if (!entity) return null; // Filter out missing entities

            const displayName = this.#getEntityDisplayName(entityId);

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
   * Determine target resolution order based on dependencies
   *
   * @param targetDefs
   * @private
   */
  #getResolutionOrder(targetDefs) {
    const order = [];
    const pending = new Set(Object.keys(targetDefs));
    const maxIterations = pending.size * 2; // Prevent infinite loops
    let iterations = 0;

    while (pending.size > 0 && iterations < maxIterations) {
      iterations++;

      // Find targets with no unresolved dependencies
      const ready = Array.from(pending).filter((key) => {
        const targetDef = targetDefs[key];

        // No dependencies
        if (!targetDef.contextFrom) return true;

        // Dependency already resolved
        return order.includes(targetDef.contextFrom);
      });

      if (ready.length === 0) {
        // Circular dependency or invalid reference
        const remaining = Array.from(pending);
        throw new Error(
          `Circular dependency detected in target resolution: ${remaining.join(', ')}`
        );
      }

      // Add ready targets to order
      ready.forEach((key) => {
        order.push(key);
        pending.delete(key);
      });
    }

    return order;
  }

  /**
   * Build scope evaluation context
   *
   * @param actor
   * @param actionContext
   * @param resolvedTargets
   * @param targetDef
   * @param trace
   * @private
   */
  #buildScopeContext(actor, actionContext, resolvedTargets, targetDef, trace) {
    // Start with base context
    const baseContext = this.#contextBuilder.buildBaseContext(
      actor.id,
      actionContext.location?.id ||
        actor.getComponentData('core:position')?.locationId
    );

    // Add resolved targets if this is a dependent target
    if (targetDef.contextFrom || Object.keys(resolvedTargets).length > 0) {
      return this.#contextBuilder.buildDependentContext(
        baseContext,
        resolvedTargets,
        targetDef
      );
    }

    return baseContext;
  }

  /**
   * Build scope evaluation context for a specific primary target
   *
   * @param actor
   * @param actionContext
   * @param resolvedTargets
   * @param specificPrimary
   * @param targetDef
   * @param trace
   * @private
   */
  #buildScopeContextForSpecificPrimary(
    actor,
    actionContext,
    resolvedTargets,
    specificPrimary,
    targetDef,
    trace
  ) {
    // Start with base context - same approach as #buildScopeContext
    const baseContext = this.#contextBuilder.buildBaseContext(
      actor.id,
      actionContext.location?.id ||
        actor.getComponentData('core:position')?.locationId
    );

    // Add resolved targets
    baseContext.targets = { ...resolvedTargets };

    // Add specific primary as 'target' for dependent scope evaluation
    if (specificPrimary) {
      // Build entity context for the specific primary using same pattern
      try {
        const entity = this.#entityManager.getEntityInstance(
          specificPrimary.id
        );
        if (entity) {
          baseContext.target = {
            id: entity.id,
            components: entity.getAllComponents
              ? entity.getAllComponents()
              : {},
          };
        }
      } catch (error) {
        this.#logger.error(
          `Failed to build target context for ${specificPrimary.id}:`,
          error
        );
      }
    }

    return baseContext;
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
      // Pass the full actor entity object to maintain consistency with legacy path
      const resolutionContext = {
        ...context, // Include all fields from the scope context
        actor, // Pass full entity object like legacy path - this overrides context.actor
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
        this.#logger.error(
          `Failed to resolve scope '${scope}':`,
          result.errors
        );
        return [];
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

  /**
   * Get display name for an entity
   *
   * @param entityId
   * @private
   */
  #getEntityDisplayName(entityId) {
    try {
      const entity = this.#entityManager.getEntityInstance(entityId);
      if (!entity) return entityId;

      // Try common name sources
      const name =
        entity.getComponentData('core:name')?.text ||
        entity.getComponentData('core:description')?.name ||
        entity.getComponentData('core:actor')?.name ||
        entity.getComponentData('core:item')?.name ||
        entityId;

      return name;
    } catch (error) {
      return entityId;
    }
  }
}

export default MultiTargetResolutionStage;
