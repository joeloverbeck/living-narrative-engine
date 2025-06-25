/** @typedef {import('../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actions/tracing/traceContext.js').TraceContext} TraceContext */

/**
 * @interface ITargetResolutionService
 * @description Defines the contract for a service that resolves a scope name into a set of valid targets.
 */
export class ITargetResolutionService {
  /**
   * Resolves a scope name and an actor context into a list of valid target contexts.
   *
   * @param {string} scopeName - The scope to resolve (e.g., 'self', 'in_view', 'none').
   * @param {Entity} actorEntity - The entity performing the action.
   * @param {ActionContext} discoveryContext - The dynamic context for the resolution.
   * @param {TraceContext} [trace] - Optional trace context for logging.
   * @returns {Promise<ActionTargetContext[]>} A list of valid target contexts.
   */
  async resolveTargets(scopeName, actorEntity, discoveryContext, trace = null) {
    throw new Error('ITargetResolutionService.resolveTargets method not implemented.');
  }
} 