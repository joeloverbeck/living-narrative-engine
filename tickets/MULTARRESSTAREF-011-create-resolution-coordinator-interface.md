# MULTARRESSTAREF-011: Create Resolution Coordinator Interface

**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 0.5 days
**Phase:** 3 - Resolution Coordination Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Create the interface definition for `ITargetResolutionCoordinator` to establish the contract for the 360+ lines of resolution coordination logic currently embedded in the `#resolveMultiTargets` method inside `src/actions/pipeline/stages/MultiTargetResolutionStage.js`.

## Background

The `#resolveMultiTargets` method (currently ~363 lines) handles both coordination and resolution logic. This interface will enable extraction of coordination concerns (dependency order, contextFrom handling) into a dedicated service.

## Technical Requirements

### File to Create
- **Path:** `src/actions/pipeline/services/interfaces/ITargetResolutionCoordinator.js`

### Interface Structure

The interface file must follow the same class-based pattern used by other pipeline service interfaces (for example `ITargetResolutionResultBuilder`). Include the following type imports near the top of the file for JSDoc parity with the existing stage implementation:

```javascript
/** @typedef {import('../../PipelineResult.js').PipelineResult} PipelineResult */
/** @typedef {import('../../actionTypes.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../../../../entities/entity.js').default} Entity */
/** @typedef {import('../../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../../tracing/traceContext.js').TraceContext|import('../../../tracing/structuredTrace.js').StructuredTrace|import('../../../tracing/actionAwareStructuredTrace.js').default} TraceLike */
/** @typedef {import('../../../../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
```

Define supporting typedefs to mirror what the existing stage currently produces:

```javascript
/**
 * @typedef {object} TargetDefinition
 * @property {string} scope
 * @property {string} placeholder
 * @property {string} [description]
 * @property {string} [contextFrom]
 * @property {boolean} [optional]
 */

/** @typedef {Record<string, TargetDefinition>} TargetDefinitions */

/**
 * @typedef {object} ResolvedTarget
 * @property {string} id
 * @property {string} displayName
 * @property {Entity} entity
 * @property {string} [contextFromId]
 */

/**
 * @typedef {object} DetailedResolutionResult
 * @property {string} scopeId
 * @property {string|null} contextFrom
 * @property {number} candidatesFound
 * @property {number} candidatesResolved
 * @property {number} evaluationTimeMs
 * @property {string|null} failureReason
 * @property {Array<string>} [contextEntityIds]
 */

/**
 * @typedef {object} ResolutionComputation
 * @property {Record<string, Array<ResolvedTarget>>} resolvedTargets
 * @property {Array<ActionTargetContext>} targetContexts
 * @property {Record<string, DetailedResolutionResult>} detailedResults
 * @property {Record<string, number>} resolvedCounts
 */
```

### Interface Methods

```javascript
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
   * @returns {Promise<PipelineResult>} PipelineResult containing `actionsWithTargets`, `resolvedTargets`, `targetDefinitions`, `targetContexts`, and `detailedResolutionResults` for downstream consumers.
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
  resolveDependentTargets(
    _targetKey,
    _targetDef,
    _primaryTargets,
    _actor,
    _actionContext,
    _trace
  ) {
    throw new Error('Method must be implemented by concrete class');
  }
}
```

### Result Types

- `coordinateResolution` **must** return a `PipelineResult` (success or failure) so the orchestrator can remain backward compatible with the existing stage contract.
- `resolveWithDependencies` returns a `ResolutionComputation` object that contains the same shapes currently produced inside `#resolveMultiTargets` (`resolvedTargets`, flattened `targetContexts`, counts, and `detailedResolutionResults`).
- `resolveDependentTargets` returns an array of `ResolvedTarget` entries enriched with `contextFromId` for downstream compatibility.

## Acceptance Criteria

- [ ] Interface file created at the specified path using the class-based interface pattern (`export default class ... {}`) shared by other pipeline services.
- [ ] All `@typedef` imports listed above are included to match the stage's current dependencies.
- [ ] Each method includes `@description`, `@param`, and `@returns` tags that explicitly mention `PipelineResult`, `ResolutionComputation`, and `ResolvedTarget` shapes.
- [ ] Dependency handling (`contextFrom` flow and dependent target resolution) is described in the `resolveWithDependencies` and `resolveDependentTargets` docblocks.
- [ ] The interface documents that it must return a `PipelineResult` compatible object for `coordinateResolution`, ensuring consumers of `MultiTargetResolutionStage` remain unaffected until Phase 4 integration.
- [ ] File follows existing naming conventions and exports the interface as the default class.

## Dependencies

None - can be developed in parallel with Phases 1-2.

## Testing Strategy

No tests required for interface definition. Implementation tests will be in MULTARRESSTAREF-013.

## Notes

- This interface addresses coordination logic complexity in `#resolveMultiTargets`
- Handles dependency-based resolution order (ITargetDependencyResolver)
- Manages contextFrom dependencies for dependent targets
- Enables testing of coordination logic separately from resolution
- Will reduce complexity of `#resolveMultiTargets` by ~150 lines
