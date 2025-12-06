import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import GoalLoader from '../../../src/loaders/goalLoader.js';
import { ModValidationError } from '../../../src/errors/modValidationError.js';
import * as processHelper from '../../../src/loaders/helpers/processAndStoreItem.js';
import {
  createGoalFixture,
  getDefaultGoalFixture,
} from '../../fixtures/goals/createGoalFixture.js';

const PRIMARY_SCHEMA_ID = 'schema://living-narrative-engine/goal.schema.json';

/**
 *
 */
function createContractLoader() {
  const config = {
    getModsBasePath: jest.fn(),
    getContentTypeSchemaId: jest.fn().mockReturnValue(PRIMARY_SCHEMA_ID),
  };
  const pathResolver = { resolveModContentPath: jest.fn() };
  const dataFetcher = { fetch: jest.fn() };
  const schemaValidator = {
    isSchemaLoaded: jest.fn().mockReturnValue(true),
    validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
    getValidator: jest.fn(),
  };
  const dataRegistry = {
    store: jest.fn().mockReturnValue(false),
    get: jest.fn(),
    getAll: jest.fn(),
  };
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const loader = new GoalLoader(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  );

  return { loader, schemaValidator, dataRegistry, logger };
}

describe('GoalLoader contract', () => {
  const originalFlag = process.env.GOAL_LOADER_ALLOW_DEFAULTS;
  const originalDiagnosticsFlag =
    process.env.GOAL_LOADER_NORMALIZATION_DIAGNOSTICS;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    GoalLoader.clearNormalizationExtensions();
    if (typeof originalFlag === 'undefined') {
      delete process.env.GOAL_LOADER_ALLOW_DEFAULTS;
    } else {
      process.env.GOAL_LOADER_ALLOW_DEFAULTS = originalFlag;
    }
    if (typeof originalDiagnosticsFlag === 'undefined') {
      delete process.env.GOAL_LOADER_NORMALIZATION_DIAGNOSTICS;
    } else {
      process.env.GOAL_LOADER_NORMALIZATION_DIAGNOSTICS =
        originalDiagnosticsFlag;
    }
  });

  it('provides a deterministic minimal goal fixture snapshot', () => {
    expect(getDefaultGoalFixture()).toMatchInlineSnapshot(`
{
  "goalState": {
    "==": [
      1,
      1,
    ],
  },
  "id": "tests:minimal_goal",
  "priority": 1,
  "relevance": {
    "==": [
      1,
      1,
    ],
  },
}
`);
  });

  it('throws ModValidationError with structured context when schema validation fails', () => {
    const { loader, schemaValidator } = createContractLoader();
    schemaValidator.validate.mockReturnValue({
      isValid: false,
      errors: [
        {
          instancePath: '/priority',
          schemaPath: '#/properties/priority/minimum',
          keyword: 'minimum',
          message: 'must be >= 0',
        },
      ],
    });

    let thrown;
    try {
      loader._validatePrimarySchema(
        createGoalFixture({ priority: -1 }),
        'broken.goal.json',
        'modAlpha',
        '/virtual/broken.goal.json'
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ModValidationError);
    expect(thrown.code).toBe('GOAL_SCHEMA_VALIDATION_FAILED');
    expect(thrown.context).toMatchObject({
      filename: 'broken.goal.json',
      schemaPath: '#/properties/priority/minimum',
      instancePath: '/priority',
      dataSnippet: -1,
    });
  });

  it('normalizes lossy fixtures deterministically and records mutations', async () => {
    process.env.GOAL_LOADER_ALLOW_DEFAULTS = 'true';
    const { loader } = createContractLoader();
    const processSpy = jest
      .spyOn(processHelper, 'processAndStoreItem')
      .mockResolvedValue({
        qualifiedId: 'modAlpha:normalized',
        didOverride: false,
      });

    const lossyFixture = createGoalFixture({
      id: 'modAlpha:normalized',
      priority: '42',
      relevance: null,
      goalState: null,
    });

    await loader._processFetchedItem(
      'modAlpha',
      'normalized.goal.json',
      '/virtual/modAlpha/goals/normalized.goal.json',
      lossyFixture,
      'goals'
    );

    const normalized = processSpy.mock.calls[0][1].data;
    expect(normalized.priority).toBe(42);
    expect(normalized.relevance).toEqual({ '==': [1, 1] });
    expect(normalized.goalState).toEqual({
      '==': [{ var: 'state.goal.placeholder' }, true],
    });
    expect(normalized._normalization).toBeDefined();
    expect(normalized._normalization.mutations.length).toBeGreaterThan(0);
    expect(normalized._normalization.warnings.length).toBeGreaterThan(0);

    processSpy.mockRestore();
  });
});
