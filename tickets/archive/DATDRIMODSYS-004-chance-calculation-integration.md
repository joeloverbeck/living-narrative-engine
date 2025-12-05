# DATDRIMODSYS-004: Integrate ChanceCalculationService with Multi-Target Modifiers

**Status**: ✅ COMPLETED

## Summary

Update `ChanceCalculationService.js` to pass secondary and tertiary target IDs to the modifier collection system, enabling modifiers that depend on multiple targets. Also expose active modifier tags in the display result for template rendering.

## File List

Files to modify:
- `src/combat/services/ChanceCalculationService.js` (update method signatures and calls)

## Assumption Validation (Pre-Implementation)

The following assumptions from the original ticket were validated against the actual codebase:

### ✅ Validated Assumptions:
1. `ChanceCalculationService.calculateForDisplay` uses `targetId` (not `primaryTargetId`) in its public API - **CORRECT**
2. The service needs to add `activeTags` extraction - **CORRECT, not currently present**
3. The service needs to add `secondaryTargetId` and `tertiaryTargetId` parameter support - **CORRECT**

### 📝 Clarifications:
1. `ModifierCollectorService.collectModifiers` **ALREADY** accepts `{ actorId, primaryTargetId, secondaryTargetId, tertiaryTargetId, actionConfig }` - no changes needed there
2. The current code at line 158 already maps `targetId` → `primaryTargetId` when calling collector
3. The `DisplayResult` and `OutcomeResult` typedefs need updating to include `activeTags`

### Minimal Changes Required:
1. Add `secondaryTargetId`, `tertiaryTargetId` parameters to `calculateForDisplay` and `resolveOutcome`
2. Pass these through to `modifierCollectorService.collectModifiers`
3. Add `#extractActiveTags` private method
4. Include `activeTags` in return objects
5. Maintain backward compatibility with existing `targetId` parameter

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned:**
- Update method signatures to add multi-target support
- Add `#extractActiveTags` helper method
- Add `activeTags` to both DisplayResult and OutcomeResult
- Maintain backward compatibility with `targetId`

**Actually Changed:**
All planned changes were implemented as specified:

1. **`ChanceCalculationService.js`**:
   - Updated `calculateForDisplay` method signature to accept `{ actorId, targetId, primaryTargetId, secondaryTargetId, tertiaryTargetId, actionDef }`
   - Updated `resolveOutcome` method signature with same parameters
   - Added backward compatibility: `const resolvedPrimaryTargetId = primaryTargetId ?? targetId;`
   - Passes all target IDs to `modifierCollectorService.collectModifiers`
   - Added `#extractActiveTags(modifiers)` private method with robust filtering:
     - Filters null/undefined tags
     - Filters non-string tags
     - Filters empty/whitespace-only strings
   - Updated `DisplayResult` typedef to include `activeTags: string[]`
   - Updated `OutcomeResult` typedef to include `activeTags: string[]`
   - Both return types now always include `activeTags` (empty array for non-chance-based actions)

2. **`ChanceCalculationService.test.js`**:
   - Updated 4 existing tests to expect `activeTags: []` in results
   - Added new test suite "multi-target parameter passing (DATDRIMODSYS-004)" with 7 tests:
     - `should pass primaryTargetId to modifier collector`
     - `should pass secondaryTargetId to modifier collector`
     - `should pass tertiaryTargetId to modifier collector`
     - `should pass all target IDs together to modifier collector`
     - `should support legacy targetId parameter (backward compatibility)`
     - `should prefer primaryTargetId over targetId when both provided`
     - `should pass multi-target IDs through resolveOutcome`
   - Added new test suite "activeTags extraction (DATDRIMODSYS-004)" with 9 tests:
     - `should extract active tags from modifiers`
     - `should return empty activeTags when no modifiers have tags`
     - `should return empty activeTags when modifiers array is empty`
     - `should return empty activeTags when modifiers is undefined`
     - `should filter out modifiers with null tags`
     - `should filter out modifiers with empty string tags`
     - `should filter out non-string tags`
     - `should include activeTags in outcome result`
     - `should return empty activeTags in outcome for non-chance-based actions`

### Test Results
- All 61 ChanceCalculationService tests pass
- All 255 combat unit tests pass

### Files Modified
- `src/combat/services/ChanceCalculationService.js` - Code changes
- `tests/unit/combat/services/ChanceCalculationService.test.js` - Test updates and additions

### New/Modified Tests Rationale

| Test | Rationale |
|------|-----------|
| `should pass primaryTargetId to modifier collector` | Verifies primary target flows through to collector |
| `should pass secondaryTargetId to modifier collector` | Verifies secondary target is passed (new capability) |
| `should pass tertiaryTargetId to modifier collector` | Verifies tertiary target is passed (new capability) |
| `should pass all target IDs together` | Verifies full multi-target integration works |
| `should support legacy targetId parameter` | Critical backward compatibility verification |
| `should prefer primaryTargetId over targetId` | Documents precedence behavior when both provided |
| `should pass multi-target IDs through resolveOutcome` | Verifies resolveOutcome also passes multi-target |
| `should extract active tags from modifiers` | Core activeTags functionality |
| `should return empty activeTags when no modifiers have tags` | Edge case: modifiers without tags |
| `should return empty activeTags when modifiers array is empty` | Edge case: no modifiers |
| `should return empty activeTags when modifiers is undefined` | Edge case: undefined modifiers |
| `should filter out modifiers with null tags` | Robustness: null tag handling |
| `should filter out modifiers with empty string tags` | Robustness: empty/whitespace tag handling |
| `should filter out non-string tags` | Robustness: non-string type handling |
| `should include activeTags in outcome result` | Verifies activeTags in resolveOutcome |
| `should return empty activeTags in outcome for non-chance-based actions` | Edge case: disabled chanceBased |

## Dependencies

- **Depends on**: DATDRIMODSYS-003 (ModifierCollectorService must accept multi-target params) ✅ COMPLETED
- **Blocks**: DATDRIMODSYS-005 (Tag display needs activeTags from this service)

## Notes

- The `activeTags` array preserves order of modifiers (may be useful for UI display)
- Empty tags and whitespace-only tags are filtered out
- Non-string tags are also filtered out for robustness
- The backward compatibility for `targetId` → `primaryTargetId` was implemented as recommended
- The `DisplayResult` and `OutcomeResult` types were updated in JSDoc in the service file
