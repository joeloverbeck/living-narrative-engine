# NEWDESC-05: Create Unit Tests for Body-Level Descriptors

## Overview

Create comprehensive unit tests for all body-level descriptor functionality, including the extraction methods and their integration with the composeDescription method. This ticket consolidates all unit testing requirements to ensure complete coverage and proper validation of the new descriptor features.

## Priority

**Medium** - Essential for ensuring code quality and preventing regressions.

## Dependencies

- NEWDESC-02: Implement Body Composition Extraction Method (completed)
- NEWDESC-03: Implement Body Hair Extraction Method (completed)
- NEWDESC-04: Update composeDescription Method (completed)

## Estimated Effort

**4 hours** - Comprehensive test suite creation and validation

## Acceptance Criteria

1. ✅ Unit tests for extractBodyCompositionDescription() with >95% coverage
2. ✅ Unit tests for extractBodyHairDescription() with >95% coverage
3. ✅ Unit tests for composeDescription() body-level descriptor integration
4. ✅ Edge case coverage for all error conditions
5. ✅ Performance tests for extraction methods
6. ✅ Mock object tests for isolation
7. ✅ Test suite follows project testing conventions
8. ✅ All tests pass consistently
9. ✅ Coverage report shows no gaps in new code

## Implementation Steps

### Step 1: Create Test Structure

Create a comprehensive test suite structure:

```bash
# Create test files if not already created
tests/unit/anatomy/
├── bodyDescriptionComposer.test.js          # Existing tests
├── bodyDescriptionComposer.bodyLevel.test.js # New consolidated tests
├── bodyDescriptionComposer.performance.test.js # Performance tests
└── fixtures/
    └── bodyLevelDescriptors.js              # Test data fixtures
```

### Step 2: Create Test Fixtures

Create reusable test data:

```javascript
// tests/unit/anatomy/fixtures/bodyLevelDescriptors.js

export const VALID_BODY_COMPOSITIONS = [
  'underweight',
  'lean',
  'average',
  'soft',
  'chubby',
  'overweight',
  'obese',
];

export const VALID_BODY_HAIR_DENSITIES = [
  'hairless',
  'sparse',
  'light',
  'moderate',
  'hairy',
  'very-hairy',
];

export const createMockEntity = (components = {}) => ({
  getComponentData: jest.fn((componentId) => components[componentId] || null),
});

export const createEntityWithAllDescriptors = () =>
  createMockEntity({
    'descriptors:build': { build: 'athletic' },
    'descriptors:body_composition': { composition: 'lean' },
    'descriptors:body_hair': { density: 'moderate' },
  });

export const createEntityWithPartialDescriptors = () =>
  createMockEntity({
    'descriptors:build': { build: 'average' },
    'descriptors:body_hair': { density: 'light' },
    // Missing body_composition
  });

export const createInvalidEntity = () => ({
  // Missing getComponentData method
  someOtherMethod: jest.fn(),
});

export const createEntityWithMalformedComponents = () =>
  createMockEntity({
    'descriptors:body_composition': { wrongProperty: 'lean' }, // Wrong property name
    'descriptors:body_hair': { hair: 'moderate' }, // Wrong property name
  });
```

### Step 3: Create Comprehensive Unit Tests

Create the main test file:

```javascript
// tests/unit/anatomy/bodyDescriptionComposer.bodyLevel.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import {
  VALID_BODY_COMPOSITIONS,
  VALID_BODY_HAIR_DENSITIES,
  createMockEntity,
  createEntityWithAllDescriptors,
  createEntityWithPartialDescriptors,
  createInvalidEntity,
  createEntityWithMalformedComponents,
} from './fixtures/bodyLevelDescriptors.js';

describe('BodyDescriptionComposer - Body-Level Descriptors', () => {
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
      formatDescriptors: jest.fn((descriptors) =>
        descriptors.map((d) => d.value).join(' ')
      ),
    };

    mockTemplateDescription = {
      generateDescription: jest.fn(() => 'mocked part description'),
    };

    composer = new BodyDescriptionComposer({
      logger: mockLogger,
      descriptorFormatter: mockDescriptorFormatter,
      templateDescription: mockTemplateDescription,
      equipmentDescriptionService: null,
    });
  });

  describe('extractBodyCompositionDescription', () => {
    describe('Valid Cases', () => {
      it.each(VALID_BODY_COMPOSITIONS)(
        'should extract "%s" composition value',
        (composition) => {
          const entity = createMockEntity({
            'descriptors:body_composition': { composition },
          });

          const result = composer.extractBodyCompositionDescription(entity);

          expect(result).toBe(composition);
          expect(entity.getComponentData).toHaveBeenCalledWith(
            'descriptors:body_composition'
          );
          expect(entity.getComponentData).toHaveBeenCalledTimes(1);
        }
      );

      it('should handle entity with multiple descriptors', () => {
        const entity = createEntityWithAllDescriptors();

        const result = composer.extractBodyCompositionDescription(entity);

        expect(result).toBe('lean');
      });
    });

    describe('Invalid Cases', () => {
      it.each([
        [null, 'null entity'],
        [undefined, 'undefined entity'],
        [{}, 'empty object'],
        [createInvalidEntity(), 'entity without getComponentData'],
        ['not an object', 'string instead of object'],
        [123, 'number instead of object'],
        [[], 'array instead of object'],
      ])('should return empty string for %s', (entity, description) => {
        const result = composer.extractBodyCompositionDescription(entity);

        expect(result).toBe('');
        if (description.includes('null') || description.includes('undefined')) {
          expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('null/undefined')
          );
        }
      });

      it('should handle missing component', () => {
        const entity = createMockEntity({}); // No components

        const result = composer.extractBodyCompositionDescription(entity);

        expect(result).toBe('');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('no body_composition component found')
        );
      });

      it('should handle malformed component data', () => {
        const entity = createEntityWithMalformedComponents();

        const result = composer.extractBodyCompositionDescription(entity);

        expect(result).toBe('');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('lacks composition property'),
          expect.any(Object)
        );
      });
    });

    describe('Edge Cases', () => {
      it('should handle component with null composition', () => {
        const entity = createMockEntity({
          'descriptors:body_composition': { composition: null },
        });

        const result = composer.extractBodyCompositionDescription(entity);

        expect(result).toBe('');
      });

      it('should handle component with empty string composition', () => {
        const entity = createMockEntity({
          'descriptors:body_composition': { composition: '' },
        });

        const result = composer.extractBodyCompositionDescription(entity);

        expect(result).toBe('');
      });

      it('should handle getComponentData throwing error', () => {
        const entity = {
          getComponentData: jest.fn(() => {
            throw new Error('Component system failure');
          }),
        };

        expect(() => {
          composer.extractBodyCompositionDescription(entity);
        }).toThrow('Component system failure');
      });

      it('should handle circular reference in entity', () => {
        const entity = { self: null };
        entity.self = entity; // Circular reference
        entity.getComponentData = jest.fn(() => null);

        const result = composer.extractBodyCompositionDescription(entity);

        expect(result).toBe('');
      });
    });
  });

  describe('extractBodyHairDescription', () => {
    describe('Valid Cases', () => {
      it.each(VALID_BODY_HAIR_DENSITIES)(
        'should extract "%s" density value',
        (density) => {
          const entity = createMockEntity({
            'descriptors:body_hair': { density },
          });

          const result = composer.extractBodyHairDescription(entity);

          expect(result).toBe(density);
          expect(entity.getComponentData).toHaveBeenCalledWith(
            'descriptors:body_hair'
          );
          expect(entity.getComponentData).toHaveBeenCalledTimes(1);
        }
      );

      it('should specifically handle hyphenated "very-hairy" value', () => {
        const entity = createMockEntity({
          'descriptors:body_hair': { density: 'very-hairy' },
        });

        const result = composer.extractBodyHairDescription(entity);

        expect(result).toBe('very-hairy');
        expect(result).toContain('-');
      });
    });

    describe('Invalid Cases', () => {
      it('should handle wrong property names', () => {
        const wrongPropertyNames = ['value', 'hair', 'bodyHair', 'body_hair'];

        wrongPropertyNames.forEach((propName) => {
          const entity = createMockEntity({
            'descriptors:body_hair': { [propName]: 'moderate' },
          });

          const result = composer.extractBodyHairDescription(entity);

          expect(result).toBe('');
          expect(mockLogger.warn).toHaveBeenCalled();
        });
      });

      it('should handle component with additional properties', () => {
        const entity = createMockEntity({
          'descriptors:body_hair': {
            density: 'moderate',
            color: 'brown',
            texture: 'coarse',
          },
        });

        const result = composer.extractBodyHairDescription(entity);

        expect(result).toBe('moderate');
      });
    });
  });

  describe('composeDescription Integration', () => {
    describe('Body-Level Descriptor Ordering', () => {
      it('should respect descriptionOrder configuration', () => {
        const entity = createEntityWithAllDescriptors();
        const config = {
          descriptionOrder: ['build', 'body_composition', 'body_hair'],
        };

        const result = composer.composeDescription(entity, [], config);
        const lines = result.split('\n');

        expect(lines[0]).toBe('Build: athletic');
        expect(lines[1]).toBe('Body composition: lean');
        expect(lines[2]).toBe('Body hair: moderate');
      });

      it('should handle reverse order', () => {
        const entity = createEntityWithAllDescriptors();
        const config = {
          descriptionOrder: ['body_hair', 'body_composition', 'build'],
        };

        const result = composer.composeDescription(entity, [], config);
        const lines = result.split('\n');

        expect(lines[0]).toBe('Body hair: moderate');
        expect(lines[1]).toBe('Body composition: lean');
        expect(lines[2]).toBe('Build: athletic');
      });

      it('should handle custom order with gaps', () => {
        const entity = createEntityWithAllDescriptors();
        const config = {
          descriptionOrder: ['body_composition', 'hair', 'body_hair', 'build'],
          // Note: 'hair' doesn't exist as body-level, will be skipped
        };

        const result = composer.composeDescription(entity, [], config);
        const lines = result.split('\n').filter((line) => line.trim());

        expect(lines).toEqual([
          'Body composition: lean',
          'Body hair: moderate',
          'Build: athletic',
        ]);
      });
    });

    describe('Duplicate Prevention', () => {
      it('should not duplicate descriptors even if listed multiple times', () => {
        const entity = createEntityWithAllDescriptors();
        const config = {
          descriptionOrder: [
            'body_composition',
            'body_composition', // Duplicate
            'body_hair',
            'body_hair', // Duplicate
          ],
        };

        const result = composer.composeDescription(entity, [], config);

        expect((result.match(/Body composition:/g) || []).length).toBe(1);
        expect((result.match(/Body hair:/g) || []).length).toBe(1);
      });
    });

    describe('Empty Value Handling', () => {
      it('should not create empty lines for missing descriptors', () => {
        const entity = createEntityWithPartialDescriptors();
        const config = {
          descriptionOrder: ['build', 'body_composition', 'body_hair'],
        };

        const result = composer.composeDescription(entity, [], config);
        const lines = result.split('\n').filter((line) => line.trim());

        expect(lines).toEqual(['Build: average', 'Body hair: light']);
        expect(lines).not.toContain('Body composition:');
      });

      it('should handle entity with no descriptors', () => {
        const entity = createMockEntity({});
        const config = {
          descriptionOrder: ['build', 'body_composition', 'body_hair'],
        };

        const result = composer.composeDescription(entity, [], config);

        expect(result).toBe('');
      });
    });

    describe('Label Formatting', () => {
      it('should use correct capitalization for labels', () => {
        const entity = createEntityWithAllDescriptors();
        const config = {
          descriptionOrder: ['body_composition', 'body_hair'],
        };

        const result = composer.composeDescription(entity, [], config);

        expect(result).toContain('Body composition:'); // Not 'Body Composition:'
        expect(result).toContain('Body hair:'); // Not 'Body Hair:'
      });
    });
  });

  describe('Error Handling and Logging', () => {
    it('should handle missing logger gracefully', () => {
      const composerNoLogger = new BodyDescriptionComposer({
        logger: null,
        descriptorFormatter: mockDescriptorFormatter,
        templateDescription: mockTemplateDescription,
        equipmentDescriptionService: null,
      });

      const entity = createInvalidEntity();

      // Should not throw even without logger
      expect(() => {
        composerNoLogger.extractBodyCompositionDescription(entity);
        composerNoLogger.extractBodyHairDescription(entity);
      }).not.toThrow();
    });

    it('should log appropriate debug messages', () => {
      const entity = null;

      composer.extractBodyCompositionDescription(entity);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'extractBodyCompositionDescription: bodyEntity is null/undefined'
      );

      composer.extractBodyHairDescription(entity);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'extractBodyHairDescription: bodyEntity is null/undefined'
      );
    });
  });
});
```

### Step 4: Create Performance Tests

Create performance-specific tests:

```javascript
// tests/unit/anatomy/bodyDescriptionComposer.performance.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import { createEntityWithAllDescriptors } from './fixtures/bodyLevelDescriptors.js';

describe('BodyDescriptionComposer - Performance Tests', () => {
  let composer;

  beforeEach(() => {
    composer = new BodyDescriptionComposer({
      logger: null,
      descriptorFormatter: null,
      templateDescription: null,
      equipmentDescriptionService: null,
    });
  });

  describe('Extraction Method Performance', () => {
    it('should execute extraction methods quickly', () => {
      const entity = createEntityWithAllDescriptors();
      const iterations = 10000;

      // Test body composition extraction
      const compositionStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        composer.extractBodyCompositionDescription(entity);
      }
      const compositionTime = performance.now() - compositionStart;

      // Test body hair extraction
      const hairStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        composer.extractBodyHairDescription(entity);
      }
      const hairTime = performance.now() - hairStart;

      // Should complete 10k iterations in under 100ms
      expect(compositionTime).toBeLessThan(100);
      expect(hairTime).toBeLessThan(100);

      // Average time per call should be under 0.01ms
      expect(compositionTime / iterations).toBeLessThan(0.01);
      expect(hairTime / iterations).toBeLessThan(0.01);
    });

    it('should handle null entities efficiently', () => {
      const iterations = 100000;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        composer.extractBodyCompositionDescription(null);
        composer.extractBodyHairDescription(null);
      }
      const totalTime = performance.now() - start;

      // Null checks should be extremely fast
      expect(totalTime).toBeLessThan(50);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory with repeated calls', () => {
      const entity = createEntityWithAllDescriptors();
      const initialMemory = process.memoryUsage().heapUsed;

      // Call methods many times
      for (let i = 0; i < 100000; i++) {
        composer.extractBodyCompositionDescription(entity);
        composer.extractBodyHairDescription(entity);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be minimal (less than 10MB)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('composeDescription Performance', () => {
    it('should compose descriptions efficiently with body-level descriptors', () => {
      const entity = createEntityWithAllDescriptors();
      const config = {
        descriptionOrder: ['build', 'body_composition', 'body_hair'],
      };
      const iterations = 1000;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        composer.composeDescription(entity, [], config);
      }
      const totalTime = performance.now() - start;

      // Should complete 1k iterations in under 100ms
      expect(totalTime).toBeLessThan(100);

      // Average time per composition should be under 0.1ms
      expect(totalTime / iterations).toBeLessThan(0.1);
    });
  });
});
```

### Step 5: Create Test Runner Script

Create a script to run all body-level descriptor tests:

```javascript
// scripts/test-body-level-descriptors.js

#!/usr/bin/env node

/**
 * Run all body-level descriptor tests
 */

import { execSync } from 'child_process';

console.log('🧪 Running Body-Level Descriptor Tests...\n');

const testFiles = [
  'tests/unit/anatomy/bodyDescriptionComposer.bodyLevel.test.js',
  'tests/unit/anatomy/bodyDescriptionComposer.performance.test.js',
  'tests/unit/anatomy/bodyDescriptionComposer.bodyComposition.test.js', // From NEWDESC-02
  'tests/unit/anatomy/bodyDescriptionComposer.bodyHair.test.js'         // From NEWDESC-03
];

let allPassed = true;

for (const file of testFiles) {
  console.log(`\n📁 Running ${file}...`);
  try {
    execSync(`npm test ${file}`, { stdio: 'inherit' });
    console.log(`✅ ${file} passed`);
  } catch (error) {
    console.error(`❌ ${file} failed`);
    allPassed = false;
  }
}

// Run coverage report
console.log('\n📊 Generating coverage report...');
try {
  execSync(
    'npm test -- --coverage --collectCoverageFrom=src/anatomy/bodyDescriptionComposer.js ' +
    testFiles.join(' '),
    { stdio: 'inherit' }
  );
} catch (error) {
  console.error('Coverage report generation failed');
  allPassed = false;
}

if (allPassed) {
  console.log('\n✨ All body-level descriptor tests passed!');
  process.exit(0);
} else {
  console.error('\n❌ Some tests failed');
  process.exit(1);
}
```

### Step 6: Create Test Documentation

Create documentation for the test suite:

````markdown
# Body-Level Descriptor Test Suite

## Overview

Comprehensive test suite for body-level descriptor functionality in the anatomy system.

## Test Structure

### Unit Tests

1. **bodyDescriptionComposer.bodyLevel.test.js**
   - Main test suite for all body-level descriptor functionality
   - Tests extraction methods and integration
   - Edge case and error handling coverage

2. **bodyDescriptionComposer.performance.test.js**
   - Performance benchmarks for extraction methods
   - Memory usage tests
   - Efficiency validation

3. **Individual Method Tests**
   - bodyDescriptionComposer.bodyComposition.test.js (NEWDESC-02)
   - bodyDescriptionComposer.bodyHair.test.js (NEWDESC-03)

### Test Fixtures

- **fixtures/bodyLevelDescriptors.js**
  - Reusable test data and mock entities
  - Valid descriptor value lists
  - Mock entity creation helpers

## Running Tests

```bash
# Run all body-level descriptor tests
node scripts/test-body-level-descriptors.js

# Run individual test files
npm test tests/unit/anatomy/bodyDescriptionComposer.bodyLevel.test.js

# Run with coverage
npm test -- --coverage tests/unit/anatomy/
```
````

## Coverage Goals

- Extraction methods: >95% coverage
- Integration code: >90% coverage
- Overall file: >85% coverage

## Key Test Scenarios

1. **Valid Descriptor Extraction**
   - All enum values for each descriptor
   - Entities with multiple descriptors
   - Partial descriptor presence

2. **Error Handling**
   - Null/undefined entities
   - Missing getComponentData method
   - Malformed component data
   - Wrong property names

3. **Integration Testing**
   - Descriptor ordering
   - Duplicate prevention
   - Empty value handling
   - Label formatting

4. **Performance**
   - Execution speed benchmarks
   - Memory usage validation
   - Scalability testing

````

## Validation Steps

### 1. Run All Tests

```bash
# Execute the test runner
chmod +x scripts/test-body-level-descriptors.js
./scripts/test-body-level-descriptors.js
````

### 2. Verify Coverage

```bash
# Check coverage meets requirements
npm test -- --coverage --collectCoverageFrom=src/anatomy/bodyDescriptionComposer.js
```

Coverage should show:

- Lines: >85%
- Functions: >90%
- Branches: >85%

### 3. Validate Test Quality

Review tests for:

- Descriptive test names
- Comprehensive edge case coverage
- Proper mocking and isolation
- Performance benchmarks

### 4. Check Test Consistency

```bash
# Run tests multiple times to ensure consistency
for i in {1..5}; do
  npm test tests/unit/anatomy/bodyDescriptionComposer.bodyLevel.test.js
done
```

## Common Issues and Solutions

### Issue 1: Flaky Tests

**Problem:** Tests pass inconsistently.
**Solution:** Ensure proper test isolation and mock reset in beforeEach.

### Issue 2: Coverage Gaps

**Problem:** Coverage doesn't meet requirements.
**Solution:** Add tests for uncovered branches, especially error paths.

### Issue 3: Performance Tests Fail

**Problem:** Performance benchmarks fail on slower machines.
**Solution:** Adjust thresholds or make them environment-aware.

### Issue 4: Mock Complexity

**Problem:** Mock objects become too complex.
**Solution:** Use test fixtures and helper functions for consistency.

## Completion Checklist

- [ ] Main test suite created (bodyLevel.test.js)
- [ ] Performance tests created
- [ ] Test fixtures created
- [ ] All extraction methods tested
- [ ] Integration with composeDescription tested
- [ ] Edge cases covered
- [ ] Error handling tested
- [ ] Performance benchmarks established
- [ ] Test runner script created
- [ ] Documentation written
- [ ] Coverage requirements met (>85%)
- [ ] All tests passing consistently

## Next Steps

After completing unit tests:

- NEWDESC-06: Create integration tests with real entities
- NEWDESC-07: Add projection descriptor support
- Run full test suite before deployment

## Notes for Implementer

- Use test.each() for parameterized tests with enum values
- Mock only what's necessary - prefer real objects when possible
- Test both positive and negative cases
- Include performance tests to catch regressions
- Document any non-obvious test scenarios
- Keep tests focused and isolated
- Use descriptive test names that explain the scenario
- Ensure tests are deterministic and repeatable
