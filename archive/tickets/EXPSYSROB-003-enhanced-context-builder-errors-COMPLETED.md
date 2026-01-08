# EXPSYSROB-003: Enhanced Error Messages in ExpressionContextBuilder

**STATUS: ✅ COMPLETED**

## Summary

Improve error messages in `ExpressionContextBuilder.#assertStateCoverage()` to include root cause hints and distinguish between different failure scenarios.

## Background

After EXPSYSROB-001 and EXPSYSROB-002, `EmotionCalculatorService` will throw meaningful errors when prototypes are unavailable. However, `ExpressionContextBuilder` should still have improved error messages for the coverage mismatch case (when prototypes exist but calculator returns incomplete results).

## File List (Expected to Touch)

### Existing Files
- `src/expressions/expressionContextBuilder.js` (lines 128-164, `#assertStateCoverage` method)
- `tests/unit/expressions/expressionContextBuilder.test.js`

## Out of Scope (MUST NOT Change)

- `EmotionCalculatorService` (handled in EXPSYSROB-001/002)
- `buildContext()` method signature
- `ExpressionEvaluatorService`
- Integration tests (handled in EXPSYSROB-004)
- Test utilities (handled in EXPSYSROB-005)

## Implementation Details

1. In `#assertStateCoverage()`, enhance the coverage mismatch error (lines 149-163):
   - Current message:
     ```
     [ExpressionContextBuilder] {kind} evaluation missing prototype keys. Expected {n}, got {m}. Missing: {keys}
     ```
   - Enhanced message:
     ```
     [ExpressionContextBuilder] {kind} evaluation missing prototype keys. Expected {n}, got {m}. Missing: {keys}.
     This may indicate a mismatch between prototype lookup and calculator logic.
     ```

2. The "prototype lookup returned no keys" error (lines 142-146) should now be unreachable since EXPSYSROB-001/002 will throw first. Consider:
   - Keep the check as defensive programming
   - Update error message to indicate this is unexpected after fail-fast changes:
     ```
     [ExpressionContextBuilder] {kind} prototype lookup returned no keys.
     This is unexpected - EmotionCalculatorService should have thrown.
     Check that mocks provide non-empty prototype key arrays.
     ```

3. Update unit tests to verify new error message content

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPatterns="expressionContextBuilder"`
2. Updated tests:
   - Test for coverage mismatch error includes root cause hint
   - Test for empty keys error includes debugging guidance

### Invariants That Must Remain True

1. `buildContext()` signature unchanged
2. All existing ExpressionContextBuilder tests pass
3. Error messages use `[ExpressionContextBuilder]` prefix for grepability
4. Coverage validation logic remains the same (only messages change)

---

## Outcome

### What Was Changed

1. **`src/expressions/expressionContextBuilder.js`**:
   - Enhanced coverage mismatch error message (lines 159-163) to include root cause hint: "This may indicate a mismatch between prototype lookup and calculator logic."
   - Enhanced empty keys error message (lines 144-148) to include debugging guidance: "This is unexpected - EmotionCalculatorService should have thrown. Check that mocks provide non-empty prototype key arrays."

2. **`tests/unit/expressions/expressionContextBuilder.test.js`**:
   - Updated test "should throw when emotion results miss prototype keys" → renamed to "should throw when emotion results miss prototype keys with root cause hint" - uses regex to verify the enhanced message
   - Updated test "should throw when sexual state results miss prototype keys" → renamed to "should throw when sexual state results miss prototype keys with root cause hint" - uses regex to verify the enhanced message
   - Added new test "should throw with debugging guidance when prototype keys are empty" - verifies the defensive programming error message includes guidance about mocks

### Deviation from Original Plan

- **Ticket Line Numbers**: Original ticket referenced lines 142-163, but actual code was at lines 128-164. Ticket was corrected to reflect accurate line numbers before implementation.
- **No other deviations**: Implementation exactly matches the ticket specification.

### Tests Added/Modified

| Test | Rationale |
|------|-----------|
| `should throw when emotion results miss prototype keys with root cause hint` | Modified: Now verifies error includes "This may indicate a mismatch between prototype lookup and calculator logic" |
| `should throw when sexual state results miss prototype keys with root cause hint` | Modified: Same enhancement for sexual states coverage mismatch |
| `should throw with debugging guidance when prototype keys are empty` | New: Verifies the defensive programming error includes guidance about EmotionCalculatorService and mock configuration |

### Verification

- All 18 tests in `expressionContextBuilder.test.js` pass
- No new ESLint errors introduced (only pre-existing JSDoc warnings)
- Public API (`buildContext()` signature) unchanged
- Error prefix `[ExpressionContextBuilder]` preserved for grepability
