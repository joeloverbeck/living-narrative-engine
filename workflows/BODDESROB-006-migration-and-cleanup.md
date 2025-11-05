# BODDESROB-006: Migrate Existing Code and Clean Up Duplicated Metadata

**Status**: TODO
**Priority**: MEDIUM
**Phase**: 4 (Migration and Cleanup)
**Estimated Effort**: 1-2 days
**Dependencies**: BODDESROB-001, BODDESROB-003

## Overview

Migrate existing code to use the centralized registry and remove duplicated metadata definitions. This cleanup ensures the registry is the single source of truth and eliminates maintenance burden from keeping multiple files synchronized.

## Problem Context

Before the registry was created, body descriptor metadata was duplicated across:
- `src/anatomy/constants/bodyDescriptorConstants.js` (constants and metadata)
- Hardcoded lists in various files
- Individual extraction methods

After registry implementation, this duplication needs to be removed to:
- Eliminate synchronization burden
- Establish registry as single source of truth
- Reduce code maintenance
- Improve clarity and consistency

## Acceptance Criteria

- [ ] `bodyDescriptorConstants.js` updated to export/use registry
- [ ] Remove duplicate constant definitions
- [ ] Update all imports to use registry
- [ ] Remove hardcoded descriptor lists
- [ ] Add deprecation notices where appropriate
- [ ] All references to old constants updated
- [ ] All tests updated and passing
- [ ] No breaking changes to public API
- [ ] Backward compatibility maintained where needed
- [ ] Documentation updated to reference registry

## Technical Details

### Current State: bodyDescriptorConstants.js

```javascript
// src/anatomy/constants/bodyDescriptorConstants.js (before)

export const BODY_BUILD_TYPES = [
  'skinny', 'slim', 'lissom', 'toned', 'athletic',
  'shapely', 'hourglass', 'thick', 'muscular', 'hulking', 'stocky'
];

export const BODY_HAIR_DENSITY = [
  'hairless', 'sparse', 'light', 'moderate', 'hairy', 'very-hairy'
];

export const BODY_COMPOSITION_TYPES = [
  'underweight', 'lean', 'average', 'soft', 'chubby', 'overweight', 'obese'
];

export const HEIGHT_CATEGORIES = [
  'gigantic', 'very-tall', 'tall', 'average', 'short', 'petite', 'tiny'
];

export const DESCRIPTOR_METADATA = {
  build: { label: 'Build', validValues: BODY_BUILD_TYPES },
  hairDensity: { label: 'Body hair', validValues: BODY_HAIR_DENSITY },
  composition: { label: 'Body composition', validValues: BODY_COMPOSITION_TYPES },
  height: { label: 'Height', validValues: HEIGHT_CATEGORIES },
  skinColor: { label: 'Skin color', validValues: null },
  smell: { label: 'Smell', validValues: null },
};
```

### Target State: bodyDescriptorConstants.js

```javascript
// src/anatomy/constants/bodyDescriptorConstants.js (after)

/**
 * @file Body descriptor constants - Exports registry-based constants
 * @deprecated Import directly from bodyDescriptorRegistry instead
 * This file maintained for backward compatibility
 */

import { BODY_DESCRIPTOR_REGISTRY } from '../registries/bodyDescriptorRegistry.js';

/**
 * Get valid values for a descriptor from registry
 * @private
 */
function getValidValues(descriptorName) {
  return BODY_DESCRIPTOR_REGISTRY[descriptorName]?.validValues || [];
}

// Export constants derived from registry for backward compatibility
export const BODY_BUILD_TYPES = getValidValues('build');
export const BODY_HAIR_DENSITY = getValidValues('hairDensity');
export const BODY_COMPOSITION_TYPES = getValidValues('composition');
export const HEIGHT_CATEGORIES = getValidValues('height');

// Export registry-based metadata
export const DESCRIPTOR_METADATA = Object.entries(BODY_DESCRIPTOR_REGISTRY).reduce(
  (acc, [key, metadata]) => {
    acc[key] = {
      label: metadata.displayLabel,
      validValues: metadata.validValues,
    };
    return acc;
  },
  {}
);

// Re-export registry for convenience
export { BODY_DESCRIPTOR_REGISTRY } from '../registries/bodyDescriptorRegistry.js';
```

### Migration Steps

1. **Update bodyDescriptorConstants.js**
   - Import registry
   - Derive constants from registry
   - Add deprecation notices
   - Maintain backward compatibility

2. **Find All Imports**
   - Search codebase for imports from bodyDescriptorConstants
   - Identify direct usage of constants
   - Plan migration strategy

3. **Update Imports**
   - Change imports to use registry directly (preferred)
   - Or keep importing from constants (backward compatible)
   - Update usage patterns where needed

4. **Remove Hardcoded Lists**
   - Search for hardcoded descriptor lists
   - Replace with registry calls
   - Verify behavior unchanged

5. **Update Tests**
   - Update test imports
   - Verify tests still pass
   - Add tests for new registry usage

6. **Add Migration Warnings**
   - Add console warnings in development mode for deprecated usage
   - Guide developers to new patterns

### Files to Migrate

Search and update these file patterns:

```bash
# Find imports of bodyDescriptorConstants
grep -r "from.*bodyDescriptorConstants" src/

# Find usage of descriptor constants
grep -r "BODY_BUILD_TYPES\|BODY_HAIR_DENSITY\|HEIGHT_CATEGORIES" src/

# Find hardcoded descriptor lists
grep -r "\['height', 'skin_color'" src/
```

### Implementation Approach

**Option A: Full Migration (Recommended)**
- Update all files to import from registry
- Remove bodyDescriptorConstants.js entirely
- Direct usage of registry throughout codebase

**Option B: Gradual Migration**
- Keep bodyDescriptorConstants.js as registry wrapper
- Update constants to derive from registry
- Maintain backward compatibility
- Migrate files gradually to direct registry usage

**Recommendation**: Use Option B for safety, plan Option A for future.

## Files to Modify

- `src/anatomy/constants/bodyDescriptorConstants.js` (MODIFY)
  - Import registry
  - Derive constants from registry
  - Add deprecation notices

- Search and update all files importing bodyDescriptorConstants:
  - Update imports (if full migration)
  - Verify behavior unchanged
  - Update tests

## Testing Requirements

### Unit Tests

**File**: `tests/unit/anatomy/constants/bodyDescriptorConstants.test.js`

Test cases:
1. Constants derived correctly from registry
   - BODY_BUILD_TYPES matches registry
   - BODY_HAIR_DENSITY matches registry
   - HEIGHT_CATEGORIES matches registry
   - DESCRIPTOR_METADATA matches registry

2. Backward compatibility maintained
   - All exported constants still available
   - Same structure as before
   - Same values as before

3. Registry re-export works
   - Can import BODY_DESCRIPTOR_REGISTRY from constants
   - Has same content as direct import

### Integration Tests

**File**: `tests/integration/anatomy/constantsMigration.test.js`

Test complete integration:
1. Code using old constants still works
2. Code using registry directly works
3. No behavioral changes
4. Description generation unchanged

### Regression Tests

Ensure no breaking changes:
1. All existing tests still pass
2. Body description generation produces same output
3. Recipe loading still works
4. Anatomy generation workflow unchanged

## Success Criteria

- [ ] bodyDescriptorConstants.js updated to use registry
- [ ] All constants derived from registry
- [ ] Backward compatibility maintained
- [ ] All imports updated (if full migration)
- [ ] All tests pass without modification
- [ ] ESLint passes with no errors
- [ ] No behavioral changes detected
- [ ] Documentation updated to reference registry

## Migration Checklist

### Phase 1: Update Constants File
- [ ] Import registry into bodyDescriptorConstants.js
- [ ] Derive constants from registry
- [ ] Add deprecation notices
- [ ] Test constants export correctly

### Phase 2: Identify Usage
- [ ] Search for all imports of bodyDescriptorConstants
- [ ] Identify direct usage of constants
- [ ] Document files to update

### Phase 3: Update Imports (Optional)
- [ ] Update files to import from registry (if full migration)
- [ ] Update usage patterns
- [ ] Test each file after update

### Phase 4: Verification
- [ ] Run all tests
- [ ] Verify no breaking changes
- [ ] Test description generation
- [ ] Test recipe loading

## Related Tickets

- Depends on: BODDESROB-001 (Centralized Registry)
- Depends on: BODDESROB-003 (Refactor BodyDescriptionComposer)
- Related to: BODDESROB-008 (Documentation Updates)
- Related to: Spec Section 4.4 "Phase 4: Migration and Cleanup"

## Deprecation Strategy

### Immediate (Phase 4)
- Update bodyDescriptorConstants to derive from registry
- Add JSDoc @deprecated tags
- Maintain full backward compatibility

### Future (Post-refactoring)
- Add console warnings for deprecated usage (development mode)
- Guide developers to registry usage
- Plan eventual removal

### Long-term (v2.0)
- Remove bodyDescriptorConstants.js entirely
- Require direct registry imports
- Breaking change with major version

## Notes

- Prioritize backward compatibility
- Don't rush full migration
- Test thoroughly at each step
- Document migration path for other developers
- Consider adding migration guide
- Keep eye on test coverage
- Profile performance if needed
