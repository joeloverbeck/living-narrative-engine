# AFFTRAANDAFFAXI-007: Update EmotionCalculatorService Calculation Methods

## Status: ✅ COMPLETED

## Summary

Update the method signatures and internal calculation logic in `EmotionCalculatorService` to integrate affect traits. This includes modifying `calculateEmotions`, `#calculatePrototypeIntensity`, `#resolveAxisValue`, and `#checkGates`.

## Priority: High | Effort: Medium

## Rationale

With the normalization foundation in place (AFFTRAANDAFFAXI-006), we can now integrate affect traits into the calculation pipeline. The key changes are:
1. Add optional 4th parameter to `calculateEmotions`
2. Pass trait axes through the calculation chain
3. Resolve trait axis values for weights and gates

**Note (Corrected)**: AFFTRAANDAFFAXI-006 already added the following foundation code:
- `AFFECT_TRAITS_COMPONENT_ID` constant (line 69)
- `DEFAULT_AFFECT_TRAITS` constant (lines 77-81)
- `#normalizeAffectTraits` method (lines 440-460)

These were marked with eslint-disable comments awaiting this ticket's implementation.

## Files Modified

| File | Change Type |
|------|-------------|
| `src/emotions/emotionCalculatorService.js` | **Modified** - Updated 4 method signatures to pass `traitAxes` |
| `tests/unit/emotions/emotionCalculatorService.test.js` | **No changes needed** - Existing tests use 3-arg calls which remain backward-compatible |

## Out of Scope

- **DO NOT** add new test cases for trait behavior - that's AFFTRAANDAFFAXI-008
- **DO NOT** modify diagnostics code - that's AFFTRAANDAFFAXI-009/010/011
- **DO NOT** modify UI code - that's AFFTRAANDAFFAXI-012/013
- **DO NOT** modify any data files (schemas, prototypes)

## Implementation Summary

### 1. Updated `calculateEmotions` Method (line ~594)
- Added optional 4th parameter: `affectTraits = null`
- Calls `#normalizeAffectTraits(affectTraits)` to get normalized trait axes
- Passes `traitAxes` to `#calculatePrototypeIntensity`

### 2. Updated `#calculatePrototypeIntensity` Method (line ~336)
- Added 4th parameter: `traitAxes = {}`
- Passes `traitAxes` to `#checkGates`
- Passes `traitAxes` to `#resolveAxisValue` in weight loop

### 3. Updated `#resolveAxisValue` Method (line ~248)
- Added 4th parameter: `traitAxes = {}`
- Resolution order: trait axes → sexual axes → mood axes (traits checked first)
- Supports: `affective_empathy`, `cognitive_empathy`, `harm_aversion`

### 4. Updated `#checkGates` Method (line ~275)
- Added 4th parameter: `traitAxes = {}`
- Passes `traitAxes` to `#resolveAxisValue` for gate evaluation

### 5. Removed eslint-disable Comments
- Removed `// eslint-disable-line no-unused-vars` from `AFFECT_TRAITS_COMPONENT_ID`
- Removed `// eslint-disable-next-line no-unused-private-class-members` from `#normalizeAffectTraits`

## Verification Results

### Tests
- **All 106 existing emotion tests pass** without modification
- Backwards compatibility confirmed: 3-argument calls work identically

### Linting
- **0 errors** in `emotionCalculatorService.js`
- 10 warnings (pre-existing JSDoc style issues, not related to this ticket)

### TypeScript
- Pre-existing type errors in other files (cli/validation, src/validation)
- No new type errors introduced by this ticket

## Definition of Done

- [x] `calculateEmotions` has optional 4th parameter `affectTraits = null`
- [x] `#calculatePrototypeIntensity` accepts and passes `traitAxes`
- [x] `#resolveAxisValue` checks trait axes first
- [x] `#checkGates` accepts and uses `traitAxes`
- [x] All JSDoc updated with new parameters
- [x] All existing tests pass without modification
- [x] `npx eslint src/emotions/emotionCalculatorService.js` passes (0 errors)

---

## Outcome

### What Was Originally Planned
The ticket planned to:
1. Add optional 4th parameter to `calculateEmotions`
2. Update 4 method signatures to pass `traitAxes` through the calculation chain
3. Modify `#resolveAxisValue` to check trait axes first
4. Remove eslint-disable comments from foundation code

### What Was Actually Changed
All planned changes were implemented as specified:
1. ✅ `calculateEmotions` now accepts optional `affectTraits` parameter
2. ✅ All 4 methods updated with `traitAxes` parameter
3. ✅ Resolution order implemented: trait → sexual → mood
4. ✅ Both eslint-disable comments removed

### Discrepancies Corrected Before Implementation
1. **Line numbers were inaccurate** - Ticket referenced outdated line numbers (e.g., ~528 vs actual ~578)
2. **Foundation code already existed** - AFFTRAANDAFFAXI-006 had already created the constants and normalization method
3. **Test file scope clarified** - Changed from "Modify" to "No changes needed" since existing tests are backwards compatible

### Notes
- The `AFFECT_TRAITS_COMPONENT_ID` constant generates an "assigned but never used" warning. This is expected since the constant is defined for future use when integrating with the component system (retrieving affect traits from entities). This ticket only adds the calculation pipeline support.
- New test cases for trait behavior will be added in AFFTRAANDAFFAXI-008.
