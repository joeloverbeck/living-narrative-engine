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
import { createValidationContext, RecipePreflightValidator } from '../src/anatomy/validation/index.js';

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
      const context = await createValidationContext();

      const validator = new RecipePreflightValidator(context);

      const results = [];

      for (const recipePath of recipes) {
        console.log(chalk.blue(`\n✓ Validating ${recipePath}...`));

        const recipe = await loadRecipeFile(recipePath);
        const report = validator.validate(recipe, {
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

```javascript
/**
 * Creates minimal validation context without full app
 */
async function createValidationContext() {
  // Load only what's needed for validation
  const componentRegistry = await loadComponentRegistry();
  const entityRegistry = await loadEntityRegistry();
  const blueprintRegistry = await loadBlueprintRegistry();
  const ajv = createAjvInstance();

  return {
    componentRegistry,
    entityRegistry,
    blueprintRegistry,
    ajv,
    logger: createConsoleLogger(),
  };
}
```

## File Structure

```
scripts/
└── validate-recipe.js                # CLI tool

src/anatomy/validation/
└── validationContext.js              # Minimal context creation

package.json                          # Add npm script
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
- ANASYSIMP-003 (Pre-flight Validator) - MUST be complete
- ANASYSIMP-008 (Report Generator) - for report formatting
- commander (npm package for CLI)
- chalk (npm package for colors)

**Blocks:** None (terminal feature)

## Success Metrics

- **Speed:** <5 seconds per recipe validation
- **Adoption:** >70% of recipe creators use CLI
- **Time Savings:** 2-3 minutes per validation (vs full app load)

## References

- **Report Section:** Recommendation 2.1
- **Report Pages:** Lines 670-717
- **Example Output:** Appendix C (lines 1759-1836)
