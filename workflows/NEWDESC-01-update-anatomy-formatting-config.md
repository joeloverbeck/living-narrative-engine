# NEWDESC-01: Update Anatomy Formatting Configuration

## Overview

Update the anatomy formatting configuration file to include new descriptor components (body_composition, body_hair, facial_hair, and projection) in the appropriate configuration sections. This involves updating the descriptionOrder, descriptorOrder, and descriptorValueKeys arrays in the default anatomy formatting configuration.

**Note:** All four descriptor components already exist in the codebase at:

- `data/mods/descriptors/components/body_composition.component.json` (uses property: `composition`)
- `data/mods/descriptors/components/body_hair.component.json` (uses property: `density`)
- `data/mods/descriptors/components/facial_hair.component.json` (uses property: `style`)
- `data/mods/descriptors/components/projection.component.json` (uses property: `projection`)

## Priority

**High** - This is the foundational configuration change that enables all other descriptor integration work.

## Dependencies

- None - This is the first ticket in the descriptor integration sequence

## Estimated Effort

**1 hour** - Configuration updates with validation

## Acceptance Criteria

1. ✅ `descriptionOrder` array includes body_composition and body_hair after "build"
2. ✅ `descriptorOrder` array includes all new descriptor components in appropriate positions
3. ✅ `descriptorValueKeys` array includes new keys: composition, density, projection
4. ✅ Configuration file passes JSON validation
5. ✅ No existing functionality is broken
6. ✅ Order of descriptors maintains logical flow

## Implementation Steps

### Step 1: Locate and Backup Configuration File

```bash
# Navigate to anatomy formatting directory
cd data/mods/anatomy/anatomy-formatting/

# Create backup of current configuration
cp default.json default.json.backup-$(date +%Y%m%d)

# Verify backup was created
ls -la default.json*
```

**Note:** The configuration file also contains `pairedParts` and `irregularPlurals` arrays that should be preserved during updates.

### Step 2: Update descriptionOrder Array

Open `data/mods/anatomy/anatomy-formatting/default.json` and locate the `descriptionOrder` array.

**Current State:**

```json
"descriptionOrder": [
  "build",
  "hair",
  "eye",
  "face",
  "ear",
  "nose",
  "mouth",
  "neck",
  "breast",
  "torso",
  "arm",
  "hand",
  "leg",
  "ass_cheek",
  "foot",
  "pubic_hair",
  "vagina",
  "penis",
  "testicle",
  "tail",
  "wing",
  "equipment"
]
```

**Update to:**

```json
"descriptionOrder": [
  "build",
  "body_composition",  // NEW: Add after "build"
  "body_hair",        // NEW: Add after "body_composition"
  "hair",
  "eye",
  "face",
  "ear",
  "nose",
  "mouth",
  "neck",
  "breast",
  "torso",
  "arm",
  "hand",
  "leg",
  "ass_cheek",
  "foot",
  "pubic_hair",
  "vagina",
  "penis",
  "testicle",
  "tail",
  "wing",
  "equipment"
]
```

**Rationale:** Body-level descriptors (body_composition and body_hair) should appear early in the description, right after the overall build, before moving to specific body parts.

### Step 3: Preserve Existing Arrays

The configuration file contains two additional arrays that must be preserved:

**pairedParts array:**

```json
"pairedParts": [
  "eye",
  "ear",
  "arm",
  "leg",
  "hand",
  "foot",
  "breast",
  "wing",
  "testicle",
  "ass_cheek"
]
```

**irregularPlurals object:**

```json
"irregularPlurals": {
  "foot": "feet",
  "tooth": "teeth",
  "ass_cheek": "ass"
}
```

**Important:** Do not modify these arrays unless specifically required. They control how paired body parts are grouped and how irregular plurals are handled.

### Step 4: Update descriptorOrder Array

Locate the `descriptorOrder` array in the same file.

**Current State:**

```json
"descriptorOrder": [
  "descriptors:length_category",
  "descriptors:length_hair",
  "descriptors:size_category",
  "descriptors:size_specific",
  "descriptors:weight_feel",
  "descriptors:color_basic",
  "descriptors:color_extended",
  "descriptors:shape_general",
  "descriptors:shape_eye",
  "descriptors:hair_style",
  "descriptors:texture",
  "descriptors:firmness",
  "descriptors:build"
]
```

**Update to:**

```json
"descriptorOrder": [
  "descriptors:length_category",
  "descriptors:length_hair",
  "descriptors:size_category",
  "descriptors:size_specific",
  "descriptors:weight_feel",
  "descriptors:body_composition",    // NEW: Add after weight_feel for body-level context
  "descriptors:body_hair",           // NEW: Add after body_composition for body-level context
  "descriptors:facial_hair",         // NEW: Add before color descriptors for part-level context
  "descriptors:color_basic",
  "descriptors:color_extended",
  "descriptors:shape_general",
  "descriptors:shape_eye",
  "descriptors:hair_style",
  "descriptors:texture",
  "descriptors:firmness",
  "descriptors:projection",          // NEW: Add after firmness for surface characteristics
  "descriptors:build"
]
```

**Rationale:**

- Body-level descriptors (body_composition, body_hair) are placed after weight/size descriptors
- Facial hair is placed before colors to maintain logical flow
- Projection is placed near other physical characteristic descriptors (texture, firmness)

### Step 5: Update descriptorValueKeys Array

Locate the `descriptorValueKeys` array.

**Current State:**

```json
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
  "weight"
]
```

**Update to:**

```json
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
  "composition",     // NEW: For body_composition descriptor
  "density",         // NEW: For body_hair descriptor
  "projection"       // NEW: For projection descriptor
]
```

**Note:** The facial_hair descriptor uses the existing "style" key, so no new key is needed for it.

### Step 6: Validate JSON Structure

After making the changes, validate the JSON structure:

```bash
# Use jq to validate and pretty-print the JSON
jq . default.json > /dev/null

# If successful, the command will complete without output
# If there's an error, it will show the JSON parsing error

# Also validate against the schema if available
npm run validate-schemas -- data/mods/anatomy/anatomy-formatting/default.json
```

### Step 7: Create Validation Test

Create a quick test script to verify the configuration changes:

```javascript
#!/usr/bin/env node

/**
 * @file Validate anatomy formatting configuration updates
 * @description Ensures new descriptors are properly added to configuration
 */

import { promises as fs } from 'fs';

async function validateConfig() {
  console.log('🔍 Validating anatomy formatting configuration...\n');

  const configPath = 'data/mods/anatomy/anatomy-formatting/default.json';
  const content = await fs.readFile(configPath, 'utf8');
  const config = JSON.parse(content);

  const errors = [];

  // Check descriptionOrder
  const expectedDescriptionOrder = ['body_composition', 'body_hair'];
  const descOrder = config.descriptionOrder;
  const buildIndex = descOrder.indexOf('build');

  if (buildIndex === -1) {
    errors.push('build not found in descriptionOrder');
  } else {
    if (descOrder[buildIndex + 1] !== 'body_composition') {
      errors.push('body_composition should be after build in descriptionOrder');
    }
    if (descOrder[buildIndex + 2] !== 'body_hair') {
      errors.push(
        'body_hair should be after body_composition in descriptionOrder'
      );
    }
  }

  // Verify existing body parts are preserved
  const requiredBodyParts = [
    'torso',
    'ass_cheek',
    'pubic_hair',
    'testicle',
    'nose',
    'mouth',
    'tail',
    'wing',
  ];
  for (const part of requiredBodyParts) {
    if (!descOrder.includes(part)) {
      errors.push(`${part} missing from descriptionOrder`);
    }
  }

  // Check descriptorOrder
  const expectedDescriptors = [
    'descriptors:body_composition',
    'descriptors:body_hair',
    'descriptors:facial_hair',
    'descriptors:projection',
  ];

  for (const descriptor of expectedDescriptors) {
    if (!config.descriptorOrder.includes(descriptor)) {
      errors.push(`${descriptor} missing from descriptorOrder`);
    }
  }

  // Check descriptorValueKeys
  const expectedKeys = ['composition', 'density', 'projection'];

  for (const key of expectedKeys) {
    if (!config.descriptorValueKeys.includes(key)) {
      errors.push(`${key} missing from descriptorValueKeys`);
    }
  }

  // Report results
  if (errors.length === 0) {
    console.log('✅ All configuration updates validated successfully!');
    console.log('\nConfiguration summary:');
    console.log(
      `- descriptionOrder has ${config.descriptionOrder.length} entries`
    );
    console.log(
      `- descriptorOrder has ${config.descriptorOrder.length} entries`
    );
    console.log(
      `- descriptorValueKeys has ${config.descriptorValueKeys.length} entries`
    );
  } else {
    console.log('❌ Validation errors found:');
    errors.forEach((err) => console.log(`  - ${err}`));
    process.exit(1);
  }
}

validateConfig().catch(console.error);
```

### Step 8: Test Configuration Loading

Verify the configuration loads correctly in the application:

```bash
# Run the application in development mode
npm run dev

# Check console for any configuration loading errors
# The anatomy system should load without errors
```

### Step 9: Document Configuration Changes

Update any relevant documentation or comments in the configuration file:

```json
{
  "$schema": "../../../schemas/anatomy-formatting.schema.json",
  "id": "default",
  "description": "Default anatomy formatting configuration with support for body composition, body hair, facial hair, and projection descriptors"
  // ... rest of configuration
}
```

**Note:** The schema path uses a relative path from the configuration file location, and the ID is simply "default" without a namespace prefix.

## Validation Steps

### 1. JSON Validation

```bash
# Validate JSON syntax
jq . data/mods/anatomy/anatomy-formatting/default.json
```

### 2. Schema Validation

```bash
# Run schema validation if available
npm run validate-schemas
```

### 3. Configuration Loading Test

```bash
# Test that the game loads with new configuration
npm run dev
# Navigate to character creation or viewing
# Verify no console errors related to anatomy formatting
```

### 4. Regression Testing

- Verify existing anatomy descriptions still work
- Check that the order of body parts is maintained
- Ensure no descriptors are lost or duplicated

## Common Issues and Solutions

### Issue 1: JSON Syntax Error

**Problem:** Configuration file has syntax errors after editing.
**Solution:** Use a JSON validator or editor with syntax highlighting. Check for:

- Missing commas between array elements
- Extra commas after last array element
- Mismatched brackets or quotes

### Issue 2: Descriptor Order Conflicts

**Problem:** New descriptors appear in wrong order in descriptions.
**Solution:** Adjust position in descriptorOrder array. Remember the array order determines the order descriptors appear in formatted text.

### Issue 3: Missing Descriptor Values

**Problem:** New descriptors don't show values in descriptions.
**Solution:** Ensure the descriptor value key is added to descriptorValueKeys array and matches the property name in the component data.

## Rollback Plan

If issues arise after deployment:

1. Restore from backup:

```bash
cp default.json.backup-$(date +%Y%m%d) default.json
```

2. Restart the application
3. Verify original functionality is restored

## Completion Checklist

- [ ] Configuration file backed up
- [ ] descriptionOrder updated with body_composition and body_hair
- [ ] descriptorOrder updated with all four new descriptors
- [ ] descriptorValueKeys updated with composition, density, and projection
- [ ] JSON validation passing
- [ ] Configuration loads without errors
- [ ] No regression in existing functionality
- [ ] Validation script created and passing
- [ ] Documentation updated

## Next Steps

After completing this configuration update:

- NEWDESC-02: Implement body composition extraction method
- NEWDESC-03: Implement body hair extraction method
- NEWDESC-04: Update composeDescription method to use new configuration

## Notes for Implementer

- The order in descriptionOrder affects the visual flow of the generated description
- The order in descriptorOrder affects how descriptors are combined when multiple apply to the same part
- Body-level descriptors (body_composition, body_hair) require special handling in the code (see NEWDESC-02 and NEWDESC-03)
- Part-level descriptors (facial_hair, projection) are automatically handled by existing code
- Always test with actual game entities after configuration changes
