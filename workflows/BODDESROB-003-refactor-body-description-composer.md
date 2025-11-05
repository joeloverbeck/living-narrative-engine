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
// src/anatomy/bodyDescriptionComposer.js (current)

getBodyDescriptorOrder() {
  const config = this.#anatomyFormattingService.getDescriptionOrder();
  const bodyDescriptorTypes = [
    'height', 'skin_color', 'build', 'body_composition', 'body_hair', 'smell'
  ];
  return config.filter(type => bodyDescriptorTypes.includes(type));
}

extractBodyLevelDescriptors(bodyEntity) {
  const descriptors = {};

  const heightDesc = this.extractHeightDescription(bodyEntity);
  if (heightDesc) descriptors.height = heightDesc;

  const skinColorDesc = this.extractSkinColorDescription(bodyEntity);
  if (skinColorDesc) descriptors.skin_color = skinColorDesc;

  // ... more individual extractions

  return descriptors;
}
```

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
      // Use formatter from registry
      descriptors[metadata.displayKey] = metadata.formatter
        ? metadata.formatter(value)
        : `${metadata.displayLabel}: ${value}`;
    }
  }

  return descriptors;
}

/**
 * Get body descriptor order from registry
 * Replaces hardcoded list with registry-derived order
 * @returns {string[]} Array of descriptor display keys
 */
getBodyDescriptorOrder() {
  return getDescriptorsByDisplayOrder().map(
    name => BODY_DESCRIPTOR_REGISTRY[name].displayKey
  );
}

/**
 * Extract height description (registry wrapper)
 * @deprecated Use extractBodyLevelDescriptors() instead
 * @param {Object} bodyEntity - Body entity
 * @returns {string} Height description or empty string
 */
extractHeightDescription(bodyEntity) {
  const bodyComponent = this.#getBodyComponent(bodyEntity);
  return BODY_DESCRIPTOR_REGISTRY.height.extractor(bodyComponent) || '';
}

// Similar wrappers for other descriptors...
```

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
    // Create entity with body descriptors
    const bodyEntity = createTestBodyEntity({
      height: 'tall',
      skinColor: 'tan',
      build: 'athletic',
    });

    const descriptors = composer.extractBodyLevelDescriptors(bodyEntity);

    // Verify all registry descriptors processed
    expect(descriptors).toHaveProperty('height');
    expect(descriptors).toHaveProperty('skin_color');
    expect(descriptors).toHaveProperty('build');
  });

  it('should use registry formatters for descriptor values', () => {
    const bodyEntity = createTestBodyEntity({ height: 'tall' });
    const descriptors = composer.extractBodyLevelDescriptors(bodyEntity);

    // Verify formatter applied
    expect(descriptors.height).toContain('Height:');
  });

  it('should return descriptors in registry display order', () => {
    const order = composer.getBodyDescriptorOrder();

    // Verify order matches registry
    expect(order).toEqual([
      'height', 'skin_color', 'build', 'body_composition', 'body_hair', 'smell'
    ]);
  });

  it('should handle missing descriptors gracefully', () => {
    const bodyEntity = createTestBodyEntity({}); // No descriptors
    const descriptors = composer.extractBodyLevelDescriptors(bodyEntity);

    // Should return empty object, not throw
    expect(descriptors).toEqual({});
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
