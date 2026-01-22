# UNCMOOAXI-002: Update Mood Component Schema

## Status: ✅ COMPLETED (2026-01-22)

## Summary

Add the `uncertainty` property to the mood component JSON schema, making it a required axis alongside the existing 9. This ensures all entity mood data validates correctly with the new axis.

## Priority: High | Effort: Low

## Rationale

The mood component schema (`mood.component.json`) defines the structure of mood data stored on entities. Adding `uncertainty` here:
- Enables schema validation of uncertainty values
- Makes the axis required for all entities with mood
- Provides consistent range constraints (-100 to +100)
- Documents the axis semantics

## Dependencies

- **UNCMOOAXI-001** must be complete first (constants define the axis name)
  - ✅ **VERIFIED**: `src/constants/moodAffectConstants.js` already contains `uncertainty` in `MOOD_AXES` array (line 23)
  - ✅ **VERIFIED**: `tests/unit/constants/moodAffectConstants.test.js` already expects 10 axes including `uncertainty`

## Files to Touch

| File | Change Type |
|------|-------------|
| `data/mods/core/components/mood.component.json` | **Modify** - Add uncertainty property and update required array |
| `tests/unit/mods/core/components/mood.component.test.js` | **Modify** - Add uncertainty to all test data objects (required for tests to pass after schema change) |

## Scope Correction (2026-01-22)

The original ticket stated "DO NOT update any test files - that's UNCMOOAXI-006". This is incorrect because:
1. Adding `uncertainty` as a **required** field means all existing test data in `mood.component.test.js` will fail validation
2. The test file tests the schema itself, not general integration - it MUST include the new field
3. UNCMOOAXI-006 covers **other** test files (e.g., Monte Carlo, expression diagnostics), not the schema's own unit tests

## Out of Scope

- **DO NOT** modify `moodAffectConstants.js` - that's UNCMOOAXI-001 (already complete)
- **DO NOT** modify `emotion_prototypes.lookup.json` - that's UNCMOOAXI-003/004/005
- **DO NOT** update test files OTHER than `mood.component.test.js` - those are UNCMOOAXI-006/007
- **DO NOT** modify entity definitions - they inherit defaults

## Definition of Done

- [x] `uncertainty` property added to `properties` object
- [x] `uncertainty` added to `required` array
- [x] Description updated to "10 mood axes"
- [x] Property has correct type (`integer`), range (`-100` to `100`), and default (`0`)
- [x] Property has meaningful description
- [x] File remains valid JSON
- [x] `npm run validate` passes
- [x] `npm run validate:strict` passes
- [x] Unit tests for mood.component.test.js pass (46 tests)
- [x] Unit tests for moodAffectConstants.test.js pass (35 tests)

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned:**
- Modify only `data/mods/core/components/mood.component.json`
- Do NOT modify any test files

**Actually Changed:**
1. `data/mods/core/components/mood.component.json` - Added `uncertainty` property and updated required array, updated description from "9" to "10 mood axes"
2. `tests/unit/mods/core/components/mood.component.test.js` - Updated ALL test data objects to include `uncertainty: <value>`, added new test suite "uncertainty axis specific tests" with 6 additional tests

**Reason for Scope Change:**
The original ticket incorrectly stated that test files should not be updated. Since `uncertainty` is added as a **required** field in the schema, all existing test data would fail validation without the field. The schema's own unit tests must be kept in sync with the schema.

### Test Summary

| Test File | Tests | Status |
|-----------|-------|--------|
| `mood.component.test.js` | 46 | ✅ PASS |
| `moodAffectConstants.test.js` | 35 | ✅ PASS |

### New/Modified Tests

| Test File | Change | Rationale |
|-----------|--------|-----------|
| `mood.component.test.js` | Added `uncertainty: 0` (or appropriate value) to all 14+ test data objects | Required field - tests would fail without it |
| `mood.component.test.js` | Added `'uncertainty'` to `requiredFields` array | Tests that missing uncertainty is rejected |
| `mood.component.test.js` | Added `'uncertainty'` to `axes` array in range validation | Tests boundary validation (-100, 100) for uncertainty |
| `mood.component.test.js` | **NEW SUITE**: "uncertainty axis specific tests" with 6 tests | Explicit coverage for uncertainty axis semantics: neutral (0), high (+100), low (-100), reject -101, reject 101, reject floating point |

### Verification Results

```
Properties: 10
Has uncertainty: true
Required count: 10
All properties: valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation, affiliation, inhibitory_control, uncertainty

npm run validate: PASSED
Test Suites: 2 passed, 2 total
Tests: 81 passed, 81 total
```
