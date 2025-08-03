# NEWDESC-08: Create Example Entities Demonstrating New Descriptors

## Overview

Create a comprehensive set of example entities that demonstrate the proper usage of the new descriptor components (body_composition, body_hair, facial_hair, and projection). These examples will serve as references for modders and testing scenarios for the development team.

## Priority

**Low** - Documentation and examples for modder reference.

## Dependencies

- NEWDESC-01 through NEWDESC-07 (all completed)
- Understanding of entity and part structure

## Estimated Effort

**3 hours** - Creating diverse examples with various combinations

## Acceptance Criteria

1. ✅ Create at least 10 example entities showcasing different descriptor combinations
2. ✅ Examples cover all body composition values
3. ✅ Examples cover all body hair density values
4. ✅ Examples cover all facial hair styles
5. ✅ Examples demonstrate projection on appropriate parts
6. ✅ Entity files follow proper JSON structure and schema
7. ✅ Entities include realistic descriptor combinations
8. ✅ Clear naming convention for easy reference
9. ✅ Comments explain descriptor choices
10. ✅ Entities are added to mod manifest

## Implementation Steps

### Step 1: Create Entity File Structure

```bash
# Create directories for organized examples
mkdir -p data/mods/anatomy/entities/examples/body-composition
mkdir -p data/mods/anatomy/entities/examples/body-hair
mkdir -p data/mods/anatomy/entities/examples/facial-hair
mkdir -p data/mods/anatomy/entities/examples/complete
```

### Step 2: Create Body Composition Examples

```json
// data/mods/anatomy/entities/examples/body-composition/underweight-runner.json
{
  "$schema": "../../../schemas/entity.schema.json",
  "id": "anatomy:example_underweight_runner",
  "description": "Example of underweight body composition - marathon runner physique",
  "components": {
    "anatomy:body": {
      "type": "humanoid"
    },
    "descriptors:build": {
      "build": "lanky"
    },
    "descriptors:body_composition": {
      "composition": "underweight"
    },
    "descriptors:body_hair": {
      "density": "light"
    }
  }
}
```

```json
// data/mods/anatomy/entities/examples/body-composition/lean-athlete.json
{
  "$schema": "../../../schemas/entity.schema.json",
  "id": "anatomy:example_lean_athlete",
  "description": "Example of lean body composition - athletic build",
  "components": {
    "anatomy:body": {
      "type": "humanoid"
    },
    "descriptors:build": {
      "build": "athletic"
    },
    "descriptors:body_composition": {
      "composition": "lean"
    },
    "descriptors:body_hair": {
      "density": "moderate"
    }
  }
}
```

```json
// data/mods/anatomy/entities/examples/body-composition/average-person.json
{
  "$schema": "../../../schemas/entity.schema.json",
  "id": "anatomy:example_average_person",
  "description": "Example of average body composition - typical build",
  "components": {
    "anatomy:body": {
      "type": "humanoid"
    },
    "descriptors:build": {
      "build": "average"
    },
    "descriptors:body_composition": {
      "composition": "average"
    },
    "descriptors:body_hair": {
      "density": "moderate"
    }
  }
}
```

```json
// data/mods/anatomy/entities/examples/body-composition/soft-comfortable.json
{
  "$schema": "../../../schemas/entity.schema.json",
  "id": "anatomy:example_soft_comfortable",
  "description": "Example of soft body composition - comfortable build",
  "components": {
    "anatomy:body": {
      "type": "humanoid"
    },
    "descriptors:build": {
      "build": "stocky"
    },
    "descriptors:body_composition": {
      "composition": "soft"
    },
    "descriptors:body_hair": {
      "density": "light"
    }
  }
}
```

```json
// data/mods/anatomy/entities/examples/body-composition/chubby-friendly.json
{
  "$schema": "../../../schemas/entity.schema.json",
  "id": "anatomy:example_chubby_friendly",
  "description": "Example of chubby body composition",
  "components": {
    "anatomy:body": {
      "type": "humanoid"
    },
    "descriptors:build": {
      "build": "heavyset"
    },
    "descriptors:body_composition": {
      "composition": "chubby"
    },
    "descriptors:body_hair": {
      "density": "sparse"
    }
  }
}
```

### Step 3: Create Body Hair Examples

```json
// data/mods/anatomy/entities/examples/body-hair/hairless-swimmer.json
{
  "$schema": "../../../schemas/entity.schema.json",
  "id": "anatomy:example_hairless_swimmer",
  "description": "Example of hairless body - competitive swimmer",
  "components": {
    "anatomy:body": {
      "type": "humanoid"
    },
    "descriptors:build": {
      "build": "athletic"
    },
    "descriptors:body_composition": {
      "composition": "lean"
    },
    "descriptors:body_hair": {
      "density": "hairless"
    }
  }
}
```

```json
// data/mods/anatomy/entities/examples/body-hair/sparse-youth.json
{
  "$schema": "../../../schemas/entity.schema.json",
  "id": "anatomy:example_sparse_youth",
  "description": "Example of sparse body hair - young adult",
  "components": {
    "anatomy:body": {
      "type": "humanoid"
    },
    "descriptors:build": {
      "build": "slim"
    },
    "descriptors:body_composition": {
      "composition": "average"
    },
    "descriptors:body_hair": {
      "density": "sparse"
    }
  }
}
```

```json
// data/mods/anatomy/entities/examples/body-hair/very-hairy-masculine.json
{
  "$schema": "../../../schemas/entity.schema.json",
  "id": "anatomy:example_very_hairy_masculine",
  "description": "Example of very hairy body - masculine build",
  "components": {
    "anatomy:body": {
      "type": "humanoid"
    },
    "descriptors:build": {
      "build": "muscular"
    },
    "descriptors:body_composition": {
      "composition": "average"
    },
    "descriptors:body_hair": {
      "density": "very-hairy"
    }
  }
}
```

### Step 4: Create Facial Hair Examples with Parts

```json
// data/mods/anatomy/entities/examples/facial-hair/bearded-scholar.json
{
  "$schema": "../../../schemas/entity.schema.json",
  "id": "anatomy:example_bearded_scholar",
  "description": "Example with full beard - scholarly appearance",
  "components": {
    "anatomy:body": {
      "type": "humanoid"
    },
    "descriptors:build": {
      "build": "average"
    },
    "descriptors:body_composition": {
      "composition": "soft"
    },
    "descriptors:body_hair": {
      "density": "moderate"
    }
  },
  "parts": [
    {
      "id": "anatomy:example_bearded_head",
      "components": {
        "anatomy:part": {
          "type": "face",
          "subType": "head"
        },
        "descriptors:shape_general": {
          "shape": "round"
        },
        "descriptors:facial_hair": {
          "style": "full-beard"
        }
      }
    },
    {
      "id": "anatomy:example_scholar_hair",
      "components": {
        "anatomy:part": {
          "type": "hair",
          "subType": "hair"
        },
        "descriptors:length_hair": {
          "length": "medium"
        },
        "descriptors:color_basic": {
          "color": "gray"
        },
        "descriptors:hair_style": {
          "style": "unkempt"
        }
      }
    }
  ]
}
```

```json
// data/mods/anatomy/entities/examples/facial-hair/goatee-artist.json
{
  "$schema": "../../../schemas/entity.schema.json",
  "id": "anatomy:example_goatee_artist",
  "description": "Example with goatee - artistic appearance",
  "components": {
    "anatomy:body": {
      "type": "humanoid"
    },
    "descriptors:build": {
      "build": "slim"
    },
    "descriptors:body_composition": {
      "composition": "lean"
    },
    "descriptors:body_hair": {
      "density": "light"
    }
  },
  "parts": [
    {
      "id": "anatomy:example_goatee_head",
      "components": {
        "anatomy:part": {
          "type": "face",
          "subType": "head"
        },
        "descriptors:shape_general": {
          "shape": "angular"
        },
        "descriptors:facial_hair": {
          "style": "goatee"
        }
      }
    }
  ]
}
```

```json
// data/mods/anatomy/entities/examples/facial-hair/mustache-gentleman.json
{
  "$schema": "../../../schemas/entity.schema.json",
  "id": "anatomy:example_mustache_gentleman",
  "description": "Example with mustache - distinguished appearance",
  "components": {
    "anatomy:body": {
      "type": "humanoid"
    },
    "descriptors:build": {
      "build": "stocky"
    },
    "descriptors:body_composition": {
      "composition": "average"
    },
    "descriptors:body_hair": {
      "density": "moderate"
    }
  },
  "parts": [
    {
      "id": "anatomy:example_mustache_head",
      "components": {
        "anatomy:part": {
          "type": "face",
          "subType": "head"
        },
        "descriptors:shape_general": {
          "shape": "square"
        },
        "descriptors:facial_hair": {
          "style": "mustache"
        }
      }
    }
  ]
}
```

### Step 5: Create Complete Examples with All Descriptors

```json
// data/mods/anatomy/entities/examples/complete/athletic-woman.json
{
  "$schema": "../../../schemas/entity.schema.json",
  "id": "anatomy:example_athletic_woman",
  "description": "Complete example - athletic woman with all descriptors",
  "components": {
    "anatomy:body": {
      "type": "humanoid"
    },
    "descriptors:build": {
      "build": "athletic"
    },
    "descriptors:body_composition": {
      "composition": "lean"
    },
    "descriptors:body_hair": {
      "density": "light"
    }
  },
  "parts": [
    {
      "id": "anatomy:example_woman_head",
      "components": {
        "anatomy:part": {
          "type": "face",
          "subType": "head"
        },
        "descriptors:shape_general": {
          "shape": "oval"
        }
      }
    },
    {
      "id": "anatomy:example_woman_hair",
      "components": {
        "anatomy:part": {
          "type": "hair",
          "subType": "hair"
        },
        "descriptors:length_hair": {
          "length": "long"
        },
        "descriptors:color_extended": {
          "color": "auburn"
        },
        "descriptors:hair_style": {
          "style": "ponytail"
        },
        "descriptors:texture": {
          "texture": "straight"
        }
      }
    },
    {
      "id": "anatomy:example_woman_breasts",
      "components": {
        "anatomy:part": {
          "type": "breast",
          "subType": "breasts",
          "count": 2
        },
        "descriptors:size_category": {
          "size": "medium"
        },
        "descriptors:projection": {
          "projection": "bubbly"
        },
        "descriptors:firmness": {
          "firmness": "firm"
        }
      }
    },
    {
      "id": "anatomy:example_woman_buttocks",
      "components": {
        "anatomy:part": {
          "type": "ass",
          "subType": "buttocks"
        },
        "descriptors:shape_general": {
          "shape": "athletic"
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

```json
// data/mods/anatomy/entities/examples/complete/burly-blacksmith.json
{
  "$schema": "../../../schemas/entity.schema.json",
  "id": "anatomy:example_burly_blacksmith",
  "description": "Complete example - burly blacksmith with all descriptors",
  "components": {
    "anatomy:body": {
      "type": "humanoid"
    },
    "descriptors:build": {
      "build": "muscular"
    },
    "descriptors:body_composition": {
      "composition": "average"
    },
    "descriptors:body_hair": {
      "density": "hairy"
    }
  },
  "parts": [
    {
      "id": "anatomy:example_blacksmith_head",
      "components": {
        "anatomy:part": {
          "type": "face",
          "subType": "head"
        },
        "descriptors:shape_general": {
          "shape": "rugged"
        },
        "descriptors:facial_hair": {
          "style": "bearded"
        }
      }
    },
    {
      "id": "anatomy:example_blacksmith_hair",
      "components": {
        "anatomy:part": {
          "type": "hair",
          "subType": "hair"
        },
        "descriptors:length_hair": {
          "length": "short"
        },
        "descriptors:color_basic": {
          "color": "dark"
        },
        "descriptors:hair_style": {
          "style": "messy"
        }
      }
    },
    {
      "id": "anatomy:example_blacksmith_arms",
      "components": {
        "anatomy:part": {
          "type": "arm",
          "subType": "arms",
          "count": 2
        },
        "descriptors:size_specific": {
          "size": "massive"
        },
        "descriptors:texture": {
          "texture": "scarred"
        }
      }
    },
    {
      "id": "anatomy:example_blacksmith_chest",
      "components": {
        "anatomy:part": {
          "type": "chest",
          "subType": "chest"
        },
        "descriptors:size_category": {
          "size": "broad"
        },
        "descriptors:body_hair": {
          "density": "hairy"
        }
      }
    }
  ]
}
```

```json
// data/mods/anatomy/entities/examples/complete/elegant-noble.json
{
  "$schema": "../../../schemas/entity.schema.json",
  "id": "anatomy:example_elegant_noble",
  "description": "Complete example - elegant noble with refined features",
  "components": {
    "anatomy:body": {
      "type": "humanoid"
    },
    "descriptors:build": {
      "build": "slim"
    },
    "descriptors:body_composition": {
      "composition": "soft"
    },
    "descriptors:body_hair": {
      "density": "sparse"
    }
  },
  "parts": [
    {
      "id": "anatomy:example_noble_head",
      "components": {
        "anatomy:part": {
          "type": "face",
          "subType": "head"
        },
        "descriptors:shape_general": {
          "shape": "refined"
        },
        "descriptors:facial_hair": {
          "style": "clean-shaven"
        }
      }
    },
    {
      "id": "anatomy:example_noble_hair",
      "components": {
        "anatomy:part": {
          "type": "hair",
          "subType": "hair"
        },
        "descriptors:length_hair": {
          "length": "medium"
        },
        "descriptors:color_extended": {
          "color": "platinum"
        },
        "descriptors:hair_style": {
          "style": "styled"
        },
        "descriptors:texture": {
          "texture": "silky"
        }
      }
    },
    {
      "id": "anatomy:example_noble_eyes",
      "components": {
        "anatomy:part": {
          "type": "eye",
          "subType": "eyes",
          "count": 2
        },
        "descriptors:color_extended": {
          "color": "ice blue"
        },
        "descriptors:shape_eye": {
          "shape": "narrow"
        }
      }
    }
  ]
}
```

### Step 6: Create Example Index

```json
// data/mods/anatomy/entities/examples/index.json
{
  "$schema": "../../../schemas/entity-index.schema.json",
  "description": "Index of example entities demonstrating new descriptors",
  "categories": {
    "body_composition": {
      "description": "Examples showing different body composition values",
      "entities": [
        "anatomy:example_underweight_runner",
        "anatomy:example_lean_athlete",
        "anatomy:example_average_person",
        "anatomy:example_soft_comfortable",
        "anatomy:example_chubby_friendly"
      ]
    },
    "body_hair": {
      "description": "Examples showing different body hair densities",
      "entities": [
        "anatomy:example_hairless_swimmer",
        "anatomy:example_sparse_youth",
        "anatomy:example_very_hairy_masculine"
      ]
    },
    "facial_hair": {
      "description": "Examples showing different facial hair styles",
      "entities": [
        "anatomy:example_bearded_scholar",
        "anatomy:example_goatee_artist",
        "anatomy:example_mustache_gentleman"
      ]
    },
    "complete": {
      "description": "Complete examples with all descriptors",
      "entities": [
        "anatomy:example_athletic_woman",
        "anatomy:example_burly_blacksmith",
        "anatomy:example_elegant_noble"
      ]
    }
  }
}
```

### Step 7: Create Validation Script

```javascript
// scripts/validate-example-entities.js

#!/usr/bin/env node

/**
 * Validate all example entities
 */

import { promises as fs } from 'fs';
import { glob } from 'glob';
import Ajv from 'ajv';

async function validateExamples() {
  console.log('🔍 Validating Example Entities...\n');

  const ajv = new Ajv({ strict: true });
  const errors = [];
  let entityCount = 0;

  // Load entity schema
  const schemaContent = await fs.readFile(
    'data/schemas/entity.schema.json',
    'utf8'
  );
  const schema = JSON.parse(schemaContent);
  const validate = ajv.compile(schema);

  // Find all example entities
  const entityFiles = await glob('data/mods/anatomy/entities/examples/**/*.json');

  for (const file of entityFiles) {
    if (file.endsWith('index.json')) continue;

    try {
      const content = await fs.readFile(file, 'utf8');
      const entity = JSON.parse(content);

      // Validate against schema
      const valid = validate(entity);
      if (!valid) {
        errors.push({
          file,
          errors: validate.errors
        });
      } else {
        console.log(`✅ ${entity.id}`);
        entityCount++;
      }

      // Check for required descriptors
      if (entity.components) {
        const hasBodyComposition = !!entity.components['descriptors:body_composition'];
        const hasBodyHair = !!entity.components['descriptors:body_hair'];

        if (!hasBodyComposition || !hasBodyHair) {
          console.log(`⚠️  ${entity.id} missing body-level descriptors`);
        }
      }

    } catch (error) {
      errors.push({
        file,
        error: error.message
      });
    }
  }

  // Report results
  console.log(`\n📊 Validated ${entityCount} entities`);

  if (errors.length > 0) {
    console.log('\n❌ Validation errors:');
    errors.forEach(({ file, errors: validationErrors, error }) => {
      console.log(`\n${file}:`);
      if (validationErrors) {
        validationErrors.forEach(err => {
          console.log(`  - ${err.instancePath}: ${err.message}`);
        });
      } else if (error) {
        console.log(`  - ${error}`);
      }
    });
    process.exit(1);
  } else {
    console.log('✨ All examples valid!');
  }
}

validateExamples().catch(console.error);
```

### Step 8: Create Test Script

```javascript
// scripts/test-example-entities.js

#!/usr/bin/env node

/**
 * Test example entities with description generation
 */

import { promises as fs } from 'fs';
import { BodyDescriptionComposer } from '../src/anatomy/bodyDescriptionComposer.js';
import { DescriptorFormatter } from '../src/anatomy/descriptorFormatter.js';
import { DescriptionTemplate } from '../src/anatomy/descriptionTemplate.js';

async function testExamples() {
  console.log('🧪 Testing Example Entity Descriptions...\n');

  // Load configuration
  const configContent = await fs.readFile(
    'data/mods/anatomy/anatomy-formatting/default.json',
    'utf8'
  );
  const config = JSON.parse(configContent);

  // Create composer
  const descriptorFormatter = new DescriptorFormatter({ logger: console });
  const descriptionTemplate = new DescriptionTemplate({
    logger: console,
    descriptorFormatter
  });
  const composer = new BodyDescriptionComposer({
    logger: console,
    descriptorFormatter,
    templateDescription: descriptionTemplate,
    equipmentDescriptionService: null
  });

  // Test complete examples
  const completeExamples = [
    'data/mods/anatomy/entities/examples/complete/athletic-woman.json',
    'data/mods/anatomy/entities/examples/complete/burly-blacksmith.json',
    'data/mods/anatomy/entities/examples/complete/elegant-noble.json'
  ];

  for (const file of completeExamples) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const entityData = JSON.parse(content);

      // Create mock entity
      const entity = {
        id: entityData.id,
        getComponentData: (componentId) => entityData.components[componentId] || null
      };

      // Create mock parts
      const parts = (entityData.parts || []).map(partData => ({
        getComponentData: (componentId) => partData.components[componentId] || null
      }));

      // Generate description
      const description = composer.composeDescription(entity, parts, config);

      console.log(`\n📝 ${entityData.id}:`);
      console.log(description);
      console.log('---');

    } catch (error) {
      console.error(`Failed to test ${file}: ${error.message}`);
    }
  }
}

testExamples().catch(console.error);
```

### Step 9: Update Mod Manifest

Add example entities to the mod manifest:

```javascript
// Update script to add examples to manifest
// scripts/update-anatomy-manifest.js

#!/usr/bin/env node

import { promises as fs } from 'fs';
import { glob } from 'glob';
import path from 'path';

async function updateManifest() {
  console.log('📝 Updating anatomy mod manifest with examples...\n');

  const manifestPath = 'data/mods/anatomy/mod-manifest.json';

  // Read current manifest
  const manifestContent = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);

  // Find all example entities
  const exampleFiles = await glob('data/mods/anatomy/entities/examples/**/*.json');
  const exampleEntities = [];

  for (const file of exampleFiles) {
    if (file.endsWith('index.json')) continue;

    // Extract relative path from entities directory
    const relativePath = path.relative('data/mods/anatomy/entities/', file);
    exampleEntities.push(relativePath);
  }

  // Update manifest
  if (!manifest.content.entities) {
    manifest.content.entities = [];
  }

  // Add examples (avoid duplicates)
  exampleEntities.forEach(entity => {
    if (!manifest.content.entities.includes(entity)) {
      manifest.content.entities.push(entity);
    }
  });

  // Sort for consistency
  manifest.content.entities.sort();

  // Write updated manifest
  await fs.writeFile(
    manifestPath,
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8'
  );

  console.log(`✅ Added ${exampleEntities.length} example entities to manifest`);
}

updateManifest().catch(console.error);
```

## Validation Steps

### 1. Validate All Examples

```bash
# Run validation script
node scripts/validate-example-entities.js
```

### 2. Test Description Generation

```bash
# Test with real description generation
node scripts/test-example-entities.js
```

### 3. Update Mod Manifest

```bash
# Add examples to manifest
node scripts/update-anatomy-manifest.js
```

### 4. Manual Testing

```bash
# Start game and test entity loading
npm run dev

# Create instances of example entities
# Verify descriptions generate correctly
```

## Common Issues and Solutions

### Issue 1: Schema Validation Failures

**Problem:** Entity files fail schema validation.
**Solution:**

- Check JSON syntax
- Ensure all required fields present
- Verify component IDs match schemas

### Issue 2: Missing Descriptors

**Problem:** Some examples missing new descriptors.
**Solution:** Add body_composition and body_hair to all entities.

### Issue 3: Unrealistic Combinations

**Problem:** Descriptor combinations don't make sense.
**Solution:** Review and adjust for realistic combinations.

## Completion Checklist

- [ ] Directory structure created
- [ ] Body composition examples (all 7 values)
- [ ] Body hair examples (all 6 values)
- [ ] Facial hair examples (multiple styles)
- [ ] Complete examples with all descriptors
- [ ] Projection examples on appropriate parts
- [ ] Example index created
- [ ] Validation script created
- [ ] Test script created
- [ ] All examples pass validation
- [ ] Mod manifest updated
- [ ] Manual testing completed

## Next Steps

After creating examples:

- NEWDESC-09: Update modding documentation
- Share examples with modding community
- Use examples for testing and demos

## Notes for Implementer

- Keep examples realistic and diverse
- Show different combinations of descriptors
- Include comments explaining choices
- Test that descriptions generate as expected
- Consider cultural sensitivity in examples
- Provide both simple and complex examples
- Examples should inspire modders
