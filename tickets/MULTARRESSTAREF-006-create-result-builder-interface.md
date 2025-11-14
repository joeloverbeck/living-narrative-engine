# MULTARRESSTAREF-006: Create Result Builder Interface

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 0.5 days
**Phase:** 2 - Result Assembly Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Create the interface definition for `ITargetResolutionResultBuilder` to establish the contract for all result assembly operations currently scattered across three locations in `MultiTargetResolutionStage`.

## Background

Result assembly logic is currently duplicated in three places (lines 379-399, 525-556, 903-922) totaling ~80 lines. This causes inconsistencies and makes backward compatibility maintenance difficult. The interface will enable extraction into a single, reusable service.

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
   * Build result for legacy single-target action
   * @param {object} context - Pipeline context
   * @param {object} resolvedTargets - Resolved targets map
   * @param {Array} targetContexts - Target contexts for backward compatibility
   * @param {object} conversionResult - Legacy conversion result
   * @param {object} actionDef - Action definition
   * @returns {object} Action result with targets
   */
  buildLegacyResult(context, resolvedTargets, targetContexts, conversionResult, actionDef) {},

  /**
   * Build result for multi-target action
   * @param {object} context - Pipeline context
   * @param {object} resolvedTargets - Resolved targets map
   * @param {Array} targetContexts - Target contexts
   * @param {object} targetDefinitions - Target definitions
   * @param {object} actionDef - Action definition
   * @param {object} [detailedResults] - Detailed resolution results
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
   * Build final pipeline result with all actions
   * @param {object} context - Pipeline context
   * @param {Array} allActionsWithTargets - All actions with resolved targets
   * @param {Array} allTargetContexts - All target contexts
   * @param {object} lastResolvedTargets - Last resolved targets (backward compat)
   * @param {object} lastTargetDefinitions - Last target definitions (backward compat)
   * @returns {PipelineResult} Pipeline result
   */
  buildFinalResult(
    context,
    allActionsWithTargets,
    allTargetContexts,
    lastResolvedTargets,
    lastTargetDefinitions
  ) {},

  /**
   * Attach metadata to action with targets
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
