# BODDESROB-006: Migrate Existing Code and Clean Up Duplicated Metadata

**Status**: TODO
**Priority**: MEDIUM
**Phase**: 4 (Migration and Cleanup)
**Estimated Effort**: 1-2 days
**Dependencies**: BODDESROB-001, BODDESROB-003

## Overview

Migrate existing code to use the centralized registry and remove duplicated metadata definitions. This cleanup ensures the registry is the single source of truth and eliminates maintenance burden from keeping multiple files synchronized.

## Critical Findings from Codebase Validation

**IMPORTANT**: The original workflow assumptions have been validated and corrected based on actual codebase analysis:

1. **Constants are OBJECTS, not ARRAYS** (CRITICAL)
   - Actual: `BODY_BUILD_TYPES = { SKINNY: 'skinny', SLIM: 'slim', ... }`
   - Incorrect assumption: Arrays like `['skinny', 'slim', ...]`
   - Usage pattern: `BODY_BUILD_TYPES.ATHLETIC`, `BODY_HAIR_DENSITY.MODERATE`
   - Found in: 4 files including tests and validation code

2. **Test Files Don't Exist Yet**
   - `tests/unit/anatomy/constants/bodyDescriptorConstants.test.js` - TO BE CREATED
   - `tests/integration/anatomy/constantsMigration.test.js` - TO BE CREATED
   - Test directories exist, but specific test files need creation

3. **Additional Export Not Mentioned**
   - `SUPPORTED_DESCRIPTOR_PROPERTIES` is exported and used (in bodyDescriptorValidator.js)
   - Must be maintained in migration

4. **DESCRIPTOR_METADATA Already Uses Object.values()**
   - Current code already derives validValues arrays from constant objects
   - Structure includes `description` field (not just label and validValues)

5. **Actual File Locations Confirmed**
   - Constants: `/home/user/living-narrative-engine/src/anatomy/constants/bodyDescriptorConstants.js`
   - Registry: `/home/user/living-narrative-engine/src/anatomy/registries/bodyDescriptorRegistry.js`
   - Test directory: `/home/user/living-narrative-engine/tests/unit/anatomy/constants/`
   - Integration tests: `/home/user/living-narrative-engine/tests/integration/anatomy/`

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

### Registry Structure (Dependency: BODDESROB-001)

The registry located at `/home/user/living-narrative-engine/src/anatomy/registries/bodyDescriptorRegistry.js` has the following structure:

```javascript
export const BODY_DESCRIPTOR_REGISTRY = {
  height: {
    schemaProperty: 'height',
    displayLabel: 'Height',
    displayKey: 'height',
    dataPath: 'body.descriptors.height',
    validValues: ['gigantic', 'very-tall', 'tall', 'average', 'short', 'petite', 'tiny'],
    displayOrder: 10,
    extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.height,
    formatter: (value) => `Height: ${value}`,
    required: false,
  },
  // ... similar structure for: skinColor, build, composition, hairDensity, smell
};
```

**Key Registry Properties:**
- `validValues`: Array of allowed values (null for free-form strings like skinColor, smell)
- `displayLabel`: Human-readable label (e.g., "Body hair density", "Build")
- Registry keys: camelCase descriptor names (height, skinColor, build, composition, hairDensity, smell)

**Migration Challenge:**
- Registry stores validValues as arrays: `['skinny', 'slim', 'athletic', ...]`
- Current constants are objects: `{ SKINNY: 'skinny', SLIM: 'slim', ATHLETIC: 'athletic', ... }`
- Must convert array to object while maintaining backward compatibility
- Conversion rule: Uppercase value, replace hyphens with underscores
  - 'athletic' → ATHLETIC
  - 'very-tall' → VERY_TALL
  - 'very-hairy' → VERY_HAIRY

### Current State: bodyDescriptorConstants.js

```javascript
// src/anatomy/constants/bodyDescriptorConstants.js (before)

// NOTE: These are OBJECTS with named properties, not arrays
export const BODY_BUILD_TYPES = {
  SKINNY: 'skinny',
  SLIM: 'slim',
  LISSOM: 'lissom',
  TONED: 'toned',
  ATHLETIC: 'athletic',
  SHAPELY: 'shapely',
  HOURGLASS: 'hourglass',
  THICK: 'thick',
  MUSCULAR: 'muscular',
  HULKING: 'hulking',
  STOCKY: 'stocky',
};

export const BODY_HAIR_DENSITY = {
  HAIRLESS: 'hairless',
  SPARSE: 'sparse',
  LIGHT: 'light',
  MODERATE: 'moderate',
  HAIRY: 'hairy',
  VERY_HAIRY: 'very-hairy',
};

export const BODY_COMPOSITION_TYPES = {
  UNDERWEIGHT: 'underweight',
  LEAN: 'lean',
  AVERAGE: 'average',
  SOFT: 'soft',
  CHUBBY: 'chubby',
  OVERWEIGHT: 'overweight',
  OBESE: 'obese',
};

export const HEIGHT_CATEGORIES = {
  GIGANTIC: 'gigantic',
  VERY_TALL: 'very-tall',
  TALL: 'tall',
  AVERAGE: 'average',
  SHORT: 'short',
  PETITE: 'petite',
  TINY: 'tiny',
};

// DESCRIPTOR_METADATA already uses Object.values() to convert to arrays
export const DESCRIPTOR_METADATA = {
  build: {
    label: 'Build',
    validValues: Object.values(BODY_BUILD_TYPES),
    description: 'Body build type',
  },
  hairDensity: {
    label: 'Body hair density',
    validValues: Object.values(BODY_HAIR_DENSITY),
    description: 'Body hair density level',
  },
  composition: {
    label: 'Body composition',
    validValues: Object.values(BODY_COMPOSITION_TYPES),
    description: 'Body composition type',
  },
  skinColor: {
    label: 'Skin color',
    validValues: null,
    description: 'Skin color descriptor',
  },
  smell: {
    label: 'Smell',
    validValues: null,
    description: 'Body smell descriptor',
  },
  height: {
    label: 'Height',
    validValues: Object.values(HEIGHT_CATEGORIES),
    description: 'Height category',
  },
};

export const SUPPORTED_DESCRIPTOR_PROPERTIES = Object.keys(DESCRIPTOR_METADATA);
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
 * Convert array of values to object with UPPER_CASE keys
 * @private
 */
function arrayToConstantObject(values) {
  if (!values) return {};
  return values.reduce((acc, value) => {
    const key = value.toUpperCase().replace(/-/g, '_');
    acc[key] = value;
    return acc;
  }, {});
}

// Export constants derived from registry for backward compatibility
// These must remain OBJECTS (not arrays) to maintain existing usage patterns
// Usage: BODY_BUILD_TYPES.ATHLETIC, BODY_HAIR_DENSITY.MODERATE, etc.
export const BODY_BUILD_TYPES = arrayToConstantObject(
  BODY_DESCRIPTOR_REGISTRY.build?.validValues
);
export const BODY_HAIR_DENSITY = arrayToConstantObject(
  BODY_DESCRIPTOR_REGISTRY.hairDensity?.validValues
);
export const BODY_COMPOSITION_TYPES = arrayToConstantObject(
  BODY_DESCRIPTOR_REGISTRY.composition?.validValues
);
export const HEIGHT_CATEGORIES = arrayToConstantObject(
  BODY_DESCRIPTOR_REGISTRY.height?.validValues
);

// Export registry-based metadata
export const DESCRIPTOR_METADATA = Object.entries(BODY_DESCRIPTOR_REGISTRY).reduce(
  (acc, [key, metadata]) => {
    acc[key] = {
      label: metadata.displayLabel,
      validValues: metadata.validValues,
      description: `${metadata.displayLabel} descriptor`,
    };
    return acc;
  },
  {}
);

// Export supported properties list
export const SUPPORTED_DESCRIPTOR_PROPERTIES = Object.keys(DESCRIPTOR_METADATA);

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

**Current Usage Analysis:**

Files importing from bodyDescriptorConstants:
- `/home/user/living-narrative-engine/src/anatomy/utils/bodyDescriptorUtils.js` - imports DESCRIPTOR_METADATA
- `/home/user/living-narrative-engine/src/anatomy/utils/bodyDescriptorValidator.js` - imports DESCRIPTOR_METADATA, SUPPORTED_DESCRIPTOR_PROPERTIES
- `/home/user/living-narrative-engine/tests/unit/anatomy/utils/bodyDescriptorUtils.test.js` - imports BODY_BUILD_TYPES
- `/home/user/living-narrative-engine/tests/integration/anatomy/descriptorValidationIntegration.test.js` - imports BODY_BUILD_TYPES, BODY_HAIR_DENSITY, BODY_COMPOSITION_TYPES

**Current Usage Patterns:**
- Constants used as objects: `BODY_BUILD_TYPES.ATHLETIC`, `BODY_HAIR_DENSITY.MODERATE`
- DESCRIPTOR_METADATA used to get labels and validValues
- SUPPORTED_DESCRIPTOR_PROPERTIES used for validation

Search commands:
```bash
# Find imports of bodyDescriptorConstants
grep -r "from.*bodyDescriptorConstants" src/ tests/

# Find usage of descriptor constants (as objects)
grep -r "BODY_BUILD_TYPES\.\|BODY_HAIR_DENSITY\.\|HEIGHT_CATEGORIES\." src/ tests/

# Find DESCRIPTOR_METADATA usage
grep -r "DESCRIPTOR_METADATA" src/
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

**File**: `tests/unit/anatomy/constants/bodyDescriptorConstants.test.js` (TO BE CREATED)

**Note**: This test file does not currently exist. It needs to be created as part of this migration.

Test cases:
1. Constants derived correctly from registry
   - BODY_BUILD_TYPES object structure matches original (e.g., `.ATHLETIC`, `.SLIM`)
   - BODY_HAIR_DENSITY object structure matches original (e.g., `.MODERATE`, `.HAIRY`)
   - HEIGHT_CATEGORIES object structure matches original (e.g., `.TALL`, `.SHORT`)
   - DESCRIPTOR_METADATA structure matches original (label, validValues, description)
   - Values come from registry's validValues arrays

2. Backward compatibility maintained
   - All exported constants still available
   - Same structure as before (objects, not arrays)
   - Same values as before
   - SUPPORTED_DESCRIPTOR_PROPERTIES still exported

3. Registry re-export works
   - Can import BODY_DESCRIPTOR_REGISTRY from constants
   - Has same content as direct import

4. Object constant access patterns work
   - BODY_BUILD_TYPES.ATHLETIC === 'athletic'
   - BODY_HAIR_DENSITY.MODERATE === 'moderate'
   - All uppercase keys with underscores for hyphens

### Integration Tests

**File**: `tests/integration/anatomy/constantsMigration.test.js` (TO BE CREATED)

**Note**: This integration test file does not currently exist. It needs to be created as part of this migration.

Test complete integration:
1. Code using old constants still works (object access pattern)
2. Code using registry directly works
3. No behavioral changes in existing tests
4. Description generation unchanged
5. Existing test suite continues to pass without modification

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
- [ ] Implement arrayToConstantObject() helper to maintain object structure
- [ ] Derive constants from registry (must remain objects, not arrays)
- [ ] Maintain SUPPORTED_DESCRIPTOR_PROPERTIES export
- [ ] Add deprecation notices
- [ ] Test constants export correctly with object access patterns

### Phase 2: Create Test Files
- [ ] Create `tests/unit/anatomy/constants/bodyDescriptorConstants.test.js`
  - Note: Directory exists at `/home/user/living-narrative-engine/tests/unit/anatomy/constants/`
  - Currently only contains `anatomyConstants.test.js`
- [ ] Create `tests/integration/anatomy/constantsMigration.test.js`
  - Directory exists at `/home/user/living-narrative-engine/tests/integration/anatomy/`
- [ ] Test object constant access patterns (e.g., BODY_BUILD_TYPES.ATHLETIC)
- [ ] Test backward compatibility with existing usage

### Phase 3: Identify Usage
- [ ] Search for all imports of bodyDescriptorConstants
- [ ] Identify direct usage of constants (as objects)
- [ ] Verify DESCRIPTOR_METADATA usage patterns
- [ ] Document files to update

### Phase 4: Update Imports (Optional)
- [ ] Update files to import from registry (if full migration)
- [ ] Update usage patterns
- [ ] Test each file after update

### Phase 5: Verification
- [ ] Run all existing tests (should pass without modification)
- [ ] Run new unit tests for constants
- [ ] Run new integration tests
- [ ] Verify no breaking changes
- [ ] Test description generation
- [ ] Test recipe loading
- [ ] Verify existing integration test still passes:
  - `/home/user/living-narrative-engine/tests/integration/anatomy/descriptorValidationIntegration.test.js`

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

### Validation Notes (2025-11-06)

**Codebase validation performed** - All assumptions in this workflow have been verified against the actual codebase:

- Verified actual constant structure (objects, not arrays)
- Confirmed registry structure and property names
- Identified all files importing bodyDescriptorConstants (4 files total)
- Verified actual usage patterns (object property access)
- Checked test file existence (need to create 2 new test files)
- Confirmed directory structures exist for test files
- Validated registry provides necessary data for conversion

**Key corrections made to workflow:**
1. Updated "Current State" to show objects instead of arrays
2. Updated "Target State" to include arrayToConstantObject() conversion helper
3. Added explicit notes about test files that need creation
4. Documented actual usage patterns and file locations
5. Added SUPPORTED_DESCRIPTOR_PROPERTIES to migration requirements
6. Updated test requirements to reflect object access patterns
7. Added conversion rule documentation (uppercase + hyphen replacement)
