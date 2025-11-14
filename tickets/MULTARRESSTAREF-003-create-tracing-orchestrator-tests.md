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
  it('should validate logger dependency', () => {});
  it('should throw if logger missing required methods', () => {});
  it('should initialize with valid logger', () => {});
});
```

#### 2. Trace Capability Detection
```javascript
describe('isActionAwareTrace', () => {
  it('should return true for action-aware trace', () => {});
  it('should return false for standard trace', () => {});
  it('should return false for null trace', () => {});
  it('should handle missing trace methods gracefully', () => {});
});
```

#### 3. Legacy Detection Capture
```javascript
describe('captureLegacyDetection', () => {
  it('should capture legacy detection when trace supports it', () => {});
  it('should not throw when trace method missing', () => {});
  it('should log warning when expected method missing', () => {});
  it('should pass correct data to trace', () => {});
});
```

#### 4. Legacy Conversion Capture
```javascript
describe('captureLegacyConversion', () => {
  it('should capture conversion data', () => {});
  it('should handle missing trace method', () => {});
  it('should include all conversion metadata', () => {});
});
```

#### 5. Scope Evaluation Capture
```javascript
describe('captureScopeEvaluation', () => {
  it('should capture scope evaluation results', () => {});
  it('should include target key and evaluation data', () => {});
  it('should handle missing trace method', () => {});
});
```

#### 6. Multi-Target Resolution Capture
```javascript
describe('captureMultiTargetResolution', () => {
  it('should capture resolution summary', () => {});
  it('should include target counts and results', () => {});
  it('should handle missing trace method', () => {});
});
```

#### 7. Target Resolution Data Capture
```javascript
describe('captureResolutionData', () => {
  it('should capture basic resolution data', () => {});
  it('should capture detailed results when provided', () => {});
  it('should handle missing detailed results', () => {});
  it('should include actor and action information', () => {});
  it('should handle missing trace method', () => {});
});
```

#### 8. Error Capture
```javascript
describe('captureResolutionError', () => {
  it('should capture error with context', () => {});
  it('should include action and actor info', () => {});
  it('should handle Error objects', () => {});
  it('should handle missing trace method', () => {});
});
```

#### 9. Post-Resolution Summary
```javascript
describe('capturePostResolutionSummary', () => {
  it('should capture summary with counts', () => {});
  it('should include actor information', () => {});
  it('should handle missing trace method', () => {});
});
```

#### 10. Performance Data Capture
```javascript
describe('capturePerformanceData', () => {
  it('should capture performance metrics', () => {});
  it('should include action identifier', () => {});
  it('should handle missing metrics gracefully', () => {});
  it('should handle missing trace method', () => {});
});
```

#### 11. Legacy Format Analysis
```javascript
describe('analyzeLegacyFormat', () => {
  it('should detect string target format', () => {});
  it('should detect scope property format', () => {});
  it('should detect targetType format', () => {});
  it('should identify modern multi-target format', () => {});
  it('should handle malformed actions', () => {});
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
- [ ] All 11 test suites implemented
- [ ] Coverage meets 90%+ target (branches, functions, lines)
- [ ] All edge cases covered (missing methods, null inputs, etc.)
- [ ] Mock utilities created for trace and logger
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
