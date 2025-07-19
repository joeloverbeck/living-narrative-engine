/**
 * @file Adapter to integrate ActionResult-based target resolution with legacy interfaces
 */

import { TargetResolutionServiceWithResult } from '../targetResolutionServiceWithResult.js';

/**
 * Adapter that wraps TargetResolutionServiceWithResult to provide
 * backward compatibility with the original TargetResolutionService interface.
 *
 * This allows gradual migration to the Result pattern without breaking existing code.
 */
export class TargetResolutionAdapter {
  #innerService;

  /**
   * Creates an instance of TargetResolutionAdapter.
   *
   * @param {object} deps - Constructor dependencies (same as TargetResolutionService).
   */
  constructor(deps) {
    this.#innerService = new TargetResolutionServiceWithResult(deps);
  }

  /**
   * Resolves targets using the original interface.
   * Internally uses ActionResult but converts back to legacy format.
   *
   * @param {string} scopeName - The name of the scope to resolve.
   * @param {import('../../entities/entity.js').default} actorEntity - The entity performing the action.
   * @param {import('../actionTypes.js').ActionContext} discoveryContext - Context for DSL evaluation.
   * @param {import('../tracing/traceContext.js').TraceContext|null} [trace] - Optional tracing instance.
   * @param {string} [actionId] - Optional action ID for error context.
   * @returns {import('../resolutionResult.js').ResolutionResult} Resolved targets and optional error.
   */
  resolveTargets(
    scopeName,
    actorEntity,
    discoveryContext,
    trace = null,
    actionId = null
  ) {
    // The inner service already has a resolveTargets method that maintains compatibility
    return this.#innerService.resolveTargets(
      scopeName,
      actorEntity,
      discoveryContext,
      trace,
      actionId
    );
  }

  /**
   * Resolves targets using the new ActionResult interface.
   * This method can be used by code that has been migrated to use ActionResult.
   *
   * @param {string} scopeName - The name of the scope to resolve.
   * @param {import('../../entities/entity.js').default} actorEntity - The entity performing the action.
   * @param {import('../actionTypes.js').ActionContext} discoveryContext - Context for DSL evaluation.
   * @param {import('../tracing/traceContext.js').TraceContext|null} [trace] - Optional tracing instance.
   * @param {string} [actionId] - Optional action ID for error context.
   * @returns {import('../core/actionResult.js').ActionResult<import('../../models/actionTargetContext.js').ActionTargetContext[]>} Result containing resolved targets or errors.
   */
  resolveTargetsWithResult(
    scopeName,
    actorEntity,
    discoveryContext,
    trace = null,
    actionId = null
  ) {
    return this.#innerService.resolveTargetsWithResult(
      scopeName,
      actorEntity,
      discoveryContext,
      trace,
      actionId
    );
  }
}

export default TargetResolutionAdapter;
