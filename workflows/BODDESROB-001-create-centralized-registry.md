# BODDESROB-001: Create Centralized Body Descriptor Registry

**Status**: TODO
**Priority**: HIGH
**Phase**: 1 (Foundation)
**Estimated Effort**: 1 day
**Dependencies**: None

## Overview

Create a centralized registry that serves as the single source of truth for all body descriptor metadata. This registry will eliminate the need for manual synchronization across multiple files and provide a foundation for automatic validation.

## Problem Context

Currently, body descriptor configuration is scattered across 4+ files:
- Schema definition: `data/schemas/anatomy.recipe.schema.json`
- Constants: `src/anatomy/constants/bodyDescriptorConstants.js`
- Formatting config: `data/mods/anatomy/anatomy-formatting/default.json`
- Implementation: `src/anatomy/bodyDescriptionComposer.js`

This leads to synchronization issues where descriptors can be defined but missing from formatting configuration, causing silent failures.

## Acceptance Criteria

- [ ] Registry file created at `src/anatomy/registries/bodyDescriptorRegistry.js`
- [ ] Registry contains complete metadata for all 6 body descriptors:
  - height
  - skinColor
  - build
  - composition
  - hairDensity
  - smell
- [ ] Each descriptor entry includes:
  - schemaProperty (matches schema name)
  - displayLabel (human-readable name)
  - displayKey (key used in descriptionOrder)
  - dataPath (path in body component)
  - validValues (array or null for free-form)
  - displayOrder (numeric priority)
  - extractor (function to extract value from body component)
  - formatter (function to format value for display)
  - required (boolean flag)
- [ ] Helper functions implemented:
  - `getDescriptorMetadata(schemaProperty)`
  - `getAllDescriptorNames()`
  - `getDescriptorsByDisplayOrder()`
  - `validateDescriptorValue(descriptorName, value)`
- [ ] All functions have JSDoc documentation
- [ ] Unit tests created with 90%+ coverage
- [ ] No breaking changes to existing code

## Technical Details

### File Structure

```javascript
// src/anatomy/registries/bodyDescriptorRegistry.js

/**
 * @file Centralized registry for body descriptor configuration
 * Single source of truth for all descriptor metadata
 */

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
  // ... other descriptors
};
```

### Implementation Steps

1. Create `src/anatomy/registries/` directory if it doesn't exist
2. Create `bodyDescriptorRegistry.js` with BODY_DESCRIPTOR_REGISTRY constant
3. Add all 6 descriptor definitions with complete metadata
4. Implement helper functions for registry access
5. Add comprehensive JSDoc documentation
6. Export all public APIs

### Helper Functions

```javascript
/**
 * Get descriptor metadata by schema property name
 * @param {string} schemaProperty - Schema property name
 * @returns {Object|undefined} Descriptor metadata or undefined
 */
export function getDescriptorMetadata(schemaProperty) {
  return BODY_DESCRIPTOR_REGISTRY[schemaProperty];
}

/**
 * Get all registered descriptor names
 * @returns {string[]} Array of descriptor names
 */
export function getAllDescriptorNames() {
  return Object.keys(BODY_DESCRIPTOR_REGISTRY);
}

/**
 * Get descriptors sorted by display order
 * @returns {string[]} Array of descriptor names sorted by displayOrder
 */
export function getDescriptorsByDisplayOrder() {
  return Object.entries(BODY_DESCRIPTOR_REGISTRY)
    .sort(([, a], [, b]) => a.displayOrder - b.displayOrder)
    .map(([key]) => key);
}

/**
 * Validate descriptor value against registry
 * @param {string} descriptorName - Descriptor name
 * @param {string} value - Value to validate
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validateDescriptorValue(descriptorName, value) {
  const metadata = BODY_DESCRIPTOR_REGISTRY[descriptorName];
  if (!metadata) {
    return { valid: false, error: `Unknown descriptor: ${descriptorName}` };
  }

  if (metadata.validValues && !metadata.validValues.includes(value)) {
    return {
      valid: false,
      error: `Invalid value '${value}' for ${descriptorName}. Expected one of: ${metadata.validValues.join(', ')}`
    };
  }

  return { valid: true };
}
```

## Files to Create

- `src/anatomy/registries/bodyDescriptorRegistry.js` (NEW)

## Testing Requirements

### Unit Tests

**File**: `tests/unit/anatomy/registries/bodyDescriptorRegistry.test.js`

Test cases:
1. Registry structure completeness
   - All 6 descriptors present
   - All required fields present for each descriptor
   - Valid values arrays are correct
   - Display order is sequential and unique

2. `getDescriptorMetadata()`
   - Returns correct metadata for valid descriptor
   - Returns undefined for unknown descriptor
   - Returns complete object structure

3. `getAllDescriptorNames()`
   - Returns all 6 descriptor names
   - Returns as array
   - Order doesn't matter

4. `getDescriptorsByDisplayOrder()`
   - Returns descriptors in correct display order
   - Respects displayOrder property
   - Returns all descriptors

5. `validateDescriptorValue()`
   - Valid values pass validation
   - Invalid values fail validation
   - Unknown descriptor fails validation
   - Free-form descriptors (validValues: null) accept any value
   - Error messages are clear and actionable

6. Extractor functions
   - Extract correct values from body component
   - Handle missing data gracefully (return undefined/null)
   - Handle nested path navigation

7. Formatter functions
   - Format values correctly
   - Handle edge cases (null, undefined, empty string)

### Test Template

```javascript
import { describe, it, expect } from '@jest/globals';
import {
  BODY_DESCRIPTOR_REGISTRY,
  getDescriptorMetadata,
  getAllDescriptorNames,
  getDescriptorsByDisplayOrder,
  validateDescriptorValue,
} from '../../../src/anatomy/registries/bodyDescriptorRegistry.js';

describe('bodyDescriptorRegistry', () => {
  describe('BODY_DESCRIPTOR_REGISTRY', () => {
    it('should contain all 6 body descriptors', () => {
      const descriptorNames = Object.keys(BODY_DESCRIPTOR_REGISTRY);
      expect(descriptorNames).toHaveLength(6);
      expect(descriptorNames).toContain('height');
      expect(descriptorNames).toContain('skinColor');
      expect(descriptorNames).toContain('build');
      expect(descriptorNames).toContain('composition');
      expect(descriptorNames).toContain('hairDensity');
      expect(descriptorNames).toContain('smell');
    });

    it('should have complete metadata for each descriptor', () => {
      for (const [name, metadata] of Object.entries(BODY_DESCRIPTOR_REGISTRY)) {
        expect(metadata).toHaveProperty('schemaProperty');
        expect(metadata).toHaveProperty('displayLabel');
        expect(metadata).toHaveProperty('displayKey');
        expect(metadata).toHaveProperty('dataPath');
        expect(metadata).toHaveProperty('validValues');
        expect(metadata).toHaveProperty('displayOrder');
        expect(metadata).toHaveProperty('extractor');
        expect(metadata).toHaveProperty('formatter');
        expect(metadata).toHaveProperty('required');

        expect(typeof metadata.extractor).toBe('function');
        expect(typeof metadata.formatter).toBe('function');
      }
    });
  });

  describe('getDescriptorMetadata', () => {
    // ... tests
  });

  describe('getAllDescriptorNames', () => {
    // ... tests
  });

  describe('getDescriptorsByDisplayOrder', () => {
    // ... tests
  });

  describe('validateDescriptorValue', () => {
    // ... tests
  });
});
```

## Success Criteria

- [ ] Registry file compiles without errors
- [ ] All unit tests pass with 90%+ coverage
- [ ] ESLint passes with no errors
- [ ] TypeScript type checking passes (JSDoc types)
- [ ] Can import and use registry functions
- [ ] No existing code is broken
- [ ] Code follows project conventions (camelCase, JSDoc, etc.)

## Related Tickets

- Blocks: BODDESROB-002 (Enhanced Validator)
- Blocks: BODDESROB-003 (Refactor BodyDescriptionComposer)
- Related to: Spec Section 3.2 "Recommended Architecture: Centralized Registry"

## Notes

- This is the foundation for all subsequent refactoring work
- Must be implemented first before other tickets can proceed
- Keep backward compatibility in mind - don't break existing code
- Registry is read-only at runtime - no dynamic registration yet (future enhancement)
- Focus on correctness and completeness over optimization
- Extractor and formatter functions should be pure (no side effects)
