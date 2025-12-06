/**
 * @file Integration tests for GoalLoader covering manifest processing,
 * schema validation, and registry interactions without using mocks for
 * the core collaborators.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GoalLoader from '../../../src/loaders/goalLoader.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { DuplicateContentError } from '../../../src/errors/duplicateContentError.js';
import { ModValidationError } from '../../../src/errors/modValidationError.js';
import { createGoalFixture } from '../../fixtures/goals/createGoalFixture.js';

const GOAL_SCHEMA_ID = 'schema://living-narrative-engine/goal.schema.json';

/**
 * @class TestConfiguration
 * @description Minimal configuration service for integration testing.
 */
class TestConfiguration {
  /**
   * @description Returns the base path for resolving mod content.
   * @returns {string} Virtual mods directory.
   */
  getModsBasePath() {
    return '/virtual-mods';
  }

  /**
   * @description Retrieves the schema id for the provided content type.
   * @param {string} contentType - Manifest content type key.
   * @returns {string|null} Schema identifier for the content type.
   */
  getContentTypeSchemaId(contentType) {
    return contentType === 'goals' ? GOAL_SCHEMA_ID : null;
  }
}

/**
 * @class TestPathResolver
 * @description Resolves manifest filenames into deterministic virtual paths.
 */
class TestPathResolver {
  /**
   * @description Resolves the path to a manifest-referenced file.
   * @param {string} modId - Mod identifier.
   * @param {string} diskFolder - Manifest folder segment.
   * @param {string} filename - Referenced filename.
   * @returns {string} Resolved path used by the fetcher.
   */
  resolveModContentPath(modId, diskFolder, filename) {
    return `/virtual-mods/${modId}/${diskFolder}/${filename}`;
  }
}

/**
 * @class MapDataFetcher
 * @description Supplies JSON payloads from an in-memory map keyed by path.
 */
class MapDataFetcher {
  /**
   * @description Creates a new fetcher bound to the provided map.
   * @param {Map<string, any>} fileMap - Mapping of resolved paths to JSON data.
   */
  constructor(fileMap) {
    this._fileMap = fileMap;
  }

  /**
   * @description Fetches the JSON payload for a previously registered path.
   * @param {string} path - Resolved path provided by the path resolver.
   * @returns {Promise<any>} Deep clone of the registered payload.
   */
  async fetch(path) {
    if (!this._fileMap.has(path)) {
      throw new Error(`Missing fixture for path: ${path}`);
    }

    const value = this._fileMap.get(path);
    if (typeof value === 'object' && value !== null) {
      return JSON.parse(JSON.stringify(value));
    }

    return value;
  }
}

/**
 * @class StrictSchemaValidator
 * @description Minimal schema validator fulfilling the interface requirements.
 */
class StrictSchemaValidator {
  /**
   * @description Creates a new strict validator.
   * @param {Record<string, (data: any) => {isValid: boolean, errors: any[]|null}>} validatorMap - Schema handlers.
   */
  constructor(validatorMap = {}) {
    this._validators = new Map();
    Object.entries(validatorMap).forEach(([schemaId, impl]) => {
      this._validators.set(schemaId, impl);
    });

    this.isSchemaLoaded = jest.fn((schemaId) => this._validators.has(schemaId));
    this.getValidator = jest.fn((schemaId) => this._validators.get(schemaId));
    this.validate = jest.fn((schemaId, data) => {
      const validator = this._validators.get(schemaId);
      if (!validator) {
        return {
          isValid: false,
          errors: [{ message: `Validator missing for ${schemaId}` }],
        };
      }
      return validator(data);
    });
  }
}

/**
 * @description Creates a Jest logger implementation used by integration tests.
 * @returns {{error: jest.Mock, warn: jest.Mock, info: jest.Mock, debug: jest.Mock}} Logger spies.
 */
function createTestLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

/**
 * @description Instantiates a fully wired GoalLoader with deterministic collaborators.
 * @param {Map<string, any>} fileMap - Map of resolved paths to goal payloads.
 * @param {{schemaValidator?: StrictSchemaValidator}} [options] - Optional overrides.
 * @returns {{
 *   loader: GoalLoader,
 *   registry: InMemoryDataRegistry,
 *   logger: ReturnType<typeof createTestLogger>,
 *   pathResolver: TestPathResolver,
 *   dataFetcher: MapDataFetcher,
 *   schemaValidator: StrictSchemaValidator,
 *   config: TestConfiguration
 * }} Loader and dependencies.
 */
function createGoalLoader(fileMap, { schemaValidator } = {}) {
  const logger = createTestLogger();
  const registry = new InMemoryDataRegistry({ logger });
  const config = new TestConfiguration();
  const pathResolver = new TestPathResolver();
  const dataFetcher = new MapDataFetcher(fileMap);
  const effectiveSchemaValidator =
    schemaValidator ||
    new StrictSchemaValidator({
      [GOAL_SCHEMA_ID]: () => ({ isValid: true, errors: null }),
    });

  const loader = new GoalLoader(
    config,
    pathResolver,
    dataFetcher,
    effectiveSchemaValidator,
    registry,
    logger
  );

  return {
    loader,
    registry,
    logger,
    pathResolver,
    dataFetcher,
    schemaValidator: effectiveSchemaValidator,
    config,
  };
}

describe('GoalLoader integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads goal definitions, validates them, and stores metadata-rich entries', async () => {
    const fileMap = new Map([
      [
        '/virtual-mods/modAlpha/goals/defend_base.goal.json',
        createGoalFixture({
          $schema: GOAL_SCHEMA_ID,
          id: 'modAlpha:defend_base',
          description: 'Defend the base from intruders.',
          priority: 75,
          relevance: { logic: { '!!': { var: 'world.baseUnderAttack' } } },
          goalState: {
            logic: {
              '==': [{ var: 'world.baseThreatLevel' }, 'none'],
            },
          },
        }),
      ],
      [
        '/virtual-mods/modAlpha/goals/rest.goal.json',
        createGoalFixture({
          id: 'modAlpha:rest',
          description: 'Recover stamina when fatigued.',
          priority: 10,
          relevance: { logic: { '>': [{ var: 'actor.fatigue' }, 5] } },
          goalState: {
            logic: {
              '<=': [{ var: 'actor.fatigue' }, 1],
            },
          },
        }),
      ],
    ]);

    const schemaValidator = new StrictSchemaValidator({
      [GOAL_SCHEMA_ID]: (data) => ({
        isValid:
          typeof data === 'object' &&
          data !== null &&
          typeof data.priority === 'number' &&
          data.priority >= 0 &&
          typeof data.goalState === 'object' &&
          data.goalState !== null &&
          typeof data.relevance === 'object' &&
          data.relevance !== null,
        errors: null,
      }),
    });

    const {
      loader,
      registry,
      logger,
      schemaValidator: validator,
    } = createGoalLoader(fileMap, { schemaValidator });

    const manifest = {
      content: {
        goals: ['defend_base.goal.json', '   rest.goal.json   ', null, '', 42],
      },
    };

    const result = await loader.loadItemsForMod(
      'modAlpha',
      manifest,
      'goals',
      'goals',
      'goals'
    );

    expect(result).toEqual({ count: 2, overrides: 0, errors: 0, failures: [] });

    expect(validator.isSchemaLoaded).toHaveBeenCalledWith(GOAL_SCHEMA_ID);
    expect(validator.validate).toHaveBeenCalledTimes(2);

    const storedDefend = registry.get('goals', 'modAlpha:defend_base');
    expect(storedDefend).toMatchObject({
      id: 'defend_base',
      _modId: 'modAlpha',
      _sourceFile: 'defend_base.goal.json',
      _fullId: 'modAlpha:defend_base',
      priority: 75,
    });

    const storedRest = registry.get('goals', 'modAlpha:rest');
    expect(storedRest).toMatchObject({
      id: 'rest',
      _modId: 'modAlpha',
      _sourceFile: 'rest.goal.json',
      _fullId: 'modAlpha:rest',
      priority: 10,
    });

    expect(registry.getAll('goals')).toHaveLength(2);

    expect(logger.warn).toHaveBeenCalledWith(
      "Mod 'modAlpha': Invalid non-string entry found in 'goals' list:",
      null
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Mod 'modAlpha': Empty string filename found in 'goals' list after trimming. Skipping."
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Mod 'modAlpha': Invalid non-string entry found in 'goals' list:",
      42
    );
  });

  it('records duplicate goal definitions as failures without overwriting existing data', async () => {
    const fileMap = new Map([
      [
        '/virtual-mods/modAlpha/goals/original.goal.json',
        createGoalFixture({
          id: 'modAlpha:shared_goal',
          priority: 30,
          relevance: { logic: { '!!': { var: 'actor.alert' } } },
          goalState: { logic: { '==': [{ var: 'actor.alert' }, false] } },
        }),
      ],
      [
        '/virtual-mods/modAlpha/goals/duplicate.goal.json',
        createGoalFixture({
          id: 'modAlpha:shared_goal',
          priority: 80,
          relevance: { logic: { '!!': { var: 'actor.alert' } } },
          goalState: { logic: { '==': [{ var: 'actor.alert' }, true] } },
        }),
      ],
    ]);

    const { loader, registry, schemaValidator } = createGoalLoader(fileMap);

    const manifest = {
      content: {
        goals: ['original.goal.json', 'duplicate.goal.json'],
      },
    };

    const result = await loader.loadItemsForMod(
      'modAlpha',
      manifest,
      'goals',
      'goals',
      'goals'
    );

    expect(result.count).toBe(1);
    expect(result.overrides).toBe(0);
    expect(result.errors).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({ file: 'duplicate.goal.json' });
    expect(result.failures[0].error).toBeInstanceOf(DuplicateContentError);

    const stored = registry.get('goals', 'modAlpha:shared_goal');
    expect(stored).toMatchObject({
      _sourceFile: 'original.goal.json',
      priority: 30,
    });

    expect(schemaValidator.validate).toHaveBeenCalledTimes(2);
  });

  it('records a structured ModValidationError when schema validation fails in strict mode', async () => {
    const originalFlag = process.env.GOAL_LOADER_ALLOW_DEFAULTS;
    delete process.env.GOAL_LOADER_ALLOW_DEFAULTS;

    const fileMap = new Map([
      [
        '/virtual-mods/modAlpha/goals/broken.goal.json',
        createGoalFixture({
          id: 'modAlpha:broken_goal',
          priority: -1,
          relevance: { logic: { '!!': { var: 'actor.alert' } } },
          goalState: { logic: { '==': [{ var: 'actor.alert' }, true] } },
        }),
      ],
    ]);

    const schemaValidator = new StrictSchemaValidator({
      [GOAL_SCHEMA_ID]: () => ({
        isValid: false,
        errors: [
          {
            instancePath: '/priority',
            schemaPath: '#/properties/priority/minimum',
            keyword: 'minimum',
            message: 'must be >= 0',
          },
        ],
      }),
    });

    const { loader } = createGoalLoader(fileMap, { schemaValidator });

    try {
      const result = await loader.loadItemsForMod(
        'modAlpha',
        { content: { goals: ['broken.goal.json'] } },
        'goals',
        'goals',
        'goals'
      );

      expect(result.errors).toBe(1);
      expect(result.failures).toHaveLength(1);
      const failure = result.failures[0];
      expect(failure.error).toBeInstanceOf(ModValidationError);
      expect(failure.error.code).toBe('GOAL_SCHEMA_VALIDATION_FAILED');
      expect(failure.error.context).toMatchObject({
        modId: 'modAlpha',
        filename: 'broken.goal.json',
        schemaPath: '#/properties/priority/minimum',
        instancePath: '/priority',
        dataSnippet: -1,
      });
    } finally {
      if (typeof originalFlag === 'undefined') {
        delete process.env.GOAL_LOADER_ALLOW_DEFAULTS;
      } else {
        process.env.GOAL_LOADER_ALLOW_DEFAULTS = originalFlag;
      }
    }
  });

  it('logs a warning and continues when GOAL_LOADER_ALLOW_DEFAULTS permits schema failures', async () => {
    const originalFlag = process.env.GOAL_LOADER_ALLOW_DEFAULTS;
    process.env.GOAL_LOADER_ALLOW_DEFAULTS = '1';

    const fileMap = new Map([
      [
        '/virtual-mods/modAlpha/goals/incomplete.goal.json',
        createGoalFixture({
          id: 'modAlpha:incomplete_goal',
          priority: 5,
          relevance: { logic: { '!!': { var: 'actor.alert' } } },
          goalState: null,
        }),
      ],
    ]);

    const schemaValidator = new StrictSchemaValidator({
      [GOAL_SCHEMA_ID]: () => ({
        isValid: false,
        errors: [
          {
            instancePath: '/goalState',
            schemaPath: '#/properties/goalState/type',
            keyword: 'type',
            message: 'must be object',
          },
        ],
      }),
    });

    const { loader, registry, logger } = createGoalLoader(fileMap, {
      schemaValidator,
    });

    try {
      const result = await loader.loadItemsForMod(
        'modAlpha',
        { content: { goals: ['incomplete.goal.json'] } },
        'goals',
        'goals',
        'goals'
      );

      expect(result).toEqual({
        count: 1,
        overrides: 0,
        errors: 0,
        failures: [],
      });
      const storedGoal = registry.get('goals', 'modAlpha:incomplete_goal');
      expect(storedGoal).toBeDefined();
      expect(
        logger.warn.mock.calls.find(([message]) =>
          message.includes('GOAL_LOADER_ALLOW_DEFAULTS is enabled')
        )
      ).toBeTruthy();
    } finally {
      if (typeof originalFlag === 'undefined') {
        delete process.env.GOAL_LOADER_ALLOW_DEFAULTS;
      } else {
        process.env.GOAL_LOADER_ALLOW_DEFAULTS = originalFlag;
      }
    }
  });
});
