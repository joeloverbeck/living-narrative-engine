# MULTARRESROB-003 – Add Result Envelope Contract Tests

## Status

Completed

## Problem

Services in the multi-target resolution pipeline use inconsistent result envelope formats:
- `TargetResolutionCoordinator` returns a `PipelineResult` (with `{ success, data, errors, continueProcessing }`)
- `TargetResolutionService` (ITargetResolutionService) returns an `ActionResult` (with `{ success, value, errors }`)

This inconsistency was discovered during coverage testing when mock format mismatches caused silent test failures. We need explicit contract tests that document and enforce these formats.

## Proposed Scope

Create a contract test file that explicitly tests the result envelope structure of each service, per spec Section 5.2:

```javascript
describe('Result Envelope Contract', () => {
  describe('TargetResolutionCoordinator', () => {
    it('returns PipelineResult { success, data } on success', async () => {
      const result = await coordinator.coordinateResolution(context, trace);
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      if (result.success) {
        expect(result).toHaveProperty('data');
      }
    });

    it('returns PipelineResult { success: false, errors } on failure', async () => {
      // Setup failure scenario
      const result = await coordinator.coordinateResolution(failingContext, trace);
      expect(result.success).toBe(false);
      expect(result).toHaveProperty('errors');
    });
  });

  describe('ITargetResolutionService (TargetResolutionService)', () => {
    it('returns ActionResult { success, value } envelope on success', async () => {
      const result = await targetResolver.resolveTargets(scope, actor, context, trace, actionId);
      expect(result).toHaveProperty('success');
      if (result.success) {
        expect(result).toHaveProperty('value');
        expect(Array.isArray(result.value)).toBe(true);
      }
    });
  });
});
```

## File List

- `tests/unit/actions/pipeline/services/implementations/ResultEnvelopeContract.test.js` (NEW)

## Out of Scope

- Production code changes (this documents existing contracts, doesn't change them)
- Changing the envelope format of any service
- Modifying existing test files
- Testing services not in the target resolution pipeline

## Acceptance Criteria

### Specific Tests That Must Pass

```bash
npm run test:unit -- tests/unit/actions/pipeline/services/implementations/ResultEnvelopeContract.test.js
```

### Invariants That Must Remain True

1. **Documentation purpose**: Tests document the CURRENT contract, they don't enforce a new one. If a test fails, investigate whether the service changed (update test) or if there's a regression (fix service).

2. **Coordinator contract**: `TargetResolutionCoordinator.coordinateResolution()` must return a `PipelineResult`:
   ```typescript
   { success: boolean; data?: object; errors?: Array<object>; continueProcessing?: boolean }
   ```

3. **TargetResolver contract**: `ITargetResolutionService.resolveTargets()` must return:
   ```typescript
   { success: boolean; value?: any[]; errors?: Error[] }
   ```

4. **No mock-only testing**: At least one test per service should exercise the real service with minimal mocking (can mock dependencies but not the service under test)

5. **Type assertions**: Tests must verify `typeof result.success === 'boolean'` (not just truthy/falsy)

## Dependencies

- None (independent contract documentation)

## Blocked By

- Nothing

## Blocks

- MULTARRESROB-006 (informs what assertions to add)

## Outcome

- Added a contract test that asserts `PipelineResult` and `ActionResult` envelope shapes using real services with mocked dependencies.
- Updated the ticket assumptions to match the actual coordinator/result types (PipelineResult vs ActionResult) and test location.
