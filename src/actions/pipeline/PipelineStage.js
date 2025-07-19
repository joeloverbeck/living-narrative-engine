/**
 * @file Base class for pipeline stages
 * @see Pipeline.js
 */

/**
 * @abstract
 * @class PipelineStage
 * @description Abstract base class for pipeline stages that process action discovery
 */
export class PipelineStage {
  /**
   * Creates a PipelineStage instance
   *
   * @param {string} name - The name of this stage for debugging
   */
  constructor(name) {
    if (new.target === PipelineStage) {
      throw new Error(
        'PipelineStage is an abstract class and cannot be instantiated directly'
      );
    }
    this.name = name;
  }

  /**
   * Executes this stage of the pipeline
   *
   * @abstract
   * @param {object} context - The pipeline context containing all data
   * @param {import('../../entities/entity.js').default} context.actor - The actor entity
   * @param {import('../actionTypes.js').ActionContext} context.actionContext - The action context
   * @param {import('../../interfaces/IGameDataRepository.js').ActionDefinition[]} context.candidateActions - Candidate action definitions
   * @param {import('../tracing/traceContext.js').TraceContext} [context.trace] - Optional trace context
   * @returns {Promise<import('./PipelineResult.js').PipelineResult>} The result of this stage
   */
  async execute(context) {
    throw new Error(`Stage ${this.name} must implement execute() method`);
  }
}

export default PipelineStage;
