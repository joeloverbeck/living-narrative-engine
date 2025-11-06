# Body Descriptor Validator Reference

Complete API reference for the Body Descriptor Validator and validation CLI tool.

## Overview

The Body Descriptor Validator ensures consistency across the body descriptor system by validating:

1. **Recipe descriptors** against the centralized registry
2. **Formatting configuration** completeness
3. **System-wide consistency** across schema, code, and config

## Table of Contents

- [BodyDescriptorValidator Class](#bodydescriptorvalidator-class)
- [CLI Tool](#cli-tool)
- [Validation Results](#validation-results)
- [Integration](#integration)
- [Examples](#examples)

## BodyDescriptorValidator Class

### Location

**File**: `src/anatomy/validators/bodyDescriptorValidator.js`

### Constructor

```javascript
new BodyDescriptorValidator(options)
```

**Parameters**:

- `options` (object, optional): Configuration options
  - `logger` (object, optional): Logger instance (reserved for future use)

**Example**:

```javascript
import { BodyDescriptorValidator } from './validators/bodyDescriptorValidator.js';

const validator = new BodyDescriptorValidator({
  logger: console, // Optional, reserved for future logging
});
```

### Methods

#### validateRecipeDescriptors()

Validates recipe body descriptors against the registry.

```javascript
validateRecipeDescriptors(bodyDescriptors)
```

**Parameters**:

- `bodyDescriptors` (object): Body descriptors object from an anatomy recipe

**Returns**: `{valid: boolean, errors: string[], warnings: string[]}`

- `valid` (boolean): `true` if no errors, `false` if any errors found
- `errors` (string[]): Array of error messages (validation failures)
- `warnings` (string[]): Array of warning messages (unknown descriptors)

**Validation Rules**:

1. **Unknown Descriptors**: Descriptors not in registry generate warnings
2. **Invalid Values**: Values not in `validValues` array generate errors
3. **Free-form Descriptors**: Descriptors with `validValues: null` accept any string

**Example**:

```javascript
const bodyDescriptors = {
  build: 'athletic',
  skinColor: 'olive',
  posture: 'upright', // Unknown descriptor
};

const result = validator.validateRecipeDescriptors(bodyDescriptors);

console.log(result);
// {
//   valid: true,
//   errors: [],
//   warnings: ["Unknown body descriptor 'posture' (not in registry)"]
// }
```

**Error Example**:

```javascript
const bodyDescriptors = {
  build: 'super-muscular', // Invalid value
};

const result = validator.validateRecipeDescriptors(bodyDescriptors);

console.log(result);
// {
//   valid: false,
//   errors: [
//     "Invalid value 'super-muscular' for build. Expected one of: skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky"
//   ],
//   warnings: []
// }
```

#### validateFormattingConfig()

Validates formatting configuration against the registry.

```javascript
validateFormattingConfig(formattingConfig)
```

**Parameters**:

- `formattingConfig` (object): Formatting configuration object with `descriptionOrder` array

**Returns**: `{valid: boolean, errors: string[], warnings: string[]}`

**Validation Rules**:

1. **Missing descriptionOrder**: Configuration must have `descriptionOrder` property
2. **Missing Descriptors**: Registry descriptors not in `descriptionOrder` generate warnings

**Example**:

```javascript
const formattingConfig = {
  descriptionOrder: [
    'height',
    'skin_color',
    'build',
    'body_composition',
    'body_hair',
    // Missing 'smell'
  ],
};

const result = validator.validateFormattingConfig(formattingConfig);

console.log(result);
// {
//   valid: true,
//   errors: [],
//   warnings: [
//     "Body descriptor 'smell' defined in registry but missing from descriptionOrder. Descriptor will not appear in generated descriptions."
//   ]
// }
```

**Error Example**:

```javascript
const formattingConfig = {}; // Missing descriptionOrder

const result = validator.validateFormattingConfig(formattingConfig);

console.log(result);
// {
//   valid: false,
//   errors: ['Formatting config missing descriptionOrder'],
//   warnings: []
// }
```

#### validateSystemConsistency()

Comprehensive validation of the entire body descriptor system.

```javascript
async validateSystemConsistency(options)
```

**Parameters**:

- `options` (object): Validation options
  - `dataRegistry` (object): DataRegistry instance for loading configuration and recipes

**Returns**: `Promise<{errors: string[], warnings: string[], info: string[]}>`

- `errors` (string[]): Critical validation failures
- `warnings` (string[]): Non-critical issues
- `info` (string[]): Informational messages about the system state

**Validation Steps**:

1. Validates formatting configuration
2. Loads and validates sample recipes (`anatomy:human_male`, `anatomy:human_female`)
3. Reports registered descriptor count
4. Lists all registered descriptors

**Example**:

```javascript
const result = await validator.validateSystemConsistency({
  dataRegistry: myDataRegistry,
});

console.log(result);
// {
//   errors: [],
//   warnings: [],
//   info: [
//     "Total registered descriptors: 6",
//     "Registered: height, skinColor, build, composition, hairDensity, smell"
//   ]
// }
```

## CLI Tool

### Location

**File**: `scripts/validate-body-descriptors.js`

### Usage

```bash
npm run validate:body-descriptors
```

### Features

The CLI tool provides:

1. **Registry Check**: Lists all registered descriptors
2. **Formatting Validation**: Validates formatting configuration
3. **Recipe Validation**: Checks sample recipes
4. **Clear Output**: Color-coded results with emojis
5. **Exit Codes**: Returns 0 on success, 1 on failure (CI-friendly)

### Output Format

#### Success Output

```
🔍 Body Descriptor System Validation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Checking Registry...
   Found 6 registered descriptors
   height, skinColor, build, composition, hairDensity, smell

📄 Validating Formatting Configuration...
   ✅ Formatting configuration is valid

🧬 Validating Anatomy Recipes...
   ✅ human_male.recipe.json
   ✅ human_female.recipe.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Validation Passed

Body descriptor system is consistent.
```

#### Error Output

```
🔍 Body Descriptor System Validation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Checking Registry...
   Found 6 registered descriptors
   height, skinColor, build, composition, hairDensity, smell

📄 Validating Formatting Configuration...

⚠️  Warnings:
   Body descriptor 'smell' defined in registry but missing from descriptionOrder. Descriptor will not appear in generated descriptions.

🧬 Validating Anatomy Recipes...
   ✅ human_male.recipe.json
   ✅ human_female.recipe.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ Validation Failed

Fix the errors above and run validation again.
See data/mods/anatomy/anatomy-formatting/default.json
```

### Exit Codes

- **0**: Validation passed, no errors
- **1**: Validation failed, errors found or unexpected exception

### CI/CD Integration

Add to GitHub Actions workflow:

```yaml
name: CI

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - name: Validate Body Descriptors
        run: npm run validate:body-descriptors
```

## Validation Results

### Result Structure

All validation methods return objects with this structure:

```typescript
interface ValidationResult {
  valid: boolean;      // Overall validation status
  errors: string[];    // Critical failures (must fix)
  warnings: string[];  // Non-critical issues (should fix)
  info?: string[];     // Informational messages (validateSystemConsistency only)
}
```

### Interpreting Results

#### Errors vs Warnings

**Errors** (Critical):
- Invalid descriptor values
- Missing required configuration
- Schema mismatches
- **Must be fixed** before deployment

**Warnings** (Non-Critical):
- Unknown descriptors in recipes
- Descriptors missing from formatting config
- **Should be reviewed** but won't break the system

**Info** (Informational):
- Registry statistics
- Descriptor lists
- System state information

### Common Validation Messages

#### Errors

```
"Invalid value 'X' for Y. Expected one of: ..."
→ Recipe uses a value not in the descriptor's validValues array
→ Fix: Use only valid values from the registry

"Formatting config missing descriptionOrder"
→ Formatting configuration lacks required descriptionOrder property
→ Fix: Add descriptionOrder array to formatting config

"Unknown descriptor: X"
→ Descriptor name not found in registry
→ Fix: Add descriptor to registry or remove from recipe
```

#### Warnings

```
"Unknown body descriptor 'X' (not in registry)"
→ Recipe uses a descriptor not defined in the registry
→ Fix: Add descriptor to registry or remove from recipe

"Body descriptor 'X' defined in registry but missing from descriptionOrder"
→ Descriptor won't appear in generated descriptions
→ Fix: Add displayKey to descriptionOrder array
```

## Integration

### Bootstrap Integration

Validate during application startup:

```javascript
import { BodyDescriptorValidator } from './anatomy/validators/bodyDescriptorValidator.js';

async function bootstrapApplication() {
  const validator = new BodyDescriptorValidator({ logger: console });

  // Validate system consistency
  const result = await validator.validateSystemConsistency({
    dataRegistry: myDataRegistry,
  });

  // Log warnings
  result.warnings.forEach(warn => console.warn(warn));

  // Fail fast on errors
  if (result.errors.length > 0) {
    result.errors.forEach(err => console.error(err));
    throw new Error('Body descriptor system validation failed');
  }

  console.log('✅ Body descriptor system validated');
}
```

### Recipe Validation

Validate recipes before loading:

```javascript
function loadRecipe(recipeData) {
  const validator = new BodyDescriptorValidator();

  if (recipeData.bodyDescriptors) {
    const result = validator.validateRecipeDescriptors(recipeData.bodyDescriptors);

    if (!result.valid) {
      throw new Error(
        `Recipe validation failed: ${result.errors.join(', ')}`
      );
    }

    // Log warnings
    result.warnings.forEach(warn => console.warn(warn));
  }

  // Proceed with recipe loading
  return processRecipe(recipeData);
}
```

### Testing Integration

Use validator in test suites:

```javascript
import { describe, it, expect } from '@jest/globals';
import { BodyDescriptorValidator } from '../src/anatomy/validators/bodyDescriptorValidator.js';

describe('Recipe Validation', () => {
  let validator;

  beforeEach(() => {
    validator = new BodyDescriptorValidator();
  });

  it('should validate valid recipe descriptors', () => {
    const bodyDescriptors = {
      build: 'athletic',
      composition: 'lean',
    };

    const result = validator.validateRecipeDescriptors(bodyDescriptors);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid descriptor values', () => {
    const bodyDescriptors = {
      build: 'invalid-value',
    };

    const result = validator.validateRecipeDesciptors(bodyDescriptors);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Invalid value');
  });
});
```

## Examples

### Example 1: Validating a Recipe

```javascript
import { BodyDescriptorValidator } from './validators/bodyDescriptorValidator.js';

const validator = new BodyDescriptorValidator();

const recipe = {
  recipeId: 'mymod:warrior',
  bodyDescriptors: {
    build: 'muscular',
    composition: 'lean',
    skinColor: 'tanned',
  },
};

const result = validator.validateRecipeDescriptors(recipe.bodyDescriptors);

if (result.valid) {
  console.log('✅ Recipe is valid');
} else {
  console.error('❌ Recipe validation failed:');
  result.errors.forEach(err => console.error(`  - ${err}`));
}

if (result.warnings.length > 0) {
  console.warn('⚠️  Warnings:');
  result.warnings.forEach(warn => console.warn(`  - ${warn}`));
}
```

### Example 2: Validating Formatting Config

```javascript
import { BodyDescriptorValidator } from './validators/bodyDescriptorValidator.js';
import fs from 'fs';

const validator = new BodyDescriptorValidator();

// Load formatting config
const configPath = 'data/mods/anatomy/anatomy-formatting/default.json';
const formattingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Validate
const result = validator.validateFormattingConfig(formattingConfig);

if (!result.valid) {
  console.error('❌ Formatting config validation failed:');
  result.errors.forEach(err => console.error(`  - ${err}`));
  process.exit(1);
}

if (result.warnings.length > 0) {
  console.warn('⚠️  Configuration warnings:');
  result.warnings.forEach(warn => console.warn(`  - ${warn}`));
}

console.log('✅ Formatting configuration is valid');
```

### Example 3: System-Wide Validation

```javascript
import { BodyDescriptorValidator } from './validators/bodyDescriptorValidator.js';

async function validateSystem(dataRegistry) {
  const validator = new BodyDescriptorValidator({ logger: console });

  console.log('🔍 Validating body descriptor system...\n');

  const result = await validator.validateSystemConsistency({ dataRegistry });

  // Report info
  result.info.forEach(msg => console.log(`ℹ️  ${msg}`));

  // Report warnings
  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Warnings:');
    result.warnings.forEach(warn => console.warn(`  - ${warn}`));
  }

  // Report errors
  if (result.errors.length > 0) {
    console.error('\n❌ Errors:');
    result.errors.forEach(err => console.error(`  - ${err}`));
    return false;
  }

  console.log('\n✅ System validation passed');
  return true;
}

// Usage
const isValid = await validateSystem(myDataRegistry);
if (!isValid) {
  process.exit(1);
}
```

### Example 4: Pre-commit Hook

Create a pre-commit hook to validate descriptors:

**File**: `.git/hooks/pre-commit`

```bash
#!/bin/bash

echo "Validating body descriptor system..."

npm run validate:body-descriptors

if [ $? -ne 0 ]; then
  echo "❌ Body descriptor validation failed"
  echo "Fix the errors and try again"
  exit 1
fi

echo "✅ Body descriptor validation passed"
```

Make executable:

```bash
chmod +x .git/hooks/pre-commit
```

## Advanced Usage

### Custom Validation Rules

Extend the validator for custom rules:

```javascript
import { BodyDescriptorValidator } from './validators/bodyDescriptorValidator.js';

class CustomBodyDescriptorValidator extends BodyDescriptorValidator {
  validateRecipeDescriptors(bodyDescriptors) {
    // Call parent validation
    const result = super.validateRecipeDescriptors(bodyDescriptors);

    // Add custom validation
    if (bodyDescriptors.build === 'muscular' && bodyDescriptors.composition === 'underweight') {
      result.warnings.push(
        'Unusual combination: muscular build with underweight composition'
      );
    }

    return result;
  }
}
```

### Validation in Development Mode

Enable verbose validation during development:

```javascript
class VerboseBodyDescriptorValidator extends BodyDescriptorValidator {
  validateRecipeDescriptors(bodyDescriptors) {
    console.log('Validating descriptors:', Object.keys(bodyDescriptors));

    const result = super.validateRecipeDescriptors(bodyDescriptors);

    console.log('Validation result:', {
      valid: result.valid,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
    });

    return result;
  }
}
```

### Batch Recipe Validation

Validate multiple recipes:

```javascript
import { BodyDescriptorValidator } from './validators/bodyDescriptorValidator.js';
import fs from 'fs';
import path from 'path';

const validator = new BodyDescriptorValidator();
const recipesDir = 'data/mods/mymod/recipes';

// Load all recipes
const recipeFiles = fs.readdirSync(recipesDir).filter(f => f.endsWith('.json'));

let totalErrors = 0;
let totalWarnings = 0;

recipeFiles.forEach(file => {
  const recipePath = path.join(recipesDir, file);
  const recipe = JSON.parse(fs.readFileSync(recipePath, 'utf-8'));

  if (recipe.bodyDescriptors) {
    const result = validator.validateRecipeDescriptors(recipe.bodyDescriptors);

    if (!result.valid || result.warnings.length > 0) {
      console.log(`\n${file}:`);

      result.errors.forEach(err => {
        console.error(`  ❌ ${err}`);
        totalErrors++;
      });

      result.warnings.forEach(warn => {
        console.warn(`  ⚠️  ${warn}`);
        totalWarnings++;
      });
    }
  }
});

console.log(`\nTotal: ${totalErrors} errors, ${totalWarnings} warnings`);
```

## See Also

- [Body Descriptor Registry](./body-descriptor-registry.md) - Registry architecture and API
- [Adding Body Descriptors Guide](./adding-body-descriptors.md) - Step-by-step guide
- [Anatomy System Architecture](./architecture.md) - Overall architecture
- [Body Descriptors Technical Guide](../development/body-descriptors-technical.md) - Technical details
- [Body Descriptor Migration Guide](../migration/body-descriptor-migration.md) - Migration patterns
