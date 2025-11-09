# ANASYSIMP-009: Recipe Validation CLI Tool

**Phase:** 1 (Quick Wins)
**Priority:** P1
**Effort:** Medium (4-5 days)
**Impact:** High - Enables fast validation iteration
**Status:** Not Started

## Context

Currently, recipes can only be validated by loading the entire application. This creates a slow feedback loop that hinders rapid iteration during recipe development.

## Problem Statement

Recipe validation requires:
- Full application build and load
- Browser navigation to anatomy visualizer
- Manual generation attempt
- Console log inspection

This process takes 2-3 minutes per validation attempt.

## Solution Overview

Create standalone CLI validator that validates recipes without full app load, providing fast feedback (<5 seconds) with comprehensive reports.

## Implementation Details

### Important Notes on Context Loading

**CRITICAL DECISION POINT:** The initial implementation creates an **empty registry context**. This provides ultra-fast validation (<1 second) but will report ALL component/blueprint references as missing.

**Two possible approaches:**

#### Approach A: Empty Registry (Fastest - Initial Implementation)
- Validates: Recipe structure, schema compliance, property types
- Reports as errors: All component references, blueprint references
- Speed: <1 second per recipe
- Use case: Quick syntax/structure validation during development

#### Approach B: Full Mod Loading (Most Accurate - Future Enhancement)
- Load minimal mod data (components, blueprints) into registry
- Validates: Everything including actual component/blueprint existence
- Speed: ~3-5 seconds (still faster than full app load)
- Use case: Pre-commit validation, CI/CD pipelines

**Recommendation for Phase 1:** Start with Approach A (empty registry) and add a `--load-mods` flag later for Approach B.

The workflow assumes **Approach B** will be the final implementation. If starting with Approach A, the acceptance criteria should be adjusted to focus on structural validation only.

### CLI Tool Structure

```bash
# Basic usage
npm run validate:recipe data/mods/anatomy/recipes/red_dragon.recipe.json

# Multiple recipes
npm run validate:recipe data/mods/anatomy/recipes/*.recipe.json

# Verbose output
npm run validate:recipe --verbose red_dragon.recipe.json

# JSON output
npm run validate:recipe --json red_dragon.recipe.json

# Generate report file
npm run validate:recipe --report red_dragon.recipe.json
```

### Core Script

```javascript
#!/usr/bin/env node

/**
 * Recipe Validation CLI Tool
 * Validates anatomy recipes without full app load
 */

import { program } from 'commander';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import RecipePreflightValidator from '../src/anatomy/validation/RecipePreflightValidator.js';
import InMemoryDataRegistry from '../src/data/inMemoryDataRegistry.js';
import AnatomyBlueprintRepository from '../src/anatomy/repositories/anatomyBlueprintRepository.js';
import AjvSchemaValidator from '../src/validation/ajvSchemaValidator.js';
import SlotGenerator from '../src/anatomy/slotGenerator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load a recipe file from disk
 * @param {string} recipePath - Path to recipe file
 * @returns {Promise<object>} Recipe object
 */
async function loadRecipeFile(recipePath) {
  const absolutePath = path.isAbsolute(recipePath)
    ? recipePath
    : path.resolve(process.cwd(), recipePath);

  const content = await fs.readFile(absolutePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Creates minimal validation context without full app load
 * Loads only the registries and services needed for validation
 * @returns {Promise<object>} Validation dependencies
 */
async function createMinimalContext() {
  const logger = {
    info: (msg) => console.log(msg),
    warn: (msg) => console.warn(msg),
    error: (msg, err) => console.error(msg, err),
    debug: () => {}, // Silent in CLI mode
  };

  // Create data registry
  const dataRegistry = new InMemoryDataRegistry({ logger });

  // Create anatomy blueprint repository
  const anatomyBlueprintRepository = new AnatomyBlueprintRepository({
    logger,
    dataRegistry,
  });

  // Create schema validator
  const schemaValidator = new AjvSchemaValidator({ logger });

  // Create slot generator
  const slotGenerator = new SlotGenerator({ logger });

  return {
    dataRegistry,
    anatomyBlueprintRepository,
    schemaValidator,
    slotGenerator,
    logger,
  };
}

program
  .name('validate-recipe')
  .description('Validate anatomy recipes')
  .argument('[recipes...]', 'Recipe files to validate')
  .option('-v, --verbose', 'Verbose output')
  .option('-j, --json', 'JSON output')
  .option('-r, --report <file>', 'Generate report file')
  .option('--fail-fast', 'Stop on first error')
  .action(async (recipes, options) => {
    try {
      // Load minimal context (registries only)
      const context = await createMinimalContext();

      const validator = new RecipePreflightValidator(context);

      const results = [];

      for (const recipePath of recipes) {
        console.log(chalk.blue(`\n✓ Validating ${recipePath}...`));

        const recipe = await loadRecipeFile(recipePath);
        const report = await validator.validate(recipe, {
          recipePath,
          failFast: options.failFast
        });

        results.push(report);

        if (options.json) {
          console.log(JSON.stringify(report.toJSON(), null, 2));
        } else {
          console.log(report.toString());
        }

        if (!report.isValid && options.failFast) {
          process.exit(1);
        }
      }

      // Summary
      const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
      const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

      if (totalErrors > 0) {
        console.log(chalk.red(`\n❌ Validation FAILED: ${totalErrors} error(s), ${totalWarnings} warning(s)`));
        process.exit(1);
      } else {
        console.log(chalk.green(`\n✅ Validation PASSED: ${results.length} recipe(s) valid`));
        process.exit(0);
      }

    } catch (error) {
      console.error(chalk.red(`\n❌ Validation Error: ${error.message}`));
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program.parse();
```

### Minimal Context Loading

The CLI tool creates a minimal validation context by instantiating only the required services:

1. **InMemoryDataRegistry** - For storing and retrieving component/entity definitions
2. **AnatomyBlueprintRepository** - For accessing blueprint and recipe data
3. **AjvSchemaValidator** - For JSON schema validation
4. **SlotGenerator** - For slot key extraction and validation
5. **Simple console logger** - For output (no file logging)

This approach avoids loading the full application (no mod loader, no world state, no event bus) while still providing all functionality needed for validation.

The `createMinimalContext()` function (shown in the Core Script above) handles this initialization.

## File Structure

```
scripts/
└── validate-recipe.js                # CLI tool (includes context creation)

package.json                          # Add npm script & commander dependency

# Existing files used by CLI (no changes needed):
src/anatomy/validation/
├── RecipePreflightValidator.js       # Main validator
├── ValidationReport.js               # Report structure
├── ReportFormatter.js                # Multiple output formats
└── rules/                            # Validation rules (used internally)

src/data/
└── inMemoryDataRegistry.js           # Data storage

src/anatomy/repositories/
└── anatomyBlueprintRepository.js     # Blueprint access

src/validation/
└── ajvSchemaValidator.js             # Schema validation

src/anatomy/
└── slotGenerator.js                  # Slot utilities
```

## Acceptance Criteria

- [ ] CLI validates recipes without full app load
- [ ] Validation completes in <5 seconds
- [ ] Supports single and multiple recipe validation
- [ ] Provides formatted console output
- [ ] Supports JSON output for tooling
- [ ] Supports verbose mode
- [ ] Supports fail-fast mode
- [ ] Exit code 0 for success, 1 for failure
- [ ] Colored output with symbols
- [ ] Summary statistics for batch validation

## Testing Requirements

### Integration Tests

1. **CLI Execution**
   - Valid recipe → exit code 0
   - Invalid recipe → exit code 1
   - Multiple recipes → correct summary
   - JSON output → valid JSON
   - Verbose mode → includes stack traces

2. **Performance**
   - Single recipe validation <5 seconds
   - Batch validation <2 seconds per recipe

## Dependencies

**Required:**
- ANASYSIMP-003 (Pre-flight Validator) - ✅ COMPLETE (RecipePreflightValidator exists)
- ANASYSIMP-008 (Report Generator) - ✅ COMPLETE (ValidationReport & ReportFormatter exist)
- commander (npm package for CLI) - ⚠️ NEEDS INSTALLATION
- chalk (npm package for colors) - ✅ ALREADY INSTALLED (v5.6.0)

**Existing Infrastructure Used:**
- RecipePreflightValidator (src/anatomy/validation/RecipePreflightValidator.js)
- ValidationReport (src/anatomy/validation/ValidationReport.js)
- ReportFormatter (src/anatomy/validation/ReportFormatter.js)
- InMemoryDataRegistry (src/data/inMemoryDataRegistry.js)
- AnatomyBlueprintRepository (src/anatomy/repositories/anatomyBlueprintRepository.js)
- AjvSchemaValidator (src/validation/ajvSchemaValidator.js)
- SlotGenerator (src/anatomy/slotGenerator.js)

**Installation Required:**
```bash
npm install commander
```

**Blocks:** None (terminal feature)

## Success Metrics

- **Speed:** <5 seconds per recipe validation
- **Adoption:** >70% of recipe creators use CLI
- **Time Savings:** 2-3 minutes per validation (vs full app load)

## Implementation Path

### Phase 1: Core CLI Tool (Approach A)
1. Install commander: `npm install commander`
2. Create `scripts/validate-recipe.js` with the code shown above
3. Add npm script to `package.json`: `"validate:recipe": "node scripts/validate-recipe.js"`
4. Test with example recipe (will show all references as missing - expected)
5. Verify CLI options work (--json, --verbose, --fail-fast)

### Phase 2: Mod Loading Support (Approach B)
1. Add mod loading helper function to script
2. Add `--load-mods` flag to CLI
3. Load components and blueprints into registry when flag is present
4. Test full validation against real mods
5. Update documentation with both modes

### Phase 3: Optimizations
1. Cache loaded mod data for repeated validations
2. Add parallel validation for multiple recipes
3. Generate HTML reports (using ReportFormatter)
4. Add recipe fixing suggestions (using FixableIssueDetector)

## References

- **Report Section:** Recommendation 2.1
- **Report Pages:** Lines 670-717
- **Example Output:** Appendix C (lines 1759-1836)
- **Key Files Referenced:**
  - RecipePreflightValidator: src/anatomy/validation/RecipePreflightValidator.js
  - ValidationReport: src/anatomy/validation/ValidationReport.js
  - Integration Tests: tests/integration/anatomy/validation/recipePreflightValidation.integration.test.js
