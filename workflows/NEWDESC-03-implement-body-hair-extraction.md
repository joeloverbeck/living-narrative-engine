# NEWDESC-03: Implement Body Hair Extraction Method

## Overview

Implement the `extractBodyHairDescription()` method in the `BodyDescriptionComposer` class to extract body hair descriptors from entities. This method follows the existing pattern established by `extractBuildDescription()` and will enable the display of body hair density (hairless, sparse, light, moderate, hairy, very-hairy) in entity descriptions.

## Priority

**High** - Core functionality required for body hair descriptor support.

## Dependencies

- NEWDESC-01: Update Anatomy Formatting Configuration (must be completed first)
- Can be done in parallel with NEWDESC-02

## Estimated Effort

**2 hours** - Implementation, testing, and validation

## Acceptance Criteria

1. ✅ Method `extractBodyHairDescription()` is implemented in bodyDescriptionComposer.js
2. ✅ Method follows the same pattern as `extractBuildDescription()`
3. ✅ Method properly handles missing or invalid component data
4. ✅ Method extracts the "density" property from descriptors:body_hair component
5. ✅ Method returns empty string for invalid input
6. ✅ JSDoc documentation is complete and accurate
7. ✅ Method integrates cleanly with existing code
8. ✅ No regression in existing functionality

## Implementation Steps

### Step 1: Analyze Component Schema

First, verify the expected component structure:

```bash
# Check the body_hair component schema
cat data/schemas/components/descriptors/body_hair.schema.json
```

Expected schema structure:

```json
{
  "type": "object",
  "properties": {
    "density": {
      "type": "string",
      "enum": ["hairless", "sparse", "light", "moderate", "hairy", "very-hairy"]
    }
  },
  "required": ["density"]
}
```

Note: The property name is "density", not "value" or "hair".

### Step 2: Locate Implementation Point

Open `src/anatomy/bodyDescriptionComposer.js` and find the appropriate location:

```javascript
// Add after extractBuildDescription() method
// If NEWDESC-02 is completed, add after extractBodyCompositionDescription()
// Around line 60-70
```

### Step 3: Implement extractBodyHairDescription Method

Add the following method implementation:

```javascript
/**
 * Extract body hair description from body entity
 * @param {object} bodyEntity - The body entity
 * @returns {string} Body hair description
 */
extractBodyHairDescription(bodyEntity) {
  if (!bodyEntity || typeof bodyEntity.getComponentData !== 'function') {
    return '';
  }
  const bodyHairComponent = bodyEntity.getComponentData('descriptors:body_hair');
  if (!bodyHairComponent || !bodyHairComponent.density) {
    return '';
  }
  return bodyHairComponent.density;
}
```

### Step 4: Add Method with Full Error Handling

For production-ready code with optional logging:

```javascript
/**
 * Extract body hair description from body entity
 * @param {object} bodyEntity - The body entity
 * @returns {string} Body hair description
 */
extractBodyHairDescription(bodyEntity) {
  if (!bodyEntity) {
    this.#logger?.debug('extractBodyHairDescription: bodyEntity is null/undefined');
    return '';
  }

  if (typeof bodyEntity.getComponentData !== 'function') {
    this.#logger?.debug('extractBodyHairDescription: bodyEntity lacks getComponentData method');
    return '';
  }

  const bodyHairComponent = bodyEntity.getComponentData('descriptors:body_hair');
  if (!bodyHairComponent) {
    this.#logger?.debug('extractBodyHairDescription: no body_hair component found');
    return '';
  }

  if (!bodyHairComponent.density) {
    this.#logger?.warn('extractBodyHairDescription: body_hair component lacks density property', {
      component: bodyHairComponent
    });
    return '';
  }

  return bodyHairComponent.density;
}
```

### Step 5: Position in Class Structure

Ensure proper placement within the class:

```javascript
class BodyDescriptionComposer {
  // ... existing constructor and fields ...

  // Existing extraction methods
  extractBuildDescription(bodyEntity) {
    // ... existing implementation ...
  }

  // Body composition extraction (if NEWDESC-02 completed)
  extractBodyCompositionDescription(bodyEntity) {
    // ... implementation from NEWDESC-02 ...
  }

  // NEW: Body hair extraction
  extractBodyHairDescription(bodyEntity) {
    if (!bodyEntity || typeof bodyEntity.getComponentData !== 'function') {
      return '';
    }
    const bodyHairComponent = bodyEntity.getComponentData(
      'descriptors:body_hair'
    );
    if (!bodyHairComponent || !bodyHairComponent.density) {
      return '';
    }
    return bodyHairComponent.density;
  }

  // ... rest of the class methods ...
}
```

### Step 6: Create Comprehensive Unit Tests

Create a unit test file:

```javascript
// tests/unit/anatomy/bodyDescriptionComposer.bodyHair.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('BodyDescriptionComposer - extractBodyHairDescription', () => {
  let composer;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    composer = new BodyDescriptionComposer({
      logger: mockLogger,
      descriptorFormatter: null,
      templateDescription: null,
      equipmentDescriptionService: null,
    });
  });

  describe('Valid Input Cases', () => {
    it('should extract body hair density when component exists', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'descriptors:body_hair') {
            return { density: 'moderate' };
          }
          return null;
        }),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('moderate');
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        'descriptors:body_hair'
      );
    });

    it('should handle all valid density values', () => {
      const validValues = [
        'hairless',
        'sparse',
        'light',
        'moderate',
        'hairy',
        'very-hairy',
      ];

      validValues.forEach((value) => {
        const mockEntity = {
          getComponentData: jest.fn(() => ({ density: value })),
        };

        const result = composer.extractBodyHairDescription(mockEntity);
        expect(result).toBe(value);
      });
    });

    it('should handle hyphenated value "very-hairy"', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({ density: 'very-hairy' })),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('very-hairy');
    });
  });

  describe('Invalid Input Cases', () => {
    it('should return empty string when bodyEntity is null', () => {
      const result = composer.extractBodyHairDescription(null);
      expect(result).toBe('');
    });

    it('should return empty string when bodyEntity is undefined', () => {
      const result = composer.extractBodyHairDescription(undefined);
      expect(result).toBe('');
    });

    it('should return empty string when bodyEntity lacks getComponentData', () => {
      const mockEntity = { someOtherMethod: jest.fn() };
      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should return empty string when component does not exist', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => null),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('');
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        'descriptors:body_hair'
      );
    });

    it('should return empty string when component lacks density property', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({
          value: 'moderate', // Wrong property name
          hair: 'moderate', // Wrong property name
        })),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should return empty string when density is empty string', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({ density: '' })),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should return empty string when density is null', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({ density: null })),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle entity with getComponentData that throws error', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => {
          throw new Error('Component system error');
        }),
      };

      expect(() => {
        composer.extractBodyHairDescription(mockEntity);
      }).toThrow('Component system error');
    });

    it('should return non-string density values as-is', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({ density: 123 })),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe(123);
    });

    it('should handle component with additional properties', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({
          density: 'moderate',
          color: 'brown', // Additional property
          texture: 'coarse', // Additional property
        })),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('moderate');
    });
  });

  describe('Logging Behavior', () => {
    it('should log debug message when entity is null', () => {
      composer.extractBodyHairDescription(null);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'extractBodyHairDescription: bodyEntity is null/undefined'
      );
    });

    it('should log debug message when entity lacks getComponentData', () => {
      composer.extractBodyHairDescription({ noMethod: true });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'extractBodyHairDescription: bodyEntity lacks getComponentData method'
      );
    });

    it('should log warning when component lacks density property', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({ wrongProperty: 'value' })),
      };

      composer.extractBodyHairDescription(mockEntity);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'extractBodyHairDescription: body_hair component lacks density property',
        expect.any(Object)
      );
    });
  });
});
```

### Step 7: Create Integration Test

Create an integration test to verify real-world usage:

```javascript
// tests/integration/anatomy/bodyHairIntegration.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TestEntity } from '../../common/testEntity.js';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('Body Hair Integration', () => {
  let composer;

  beforeEach(() => {
    composer = new BodyDescriptionComposer({
      logger: console,
      descriptorFormatter: null,
      templateDescription: null,
      equipmentDescriptionService: null,
    });
  });

  it('should extract body hair from a complete entity', () => {
    const entity = new TestEntity('test-entity');
    entity.addComponent('descriptors:body_hair', {
      density: 'moderate',
    });

    const result = composer.extractBodyHairDescription(entity);
    expect(result).toBe('moderate');
  });

  it('should handle entity without body hair component', () => {
    const entity = new TestEntity('test-entity');
    // No body_hair component added

    const result = composer.extractBodyHairDescription(entity);
    expect(result).toBe('');
  });

  it('should work alongside other descriptors', () => {
    const entity = new TestEntity('test-entity');
    entity.addComponent('descriptors:build', { build: 'athletic' });
    entity.addComponent('descriptors:body_composition', {
      composition: 'lean',
    });
    entity.addComponent('descriptors:body_hair', { density: 'light' });

    // Each extraction should work independently
    const hairResult = composer.extractBodyHairDescription(entity);
    expect(hairResult).toBe('light');

    // Other extractors should still work
    const buildResult = composer.extractBuildDescription(entity);
    expect(buildResult).toBe('athletic');
  });
});
```

### Step 8: Run Tests

Execute all tests:

```bash
# Run the specific test file
npm test tests/unit/anatomy/bodyDescriptionComposer.bodyHair.test.js

# Run integration test
npm test tests/integration/anatomy/bodyHairIntegration.test.js

# Run with coverage
npm test -- --coverage tests/unit/anatomy/bodyDescriptionComposer.bodyHair.test.js

# Run all anatomy tests to check for regressions
npm test tests/unit/anatomy/
```

### Step 9: Validate Code Quality

```bash
# Run linting
npm run lint -- src/anatomy/bodyDescriptionComposer.js

# Run formatting
npm run format -- src/anatomy/bodyDescriptionComposer.js

# Run type checking
npm run typecheck
```

## Validation Steps

### 1. Schema Compliance

Verify the implementation matches the schema:

```bash
# Check that "density" is the correct property name
grep -n "density" data/schemas/components/descriptors/body_hair.schema.json
```

### 2. Method Signature Consistency

Ensure the method signature matches other extraction methods:

- Takes single parameter: bodyEntity
- Returns string
- Has JSDoc documentation

### 3. Error Handling Verification

Test with various invalid inputs:

- null entity
- undefined entity
- entity without getComponentData
- entity with component but wrong property name

### 4. Performance Check

The method should:

- Have minimal overhead
- Return quickly for invalid input
- Not throw unexpected errors

## Common Issues and Solutions

### Issue 1: Property Name Confusion

**Problem:** Using "value" or "hair" instead of "density".
**Solution:** The property name must be "density" as defined in the schema.

### Issue 2: Hyphenated Values

**Problem:** "very-hairy" value not handled correctly.
**Solution:** String values are returned as-is, hyphens are valid in strings.

### Issue 3: Component ID Typo

**Problem:** Using 'descriptors:body-hair' (with hyphen) instead of underscore.
**Solution:** The component ID is 'descriptors:body_hair' with underscore.

### Issue 4: Missing Null Checks

**Problem:** Method throws errors on edge cases.
**Solution:** Follow the defensive programming pattern with proper null checks.

## Rollback Plan

If issues arise:

1. Remove the method from bodyDescriptionComposer.js
2. Remove test files:
   - tests/unit/anatomy/bodyDescriptionComposer.bodyHair.test.js
   - tests/integration/anatomy/bodyHairIntegration.test.js
3. Run tests to ensure no regression

## Completion Checklist

- [ ] Method implemented following existing pattern
- [ ] JSDoc documentation added
- [ ] Defensive programming with null checks
- [ ] Property name "density" used correctly
- [ ] Unit tests created and passing
- [ ] Integration test created and passing
- [ ] Code linting passing
- [ ] Code formatting applied
- [ ] Type checking passing
- [ ] Test coverage maintained/improved
- [ ] No regression in existing tests
- [ ] Method ready for integration in NEWDESC-04

## Next Steps

After completing this method:

- NEWDESC-04: Update composeDescription to use both new methods
- NEWDESC-05: Create comprehensive unit tests for all body-level descriptors
- NEWDESC-06: Create integration tests for complete descriptions

## Notes for Implementer

- The property name is "density", not "value" or "hair"
- This is a body-level descriptor attached to the main entity
- Follow the exact pattern of extractBuildDescription() for consistency
- Empty string is the standard "no value" return
- The logger is optional - use optional chaining (?.)
- Test all enum values including the hyphenated "very-hairy"
- This method should be pure with no side effects
- Consider performance - this may be called frequently
