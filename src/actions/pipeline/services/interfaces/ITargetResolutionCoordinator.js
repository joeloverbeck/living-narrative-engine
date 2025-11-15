/**
 * @file ITargetResolutionCoordinator - Interface describing dependency-aware target resolution coordination.
 * @see MultiTargetResolutionStage.js
 */

/** @typedef {import('../../PipelineResult.js').PipelineResult} PipelineResult */
/** @typedef {import('../../actionTypes.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../../../../entities/entity.js').default} Entity */
/** @typedef {import('../../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../../tracing/traceContext.js').TraceContext|import('../../../tracing/structuredTrace.js').StructuredTrace|import('../../../tracing/actionAwareStructuredTrace.js').default} TraceLike */
/** @typedef {import('../../../../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */

/**
 * @typedef {object} TargetDefinition
 * @property {string} scope - Scope describing the collection of candidate entities.
 * @property {string} placeholder - Placeholder identifier presented to authors.
 * @property {string} [description] - Optional descriptive text for UI display.
 * @property {string} [contextFrom] - Identifier of a previously resolved target used for dependency context.
 * @property {boolean} [optional] - Indicates whether this target may remain unresolved without failing.
 */

/** @typedef {Record<string, TargetDefinition>} TargetDefinitions */

/**
 * @typedef {object} ResolvedTarget
 * @property {string} id - Identifier of the resolved entity.
 * @property {string} displayName - Display name of the resolved entity.
 * @property {Entity} entity - Entity reference returned from the resolver.
 * @property {string} [contextFromId] - Identifier of the primary target used as dependency context.
 */

/**
 * @typedef {object} DetailedResolutionResult
 * @property {string} scopeId - Scope identifier being evaluated.
 * @property {string|null} contextFrom - `contextFrom` key if the scope depends on another target.
 * @property {number} candidatesFound - Count of candidates discovered during evaluation.
 * @property {number} candidatesResolved - Count of candidates successfully resolved.
 * @property {number} evaluationTimeMs - Time in milliseconds spent resolving the scope.
 * @property {string|null} failureReason - Failure reason when the scope cannot be resolved.
 * @property {Array<string>} [contextEntityIds] - Optional identifiers of context entities considered.
 */

/**
 * @typedef {object} ResolutionComputation
 * @property {Record<string, Array<ResolvedTarget>>} resolvedTargets - All resolved targets grouped by target key.
 * @property {Array<ActionTargetContext>} targetContexts - Flattened target contexts compatible with downstream consumers.
 * @property {Record<string, DetailedResolutionResult>} detailedResults - Detailed diagnostics for each resolved scope.
 * @property {Record<string, number>} resolvedCounts - Aggregated counts of resolved targets per identifier.
 */

/**
 * @interface ITargetResolutionCoordinator
 * @description Coordinates dependency-aware target resolution for multi-target actions.
 */
export default class ITargetResolutionCoordinator {
  /**
   * @description Coordinate resolution for all targets in an action and return a PipelineResult compatible payload.
   * @param {ActionDefinition} _actionDef - Action definition currently being processed.
   * @param {Entity} _actor - Acting entity resolved from the pipeline context.
   * @param {ActionContext} _actionContext - Action context supplied by the orchestrator.
   * @param {TraceLike|undefined} [_trace] - Optional trace context for diagnostics.
   * @returns {Promise<PipelineResult>} PipelineResult containing `actionsWithTargets`, `resolvedTargets`, `targetDefinitions`,
   * `targetContexts`, and `detailedResolutionResults` for downstream consumers.
   */
  coordinateResolution(_actionDef, _actor, _actionContext, _trace) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * @description Resolve targets according to dependency order.
   * @param {TargetDefinitions} _targetDefs - Target definitions declared on the action.
   * @param {Entity} _actor - Acting entity.
   * @param {ActionContext} _actionContext - Action context forwarded from the pipeline stage.
   * @param {TraceLike|undefined} [_trace] - Optional trace context.
   * @returns {Promise<ResolutionComputation>} Aggregated resolution data used to populate the final PipelineResult payload.
   */
  resolveWithDependencies(_targetDefs, _actor, _actionContext, _trace) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * @description Resolve dependent targets (targets that specify `contextFrom`).
   * @param {string} _targetKey - Identifier of the dependent target.
   * @param {TargetDefinition} _targetDef - Target definition metadata.
   * @param {Array<ResolvedTarget>} _primaryTargets - Previously resolved primary targets referenced by `contextFrom`.
   * @param {Entity} _actor - Acting entity.
   * @param {ActionContext} _actionContext - Action context.
   * @param {TraceLike|undefined} [_trace] - Optional trace context.
   * @returns {Promise<Array<ResolvedTarget>>} Collection of resolved targets scoped per primary context.
   */
  resolveDependentTargets(_targetKey, _targetDef, _primaryTargets, _actor, _actionContext, _trace) {
    throw new Error('Method must be implemented by concrete class');
  }
}
