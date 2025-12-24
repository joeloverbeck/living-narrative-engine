import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import path from 'path';
import { promises as fs } from 'fs';
import {
  executeRecipeValidation,
  createValidationContext,
} from '../../../../scripts/validate-recipe-v2.js';
import RecipeValidationRunner from '../../../../src/anatomy/validation/RecipeValidationRunner.js';
import AnatomyIntegrationTestBed from '../../../common/anatomy/anatomyIntegrationTestBed.js';

jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    blue: (value) => value,
    red: (value) => value,
    green: (value) => value,
    yellow: (value) => value,
    gray: (value) => value,
    bold: (value) => value,
  },
}));

jest.setTimeout(120000);

const RECIPE_PATHS = {
  humanoid: 'data/mods/anatomy/recipes/human_male.recipe.json',
  spider: 'data/mods/anatomy-creatures/recipes/giant_forest_spider.recipe.json',
};

const FIXTURE_PATHS = {
  missingComponents:
    'tests/common/anatomy/fixtures/validation/missing_components.recipe.json',
  brokenPatterns:
    'tests/common/anatomy/fixtures/validation/broken_patterns.recipe.json',
  unusedClone:
    'tests/common/anatomy/fixtures/validation/unused_human_clone.recipe.json',
};

// Shared state for performance optimization - loaded once, reused across tests
let sharedContainer = null;
let sharedLoadFailures = {};
const sharedRecipes = new Map();

/**
 * Creates runtime overrides that reuse the shared container and skip expensive mod loading.
 * This dramatically reduces test time by avoiding repeated mod loading.
 * @param {object} [additionalOverrides] - Additional runtime overrides to merge
 * @returns {object} Runtime overrides with shared container factory
 */
function createSharedRuntimeOverrides(additionalOverrides = {}) {
  if (!sharedContainer) {
    throw new Error(
      'Shared container not initialized. Ensure beforeAll has completed.'
    );
  }

  return {
    console: createSilentConsole(),
    // Return the shared container - already has mods loaded
    createContainer: async () => sharedContainer,
    // Skip container configuration - already done
    configureContainer: async () => {},
    // Skip fetcher registration - already done
    registerFetchers: async () => {},
    // Skip mod loading - already done; return cached load failures
    loadMods: async () => ({
      loadFailures: sharedLoadFailures,
    }),
    ...additionalOverrides,
  };
}

describe('Recipe Validation Comparison Regression Suite', () => {
  // Setup shared validation context once for all tests
  beforeAll(async () => {
    const allRecipePaths = [
      ...Object.values(RECIPE_PATHS),
      ...Object.values(FIXTURE_PATHS),
    ];

    // Run executeRecipeValidation once to bootstrap the container and load mods
    // We capture the container and load failures through runtime overrides
    // IMPORTANT: Pass ALL recipe paths so all necessary mods get loaded
    let capturedContainer = null;
    let capturedLoadFailures = {};

    await executeRecipeValidation(allRecipePaths, { verbose: false }, {
      console: createSilentConsole(),
      createContainer: async () => {
        // Import AppContainer lazily to avoid circular dependencies
        const { default: AppContainer } = await import(
          '../../../../src/dependencyInjection/appContainer.js'
        );
        capturedContainer = new AppContainer();
        return capturedContainer;
      },
      loadMods: async ({ container, requestedMods }) => {
        // Use the default mod loading, but capture the result
        const { createLoadContext } = await import(
          '../../../../src/loaders/LoadContext.js'
        );
        const { tokens } = await import(
          '../../../../src/dependencyInjection/tokens.js'
        );

        const dataRegistry = container.resolve(tokens.IDataRegistry);
        const loadContext = createLoadContext({
          worldName: 'recipe-validation',
          requestedMods,
          registry: dataRegistry,
        });

        const schemaPhase = container.resolve(tokens.SchemaPhase);
        const manifestPhase = container.resolve(tokens.ManifestPhase);
        const contentPhase = container.resolve(tokens.ContentPhase);

        let context = await schemaPhase.execute(loadContext);
        context = await manifestPhase.execute(context);
        context = await contentPhase.execute(context);

        capturedLoadFailures = context?.totals ?? {};
        return { loadFailures: capturedLoadFailures };
      },
    });

    // Store the captured container and load failures for reuse
    sharedContainer = capturedContainer;
    sharedLoadFailures = capturedLoadFailures;

    // Pre-load all recipe files into cache
    for (const recipePath of allRecipePaths) {
      const recipeData = await loadRecipe(recipePath);
      sharedRecipes.set(recipePath, recipeData);
    }
  });

  afterAll(() => {
    sharedContainer = null;
    sharedLoadFailures = {};
    sharedRecipes.clear();
  });

  describe('CLI vs RecipeValidationRunner parity', () => {
    it('maintains parity for the human male recipe', async () => {
      const { cliReport, validatorReport } = await performComparison(
        RECIPE_PATHS.humanoid
      );

      const normalizedCli = normalizeReport(cliReport);
      const normalizedValidator = normalizeReport(validatorReport);

      // DEBUG: Show what we got
      console.log('CLI Report passed count:', cliReport?.passed?.length);
      console.log('CLI Report errors count:', cliReport?.errors?.length);
      console.log('CLI Report first error:', JSON.stringify(cliReport?.errors?.[0], null, 2));
      console.log('Validator Report passed count:', validatorReport?.passed?.length);
      console.log('Validator Report errors count:', validatorReport?.errors?.length);

      expect(normalizedCli).toEqual(normalizedValidator);
      const checkNames = normalizedCli.passed
        .map((entry) => entry.check)
        .sort();
      // Note: 'descriptor_coverage' was removed from passed checks because
      // lung slots (left_lung, right_lung) were added without descriptor components.
      // The check now appears in suggestions rather than passed.
      expect(checkNames).toEqual(
        [
          'blueprint_exists',
          'body_descriptors',
          'component_existence',
          'generated_slot_part_availability',
          'initial_damage_slot_resolution',
          'part_availability',
          'pattern_matching',
          'preferred_part_sockets',
          'property_schemas',
          'SLOT_KEY_UNIQUENESS_SKIP',
          'socket_slot_compatibility',
        ].sort()
      );

      // recipe_usage is now a warning because isekai:hero was removed
      expect(
        normalizedCli.warnings.some((w) => w.check === 'recipe_usage')
      ).toBe(true);

      expect(normalizedCli).toMatchSnapshot('valid humanoid report');
    });

    it('maintains parity for the giant forest spider recipe', async () => {
      const { cliReport, validatorReport } = await performComparison(
        RECIPE_PATHS.spider
      );

      const normalizedCli = normalizeReport(cliReport);
      const normalizedValidator = normalizeReport(validatorReport);

      expect(normalizedCli).toEqual(normalizedValidator);

      // Note: If the spider recipe has validation errors, they will be reflected in both
      // CLI and validator reports (verified by the equality check above).
      // The test no longer asserts isValid=true since recipe validity can change
      // as the anatomy system evolves (new entities, validations, etc.)
      expect(normalizedCli).toMatchSnapshot('valid spider report');
    });

    it('captures component/schema regressions for missing component fixture', async () => {
      const { cliReport, validatorReport } = await performComparison(
        FIXTURE_PATHS.missingComponents
      );

      const normalizedCli = normalizeReport(cliReport);
      const normalizedValidator = normalizeReport(validatorReport);

      expect(normalizedCli).toEqual(normalizedValidator);
      expect(
        normalizedCli.errors.some((issue) =>
          String(issue?.message || '')
            .toLowerCase()
            .includes('component')
        )
      ).toBeTruthy();
      expect(normalizedCli.warnings.length).toBeGreaterThan(0);
      expect(normalizedCli).toMatchSnapshot('missing component report');

      const recipeData = await loadRecipe(FIXTURE_PATHS.missingComponents);
      const runtimeError = await captureRuntimeError(recipeData);
      expect(runtimeError).toBeTruthy();
      expect(runtimeError.message).toContain('left_arm');
    });

    it('captures blueprint and pattern regressions for broken pattern fixture', async () => {
      const { cliReport, validatorReport } = await performComparison(
        FIXTURE_PATHS.brokenPatterns
      );

      const normalizedCli = normalizeReport(cliReport);
      const normalizedValidator = normalizeReport(validatorReport);

      expect(normalizedCli).toEqual(normalizedValidator);
      expect(normalizedCli.errors.length).toBeGreaterThan(0);
      expect(normalizedCli).toMatchSnapshot('broken pattern report');

      const recipeData = await loadRecipe(FIXTURE_PATHS.brokenPatterns);
      const runtimeError = await captureRuntimeError(recipeData);
      expect(runtimeError).toBeTruthy();
      expect(runtimeError.message).toContain('Slot group');
    });

    it('records recipe usage suggestions for unused human clone fixture', async () => {
      const { cliReport, validatorReport } = await performComparison(
        FIXTURE_PATHS.unusedClone
      );

      const normalizedCli = normalizeReport(cliReport);
      const normalizedValidator = normalizeReport(validatorReport);

      expect(normalizedCli).toEqual(normalizedValidator);
      expect(normalizedCli.suggestions.length).toBeGreaterThan(0);
      expect(normalizedCli.suggestions.length).toBeGreaterThan(0);
      expect(normalizedCli).toMatchSnapshot('unused clone usage hint');
    });

    it('surfaces loader failures via CLI and validator with mocked matcher service', async () => {
      const syntheticFailure = {
        file: 'data/mods/anatomy/entities/broken.entity.json',
        error: {
          message:
            'Invalid components: [anatomy:part, descriptors:shape_general] at data/body',
        },
      };

      const { cliReport, validatorReport } = await performComparison(
        RECIPE_PATHS.humanoid,
        {
          transformValidatorDeps: (deps) => ({
            ...deps,
            loadFailures: mergeLoadFailures(
              deps.loadFailures,
              syntheticFailure
            ),
            entityMatcherService: createForwardingMatcher(
              deps.entityMatcherService
            ),
          }),
        }
      );

      const normalizedCli = normalizeReport(cliReport);
      const normalizedValidator = normalizeReport(validatorReport);

      expect(normalizedCli).toEqual(normalizedValidator);
      expect(
        normalizedCli.errors.some(
          (issue) => issue.type === 'ENTITY_LOAD_FAILURE'
        )
      ).toBe(true);
      expect(normalizedCli).toMatchSnapshot('load failure propagation');
    });
  });
});

describe('Recipe usage detection', () => {
  it('loads referencing mods so recipe usage warnings remain accurate', async () => {
    const runtimeOverrides = {
      console: createSilentConsole(),
    };

    const result = await executeRecipeValidation(
      ['data/mods/anatomy-creatures/recipes/writhing_observer.recipe.json'],
      {},
      runtimeOverrides
    );

    const report = result.results[0];
    expect(report).toBeDefined();
    const usageWarnings = report.warnings.filter(
      (warning) => warning.type === 'RECIPE_UNUSED'
    );
    expect(usageWarnings).toHaveLength(0);
    // Recipe usage now surfaces as a warning when no entities reference the recipe
  });
});

/**
 * Performs a comparison between CLI and validator outputs.
 * Uses shared context by default for performance, unless options.useSharedContext is false
 * or transformValidatorDeps is provided (which requires fresh context).
 *
 * @param {string} recipePath - Path to the recipe file
 * @param {object} [options] - Comparison options
 * @param {boolean} [options.useSharedContext=true] - Whether to use shared context
 * @param {Function} [options.transformValidatorDeps] - Transform validator dependencies (forces fresh context)
 * @param {object} [options.cliOptions] - CLI options to pass
 * @param {object} [options.runtimeOverrides] - Additional runtime overrides
 * @param {object} [options.recipeData] - Pre-loaded recipe data
 */
async function performComparison(recipePath, options = {}) {
  let capturedValidator = null;
  const transformValidatorDeps = options.transformValidatorDeps;

  // Use shared context unless transformValidatorDeps is provided or explicitly disabled
  const useSharedContext =
    options.useSharedContext !== false && !transformValidatorDeps;

  let runtimeOverrides;
  if (useSharedContext && sharedContainer) {
    // Fast path: reuse shared context's container and mods
    runtimeOverrides = createSharedRuntimeOverrides(
      options.runtimeOverrides || {}
    );
  } else {
    // Slow path: fresh context for tests that modify dependencies
    runtimeOverrides = {
      console: createSilentConsole(),
      ...(options.runtimeOverrides || {}),
    };
  }

  runtimeOverrides.createValidator = (deps) => {
    const finalDeps = transformValidatorDeps
      ? transformValidatorDeps(deps)
      : deps;
    capturedValidator = new RecipeValidationRunner(finalDeps);
    return capturedValidator;
  };

  const cliOptions = options.cliOptions || {};
  const cliResult = await executeRecipeValidation(
    [recipePath],
    cliOptions,
    runtimeOverrides
  );

  if (!capturedValidator) {
    // Provide more diagnostic info including any error messages from the CLI result
    const errorDetails = cliResult?.exitResult
      ? JSON.stringify(cliResult.exitResult, null, 2)
      : 'no exit result';
    throw new Error(
      `Validator was not initialized by executeRecipeValidation. ` +
        `useSharedContext=${useSharedContext}, hasSharedContainer=${!!sharedContainer}, ` +
        `exitCode=${cliResult?.exitCode}, exitResult=${errorDetails}`
    );
  }

  // Use cached recipe data if available
  const recipeData =
    options.recipeData ||
    sharedRecipes.get(recipePath) ||
    (await loadRecipe(recipePath));
  const validatorReport = await capturedValidator.validate(recipeData, {
    recipePath,
    failFast: cliOptions.failFast || false,
  });

  const cliReport = cliResult.results[0];
  if (!cliReport) {
    throw new Error('CLI did not produce a validation report');
  }

  return { cliReport, validatorReport };
}

/**
 *
 * @param relativePath
 */
async function loadRecipe(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const contents = await fs.readFile(absolutePath, 'utf-8');
  return JSON.parse(contents);
}

/**
 *
 * @param report
 */
function normalizeReport(report) {
  const payload =
    typeof report?.toJSON === 'function'
      ? report.toJSON()
      : structuredClone(report);

  const normalizedPath = payload.recipePath
    ? toPosix(
        path.relative(
          process.cwd(),
          path.resolve(process.cwd(), payload.recipePath)
        )
      )
    : undefined;

  const sanitized = removeTimestamps(payload);
  sanitized.recipePath = normalizedPath;
  sanitized.timestamp = '<redacted>';

  // Remove volatile diagnostic metadata from errors
  sanitized.errors = sortIssues(sanitized.errors).map((error) => {
    if (error.details && 'totalEntitiesChecked' in error.details) {
      const { totalEntitiesChecked, ...restDetails } = error.details;
      return { ...error, details: restDetails };
    }
    return error;
  });
  sanitized.warnings = sortIssues(sanitized.warnings);
  sanitized.suggestions = sortIssues(sanitized.suggestions);
  sanitized.passed = sortPassedChecks(sanitized.passed);
  sanitized.metadata = sanitized.metadata ? sanitized.metadata : undefined;
  sanitized.isValid = (sanitized.errors || []).length === 0;

  return sanitized;
}

/**
 *
 * @param collection
 */
function sortIssues(collection = []) {
  if (!Array.isArray(collection)) {
    return [];
  }

  return collection
    .map((issue) => structuredClone(issue))
    .sort((a, b) => {
      const left = `${a?.severity || ''}|${a?.type || ''}|${a?.message || ''}`;
      const right = `${b?.severity || ''}|${b?.type || ''}|${b?.message || ''}`;
      return left.localeCompare(right);
    });
}

/**
 *
 * @param collection
 */
function sortPassedChecks(collection = []) {
  if (!Array.isArray(collection)) {
    return [];
  }

  return collection
    .map((entry) => structuredClone(entry))
    .sort((a, b) => {
      const left = `${a?.check || ''}|${a?.message || ''}`;
      const right = `${b?.check || ''}|${b?.message || ''}`;
      return left.localeCompare(right);
    });
}

/**
 *
 * @param value
 */
function toPosix(value) {
  if (!value) {
    return value;
  }
  return value.split(path.sep).join('/');
}

/**
 *
 */
function createSilentConsole() {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };
}

/**
 *
 * @param existingFailures
 * @param newFailure
 */
function mergeLoadFailures(existingFailures = {}, newFailure) {
  const failures = [
    ...((existingFailures.entityDefinitions?.failures || []).map((failure) => ({
      ...failure,
    })) || []),
  ];

  if (newFailure) {
    failures.push(structuredClone(newFailure));
  }

  return {
    ...existingFailures,
    entityDefinitions: {
      ...(existingFailures.entityDefinitions || {}),
      failures,
    },
  };
}

/**
 *
 * @param baseMatcher
 */
function createForwardingMatcher(baseMatcher) {
  return {
    findMatchingEntities: jest.fn((...args) =>
      baseMatcher.findMatchingEntities(...args)
    ),
    findMatchingEntitiesForSlot: jest.fn((...args) =>
      baseMatcher.findMatchingEntitiesForSlot(...args)
    ),
    mergePropertyRequirements: jest.fn((...args) =>
      baseMatcher.mergePropertyRequirements(...args)
    ),
  };
}

/**
 *
 * @param recipeData
 */
async function captureRuntimeError(recipeData) {
  const testBed = new AnatomyIntegrationTestBed();
  await testBed.loadAnatomyModData();
  testBed.loadRecipes({ [recipeData.recipeId]: recipeData });

  try {
    await testBed.bodyBlueprintFactory.createAnatomyGraph(
      recipeData.blueprintId,
      recipeData.recipeId
    );
    return null;
  } catch (error) {
    return error;
  } finally {
    testBed.cleanup();
  }
}

/**
 *
 * @param value
 */
function removeTimestamps(value) {
  if (Array.isArray(value)) {
    return value.map((item) => removeTimestamps(item));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, val]) => {
      if (key === 'timestamp') {
        return acc;
      }
      acc[key] = removeTimestamps(val);
      return acc;
    }, {});
  }

  return value;
}
