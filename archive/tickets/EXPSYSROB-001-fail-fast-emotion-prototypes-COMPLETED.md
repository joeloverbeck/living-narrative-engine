# EXPSYSROB-001: Fail-Fast for Emotion Prototype Keys

**Status: ✅ COMPLETED**

## Summary

Modify `EmotionCalculatorService.getEmotionPrototypeKeys()` to throw `InvalidArgumentError` when emotion prototypes are unavailable or empty, instead of silently returning an empty array.

## Background

Currently, when `core:emotion_prototypes` lookup is missing or empty, `getEmotionPrototypeKeys()` returns `[]` and logs a warning. This causes a cryptic downstream error in `ExpressionContextBuilder`: `"[ExpressionContextBuilder] emotions prototype lookup returned no keys."` The error message doesn't indicate whether the problem is a missing lookup, an empty lookup, or a test infrastructure issue.

## File List (Expected to Touch)

### Existing Files
- `src/emotions/emotionCalculatorService.js` (lines 593-602)
- `tests/unit/emotions/emotionCalculatorService.test.js` (lines 952-979)

## Out of Scope (MUST NOT Change)

- `getSexualPrototypeKeys()` method (handled in EXPSYSROB-002)
- `ExpressionContextBuilder` (handled in EXPSYSROB-003)
- Calculation methods (`calculateEmotions()`, `calculateSexualStates()`)
- Lookup data files in `data/mods/core/lookups/`
- Integration tests (handled in EXPSYSROB-004)

## Implementation Details

1. In `getEmotionPrototypeKeys()`:
   - When `#ensureEmotionPrototypes()` returns null/undefined, throw `InvalidArgumentError` with message:
     ```
     EmotionCalculatorService: Required lookup "core:emotion_prototypes" not found in data registry.
     Ensure mods are loaded before using expression services.
     ```
   - When `Object.keys(prototypes)` returns empty array, throw `InvalidArgumentError` with message:
     ```
     EmotionCalculatorService: Emotion prototype lookup "core:emotion_prototypes" is empty.
     No prototype definitions found. Check the lookup file for valid entries.
     ```

2. Import `InvalidArgumentError` from `src/errors/invalidArgumentError.js`

3. Update existing unit tests:
   - Change test "should return empty array and log warning when prototypes unavailable" to expect thrown error
   - Add test for empty entries case

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPattern="emotionCalculatorService"`
2. New/updated tests:
   - `getEmotionPrototypeKeys() should throw InvalidArgumentError when lookup missing`
   - `getEmotionPrototypeKeys() should throw InvalidArgumentError when lookup has empty entries`
   - `getEmotionPrototypeKeys() should return keys when lookup is valid`

### Invariants That Must Remain True

1. `getEmotionPrototypeKeys()` never returns an empty array (either returns valid keys or throws)
2. Error messages include the lookup ID (`core:emotion_prototypes`)
3. Error messages include actionable guidance
4. `calculateEmotions()` behavior is unchanged (still uses `#ensureEmotionPrototypes()` internally)
5. Existing tests that mock `getEmotionPrototypeKeys()` with valid keys continue to pass

---

## Outcome

### What Was Actually Changed

**Source Code:**
- `src/emotions/emotionCalculatorService.js` lines 592-608: Modified `getEmotionPrototypeKeys()` to throw `InvalidArgumentError` instead of returning empty array

**Unit Tests:**
- `tests/unit/emotions/emotionCalculatorService.test.js` lines 965-993:
  - Replaced test "should return empty array and log warning when prototypes unavailable" → "should throw InvalidArgumentError when lookup missing"
  - Added new test "should throw InvalidArgumentError when lookup has empty entries"

### Differences from Original Plan

None - implementation matched the ticket exactly:
- `InvalidArgumentError` was already imported in the file (no import needed)
- Error messages match the specified format
- Both failure modes (lookup missing, lookup empty) now throw with descriptive errors
- Public API preserved (method signature unchanged)
- All existing tests pass, including expression flow integration tests

### Tests Summary

| Test | Rationale |
|------|-----------|
| `should throw InvalidArgumentError when lookup missing` | Ensures fail-fast when data registry doesn't have the emotion prototypes lookup |
| `should throw InvalidArgumentError when lookup has empty entries` | Ensures fail-fast when lookup exists but contains no prototype definitions |
| `should return emotion prototype keys when available` (existing) | Confirms happy path still works |

### Verification

- ✅ `npm run test:unit -- --runInBand --testPathPatterns="emotionCalculatorService"` - PASS
- ✅ `npm run test:integration -- --runInBand --testPathPatterns="expressionFlow"` - 6 tests PASS
