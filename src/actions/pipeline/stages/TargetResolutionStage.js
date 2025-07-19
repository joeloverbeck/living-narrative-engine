/**
 * @file Stage for resolving action targets
 * @see ../PipelineStage.js
 */

import { PipelineStage } from '../PipelineStage.js';
import { PipelineResult } from '../PipelineResult.js';
import { ERROR_PHASES } from '../../errors/actionErrorTypes.js';

/** @typedef {import('../../../interfaces/ITargetResolutionService.js').ITargetResolutionService} ITargetResolutionService */
/** @typedef {import('../../errors/actionErrorContextBuilder.js').ActionErrorContextBuilder} ActionErrorContextBuilder */
/** @typedef {import('../../../logging/consoleLogger.js').default} ILogger */

/**
 * @class TargetResolutionStage
 * @augments PipelineStage
 * @description Resolves targets for each candidate action based on their scope
 */
export class TargetResolutionStage extends PipelineStage {
  #targetResolutionService;
  #errorContextBuilder;
  #logger;

  /**
   * Creates a TargetResolutionStage instance
   *
   * @param {ITargetResolutionService} targetResolutionService - Service for resolving targets
   * @param {ActionErrorContextBuilder} errorContextBuilder - Builder for error contexts
   * @param {ILogger} logger - Logger for diagnostic output
   */
  constructor(targetResolutionService, errorContextBuilder, logger) {
    super('TargetResolution');
    this.#targetResolutionService = targetResolutionService;
    this.#errorContextBuilder = errorContextBuilder;
    this.#logger = logger;
  }

  /**
   * Executes the target resolution stage
   *
   * @param {object} context - The pipeline context
   * @param {import('../../../entities/entity.js').default} context.actor - The actor entity
   * @param {import('../../../interfaces/IGameDataRepository.js').ActionDefinition[]} context.candidateActions - Candidate actions
   * @param {import('../../actionTypes.js').ActionContext} context.actionContext - The action context
   * @param {import('../../tracing/traceContext.js').TraceContext} [context.trace] - Optional trace context
   * @returns {Promise<PipelineResult>} Actions with resolved targets
   */
  async execute(context) {
    const { actor, candidateActions, actionContext, trace } = context;
    const source = `${this.name}Stage.execute`;

    // Debug: log everything we receive
    this.#logger.debug(
      `TargetResolutionStage context keys: ${Object.keys(context).join(', ')}`,
      { 
        candidateActionsType: typeof candidateActions,
        candidateActionsIsArray: Array.isArray(candidateActions),
        candidateActionsLength: candidateActions?.length,
        contextKeys: Object.keys(context)
      }
    );

    // Guard against null/undefined candidateActions
    if (!candidateActions || !Array.isArray(candidateActions)) {
      this.#logger.warn(
        `TargetResolutionStage received invalid candidateActions: ${candidateActions}`,
        { context: Object.keys(context) }
      );
      return PipelineResult.success({
        data: { actionsWithTargets: [] },
        errors: [],
      });
    }

    this.#logger.debug(
      `TargetResolutionStage received ${candidateActions.length} candidate actions`,
      { candidateActionIds: candidateActions.map(a => a?.id || 'null-action') }
    );

    trace?.step(
      `Resolving targets for ${candidateActions.length} candidate actions`,
      source
    );

    const actionsWithTargets = [];
    const errors = [];

    // Process each candidate action
    for (const actionDef of candidateActions) {
      // Guard against null/undefined actions
      if (!actionDef) {
        this.#logger.warn('Skipping null action definition in candidateActions');
        continue;
      }
      // Handle 'none' scope actions specially - they don't need target resolution
      if (actionDef.scope === 'none') {
        trace?.info(
          `Action '${actionDef.id}' has 'none' scope - no target resolution needed`,
          source
        );

        // Create a special "no-target" context for formatting stage
        actionsWithTargets.push({
          actionDef,
          targetContexts: [{ entityId: null, entity: null }],
        });
        continue;
      }

      let targetContexts, resolutionError;
      
      try {
        const result = this.#targetResolutionService.resolveTargets(
          actionDef.scope,
          actor,
          actionContext,
          trace
        );
        targetContexts = result.targets;
        resolutionError = result.error;
      } catch (error) {
        this.#logger.error(
          `Exception in targetResolutionService for action '${actionDef?.id || 'unknown'}': ${error.message}`,
          { actionDef, error }
        );
        resolutionError = error;
        targetContexts = [];
      }

      if (resolutionError) {
        // Build error context
        const errorContext = this.#errorContextBuilder.buildErrorContext({
          error: resolutionError,
          actionDef,
          actorId: actor.id,
          phase: ERROR_PHASES.VALIDATION,
          trace,
          additionalContext: {
            stage: 'target_resolution',
            scope: actionDef.scope,
          },
        });

        errors.push(errorContext);

        this.#logger.error(
          `Error resolving scope for action '${actionDef.id}': ${resolutionError.message}`,
          errorContext
        );
        continue;
      }

      if (targetContexts.length === 0) {
        this.#logger.debug(
          `Action '${actionDef.id}' resolved to 0 targets. Skipping.`
        );
        trace?.info(`Action '${actionDef.id}' has no valid targets`, source);
        continue;
      }

      trace?.info(
        `Action '${actionDef.id}' resolved to ${targetContexts.length} targets`,
        source,
        { targetCount: targetContexts.length }
      );

      // Store the action with its resolved targets
      actionsWithTargets.push({
        actionDef,
        targetContexts,
      });
    }

    this.#logger.debug(
      `Target resolution complete: ${actionsWithTargets.length} actions have valid targets`
    );

    trace?.info(
      `Target resolution completed: ${actionsWithTargets.length} actions with targets, ${errors.length} errors`,
      source
    );

    return PipelineResult.success({
      data: { actionsWithTargets },
      errors,
    });
  }
}

export default TargetResolutionStage;
