# BODDESROB-007: Create CLI Validation Tool for Body Descriptors

**Status**: TODO
**Priority**: HIGH
**Phase**: 4 (Developer Tools)
**Estimated Effort**: 0.5 days
**Dependencies**: BODDESROB-001, BODDESROB-002

## Overview

Create a command-line validation tool that developers can run to check body descriptor system consistency. This tool provides on-demand validation outside of the bootstrap process and can be integrated into CI/CD pipelines.

## Problem Context

While bootstrap validation catches issues at startup, developers need:
- Manual validation capability without running the full application
- CI/CD integration for automated checks
- Detailed validation reports for debugging
- Quick way to verify changes before committing

A CLI tool provides these capabilities and complements the bootstrap validation.

## Acceptance Criteria

- [ ] Script created at `scripts/validate-body-descriptors.js`
- [ ] NPM script added: `npm run validate:body-descriptors`
- [ ] Tool performs comprehensive validation:
  - Formatting config consistency
  - Sample recipe validation
  - Registry integrity checks
- [ ] Clear console output with:
  - ✅ Success indicators
  - ❌ Error markers
  - ⚠️  Warning symbols
  - ℹ️  Info messages
- [ ] Detailed validation report
- [ ] Exit code 0 for success, 1 for errors
- [ ] Works independently (no app startup needed)
- [ ] Fast execution (< 2 seconds)
- [ ] Documentation in README.md

## Technical Details

### Script Implementation

```javascript
#!/usr/bin/env node

/**
 * @file Body Descriptor System Validation CLI Tool
 * Validates consistency of body descriptor configuration across the system
 *
 * Usage: npm run validate:body-descriptors
 */

import { BodyDescriptorValidator } from '../src/anatomy/validators/bodyDescriptorValidator.js';
import { getAllDescriptorNames } from '../src/anatomy/registries/bodyDescriptorRegistry.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock console logger for validator
const logger = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  warn: (msg) => console.warn(`⚠️  ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  debug: () => {}, // Silent debug
};

/**
 * Load formatting configuration
 */
function loadFormattingConfig() {
  const configPath = path.join(
    __dirname,
    '../data/mods/anatomy/anatomy-formatting/default.json'
  );

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`❌ Failed to load formatting config: ${err.message}`);
    return null;
  }
}

/**
 * Load anatomy recipe
 */
function loadRecipe(recipeFile) {
  const recipePath = path.join(
    __dirname,
    '../data/mods/anatomy/recipes',
    recipeFile
  );

  try {
    const content = fs.readFileSync(recipePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.warn(`⚠️  Failed to load recipe ${recipeFile}: ${err.message}`);
    return null;
  }
}

/**
 * Main validation function
 */
async function main() {
  console.log('\n🔍 Body Descriptor System Validation\n');
  console.log('━'.repeat(60));

  const validator = new BodyDescriptorValidator({ logger });
  let hasErrors = false;

  // 1. Validate Registry
  console.log('\n📋 Checking Registry...');
  const registeredDescriptors = getAllDescriptorNames();
  console.log(`   Found ${registeredDescriptors.length} registered descriptors`);
  console.log(`   ${registeredDescriptors.join(', ')}`);

  // 2. Validate Formatting Config
  console.log('\n📄 Validating Formatting Configuration...');
  const formattingConfig = loadFormattingConfig();

  if (formattingConfig) {
    const configResult = validator.validateFormattingConfig(formattingConfig);

    if (configResult.errors.length > 0) {
      hasErrors = true;
      console.log('\n❌ Errors:');
      configResult.errors.forEach(err => console.log(`   ${err}`));
    }

    if (configResult.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      configResult.warnings.forEach(warn => console.log(`   ${warn}`));
    }

    if (configResult.errors.length === 0 && configResult.warnings.length === 0) {
      console.log('   ✅ Formatting configuration is valid');
    }
  } else {
    hasErrors = true;
  }

  // 3. Validate Sample Recipes
  console.log('\n🧬 Validating Anatomy Recipes...');
  const sampleRecipes = ['human_male.recipe.json', 'human_female.recipe.json'];

  for (const recipeFile of sampleRecipes) {
    const recipe = loadRecipe(recipeFile);
    if (recipe?.bodyDescriptors) {
      const recipeResult = validator.validateRecipeDescriptors(recipe.bodyDescriptors);

      if (recipeResult.errors.length > 0) {
        hasErrors = true;
        console.log(`\n   ❌ ${recipeFile}:`);
        recipeResult.errors.forEach(err => console.log(`      ${err}`));
      }

      if (recipeResult.warnings.length > 0) {
        console.log(`\n   ⚠️  ${recipeFile}:`);
        recipeResult.warnings.forEach(warn => console.log(`      ${warn}`));
      }

      if (recipeResult.errors.length === 0 && recipeResult.warnings.length === 0) {
        console.log(`   ✅ ${recipeFile}`);
      }
    }
  }

  // 4. Summary
  console.log('\n' + '━'.repeat(60));

  if (hasErrors) {
    console.log('\n❌ Validation Failed\n');
    console.log('Fix the errors above and run validation again.');
    console.log('See data/mods/anatomy/anatomy-formatting/default.json\n');
    process.exit(1);
  } else {
    console.log('\n✅ Validation Passed\n');
    console.log('Body descriptor system is consistent.\n');
    process.exit(0);
  }
}

// Run validation
main().catch(err => {
  console.error('\n❌ Unexpected error during validation:');
  console.error(err);
  process.exit(1);
});
```

### NPM Script Configuration

Add to `package.json`:

```json
{
  "scripts": {
    "validate:body-descriptors": "node scripts/validate-body-descriptors.js"
  }
}
```

### Implementation Steps

1. **Create Script File**
   - Create `scripts/validate-body-descriptors.js`
   - Add shebang and imports
   - Implement validation logic

2. **Add Helper Functions**
   - `loadFormattingConfig()` - Load config file
   - `loadRecipe()` - Load recipe file
   - Console formatting helpers

3. **Implement Main Function**
   - Create validator instance
   - Validate registry
   - Validate formatting config
   - Validate sample recipes
   - Output results

4. **Add NPM Script**
   - Update package.json
   - Test script execution

5. **Test Tool**
   - Test with valid configuration
   - Test with missing descriptors
   - Test with invalid recipes
   - Verify exit codes

## Files to Create

- `scripts/validate-body-descriptors.js` (NEW)
  - CLI validation tool implementation

## Files to Modify

- `package.json` (MODIFY)
  - Add `validate:body-descriptors` script

- `README.md` (MODIFY)
  - Document validation tool usage

## Testing Requirements

### Manual Testing

Test scenarios:
1. **Valid System**
   - Run with all descriptors properly configured
   - Should exit with code 0
   - Should show all green checkmarks

2. **Missing Descriptor**
   - Remove descriptor from formatting config
   - Should show warning
   - Should exit with code 0 (warnings don't fail)

3. **Invalid Recipe**
   - Create recipe with invalid descriptor value
   - Should show error
   - Should exit with code 1

4. **Missing Config**
   - Temporarily rename config file
   - Should show error
   - Should exit with code 1

### Integration with CI/CD

Test in CI environment:
```bash
npm run validate:body-descriptors
if [ $? -ne 0 ]; then
  echo "Body descriptor validation failed"
  exit 1
fi
```

## Success Criteria

- [ ] Script executes successfully
- [ ] NPM script `validate:body-descriptors` works
- [ ] Clear, readable output
- [ ] Correct exit codes (0 = success, 1 = failure)
- [ ] Works without full app startup
- [ ] Execution time < 2 seconds
- [ ] All validation checks implemented
- [ ] Documentation in README.md
- [ ] Can be integrated into CI/CD

## Example Output

### Successful Validation

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

### Failed Validation

```
🔍 Body Descriptor System Validation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Checking Registry...
   Found 6 registered descriptors
   height, skinColor, build, composition, hairDensity, smell

📄 Validating Formatting Configuration...

⚠️  Warnings:
   Body descriptor 'skin_color' defined in registry but missing from descriptionOrder. Descriptor will not appear in generated descriptions.
   Body descriptor 'smell' defined in registry but missing from descriptionOrder. Descriptor will not appear in generated descriptions.

🧬 Validating Anatomy Recipes...
   ✅ human_male.recipe.json

   ❌ human_female.recipe.json:
      Invalid value 'super-tall' for height. Expected one of: gigantic, very-tall, tall, average, short, petite, tiny

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ Validation Failed

Fix the errors above and run validation again.
See data/mods/anatomy/anatomy-formatting/default.json
```

## Related Tickets

- Depends on: BODDESROB-001 (Centralized Registry)
- Depends on: BODDESROB-002 (Enhanced Validator)
- Related to: BODDESROB-004 (Bootstrap Validation)
- Related to: BODDESROB-010 (Pre-commit Hook)
- Related to: Spec Section 4.4 "Phase 4: Developer Tools"

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Validate Body Descriptors
  run: npm run validate:body-descriptors
```

### Pre-push Hook Example

```bash
#!/bin/bash
echo "Running body descriptor validation..."
npm run validate:body-descriptors
exit $?
```

## Notes

- Keep tool simple and focused
- Fast execution is important
- Clear, actionable output
- Don't require full app initialization
- Consider adding verbose mode flag
- Consider adding JSON output mode for CI tools
- Document all error codes
- Make errors easy to fix with clear guidance
