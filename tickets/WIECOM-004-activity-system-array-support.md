# WIECOM-004: Activity System Array Support

## Summary

Modify `activityMetadataCollectionSystem.js` to support array-based target roles (like `wielded_item_ids`), enabling multi-item activity descriptions.

## Dependencies

- None (can be done in parallel with WIECOM-001 through WIECOM-003)

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `src/anatomy/services/activityMetadataCollectionSystem.js` | MODIFY | Add array target role support in `#parseInlineMetadata` |

## Out of Scope

- **DO NOT** modify any mod data files (components, rules, manifests)
- **DO NOT** modify `activityNLGSystem.js` (see WIECOM-005)
- **DO NOT** modify any test files
- **DO NOT** change existing single-target behavior
- **DO NOT** add any new dependencies
- **DO NOT** modify the class constructor or other methods

## Implementation Details

### Current `#parseInlineMetadata` Method (lines 281-331)

The current implementation only handles single string targets:

```javascript
#parseInlineMetadata(componentId, componentData, activityMetadata) {
  const {
    template,
    targetRole = 'entityId',
    priority = 50,
  } = activityMetadata;

  // ...

  const rawTargetEntityId = componentData?.[targetRole];

  if (typeof rawTargetEntityId === 'string') {
    // handles single target
  }

  // ...

  return {
    type: 'inline',
    sourceComponent: componentId,
    sourceData: componentData,
    activityMetadata,
    conditions: activityMetadata?.conditions ?? null,
    targetEntityId,
    targetId: targetEntityId,
    priority,
    template,
    description: basicDescription,
  };
}
```

### Required Changes

1. Extract `targetRoleIsArray` from `activityMetadata`
2. Check if target value is an array when `targetRoleIsArray` is true
3. Return different structure for array targets with `targetEntityIds` and `isMultiTarget` fields
4. Preserve backward compatibility for single-target components

### Modified Logic (pseudo-code)

```javascript
#parseInlineMetadata(componentId, componentData, activityMetadata) {
  const {
    template,
    targetRole = 'entityId',
    targetRoleIsArray = false,  // NEW: extract this
    priority = 50,
  } = activityMetadata;

  if (!template) {
    this.#logger.warn(`Inline metadata missing template for ${componentId}`);
    return null;
  }

  const rawTargetValue = componentData?.[targetRole];

  // NEW: Handle array targets
  if (targetRoleIsArray && Array.isArray(rawTargetValue)) {
    // Validate array contents
    const validIds = rawTargetValue.filter(id =>
      typeof id === 'string' && id.trim().length > 0
    );

    const basicDescription = template
      .replace(/\{actor\}/g, '')
      .replace(/\{targets\}/g, '')
      .trim();

    return {
      type: 'inline',
      sourceComponent: componentId,
      sourceData: componentData,
      activityMetadata,
      conditions: activityMetadata?.conditions ?? null,
      targetEntityIds: validIds,      // NEW: array of IDs
      isMultiTarget: true,            // NEW: flag for NLG system
      priority,
      template,
      description: basicDescription,
    };
  }

  // EXISTING: Handle single string target (unchanged)
  if (typeof rawTargetValue === 'string') {
    // ... existing logic unchanged ...
  }

  // ... rest of method unchanged ...
}
```

## Acceptance Criteria

### Specific Tests That Must Pass

After WIECOM-007 creates tests:
- Single-target components continue to work unchanged
- Array target with `targetRoleIsArray: true` returns `{ isMultiTarget: true, targetEntityIds: [...] }`
- Empty arrays return `{ isMultiTarget: true, targetEntityIds: [] }`
- Invalid array items (non-strings, empty strings) are filtered out
- Missing `targetRoleIsArray` defaults to `false` (single-target behavior)

### Invariants That Must Remain True

1. **Backward Compatibility**: All existing single-target components MUST continue working exactly as before
2. `hugging.component.json` activity descriptions remain unchanged
3. `kneeling_before.component.json` activity descriptions remain unchanged
4. No new runtime errors for existing components
5. JSDoc types are updated appropriately
6. Logger usage follows existing patterns
7. No changes to method signature

### Unit Test Verification

Existing tests in `tests/unit/anatomy/services/activityMetadataCollectionSystem.test.js` must continue passing:

```bash
NODE_ENV=test npx jest tests/unit/anatomy/services/activityMetadataCollectionSystem.test.js --no-coverage
```

### Validation Commands

```bash
# TypeScript check
npm run typecheck

# Unit tests
NODE_ENV=test npx jest tests/unit/anatomy/services/ --no-coverage --silent

# ESLint
npx eslint src/anatomy/services/activityMetadataCollectionSystem.js
```

## Diff Size Estimate

The diff should modify approximately 20-30 lines within the `#parseInlineMetadata` method.
