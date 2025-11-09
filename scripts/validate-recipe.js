#!/usr/bin/env node

/**
 * @file Recipe Validation CLI Tool
 * Validates anatomy recipes without full app load
 *
 * Usage:
 *   npm run validate:recipe data/mods/anatomy/recipes/red_dragon.recipe.json
 *   npm run validate:recipe data/mods/anatomy/recipes/*.recipe.json
 *   npm run validate:recipe --verbose red_dragon.recipe.json
 *   npm run validate:recipe --json red_dragon.recipe.json
 */

import { program } from 'commander';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';
import RecipePreflightValidator from '../src/anatomy/validation/RecipePreflightValidator.js';
import InMemoryDataRegistry from '../src/data/inMemoryDataRegistry.js';
import AnatomyBlueprintRepository from '../src/anatomy/repositories/anatomyBlueprintRepository.js';
import AjvSchemaValidator from '../src/validation/ajvSchemaValidator.js';
import SlotGenerator from '../src/anatomy/slotGenerator.js';

/**
 * Load a recipe file from disk
 *
 * @param {string} recipePath - Path to recipe file
 * @returns {Promise<object>} Recipe object
 */
async function loadRecipeFile(recipePath) {
  const absolutePath = path.isAbsolute(recipePath)
    ? recipePath
    : path.resolve(process.cwd(), recipePath);

  try {
    const content = await fs.readFile(absolutePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load recipe file '${recipePath}': ${error.message}`);
  }
}

/**
 * Creates minimal validation context without full app load
 * Loads only the registries and services needed for validation
 *
 * @returns {Promise<object>} Validation dependencies
 */
async function createMinimalContext() {
  const logger = {
    info: () => {}, // Silent in normal mode
    warn: (msg) => console.warn(chalk.yellow(`⚠️  ${msg}`)),
    error: (msg, err) => console.error(chalk.red(`❌ ${msg}`), err || ''),
    debug: () => {}, // Silent debug
  };

  // Create data registry (empty for Phase 1)
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

/**
 * Format summary statistics
 *
 * @param {Array} results - Array of validation reports
 * @returns {string} Formatted summary
 */
function formatSummary(results) {
  const totalRecipes = results.length;
  const validRecipes = results.filter(r => r.isValid).length;
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
  const totalSuggestions = results.reduce((sum, r) => sum + r.suggestions.length, 0);

  let summary = '\n' + chalk.bold('═'.repeat(80)) + '\n';
  summary += chalk.bold('VALIDATION SUMMARY') + '\n';
  summary += chalk.bold('═'.repeat(80)) + '\n\n';

  summary += `Recipes Validated: ${totalRecipes}\n`;
  summary += `Valid: ${chalk.green(validRecipes)} | Invalid: ${chalk.red(totalRecipes - validRecipes)}\n`;
  summary += `Errors: ${chalk.red(totalErrors)} | Warnings: ${chalk.yellow(totalWarnings)} | Suggestions: ${chalk.blue(totalSuggestions)}\n`;

  return summary;
}

// Configure CLI
program
  .name('validate-recipe')
  .description('Validate anatomy recipes without full app load')
  .argument('[recipes...]', 'Recipe files to validate')
  .option('-v, --verbose', 'Verbose output')
  .option('-j, --json', 'JSON output')
  .option('--fail-fast', 'Stop on first error')
  .action(async (recipes, options) => {
    try {
      // Validate that recipes were provided
      if (!recipes || recipes.length === 0) {
        console.error(chalk.red('\n❌ Error: No recipe files specified\n'));
        console.log('Usage: npm run validate:recipe <recipe-file> [<recipe-file> ...]');
        console.log('Example: npm run validate:recipe data/mods/anatomy/recipes/red_dragon.recipe.json\n');
        process.exit(1);
      }

      // Load minimal context (registries only)
      if (options.verbose) {
        console.log(chalk.blue('\n🔧 Creating validation context...\n'));
      }

      const context = await createMinimalContext();
      const validator = new RecipePreflightValidator(context);
      const results = [];

      // Validate each recipe
      for (const recipePath of recipes) {
        if (!options.json) {
          console.log(chalk.blue(`\n✓ Validating ${recipePath}...`));
        }

        try {
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
            console.log(chalk.red('\n❌ Stopping due to --fail-fast\n'));
            process.exit(1);
          }
        } catch (error) {
          console.error(chalk.red(`\n❌ Failed to validate ${recipePath}: ${error.message}`));
          if (options.verbose) {
            console.error(error.stack);
          }

          if (options.failFast) {
            process.exit(1);
          }

          // Add error result
          results.push({
            isValid: false,
            errors: [{ message: error.message }],
            warnings: [],
            suggestions: []
          });
        }
      }

      // Display summary
      if (!options.json && results.length > 1) {
        console.log(formatSummary(results));
      }

      // Exit with appropriate code
      const totalErrors = results.reduce((sum, r) => sum + (r.errors?.length || 0), 0);
      const totalWarnings = results.reduce((sum, r) => sum + (r.warnings?.length || 0), 0);

      if (totalErrors > 0) {
        console.log(chalk.red(`\n❌ Validation FAILED: ${totalErrors} error(s), ${totalWarnings} warning(s)\n`));
        process.exit(1);
      } else {
        console.log(chalk.green(`\n✅ Validation PASSED: ${results.length} recipe(s) valid\n`));
        process.exit(0);
      }

    } catch (error) {
      console.error(chalk.red(`\n❌ Validation Error: ${error.message}\n`));
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program.parse();
