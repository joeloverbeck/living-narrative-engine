# NEWDESC-06: Create Integration Tests for Complete Anatomy Descriptions

## Overview

Create comprehensive integration tests that validate the entire anatomy description system with the new body-level descriptors (body_composition, body_hair) and ensure proper integration with existing descriptors, body parts, and the complete description generation pipeline.

## Priority

**Medium** - Critical for validating the complete system works together properly.

## Dependencies

- NEWDESC-01 through NEWDESC-05 (all completed)
- Understanding of existing anatomy system integration

## Estimated Effort

**5 hours** - Full integration test suite with various scenarios

## Acceptance Criteria

1. ✅ Integration tests cover complete entity descriptions with all descriptors
2. ✅ Tests validate correct ordering of descriptors in output
3. ✅ Tests verify body-level and part-level descriptor interactions
4. ✅ Tests include facial_hair part-level descriptor scenarios
5. ✅ Tests validate graceful handling of missing descriptors
6. ✅ Real entity loader integration tests
7. ✅ Configuration loading and validation tests
8. ✅ Performance benchmarks for full descriptions
9. ✅ Edge case scenarios with complex entities
10. ✅ All tests pass consistently

## Implementation Steps

### Step 1: Create Integration Test Structure

```bash
# Create integration test directory structure
tests/integration/anatomy/
├── bodyLevelDescriptors/
│   ├── completeDescriptions.test.js
│   ├── partialDescriptions.test.js
│   ├── edgeCases.test.js
│   └── performance.test.js
├── fixtures/
│   ├── testEntities.js
│   ├── testConfigurations.js
│   └── expectedOutputs.js
└── helpers/
    └── anatomyTestHelpers.js
```

### Step 2: Create Test Entity Fixtures

```javascript
// tests/integration/anatomy/fixtures/testEntities.js

import { TestEntity } from '../../../common/testEntity.js';

/**
 * Create a fully-featured humanoid entity with all descriptors
 */
export const createCompleteHumanoidEntity = () => {
  const entity = new TestEntity('test-humanoid-complete');

  // Body-level components
  entity.addComponent('anatomy:body', {
    type: 'humanoid',
    parts: ['head', 'hair', 'eyes', 'arms', 'chest', 'legs'],
  });
  entity.addComponent('descriptors:build', { build: 'athletic' });
  entity.addComponent('descriptors:body_composition', { composition: 'lean' });
  entity.addComponent('descriptors:body_hair', { density: 'moderate' });

  return entity;
};

/**
 * Create humanoid with partial descriptors
 */
export const createPartialHumanoidEntity = () => {
  const entity = new TestEntity('test-humanoid-partial');

  entity.addComponent('anatomy:body', { type: 'humanoid' });
  entity.addComponent('descriptors:build', { build: 'average' });
  // Missing body_composition
  entity.addComponent('descriptors:body_hair', { density: 'light' });

  return entity;
};

/**
 * Create entity with no body-level descriptors
 */
export const createMinimalHumanoidEntity = () => {
  const entity = new TestEntity('test-humanoid-minimal');
  entity.addComponent('anatomy:body', { type: 'humanoid' });
  return entity;
};

/**
 * Create body parts for testing
 */
export const createHumanoidParts = () => {
  const parts = [];

  // Head with facial hair
  const head = new TestEntity('head-part');
  head.addComponent('anatomy:part', {
    type: 'face',
    subType: 'head',
    parentEntityId: 'test-humanoid',
  });
  head.addComponent('descriptors:shape_general', { shape: 'angular' });
  head.addComponent('descriptors:facial_hair', { style: 'bearded' });
  parts.push(head);

  // Hair
  const hair = new TestEntity('hair-part');
  hair.addComponent('anatomy:part', {
    type: 'hair',
    subType: 'hair',
    parentEntityId: 'test-humanoid',
  });
  hair.addComponent('descriptors:length_hair', { length: 'long' });
  hair.addComponent('descriptors:color_basic', { color: 'blonde' });
  hair.addComponent('descriptors:texture', { texture: 'wavy' });
  hair.addComponent('descriptors:hair_style', { style: 'flowing' });
  parts.push(hair);

  // Eyes
  const eyes = new TestEntity('eyes-part');
  eyes.addComponent('anatomy:part', {
    type: 'eye',
    subType: 'eyes',
    parentEntityId: 'test-humanoid',
    count: 2,
  });
  eyes.addComponent('descriptors:color_extended', { color: 'bright blue' });
  eyes.addComponent('descriptors:shape_eye', { shape: 'almond-shaped' });
  parts.push(eyes);

  // Arms
  const arms = new TestEntity('arms-part');
  arms.addComponent('anatomy:part', {
    type: 'arm',
    subType: 'arms',
    parentEntityId: 'test-humanoid',
    count: 2,
  });
  arms.addComponent('descriptors:size_specific', { size: 'muscular' });
  parts.push(arms);

  // Chest
  const chest = new TestEntity('chest-part');
  chest.addComponent('anatomy:part', {
    type: 'chest',
    subType: 'chest',
    parentEntityId: 'test-humanoid',
  });
  chest.addComponent('descriptors:size_category', { size: 'broad' });
  chest.addComponent('descriptors:body_hair', { density: 'hairy' }); // Part-specific body hair
  parts.push(chest);

  return parts;
};

/**
 * Create entity with edge case descriptors
 */
export const createEdgeCaseEntity = () => {
  const entity = new TestEntity('test-edge-case');

  entity.addComponent('anatomy:body', { type: 'humanoid' });
  entity.addComponent('descriptors:build', { build: '' }); // Empty string
  entity.addComponent('descriptors:body_composition', { composition: null }); // Null value
  entity.addComponent('descriptors:body_hair', { density: 'very-hairy' }); // Hyphenated value

  return entity;
};
```

### Step 3: Create Test Configurations

```javascript
// tests/integration/anatomy/fixtures/testConfigurations.js

export const defaultTestConfig = {
  descriptionOrder: [
    'build',
    'body_composition',
    'body_hair',
    'hair',
    'eye',
    'face',
    'ear',
    'neck',
    'arm',
    'hand',
    'chest',
    'breast',
    'belly',
    'waist',
    'hip',
    'vagina',
    'penis',
    'ass',
    'leg',
    'foot',
    'equipment',
  ],
  descriptorOrder: [
    'descriptors:length_category',
    'descriptors:length_hair',
    'descriptors:size_category',
    'descriptors:size_specific',
    'descriptors:weight_feel',
    'descriptors:body_composition',
    'descriptors:body_hair',
    'descriptors:facial_hair',
    'descriptors:color_basic',
    'descriptors:color_extended',
    'descriptors:shape_general',
    'descriptors:shape_eye',
    'descriptors:hair_style',
    'descriptors:texture',
    'descriptors:firmness',
    'descriptors:projection',
    'descriptors:build',
  ],
  descriptorValueKeys: [
    'value',
    'color',
    'size',
    'shape',
    'length',
    'style',
    'texture',
    'firmness',
    'build',
    'weight',
    'composition',
    'density',
    'projection',
  ],
  templates: {
    hair: '{descriptors} {subType}',
    eye: '{descriptors} {subType}',
    face: '{descriptors} {subType}',
    arm: '{descriptors} {subType}',
    chest: '{descriptors} {subType}',
  },
};

export const customOrderConfig = {
  ...defaultTestConfig,
  descriptionOrder: [
    'body_hair', // Different order
    'body_composition',
    'build',
    'face',
    'hair',
    'eye',
    'chest',
    'arm',
  ],
};

export const minimalConfig = {
  descriptionOrder: ['build', 'body_composition', 'body_hair'],
  descriptorOrder: [
    'descriptors:build',
    'descriptors:body_composition',
    'descriptors:body_hair',
  ],
  descriptorValueKeys: ['build', 'composition', 'density'],
  templates: {},
};
```

### Step 4: Create Expected Outputs

```javascript
// tests/integration/anatomy/fixtures/expectedOutputs.js

export const expectedCompleteDescription = `Build: athletic
Body composition: lean
Body hair: moderate
Hair: long blonde wavy flowing hair
Eyes: bright blue almond-shaped eyes
Face: angular bearded head
Arms: muscular arms
Chest: broad hairy chest`;

export const expectedPartialDescription = `Build: average
Body hair: light`;

export const expectedCustomOrderDescription = `Body hair: moderate
Body composition: lean
Build: athletic
Face: angular bearded head
Hair: long blonde wavy flowing hair
Eyes: bright blue almond-shaped eyes
Chest: broad hairy chest
Arms: muscular arms`;

export const expectedMinimalDescription = '';

export const expectedEdgeCaseDescription = `Body hair: very-hairy`;
```

### Step 5: Create Test Helpers

```javascript
// tests/integration/anatomy/helpers/anatomyTestHelpers.js

import { BodyDescriptionComposer } from '../../../../src/anatomy/bodyDescriptionComposer.js';
import { DescriptorFormatter } from '../../../../src/anatomy/descriptorFormatter.js';
import { DescriptionTemplate } from '../../../../src/anatomy/descriptionTemplate.js';

/**
 * Create a fully configured BodyDescriptionComposer
 */
export const createFullComposer = (options = {}) => {
  const logger = options.logger || console;

  const descriptorFormatter = new DescriptorFormatter({
    logger,
    ajv: options.ajv || null,
  });

  const descriptionTemplate = new DescriptionTemplate({
    logger,
    descriptorFormatter,
  });

  return new BodyDescriptionComposer({
    logger,
    descriptorFormatter,
    templateDescription: descriptionTemplate,
    equipmentDescriptionService: options.equipmentService || null,
  });
};

/**
 * Compare descriptions ignoring whitespace differences
 */
export const normalizeDescription = (description) => {
  return description
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
};

/**
 * Extract descriptor values from description
 */
export const extractDescriptorValues = (description) => {
  const values = {};
  const lines = description.split('\n');

  lines.forEach((line) => {
    const match = line.match(/^(.+?):\s+(.+)$/);
    if (match) {
      values[match[1]] = match[2];
    }
  });

  return values;
};

/**
 * Validate descriptor ordering
 */
export const validateDescriptorOrder = (description, expectedOrder) => {
  const lines = description.split('\n').filter((line) => line.trim());
  const actualOrder = lines
    .map((line) => {
      const match = line.match(/^(.+?):/);
      return match ? match[1] : null;
    })
    .filter(Boolean);

  return {
    matches: JSON.stringify(actualOrder) === JSON.stringify(expectedOrder),
    actual: actualOrder,
    expected: expectedOrder,
  };
};
```

### Step 6: Create Main Integration Tests

```javascript
// tests/integration/anatomy/bodyLevelDescriptors/completeDescriptions.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  createCompleteHumanoidEntity,
  createHumanoidParts,
} from '../fixtures/testEntities.js';
import {
  defaultTestConfig,
  customOrderConfig,
} from '../fixtures/testConfigurations.js';
import {
  expectedCompleteDescription,
  expectedCustomOrderDescription,
} from '../fixtures/expectedOutputs.js';
import {
  createFullComposer,
  normalizeDescription,
  extractDescriptorValues,
  validateDescriptorOrder,
} from '../helpers/anatomyTestHelpers.js';

describe('Complete Anatomy Descriptions Integration', () => {
  let composer;

  beforeEach(() => {
    composer = createFullComposer();
  });

  describe('Full Entity Descriptions', () => {
    it('should generate complete description with all descriptors', () => {
      const entity = createCompleteHumanoidEntity();
      const parts = createHumanoidParts();

      const result = composer.composeDescription(
        entity,
        parts,
        defaultTestConfig
      );
      const normalized = normalizeDescription(result);
      const expected = normalizeDescription(expectedCompleteDescription);

      expect(normalized).toBe(expected);
    });

    it('should include facial hair in face description', () => {
      const entity = createCompleteHumanoidEntity();
      const parts = createHumanoidParts();

      const result = composer.composeDescription(
        entity,
        parts,
        defaultTestConfig
      );

      expect(result).toContain('angular bearded head');
      expect(result).toMatch(/Face:\s+angular bearded head/);
    });

    it('should handle part-specific body hair separately from entity body hair', () => {
      const entity = createCompleteHumanoidEntity();
      const parts = createHumanoidParts();

      const result = composer.composeDescription(
        entity,
        parts,
        defaultTestConfig
      );

      // Entity-level body hair
      expect(result).toContain('Body hair: moderate');

      // Part-level body hair on chest
      expect(result).toContain('broad hairy chest');
    });

    it('should respect custom description order', () => {
      const entity = createCompleteHumanoidEntity();
      const parts = createHumanoidParts();

      const result = composer.composeDescription(
        entity,
        parts,
        customOrderConfig
      );
      const normalized = normalizeDescription(result);
      const expected = normalizeDescription(expectedCustomOrderDescription);

      expect(normalized).toBe(expected);

      // Verify order
      const orderValidation = validateDescriptorOrder(result, [
        'Body hair',
        'Body composition',
        'Build',
        'Face',
        'Hair',
        'Eyes',
        'Chest',
        'Arms',
      ]);

      expect(orderValidation.matches).toBe(true);
    });
  });

  describe('Descriptor Value Extraction', () => {
    it('should extract all descriptor values correctly', () => {
      const entity = createCompleteHumanoidEntity();
      const parts = createHumanoidParts();

      const result = composer.composeDescription(
        entity,
        parts,
        defaultTestConfig
      );
      const values = extractDescriptorValues(result);

      expect(values).toEqual({
        Build: 'athletic',
        'Body composition': 'lean',
        'Body hair': 'moderate',
        Hair: 'long blonde wavy flowing hair',
        Eyes: 'bright blue almond-shaped eyes',
        Face: 'angular bearded head',
        Arms: 'muscular arms',
        Chest: 'broad hairy chest',
      });
    });
  });

  describe('Complex Entity Scenarios', () => {
    it('should handle entities with many parts', () => {
      const entity = createCompleteHumanoidEntity();
      const parts = [];

      // Create many parts
      for (let i = 0; i < 20; i++) {
        const part = new TestEntity(`part-${i}`);
        part.addComponent('anatomy:part', {
          type: 'generic',
          subType: `part${i}`,
          parentEntityId: entity.id,
        });
        parts.push(part);
      }

      // Should not throw or have performance issues
      const start = performance.now();
      const result = composer.composeDescription(
        entity,
        parts,
        defaultTestConfig
      );
      const duration = performance.now() - start;

      expect(result).toBeTruthy();
      expect(duration).toBeLessThan(100); // Should complete quickly
    });

    it('should handle circular references gracefully', () => {
      const entity = createCompleteHumanoidEntity();
      entity.circularRef = entity; // Create circular reference

      const parts = createHumanoidParts();

      // Should not cause infinite loop
      expect(() => {
        composer.composeDescription(entity, parts, defaultTestConfig);
      }).not.toThrow();
    });
  });
});
```

### Step 7: Create Partial Description Tests

```javascript
// tests/integration/anatomy/bodyLevelDescriptors/partialDescriptions.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  createPartialHumanoidEntity,
  createMinimalHumanoidEntity,
  createHumanoidParts,
} from '../fixtures/testEntities.js';
import { defaultTestConfig } from '../fixtures/testConfigurations.js';
import {
  expectedPartialDescription,
  expectedMinimalDescription,
} from '../fixtures/expectedOutputs.js';
import {
  createFullComposer,
  normalizeDescription,
} from '../helpers/anatomyTestHelpers.js';

describe('Partial Anatomy Descriptions Integration', () => {
  let composer;

  beforeEach(() => {
    composer = createFullComposer();
  });

  describe('Partial Descriptors', () => {
    it('should handle missing body composition gracefully', () => {
      const entity = createPartialHumanoidEntity();
      const parts = [];

      const result = composer.composeDescription(
        entity,
        parts,
        defaultTestConfig
      );
      const normalized = normalizeDescription(result);
      const expected = normalizeDescription(expectedPartialDescription);

      expect(normalized).toBe(expected);
      expect(result).not.toContain('Body composition:');
    });

    it('should handle entity with no descriptors', () => {
      const entity = createMinimalHumanoidEntity();
      const parts = [];

      const result = composer.composeDescription(
        entity,
        parts,
        defaultTestConfig
      );

      expect(result).toBe(expectedMinimalDescription);
    });

    it('should handle mixed present and missing descriptors', () => {
      const entity = createPartialHumanoidEntity();
      const parts = createHumanoidParts().slice(0, 2); // Only first 2 parts

      const result = composer.composeDescription(
        entity,
        parts,
        defaultTestConfig
      );

      // Should have some descriptors
      expect(result).toContain('Build: average');
      expect(result).toContain('Body hair: light');

      // Should not have missing descriptor
      expect(result).not.toContain('Body composition:');

      // Should have part descriptions
      expect(result).toContain('Face:');
      expect(result).toContain('Hair:');
    });
  });

  describe('Progressive Enhancement', () => {
    it('should gracefully add descriptors as they become available', () => {
      const entity = createMinimalHumanoidEntity();

      // Start with no descriptors
      let result = composer.composeDescription(entity, [], defaultTestConfig);
      expect(result).toBe('');

      // Add build
      entity.addComponent('descriptors:build', { build: 'athletic' });
      result = composer.composeDescription(entity, [], defaultTestConfig);
      expect(result).toBe('Build: athletic');

      // Add body composition
      entity.addComponent('descriptors:body_composition', {
        composition: 'lean',
      });
      result = composer.composeDescription(entity, [], defaultTestConfig);
      expect(result).toContain('Build: athletic');
      expect(result).toContain('Body composition: lean');

      // Add body hair
      entity.addComponent('descriptors:body_hair', { density: 'light' });
      result = composer.composeDescription(entity, [], defaultTestConfig);
      expect(result).toContain('Build: athletic');
      expect(result).toContain('Body composition: lean');
      expect(result).toContain('Body hair: light');
    });
  });
});
```

### Step 8: Create Edge Case Tests

```javascript
// tests/integration/anatomy/bodyLevelDescriptors/edgeCases.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createEdgeCaseEntity } from '../fixtures/testEntities.js';
import {
  defaultTestConfig,
  minimalConfig,
} from '../fixtures/testConfigurations.js';
import { expectedEdgeCaseDescription } from '../fixtures/expectedOutputs.js';
import {
  createFullComposer,
  normalizeDescription,
} from '../helpers/anatomyTestHelpers.js';

describe('Edge Cases Integration', () => {
  let composer;

  beforeEach(() => {
    composer = createFullComposer();
  });

  describe('Invalid Descriptor Values', () => {
    it('should handle empty string, null, and hyphenated values', () => {
      const entity = createEdgeCaseEntity();
      const parts = [];

      const result = composer.composeDescription(
        entity,
        parts,
        defaultTestConfig
      );
      const normalized = normalizeDescription(result);
      const expected = normalizeDescription(expectedEdgeCaseDescription);

      expect(normalized).toBe(expected);

      // Empty string and null should not appear
      expect(result).not.toContain('Build:');
      expect(result).not.toContain('Body composition:');

      // Hyphenated value should work
      expect(result).toContain('Body hair: very-hairy');
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle minimal configuration', () => {
      const entity = createEdgeCaseEntity();

      const result = composer.composeDescription(entity, [], minimalConfig);

      // Only valid descriptor should appear
      expect(result).toBe('Body hair: very-hairy');
    });

    it('should handle duplicate entries in descriptionOrder', () => {
      const entity = createEdgeCaseEntity();
      const duplicateConfig = {
        ...defaultTestConfig,
        descriptionOrder: [
          'body_hair',
          'body_hair', // Duplicate
          'body_hair', // Another duplicate
        ],
      };

      const result = composer.composeDescription(entity, [], duplicateConfig);

      // Should only appear once
      const matches = (result.match(/Body hair:/g) || []).length;
      expect(matches).toBe(1);
    });

    it('should handle unknown descriptor types in configuration', () => {
      const entity = createEdgeCaseEntity();
      const unknownConfig = {
        ...defaultTestConfig,
        descriptionOrder: [
          'unknown_descriptor',
          'body_hair',
          'another_unknown',
        ],
      };

      const result = composer.composeDescription(entity, [], unknownConfig);

      // Should skip unknown and process valid
      expect(result).toBe('Body hair: very-hairy');
    });
  });

  describe('Component Edge Cases', () => {
    it('should handle malformed component data', () => {
      const entity = {
        getComponentData: (id) => {
          if (id === 'descriptors:body_composition') {
            return { wrongProperty: 'lean' }; // Wrong property name
          }
          if (id === 'descriptors:body_hair') {
            return { density: 'moderate' }; // Correct
          }
          return null;
        },
      };

      const result = composer.composeDescription(entity, [], defaultTestConfig);

      // Should only show valid descriptor
      expect(result).toBe('Body hair: moderate');
    });

    it('should handle getComponentData returning unexpected types', () => {
      const entity = {
        getComponentData: (id) => {
          if (id === 'descriptors:body_hair') {
            return 'not an object'; // Wrong return type
          }
          return null;
        },
      };

      const result = composer.composeDescription(entity, [], defaultTestConfig);

      // Should handle gracefully
      expect(result).toBe('');
    });
  });
});
```

### Step 9: Create Performance Tests

```javascript
// tests/integration/anatomy/bodyLevelDescriptors/performance.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  createCompleteHumanoidEntity,
  createHumanoidParts,
} from '../fixtures/testEntities.js';
import { defaultTestConfig } from '../fixtures/testConfigurations.js';
import { createFullComposer } from '../helpers/anatomyTestHelpers.js';

describe('Performance Integration Tests', () => {
  let composer;

  beforeEach(() => {
    composer = createFullComposer({ logger: null }); // No logging for performance
  });

  describe('Description Generation Performance', () => {
    it('should generate descriptions quickly for typical entities', () => {
      const entity = createCompleteHumanoidEntity();
      const parts = createHumanoidParts();
      const iterations = 1000;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        composer.composeDescription(entity, parts, defaultTestConfig);
      }
      const duration = performance.now() - start;

      console.log(
        `Generated ${iterations} descriptions in ${duration.toFixed(2)}ms`
      );
      console.log(
        `Average: ${(duration / iterations).toFixed(3)}ms per description`
      );

      // Should complete 1000 iterations in under 500ms
      expect(duration).toBeLessThan(500);

      // Average should be under 0.5ms per description
      expect(duration / iterations).toBeLessThan(0.5);
    });

    it('should handle large entity collections efficiently', () => {
      const entities = [];
      const partSets = [];

      // Create 100 entities with parts
      for (let i = 0; i < 100; i++) {
        entities.push(createCompleteHumanoidEntity());
        partSets.push(createHumanoidParts());
      }

      const start = performance.now();
      entities.forEach((entity, index) => {
        composer.composeDescription(entity, partSets[index], defaultTestConfig);
      });
      const duration = performance.now() - start;

      console.log(
        `Generated 100 entity descriptions in ${duration.toFixed(2)}ms`
      );

      // Should complete in under 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should not degrade with repeated calls', () => {
      const entity = createCompleteHumanoidEntity();
      const parts = createHumanoidParts();
      const timings = [];

      // Measure performance over time
      for (let batch = 0; batch < 10; batch++) {
        const start = performance.now();
        for (let i = 0; i < 100; i++) {
          composer.composeDescription(entity, parts, defaultTestConfig);
        }
        timings.push(performance.now() - start);
      }

      // Calculate average of first and last batches
      const firstBatchAvg = timings.slice(0, 3).reduce((a, b) => a + b) / 3;
      const lastBatchAvg = timings.slice(-3).reduce((a, b) => a + b) / 3;

      console.log(`First batch average: ${firstBatchAvg.toFixed(2)}ms`);
      console.log(`Last batch average: ${lastBatchAvg.toFixed(2)}ms`);

      // Performance should not degrade by more than 20%
      expect(lastBatchAvg).toBeLessThan(firstBatchAvg * 1.2);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory with body-level descriptors', () => {
      const entity = createCompleteHumanoidEntity();
      const parts = createHumanoidParts();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Generate many descriptions
      for (let i = 0; i < 10000; i++) {
        const result = composer.composeDescription(
          entity,
          parts,
          defaultTestConfig
        );
        // Result goes out of scope
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      console.log(
        `Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`
      );

      // Memory growth should be minimal (less than 50MB)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });
  });
});
```

### Step 10: Create Integration Test Runner

```javascript
// scripts/test-anatomy-integration.js

#!/usr/bin/env node

/**
 * Run all anatomy integration tests
 */

import { execSync } from 'child_process';
import path from 'path';

console.log('🧪 Running Anatomy Integration Tests...\n');

const testDirs = [
  'tests/integration/anatomy/bodyLevelDescriptors/'
];

const testFiles = [
  'completeDescriptions.test.js',
  'partialDescriptions.test.js',
  'edgeCases.test.js',
  'performance.test.js'
];

let allPassed = true;

// Run each test file
for (const dir of testDirs) {
  for (const file of testFiles) {
    const fullPath = path.join(dir, file);
    console.log(`\n📁 Running ${fullPath}...`);

    try {
      execSync(`npm test ${fullPath}`, { stdio: 'inherit' });
      console.log(`✅ ${file} passed`);
    } catch (error) {
      console.error(`❌ ${file} failed`);
      allPassed = false;
    }
  }
}

// Run with coverage
console.log('\n📊 Generating integration coverage report...');
try {
  const testPattern = testDirs.map(dir => `${dir}*.test.js`).join(' ');
  execSync(
    `npm test -- --coverage --collectCoverageFrom=src/anatomy/**/*.js ${testPattern}`,
    { stdio: 'inherit' }
  );
} catch (error) {
  console.error('Coverage report generation failed');
  allPassed = false;
}

// Summary
if (allPassed) {
  console.log('\n✨ All integration tests passed!');
  console.log('\nNext steps:');
  console.log('- Review coverage report');
  console.log('- Test with real game data');
  console.log('- Run performance profiling');
  process.exit(0);
} else {
  console.error('\n❌ Some integration tests failed');
  process.exit(1);
}
```

## Validation Steps

### 1. Run All Integration Tests

```bash
# Make script executable
chmod +x scripts/test-anatomy-integration.js

# Run all integration tests
./scripts/test-anatomy-integration.js

# Or run individually
npm test tests/integration/anatomy/bodyLevelDescriptors/completeDescriptions.test.js
```

### 2. Verify Coverage

Ensure integration tests provide good coverage:

- Line coverage: >80%
- Branch coverage: >75%
- Function coverage: >85%

### 3. Performance Validation

Review performance test output:

- Average description generation: <0.5ms
- Bulk processing: <1ms per entity
- No memory leaks detected

### 4. Manual Testing

Test with actual game:

```bash
npm run dev
# Create entities with new descriptors
# Verify descriptions appear correctly
```

## Common Issues and Solutions

### Issue 1: Test Flakiness

**Problem:** Tests pass inconsistently.
**Solution:**

- Ensure proper test isolation
- Reset all mocks in beforeEach
- Avoid timing-dependent assertions

### Issue 2: Performance Test Failures

**Problem:** Performance tests fail on CI/slow machines.
**Solution:**

- Adjust thresholds based on environment
- Use relative performance metrics
- Skip performance tests in CI if needed

### Issue 3: Integration Complexity

**Problem:** Tests become too complex and hard to maintain.
**Solution:**

- Use test helpers and fixtures
- Keep tests focused on specific scenarios
- Document complex test setups

## Completion Checklist

- [ ] Test structure created
- [ ] Entity fixtures created
- [ ] Configuration fixtures created
- [ ] Expected output fixtures created
- [ ] Test helpers implemented
- [ ] Complete description tests written
- [ ] Partial description tests written
- [ ] Edge case tests written
- [ ] Performance tests written
- [ ] Test runner script created
- [ ] All tests passing
- [ ] Coverage requirements met
- [ ] Performance benchmarks established
- [ ] Manual testing completed

## Next Steps

After completing integration tests:

- NEWDESC-07: Add projection descriptor support
- NEWDESC-08: Create example entities
- Deploy to staging for real-world testing
- Monitor performance in production

## Notes for Implementer

- Use realistic test data that matches actual game entities
- Test both common and edge cases
- Include performance benchmarks to catch regressions
- Verify the complete system works together
- Test with various configurations
- Document any discovered limitations
- Keep tests maintainable and well-organized
- Consider adding visual regression tests for UI
