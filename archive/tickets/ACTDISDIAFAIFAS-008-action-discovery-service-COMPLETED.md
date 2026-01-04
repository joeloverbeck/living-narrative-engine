# ACTDISDIAFAIFAS-008 – ActionDiscoveryService Diagnostics Option

**Status: COMPLETED**

## Outcome

Successfully implemented the diagnostics option for `getValidActions()`.

### Changes Made

**src/actions/actionDiscoveryService.js:**
- Modified `getValidActions()` to accept `{ diagnostics: true }` option
- Added `forceTrace` logic to create trace when diagnostics is requested (forces trace creation even without explicit `trace: true`)
- Updated `#getValidActionsInternal()` signature to accept `shouldDiagnostics` parameter
- Added `#aggregateDiagnostics(trace)` method to extract structured diagnostic data from trace
- Added error handling in telemetry section to prevent trace errors from propagating

**tests/unit/actions/actionDiscoveryService.diagnostics.test.js (NEW):**
- Created 14 test cases covering all acceptance criteria:
  1. Accepts `{ diagnostics: true }` option without error
  2. Creates trace when diagnostics is true even without trace option
  3. Includes `.diagnostics` property when diagnostics option is enabled
  4. Does not include `.diagnostics` property when diagnostics option is false
  5. Does not include `.diagnostics` property when diagnostics option is omitted
  6. Does not create trace when neither trace nor diagnostics is requested (zero overhead)
  7. Aggregates component filtering rejections
  8. Aggregates target validation failures
  9. Aggregates scope resolution errors
  10. Includes `.actions` property when diagnostics is enabled
  11. Includes `.actions` property when diagnostics is disabled
  12. Returns empty diagnostics arrays when no rejections occurred
  13. Returns empty diagnostics when getTracedActions throws
  14. Returns empty diagnostics when trace lacks getTracedActions method

### Test Results

- All 14 new tests pass
- All 67 ActionDiscoveryService unit tests pass (backward compatibility verified)
- All 41 ActionDiscoveryService integration tests pass
- ESLint passes with 0 errors

### Key Implementation Details

- **Zero Overhead**: When `diagnostics` is not requested, no trace is created and the original code path is used
- **Force Trace**: When `diagnostics: true`, an action-aware trace is created to capture stage data
- **Graceful Error Handling**: Both telemetry and aggregation sections catch errors from `getTracedActions()` and return empty diagnostics
- **Backward Compatible**: Existing API unchanged, diagnostics is purely additive

---

## Problem

There's no way to request diagnostic output from action discovery. Users call `getValidActions()` and receive an empty array with no explanation of why actions were filtered.

## Proposed Scope

Add an optional `diagnostics` parameter to `getValidActions()` that:
1. Activates diagnostic mode in all pipeline stages
2. Collects and aggregates diagnostic information from each stage
3. Returns diagnostics alongside the action results
4. Has zero overhead when disabled

## File List

- `src/actions/actionDiscoveryService.js`
- `tests/unit/actions/actionDiscoveryService.test.js`

## Out of Scope

- Stage changes (completed in ACTDISDIAFAIFAS-006, ACTDISDIAFAIFAS-007)
- FilterResolver changes (completed in ACTDISDIAFAIFAS-002b)
- Test fixture changes (handled in ACTDISDIAFAIFAS-009)
- Creating new diagnostic formatters
- Modifying existing return value structure for non-diagnostic calls

## Acceptance Criteria

### Tests

Run: `npm run test:unit -- tests/unit/actions/actionDiscoveryService.test.js`

Required test cases:
- **`getValidActions(actor, { diagnostics: true })` accepted**: Method accepts options
- **Diagnostic mode activates stage diagnostics**: Pipeline runs with diagnostics enabled
- **Result includes `.diagnostics` property when enabled**: Diagnostic data returned
- **Non-diagnostic call has zero overhead**: Original path unchanged
- **Diagnostics aggregated from all stages**: Component, target, prerequisite stages
- **`.actions[]` always present**: Return type stable
- **Diagnostic data structured by stage**: Easy to identify which stage rejected
- **Empty diagnostics when all actions pass**: Clean success case

### Invariants

- `getValidActions(actor)` still works identically (no breaking changes)
- Return type stable - `.actions[]` always present
- Diagnostics opt-in only, never automatic
- Performance unchanged when diagnostics not requested
- Existing tests continue to pass

### API Contract

```javascript
/**
 * @typedef {Object} ActionDiscoveryDiagnostics
 * @property {Object} componentFiltering - From ComponentFilteringStage
 * @property {Object[]} componentFiltering.rejectedActions
 * @property {Object} targetValidation - From TargetComponentValidationStage
 * @property {Object[]} targetValidation.validationFailures
 * @property {Object} scopeResolution - From scope/filter resolution
 * @property {Object[]} scopeResolution.errors
 */

/**
 * @typedef {Object} ActionDiscoveryResult
 * @property {Object[]} actions - Valid actions for the actor
 * @property {ActionDiscoveryDiagnostics} [diagnostics] - Only when requested
 */

/**
 * @param {Object} actor - Actor entity
 * @param {Object} [options]
 * @param {boolean} [options.diagnostics=false] - Enable diagnostic collection
 * @returns {ActionDiscoveryResult}
 */
getValidActions(actor, options = {}) {}
```

### Example Output

```javascript
// With diagnostics: true
{
  actions: [
    { id: 'core:speak', ... }
  ],
  diagnostics: {
    componentFiltering: {
      rejectedActions: [
        {
          actionId: 'personal-space:get_close',
          reason: 'FORBIDDEN_COMPONENT',
          forbiddenComponents: ['personal-space-states:closeness'],
          actorHasComponents: ['personal-space-states:closeness']
        }
      ]
    },
    targetValidation: {
      validationFailures: []
    },
    scopeResolution: {
      errors: []
    }
  }
}
```

### Integration Points

**Note (Corrections from Code Analysis):**
1. The actual code uses `this.#actionPipelineOrchestrator.discoverActions()`, not `this.#pipeline.execute()`
2. The service already has `options = {}` as third parameter (signature: `getValidActions(actorEntity, baseContext = {}, options = {})`)
3. When action-aware trace is present (via `actionAwareTraceFactory`), stages capture diagnostics via `trace.captureActionData(category, key, data)`
4. Diagnostics data is retrieved via `trace.getTracedActions()` which returns `Map<actionId, { category: data }>`

**Stage-Specific Capture Keys:**
- ComponentFilteringStage: category=`'component_filtering_rejections'`, key=`'stage'`
  - Data: `{ stageName: 'ComponentFilteringStage', diagnostics: { rejectedActions: [...] } }`
- TargetComponentValidationStage: category=`'target_validation_failure'`, key=`actionId`
  - Data: `{ stageName: 'TargetComponentValidationStage', diagnostics: { validationFailures: [...] } }`
- FilterResolver: category=`'scope_evaluation'`, key=`actionId`
  - Data: `{ ...error }` when scope evaluation fails

**Corrected Integration Pattern:**
```javascript
// In ActionDiscoveryService.getValidActions():
const { trace: shouldTrace = false, diagnostics: shouldDiagnostics = false } = options;

// If diagnostics requested, force action-aware trace creation
const forceTrace = shouldDiagnostics || shouldTrace;
const trace = forceTrace
  ? await this.#createTraceContext(actorEntity.id, baseContext, options)
  : null;

// ... pipeline execution with trace ...

// At return time, aggregate diagnostics if requested
if (shouldDiagnostics && trace?.getTracedActions) {
  return {
    ...result,
    diagnostics: this.#aggregateDiagnostics(trace)
  };
}

return result;
```

## Dependencies

- ACTDISDIAFAIFAS-006 (ComponentFilteringStage Diagnostics) - must be completed first
- ACTDISDIAFAIFAS-007 (TargetComponentValidationStage Diagnostics) - must be completed first
- ACTDISDIAFAIFAS-002b (FilterResolver Suggestion Integration) - must be completed first
