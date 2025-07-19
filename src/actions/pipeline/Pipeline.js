/**
 * @file Pipeline executor for action discovery
 * @see PipelineStage.js
 */

import { PipelineResult } from './PipelineResult.js';

/** @typedef {import('./PipelineStage.js').PipelineStage} PipelineStage */
/** @typedef {import('../tracing/traceContext.js').TraceContext} TraceContext */
/** @typedef {import('../../logging/consoleLogger.js').default} ILogger */

/**
 * @class Pipeline
 * @description Executes a series of stages for action discovery
 */
export class Pipeline {
  #stages;
  #logger;

  /**
   * Creates a Pipeline instance
   *
   * @param {PipelineStage[]} stages - The stages to execute in order
   * @param {ILogger} logger - Logger for diagnostic output
   */
  constructor(stages, logger) {
    if (!Array.isArray(stages) || stages.length === 0) {
      throw new Error('Pipeline requires at least one stage');
    }
    this.#stages = stages;
    this.#logger = logger;
  }

  /**
   * Executes the pipeline
   *
   * @param {object} initialContext - Initial context for the pipeline
   * @param {import('../../entities/entity.js').default} initialContext.actor - The actor entity
   * @param {import('../actionTypes.js').ActionContext} initialContext.actionContext - The action context
   * @param {import('../../interfaces/IGameDataRepository.js').ActionDefinition[]} initialContext.candidateActions - Candidate actions
   * @param {TraceContext} [initialContext.trace] - Optional trace context
   * @returns {Promise<PipelineResult>} The final result after all stages
   */
  async execute(initialContext) {
    const source = 'Pipeline.execute';
    const { trace } = initialContext;

    trace?.info(
      `Starting pipeline execution with ${this.#stages.length} stages`,
      source
    );

    let context = { ...initialContext };
    let cumulativeResult = PipelineResult.success();

    for (const stage of this.#stages) {
      this.#logger.debug(`Executing pipeline stage: ${stage.name}`);
      trace?.step(`Executing stage: ${stage.name}`, source);

      try {
        const stageResult = await stage.execute(context);

        // Merge results
        cumulativeResult = cumulativeResult.merge(stageResult);

        // Update context with stage data
        context = {
          ...context,
          ...stageResult.data,
          actions: cumulativeResult.actions,
          errors: cumulativeResult.errors,
        };

        if (!stageResult.continueProcessing) {
          this.#logger.debug(
            `Stage ${stage.name} indicated to stop processing`
          );
          trace?.info(`Pipeline halted at stage: ${stage.name}`, source);
          break;
        }

        if (!stageResult.success) {
          this.#logger.warn(`Stage ${stage.name} completed with errors`);
          trace?.failure(`Stage ${stage.name} encountered errors`, source);
        } else {
          trace?.success(`Stage ${stage.name} completed successfully`, source);
        }
      } catch (error) {
        this.#logger.error(
          `Pipeline stage ${stage.name} threw an error: ${error.message}`,
          error
        );
        trace?.failure(
          `Stage ${stage.name} threw an error: ${error.message}`,
          source
        );

        // Create an error result and stop processing
        const errorResult = PipelineResult.failure([
          {
            error: error.message,
            phase: 'PIPELINE_EXECUTION',
            stageName: stage.name,
            context: { error: error.stack },
          },
        ]);

        return cumulativeResult.merge(errorResult);
      }
    }

    trace?.info(
      `Pipeline execution completed. Actions: ${cumulativeResult.actions.length}, Errors: ${cumulativeResult.errors.length}`,
      source
    );
    return cumulativeResult;
  }
}

export default Pipeline;
