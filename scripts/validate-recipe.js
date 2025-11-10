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
import AppContainer from '../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../src/dependencyInjection/minimalContainerConfig.js';
import { tokens } from '../src/dependencyInjection/tokens.js';
import {
  validateCliArgs,
  formatNoRecipesError,
  formatSummary,
  formatJsonOutput,
  determineExitCode,
  formatExitMessage,
  formatErrorResult,
} from './validateRecipeCore.js';

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
 * Creates validation context with full mod loading
 * Loads mods and all required services for validation
 *
 * @param {boolean} verbose - Whether to show verbose output
 * @returns {Promise<object>} Validation dependencies
 */
async function createValidationContext(verbose = false) {
  // Create and configure container
  const container = new AppContainer();
  await configureMinimalContainer(container);

  // Override data fetchers for CLI environment
  const NodeDataFetcher = (await import('./utils/nodeDataFetcher.js')).default;
  const NodeTextDataFetcher = (await import('./utils/nodeTextDataFetcher.js')).default;
  container.register(tokens.IDataFetcher, () => new NodeDataFetcher());
  container.register(tokens.ITextDataFetcher, () => new NodeTextDataFetcher());

  // Resolve core services
  const dataRegistry = container.resolve(tokens.IDataRegistry);
  const anatomyBlueprintRepository = container.resolve(tokens.IAnatomyBlueprintRepository);
  const schemaValidator = container.resolve(tokens.ISchemaValidator);
  const slotGenerator = container.resolve(tokens.ISlotGenerator);

  // Load mods
  if (verbose) {
    console.log(chalk.blue('📚 Loading mods...'));
  }

  try {
    // Load only essential mods for recipe validation
    // These mods contain the core components and anatomy system
    const essentialMods = [
      'core',
      'descriptors',
      'anatomy',
    ];

    if (verbose) {
      console.log(chalk.blue(`   Loading ${essentialMods.length} essential mods: ${essentialMods.join(', ')}`));
    }

    // Manually run only the necessary phases to avoid GameConfigPhase
    // which would override our mod list with game.json
    const { createLoadContext } = await import('../src/loaders/LoadContext.js');

    // Create load context
    let context = createLoadContext({
      worldName: 'recipe-validation',
      requestedMods: essentialMods,
      registry: dataRegistry,
    });

    // Execute only the phases we need
    const schemaPhase = container.resolve(tokens.SchemaPhase);
    const manifestPhase = container.resolve(tokens.ManifestPhase);
    const contentPhase = container.resolve(tokens.ContentPhase);

    if (verbose) {
      console.log(chalk.blue('   Running SchemaPhase...'));
    }
    context = await schemaPhase.execute(context);

    if (verbose) {
      console.log(chalk.blue('   Running ManifestPhase...'));
    }
    context = await manifestPhase.execute(context);

    if (verbose) {
      console.log(chalk.blue('   Running ContentPhase...'));
    }
    context = await contentPhase.execute(context);

    if (verbose) {
      console.log(chalk.green(`✅ Loaded ${context.finalModOrder.length} mods successfully`));
    }

    // Return context along with services
    return {
      dataRegistry,
      anatomyBlueprintRepository,
      schemaValidator,
      slotGenerator,
      loadFailures: context.totals, // Include load failures from totals
      logger: {
        info: verbose ? (msg) => console.log(chalk.blue(msg)) : () => {},
        warn: (msg) => console.warn(chalk.yellow(`⚠️  ${msg}`)),
        error: (msg, err) => console.error(chalk.red(`❌ ${msg}`), err || ''),
        debug: verbose ? (msg) => console.log(chalk.gray(msg)) : () => {},
      },
    };
  } catch (error) {
    throw new Error(`Failed to load mods: ${error.message}`);
  }
}

// formatSummary is now imported from validateRecipeCore.js

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
      const argsValidation = validateCliArgs(recipes);
      if (!argsValidation.isValid) {
        console.error(formatNoRecipesError(chalk));
        process.exit(argsValidation.exitCode);
      }

      // Load validation context (with mod loading)
      if (options.verbose) {
        console.log(chalk.blue('\n🔧 Creating validation context and loading mods...\n'));
      }

      const context = await createValidationContext(options.verbose);
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
            console.log(formatJsonOutput(report));
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
          results.push(formatErrorResult(recipePath, error));
        }
      }

      // Display summary
      if (!options.json && results.length > 1) {
        console.log(formatSummary(results, chalk));
      }

      // Exit with appropriate code
      const exitResult = determineExitCode(results);
      console.log(formatExitMessage(exitResult, chalk));
      process.exit(exitResult.exitCode);

    } catch (error) {
      console.error(chalk.red(`\n❌ Validation Error: ${error.message}\n`));
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program.parse();
