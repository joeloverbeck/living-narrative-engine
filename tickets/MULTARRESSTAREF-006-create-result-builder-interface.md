# MULTARRESSTAREF-006: Create Result Builder Interface

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 0.5 days
**Phase:** 2 - Result Assembly Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Create the interface definition for `ITargetResolutionResultBuilder` to establish the contract for all result assembly operations currently scattered across three locations in `MultiTargetResolutionStage`.

## Background

Result assembly logic is currently duplicated in three places inside `src/actions/pipeline/stages/MultiTargetResolutionStage.js`:

- **Final stage result:** lines 426-447 build the top-level `PipelineResult` by combining `allActionsWithTargets`, aggregated `targetContexts`, and the captured `errors` array.
- **Legacy path:** lines 563-603 create the legacy-compatible result payload returned from `#resolveLegacyTarget`, including conversion of scope results into `resolvedTargets`, `actionsWithTargets`, and compatibility metadata.
- **Multi-target path:** lines 964-983 build the multi-target result returned from `#resolveMultiTargets`, including `detailedResolutionResults` that the tracing system depends on.

Together these blocks total ~90 lines and share identical structure requirements (consistent `actionsWithTargets`, legacy compatibility fields, and error propagation). This duplication causes drift and makes backward compatibility maintenance difficult. The interface will enable extraction into a single, reusable service that all three call sites use.

## Technical Requirements

### File to Create
- **Path:** `src/actions/pipeline/services/interfaces/ITargetResolutionResultBuilder.js`

### Interface Methods

```javascript
/**
 * @interface ITargetResolutionResultBuilder
 */
export default {
  /**
   * Build result for legacy single-target action (currently lines 563-603)
   * @param {object} context - Pipeline context
   * @param {object} resolvedTargets - Resolved targets map generated from legacy scope resolution
   * @param {Array} targetContexts - Target contexts for backward compatibility
   * @param {object} conversionResult - Legacy conversion result with target definitions
   * @param {object} actionDef - Action definition
   * @returns {object} Action result with targets
   */
  buildLegacyResult(context, resolvedTargets, targetContexts, conversionResult, actionDef) {},

  /**
   * Build result for multi-target action (currently lines 964-983)
   * @param {object} context - Pipeline context
   * @param {object} resolvedTargets - Resolved targets map keyed by target key
   * @param {Array} targetContexts - Flattened target contexts for backward compatibility
   * @param {object} targetDefinitions - Target definitions
   * @param {object} actionDef - Action definition
   * @param {object} [detailedResults] - Detailed resolution results captured for tracing
   * @returns {object} Action result with targets
   */
  buildMultiTargetResult(
    context,
    resolvedTargets,
    targetContexts,
    targetDefinitions,
    actionDef,
    detailedResults
  ) {},

  /**
   * Build final pipeline result with all actions (currently lines 426-447)
   * @param {object} context - Pipeline context
   * @param {Array} allActionsWithTargets - All actions with resolved targets
   * @param {Array} allTargetContexts - All target contexts
   * @param {object|null} lastResolvedTargets - Last resolved targets (backward compat)
   * @param {object|null} lastTargetDefinitions - Last target definitions (backward compat)
   * @param {Array} errors - Errors collected during processing
   * @returns {PipelineResult} Pipeline result
   */
  buildFinalResult(
    context,
    allActionsWithTargets,
    allTargetContexts,
    lastResolvedTargets,
    lastTargetDefinitions,
    errors
  ) {},

  /**
   * Attach metadata to action with targets (currently lines 328-338)
   * @param {object} actionWithTargets - Action with targets object
   * @param {object} resolvedTargets - Resolved targets
   * @param {object} targetDefinitions - Target definitions
   * @param {boolean} isMultiTarget - Whether this is multi-target
   */
  attachMetadata(actionWithTargets, resolvedTargets, targetDefinitions, isMultiTarget) {},
};
```

## Acceptance Criteria

- [ ] Interface file created at specified path
- [ ] All 4 methods defined with JSDoc annotations
- [ ] Parameter types documented for each method
- [ ] Return types specified where applicable
- [ ] Backward compatibility requirements documented in comments
- [ ] File follows project naming conventions
- [ ] Interface exported as default

## Dependencies

None - can be developed in parallel with Phase 1 (tracing extraction).

## Testing Strategy

No tests required for interface definition. Implementation tests will be in MULTARRESSTAREF-008.

## Notes

- This interface addresses the **Shotgun Surgery** code smell (3 assembly locations)
- Methods handle both legacy and modern multi-target result formats
- `buildFinalResult` must maintain backward compatibility with downstream stages
- Metadata attachment ensures consistent result format across all paths
- Interface will enable single source of truth for result assembly
