# MULTARRESSTAREF-001: Create Tracing Orchestrator Interface

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 0.5 days
**Phase:** 1 - Tracing Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Create the interface definition for `ITargetResolutionTracingOrchestrator` to establish the contract for every tracing operation currently embedded in `MultiTargetResolutionStage`.

## Background

`MultiTargetResolutionStage` is still a 1,220-line class with ~200 lines of tracing logic (per MULTARRESSTAREF-000). The tracing work is spread between five private helper methods (`#isActionAwareTrace`, `#captureTargetResolutionData`, `#captureTargetResolutionError`, `#capturePostResolutionSummary`, `#capturePerformanceData`) and several direct `ActionAwareStructuredTrace` calls such as `captureLegacyDetection`, `captureLegacyConversion`, `captureScopeEvaluation`, and `captureMultiTargetResolution`. This ticket creates the interface that will enable extraction of those responsibilities into a dedicated orchestrator service.

## Technical Requirements

### File to Create
- **Path:** `src/actions/pipeline/services/interfaces/ITargetResolutionTracingOrchestrator.js`

### Interface Methods

```javascript
/**
 * @interface ITargetResolutionTracingOrchestrator
 */
export class ITargetResolutionTracingOrchestrator {
  /**
   * Determine whether the provided trace supports action-aware capture
   * @param {import('../../../tracing/actionAwareStructuredTrace.js').default|object} trace
   * @returns {boolean}
   */
  isActionAwareTrace(_trace) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Capture legacy action detection before conversion
   * @param {object} trace
   * @param {string} actionId
   * @param {object} detectionData
   */
  captureLegacyDetection(_trace, _actionId, _detectionData) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Capture legacy conversion result from LegacyTargetCompatibilityLayer
   * @param {object} trace
   * @param {string} actionId
   * @param {object} conversionData
   */
  captureLegacyConversion(_trace, _actionId, _conversionData) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Capture scope evaluation output for a specific target key
   * @param {object} trace
   * @param {string} actionId
   * @param {string} targetKey
   * @param {object} evaluationData
   */
  captureScopeEvaluation(_trace, _actionId, _targetKey, _evaluationData) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Capture multi-target resolution summary for an action
   * @param {object} trace
   * @param {string} actionId
   * @param {object} resolutionData
   */
  captureMultiTargetResolution(_trace, _actionId, _resolutionData) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Capture detailed resolution data for either legacy or multi-target flows
   * @param {object} trace
   * @param {import('../../../actionTypes.js').ActionDefinition} actionDef
   * @param {import('../../../../entities/entity.js').default} actor
   * @param {object} resolutionData
   * @param {object} [detailedResults]
   */
  captureResolutionData(
    _trace,
    _actionDef,
    _actor,
    _resolutionData,
    _detailedResults
  ) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Capture target resolution error data
   * @param {object} trace
   * @param {import('../../../actionTypes.js').ActionDefinition} actionDef
   * @param {import('../../../../entities/entity.js').default} actor
   * @param {Error} error
   */
  captureResolutionError(_trace, _actionDef, _actor, _error) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Capture post-resolution summary metrics (counts, legacy usage, timing)
   * @param {object} trace
   * @param {import('../../../../entities/entity.js').default} actor
   * @param {number} originalCount
   * @param {number} resolvedCount
   * @param {boolean} hasLegacy
   * @param {boolean} hasMultiTarget
   * @param {number} stageDurationMs
   */
  capturePostResolutionSummary(
    _trace,
    _actor,
    _originalCount,
    _resolvedCount,
    _hasLegacy,
    _hasMultiTarget,
    _stageDurationMs
  ) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Capture stage performance metrics as used by ACTTRA-018
   * @param {object} trace
   * @param {import('../../../actionTypes.js').ActionDefinition} actionDef
   * @param {number} startTime
   * @param {number} endTime
   * @param {number} totalCandidates
   * @param {number} actionsWithTargets
   * @returns {Promise<void>}
   */
  async capturePerformanceData(
    _trace,
    _actionDef,
    _startTime,
    _endTime,
    _totalCandidates,
    _actionsWithTargets
  ) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Analyze legacy action formats for tracing metadata
   * @param {import('../../../actionTypes.js').ActionDefinition} action
   * @returns {string}
   */
  analyzeLegacyFormat(_action) {
    throw new Error('Method must be implemented by concrete class');
  }
}
```

## Acceptance Criteria

- [ ] Interface file created at specified path
- [ ] Interface exported as a class (consistent with existing pipeline service interfaces)
- [ ] All 10 methods defined with accurate parameters that match current `MultiTargetResolutionStage` usage
- [ ] Parameter and return types documented for each method
- [ ] Async contract documented for `capturePerformanceData`
- [ ] Includes `throw new Error('Method must be implemented by concrete class')` to mirror existing interfaces

## Dependencies

None - this is the first ticket in the refactoring sequence.

## Testing Strategy

No tests required for interface definition. Implementation tests will be in MULTARRESSTAREF-003.

## Notes

- This interface establishes the contract for extracting ~200 lines of tracing code from `MultiTargetResolutionStage`
- Methods correspond to the 5 private tracing helper methods currently in the stage
- Interface follows the existing class-based interface pattern used throughout `src/actions/pipeline/services/interfaces`
