# MULTARRESROB-006 – Add Result Type Assertions

## Problem

Services in the multi-target resolution pipeline don't validate result envelope structure at runtime. When a service returns an unexpected format (e.g., `{ data: {...} }` instead of `{ success: true, data: {...} }`), the consumer may silently fail or produce confusing errors downstream.

## Updated Assumptions

- The coordinator does **not** call a `targetResolver` directly; it relies on `unifiedScopeResolver.resolve(...)` inside `#resolveScope`.
- `MultiTargetResolutionStage` consumes two result envelopes: legacy `targetResolver.resolveTargets(...)` and modern `coordinateResolution(...)`.

## Proposed Scope

Add defensive assertions per spec Section 6.3:

### In TargetResolutionCoordinator

```javascript
// After calling unifiedScopeResolver.resolve
const result = await this.#unifiedScopeResolver.resolve(...);
if (typeof result?.success !== 'boolean') {
  throw new Error(
    `UnifiedScopeResolver.resolve must return { success: boolean } envelope`
  );
}
```

### In MultiTargetResolutionStage (legacy path)

```javascript
// After calling targetResolver
const result = await this.#targetResolver.resolveTargets(...);
if (typeof result?.success !== 'boolean') {
  throw new Error(
    `TargetResolver must return { success: boolean } envelope`
  );
}
```

### In MultiTargetResolutionStage (modern path)

```javascript
// After calling coordinator
const coordinatorResult = await this.#targetResolutionCoordinator.coordinateResolution(context, trace);
if (typeof coordinatorResult?.success !== 'boolean') {
  throw new Error(
    `Coordinator must return { success: boolean } envelope`
  );
}
```

## File List

- `src/actions/pipeline/services/implementations/TargetResolutionCoordinator.js`
- `src/actions/pipeline/stages/MultiTargetResolutionStage.js`

## Out of Scope

- `TargetResolutionTracingOrchestrator` (doesn't consume envelopes)
- `TargetResolutionResultBuilder` (produces envelopes, doesn't consume)
- Changing the envelope format (assertions document current contract)

## Acceptance Criteria

### Specific Tests That Must Pass

```bash
npm run test:unit -- tests/unit/actions/pipeline/
npm run test:integration -- tests/integration/actions/pipeline/
```

### Invariants That Must Remain True

1. **Assert pattern**: Use Node.js built-in `assert` or a descriptive error throw:
   ```javascript
   import assert from 'assert';
   // or
   if (typeof result?.success !== 'boolean') {
     throw new Error('Service contract violation: ...');
   }
   ```

2. **Minimal assertions**: Only add assertions where services consume results from other services. Don't add assertions to every variable.

3. **Descriptive error messages**: Assertions should include the expected format and (when safe) the actual value received

4. **No behavior change**: Assertions are defensive. When the envelope is correct (which it should be), behavior is unchanged.

5. **Existing tests pass**: All existing tests must pass. If a test fails, the mock was returning an incorrect envelope (fix the mock, not the assertion). Add targeted tests if the envelope contract was not already covered.

6. **Performance consideration**: Assertions should be lightweight. Don't stringify large objects in the happy path.

## Dependencies

- None (independent defensive programming)
- MULTARRESROB-003 informs what assertions to check

## Blocked By

- Nothing (can be done in parallel with test tickets)

## Blocks

- Nothing

## Status

Completed

## Outcome

- Added runtime envelope assertions for `unifiedScopeResolver.resolve`, `targetResolver.resolveTargets`, and `coordinateResolution` consumers.
- Added edge-case tests to confirm invalid envelopes are recorded as errors during stage execution.
