# BODDESROB-003: Refactor BodyDescriptionComposer to Use Registry

**Status**: TODO
**Priority**: HIGH
**Phase**: 2 (Refactoring)
**Estimated Effort**: 1-2 days
**Dependencies**: BODDESROB-001

## Overview

Refactor the `BodyDescriptionComposer` class to use the centralized registry for descriptor extraction and ordering. This eliminates hardcoded descriptor lists and creates a single source of truth for body descriptor processing.

## Problem Context

Currently, `BodyDescriptionComposer` has:
- Hardcoded descriptor list in `getBodyDescriptorOrder()`
- Individual extraction methods (`extractHeightDescription()`, `extractSkinColorDescription()`, etc.)
- No connection to formatting configuration validation
- Potential for drift between code and configuration

## Acceptance Criteria

- [ ] `extractBodyLevelDescriptors()` method refactored to use registry
  - Iterates through descriptors in display order from registry
  - Uses registry extractors instead of individual methods
  - Uses registry formatters for consistent output
  - Returns descriptors object compatible with existing code
- [ ] `getBodyDescriptorOrder()` method refactored to derive from registry
  - No more hardcoded list
  - Returns display keys in registry-defined order
  - Maintains backward compatibility with existing consumers
- [ ] Individual extraction methods simplified as registry wrappers
  - `extractHeightDescription()` → calls registry extractor
  - `extractSkinColorDescription()` → calls registry extractor
  - Similar for all other descriptors
  - Can optionally deprecate with warnings
- [ ] All existing tests updated and passing
- [ ] New tests added for registry-based functionality
- [ ] No breaking changes to public API
- [ ] Backward compatibility maintained during transition
- [ ] Performance remains equivalent or better

## Technical Details

### Current Implementation (Before)

```javascript
// src/anatomy/bodyDescriptionComposer.js (current - lines 494-513, 450-486)

/**
 * Extract the body-level descriptor order from the overall description order
 * NOTE: Takes descriptionOrder as a parameter (not fetched internally)
 */
getBodyDescriptorOrder(descriptionOrder) {
  const bodyDescriptorTypes = [
    'height', 'skin_color', 'build', 'body_composition', 'body_hair', 'smell'
  ];
  const filtered = descriptionOrder.filter((type) =>
    bodyDescriptorTypes.includes(type)
  );

  // Defensive logic: ensure height is always first if missing
  if (!filtered.includes('height')) {
    filtered.unshift('height');
  }

  return filtered;
}

extractBodyLevelDescriptors(bodyEntity) {
  const descriptors = {};

  // Individual extraction methods called directly
  const heightDescription = this.extractHeightDescription(bodyEntity);
  if (heightDescription) {
    descriptors.height = `Height: ${heightDescription}`;
  }

  const skinColorDescription = this.extractSkinColorDescription(bodyEntity);
  if (skinColorDescription) {
    descriptors.skin_color = `Skin color: ${skinColorDescription}`;
  }

  // ... similar for build, body_hair, body_composition, smell

  return descriptors;
}

// Usage in composeDescription() (lines 110-127):
const descriptionOrder = this.config.getDescriptionOrder();
const bodyLevelDescriptors = this.extractBodyLevelDescriptors(bodyEntity);
const bodyDescriptorOrder = this.getBodyDescriptorOrder(descriptionOrder);
```

**Key Implementation Details:**
- Uses `this.config` (DescriptionConfiguration instance) not `this.#anatomyFormattingService` directly
- `getBodyDescriptorOrder()` takes `descriptionOrder` parameter - not fetched internally
- Individual extraction methods return raw values (e.g., "tall")
- Formatting with labels (e.g., "Height: tall") happens in `extractBodyLevelDescriptors()`

### Target Implementation (After)

```javascript
// src/anatomy/bodyDescriptionComposer.js (refactored)

import {
  BODY_DESCRIPTOR_REGISTRY,
  getDescriptorsByDisplayOrder,
} from './registries/bodyDescriptorRegistry.js';

/**
 * Extract all body-level descriptors using registry
 * @param {Object} bodyEntity - Body entity with components
 * @returns {Object} Descriptors object keyed by displayKey
 */
extractBodyLevelDescriptors(bodyEntity) {
  const bodyComponent = this.#getBodyComponent(bodyEntity);
  const descriptors = {};

  // Iterate through registry in display order
  for (const descriptorName of getDescriptorsByDisplayOrder()) {
    const metadata = BODY_DESCRIPTOR_REGISTRY[descriptorName];
    const value = metadata.extractor(bodyComponent);

    if (value) {
      // Use formatter from registry (formatters already include label)
      // e.g., formatter returns "Height: tall" not just "tall"
      descriptors[metadata.displayKey] = metadata.formatter(value);
    }
  }

  return descriptors;
}

/**
 * Get body descriptor order from registry
 * IMPORTANT: Still needs to respect configuration ordering when available
 * @param {string[]} descriptionOrder - Full description order from config
 * @returns {string[]} Filtered array of body descriptor display keys
 */
getBodyDescriptorOrder(descriptionOrder) {
  // Get all display keys from registry
  const registryDisplayKeys = getDescriptorsByDisplayOrder().map(
    name => BODY_DESCRIPTOR_REGISTRY[name].displayKey
  );

  // Filter the config order to only include registry display keys
  // This maintains config-specified order while using registry as source of truth
  const filtered = descriptionOrder.filter(type =>
    registryDisplayKeys.includes(type)
  );

  // Defensive: ensure height is first if present in registry but missing from config
  if (registryDisplayKeys.includes('height') && !filtered.includes('height')) {
    filtered.unshift('height');
  }

  return filtered;
}

/**
 * Extract height description (registry wrapper)
 * Kept for backward compatibility but delegates to registry
 * @param {Object} bodyEntity - Body entity
 * @returns {string} Raw height value or empty string (not formatted)
 */
extractHeightDescription(bodyEntity) {
  const bodyComponent = this.#getBodyComponent(bodyEntity);
  const value = BODY_DESCRIPTOR_REGISTRY.height.extractor(bodyComponent);
  return value || '';
}

// Similar wrappers for other descriptors (extractSkinColorDescription, etc.)
// All delegate to registry extractors and return raw values (not formatted)
```

**Key Design Decisions:**
1. **Registry as extractor source**: Use registry extractors instead of individual methods
2. **Registry formatters include labels**: No need for separate label concatenation
3. **Respect configuration order**: `getBodyDescriptorOrder()` still filters config order
4. **Backward compatible wrappers**: Individual extraction methods remain but delegate to registry
5. **Raw values from wrappers**: Individual methods return raw values for backward compatibility

### Important Architecture Notes

**Registry Key Mapping:**
The registry uses two different key types that must be understood:
- **descriptorName** (registry key): `height`, `skinColor`, `build`, `composition`, `hairDensity`, `smell`
- **displayKey** (config order key): `height`, `skin_color`, `build`, `body_composition`, `body_hair`, `smell`

Example: Registry entry `skinColor` has `displayKey: 'skin_color'` to match config ordering.

**Service Access Pattern:**
- `this.anatomyFormattingService` - Direct service reference (available in constructor)
- `this.config` - DescriptionConfiguration wrapper instance (created in constructor)
- Most code uses `this.config.getDescriptionOrder()` not `this.anatomyFormattingService.getDescriptionOrder()`
- This pattern provides defaults when formatting service is unavailable

**Ordering Strategy:**
The refactored code should:
1. Use registry `displayOrder` for relative ordering of descriptors
2. Still respect configuration `descriptionOrder` when available
3. Filter config order to only include descriptors present in registry
4. This maintains flexibility while using registry as source of truth

### Implementation Steps

1. **Import Registry Functions**
   - Add imports from `bodyDescriptorRegistry.js`
   - Verify no circular dependencies

2. **Refactor `extractBodyLevelDescriptors()`**
   - Replace individual extraction calls with registry iteration
   - Use registry extractors and formatters
   - Test with existing test cases
   - Verify output format matches existing behavior

3. **Refactor `getBodyDescriptorOrder()`**
   - Remove hardcoded list
   - Derive from registry display order
   - Test with existing consumers
   - Verify filtering still works correctly

4. **Simplify Individual Extraction Methods**
   - Convert to registry wrapper calls
   - Add deprecation warnings (optional)
   - Keep for backward compatibility
   - Document preferred approach

5. **Update Tests**
   - Update existing tests to verify registry usage
   - Add new tests for registry integration
   - Test edge cases (missing descriptors, null values)
   - Verify backward compatibility

6. **Performance Testing**
   - Compare before/after performance
   - Ensure no regression
   - Profile if needed

### Backward Compatibility Strategy

To ensure smooth transition:

1. Keep individual extraction methods as wrappers
2. Maintain same return value structures
3. Don't change public API signatures
4. Add optional deprecation warnings (development mode only)
5. Document migration path for consumers

## Files to Modify

- `src/anatomy/bodyDescriptionComposer.js` (MODIFY)
  - Import registry functions
  - Refactor `extractBodyLevelDescriptors()`
  - Refactor `getBodyDescriptorOrder()`
  - Simplify individual extraction methods

## Testing Requirements

### Unit Tests to Update

**File**: `tests/unit/anatomy/bodyDescriptionComposer.*.test.js`

Update existing tests:
1. Test registry-based extraction
   - Verify uses registry extractors
   - Verify uses registry formatters
   - Verify correct display key mapping

2. Test descriptor ordering from registry
   - Verify order matches registry displayOrder
   - Verify no hardcoded lists remain

3. Test individual extraction methods
   - Verify they still work as wrappers
   - Verify same behavior as before

4. Test edge cases
   - Missing descriptors
   - Null/undefined values
   - Empty body component
   - Invalid data structures

### New Tests to Add

```javascript
describe('BodyDescriptionComposer - Registry Integration', () => {
  it('should extract descriptors using registry extractors', () => {
    // Create entity with body descriptors in anatomy:body component
    const bodyEntity = {
      hasComponent: jest.fn((id) => id === 'anatomy:body'),
      getComponentData: jest.fn((id) => {
        if (id === 'anatomy:body') {
          return {
            body: {
              descriptors: {
                height: 'tall',
                skinColor: 'tan',
                build: 'athletic',
              }
            }
          };
        }
        return null;
      }),
      id: 'test-entity'
    };

    const descriptors = composer.extractBodyLevelDescriptors(bodyEntity);

    // Verify registry descriptors processed with correct display keys
    expect(descriptors).toHaveProperty('height');
    expect(descriptors).toHaveProperty('skin_color'); // Note: snake_case display key
    expect(descriptors).toHaveProperty('build');
  });

  it('should use registry formatters for descriptor values', () => {
    const bodyEntity = {
      hasComponent: jest.fn((id) => id === 'anatomy:body'),
      getComponentData: jest.fn((id) => {
        if (id === 'anatomy:body') {
          return {
            body: { descriptors: { height: 'tall' } }
          };
        }
        return null;
      }),
      id: 'test-entity'
    };

    const descriptors = composer.extractBodyLevelDescriptors(bodyEntity);

    // Verify formatter applied (includes label)
    expect(descriptors.height).toBe('Height: tall');
  });

  it('should filter config order to registry display keys', () => {
    // Mock config with various types including non-descriptor types
    const mockConfig = ['height', 'head', 'skin_color', 'torso', 'build'];
    const order = composer.getBodyDescriptorOrder(mockConfig);

    // Should only include descriptor types from registry
    expect(order).toEqual(['height', 'skin_color', 'build']);
    expect(order).not.toContain('head');
    expect(order).not.toContain('torso');
  });

  it('should handle missing descriptors gracefully', () => {
    const bodyEntity = {
      hasComponent: jest.fn((id) => id === 'anatomy:body'),
      getComponentData: jest.fn((id) => {
        if (id === 'anatomy:body') {
          return { body: { descriptors: {} } }; // No descriptors
        }
        return null;
      }),
      id: 'test-entity'
    };

    const descriptors = composer.extractBodyLevelDescriptors(bodyEntity);

    // Should return empty object, not throw
    expect(descriptors).toEqual({});
  });

  it('should maintain backward compatibility with individual extraction methods', () => {
    const bodyEntity = {
      hasComponent: jest.fn((id) => id === 'anatomy:body'),
      getComponentData: jest.fn((id) => {
        if (id === 'anatomy:body') {
          return {
            body: { descriptors: { height: 'tall' } }
          };
        }
        return null;
      }),
      id: 'test-entity'
    };

    // Individual method should return raw value (not formatted)
    const height = composer.extractHeightDescription(bodyEntity);
    expect(height).toBe('tall'); // Not "Height: tall"
  });
});
```

### Integration Tests

**File**: `tests/integration/anatomy/bodyDescriptionComposerIntegration.test.js`

Test complete flow:
1. Load anatomy recipe with body descriptors
2. Generate body component
3. Extract descriptors using refactored composer
4. Verify output matches expected format
5. Verify all descriptors appear in correct order

### Regression Tests

Ensure no breaking changes:
1. All existing descriptor extraction tests pass
2. Description generation produces same output
3. Formatting service integration still works
4. No performance regression

## Success Criteria

- [ ] All existing tests pass without modification
- [ ] New registry integration tests pass
- [ ] ESLint passes with no errors
- [ ] TypeScript type checking passes
- [ ] No hardcoded descriptor lists remain
- [ ] Performance is equivalent or better
- [ ] Backward compatibility maintained
- [ ] Code follows project conventions
- [ ] All body descriptors appear in generated descriptions
- [ ] Integration tests verify complete flow

## Related Tickets

- Depends on: BODDESROB-001 (Centralized Registry)
- Related to: BODDESROB-006 (Migration and Cleanup)
- Related to: Spec Section 3.3 "Refactored BodyDescriptionComposer"

## Migration Notes

### For Developers

If you're consuming BodyDescriptionComposer:
- Public API remains unchanged
- Individual extraction methods still work
- Prefer `extractBodyLevelDescriptors()` for new code
- No changes needed in existing code

### For Future Enhancements

The registry-based approach enables:
- Easy addition of new descriptors (just update registry)
- Dynamic descriptor registration (future: mod support)
- Consistent formatting across the system
- Automatic validation integration

## Notes

- Focus on maintaining backward compatibility
- Comprehensive testing is critical
- Profile performance if needed
- Individual extraction methods can be deprecated later
- Keep eye on integration with formatting service
- Consider logging registry usage for debugging
- Document any breaking changes clearly

## Workflow Corrections Applied

**Date**: 2025-11-05
**Status**: Workflow assumptions validated and corrected

### Corrections Made:

1. **Fixed `getBodyDescriptorOrder()` signature**
   - **Was**: Method shown with no parameters
   - **Corrected**: Method takes `descriptionOrder` parameter and filters it

2. **Corrected service access pattern**
   - **Was**: Showed `this.#anatomyFormattingService.getDescriptionOrder()`
   - **Corrected**: Uses `this.config.getDescriptionOrder()` (DescriptionConfiguration wrapper)

3. **Clarified registry key mapping**
   - **Added**: Documentation of descriptorName vs displayKey distinction
   - **Example**: `skinColor` (registry) → `skin_color` (display key)

4. **Updated target implementation**
   - **Was**: Showed `getBodyDescriptorOrder()` with no parameters deriving purely from registry
   - **Corrected**: Method respects config order while using registry as source of truth

5. **Fixed test examples**
   - **Was**: Used simplified test entity creation
   - **Corrected**: Proper entity structure with `hasComponent()` and `getComponentData()` methods
   - **Added**: Test for backward compatibility with individual extraction methods

6. **Added architecture notes**
   - Registry key types and their usage
   - Service access patterns (direct vs wrapper)
   - Ordering strategy that balances registry and configuration

### Validation Summary:

All assumptions have been cross-referenced with production code:
- ✅ `src/anatomy/bodyDescriptionComposer.js` (lines 287-577)
- ✅ `src/anatomy/registries/bodyDescriptorRegistry.js` (complete file)
- ✅ `src/services/anatomyFormattingService.js` (getDescriptionOrder interface)
- ✅ `src/anatomy/configuration/descriptionConfiguration.js` (wrapper pattern)
- ✅ `tests/unit/anatomy/bodyDescriptionComposer.bodyLevelDescriptors.test.js` (test patterns)

The workflow now accurately reflects the production code structure and can serve as a reliable implementation guide.
