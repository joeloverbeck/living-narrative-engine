#!/usr/bin/env node

/**
 * @file Modern recipe validation CLI that supports configuration-driven pipelines.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { promises as fs } from 'fs';
import RecipeValidationRunner from '../src/anatomy/validation/RecipeValidationRunner.js';
import AppContainer from '../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../src/dependencyInjection/minimalContainerConfig.js';
import { tokens } from '../src/dependencyInjection/tokens.js';
import ConfigurationLoader from '../src/anatomy/validation/core/ConfigurationLoader.js';
import {
  validateCliArgs,
  formatNoRecipesError,
  formatSummary,
  formatJsonOutput,
  determineExitCode,
  formatExitMessage,
  formatErrorResult,
} from './validateRecipeCore.js';

const VALID_FORMATS = new Set(['text', 'json', 'junit']);

/**
 * @typedef {import('../src/anatomy/validation/ValidationReport.js').ValidationReport} ValidationReport
 */

/**
 * @typedef {object} RunnerResult
 * @property {number} exitCode - Final exit code.
 * @property {Array<ValidationReport|object>} results - Validation results per recipe.
 * @property {object} [config] - Loaded configuration payload.
 * @property {object} exitResult - Summary stats from determineExitCode.
 */

/**
 * @description CLI entry point. Parses arguments then delegates to the runner.
 * @param {Array<string>} argv - Raw argv array.
 * @param {object} [runtimeOverrides] - Optional runtime overrides for tests.
 * @returns {Promise<RunnerResult>} Runner result with exit metadata.
 */
export async function runValidation(
  argv = process.argv,
  runtimeOverrides = {}
) {
  const exitOnCompletion = runtimeOverrides.exitOnCompletion !== false;
  let lastResult = { exitCode: 1, results: [], exitResult: { exitCode: 1 } };

  const program = new Command();
  program
    .name('validate-recipe')
    .description('Validate anatomy recipes without full app load')
    .argument('[recipes...]', 'Recipe files to validate')
    .option('-v, --verbose', 'Verbose output', false)
    .option('-j, --json', 'Emit per-recipe JSON output', false)
    .option('-c, --config <path>', 'Custom configuration file')
    .option('--fail-fast', 'Stop on first error', false)
    .option(
      '--format <type>',
      'Override output format (text|json|junit)',
      (value) => normalizeFormat(value)
    )
    .action(async (recipes, options) => {
      try {
        lastResult = await executeRecipeValidation(
          recipes,
          options,
          runtimeOverrides
        );
      } catch (error) {
        console.error('❌ Validation run failed:', error);
        lastResult = { exitCode: 1, results: [], exitResult: { exitCode: 1 } };
      }

      if (exitOnCompletion) {
        process.exit(lastResult.exitCode);
      }
    });

  if (!exitOnCompletion) {
    program.exitOverride();
  }

  try {
    await program.parseAsync(argv);
  } catch (error) {
    if (!exitOnCompletion && error?.exitCode !== undefined) {
      return { ...lastResult, exitCode: error.exitCode };
    }
    throw error;
  }

  return lastResult;
}

/**
 * @description Executes validation for the provided recipes.
 * @param {Array<string>} recipes - Recipe paths to validate.
 * @param {object} cliOptions - Parsed CLI options.
 * @param {object} [runtimeOverrides] - Optional overrides for tests.
 * @returns {Promise<RunnerResult>} Runner output metadata.
 */
export async function executeRecipeValidation(
  recipes,
  cliOptions = {},
  runtimeOverrides = {}
) {
  const consoleInterface = runtimeOverrides.console ?? console;
  const chalkInstance = runtimeOverrides.chalk ?? chalk;
  const loadRecipe = runtimeOverrides.loadRecipeFile ?? loadRecipeFile;

  const argsValidation = validateCliArgs(recipes);
  if (!argsValidation.isValid) {
    consoleInterface.error(formatNoRecipesError(chalkInstance));
    return {
      exitCode: argsValidation.exitCode,
      results: [],
      config: null,
      exitResult: {
        exitCode: argsValidation.exitCode,
        passed: false,
        totalErrors: 0,
        totalWarnings: 0,
        totalRecipes: 0,
      },
    };
  }

  const { recipes: preloadedRecipes, failures: recipeLoadFailures } =
    await preloadRecipes(recipes, loadRecipe);
  const recipeIds = Array.from(preloadedRecipes.values())
    .map((recipe) => recipe?.recipeId)
    .filter((id) => typeof id === 'string' && id.length > 0);

  let inferredMods = [];
  const usageDetector =
    runtimeOverrides.detectRecipeUsageMods ?? detectRecipeUsageMods;
  try {
    inferredMods = await usageDetector(recipeIds);
  } catch (error) {
    if (cliOptions.verbose) {
      consoleInterface.warn(
        chalkInstance.yellow(
          `[validate-recipe] Failed to auto-detect referencing mods: ${error.message}`
        )
      );
    }
    inferredMods = [];
  }

  let context;
  try {
    const overrides = buildConfigurationOverrides(cliOptions);
    if (cliOptions.verbose) {
      consoleInterface.log(
        chalkInstance.blue(
          '\n🔧 Creating validation context and loading mods...\n'
        )
      );
    }

    context = await createValidationContext({
      verbose: cliOptions.verbose,
      configPath: cliOptions.config,
      overrides,
      recipePaths: recipes,
      inferredMods,
      runtimeOverrides,
    });
  } catch (error) {
    consoleInterface.error(
      chalkInstance.red(`\n❌ Validation Error: ${error.message}\n`)
    );
    if (cliOptions.verbose && error?.stack) {
      consoleInterface.error(error.stack);
    }
    return {
      exitCode: 1,
      results: [],
      config: null,
      exitResult: {
        exitCode: 1,
        passed: false,
        totalErrors: 1,
        totalWarnings: 0,
        totalRecipes: 0,
      },
    };
  }

  const finalFormat = resolveOutputFormat(cliOptions, context.config);
  const legacyJsonMode = Boolean(cliOptions.json);
  const results = [];

  for (const recipePath of recipes) {
    if (!legacyJsonMode && finalFormat === 'text') {
      consoleInterface.log(
        chalkInstance.blue(`\n✓ Validating ${recipePath}...`)
      );
    }

    const preloadError = recipeLoadFailures.get(recipePath);
    if (preloadError) {
      consoleInterface.error(
        chalkInstance.red(
          `\n❌ Failed to validate ${recipePath}: ${preloadError.message}`
        )
      );
      if (cliOptions.verbose && preloadError?.stack) {
        consoleInterface.error(preloadError.stack);
      }

      const errorResult = formatErrorResult(recipePath, preloadError);
      results.push(errorResult);

      if (cliOptions.failFast) {
        break;
      }

      continue;
    }

    try {
      // Clear blueprint cache BEFORE each validation to prevent state leakage
      // between recipes using different blueprint types (composed vs structure-template)
      context.anatomyBlueprintRepository?.clearCache?.();

      const recipeData =
        preloadedRecipes.get(recipePath) ?? (await loadRecipe(recipePath));
      const report = await context.validator.validate(recipeData, {
        recipePath,
        failFast: cliOptions.failFast,
      });
      results.push(report);

      if (legacyJsonMode) {
        consoleInterface.log(formatJsonOutput(report));
      } else if (finalFormat === 'text') {
        consoleInterface.log(report.toString());
      }

      if (!report.isValid && cliOptions.failFast) {
        consoleInterface.log(
          chalkInstance.red('\n❌ Stopping due to --fail-fast\n')
        );
        break;
      }
    } catch (error) {
      consoleInterface.error(
        chalkInstance.red(
          `\n❌ Failed to validate ${recipePath}: ${error.message}`
        )
      );
      if (cliOptions.verbose && error?.stack) {
        consoleInterface.error(error.stack);
      }

      const errorResult = formatErrorResult(recipePath, error);
      results.push(errorResult);

      if (cliOptions.failFast) {
        break;
      }
    }
  }

  const exitResult = determineExitCode(results);

  if (!legacyJsonMode) {
    if (finalFormat === 'json') {
      consoleInterface.log(formatAggregatedJson(results, exitResult));
    } else if (finalFormat === 'junit') {
      consoleInterface.log(formatJUnitOutput(results));
    } else if (results.length > 1) {
      consoleInterface.log(formatSummary(results, chalkInstance));
    }
  }

  if (finalFormat === 'text' || legacyJsonMode) {
    consoleInterface.log(formatExitMessage(exitResult, chalkInstance));
  }

  return {
    exitCode: exitResult.exitCode,
    results,
    config: context.config,
    exitResult,
  };
}

/**
 * @description Load recipe JSON from disk.
 * @param {string} recipePath - Recipe file path.
 * @returns {Promise<object>} Parsed recipe JSON.
 */
export async function loadRecipeFile(recipePath) {
  const absolutePath = path.isAbsolute(recipePath)
    ? recipePath
    : path.resolve(process.cwd(), recipePath);

  try {
    const content = await fs.readFile(absolutePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Failed to load recipe file '${recipePath}': ${error.message}`
    );
  }
}

/**
 * @description Preloads recipe files so their metadata is available before context creation.
 * @param {Array<string>} recipePaths - Recipe file paths.
 * @param {(recipePath: string) => Promise<object>} loadRecipe - Loader function.
 * @returns {Promise<{recipes: Map<string, object>, failures: Map<string, Error>}>}
 */
async function preloadRecipes(recipePaths, loadRecipe) {
  const recipes = new Map();
  const failures = new Map();

  for (const recipePath of recipePaths) {
    if (recipes.has(recipePath) || failures.has(recipePath)) {
      continue;
    }

    try {
      const recipeData = await loadRecipe(recipePath);
      recipes.set(recipePath, recipeData);
    } catch (error) {
      failures.set(recipePath, error);
    }
  }

  return { recipes, failures };
}

/**
 * @description Detects mods whose entity definitions reference the provided recipe IDs.
 * @param {Array<string>} recipeIds - Recipe IDs being validated.
 * @returns {Promise<Array<string>>} Detected mod IDs.
 */
async function detectRecipeUsageMods(recipeIds = []) {
  if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
    return [];
  }

  const normalizedIds = new Set(
    recipeIds.filter((id) => typeof id === 'string' && id.trim() !== '')
  );
  if (normalizedIds.size === 0) {
    return [];
  }

  const modsDir = path.resolve(process.cwd(), 'data/mods');
  let modEntries = [];
  try {
    modEntries = await fs.readdir(modsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const referencingMods = new Set();

  for (const modEntry of modEntries) {
    if (!modEntry.isDirectory()) {
      continue;
    }

    const modId = modEntry.name;
    const definitionsDir = path.join(modsDir, modId, 'entities', 'definitions');
    if (!(await directoryExists(definitionsDir))) {
      continue;
    }

    const directoryStack = [definitionsDir];
    let foundReference = false;

    while (directoryStack.length > 0 && !foundReference) {
      const currentDir = directoryStack.pop();
      let dirEntries = [];
      try {
        dirEntries = await fs.readdir(currentDir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of dirEntries) {
        const entryPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          directoryStack.push(entryPath);
          continue;
        }

        if (!entry.isFile() || !entry.name.endsWith('.json')) {
          continue;
        }

        try {
          const raw = await fs.readFile(entryPath, 'utf-8');
          const entity = JSON.parse(raw);
          const recipeId = entity?.components?.['anatomy:body']?.recipeId;

          if (recipeId && normalizedIds.has(recipeId)) {
            referencingMods.add(modId);
            foundReference = true;
            break;
          }
        } catch {
          // Ignore malformed entity definitions during detection
        }
      }
    }
  }

  return Array.from(referencingMods);
}

/**
 *
 * @param targetPath
 */
async function directoryExists(targetPath) {
  try {
    const stats = await fs.stat(targetPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * @description Builds configuration overrides based on CLI flags.
 * @param {object} cliOptions - CLI options.
 * @returns {object} Overrides suitable for ConfigurationLoader.load().
 */
function buildConfigurationOverrides(cliOptions) {
  const overrides = {};

  const desiredFormat = cliOptions.json ? 'json' : cliOptions.format;
  if (desiredFormat) {
    overrides.output = { format: desiredFormat };
  }

  if (cliOptions.failFast) {
    overrides.errorHandling = { continueOnError: false };
  }

  return overrides;
}

/**
 * @description Resolves the final output format from CLI options + config.
 * @param {object} cliOptions - CLI options.
 * @param {object} config - Loaded configuration payload.
 * @returns {string} Output format string.
 */
function resolveOutputFormat(cliOptions, config) {
  if (cliOptions.json) {
    return 'json';
  }

  if (cliOptions.format) {
    return cliOptions.format;
  }

  return config?.output?.format ?? 'text';
}

/**
 * @description Ensures requested format is valid.
 * @param {string} value - CLI input string.
 * @returns {string} Normalized format string.
 */
function normalizeFormat(value) {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (!VALID_FORMATS.has(normalized)) {
    throw new Error(
      `Unsupported format '${value}'. Choose from text, json, or junit.`
    );
  }
  return normalized;
}

/**
 * @description Creates the validator and supporting services.
 * @param {object} params - Bootstrap parameters.
 * @param params.verbose
 * @param params.configPath
 * @param params.overrides
 * @param params.recipePaths
 * @param params.inferredMods
 * @param params.runtimeOverrides
 * @returns {Promise<{validator: RecipeValidationRunner, config: object}>} Context payload.
 */
async function createValidationContext({
  verbose = false,
  configPath,
  overrides = {},
  recipePaths = [],
  inferredMods = [],
  runtimeOverrides = {},
}) {
  const container =
    (await runtimeOverrides.createContainer?.()) ?? new AppContainer();
  const configure =
    runtimeOverrides.configureContainer ?? configureMinimalContainer;
  await configure(container);

  const registerFetchers =
    runtimeOverrides.registerFetchers ?? registerNodeFetchers;
  await registerFetchers(container);

  const logger = runtimeOverrides.logger ??
    container.resolve(tokens.ILogger) ?? {
      info: console.log,
      warn: console.warn,
      error: console.error,
      debug: () => {},
    };
  const schemaValidator = container.resolve(tokens.ISchemaValidator);
  const monitoringCoordinator =
    typeof container.isRegistered === 'function' &&
    container.isRegistered(tokens.IMonitoringCoordinator)
      ? container.resolve(tokens.IMonitoringCoordinator)
      : null;

  const configurationLoader =
    runtimeOverrides.createConfigurationLoader?.({ schemaValidator, logger }) ??
    new ConfigurationLoader({ schemaValidator, logger });

  // Pre-load the validation-config schema before ConfigurationLoader needs it
  // This schema is not in any mod manifest, so we must load it manually
  const validationConfigSchemaPath = path.resolve(
    process.cwd(),
    'data/schemas/validation-config.schema.json'
  );
  try {
    const schemaContent = await fs.readFile(
      validationConfigSchemaPath,
      'utf-8'
    );
    const schemaData = JSON.parse(schemaContent);
    const schemaId =
      schemaData.$id ||
      'schema://living-narrative-engine/validation-config.schema.json';

    // Only add if not already loaded
    if (!schemaValidator.isSchemaLoaded(schemaId)) {
      await schemaValidator.addSchema(schemaData, schemaId);
      if (verbose) {
        logger.info(
          `[validate-recipe] Pre-loaded validation-config schema: ${schemaId}`
        );
      }
    }
  } catch (error) {
    logger.warn(
      `[validate-recipe] Could not pre-load validation-config schema: ${error.message}`
    );
    // Continue anyway - ConfigurationLoader will report the error if needed
  }

  const configuration = await configurationLoader.load(configPath, overrides);
  const requestedMods = deriveMods(
    configuration.rawConfig?.mods,
    recipePaths,
    inferredMods
  );

  if (verbose && requestedMods.length > 0) {
    logger.info(
      `[validate-recipe] Loading ${requestedMods.length} mods: ${requestedMods.join(', ')}`
    );
  }

  const modLoadResult = runtimeOverrides.loadMods
    ? await runtimeOverrides.loadMods({
        container,
        requestedMods,
        verbose,
        logger,
      })
    : await loadModsFromContainer({
        container,
        requestedMods,
        verbose,
        logger,
      });

  const validatorDeps = {
    dataRegistry: container.resolve(tokens.IDataRegistry),
    anatomyBlueprintRepository: container.resolve(
      tokens.IAnatomyBlueprintRepository
    ),
    schemaValidator,
    slotGenerator: container.resolve(tokens.ISlotGenerator),
    entityMatcherService: container.resolve(tokens.IEntityMatcherService),
    logger,
    loadFailures: modLoadResult?.loadFailures ?? {},
    validationPipelineConfig: configuration.pipelineConfig,
    monitoringCoordinator,
  };

  const validator =
    runtimeOverrides.createValidator?.(validatorDeps) ??
    new RecipeValidationRunner(validatorDeps);

  return {
    validator,
    config: configuration.rawConfig,
    anatomyBlueprintRepository: validatorDeps.anatomyBlueprintRepository,
  };
}

/**
 * @description Registers Node-specific data fetchers for CLI usage.
 * @param {AppContainer} container - Dependency injection container.
 */
async function registerNodeFetchers(container) {
  const NodeDataFetcher = (await import('./utils/nodeDataFetcher.js')).default;
  const NodeTextDataFetcher = (await import('./utils/nodeTextDataFetcher.js'))
    .default;
  container.register(tokens.IDataFetcher, () => new NodeDataFetcher());
  container.register(tokens.ITextDataFetcher, () => new NodeTextDataFetcher());
}

/**
 * @description Loads mods using the configured DI container.
 * @param {object} params - Loader parameters.
 * @param params.container
 * @param params.requestedMods
 * @param params.verbose
 * @param params.logger
 * @returns {Promise<{loadFailures: object}>} Load metadata.
 */
async function loadModsFromContainer({
  container,
  requestedMods,
  verbose,
  logger,
}) {
  const dataRegistry = container.resolve(tokens.IDataRegistry);
  const { createLoadContext } = await import('../src/loaders/LoadContext.js');

  const loadContext = createLoadContext({
    worldName: 'recipe-validation',
    requestedMods,
    registry: dataRegistry,
  });

  const schemaPhase = container.resolve(tokens.SchemaPhase);
  const manifestPhase = container.resolve(tokens.ManifestPhase);
  const contentPhase = container.resolve(tokens.ContentPhase);

  if (verbose) {
    logger.info('[validate-recipe] Running SchemaPhase...');
  }
  let context = await schemaPhase.execute(loadContext);

  if (verbose) {
    logger.info('[validate-recipe] Running ManifestPhase...');
  }
  context = await manifestPhase.execute(context);

  if (verbose) {
    logger.info('[validate-recipe] Running ContentPhase...');
  }
  context = await contentPhase.execute(context);

  return { loadFailures: context?.totals ?? {} };
}

/**
 * @description Derives mod list from configuration and recipe paths.
 * @param {object} modConfig - Configuration mods block.
 * @param {Array<string>} recipePaths - Recipe paths provided via CLI.
 * @param inferredMods
 * @returns {Array<string>} Ordered mod names.
 */
function deriveMods(modConfig = {}, recipePaths = [], inferredMods = []) {
  const essential = Array.isArray(modConfig.essential)
    ? modConfig.essential
    : [];
  const optional = Array.isArray(modConfig.optional) ? modConfig.optional : [];
  const extra = Array.isArray(inferredMods) ? inferredMods.filter(Boolean) : [];
  const modSet = new Set([...essential, ...optional, ...extra]);
  const autoDetect = Boolean(modConfig.autoDetect);

  if (autoDetect) {
    for (const recipePath of recipePaths) {
      const detected = detectModName(recipePath);
      if (detected) {
        modSet.add(detected);
      }
    }
  }

  return Array.from(modSet);
}

/**
 * @description Detects the mod name from a recipe path.
 * @param {string} recipePath - Recipe file path.
 * @returns {string|null} Detected mod name or null if unknown.
 */
function detectModName(recipePath) {
  if (!recipePath) {
    return null;
  }

  const normalized = recipePath.replace(/\\/g, '/');
  const match = normalized.match(/mods\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * @description Formats aggregated JSON output for machine consumption.
 * @param {Array<ValidationReport|object>} results - Validation results.
 * @param {object} exitResult - Summary statistics.
 * @returns {string} JSON string.
 */
function formatAggregatedJson(results, exitResult) {
  const payload = {
    summary: exitResult,
    results: results.map((report) =>
      typeof report?.toJSON === 'function' ? report.toJSON() : report
    ),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * @description Formats validation results as a JUnit XML document.
 * @param {Array<ValidationReport|object>} results - Validation results.
 * @returns {string} XML string.
 */
function formatJUnitOutput(results) {
  const totalTests = results.length;
  const failures = results.filter((report) => report && !report.isValid).length;

  const testCases = results
    .map((report) => {
      const payload =
        typeof report?.toJSON === 'function' ? report.toJSON() : report;
      const name = payload?.recipePath || payload?.recipeId || 'recipe';
      const errors = payload?.errors ?? [];
      const sanitizedName = escapeXml(name);
      let testCase = `  <testcase classname="recipe.validation" name="${sanitizedName}">`;

      if (errors.length > 0) {
        const message = escapeXml(errors[0]?.message ?? 'Validation failed');
        const details = escapeXml(errors.map((err) => err.message).join('\n'));
        testCase += `\n    <failure message="${message}">${details}</failure>\n  </testcase>`;
      } else {
        testCase += '</testcase>';
      }

      return testCase;
    })
    .join('\n');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<testsuite name="recipe-validation" tests="${totalTests}" failures="${failures}">\n` +
    `${testCases}\n` +
    '</testsuite>'
  );
}

/**
 * @description Escapes XML special characters.
 * @param {string} value - Input string.
 * @returns {string} Escaped string.
 */
function escapeXml(value) {
  if (!value && value !== 0) {
    return '';
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default runValidation;
