# MULTARRESSTAREF-001: Create Tracing Orchestrator Interface

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 0.5 days
**Phase:** 1 - Tracing Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Create the interface definition for `ITargetResolutionTracingOrchestrator` to establish the contract for all tracing operations currently embedded in `MultiTargetResolutionStage`.

## Background

The `MultiTargetResolutionStage` currently has ~200 lines of tracing logic (27 trace calls, 10 conditionals, 5 helper methods) that obscure the core orchestration logic. This ticket creates the interface that will enable extraction of all tracing concerns.

## Technical Requirements

### File to Create
- **Path:** `src/actions/pipeline/services/interfaces/ITargetResolutionTracingOrchestrator.js`

### Interface Methods

```javascript
/**
 * @interface ITargetResolutionTracingOrchestrator
 */
export default {
  /**
   * Check if trace supports action-aware tracing
   * @param {object} trace
   * @returns {boolean}
   */
  isActionAwareTrace(trace) {},

  /**
   * Capture legacy action detection
   * @param {object} trace
   * @param {string} actionId
   * @param {object} detectionData
   */
  captureLegacyDetection(trace, actionId, detectionData) {},

  /**
   * Capture legacy conversion result
   * @param {object} trace
   * @param {string} actionId
   * @param {object} conversionData
   */
  captureLegacyConversion(trace, actionId, conversionData) {},

  /**
   * Capture scope evaluation result
   * @param {object} trace
   * @param {string} actionId
   * @param {string} targetKey
   * @param {object} evaluationData
   */
  captureScopeEvaluation(trace, actionId, targetKey, evaluationData) {},

  /**
   * Capture multi-target resolution summary
   * @param {object} trace
   * @param {string} actionId
   * @param {object} resolutionData
   */
  captureMultiTargetResolution(trace, actionId, resolutionData) {},

  /**
   * Capture target resolution data
   * @param {object} trace
   * @param {object} actionDef
   * @param {object} actor
   * @param {object} resolutionData
   * @param {object} [detailedResults]
   */
  captureResolutionData(trace, actionDef, actor, resolutionData, detailedResults) {},

  /**
   * Capture target resolution error
   * @param {object} trace
   * @param {object} actionDef
   * @param {object} actor
   * @param {Error} error
   */
  captureResolutionError(trace, actionDef, actor, error) {},

  /**
   * Capture post-resolution summary
   * @param {object} trace
   * @param {object} actor
   * @param {object} summaryData
   */
  capturePostResolutionSummary(trace, actor, summaryData) {},

  /**
   * Capture performance data
   * @param {object} trace
   * @param {object} actionDef
   * @param {object} performanceMetrics
   */
  capturePerformanceData(trace, actionDef, performanceMetrics) {},

  /**
   * Analyze legacy action format
   * @param {object} action
   * @returns {string} Format type
   */
  analyzeLegacyFormat(action) {},
};
```

## Acceptance Criteria

- [ ] Interface file created at specified path
- [ ] All 10 methods defined with JSDoc annotations
- [ ] Parameter types documented for each method
- [ ] Return types specified where applicable
- [ ] File follows project naming conventions
- [ ] Interface exported as default

## Dependencies

None - this is the first ticket in the refactoring sequence.

## Testing Strategy

No tests required for interface definition. Implementation tests will be in MULTARRESSTAREF-003.

## Notes

- This interface establishes the contract for extracting ~200 lines of tracing code from `MultiTargetResolutionStage`
- Methods correspond to the 5 private tracing helper methods currently in the stage
- Interface follows project pattern of using default export for interfaces
