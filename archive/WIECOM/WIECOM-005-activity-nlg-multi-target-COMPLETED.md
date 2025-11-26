# WIECOM-005: Activity NLG Multi-Target Support

**Status**: ✅ COMPLETED

## Summary

Modify `activityNLGSystem.js` to handle multi-target activities (activities with `isMultiTarget: true` and `targetEntityIds` array), generating natural language lists like "sword and dagger" or "sword, dagger, and staff".

## Dependencies

- WIECOM-004 must be completed (activity collection system must emit `isMultiTarget` and `targetEntityIds`)

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `src/anatomy/services/activityNLGSystem.js` | MODIFY | Add multi-target handling in `generateActivityPhrase` + helper method |
| `tests/unit/anatomy/services/activityNLGSystem.test.js` | MODIFY | Add 6 unit tests for multi-target support |

## Out of Scope

- **DO NOT** modify any mod data files (components, rules, manifests)
- **DO NOT** modify `activityMetadataCollectionSystem.js` (see WIECOM-004)
- **DO NOT** change existing single-target behavior
- **DO NOT** add any new dependencies
- **DO NOT** modify the class constructor or other methods beyond what's needed

> **Note**: Test file modifications ARE required per implementation request (consistent with WIECOM-004 pattern).

## Implementation Details

### Changes Required

1. **Add `#formatListWithConjunction` helper method** (private)
2. **Modify `generateActivityPhrase`** to detect and handle multi-target activities

### New Helper Method

Add a private method to format arrays as natural language lists:

```javascript
/**
 * Formats an array of items as a natural language list with conjunction.
 * @param {string[]} items - Array of items to format
 * @param {string} conjunction - Conjunction to use ('and', 'or')
 * @returns {string} Formatted list
 * @example
 * #formatListWithConjunction(['sword'], 'and') // 'sword'
 * #formatListWithConjunction(['sword', 'dagger'], 'and') // 'sword and dagger'
 * #formatListWithConjunction(['sword', 'dagger', 'staff'], 'and') // 'sword, dagger, and staff'
 */
#formatListWithConjunction(items, conjunction = 'and') {
  if (!Array.isArray(items) || items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items[items.length - 1]}`;
}
```

### Modify `generateActivityPhrase` (lines 346-464)

Add multi-target handling early in the method, before the existing `targetEntityId` resolution:

```javascript
generateActivityPhrase(
  actorRef,
  activity,
  usePronounsForTarget = false,
  options = {}
) {
  // NEW: Handle multi-target activities
  if (activity.isMultiTarget && Array.isArray(activity.targetEntityIds)) {
    const names = activity.targetEntityIds
      .map(id => this.resolveEntityName(id))
      .filter(name => name && name.trim());

    const formattedList = this.#formatListWithConjunction(names, 'and');

    if (activity.template) {
      const rawPhrase = activity.template
        .replace(/\{actor\}/g, actorRef)
        .replace(/\{targets\}/g, formattedList);
      return rawPhrase.trim();
    }

    // Fallback if no template
    return formattedList
      ? `${actorRef} is with ${formattedList}`.trim()
      : actorRef.trim();
  }

  // EXISTING: Single-target handling continues unchanged
  const targetEntityId = activity.targetEntityId || activity.targetId;
  // ... rest of existing method unchanged ...
}
```

## Acceptance Criteria

### Specific Tests That Must Pass

- ✅ Single weapon: `targetEntityIds: ['sword-1']` → "sword" in output
- ✅ Two weapons: `targetEntityIds: ['sword-1', 'dagger-2']` → "sword and dagger" in output
- ✅ Three weapons: `targetEntityIds: ['sword-1', 'dagger-2', 'staff-3']` → "sword, dagger, and staff" in output
- ✅ Empty array: `targetEntityIds: []` → no crash, graceful fallback
- ✅ Template replacement: `{targets}` placeholder is replaced with formatted list
- ✅ Non-multi-target activities continue to work unchanged

### Expected Output Examples

| Component State | Template | Expected Output |
|-----------------|----------|-----------------|
| `wielded_item_ids: ['sword-1']` | "{actor} is wielding {targets} threateningly" | "Alice is wielding sword threateningly" |
| `wielded_item_ids: ['sword-1', 'dagger-2']` | "{actor} is wielding {targets} threateningly" | "Alice is wielding sword and dagger threateningly" |
| `wielded_item_ids: ['sword-1', 'dagger-2', 'staff-3']` | "{actor} is wielding {targets} threateningly" | "Alice is wielding sword, dagger, and staff threateningly" |

### Invariants That Must Remain True

1. ✅ **Backward Compatibility**: All existing single-target activities MUST continue working exactly as before
2. ✅ `hugging` activity descriptions remain unchanged
3. ✅ `kneeling_before` activity descriptions remain unchanged
4. ✅ No new runtime errors for existing components
5. ✅ JSDoc types are updated appropriately
6. ✅ Logger usage follows existing patterns
7. ✅ `resolveEntityName` is used correctly for all entity ID lookups
8. ✅ Oxford comma is used for 3+ items ("a, b, and c" not "a, b and c")

### Unit Test Verification

Existing tests must continue passing:

```bash
NODE_ENV=test npx jest tests/unit/anatomy/services/activityNLGSystem.test.js --no-coverage
```

### Validation Commands

```bash
# TypeScript check
npm run typecheck

# Unit tests
NODE_ENV=test npx jest tests/unit/anatomy/services/ --no-coverage --silent

# ESLint
npx eslint src/anatomy/services/activityNLGSystem.js
```

## Diff Size Estimate

The diff should add approximately 40-50 lines:
- ~15 lines for `#formatListWithConjunction` helper (with JSDoc)
- ~20 lines for multi-target handling in `generateActivityPhrase`
- ~100 lines for unit tests (6 test cases)

---

## Outcome

### What Was Changed

1. **`src/anatomy/services/activityNLGSystem.js`** (~40 lines added):
   - Added `#formatListWithConjunction` private method (lines 479-484)
   - Added multi-target handling branch at start of `generateActivityPhrase` (lines 352-371)
   - Uses early return pattern to preserve single-target code path completely unchanged
   - Handles `{targets}` placeholder in templates
   - Provides fallback phrase when no template: `"{actor} is with {targets}"`

2. **`tests/unit/anatomy/services/activityNLGSystem.test.js`** (~100 lines added, 6 new tests):
   - `should format single item in targetEntityIds`
   - `should format two items with "and" conjunction`
   - `should format three items with Oxford comma`
   - `should handle empty targetEntityIds array gracefully`
   - `should use fallback phrase when no template provided`
   - `should not affect non-multi-target activities (backward compatibility)`

### Deviations from Original Plan

1. **Line numbers corrected**: Original ticket said lines 345-463; actual method spans lines 346-464 (off by 1)
2. **Test prohibition removed**: Original ticket said "DO NOT modify any test files" but user's implementation request explicitly required tests per WIECOM-004 pattern
3. **Diff size increased**: Original estimate was 25-35 lines; actual is ~40 lines in source plus ~100 lines of tests

### Validation Results

- ✅ 110 unit tests pass for `activityNLGSystem.test.js` (104 existing + 6 new)
- ✅ 658 anatomy service tests pass overall
- ✅ ESLint: 0 errors (1 pre-existing warning unrelated to changes)
- ✅ TypeScript: No new errors (pre-existing errors in cli/validation only)
- ✅ Backward compatibility: All existing single-target tests continue to pass

### New/Modified Tests

| Test | Rationale |
|------|-----------|
| `should format single item in targetEntityIds` | Verifies single-item arrays produce non-list output |
| `should format two items with "and" conjunction` | Verifies two-item conjunction without Oxford comma |
| `should format three items with Oxford comma` | Verifies Oxford comma usage per acceptance criteria |
| `should handle empty targetEntityIds array gracefully` | Edge case - prevents crashes |
| `should use fallback phrase when no template provided` | Covers no-template fallback path |
| `should not affect non-multi-target activities` | Critical backward compatibility verification |
