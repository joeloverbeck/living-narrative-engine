/**
 * @file Stage for evaluating action prerequisites
 * @see ../PipelineStage.js
 */

import { PipelineStage } from '../PipelineStage.js';
import { PipelineResult } from '../PipelineResult.js';
import { ERROR_PHASES } from '../../errors/actionErrorTypes.js';

/** @typedef {import('../../validation/prerequisiteEvaluationService.js').PrerequisiteEvaluationService} PrerequisiteEvaluationService */
/** @typedef {import('../../errors/actionErrorContextBuilder.js').ActionErrorContextBuilder} ActionErrorContextBuilder */
/** @typedef {import('../../../logging/consoleLogger.js').default} ILogger */

/**
 * @class PrerequisiteEvaluationStage
 * @augments PipelineStage
 * @description Evaluates prerequisites for each candidate action
 */
export class PrerequisiteEvaluationStage extends PipelineStage {
  #prerequisiteService;
  #errorContextBuilder;
  #logger;

  /**
   * Creates a PrerequisiteEvaluationStage instance
   *
   * @param {PrerequisiteEvaluationService} prerequisiteService - Service for evaluating prerequisites
   * @param {ActionErrorContextBuilder} errorContextBuilder - Builder for error contexts
   * @param {ILogger} logger - Logger for diagnostic output
   */
  constructor(prerequisiteService, errorContextBuilder, logger) {
    super('PrerequisiteEvaluation');
    this.#prerequisiteService = prerequisiteService;
    this.#errorContextBuilder = errorContextBuilder;
    this.#logger = logger;
  }

  /**
   * Internal execution of the prerequisite evaluation stage
   *
   * @param {object} context - The pipeline context
   * @param {import('../../../entities/entity.js').default} context.actor - The actor entity
   * @param {import('../../../interfaces/IGameDataRepository.js').ActionDefinition[]} context.candidateActions - Candidate actions
   * @param {import('../../tracing/traceContext.js').TraceContext|import('../../tracing/structuredTrace.js').StructuredTrace} [context.trace] - Optional trace context
   * @returns {Promise<PipelineResult>} Actions that passed prerequisites
   */
  async executeInternal(context) {
    const { actor, candidateActions, trace } = context;
    const source = `${this.name}Stage.execute`;

    trace?.step(
      `Evaluating prerequisites for ${candidateActions.length} candidate actions`,
      source
    );

    const validActions = [];
    const errors = [];

    // Process each candidate action
    for (const actionDef of candidateActions) {
      try {
        // Skip if no prerequisites
        if (!actionDef.prerequisites || actionDef.prerequisites.length === 0) {
          validActions.push(actionDef);
          continue;
        }

        // Evaluate prerequisites
        const meetsPrereqs = this.#prerequisiteService.evaluate(
          actionDef.prerequisites,
          actionDef,
          actor,
          trace
        );

        if (meetsPrereqs) {
          validActions.push(actionDef);
          trace?.success(
            `Action '${actionDef.id}' passed prerequisite check`,
            source
          );
        } else {
          trace?.info(
            `Action '${actionDef.id}' failed prerequisite check`,
            source
          );
        }
      } catch (error) {
        // Build error context
        const errorContext = this.#errorContextBuilder.buildErrorContext({
          error,
          actionDef,
          actorId: actor.id,
          phase: ERROR_PHASES.VALIDATION,
          trace,
          additionalContext: {
            stage: 'prerequisite_evaluation',
          },
        });

        errors.push(errorContext);

        this.#logger.error(
          `Error checking prerequisites for action '${actionDef.id}': ${error.message}`,
          errorContext
        );
      }
    }

    this.#logger.debug(
      `Prerequisite evaluation complete: ${validActions.length}/${candidateActions.length} actions passed`
    );

    trace?.info(
      `Prerequisite evaluation completed: ${validActions.length} valid actions, ${errors.length} errors`,
      source
    );

    // Continue processing even if some actions failed prerequisites
    return PipelineResult.success({
      data: {
        candidateActions: validActions,
        prerequisiteErrors: errors,
      },
      errors,
    });
  }
}

export default PrerequisiteEvaluationStage;
