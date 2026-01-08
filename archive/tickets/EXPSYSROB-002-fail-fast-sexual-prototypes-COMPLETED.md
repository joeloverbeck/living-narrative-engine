# EXPSYSROB-002: Fail-Fast for Sexual Prototype Keys [COMPLETED]

## Summary

Modify `EmotionCalculatorService.getSexualPrototypeKeys()` to throw `InvalidArgumentError` when sexual prototypes are unavailable or empty, instead of silently returning an empty array.

## Background

Mirror of EXPSYSROB-001 for sexual state prototypes. The `getSexualPrototypeKeys()` method has the same silent failure pattern that masks data loading issues.

## File List (Expected to Touch)

### Existing Files
- `src/emotions/emotionCalculatorService.js` (lines 615-624)
- `tests/unit/emotions/emotionCalculatorService.test.js` (lines 996-1019, specifically 1005-1018 for test to update)

## Out of Scope (MUST NOT Change)

- `getEmotionPrototypeKeys()` method (handled in EXPSYSROB-001)
- `ExpressionContextBuilder` (handled in EXPSYSROB-003)
- Calculation methods (`calculateEmotions()`, `calculateSexualStates()`)
- Lookup data files in `data/mods/core/lookups/`
- Integration tests (handled in EXPSYSROB-004)

## Implementation Details

1. In `getSexualPrototypeKeys()`:
   - When `#ensureSexualPrototypes()` returns null/undefined, throw `InvalidArgumentError` with message:
     ```
     EmotionCalculatorService: Required lookup "core:sexual_prototypes" not found in data registry.
     Ensure mods are loaded before using expression services.
     ```
   - When `Object.keys(prototypes)` returns empty array, throw `InvalidArgumentError` with message:
     ```
     EmotionCalculatorService: Sexual prototype lookup "core:sexual_prototypes" is empty.
     No prototype definitions found. Check the lookup file for valid entries.
     ```

2. `InvalidArgumentError` is already imported (added by EXPSYSROB-001)

3. Update existing unit tests:
   - Change test "should return empty array and log warning when prototypes unavailable" to expect thrown error
   - Add test for empty entries case

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPattern="emotionCalculatorService"`
2. New/updated tests:
   - `getSexualPrototypeKeys() should throw InvalidArgumentError when lookup missing`
   - `getSexualPrototypeKeys() should throw InvalidArgumentError when lookup has empty entries`
   - `getSexualPrototypeKeys() should return keys when lookup is valid`

### Invariants That Must Remain True

1. `getSexualPrototypeKeys()` never returns an empty array (either returns valid keys or throws)
2. Error messages include the lookup ID (`core:sexual_prototypes`)
3. Error messages include actionable guidance
4. `calculateSexualStates()` behavior is unchanged
5. Existing tests that mock `getSexualPrototypeKeys()` with valid keys continue to pass

## Outcome

**Status**: COMPLETED

**What Was Changed** (vs. Originally Planned):
1. **`src/emotions/emotionCalculatorService.js`** (lines 616-632):
   - Modified `getSexualPrototypeKeys()` to throw `InvalidArgumentError` when prototypes unavailable
   - Added second check to throw when `Object.keys(prototypes)` returns empty array
   - Error messages match the spec exactly with lookup ID and actionable guidance

2. **`tests/unit/emotions/emotionCalculatorService.test.js`** (lines 1005-1033):
   - Renamed test "should return empty array and log warning when prototypes unavailable" to "should throw InvalidArgumentError when lookup missing"
   - Added new test "should throw InvalidArgumentError when lookup has empty entries"
   - Both tests verify the `InvalidArgumentError` type and error message content

**Ticket Assumption Corrections**:
- Line numbers updated: original ticket said 609-618, actual code was at 615-624
- Test line numbers updated: original said 981-1004, actual relevant tests at 996-1019

**Tests Passing**:
- All 129 unit tests in `emotionCalculatorService.test.js` pass
- All 6 integration tests in `expressionFlow.integration.test.js` pass
- No regressions in related tests (expressionContextBuilder, expressionsRegistrations)

**Invariants Verified**:
- `getSexualPrototypeKeys()` now throws instead of returning empty array ✓
- Error messages include lookup ID `core:sexual_prototypes` ✓
- Error messages include actionable guidance ✓
- `calculateSexualStates()` behavior unchanged ✓
- Existing mocks in tests continue to work (they mock interface, not implementation) ✓
