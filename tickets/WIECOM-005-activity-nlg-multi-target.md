# WIECOM-005: Activity NLG Multi-Target Support

## Summary

Modify `activityNLGSystem.js` to handle multi-target activities (activities with `isMultiTarget: true` and `targetEntityIds` array), generating natural language lists like "sword and dagger" or "sword, dagger, and staff".

## Dependencies

- WIECOM-004 must be completed (activity collection system must emit `isMultiTarget` and `targetEntityIds`)

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `src/anatomy/services/activityNLGSystem.js` | MODIFY | Add multi-target handling in `generateActivityPhrase` + helper method |

## Out of Scope

- **DO NOT** modify any mod data files (components, rules, manifests)
- **DO NOT** modify `activityMetadataCollectionSystem.js` (see WIECOM-004)
- **DO NOT** modify any test files
- **DO NOT** change existing single-target behavior
- **DO NOT** add any new dependencies
- **DO NOT** modify the class constructor or other methods beyond what's needed

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

### Modify `generateActivityPhrase` (lines 345-463)

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

After WIECOM-007 creates tests:
- Single weapon: `targetEntityIds: ['sword-1']` → "sword" in output
- Two weapons: `targetEntityIds: ['sword-1', 'dagger-2']` → "sword and dagger" in output
- Three weapons: `targetEntityIds: ['sword-1', 'dagger-2', 'staff-3']` → "sword, dagger, and staff" in output
- Empty array: `targetEntityIds: []` → no crash, graceful fallback
- Template replacement: `{targets}` placeholder is replaced with formatted list
- Non-multi-target activities continue to work unchanged

### Expected Output Examples

| Component State | Template | Expected Output |
|-----------------|----------|-----------------|
| `wielded_item_ids: ['sword-1']` | "{actor} is wielding {targets} threateningly" | "Alice is wielding sword threateningly" |
| `wielded_item_ids: ['sword-1', 'dagger-2']` | "{actor} is wielding {targets} threateningly" | "Alice is wielding sword and dagger threateningly" |
| `wielded_item_ids: ['sword-1', 'dagger-2', 'staff-3']` | "{actor} is wielding {targets} threateningly" | "Alice is wielding sword, dagger, and staff threateningly" |

### Invariants That Must Remain True

1. **Backward Compatibility**: All existing single-target activities MUST continue working exactly as before
2. `hugging` activity descriptions remain unchanged
3. `kneeling_before` activity descriptions remain unchanged
4. No new runtime errors for existing components
5. JSDoc types are updated appropriately
6. Logger usage follows existing patterns
7. `resolveEntityName` is used correctly for all entity ID lookups
8. Oxford comma is used for 3+ items ("a, b, and c" not "a, b and c")

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

The diff should add approximately 25-35 lines:
- ~10 lines for `#formatListWithConjunction` helper
- ~15-20 lines for multi-target handling in `generateActivityPhrase`
