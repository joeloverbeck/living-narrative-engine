# MULTARRESSTAREF-003: Create Tracing Orchestrator Tests

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1 day
**Phase:** 1 - Tracing Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Create comprehensive unit tests for `TargetResolutionTracingOrchestrator` to ensure all tracing functionality is preserved during extraction.

## Background

The tracing orchestrator handles ~200 lines of critical tracing logic. Comprehensive tests ensure no functionality is lost during extraction and make future tracing changes easier to test.

## Technical Requirements

### File to Create
- **Path:** `tests/unit/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.test.js`

### Test Coverage Requirements

**Target Coverage:** 90%+ (branches, functions, lines)

### Test Suites

#### 1. Constructor and Initialization
```javascript
describe('TargetResolutionTracingOrchestrator - Constructor', () => {
  it('should validate logger dependency via validateDependency', () => {});
  it('should throw when logger is missing required methods', () => {});
  it('should retain reference to a valid logger', () => {});
});
```

#### 2. Trace Capability Detection
```javascript
describe('isActionAwareTrace', () => {
  it('should return true only when captureActionData is a function', () => {});
  it('should return false for plain objects that lack captureActionData', () => {});
  it('should return false for null/undefined trace values', () => {});
});
```

#### 3. Legacy Detection Capture
```javascript
describe('captureLegacyDetection', () => {
  it('should capture legacy detection when the trace supplies captureLegacyDetection', () => {});
  it('should warn and skip when the trace is action-aware but missing captureLegacyDetection', () => {});
  it('should warn when trace.captureLegacyDetection throws an error', () => {});
});
```

#### 4. Legacy Conversion Capture
```javascript
describe('captureLegacyConversion', () => {
  it('should forward conversion data to trace.captureLegacyConversion', () => {});
  it('should warn and skip when the method is missing', () => {});
  it('should warn but not throw when the trace method raises an error', () => {});
});
```

#### 5. Scope Evaluation Capture
```javascript
describe('captureScopeEvaluation', () => {
  it('should forward actionId, targetKey, and evaluation data', () => {});
  it('should warn when the trace lacks captureScopeEvaluation', () => {});
  it('should warn if captureScopeEvaluation throws', () => {});
});
```

#### 6. Multi-Target Resolution Capture
```javascript
describe('captureMultiTargetResolution', () => {
  it('should send the resolution summary to captureMultiTargetResolution', () => {});
  it('should warn when the trace lacks the method despite being action-aware', () => {});
  it('should warn when captureMultiTargetResolution throws', () => {});
});
```

#### 7. Target Resolution Data Capture
```javascript
describe('captureResolutionData', () => {
  it('should send payload with stage, actorId, timestamp, and resolution data', () => {});
  it('should append targetResolutionDetails when detailedResults supplied', () => {});
  it('should warn when trace.captureActionData is missing', () => {});
});
```

#### 8. Error Capture
```javascript
describe('captureResolutionError', () => {
  it('should send error payload with stage, actorId, and resolutionFailed flag', () => {});
  it('should include error message, type, and scopeName when available', () => {});
  it('should warn when captureActionData is missing', () => {});
});
```

#### 9. Post-Resolution Summary
```javascript
describe('capturePostResolutionSummary', () => {
  it('should log a debug summary even though it does not call the trace', () => {});
  it('should compute resolutionSuccessRate and include actorId/flags in the log payload', () => {});
  it('should log a warning instead of throwing if summary logging fails', () => {});
});
```

#### 10. Performance Data Capture
```javascript
describe('capturePerformanceData', () => {
  it('should await #safeCaptureActionData with event "stage_performance" and payload duration/items info', () => {});
  it('should skip capture when trace is not action-aware', () => {});
  it('should warn when captureActionData is missing despite being action-aware', () => {});
});
```

#### 11. Legacy Format Analysis
```javascript
describe('analyzeLegacyFormat', () => {
  it('should detect string targets as "string_targets"', () => {});
  it('should detect scope-only targets as "scope_property"', () => {});
  it('should detect targetType/targetCount as "legacy_target_type"', () => {});
  it('should default to "modern" when no legacy hints are present', () => {});
});
```

### Mock Helper Utilities

```javascript
function createMockTrace(capabilities = {}) {
  return {
    step: capabilities.step ? jest.fn() : undefined,
    info: capabilities.info ? jest.fn() : undefined,
    success: capabilities.success ? jest.fn() : undefined,
    failure: capabilities.failure ? jest.fn() : undefined,
    captureLegacyDetection: capabilities.captureLegacyDetection ? jest.fn() : undefined,
    captureLegacyConversion: capabilities.captureLegacyConversion ? jest.fn() : undefined,
    captureScopeEvaluation: capabilities.captureScopeEvaluation ? jest.fn() : undefined,
    captureMultiTargetResolution: capabilities.captureMultiTargetResolution ? jest.fn() : undefined,
    captureActionData: capabilities.captureActionData ? jest.fn() : undefined,
  };
}

function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}
```

## Acceptance Criteria

- [ ] Test file created at specified path
- [ ] All 11 test suites implemented with cases listed above (including logger-warning scenarios)
- [ ] Coverage meets 90%+ target (branches, functions, lines)
- [ ] All edge cases covered (missing methods, null inputs, thrown errors, non-action-aware traces)
- [ ] Mock utilities created for trace and logger (logger must allow debug/warn spies used by post-resolution summary tests)
- [ ] Tests follow project testing patterns (AAA pattern, descriptive names)
- [ ] All tests pass with `npm run test:unit`

## Dependencies

- **MULTARRESSTAREF-002** - Implementation must exist before testing

## Validation Commands

```bash
npm run test:unit -- tests/unit/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.test.js
```

## Notes

- These tests ensure tracing behavior is preserved during extraction
- Tests should verify trace method calls AND arguments
- Test both action-aware and standard trace scenarios
- Error handling tests are critical - tracing must never break orchestration
- Consider adding integration tests for end-to-end tracing in separate ticket
