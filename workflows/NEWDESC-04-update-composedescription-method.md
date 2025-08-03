# NEWDESC-04: Update composeDescription Method for Body-Level Descriptors

## Overview

Update the `composeDescription()` method in the `BodyDescriptionComposer` class to integrate the new body-level descriptors (body_composition and body_hair). This involves adding special handling for these descriptors in the description order processing loop, similar to how the "build" descriptor is currently handled.

## Priority

**High** - Critical integration point that brings together the configuration and extraction methods.

## Dependencies

- NEWDESC-01: Update Anatomy Formatting Configuration (completed)
- NEWDESC-02: Implement Body Composition Extraction Method (completed)
- NEWDESC-03: Implement Body Hair Extraction Method (completed)

## Estimated Effort

**3 hours** - Implementation, testing, and integration validation

## Acceptance Criteria

1. ✅ composeDescription method handles "body_composition" in descriptionOrder
2. ✅ composeDescription method handles "body_hair" in descriptionOrder
3. ✅ Body composition appears after "Build:" in the output
4. ✅ Body hair appears after "Body composition:" in the output
5. ✅ Empty descriptors don't create blank lines
6. ✅ Descriptors are marked as processed to avoid duplication
7. ✅ Output format matches existing patterns (capitalized labels with colons)
8. ✅ No regression in existing functionality
9. ✅ Integration tests pass with new descriptors

## Implementation Steps

### Step 1: Analyze Current Implementation

First, understand the current `composeDescription` method structure:

```javascript
// Current pattern in composeDescription() method
for (const partType of descriptionOrder) {
  if (processedTypes.has(partType)) {
    continue;
  }

  // Handle overall build
  if (partType === 'build') {
    const buildDescription = this.extractBuildDescription(bodyEntity);
    if (buildDescription) {
      lines.push(`Build: ${buildDescription}`);
    }
    processedTypes.add(partType);
    continue;
  }

  // Handle equipment descriptions
  if (partType === 'equipment' && this.equipmentDescriptionService) {
    // ... equipment handling ...
    continue;
  }

  // Process body parts
  if (partsByType.has(partType)) {
    // ... body part handling ...
  }
}
```

Key patterns:

- Special string comparisons for body-level descriptors
- Use extraction methods to get values
- Format with capitalized label and colon
- Only add line if value exists (no empty lines)
- Mark as processed to prevent duplication
- Use `continue` to skip to next iteration

### Step 2: Locate Insertion Point

Find the correct location in `src/anatomy/bodyDescriptionComposer.js`:

```javascript
// In the composeDescription() method
// After the 'build' handler
// Before the 'equipment' handler
// Approximately lines 180-200
```

### Step 3: Add Body Composition Handler

Insert the body composition handler after the build handler:

```javascript
// Handle overall build (existing)
if (partType === 'build') {
  const buildDescription = this.extractBuildDescription(bodyEntity);
  if (buildDescription) {
    lines.push(`Build: ${buildDescription}`);
  }
  processedTypes.add(partType);
  continue;
}

// Handle body composition (NEW)
if (partType === 'body_composition') {
  const compositionDescription = this.extractBodyCompositionDescription(bodyEntity);
  if (compositionDescription) {
    lines.push(`Body composition: ${compositionDescription}`);
  }
  processedTypes.add(partType);
  continue;
}
```

### Step 4: Add Body Hair Handler

Add the body hair handler after body composition:

```javascript
// Handle body composition (from Step 3)
if (partType === 'body_composition') {
  const compositionDescription = this.extractBodyCompositionDescription(bodyEntity);
  if (compositionDescription) {
    lines.push(`Body composition: ${compositionDescription}`);
  }
  processedTypes.add(partType);
  continue;
}

// Handle body hair (NEW)
if (partType === 'body_hair') {
  const bodyHairDescription = this.extractBodyHairDescription(bodyEntity);
  if (bodyHairDescription) {
    lines.push(`Body hair: ${bodyHairDescription}`);
  }
  processedTypes.add(partType);
  continue;
}
```

### Step 5: Complete Integration

The full updated section should look like:

```javascript
// Process parts in configured order
for (const partType of descriptionOrder) {
  if (processedTypes.has(partType)) {
    continue;
  }

  // Handle overall build (existing)
  if (partType === 'build') {
    const buildDescription = this.extractBuildDescription(bodyEntity);
    if (buildDescription) {
      lines.push(`Build: ${buildDescription}`);
    }
    processedTypes.add(partType);
    continue;
  }

  // Handle body composition (NEW)
  if (partType === 'body_composition') {
    const compositionDescription =
      this.extractBodyCompositionDescription(bodyEntity);
    if (compositionDescription) {
      lines.push(`Body composition: ${compositionDescription}`);
    }
    processedTypes.add(partType);
    continue;
  }

  // Handle body hair (NEW)
  if (partType === 'body_hair') {
    const bodyHairDescription = this.extractBodyHairDescription(bodyEntity);
    if (bodyHairDescription) {
      lines.push(`Body hair: ${bodyHairDescription}`);
    }
    processedTypes.add(partType);
    continue;
  }

  // Handle equipment descriptions (existing)
  if (partType === 'equipment' && this.equipmentDescriptionService) {
    const equipmentLines =
      this.equipmentDescriptionService.generateEquipmentDescriptions(
        bodyEntity,
        partsByType
      );
    lines.push(...equipmentLines);
    processedTypes.add(partType);
    continue;
  }

  // Process body parts (existing)
  if (partsByType.has(partType)) {
    // ... existing body part handling ...
  }
}
```

### Step 6: Add Debug Logging (Optional)

For better debugging, add logging to track descriptor processing:

```javascript
// Handle body composition
if (partType === 'body_composition') {
  this.#logger?.debug('Processing body_composition descriptor');
  const compositionDescription = this.extractBodyCompositionDescription(bodyEntity);
  if (compositionDescription) {
    this.#logger?.debug(`Adding body composition: ${compositionDescription}`);
    lines.push(`Body composition: ${compositionDescription}`);
  } else {
    this.#logger?.debug('No body composition found');
  }
  processedTypes.add(partType);
  continue;
}
```

### Step 7: Create Unit Tests

Create comprehensive unit tests for the integration:

```javascript
// tests/unit/anatomy/bodyDescriptionComposer.integration.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('BodyDescriptionComposer - composeDescription with new descriptors', () => {
  let composer;
  let mockLogger;
  let mockDescriptorFormatter;
  let mockTemplateDescription;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockDescriptorFormatter = {
      formatDescriptors: jest.fn(() => 'formatted descriptors'),
    };

    mockTemplateDescription = {
      generateDescription: jest.fn(() => 'part description'),
    };

    composer = new BodyDescriptionComposer({
      logger: mockLogger,
      descriptorFormatter: mockDescriptorFormatter,
      templateDescription: mockTemplateDescription,
      equipmentDescriptionService: null,
    });
  });

  describe('Body-Level Descriptor Integration', () => {
    it('should include body composition in description', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'descriptors:body_composition') {
            return { composition: 'average' };
          }
          return null;
        }),
      };

      const config = {
        descriptionOrder: ['body_composition'],
      };

      const result = composer.composeDescription(mockEntity, [], config);
      expect(result).toContain('Body composition: average');
    });

    it('should include body hair in description', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'descriptors:body_hair') {
            return { density: 'moderate' };
          }
          return null;
        }),
      };

      const config = {
        descriptionOrder: ['body_hair'],
      };

      const result = composer.composeDescription(mockEntity, [], config);
      expect(result).toContain('Body hair: moderate');
    });

    it('should include all body-level descriptors in correct order', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          switch (componentId) {
            case 'descriptors:build':
              return { build: 'athletic' };
            case 'descriptors:body_composition':
              return { composition: 'lean' };
            case 'descriptors:body_hair':
              return { density: 'light' };
            default:
              return null;
          }
        }),
      };

      const config = {
        descriptionOrder: ['build', 'body_composition', 'body_hair'],
      };

      const result = composer.composeDescription(mockEntity, [], config);
      const lines = result.split('\n');

      expect(lines[0]).toBe('Build: athletic');
      expect(lines[1]).toBe('Body composition: lean');
      expect(lines[2]).toBe('Body hair: light');
    });

    it('should skip descriptors without values', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => null),
      };

      const config = {
        descriptionOrder: ['build', 'body_composition', 'body_hair'],
      };

      const result = composer.composeDescription(mockEntity, [], config);
      expect(result).toBe('');
    });

    it('should handle mixed body-level and part descriptors', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'descriptors:body_composition') {
            return { composition: 'average' };
          }
          return null;
        }),
      };

      const mockPart = {
        getComponentData: jest.fn(() => ({
          type: 'hair',
          subType: 'hair',
        })),
      };

      const config = {
        descriptionOrder: ['body_composition', 'hair'],
      };

      const result = composer.composeDescription(
        mockEntity,
        [mockPart],
        config
      );

      expect(result).toContain('Body composition: average');
      expect(result).toContain('part description'); // From mock
    });
  });

  describe('Process Tracking', () => {
    it('should not duplicate body-level descriptors', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'descriptors:body_composition') {
            return { composition: 'average' };
          }
          return null;
        }),
      };

      const config = {
        // Duplicate entries in descriptionOrder
        descriptionOrder: ['body_composition', 'body_composition'],
      };

      const result = composer.composeDescription(mockEntity, [], config);
      const occurrences = (result.match(/Body composition: average/g) || [])
        .length;
      expect(occurrences).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle extraction method errors gracefully', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => {
          throw new Error('Component error');
        }),
      };

      const config = {
        descriptionOrder: ['body_composition', 'body_hair'],
      };

      // Should not throw, but log error
      expect(() => {
        composer.composeDescription(mockEntity, [], config);
      }).toThrow('Component error');
    });
  });
});
```

### Step 8: Create Integration Test

Create a full integration test:

```javascript
// tests/integration/anatomy/bodyLevelDescriptorsIntegration.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TestEntity } from '../../common/testEntity.js';
import { TestPart } from '../../common/testPart.js';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import { DescriptorFormatter } from '../../../src/anatomy/descriptorFormatter.js';
import { DescriptionTemplate } from '../../../src/anatomy/descriptionTemplate.js';

describe('Body-Level Descriptors Full Integration', () => {
  let composer;
  let descriptorFormatter;
  let descriptionTemplate;

  beforeEach(() => {
    descriptorFormatter = new DescriptorFormatter({
      logger: console,
    });

    descriptionTemplate = new DescriptionTemplate({
      logger: console,
      descriptorFormatter,
    });

    composer = new BodyDescriptionComposer({
      logger: console,
      descriptorFormatter,
      templateDescription: descriptionTemplate,
      equipmentDescriptionService: null,
    });
  });

  it('should generate complete description with all body-level descriptors', () => {
    // Create entity with all descriptors
    const entity = new TestEntity('test-human');
    entity.addComponent('anatomy:body', { type: 'humanoid' });
    entity.addComponent('descriptors:build', { build: 'athletic' });
    entity.addComponent('descriptors:body_composition', {
      composition: 'lean',
    });
    entity.addComponent('descriptors:body_hair', { density: 'light' });

    // Create some body parts
    const hair = new TestPart('hair-part');
    hair.addComponent('anatomy:part', { type: 'hair', subType: 'hair' });
    hair.addComponent('descriptors:length_hair', { length: 'long' });
    hair.addComponent('descriptors:color_basic', { color: 'blonde' });

    const config = {
      descriptionOrder: ['build', 'body_composition', 'body_hair', 'hair'],
      descriptorOrder: ['descriptors:length_hair', 'descriptors:color_basic'],
      templates: {
        hair: '{descriptors} {subType}',
      },
    };

    const result = composer.composeDescription(entity, [hair], config);

    // Verify output format
    const expectedLines = [
      'Build: athletic',
      'Body composition: lean',
      'Body hair: light',
      'Hair: long blonde hair',
    ];

    const lines = result.split('\n').filter((line) => line.trim());
    expect(lines).toEqual(expectedLines);
  });

  it('should handle partial descriptors gracefully', () => {
    const entity = new TestEntity('test-human');
    entity.addComponent('anatomy:body', { type: 'humanoid' });
    // Only add body_hair, skip body_composition
    entity.addComponent('descriptors:body_hair', { density: 'moderate' });

    const config = {
      descriptionOrder: ['build', 'body_composition', 'body_hair'],
    };

    const result = composer.composeDescription(entity, [], config);

    // Should only have body hair line, no empty lines
    expect(result).toBe('Body hair: moderate');
    expect(result).not.toContain('Build:');
    expect(result).not.toContain('Body composition:');
  });
});
```

### Step 9: Run All Tests

```bash
# Run unit tests
npm test tests/unit/anatomy/bodyDescriptionComposer.integration.test.js

# Run integration tests
npm test tests/integration/anatomy/bodyLevelDescriptorsIntegration.test.js

# Run all anatomy tests
npm test tests/unit/anatomy/
npm test tests/integration/anatomy/

# Check coverage
npm test -- --coverage src/anatomy/bodyDescriptionComposer.js
```

### Step 10: Manual Testing

Create a test script for manual verification:

```javascript
// scripts/test-body-descriptors.js

import { BodyDescriptionComposer } from '../src/anatomy/bodyDescriptionComposer.js';

// Create test entity
const testEntity = {
  getComponentData: (componentId) => {
    const components = {
      'descriptors:build': { build: 'muscular' },
      'descriptors:body_composition': { composition: 'lean' },
      'descriptors:body_hair': { density: 'moderate' },
    };
    return components[componentId] || null;
  },
};

// Create composer
const composer = new BodyDescriptionComposer({
  logger: console,
  descriptorFormatter: null,
  templateDescription: null,
  equipmentDescriptionService: null,
});

// Test configuration
const config = {
  descriptionOrder: ['build', 'body_composition', 'body_hair'],
};

// Generate description
const result = composer.composeDescription(testEntity, [], config);
console.log('Generated Description:');
console.log(result);
console.log('\nExpected:');
console.log('Build: muscular');
console.log('Body composition: lean');
console.log('Body hair: moderate');
```

## Validation Steps

### 1. Code Quality

```bash
# Lint the file
npm run lint -- src/anatomy/bodyDescriptionComposer.js

# Format the file
npm run format -- src/anatomy/bodyDescriptionComposer.js

# Type check
npm run typecheck
```

### 2. Test Coverage

```bash
# Ensure coverage doesn't drop
npm test -- --coverage --collectCoverageFrom=src/anatomy/bodyDescriptionComposer.js
```

### 3. Integration Testing

1. Start the application:

   ```bash
   npm run dev
   ```

2. Create or load an entity with body descriptors
3. Verify the description displays correctly
4. Check that the order matches the configuration

### 4. Edge Case Testing

Test with:

- No body-level descriptors
- Only one descriptor present
- All descriptors present
- Invalid configuration order
- Duplicate entries in descriptionOrder

## Common Issues and Solutions

### Issue 1: Descriptors Not Appearing

**Problem:** Body-level descriptors don't show in output.
**Solution:** Verify:

- The extraction methods exist and are called
- The configuration includes the descriptors in descriptionOrder
- The component data has the correct property names

### Issue 2: Wrong Order

**Problem:** Descriptors appear in wrong order.
**Solution:** The output order follows descriptionOrder array exactly. Check the configuration.

### Issue 3: Empty Lines

**Problem:** Blank lines appear in output.
**Solution:** Ensure you only push to lines array when descriptor value exists.

### Issue 4: Duplicate Descriptors

**Problem:** Same descriptor appears multiple times.
**Solution:** Verify processedTypes.add() is called for each descriptor.

## Rollback Plan

If issues arise:

1. Revert changes to composeDescription method
2. Keep the extraction methods (they don't affect anything alone)
3. Run all tests to verify functionality restored

## Completion Checklist

- [ ] Body composition handler added to composeDescription
- [ ] Body hair handler added to composeDescription
- [ ] Handlers follow existing pattern exactly
- [ ] ProcessedTypes tracking implemented
- [ ] Empty values don't create blank lines
- [ ] Label formatting matches pattern (Capital: value)
- [ ] Unit tests created and passing
- [ ] Integration tests created and passing
- [ ] Manual testing completed
- [ ] Code quality checks passing
- [ ] No regression in existing functionality
- [ ] Documentation comments updated if needed

## Next Steps

After completing this integration:

- NEWDESC-05: Create comprehensive unit tests
- NEWDESC-06: Create full integration tests
- NEWDESC-07: Add projection descriptor support
- Begin testing with real game entities

## Notes for Implementer

- The order in the if-statements doesn't matter, only descriptionOrder
- Always use processedTypes to prevent duplicates
- Keep the pattern consistent with existing code
- The capitalization pattern is "Body composition:" not "Body Composition:"
- Empty descriptor values should not create empty lines
- This change only affects entities with the new components
- Part-level descriptors (facial_hair, projection) work automatically
