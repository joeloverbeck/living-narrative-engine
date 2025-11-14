# MULTARRESSTAREF-011: Create Resolution Coordinator Interface

**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 0.5 days
**Phase:** 3 - Resolution Coordination Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Create the interface definition for `ITargetResolutionCoordinator` to establish the contract for resolution coordination logic currently embedded in `#resolveMultiTargets` method (~150 lines).

## Background

The `#resolveMultiTargets` method (358 lines) handles both coordination and resolution logic. This interface will enable extraction of coordination concerns (dependency order, contextFrom handling) into a dedicated service.

## Technical Requirements

### File to Create
- **Path:** `src/actions/pipeline/services/interfaces/ITargetResolutionCoordinator.js`

### Interface Methods

```javascript
/**
 * @interface ITargetResolutionCoordinator
 */
export default {
  /**
   * Coordinate resolution for all targets in an action
   * @param {object} actionDef - Action definition
   * @param {object} actor - Actor entity
   * @param {object} actionContext - Action context
   * @param {object} trace - Trace context
   * @returns {Promise<CoordinationResult>}
   */
  coordinateResolution(actionDef, actor, actionContext, trace) {},

  /**
   * Resolve targets with dependency order
   * @param {object} targetDefs - Target definitions
   * @param {object} actor - Actor entity
   * @param {object} actionContext - Action context
   * @param {object} trace - Trace context
   * @returns {Promise<ResolutionResult>}
   */
  resolveWithDependencies(targetDefs, actor, actionContext, trace) {},

  /**
   * Resolve dependent targets (contextFrom)
   * @param {string} targetKey - Target key
   * @param {object} targetDef - Target definition
   * @param {Array} primaryTargets - Primary targets to use as context
   * @param {object} actor - Actor entity
   * @param {object} actionContext - Action context
   * @param {object} trace - Trace context
   * @returns {Promise<Array>}
   */
  resolveDependentTargets(
    targetKey,
    targetDef,
    primaryTargets,
    actor,
    actionContext,
    trace
  ) {},
};
```

### Result Types

**CoordinationResult:**
```javascript
{
  success: boolean,
  resolvedTargets: object,      // Map of targetKey -> resolved entities
  targetContexts: Array,         // Target contexts for backward compat
  detailedResults: object,       // Detailed resolution tracking
  error?: Error                  // Error if resolution failed
}
```

**ResolutionResult:**
```javascript
{
  resolvedTargets: object,       // Map of targetKey -> resolved entities
  detailedResults: object,       // Detailed resolution per target
  targetContexts: Array          // Target contexts
}
```

## Acceptance Criteria

- [ ] Interface file created at specified path
- [ ] All 3 methods defined with JSDoc annotations
- [ ] Parameter types documented for each method
- [ ] Return types specified with structure documentation
- [ ] Dependency handling (contextFrom) documented
- [ ] File follows project naming conventions
- [ ] Interface exported as default

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
