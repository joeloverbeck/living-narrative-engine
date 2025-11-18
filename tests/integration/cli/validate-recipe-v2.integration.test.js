/**
 * @file Integration tests for the modern recipe validation CLI runner.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { executeRecipeValidation } from '../../../scripts/validate-recipe-v2.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

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

/**
 *
 * @param root0
 * @param root0.recipeId
 * @param root0.errors
 * @param root0.warnings
 */
function createReport({ recipeId = 'test:recipe', errors = [], warnings = [] } = {}) {
  const base = {
    recipeId,
    recipePath: `${recipeId}.recipe.json`,
    errors,
    warnings,
    suggestions: [],
    toString: jest.fn(() => `report:${recipeId}`),
    toJSON: jest.fn(() => ({
      recipeId,
      recipePath: `${recipeId}.recipe.json`,
      errors,
      warnings,
      suggestions: [],
    })),
  };

  return Object.assign(base, {
    isValid: errors.length === 0,
  });
}

/**
 *
 */
function createConsoleStub() {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };
}

/**
 *
 * @param root0
 * @param root0.reports
 */
function createRuntime({ reports = [] } = {}) {
  const consoleStub = createConsoleStub();
  const loader = {
    load: jest.fn().mockResolvedValue({
      rawConfig: {
        mods: { essential: ['core'], optional: [], autoDetect: false },
        output: { format: 'text' },
      },
      pipelineConfig: {},
    }),
  };

  const validator = {
    validate: jest.fn().mockImplementation(async () => {
      if (reports.length > 0) {
        return reports.shift();
      }
      return createReport();
    }),
  };

  const loggerStub = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

  const container = {
    register: jest.fn(),
    resolve: jest.fn((token) => {
      switch (token) {
        case tokens.IDataRegistry:
        case tokens.IAnatomyBlueprintRepository:
        case tokens.ISlotGenerator:
        case tokens.IEntityMatcherService:
          return {};
        case tokens.ISchemaValidator:
          return {};
        case tokens.ILogger:
          return loggerStub;
        default:
          return { execute: jest.fn(async (ctx) => ctx) };
      }
    }),
  };

  const runtimeOverrides = {
    exitOnCompletion: false,
    createContainer: async () => container,
    configureContainer: jest.fn().mockResolvedValue(undefined),
    registerFetchers: jest.fn(),
    createConfigurationLoader: () => loader,
    createValidator: () => validator,
    loadRecipeFile: jest.fn(async (recipePath) => ({ recipeId: `test:${recipePath}` })),
    loadMods: jest.fn().mockResolvedValue({ loadFailures: {} }),
    console: consoleStub,
    detectRecipeUsageMods: jest.fn().mockResolvedValue([]),
  };

  return { runtimeOverrides, loader, validator, consoleStub };
}

describe('validate-recipe-v2 runner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('merges CLI overrides into the configuration loader', async () => {
    const { runtimeOverrides, loader } = createRuntime();

    await executeRecipeValidation(
      ['data/mods/anatomy/recipes/sample.recipe.json'],
      { format: 'json', failFast: true },
      runtimeOverrides
    );

    expect(loader.load).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        output: { format: 'json' },
        errorHandling: { continueOnError: false },
      })
    );
  });

  it('respects a custom configuration path', async () => {
    const { runtimeOverrides, loader } = createRuntime();
    const customPath = 'config/custom-validation.json';

    await executeRecipeValidation(
      ['data/mods/anatomy/recipes/sample.recipe.json'],
      { config: customPath },
      runtimeOverrides
    );

    expect(loader.load).toHaveBeenCalledWith(customPath, expect.any(Object));
  });

  it('stops validating additional recipes when fail-fast is enabled', async () => {
    const failingReport = createReport({
      recipeId: 'test:failing',
      errors: [{ message: 'boom' }],
    });
    const { runtimeOverrides, validator } = createRuntime({ reports: [failingReport] });

    const result = await executeRecipeValidation(
      ['data/mods/anatomy/recipes/first.recipe.json', 'data/mods/anatomy/recipes/second.recipe.json'],
      { failFast: true },
      runtimeOverrides
    );

    expect(validator.validate).toHaveBeenCalledTimes(1);
    expect(result.results).toHaveLength(1);
    expect(runtimeOverrides.loadRecipeFile).toHaveBeenCalledTimes(2);
  });

  it('emits aggregated JSON when format json is requested', async () => {
    const { runtimeOverrides, consoleStub } = createRuntime();

    await executeRecipeValidation(
      ['data/mods/anatomy/recipes/sample.recipe.json'],
      { format: 'json' },
      runtimeOverrides
    );

    expect(consoleStub.log).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(consoleStub.log.mock.calls[0][0]);
    expect(payload).toHaveProperty('summary');
    expect(payload.results).toHaveLength(1);
  });

  it('emits junit xml when format junit is requested', async () => {
    const { runtimeOverrides, consoleStub } = createRuntime();

    await executeRecipeValidation(
      ['data/mods/anatomy/recipes/sample.recipe.json'],
      { format: 'junit' },
      runtimeOverrides
    );

    expect(consoleStub.log).toHaveBeenCalledWith(expect.stringContaining('<testsuite'));
  });

  it('emits per-recipe JSON output when --json is used', async () => {
    const { runtimeOverrides, consoleStub } = createRuntime({
      reports: [
        createReport({ recipeId: 'test:one' }),
        createReport({ recipeId: 'test:two' }),
      ],
    });

    await executeRecipeValidation(
      [
        'data/mods/anatomy/recipes/first.recipe.json',
        'data/mods/anatomy/recipes/second.recipe.json',
      ],
      { json: true },
      runtimeOverrides
    );

    const jsonCalls = consoleStub.log.mock.calls.filter((call) => {
      try {
        const parsed = JSON.parse(call[0]);
        return parsed && parsed.recipeId;
      } catch (err) {
        return false;
      }
    });

    expect(jsonCalls).toHaveLength(2);
  });
});
