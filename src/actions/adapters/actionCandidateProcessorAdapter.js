/**
 * @file Adapter to integrate ActionResult-based candidate processor with legacy interfaces
 */

import { ActionCandidateProcessorWithResult } from '../actionCandidateProcessorWithResult.js';

/**
 * Adapter that wraps ActionCandidateProcessorWithResult to provide
 * backward compatibility with the original ActionCandidateProcessor interface.
 *
 * This allows gradual migration to the Result pattern without breaking existing code.
 */
export class ActionCandidateProcessorAdapter {
  #innerProcessor;

  /**
   * Creates an instance of ActionCandidateProcessorAdapter.
   *
   * @param {object} deps - Constructor dependencies (same as ActionCandidateProcessor).
   */
  constructor(deps) {
    this.#innerProcessor = new ActionCandidateProcessorWithResult(deps);
  }

  /**
   * Processes a candidate action using the original interface.
   * Internally uses ActionResult but converts back to legacy format.
   *
   * @param {import('../../data/gameDataRepository.js').ActionDefinition} actionDef - The action definition to process.
   * @param {import('../../entities/entity.js').default} actorEntity - The entity performing the action.
   * @param {import('../actionTypes.js').ActionContext} context - The action discovery context.
   * @param {import('../tracing/traceContext.js').TraceContext} [trace] - Optional trace context for logging.
   * @returns {import('../actionCandidateProcessor.js').ProcessResult} Result containing valid actions and errors.
   */
  process(actionDef, actorEntity, context, trace = null) {
    // The inner processor already has a process method that maintains compatibility
    return this.#innerProcessor.process(actionDef, actorEntity, context, trace);
  }

  /**
   * Processes a candidate action using the new ActionResult interface.
   * This method can be used by code that has been migrated to use ActionResult.
   *
   * @param {import('../../data/gameDataRepository.js').ActionDefinition} actionDef - The action definition to process.
   * @param {import('../../entities/entity.js').default} actorEntity - The entity performing the action.
   * @param {import('../actionTypes.js').ActionContext} context - The action discovery context.
   * @param {import('../tracing/traceContext.js').TraceContext} [trace] - Optional trace context for logging.
   * @returns {import('../core/actionResult.js').ActionResult<import('../actionCandidateProcessorWithResult.js').ProcessResultData>} Result containing valid actions and errors.
   */
  processWithResult(actionDef, actorEntity, context, trace = null) {
    return this.#innerProcessor.processWithResult(
      actionDef,
      actorEntity,
      context,
      trace
    );
  }
}

export default ActionCandidateProcessorAdapter;
