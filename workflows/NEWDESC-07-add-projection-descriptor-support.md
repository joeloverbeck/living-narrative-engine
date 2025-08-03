# NEWDESC-07: Add Projection Descriptor Support

## Overview

Add support for the `descriptors:projection` component that has been created but is not yet included in the descriptor order. This descriptor describes projection characteristics of surfaces (flat, bubbly, shelf) and should be applied to relevant body parts like breasts and buttocks. This is a part-level descriptor that will be automatically handled by the existing system once added to the configuration.

## Priority

**Low** - Enhancement to add an additional descriptor option for modders.

## Dependencies

- NEWDESC-01: Update Anatomy Formatting Configuration (completed)
- Understanding of part-level descriptor system

## Estimated Effort

**1.5 hours** - Configuration update, testing, and example creation

## Acceptance Criteria

1. ✅ Projection descriptor is added to descriptorOrder in configuration
2. ✅ "projection" key already exists in descriptorValueKeys (verify)
3. ✅ Projection descriptor appears in applicable part descriptions
4. ✅ Schema validation passes for projection component
5. ✅ Test entities demonstrate projection descriptor usage
6. ✅ Descriptor integrates properly with existing descriptors
7. ✅ No regression in existing functionality

## Implementation Steps

### Step 1: Verify Projection Component Schema

First, check the existing schema for the projection descriptor:

```bash
# Check if projection component schema exists
cat data/schemas/components/descriptors/projection.schema.json
```

Expected schema structure:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "id": "descriptors:projection",
  "type": "object",
  "properties": {
    "projection": {
      "type": "string",
      "enum": ["flat", "bubbly", "shelf"],
      "description": "Surface projection characteristic"
    }
  },
  "required": ["projection"]
}
```

### Step 2: Verify Current Configuration

Check the current state of the configuration after NEWDESC-01:

```bash
# Check current descriptorOrder
grep -A 20 "descriptorOrder" data/mods/anatomy/anatomy-formatting/default.json

# Check descriptorValueKeys
grep -A 15 "descriptorValueKeys" data/mods/anatomy/anatomy-formatting/default.json
```

Based on NEWDESC-01, the configuration should already include:

- `descriptors:projection` in descriptorOrder
- `projection` in descriptorValueKeys

### Step 3: Verify Projection Descriptor in Configuration

If not already added in NEWDESC-01, update the configuration:

```javascript
// In data/mods/anatomy/anatomy-formatting/default.json

{
  // ... other configuration ...

  "descriptorOrder": [
    "descriptors:length_category",
    "descriptors:length_hair",
    "descriptors:size_category",
    "descriptors:size_specific",
    "descriptors:weight_feel",
    "descriptors:body_composition",
    "descriptors:body_hair",
    "descriptors:facial_hair",
    "descriptors:color_basic",
    "descriptors:color_extended",
    "descriptors:shape_general",
    "descriptors:shape_eye",
    "descriptors:hair_style",
    "descriptors:texture",
    "descriptors:firmness",
    "descriptors:projection",    // Should already be here from NEWDESC-01
    "descriptors:build"
  ],

  "descriptorValueKeys": [
    "value",
    "color",
    "size",
    "shape",
    "length",
    "style",
    "texture",
    "firmness",
    "build",
    "weight",
    "composition",
    "density",
    "projection"    // Should already be here from NEWDESC-01
  ]
}
```

### Step 4: Create Test Body Parts with Projection

Create example body parts that use the projection descriptor:

```javascript
// scripts/test-projection-descriptor.js

#!/usr/bin/env node

/**
 * Test projection descriptor functionality
 */

import { TestEntity } from '../tests/common/testEntity.js';

// Create test breasts with different projections
const breastVariants = [
  { id: 'breast-flat', projection: 'flat', size: 'small' },
  { id: 'breast-bubbly', projection: 'bubbly', size: 'medium' },
  { id: 'breast-shelf', projection: 'shelf', size: 'large' }
];

console.log('🧪 Testing Projection Descriptor...\n');

breastVariants.forEach(variant => {
  const part = new TestEntity(variant.id);

  part.addComponent('anatomy:part', {
    type: 'breast',
    subType: 'breasts',
    count: 2
  });

  part.addComponent('descriptors:size_category', {
    size: variant.size
  });

  part.addComponent('descriptors:projection', {
    projection: variant.projection
  });

  part.addComponent('descriptors:firmness', {
    firmness: 'firm'
  });

  console.log(`Created ${variant.id}:`);
  console.log(`- Size: ${variant.size}`);
  console.log(`- Projection: ${variant.projection}`);
  console.log(`- Expected output: "${variant.size} ${variant.projection} firm breasts"\n`);
});

// Create test buttocks with projection
const buttocksVariants = [
  { id: 'buttocks-flat', projection: 'flat', shape: 'narrow' },
  { id: 'buttocks-bubbly', projection: 'bubbly', shape: 'round' },
  { id: 'buttocks-shelf', projection: 'shelf', shape: 'wide' }
];

buttocksVariants.forEach(variant => {
  const part = new TestEntity(variant.id);

  part.addComponent('anatomy:part', {
    type: 'ass',
    subType: 'buttocks'
  });

  part.addComponent('descriptors:shape_general', {
    shape: variant.shape
  });

  part.addComponent('descriptors:projection', {
    projection: variant.projection
  });

  console.log(`Created ${variant.id}:`);
  console.log(`- Shape: ${variant.shape}`);
  console.log(`- Projection: ${variant.projection}`);
  console.log(`- Expected output: "${variant.shape} ${variant.projection} buttocks"\n`);
});
```

### Step 5: Create Integration Test

Create a test to verify projection descriptor integration:

```javascript
// tests/integration/anatomy/projectionDescriptor.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TestEntity } from '../../common/testEntity.js';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import { DescriptorFormatter } from '../../../src/anatomy/descriptorFormatter.js';
import { DescriptionTemplate } from '../../../src/anatomy/descriptionTemplate.js';

describe('Projection Descriptor Integration', () => {
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

  describe('Breast Projection', () => {
    it('should include projection in breast descriptions', () => {
      const entity = new TestEntity('test-human');
      entity.addComponent('anatomy:body', { type: 'humanoid' });

      const breast = new TestEntity('breast-part');
      breast.addComponent('anatomy:part', {
        type: 'breast',
        subType: 'breasts',
        count: 2,
      });
      breast.addComponent('descriptors:size_category', { size: 'medium' });
      breast.addComponent('descriptors:projection', { projection: 'bubbly' });
      breast.addComponent('descriptors:firmness', { firmness: 'soft' });

      const config = {
        descriptionOrder: ['breast'],
        descriptorOrder: [
          'descriptors:size_category',
          'descriptors:projection',
          'descriptors:firmness',
        ],
        descriptorValueKeys: ['size', 'projection', 'firmness'],
        templates: {
          breast: '{descriptors} {subType}',
        },
      };

      const result = composer.composeDescription(entity, [breast], config);

      expect(result).toContain('Breasts: medium bubbly soft breasts');
    });

    it('should handle all projection values', () => {
      const projections = ['flat', 'bubbly', 'shelf'];

      projections.forEach((projection) => {
        const entity = new TestEntity('test-human');
        entity.addComponent('anatomy:body', { type: 'humanoid' });

        const breast = new TestEntity('breast-part');
        breast.addComponent('anatomy:part', {
          type: 'breast',
          subType: 'breasts',
        });
        breast.addComponent('descriptors:projection', { projection });

        const config = {
          descriptionOrder: ['breast'],
          descriptorOrder: ['descriptors:projection'],
          descriptorValueKeys: ['projection'],
          templates: {
            breast: '{descriptors} {subType}',
          },
        };

        const result = composer.composeDescription(entity, [breast], config);

        expect(result).toContain(`${projection} breasts`);
      });
    });
  });

  describe('Buttocks Projection', () => {
    it('should include projection in buttocks descriptions', () => {
      const entity = new TestEntity('test-human');
      entity.addComponent('anatomy:body', { type: 'humanoid' });

      const buttocks = new TestEntity('buttocks-part');
      buttocks.addComponent('anatomy:part', {
        type: 'ass',
        subType: 'buttocks',
      });
      buttocks.addComponent('descriptors:shape_general', { shape: 'round' });
      buttocks.addComponent('descriptors:projection', { projection: 'shelf' });

      const config = {
        descriptionOrder: ['ass'],
        descriptorOrder: [
          'descriptors:shape_general',
          'descriptors:projection',
        ],
        descriptorValueKeys: ['shape', 'projection'],
        templates: {
          ass: '{descriptors} {subType}',
        },
      };

      const result = composer.composeDescription(entity, [buttocks], config);

      expect(result).toContain('Ass: round shelf buttocks');
    });
  });

  describe('Descriptor Ordering', () => {
    it('should respect projection position in descriptorOrder', () => {
      const entity = new TestEntity('test-human');
      entity.addComponent('anatomy:body', { type: 'humanoid' });

      const breast = new TestEntity('breast-part');
      breast.addComponent('anatomy:part', {
        type: 'breast',
        subType: 'breasts',
      });
      breast.addComponent('descriptors:size_category', { size: 'large' });
      breast.addComponent('descriptors:firmness', { firmness: 'firm' });
      breast.addComponent('descriptors:projection', { projection: 'shelf' });
      breast.addComponent('descriptors:texture', { texture: 'smooth' });

      // Test different orders
      const configProjectionFirst = {
        descriptionOrder: ['breast'],
        descriptorOrder: [
          'descriptors:projection', // First
          'descriptors:size_category',
          'descriptors:firmness',
          'descriptors:texture',
        ],
        descriptorValueKeys: ['projection', 'size', 'firmness', 'texture'],
        templates: {
          breast: '{descriptors} {subType}',
        },
      };

      let result = composer.composeDescription(
        entity,
        [breast],
        configProjectionFirst
      );
      expect(result).toContain('shelf large firm smooth breasts');

      // Projection in middle
      const configProjectionMiddle = {
        ...configProjectionFirst,
        descriptorOrder: [
          'descriptors:size_category',
          'descriptors:projection', // Middle
          'descriptors:firmness',
          'descriptors:texture',
        ],
      };

      result = composer.composeDescription(
        entity,
        [breast],
        configProjectionMiddle
      );
      expect(result).toContain('large shelf firm smooth breasts');
    });
  });

  describe('Edge Cases', () => {
    it('should handle parts without projection gracefully', () => {
      const entity = new TestEntity('test-human');
      entity.addComponent('anatomy:body', { type: 'humanoid' });

      const breast = new TestEntity('breast-part');
      breast.addComponent('anatomy:part', {
        type: 'breast',
        subType: 'breasts',
      });
      breast.addComponent('descriptors:size_category', { size: 'medium' });
      // No projection descriptor

      const config = {
        descriptionOrder: ['breast'],
        descriptorOrder: [
          'descriptors:size_category',
          'descriptors:projection',
        ],
        descriptorValueKeys: ['size', 'projection'],
        templates: {
          breast: '{descriptors} {subType}',
        },
      };

      const result = composer.composeDescription(entity, [breast], config);

      // Should not have undefined or null
      expect(result).toBe('Breasts: medium breasts');
      expect(result).not.toContain('undefined');
      expect(result).not.toContain('null');
    });

    it('should handle projection on non-typical parts', () => {
      const entity = new TestEntity('test-human');
      entity.addComponent('anatomy:body', { type: 'humanoid' });

      // Unusual: projection on belly
      const belly = new TestEntity('belly-part');
      belly.addComponent('anatomy:part', {
        type: 'belly',
        subType: 'belly',
      });
      belly.addComponent('descriptors:size_category', { size: 'rounded' });
      belly.addComponent('descriptors:projection', { projection: 'bubbly' });

      const config = {
        descriptionOrder: ['belly'],
        descriptorOrder: [
          'descriptors:size_category',
          'descriptors:projection',
        ],
        descriptorValueKeys: ['size', 'projection'],
        templates: {
          belly: '{descriptors} {subType}',
        },
      };

      const result = composer.composeDescription(entity, [belly], config);

      // Should work even on unusual parts
      expect(result).toContain('rounded bubbly belly');
    });
  });
});
```

### Step 6: Create Example Entities

Create example entity files demonstrating projection usage:

```json
// data/mods/anatomy/entities/humanoid_female_curvy.json
{
  "id": "anatomy:humanoid_female_curvy",
  "components": {
    "anatomy:body": {
      "type": "humanoid",
      "parts": [
        "head",
        "hair",
        "eyes",
        "chest",
        "breasts",
        "waist",
        "hips",
        "buttocks",
        "legs"
      ]
    },
    "descriptors:build": {
      "build": "curvy"
    },
    "descriptors:body_composition": {
      "composition": "soft"
    }
  },
  "parts": [
    {
      "id": "anatomy:female_breasts_shelf",
      "components": {
        "anatomy:part": {
          "type": "breast",
          "subType": "breasts",
          "count": 2
        },
        "descriptors:size_category": {
          "size": "large"
        },
        "descriptors:projection": {
          "projection": "shelf"
        },
        "descriptors:firmness": {
          "firmness": "soft"
        }
      }
    },
    {
      "id": "anatomy:female_buttocks_shelf",
      "components": {
        "anatomy:part": {
          "type": "ass",
          "subType": "buttocks"
        },
        "descriptors:shape_general": {
          "shape": "wide"
        },
        "descriptors:projection": {
          "projection": "shelf"
        },
        "descriptors:firmness": {
          "firmness": "jiggly"
        }
      }
    }
  ]
}
```

```json
// data/mods/anatomy/entities/humanoid_athletic_flat.json
{
  "id": "anatomy:humanoid_athletic_flat",
  "components": {
    "anatomy:body": {
      "type": "humanoid",
      "parts": [
        "head",
        "hair",
        "eyes",
        "chest",
        "breasts",
        "abs",
        "hips",
        "buttocks",
        "legs"
      ]
    },
    "descriptors:build": {
      "build": "athletic"
    },
    "descriptors:body_composition": {
      "composition": "lean"
    }
  },
  "parts": [
    {
      "id": "anatomy:athletic_breasts_flat",
      "components": {
        "anatomy:part": {
          "type": "breast",
          "subType": "breasts",
          "count": 2
        },
        "descriptors:size_category": {
          "size": "small"
        },
        "descriptors:projection": {
          "projection": "flat"
        },
        "descriptors:firmness": {
          "firmness": "firm"
        }
      }
    },
    {
      "id": "anatomy:athletic_buttocks_flat",
      "components": {
        "anatomy:part": {
          "type": "ass",
          "subType": "buttocks"
        },
        "descriptors:shape_general": {
          "shape": "tight"
        },
        "descriptors:projection": {
          "projection": "flat"
        },
        "descriptors:firmness": {
          "firmness": "firm"
        }
      }
    }
  ]
}
```

### Step 7: Verify Integration

Create a verification script:

```javascript
// scripts/verify-projection-integration.js

#!/usr/bin/env node

/**
 * Verify projection descriptor integration
 */

import { promises as fs } from 'fs';

async function verifyProjection() {
  console.log('🔍 Verifying Projection Descriptor Integration...\n');

  const errors = [];

  // 1. Check configuration
  console.log('1️⃣ Checking configuration...');
  try {
    const configContent = await fs.readFile(
      'data/mods/anatomy/anatomy-formatting/default.json',
      'utf8'
    );
    const config = JSON.parse(configContent);

    if (!config.descriptorOrder.includes('descriptors:projection')) {
      errors.push('descriptors:projection missing from descriptorOrder');
    } else {
      console.log('✅ descriptors:projection in descriptorOrder');
    }

    if (!config.descriptorValueKeys.includes('projection')) {
      errors.push('projection missing from descriptorValueKeys');
    } else {
      console.log('✅ projection in descriptorValueKeys');
    }
  } catch (error) {
    errors.push(`Failed to check configuration: ${error.message}`);
  }

  // 2. Check schema
  console.log('\n2️⃣ Checking projection schema...');
  try {
    await fs.access('data/schemas/components/descriptors/projection.schema.json');
    console.log('✅ Projection schema exists');
  } catch {
    errors.push('Projection schema file missing');
  }

  // 3. Check for example usage
  console.log('\n3️⃣ Checking for example entities...');
  const exampleFiles = [
    'data/mods/anatomy/entities/humanoid_female_curvy.json',
    'data/mods/anatomy/entities/humanoid_athletic_flat.json'
  ];

  for (const file of exampleFiles) {
    try {
      await fs.access(file);
      console.log(`✅ Example entity exists: ${file}`);
    } catch {
      console.log(`⚠️  Example entity missing: ${file}`);
    }
  }

  // Report results
  if (errors.length === 0) {
    console.log('\n✨ Projection descriptor integration verified!');
  } else {
    console.log('\n❌ Integration issues found:');
    errors.forEach(err => console.log(`  - ${err}`));
    process.exit(1);
  }
}

verifyProjection().catch(console.error);
```

## Validation Steps

### 1. Configuration Validation

```bash
# Verify configuration changes
node scripts/verify-projection-integration.js
```

### 2. Schema Validation

```bash
# Validate projection schema
npm run validate-schemas -- data/schemas/components/descriptors/projection.schema.json
```

### 3. Test Execution

```bash
# Run projection integration tests
npm test tests/integration/anatomy/projectionDescriptor.test.js

# Run all anatomy tests to check for regression
npm test tests/integration/anatomy/
```

### 4. Manual Testing

```bash
# Test with example entities
node scripts/test-projection-descriptor.js

# Start game and verify descriptions
npm run dev
```

## Common Issues and Solutions

### Issue 1: Projection Not Appearing

**Problem:** Projection descriptor doesn't show in descriptions.
**Solution:**

- Verify it's in descriptorOrder configuration
- Check that the part has the projection component
- Ensure projection is in descriptorValueKeys

### Issue 2: Wrong Descriptor Order

**Problem:** Projection appears in wrong position.
**Solution:** Adjust its position in the descriptorOrder array.

### Issue 3: Schema Validation Fails

**Problem:** Projection component fails validation.
**Solution:** Ensure the property name is "projection" and values match enum.

## Completion Checklist

- [ ] Configuration verified/updated
- [ ] Projection in descriptorOrder
- [ ] "projection" in descriptorValueKeys
- [ ] Test script created
- [ ] Integration tests written
- [ ] Example entities created
- [ ] Verification script created
- [ ] All tests passing
- [ ] Manual testing completed
- [ ] No regression in existing functionality

## Next Steps

After completing projection support:

- NEWDESC-08: Create comprehensive example entities
- NEWDESC-09: Update modding documentation
- Consider adding more surface descriptors if needed

## Notes for Implementer

- Projection is a part-level descriptor, not body-level
- It's automatically handled by the existing DescriptorFormatter
- No code changes needed - just configuration
- Typical use is for breasts and buttocks, but can be used on any part
- The values (flat, bubbly, shelf) are intentionally abstract
- This enhances description variety for body parts
