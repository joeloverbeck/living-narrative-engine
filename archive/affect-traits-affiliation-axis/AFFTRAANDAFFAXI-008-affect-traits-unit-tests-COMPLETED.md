# AFFTRAANDAFFAXI-008: Create Affect Traits Unit Tests

**Status: COMPLETED**

## Summary

Create comprehensive unit tests for affect trait integration in `EmotionCalculatorService`. These tests verify the sociopath scenario, backwards compatibility, and trait gating behavior.

## Priority: High | Effort: Medium

## Rationale

The affect traits feature is the core fix for the sociopath scenario where characters incorrectly trigger compassion. We need thorough tests to ensure:
1. The sociopath scenario produces correct results (no compassion)
2. Backwards compatibility is maintained (default traits = 50)
3. Trait gates block emotions correctly
4. Trait weights contribute to intensity calculations

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/unit/emotions/emotionCalculatorService.affectTraits.test.js` | **Create** - New test file |

## Out of Scope

- **DO NOT** modify existing test file `emotionCalculatorService.test.js`
- **DO NOT** modify source code in `src/`
- **DO NOT** create integration tests - that's AFFTRAANDAFFAXI-014
- **DO NOT** test UI or diagnostics components

## Definition of Done

- [x] Test file created at correct path
- [x] All 6 describe blocks implemented:
  - [x] backwards compatibility (4 tests)
  - [x] compassion with affect traits (6 tests)
  - [x] sociopath scenario (5 tests)
  - [x] guilt calculation (3 tests)
  - [x] empathic distress calculation (1 test)
  - [x] trait normalization edge cases (3 tests)
- [x] All tests pass
- [x] Sociopath scenario specifically verified
- [x] No modifications to existing test files or source code

---

## Outcome

### What Was Actually Changed

**Created:**
- `tests/unit/emotions/emotionCalculatorService.affectTraits.test.js` - 22 new unit tests

### Test Results

```
PASS unit tests/unit/emotions/emotionCalculatorService.affectTraits.test.js
  EmotionCalculatorService - Affect Traits
    backwards compatibility
      ✓ uses default traits (50) when affectTraits is null
      ✓ uses default traits (50) when affectTraits is undefined
      ✓ uses default traits (50) when affectTraits is empty object
      ✓ calculates emotions identically for average traits vs no traits
    compassion with affect traits
      ✓ returns near-zero intensity when affective_empathy is 5
      ✓ returns moderate intensity when affective_empathy is 50
      ✓ returns high intensity when affective_empathy is 95
      ✓ blocks emotion when affective_empathy < 25 (gate fails)
      ✓ allows emotion when affective_empathy >= 25 (gate passes)
      ✓ incorporates affiliation mood axis in calculation
    sociopath scenario
      ✓ does not trigger compassion with high engagement but low affective_empathy
      ✓ does not trigger guilt despite negative self_evaluation scenario
      ✓ does not trigger empathic_distress despite high engagement
      ✓ still triggers pride (unaffected by affect traits)
      ✓ still triggers interest (unaffected by affect traits)
    guilt calculation
      ✓ requires both affective_empathy and harm_aversion for full intensity
      ✓ blocks guilt when affective_empathy gate fails
      ✓ allows guilt when affective_empathy gate passes
    empathic distress calculation
      ✓ requires moderate affective_empathy (>= 0.30)
    trait normalization edge cases
      ✓ handles trait values at minimum (0)
      ✓ handles trait values at maximum (100)
      ✓ handles partial trait objects (uses defaults for missing)

Tests: 22 passed, 22 total
```

### Verification

```bash
# All emotion tests pass together (128 total tests)
npm run test:unit -- --testPathPatterns="emotionCalculatorService" --verbose
# Result: 2 passed test suites, 128 tests passed
```

### Differences from Original Plan

The implementation exactly matched the ticket specification. The ticket's assumptions about the codebase were validated:
- `EmotionCalculatorService.calculateEmotions()` already supports `affectTraits` parameter
- `#normalizeAffectTraits()` method exists and works correctly
- `DEFAULT_AFFECT_TRAITS` constant defined with all 3 traits at 50
- Emotion prototypes (`compassion`, `empathic_distress`, `guilt`) have trait gates

No discrepancies required ticket corrections. Implementation was straightforward test creation only.

### Test Coverage Added

The 22 new tests specifically cover:
1. **Backwards compatibility** - Ensures entities without `core:affect_traits` component work correctly with default values
2. **Gate boundary testing** - Verifies exact threshold behavior (e.g., 24 vs 25 for `affective_empathy >= 0.25`)
3. **Sociopath scenario** - Core validation that low empathy blocks empathy-dependent emotions while allowing non-trait emotions
4. **Weight contribution** - Verifies traits affect intensity calculations, not just gates
5. **Edge cases** - Handles min/max values (0, 100) and partial trait objects
