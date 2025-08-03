# NEWDESC-03: Implement Body Hair Extraction Method

## Overview

Implement the `extractBodyHairDescription()` method in the `BodyDescriptionComposer` class to extract body hair descriptors from entities. This method follows the existing pattern established by `extractBuildDescription()` and `extractBodyCompositionDescription()` and will enable the display of body hair density (hairless, sparse, light, moderate, hairy, very-hairy) in entity descriptions.

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

### Step 1: Verify Component Structure

The `descriptors:body_hair` component already exists. Verify its structure:

```bash
# Check the body_hair component definition
cat data/mods/descriptors/components/body_hair.component.json
```

Expected component structure:

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "descriptors:body_hair",
  "description": "Describes the body hair characteristics",
  "dataSchema": {
    "type": "object",
    "properties": {
      "density": {
        "type": "string",
        "description": "The density or amount of body hair",
        "enum": ["hairless", "sparse", "light", "moderate", "hairy", "very-hairy"],
        "default": "moderate"
      }
    },
    "required": ["density"],
    "additionalProperties": false
  }
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

### Step 4: Final Method Implementation

The production-ready method follows the same pattern as existing extraction methods:

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

Note: This follows the exact pattern of `extractBuildDescription()` and `extractBodyCompositionDescription()` methods.

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

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('BodyDescriptionComposer - extractBodyHairDescription', () => {
  let composer;
  let mockBodyPartDescriptionBuilder;
  let mockBodyGraphService;
  let mockEntityFinder;
  let mockAnatomyFormattingService;
  let mockPartDescriptionGenerator;

  beforeEach(() => {
    // Create mocks following existing pattern
    mockBodyPartDescriptionBuilder = {
      buildDescription: jest.fn(),
      buildMultipleDescription: jest.fn(),
      getPlural: jest.fn(),
    };

    mockBodyGraphService = {
      getAllParts: jest.fn(),
    };

    mockEntityFinder = {
      getEntityInstance: jest.fn(),
    };

    mockAnatomyFormattingService = {
      getDescriptionOrder: jest.fn(),
      getGroupedParts: jest.fn(),
    };

    mockPartDescriptionGenerator = {
      generatePartDescription: jest.fn(),
    };

    // Create composer instance with actual constructor signature
    composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      anatomyFormattingService: mockAnatomyFormattingService,
      partDescriptionGenerator: mockPartDescriptionGenerator,
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

  describe('Consistent Behavior', () => {
    it('should work consistently with multiple calls', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({ density: 'hairy' })),
      };

      const result1 = composer.extractBodyHairDescription(mockEntity);
      const result2 = composer.extractBodyHairDescription(mockEntity);
      const result3 = composer.extractBodyHairDescription(mockEntity);

      expect(result1).toBe('hairy');
      expect(result2).toBe('hairy');
      expect(result3).toBe('hairy');
      expect(mockEntity.getComponentData).toHaveBeenCalledTimes(3);
    });

    it('should not modify the input entity', () => {
      const originalEntity = {
        getComponentData: jest.fn(() => ({ density: 'sparse' })),
        otherProperty: 'should not change',
      };

      const result = composer.extractBodyHairDescription(originalEntity);

      expect(result).toBe('sparse');
      expect(originalEntity.otherProperty).toBe('should not change');
      expect(typeof originalEntity.getComponentData).toBe('function');
    });
  });
});
```

### Step 7: Create Integration Test

Create an integration test to verify real-world usage:

```javascript
// tests/integration/anatomy/bodyHairIntegration.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('Body Hair Integration', () => {
  let composer;

  beforeEach(() => {
    // Create mocks for required dependencies
    const mockBodyPartDescriptionBuilder = {
      buildDescription: jest.fn(),
      buildMultipleDescription: jest.fn(),
      getPlural: jest.fn(),
    };

    const mockBodyGraphService = {
      getAllParts: jest.fn(),
    };

    const mockEntityFinder = {
      getEntityInstance: jest.fn(),
    };

    const mockAnatomyFormattingService = {
      getDescriptionOrder: jest.fn(),
      getGroupedParts: jest.fn(),
    };

    const mockPartDescriptionGenerator = {
      generatePartDescription: jest.fn(),
    };

    composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      anatomyFormattingService: mockAnatomyFormattingService,
      partDescriptionGenerator: mockPartDescriptionGenerator,
    });
  });

  it('should extract body hair from a complete entity', () => {
    // Create a mock entity that matches the expected interface
    const mockEntity = {
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === 'descriptors:body_hair') {
          return { density: 'moderate' };
        }
        return null;
      }),
    };

    const result = composer.extractBodyHairDescription(mockEntity);
    expect(result).toBe('moderate');
    expect(mockEntity.getComponentData).toHaveBeenCalledWith('descriptors:body_hair');
  });

  it('should handle entity without body hair component', () => {
    const mockEntity = {
      hasComponent: jest.fn().mockReturnValue(false),
      getComponentData: jest.fn().mockReturnValue(null),
    };

    const result = composer.extractBodyHairDescription(mockEntity);
    expect(result).toBe('');
  });

  it('should work alongside other descriptors', () => {
    const mockEntity = {
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === 'descriptors:build') {
          return { build: 'athletic' };
        }
        if (componentId === 'descriptors:body_composition') {
          return { composition: 'lean' };
        }
        if (componentId === 'descriptors:body_hair') {
          return { density: 'light' };
        }
        return null;
      }),
    };

    // Each extraction should work independently
    const hairResult = composer.extractBodyHairDescription(mockEntity);
    expect(hairResult).toBe('light');

    // Other extractors should still work
    const buildResult = composer.extractBuildDescription(mockEntity);
    expect(buildResult).toBe('athletic');

    const compositionResult = composer.extractBodyCompositionDescription(mockEntity);
    expect(compositionResult).toBe('lean');
  });
});
```

### Step 8: Run Tests

Execute all tests:

```bash
# Run the specific test file
npm run test:unit -- tests/unit/anatomy/bodyDescriptionComposer.bodyHair.test.js

# Run integration test
npm run test:integration -- tests/integration/anatomy/bodyHairIntegration.test.js

# Run with coverage
npm run test:unit -- --coverage tests/unit/anatomy/bodyDescriptionComposer.bodyHair.test.js

# Run all anatomy tests to check for regressions
npm run test:unit -- tests/unit/anatomy/
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

### 1. Component Structure Compliance

Verify the implementation matches the component structure:

```bash
# Check that "density" is the correct property name
grep -n "density" data/mods/descriptors/components/body_hair.component.json
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
**Solution:** The property name must be "density" as defined in the component definition.

### Issue 2: Hyphenated Values

**Problem:** "very-hairy" value not handled correctly.
**Solution:** String values are returned as-is, hyphens are valid in strings.

### Issue 3: Component ID Typo

**Problem:** Using 'descriptors:body-hair' (with hyphen) instead of underscore.
**Solution:** The component ID is 'descriptors:body_hair' with underscore, as defined in the existing component file.

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

- [ ] Method implemented following existing pattern (extractBuildDescription, extractBodyCompositionDescription)
- [ ] JSDoc documentation added
- [ ] Defensive programming with null checks
- [ ] Property name "density" used correctly (verified in existing component)
- [ ] Unit tests created and passing
- [ ] Integration test created and passing  
- [ ] Code linting passing (npm run lint)
- [ ] Code formatting applied (npm run format)
- [ ] Type checking passing (npm run typecheck)
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
- Follow the exact pattern of extractBuildDescription() and extractBodyCompositionDescription() for consistency
- Empty string is the standard "no value" return
- No logging is used - follow the existing pattern of simple validation and return
- Test all enum values including the hyphenated "very-hairy"
- This method should be pure with no side effects
- Consider performance - this may be called frequently
- The component already exists at data/mods/descriptors/components/body_hair.component.json
