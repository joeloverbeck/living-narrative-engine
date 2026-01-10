# AFFTRAANDAFFAXI-009: Update WitnessState Model

## Status: ✅ COMPLETED

## Summary

Update the `WitnessState` class to include:
1. The `affiliation` mood axis (8th axis, already in `mood.component.json`)
2. Affect traits (`affective_empathy`, `cognitive_empathy`, `harm_aversion`) alongside mood and sexual state axes

This enables the diagnostics tools to generate and manipulate trait values when testing expression triggering, and ensures WitnessState stays in sync with the mood component schema.

## Priority: Medium | Effort: Medium

## Rationale

The `WitnessState` model is used by diagnostics tools (MonteCarloSimulator, WitnessStateFinder) to represent mood/sexual states that cause expressions to trigger. To test affect trait-based gates (like `affective_empathy >= 0.25`) and affiliation-based weights, the model needs to include both:
- The `affiliation` mood axis (already added to `mood.component.json` but missing from `WitnessState.MOOD_AXES`)
- Affect trait values as a new dimension

## Files Touched

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/models/WitnessState.js` | **Modified** - Added `affiliation` to MOOD_AXES, added affectTraits property and methods |
| `tests/unit/expressionDiagnostics/models/WitnessState.test.js` | **Modified** - Updated mood axes count (7→8), added comprehensive tests for trait support |

## Out of Scope

- **DO NOT** modify MonteCarloSimulator - that's AFFTRAANDAFFAXI-010
- **DO NOT** modify WitnessStateFinder - that's AFFTRAANDAFFAXI-011
- **DO NOT** modify UI components - that's AFFTRAANDAFFAXI-012/013
- **DO NOT** modify EmotionCalculatorService - that's AFFTRAANDAFFAXI-006/007
- **DO NOT** add actual expression testing - model changes only

---

## Outcome

### Changes Implemented

All planned changes were successfully implemented:

**WitnessState.js:**
- ✅ `MoodState` typedef updated to 8 axes (added `affiliation` property)
- ✅ `MOOD_AXES` updated to include `affiliation` (8 axes total)
- ✅ `AFFECT_TRAIT_AXES` constant added with Object.freeze
- ✅ `TRAIT_RANGE` constant added with Object.freeze (`{ min: 0, max: 100 }`)
- ✅ `AffectTraitsState` typedef added
- ✅ `#affectTraits` private field added
- ✅ Constructor accepts optional `affectTraits` parameter (defaults to 50 for all traits)
- ✅ `get affectTraits()` getter implemented (returns defensive copy)
- ✅ `getTraitAxis(axis)` method implemented
- ✅ `withChanges()` updated to handle affectTraits
- ✅ `toDisplayString()` updated to include "Affect Traits" section
- ✅ `toJSON()` and `toClipboardJSON()` updated to include affectTraits
- ✅ `fromJSON()` updated with backwards compatibility (uses defaults if null)
- ✅ `createRandom()` generates random traits in [0, 100]
- ✅ `createNeutral()` uses 50 for all traits
- ✅ `#validateAffectTraits()` validation method implemented (integer, range check)
- ✅ Constants exported on WitnessState class

**WitnessState.test.js:**
- ✅ Updated `createValidMood()` helper to include `affiliation: 0`
- ✅ Updated "MOOD_AXES should contain all 8 axes" test
- ✅ Updated "should include all 8 mood axes" test in toDisplayString
- ✅ Added test for AFFECT_TRAIT_AXES constant (frozen, correct values)
- ✅ Added test for TRAIT_RANGE constant (frozen, correct range)
- ✅ Added comprehensive "Affect Traits" test suite covering:
  - Default traits when not provided (50)
  - Default traits when explicitly null (50)
  - Custom traits acceptance
  - Boundary values (0 and 100)
  - Range validation errors
  - Type validation errors
  - Integer validation errors
  - `getTraitAxis()` accessor
  - `affectTraits` getter immutability
  - `withChanges()` for affectTraits
  - `toJSON()` includes affectTraits
  - `toClipboardJSON()` includes affectTraits
  - `fromJSON()` roundtrip preserves traits
  - `fromJSON()` backwards compatibility (defaults when missing)
  - `createRandom()` generates valid traits
  - `createNeutral()` uses 50 for all traits
  - toDisplayString includes affect trait section

### Verification Results

```bash
# All 158 tests pass
npm run test:unit -- --testPathPatterns="WitnessState" --verbose
# ✅ PASS - 158 tests in 21 test suites

# ESLint passes
npx eslint src/expressionDiagnostics/models/WitnessState.js
# ✅ PASS - No errors

# TypeScript type checking
npm run typecheck
# ⚠️ Pre-existing errors in unrelated files (violationReporter.js, visualPropertiesValidator.js)
# No new errors introduced by these changes
```

### Backwards Compatibility

- ✅ Existing code creating WitnessState without `affectTraits` continues to work
- ✅ Default traits = 50 when `affectTraits` is null/omitted
- ✅ `fromJSON()` handles old JSON without affectTraits field

### Definition of Done Checklist

- [x] `MoodState` typedef updated to 8 axes (added `affiliation` property)
- [x] `MOOD_AXES` updated to include `affiliation` (8 axes total)
- [x] `AFFECT_TRAIT_AXES` constant added with Object.freeze
- [x] `TRAIT_RANGE` constant added with Object.freeze
- [x] `AffectTraitsState` typedef added
- [x] `#affectTraits` private field added
- [x] Constructor accepts optional `affectTraits` parameter
- [x] `get affectTraits()` getter implemented
- [x] `getTraitAxis(axis)` method implemented
- [x] `withChanges` updated to handle affectTraits
- [x] `toDisplayString` updated to include traits
- [x] `toJSON` and `toClipboardJSON` updated
- [x] `fromJSON` updated with backwards compatibility
- [x] `createRandom` generates random traits
- [x] `createNeutral` uses 50 for all traits
- [x] `#validateAffectTraits` validation method implemented
- [x] Constants exported on WitnessState class
- [x] All existing tests pass
- [x] JSDoc documentation complete

### Completion Date

2026-01-10
