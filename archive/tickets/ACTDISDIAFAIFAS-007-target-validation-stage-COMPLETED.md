# ACTDISDIAFAIFAS-007 – TargetComponentValidationStage Diagnostics

**Status: COMPLETED**

## Outcome

Successfully implemented diagnostics capture in TargetComponentValidationStage.

### Changes Made

**src/actions/pipeline/stages/TargetComponentValidationStage.js**:
- Added `#shouldCaptureDetails(trace)` helper method to check for action-aware trace
- Added `#captureValidationFailure(trace, failureData)` method to capture diagnostic data
- Modified forbidden validation call to pass `{ includeDetails: true }` when trace enabled
- Modified required validation call to pass `{ includeDetails: true }` when trace enabled
- Added capture calls after validation failures with detailed rejection info

**tests/unit/actions/pipeline/stages/TargetComponentValidationStage.test.js**:
- Added 8 new test cases in "Diagnostics Mode (ACTDISDIAFAIFAS-007)" describe block
- Updated 6 existing tests to expect the new options argument (empty `{}` when no trace)

**tests/unit/actions/pipeline/stages/TargetComponentValidationStage.additionalUnit.test.js**:
- Updated 2 assertions to expect the new options argument

### Test Results

All 47 tests pass across both test files:
- `TargetComponentValidationStage.test.js`: 36 tests pass
- `TargetComponentValidationStage.additionalUnit.test.js`: 11 tests pass

### Key Patterns Followed

- Zero overhead when diagnostics disabled (conditional check only)
- Follows ComponentFilteringStage's `#captureRejections()` pattern
- Trace data structure matches ticket specification
- Full backward compatibility maintained

## Problem

TargetComponentValidationStage doesn't provide detailed breakdown of target validation failures. The stage uses validators but doesn't capture per-entity rejection details for tracing or diagnostics.

## Proposed Scope

Update TargetComponentValidationStage to:
1. Request detailed validation results from validators when trace/diagnostics enabled
2. Capture per-entity rejection info in trace output
3. Pass detailed error context to ScopeResolutionError if needed
4. Maintain zero overhead when diagnostics disabled

## File List

- `src/actions/pipeline/stages/TargetComponentValidationStage.js`
- `tests/unit/actions/pipeline/stages/TargetComponentValidationStage.test.js`

## Out of Scope

- Validator changes (completed in ACTDISDIAFAIFAS-003, ACTDISDIAFAIFAS-004)
- ComponentFilteringStage (handled in ACTDISDIAFAIFAS-006)
- ActionDiscoveryService changes (handled in ACTDISDIAFAIFAS-008)
- Other pipeline stages
- Modifying trace data structure beyond adding diagnostic info

## Acceptance Criteria

### Tests

Run: `npm run test:unit -- tests/unit/actions/pipeline/stages/TargetComponentValidationStage.test.js`

Required test cases:
- **Stage captures detailed rejection info from validators**: Uses `includeDetails: true` option
- **Per-entity rejection details available in trace**: Each rejected entity tracked
- **Diagnostic data flows to error context**: ScopeResolutionError has details
- **Normal path skips detailed collection**: Performance protection
- **Both forbidden and required validation failures tracked**: Complete coverage
- **Multiple target roles validated with details**: Primary, secondary, tertiary
- **Trace data structure follows existing patterns**: Consistent with other stages
- **Backward compatible with existing tests**: All existing assertions pass

### Invariants

- Non-diagnostic path performance unchanged
- Stage output format backward compatible
- Existing test assertions still pass
- Stage continues to use dependency injection for validators
- Error throwing behavior unchanged

### Trace Output Extension

```javascript
// Existing trace data preserved, plus:
{
  stageName: 'TargetComponentValidationStage',
  // ... existing fields ...
  diagnostics: {
    validationFailures: [
      {
        actionId: 'positioning:kneel_before',
        targetRole: 'primary',
        validationType: 'forbidden_components',
        rejectedEntities: [
          {
            entityId: 'entity_123',
            forbiddenComponentsPresent: ['positioning:kneeling']
          }
        ]
      },
      {
        actionId: 'core:give_item',
        targetRole: 'secondary',
        validationType: 'required_components',
        rejectedEntities: [
          {
            entityId: 'entity_456',
            requiredComponentsMissing: ['items:inventory']
          }
        ]
      }
    ]
  }
}
```

### Integration Points

```javascript
// In TargetComponentValidationStage validation calls:
const validationOptions = this.#traceEnabled || options.diagnostics
  ? { includeDetails: true }
  : {};

const forbiddenResult = this.#forbiddenValidator.validateTargetComponents(
  target, actionDef, validationOptions
);

if (!forbiddenResult.valid) {
  this.#captureValidationFailure(trace, {
    actionId,
    targetRole,
    validationType: 'forbidden_components',
    ...forbiddenResult.details
  });
}
```

## Dependencies

- ACTDISDIAFAIFAS-003 (TargetComponentValidator Detailed Returns) - must be completed first
- ACTDISDIAFAIFAS-004 (TargetRequiredComponentsValidator Detailed Returns) - must be completed first
