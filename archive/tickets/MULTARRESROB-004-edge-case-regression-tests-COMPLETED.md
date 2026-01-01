# MULTARRESROB-004 – Add Edge-Case Regression Tests for MultiTargetResolutionStage

**Status: COMPLETED**

## Problem

MULTARRESROB-001 already made `TargetResolutionTracingOrchestrator.captureResolutionError` null-safe, and the behavior is covered in `TargetResolutionTracingOrchestrator.test.js`. The coverage test file (`MultiTargetResolutionStage.coverage.test.js`) still contains a legacy spy mock that is no longer needed for null-safety, but it remains as historical coverage scaffolding.

We still need dedicated edge-case regression tests that exercise the stage-level paths WITHOUT mocking `captureResolutionError`.

**Evidence from coverage tests** (lines 2003-2008, legacy workaround still present):
```javascript
// Spy on captureResolutionError to prevent it from crashing on null error
jest
  .spyOn(mockDeps.tracingOrchestrator, 'captureResolutionError')
  .mockImplementation(() => {});
```

## Proposed Scope

Create a dedicated edge-case test file per spec Section 5.3, ensuring the stage is exercised with the real tracing orchestrator and no spy-based suppression:

```javascript
describe('MultiTargetResolutionStage edge cases', () => {
  describe('null actionContext', () => {
    it('should handle null actionContext gracefully', async () => {
      const context = createContext({ actionContext: null });
      const result = await stage.executeInternal(context);
      expect(result.success).toBeDefined();
    });
  });

  describe('empty displayName', () => {
    it('should use fallback resolver for empty string displayName', async () => {
      // Setup target context with displayName: ''
      const result = await stage.executeInternal(context);
      expect(result.data.targetContexts[0].displayName).not.toBe('');
    });
  });

  describe('error propagation', () => {
    it('should capture null error without crashing', async () => {
      // Setup coordinator to throw null
      mockCoordinator.coordinateResolution.mockRejectedValue(null);

      // NO spy mock on captureResolutionError - it should handle null gracefully
      const result = await stage.executeInternal(context);

      // Stage should continue, capturing the error
      expect(result).toBeDefined();
    });

    it('should capture string error without crashing', async () => {
      mockCoordinator.coordinateResolution.mockRejectedValue('Connection failed');
      const result = await stage.executeInternal(context);
      expect(result).toBeDefined();
    });
  });
});
```

## File List

- `tests/unit/actions/pipeline/stages/MultiTargetResolutionStage.edge-cases.test.js` (NEW)

## Out of Scope

- Modifying `MultiTargetResolutionStage.coverage.test.js` (legacy coverage scaffolding remains unchanged)
- Modifying `MultiTargetResolutionStage.test.js` (core functionality tests)
- Production code changes
- Testing other stages

## Acceptance Criteria

### Specific Tests That Must Pass

```bash
npm run test:unit -- tests/unit/actions/pipeline/stages/MultiTargetResolutionStage.edge-cases.test.js
```

### Invariants That Must Remain True

1. **No spy mocking on captureResolutionError in the new edge-case tests**: Tests must NOT use `jest.spyOn(..., 'captureResolutionError').mockImplementation()`. The whole point is to verify the real method handles edge cases.

2. **Real TracingOrchestrator**: Tests should use the real `TargetResolutionTracingOrchestrator` instance (can mock its dependencies, but not its methods)

3. **Edge cases covered**:
   - `actionContext: null` (spec Section 4.7)
   - `displayName: ''` (empty string) (spec workaround line 602)
   - `displayName: 123` (non-string) (spec workaround line 602)
   - Error from coordinator is `null` (spec Section 4.3)
   - Error from coordinator is string (spec Section 4.4)

4. **Test isolation**: Each test case should be independent and not rely on state from previous tests

5. **Graceful handling verification**: Tests should verify the stage continues processing (doesn't throw) and produces a defined result

## Dependencies

- MULTARRESROB-001 must be complete (tests verify the fix works in context)

## Blocked By

- MULTARRESROB-001

## Blocks

- Nothing (regression protection)

## Outcome

Added `tests/unit/actions/pipeline/stages/MultiTargetResolutionStage.edge-cases.test.js` to cover null actionContext, displayName fallback cases, and coordinator error propagation using the real tracing orchestrator. Left the legacy spy in the coverage test untouched per scope while documenting that it is now redundant after MULTARRESROB-001.
