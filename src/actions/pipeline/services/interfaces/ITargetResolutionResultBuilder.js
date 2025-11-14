/**
 * @file ITargetResolutionResultBuilder - Interface describing result assembly operations
 * for the multi-target resolution pipeline stage.
 * @see MultiTargetResolutionStage.js
 */

/** @typedef {import('../../PipelineResult.js').PipelineResult} PipelineResult */
/** @typedef {import('../../../actionTypes.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../../../../entities/entity.js').default} Entity */
/** @typedef {import('../../../../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('../../../tracing/traceContext.js').TraceContext|import('../../../tracing/structuredTrace.js').StructuredTrace|import('../../../tracing/actionAwareStructuredTrace.js').default} TraceLike */

/**
 * @typedef {object} PipelineContext
 * @property {Entity} actor - Actor executing the pipeline stage.
 * @property {TraceLike|undefined} [trace] - Optional trace used for diagnostics.
 * @property {object} data - Arbitrary pipeline metadata forwarded to downstream stages.
 */

/**
 * @typedef {object} ActionWithTargets
 * @property {ActionDefinition} actionDef - Action definition that produced the targets.
 * @property {Array<ActionTargetContext>} [targetContexts] - Target contexts maintained for compatibility.
 * @property {object} [resolvedTargets] - Map of resolved targets keyed by target identifier.
 * @property {object} [targetDefinitions] - Target definitions describing placeholders.
 * @property {boolean} [isMultiTarget] - Indicates whether the resolution path was multi-target aware.
 */

/**
 * @typedef {object} DetailedResolutionResults
 * @property {Record<string, Array>} targetEvaluations - Target evaluation outputs keyed by target key.
 * @property {Array} resolutionSteps - Step-by-step resolution diagnostics for tracing.
 */

/**
 * @interface ITargetResolutionResultBuilder
 * @description Defines the operations required to build consistent target resolution results across legacy,
 * multi-target, and final pipeline aggregation paths.
 */
export default class ITargetResolutionResultBuilder {
  /**
   * @description Build result payload for legacy single-target actions to maintain backward compatibility.
   * @param {PipelineContext} _context - Pipeline execution context.
   * @param {object} _resolvedTargets - Map of resolved targets generated from legacy scopes.
   * @param {Array<ActionTargetContext>} _targetContexts - Target contexts preserved for downstream consumers.
   * @param {object} _conversionResult - Legacy conversion result including normalized target definitions.
   * @param {ActionDefinition} _actionDef - Action definition used to provide metadata and identifiers.
   * @returns {object} Action result payload compatible with PipelineResult.success.
   */
  buildLegacyResult(
    _context,
    _resolvedTargets,
    _targetContexts,
    _conversionResult,
    _actionDef
  ) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * @description Build result payload for multi-target actions, including detailed tracing metadata.
   * @param {PipelineContext} _context - Pipeline execution context.
   * @param {object} _resolvedTargets - Map of resolved targets keyed by target key.
   * @param {Array<ActionTargetContext>} _targetContexts - Flattened target contexts for compatibility.
   * @param {object} _targetDefinitions - Resolved target definitions for the action.
   * @param {ActionDefinition} _actionDef - Action definition associated with the result.
   * @param {DetailedResolutionResults|undefined} _detailedResults - Optional detailed resolution diagnostics.
   * @returns {object} Action result payload compatible with PipelineResult.success.
   */
  buildMultiTargetResult(
    _context,
    _resolvedTargets,
    _targetContexts,
    _targetDefinitions,
    _actionDef,
    _detailedResults
  ) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * @description Build the final pipeline result that aggregates all actions and propagates collected errors.
   * @param {PipelineContext} _context - Pipeline execution context.
   * @param {Array<ActionWithTargets>} _allActionsWithTargets - Actions resolved with their targets.
   * @param {Array<ActionTargetContext>} _allTargetContexts - Aggregated target contexts.
   * @param {object|null} _lastResolvedTargets - Last resolved targets for backward compatibility.
   * @param {object|null} _lastTargetDefinitions - Last target definitions for backward compatibility.
   * @param {Array<Error|object>} _errors - Errors captured during processing.
   * @returns {PipelineResult} Pipeline result encapsulating success or failure state.
   */
  buildFinalResult(
    _context,
    _allActionsWithTargets,
    _allTargetContexts,
    _lastResolvedTargets,
    _lastTargetDefinitions,
    _errors
  ) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * @description Attach resolved target metadata to an action-with-targets payload for consistent formatting.
   * @param {ActionWithTargets} _actionWithTargets - Action payload receiving metadata.
   * @param {object} _resolvedTargets - Resolved targets map used to enrich the action.
   * @param {object} _targetDefinitions - Target definitions describing placeholders.
   * @param {boolean} _isMultiTarget - Indicates whether the result originated from multi-target flow.
   * @returns {void}
   */
  attachMetadata(_actionWithTargets, _resolvedTargets, _targetDefinitions, _isMultiTarget) {
    throw new Error('Method must be implemented by concrete class');
  }
}
