/**
 * @file Stage for filtering actions based on actor components
 * @see ../PipelineStage.js
 */

import { PipelineStage } from '../PipelineStage.js';
import { PipelineResult } from '../PipelineResult.js';

/** @typedef {import('../../actionIndex.js').ActionIndex} ActionIndex */
/** @typedef {import('../../../logging/consoleLogger.js').default} ILogger */
/** @typedef {import('../../errors/actionErrorContextBuilder.js').ActionErrorContextBuilder} ActionErrorContextBuilder */

/**
 * @class ComponentFilteringStage
 * @augments PipelineStage
 * @description Filters candidate actions based on actor component requirements
 */
export class ComponentFilteringStage extends PipelineStage {
  #actionIndex;
  #errorContextBuilder;
  #logger;

  /**
   * Creates a ComponentFilteringStage instance
   *
   * @param {ActionIndex} actionIndex - The action index for candidate actions
   * @param {ActionErrorContextBuilder} errorContextBuilder - Builder for error contexts
   * @param {ILogger} logger - Logger for diagnostic output
   */
  constructor(actionIndex, errorContextBuilder, logger) {
    super('ComponentFiltering');
    this.#actionIndex = actionIndex;
    this.#errorContextBuilder = errorContextBuilder;
    this.#logger = logger;
  }

  /**
   * Internal execution of the component filtering stage
   *
   * @param {object} context - The pipeline context
   * @param {import('../../../entities/entity.js').default} context.actor - The actor entity
   * @param {import('../../tracing/traceContext.js').TraceContext|import('../../tracing/structuredTrace.js').StructuredTrace} [context.trace] - Optional trace context
   * @returns {Promise<PipelineResult>} The filtered candidate actions
   */
  async executeInternal(context) {
    const { actor, trace } = context;
    const source = `${this.name}Stage.execute`;

    trace?.step(
      `Filtering actions for actor ${actor.id} based on components`,
      source
    );

    try {
      // Get candidate actions from the index
      const candidateActions = this.#actionIndex.getCandidateActions(
        actor,
        trace
      );

      this.#logger.debug(
        `Found ${candidateActions.length} candidate actions for actor ${actor.id}`
      );

      if (candidateActions.length === 0) {
        trace?.info('No candidate actions found for actor', source);
        return PipelineResult.success({
          data: { candidateActions: [] },
          continueProcessing: false, // No point continuing if no candidates
        });
      }

      trace?.success(
        `Component filtering completed: ${candidateActions.length} candidates`,
        source,
        { candidateCount: candidateActions.length }
      );

      return PipelineResult.success({
        data: { candidateActions },
      });
    } catch (error) {
      // Build error context using the error context builder
      const errorContext = this.#errorContextBuilder.buildErrorContext({
        error,
        actionDef: { id: 'candidateRetrieval', name: 'Candidate Retrieval' },
        actorId: actor.id,
        phase: 'discovery',
        trace,
        additionalContext: {
          stage: 'component_filtering',
        },
      });

      this.#logger.error(
        `Error retrieving candidate actions: ${error.message}`,
        error
      );

      return PipelineResult.failure([errorContext]);
    }
  }
}

export default ComponentFilteringStage;
