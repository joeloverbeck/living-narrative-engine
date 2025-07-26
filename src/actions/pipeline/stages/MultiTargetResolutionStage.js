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
          const result = await this.#resolveLegacyTarget(
            actionProcessContext,
            trace
          );
          if (result.success && result.data.actionsWithTargets) {
            allActionsWithTargets.push(...result.data.actionsWithTargets);
          }
        } else {
          // Resolve multi-target action
          const result = await this.#resolveMultiTargets(
            actionProcessContext,
            trace
          );
          if (result.success && result.data.actionsWithTargets) {
            allActionsWithTargets.push(...result.data.actionsWithTargets);
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

    return PipelineResult.success({
      data: {
        ...context.data,
        actionsWithTargets: allActionsWithTargets,
      },
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

          return {
            id: entityId,
            displayName: this.#getEntityDisplayName(entityId),
            entity,
          };
        })
        .filter(Boolean); // Remove null entries

      // Add to flat list for backward compatibility
      resolvedTargets[targetKey].forEach((target) => {
        allTargetContexts.push({
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
        actor.getComponent('core:position')?.locationId
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
   * Resolve a scope expression to entity IDs
   *
   * @param scope
   * @param context
   * @param trace
   * @private
   */
  async #resolveScope(scope, context, trace) {
    try {
      trace?.step(`Evaluating scope '${scope}'`, 'MultiTargetResolutionStage');

      // Create resolution context for UnifiedScopeResolver
      const resolutionContext = {
        actor: context.actor,
        actorLocation: context.location?.id || 'unknown',
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
        entity.getComponent('core:description')?.name ||
        entity.getComponent('core:actor')?.name ||
        entity.getComponent('core:item')?.name ||
        entityId;

      return name;
    } catch (error) {
      return entityId;
    }
  }
}

export default MultiTargetResolutionStage;
