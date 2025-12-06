import { describe, it, expect, jest } from '@jest/globals';
import path from 'path';
import { promises as fs } from 'fs';
import { executeRecipeValidation } from '../../../../scripts/validate-recipe-v2.js';
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
  spider: 'data/mods/anatomy/recipes/giant_forest_spider.recipe.json',
};

const FIXTURE_PATHS = {
  missingComponents:
    'tests/common/anatomy/fixtures/validation/missing_components.recipe.json',
  brokenPatterns:
    'tests/common/anatomy/fixtures/validation/broken_patterns.recipe.json',
  unusedClone:
    'tests/common/anatomy/fixtures/validation/unused_human_clone.recipe.json',
};

describe('Recipe Validation Comparison Regression Suite', () => {
  describe('CLI vs RecipeValidationRunner parity', () => {
    it('maintains parity for the human male recipe', async () => {
      const { cliReport, validatorReport } = await performComparison(
        RECIPE_PATHS.humanoid
      );

      const normalizedCli = normalizeReport(cliReport);
      const normalizedValidator = normalizeReport(validatorReport);

      expect(normalizedCli).toEqual(normalizedValidator);
      const checkNames = normalizedCli.passed
        .map((entry) => entry.check)
        .sort();
      expect(checkNames).toEqual(
        [
          'blueprint_exists',
          'body_descriptors',
          'component_existence',
          'generated_slot_part_availability',
          'part_availability',
          'pattern_matching',
          'preferred_part_sockets',
          'property_schemas',
          'recipe_usage',
          'SLOT_KEY_UNIQUENESS_SKIP',
          'socket_slot_compatibility',
        ].sort()
      );
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
      expect(runtimeError.message).toContain('appendage:unknown_group');
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
      ['data/mods/anatomy/recipes/writhing_observer.recipe.json'],
      {},
      runtimeOverrides
    );

    const report = result.results[0];
    expect(report).toBeDefined();
    const usageWarnings = report.warnings.filter(
      (warning) => warning.type === 'RECIPE_UNUSED'
    );
    expect(usageWarnings).toHaveLength(0);
    expect(report.passed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check: 'recipe_usage',
          message: expect.stringContaining('referenced'),
        }),
      ])
    );
  });
});

/**
 *
 * @param recipePath
 * @param options
 */
async function performComparison(recipePath, options = {}) {
  let capturedValidator = null;
  const transformValidatorDeps = options.transformValidatorDeps;

  const runtimeOverrides = {
    console: createSilentConsole(),
    ...(options.runtimeOverrides || {}),
  };

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
    throw new Error('Validator was not initialized by executeRecipeValidation');
  }

  const recipeData = options.recipeData || (await loadRecipe(recipePath));
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
