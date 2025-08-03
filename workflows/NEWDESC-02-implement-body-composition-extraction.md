# NEWDESC-02: Implement Body Composition Extraction Method

## Overview

Implement the `extractBodyCompositionDescription()` method in the `BodyDescriptionComposer` class to extract body composition descriptors from entities. This method follows the existing pattern established by `extractBuildDescription()` and will enable the display of body composition (underweight, lean, average, soft, chubby, overweight, obese) in entity descriptions.

## Priority

**High** - Core functionality required for body composition descriptor support.

## Dependencies

- NEWDESC-01: Update Anatomy Formatting Configuration (must be completed first)

## Estimated Effort

**2 hours** - Implementation, testing, and validation

## Acceptance Criteria

1. ✅ Method `extractBodyCompositionDescription()` is implemented in bodyDescriptionComposer.js
2. ✅ Method follows the same pattern as `extractBuildDescription()`
3. ✅ Method properly handles missing or invalid component data
4. ✅ Method extracts the "composition" property from descriptors:body_composition component
5. ✅ Method returns empty string for invalid input
6. ✅ JSDoc documentation is complete and accurate
7. ✅ Method integrates cleanly with existing code
8. ✅ No regression in existing functionality

## Implementation Steps

### Step 1: Analyze Existing Pattern

First, examine the existing `extractBuildDescription()` method to understand the pattern:

```javascript
// Current implementation in bodyDescriptionComposer.js
/**
 * Extract build description from body entity
 * @param {object} bodyEntity - The body entity
 * @returns {string} Build description
 */
extractBuildDescription(bodyEntity) {
  if (!bodyEntity || typeof bodyEntity.getComponentData !== 'function') {
    return '';
  }
  const buildComponent = bodyEntity.getComponentData('descriptors:build');
  if (!buildComponent || !buildComponent.build) {
    return '';
  }
  return buildComponent.build;
}
```

Key patterns to follow:

- Defensive programming with null/undefined checks
- Type checking for the getComponentData function
- Component data validation
- Return empty string on any failure
- Clear JSDoc documentation

### Step 2: Locate Implementation Point

Open `src/anatomy/bodyDescriptionComposer.js` and find the appropriate location to add the new method:

```javascript
// Add after extractBuildDescription() method
// Around line 50-60 (after existing extraction methods)
```

### Step 3: Implement extractBodyCompositionDescription Method

Add the following method implementation:

```javascript
/**
 * Extract body composition description from body entity
 * @param {object} bodyEntity - The body entity
 * @returns {string} Body composition description
 */
extractBodyCompositionDescription(bodyEntity) {
  if (!bodyEntity || typeof bodyEntity.getComponentData !== 'function') {
    return '';
  }
  const compositionComponent = bodyEntity.getComponentData('descriptors:body_composition');
  if (!compositionComponent || !compositionComponent.composition) {
    return '';
  }
  return compositionComponent.composition;
}
```

### Step 4: Add Method to Class Interface

Ensure the method is properly part of the class structure:

```javascript
class BodyDescriptionComposer {
  // ... existing constructor and fields ...

  // Existing extraction methods
  extractBuildDescription(bodyEntity) {
    // ... existing implementation ...
  }

  // NEW: Body composition extraction
  extractBodyCompositionDescription(bodyEntity) {
    if (!bodyEntity || typeof bodyEntity.getComponentData !== 'function') {
      return '';
    }
    const compositionComponent = bodyEntity.getComponentData(
      'descriptors:body_composition'
    );
    if (!compositionComponent || !compositionComponent.composition) {
      return '';
    }
    return compositionComponent.composition;
  }

  // ... rest of the class methods ...
}
```

### Step 5: Validate Component Schema

Verify the expected component structure by checking the schema:

```bash
# Check the body_composition component schema
cat data/schemas/components/descriptors/body_composition.schema.json
```

Expected schema structure:

```json
{
  "type": "object",
  "properties": {
    "composition": {
      "type": "string",
      "enum": [
        "underweight",
        "lean",
        "average",
        "soft",
        "chubby",
        "overweight",
        "obese"
      ]
    }
  },
  "required": ["composition"]
}
```

### Step 6: Add Error Logging (Optional Enhancement)

For better debugging, consider adding error logging:

```javascript
extractBodyCompositionDescription(bodyEntity) {
  if (!bodyEntity) {
    this.#logger?.debug('extractBodyCompositionDescription: bodyEntity is null/undefined');
    return '';
  }

  if (typeof bodyEntity.getComponentData !== 'function') {
    this.#logger?.debug('extractBodyCompositionDescription: bodyEntity lacks getComponentData method');
    return '';
  }

  const compositionComponent = bodyEntity.getComponentData('descriptors:body_composition');
  if (!compositionComponent) {
    this.#logger?.debug('extractBodyCompositionDescription: no body_composition component found');
    return '';
  }

  if (!compositionComponent.composition) {
    this.#logger?.warn('extractBodyCompositionDescription: body_composition component lacks composition property');
    return '';
  }

  return compositionComponent.composition;
}
```

### Step 7: Create Unit Test

Create a unit test file for the new method:

```javascript
// tests/unit/anatomy/bodyDescriptionComposer.bodyComposition.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('BodyDescriptionComposer - extractBodyCompositionDescription', () => {
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
    it('should extract body composition when component exists', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'descriptors:body_composition') {
            return { composition: 'average' };
          }
          return null;
        }),
      };

      const result = composer.extractBodyCompositionDescription(mockEntity);
      expect(result).toBe('average');
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        'descriptors:body_composition'
      );
    });

    it('should handle all valid composition values', () => {
      const validValues = [
        'underweight',
        'lean',
        'average',
        'soft',
        'chubby',
        'overweight',
        'obese',
      ];

      validValues.forEach((value) => {
        const mockEntity = {
          getComponentData: jest.fn(() => ({ composition: value })),
        };

        const result = composer.extractBodyCompositionDescription(mockEntity);
        expect(result).toBe(value);
      });
    });
  });

  describe('Invalid Input Cases', () => {
    it('should return empty string when bodyEntity is null', () => {
      const result = composer.extractBodyCompositionDescription(null);
      expect(result).toBe('');
    });

    it('should return empty string when bodyEntity is undefined', () => {
      const result = composer.extractBodyCompositionDescription(undefined);
      expect(result).toBe('');
    });

    it('should return empty string when bodyEntity lacks getComponentData', () => {
      const mockEntity = { someOtherMethod: jest.fn() };
      const result = composer.extractBodyCompositionDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should return empty string when component does not exist', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => null),
      };

      const result = composer.extractBodyCompositionDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should return empty string when component lacks composition property', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({ someOtherProperty: 'value' })),
      };

      const result = composer.extractBodyCompositionDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should return empty string when composition is empty string', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({ composition: '' })),
      };

      const result = composer.extractBodyCompositionDescription(mockEntity);
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
        composer.extractBodyCompositionDescription(mockEntity);
      }).toThrow('Component system error');
    });

    it('should handle composition with unexpected type', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({ composition: 123 })),
      };

      // Should return the value as-is (coerced to string by the template)
      const result = composer.extractBodyCompositionDescription(mockEntity);
      expect(result).toBe(123);
    });
  });
});
```

### Step 8: Run Tests

Execute the tests to verify the implementation:

```bash
# Run the specific test file
npm test tests/unit/anatomy/bodyDescriptionComposer.bodyComposition.test.js

# Run with coverage
npm test -- --coverage tests/unit/anatomy/bodyDescriptionComposer.bodyComposition.test.js

# Run all anatomy tests to check for regressions
npm test tests/unit/anatomy/
```

### Step 9: Integration Verification

Create a simple integration test to verify the method works with real entity data:

```javascript
// tests/integration/anatomy/bodyCompositionIntegration.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TestEntity } from '../../common/testEntity.js';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('Body Composition Integration', () => {
  let composer;

  beforeEach(() => {
    composer = new BodyDescriptionComposer({
      logger: console,
      descriptorFormatter: null,
      templateDescription: null,
      equipmentDescriptionService: null,
    });
  });

  it('should extract composition from a complete entity', () => {
    const entity = new TestEntity('test-entity');
    entity.addComponent('descriptors:body_composition', {
      composition: 'athletic',
    });

    const result = composer.extractBodyCompositionDescription(entity);
    expect(result).toBe('athletic');
  });
});
```

## Validation Steps

### 1. Code Quality Checks

```bash
# Run linting
npm run lint -- src/anatomy/bodyDescriptionComposer.js

# Run type checking
npm run typecheck
```

### 2. Test Coverage

```bash
# Check test coverage for the file
npm test -- --coverage --collectCoverageFrom=src/anatomy/bodyDescriptionComposer.js
```

### 3. Manual Testing

1. Start the development server:

   ```bash
   npm run dev
   ```

2. Create an entity with body composition:

   ```javascript
   const testEntity = {
     components: {
       'anatomy:body': {
         /* body config */
       },
       'descriptors:body_composition': { composition: 'average' },
     },
   };
   ```

3. Verify the method extracts the composition correctly

### 4. Integration with composeDescription

Note: Full integration requires NEWDESC-04 to be completed. This ticket only implements the extraction method.

## Common Issues and Solutions

### Issue 1: Method Not Found

**Problem:** The method is not accessible when called.
**Solution:** Ensure the method is properly added to the class and not accidentally made static or private.

### Issue 2: Component Not Found

**Problem:** The method always returns empty string even with valid data.
**Solution:** Verify the component ID is exactly 'descriptors:body_composition' (check for typos).

### Issue 3: Property Name Mismatch

**Problem:** The component exists but the value is not extracted.
**Solution:** Ensure you're accessing the 'composition' property, not 'value' or another property name.

## Rollback Plan

If issues arise:

1. Remove the method from bodyDescriptionComposer.js
2. Remove the test file
3. Revert any other changes
4. Run tests to ensure no regression

## Completion Checklist

- [ ] Method implemented following existing pattern
- [ ] JSDoc documentation added
- [ ] Defensive programming practices applied
- [ ] Unit tests created and passing
- [ ] Integration test created
- [ ] Code linting passing
- [ ] Type checking passing
- [ ] Test coverage maintained/improved
- [ ] No regression in existing tests
- [ ] Method ready for integration in NEWDESC-04

## Next Steps

After completing this method:

- NEWDESC-03: Implement body hair extraction method (parallel work)
- NEWDESC-04: Update composeDescription to use this method
- NEWDESC-05: Create comprehensive unit tests

## Notes for Implementer

- Follow the exact pattern of extractBuildDescription() for consistency
- The method should be pure - no side effects
- Empty string return is the standard for "no value" in this system
- The composition values are defined in the schema - stick to those values in tests
- Remember this is a body-level descriptor, not a part-level descriptor
- The logger parameter is optional - handle cases where it might be null
