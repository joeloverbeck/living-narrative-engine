# MULTARRESROB-002 – Add Null-Safety Property Tests for TracingOrchestrator

**Status: COMPLETED**

## Problem

After MULTARRESROB-001 fixes the null-safety issue, we need regression protection that explicitly covers arbitrary error inputs. The explicit null-safety cases are already covered in existing unit tests, but there is no fast-check property test to guard against unexpected inputs. Early property testing shows that some inputs (e.g. array-to-string coercion) can yield an empty error string, so we need a minimal normalization tweak to guarantee a non-empty error message.

## Proposed Scope

Add a fast-check property test to the existing `TargetResolutionTracingOrchestrator` unit test file, and adjust `captureResolutionError` to ensure the normalized error string is never empty (even if `String(error)` returns ''). The explicit null-safety parameterized cases already exist there, so we only need the property test plus the minimal normalization tweak.

## File List

- `tests/unit/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.test.js` (ADD property test)
- `src/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.js` (MINIMAL normalization tweak)

## Out of Scope

- Refactors or API changes to tracing methods (only a minimal normalization tweak is allowed)
- Refactoring or moving existing `captureResolutionError` tests
- Integration tests
- Other capture methods (only testing `captureResolutionError`)

## Acceptance Criteria

### Specific Tests That Must Pass

```bash
npm run test:unit -- tests/unit/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.test.js
```

### Invariants That Must Remain True

1. **Real service usage**: Tests must instantiate and use the real `TargetResolutionTracingOrchestrator`, not mocks

2. **Parameterized coverage**: All 7 explicit test cases from the spec must be present in the existing unit tests:
   - `null`
   - `undefined`
   - `'string error'` (string)
   - `{ scopeName: 'test:scope' }` (object without message)
   - `new Error('test')` (standard Error)
   - `123` (numeric)
   - `{}` (empty object)

3. **Property test inclusion**: Must include at least one fast-check property test using `fc.anything()` to generate arbitrary inputs

4. **No spy mocking**: Tests must NOT mock `captureResolutionError` itself (they're testing it)

5. **Test file location**: Property test is added to `tests/unit/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.test.js`

## Dependencies

- MULTARRESROB-001 (already completed; this ticket validates the behavior)

## Blocks

- Nothing (validation ticket)

## Outcome

Added a fast-check property test to the existing unit suite and tightened error normalization to guarantee non-empty error strings for arbitrary inputs (including array coercion), instead of introducing a separate null-safety test file.
