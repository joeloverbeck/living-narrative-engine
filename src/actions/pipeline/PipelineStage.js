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
   * Executes this stage of the pipeline with optional span wrapping
   *
   * @param {object} context - The pipeline context containing all data
   * @param {import('../../entities/entity.js').default} context.actor - The actor entity
   * @param {import('../actionTypes.js').ActionContext} context.actionContext - The action context
   * @param {import('../../interfaces/IGameDataRepository.js').ActionDefinition[]} context.candidateActions - Candidate action definitions
   * @param {import('../tracing/traceContext.js').TraceContext|import('../tracing/structuredTrace.js').StructuredTrace} [context.trace] - Optional trace context
   * @returns {Promise<import('./PipelineResult.js').PipelineResult>} The result of this stage
   */
  async execute(context) {
    const { trace } = context;

    // If trace supports structured spans, wrap execution
    if (trace?.withSpanAsync) {
      return trace.withSpanAsync(
        `${this.name}Stage`,
        async () => {
          return this.executeInternal(context);
        },
        { stage: this.name }
      );
    }

    // Otherwise, execute directly
    return this.executeInternal(context);
  }

  /**
   * Internal execution method that derived classes must implement
   *
   * @abstract
   * @param {object} context - The pipeline context containing all data
   * @param {import('../../entities/entity.js').default} context.actor - The actor entity
   * @param {import('../actionTypes.js').ActionContext} context.actionContext - The action context
   * @param {import('../../interfaces/IGameDataRepository.js').ActionDefinition[]} context.candidateActions - Candidate action definitions
   * @param {import('../tracing/traceContext.js').TraceContext|import('../tracing/structuredTrace.js').StructuredTrace} [context.trace] - Optional trace context
   * @returns {Promise<import('./PipelineResult.js').PipelineResult>} The result of this stage
   */
  async executeInternal(context) {
    throw new Error(`Stage ${this.name} must implement executeInternal() method`);
  }
}

export default PipelineStage;
