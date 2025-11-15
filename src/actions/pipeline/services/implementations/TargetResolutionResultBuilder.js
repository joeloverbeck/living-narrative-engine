import { validateDependency } from '../../../../utils/dependencyUtils.js';
import { PipelineResult } from '../../PipelineResult.js';

/** @typedef {import('../interfaces/ITargetResolutionResultBuilder.js').ActionWithTargets} ActionWithTargets */
/** @typedef {import('../interfaces/ITargetResolutionResultBuilder.js').DetailedResolutionResults} DetailedResolutionResults */
/** @typedef {import('../interfaces/ITargetResolutionResultBuilder.js').PipelineContext} BuilderPipelineContext */

/**
 * @class TargetResolutionResultBuilder
 * @description Concrete implementation responsible for consolidating all result
 * assembly logic for the multi-target resolution stage. Ensures backward
 * compatibility and consistent metadata formatting for legacy and
 * multi-target flows.
 */
export default class TargetResolutionResultBuilder {
  #entityManager;
  #logger;

  /**
   * @param {object} deps - Service dependencies.
   * @param {import('../../../../interfaces/coreServices.js').IEntityManager} deps.entityManager
   * @param {import('../../../../interfaces/coreServices.js').ILogger} deps.logger
   */
  constructor({ entityManager, logger }) {
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityInstance'],
    });
    validateDependency(logger, 'ILogger', logger);

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * @description Build result payload for legacy single-target actions.
   * @param {BuilderPipelineContext} context - Pipeline execution context.
   * @param {object} resolvedTargets - Resolved targets derived from legacy scopes.
   * @param {Array} targetContexts - Target contexts preserved for compatibility.
   * @param {object} conversionResult - Legacy conversion result containing target definitions.
   * @param {import('../../actionTypes.js').ActionDefinition} actionDef - Action definition metadata.
   * @returns {PipelineResult}
   */
  buildLegacyResult(
    context,
    resolvedTargets,
    targetContexts,
    conversionResult,
    actionDef
  ) {
    const targetDefinitions =
      conversionResult?.targetDefinitions ||
      this.#buildLegacyFallbackDefinitions(conversionResult, actionDef);

    const legacyAction = {
      actionDef,
      targetContexts,
    };

    this.attachMetadata(
      legacyAction,
      resolvedTargets,
      targetDefinitions,
      false
    );

    return PipelineResult.success({
      data: {
        ...context.data,
        resolvedTargets,
        targetContexts,
        actionsWithTargets: [legacyAction],
      },
    });
  }

  /**
   * @description Build result payload for multi-target actions.
   * @param {BuilderPipelineContext} context - Pipeline execution context.
   * @param {object} resolvedTargets - Resolved targets map keyed by target key.
   * @param {Array} targetContexts - Flattened target contexts.
   * @param {object} targetDefinitions - Target definition metadata.
   * @param {import('../../actionTypes.js').ActionDefinition} actionDef - Action definition metadata.
   * @param {DetailedResolutionResults|undefined} detailedResults - Optional detailed resolution diagnostics.
   * @returns {PipelineResult}
   */
  buildMultiTargetResult(
    context,
    resolvedTargets,
    targetContexts,
    targetDefinitions,
    actionDef,
    detailedResults
  ) {
    actionDef.resolvedTargets = resolvedTargets;
    actionDef.targetDefinitions = targetDefinitions;
    actionDef.isMultiTarget = true;

    const multiTargetAction = {
      actionDef,
      targetContexts,
    };

    this.attachMetadata(
      multiTargetAction,
      resolvedTargets,
      targetDefinitions,
      true
    );

    return PipelineResult.success({
      data: {
        ...context.data,
        resolvedTargets,
        targetContexts,
        targetDefinitions,
        detailedResolutionResults: detailedResults || {},
        actionsWithTargets: [multiTargetAction],
      },
    });
  }

  /**
   * @description Build the final aggregated pipeline result.
   * @param {BuilderPipelineContext} context - Pipeline execution context.
   * @param {Array<ActionWithTargets>} allActionsWithTargets - Aggregated action results.
   * @param {Array} allTargetContexts - All collected target contexts.
   * @param {object|null} lastResolvedTargets - Last resolved targets map.
   * @param {object|null} lastTargetDefinitions - Last target definitions map.
   * @param {Array<Error|object>} errors - Collected errors during processing.
   * @returns {PipelineResult}
   */
  buildFinalResult(
    context,
    allActionsWithTargets,
    allTargetContexts,
    lastResolvedTargets,
    lastTargetDefinitions,
    errors
  ) {
    const resultData = {
      ...context.data,
      actionsWithTargets: allActionsWithTargets,
    };

    if (allTargetContexts.length > 0) {
      resultData.targetContexts = allTargetContexts;
    }

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
   * @description Attach resolved target metadata to action payloads.
   * @param {ActionWithTargets} actionWithTargets - Action payload receiving metadata.
   * @param {object} resolvedTargets - Resolved targets map.
   * @param {object} targetDefinitions - Target definitions metadata.
   * @param {boolean} isMultiTarget - Indicates if source flow was multi-target.
   * @returns {void}
   */
  attachMetadata(
    actionWithTargets,
    resolvedTargets,
    targetDefinitions,
    isMultiTarget
  ) {
    if (!actionWithTargets || typeof actionWithTargets !== 'object') {
      this.#logger?.warn?.(
        'TargetResolutionResultBuilder.attachMetadata received invalid action payload'
      );
      return;
    }

    actionWithTargets.resolvedTargets = this.#hydrateEntities(resolvedTargets);
    actionWithTargets.targetDefinitions = targetDefinitions;
    actionWithTargets.isMultiTarget = isMultiTarget;
  }

  /**
   * @private
   * @description Ensure entity references exist for resolved targets.
   * @param {object} resolvedTargets - Map of resolved targets arrays.
   * @returns {object}
   */
  #hydrateEntities(resolvedTargets) {
    if (!resolvedTargets || typeof resolvedTargets !== 'object') {
      return resolvedTargets || {};
    }

    const hydratedTargets = {};

    for (const [targetKey, targets] of Object.entries(resolvedTargets)) {
      if (!Array.isArray(targets)) {
        hydratedTargets[targetKey] = targets;
        continue;
      }

      hydratedTargets[targetKey] = targets.map((target) => {
        if (!target || typeof target !== 'object') {
          return target;
        }

        if (!target.entity && target.id) {
          target.entity = this.#entityManager.getEntityInstance(target.id);
        }

        return target;
      });
    }

    return hydratedTargets;
  }

  /**
   * @private
   * @description Build fallback target definitions for legacy actions when conversion data is missing.
   * @param {object} conversionResult - Legacy conversion result.
   * @param {import('../../actionTypes.js').ActionDefinition} actionDef - Action definition metadata.
   * @returns {object}
   */
  #buildLegacyFallbackDefinitions(conversionResult, actionDef) {
    return {
      primary: {
        scope:
          conversionResult?.targetDefinitions?.primary?.scope ||
          actionDef.targets ||
          actionDef.scope,
        placeholder:
          conversionResult?.targetDefinitions?.primary?.placeholder || 'target',
      },
    };
  }
}
