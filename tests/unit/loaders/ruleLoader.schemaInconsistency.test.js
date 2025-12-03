/**
 * @file Tests for schema inconsistency issues in RuleLoader
 * @description Reproduces runtime errors caused by operation schemas that don't inherit from base-operation.schema.json
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import RuleLoader from '../../../src/loaders/ruleLoader.js';
import {
  createMockPathResolver,
  createMockDataFetcher,
} from '../../common/mockFactories/index.js';

// --- Mock Service Factories (Using patterns from ruleLoader.test.js) ---

/**
 * Creates a mock IConfiguration service.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../../src/interfaces/coreServices.js').IConfiguration} Mocked configuration service.
 */
const createMockConfiguration = (overrides = {}) => ({
  getContentBasePath: jest.fn(
    (registryKey) => `./data/mods/test-mod/${registryKey}`
  ),
  getContentTypeSchemaId: jest.fn((registryKey) => {
    if (registryKey === 'rules') {
      return 'schema://living-narrative-engine/rule.schema.json';
    }
    return `schema://living-narrative-engine/${registryKey}.schema.json`;
  }),
  getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getWorldBasePath: jest.fn().mockReturnValue('worlds'),
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModsBasePath: jest.fn().mockReturnValue('mods'),
  getModManifestFilename: jest.fn().mockReturnValue('mod-manifest.json'),
  getRuleBasePath: jest.fn().mockReturnValue('rules'),
  getRuleSchemaId: jest
    .fn()
    .mockReturnValue('schema://living-narrative-engine/rule.schema.json'),
  ...overrides,
});

/**
 * Creates a mock ISchemaValidator service with helpers for configuration.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../../src/interfaces/coreServices.js').ISchemaValidator & {mockValidatorFunction: Function}} Mocked schema validator service with test helpers.
 */
const createMockSchemaValidator = (overrides = {}) => {
  const loadedSchemas = new Map();
  const schemaValidators = new Map();

  const mockValidator = {
    addSchema: jest.fn(async (schemaData, schemaId) => {
      loadedSchemas.set(schemaId, schemaData);
      if (!schemaValidators.has(schemaId)) {
        schemaValidators.set(
          schemaId,
          jest.fn(() => ({ isValid: true, errors: null }))
        );
      }
    }),
    removeSchema: jest.fn((schemaId) => {
      loadedSchemas.delete(schemaId);
      schemaValidators.delete(schemaId);
    }),
    validate: jest.fn((schemaId, data) => {
      const validatorFunc = schemaValidators.get(schemaId);
      if (!validatorFunc) {
        return {
          isValid: false,
          errors: [{ message: `No validator for schema ${schemaId}` }],
        };
      }
      return validatorFunc(data);
    }),
    isSchemaLoaded: jest.fn((schemaId) => loadedSchemas.has(schemaId)),
    getValidationErrors: jest.fn(() => []),
    getValidator: jest.fn((schemaId) => schemaValidators.get(schemaId)),
    // Helper to allow tests to customize validator behavior per schema
    mockValidatorFunction: (schemaId, implementation) => {
      if (typeof implementation !== 'function') {
        throw new Error(
          'mockValidatorFunction requires a function as the implementation.'
        );
      }
      const mockFn = jest.fn(implementation);
      schemaValidators.set(schemaId, mockFn);
      if (!loadedSchemas.has(schemaId)) {
        loadedSchemas.set(schemaId, {});
      }
      return mockFn;
    },
    ...overrides,
  };
  return mockValidator;
};

/**
 * Creates a mock IDataRegistry service.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../../src/interfaces/coreServices.js').IDataRegistry} Mocked data registry service.
 */
const createMockDataRegistry = (overrides = {}) => {
  const registryStore = {};

  return {
    store: jest.fn((type, id, data) => {
      if (!registryStore[type]) {
        registryStore[type] = {};
      }
      try {
        registryStore[type][id] = JSON.parse(JSON.stringify(data));
      } catch (e) {
        console.error(
          `MockDataRegistry Error: Could not clone data for ${type}/${id}.`,
          data
        );
        throw e;
      }
    }),
    get: jest.fn((type, id) => {
      const item = registryStore[type]?.[id];
      try {
        return item ? JSON.parse(JSON.stringify(item)) : undefined;
      } catch (e) {
        console.error(
          `MockDataRegistry Error: Could not clone retrieved data for ${type}/${id}.`,
          item
        );
        throw e;
      }
    }),
    has: jest.fn((type, id) => Boolean(registryStore[type]?.[id])),
    delete: jest.fn((type, id) => {
      if (registryStore[type]) {
        delete registryStore[type][id];
        return true;
      }
      return false;
    }),
    clear: jest.fn(() => {
      Object.keys(registryStore).forEach((key) => delete registryStore[key]);
    }),
    getKeys: jest.fn((type) => {
      return registryStore[type] ? Object.keys(registryStore[type]) : [];
    }),
    ...overrides,
  };
};

/**
 * Creates a mock ILogger service.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../../src/interfaces/coreServices.js').ILogger} Mocked logger service.
 */
const createMockLogger = (overrides = {}) => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  ...overrides,
});

describe('RuleLoader - Schema Inconsistency Issues', () => {
  let ruleLoader;
  let mockConfig;
  let mockPathResolver;
  let mockDataFetcher;
  let mockSchemaValidator;
  let mockDataRegistry;
  let mockLogger;
  const defaultRuleSchemaId =
    'schema://living-narrative-engine/rule.schema.json';

  beforeEach(() => {
    // Create mock services using the proper factory functions
    mockConfig = createMockConfiguration();
    mockPathResolver = createMockPathResolver();
    mockDataFetcher = createMockDataFetcher();
    mockSchemaValidator = createMockSchemaValidator();
    mockDataRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();

    // Configure the rule schema to be loaded by default
    mockSchemaValidator.mockValidatorFunction(defaultRuleSchemaId, () => ({
      isValid: true,
      errors: null,
    }));

    ruleLoader = new RuleLoader(
      mockConfig,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      mockDataRegistry,
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Movement Operations Schema Validation', () => {
    it('should fail validation for UNLOCK_MOVEMENT with comment field', async () => {
      // Arrange: Create a rule that uses UNLOCK_MOVEMENT with a comment (like stand_up.rule.json)
      const ruleWithCommentedUnlockMovement = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'test_unlock_movement_with_comment',
        event_type: 'core:test_event',
        actions: [
          {
            type: 'UNLOCK_MOVEMENT',
            comment:
              'Unlock movement after standing (handles both legacy and anatomy entities)',
            parameters: {
              actor_id: '{event.payload.actorId}',
            },
          },
        ],
      };

      // Setup mock to simulate schema validation failure
      mockSchemaValidator.mockValidatorFunction(defaultRuleSchemaId, () => ({
        isValid: false,
        errors: [
          {
            instancePath: '/actions/0',
            schemaPath: '#/additionalProperties',
            keyword: 'additionalProperties',
            params: { additionalProperty: 'comment' },
            message: 'must NOT have additional properties',
          },
        ],
      }));

      mockDataFetcher.fetch.mockResolvedValue(ruleWithCommentedUnlockMovement);
      mockPathResolver.resolveModContentPath.mockReturnValue(
        './data/mods/test_mod/rules/test_rule.rule.json'
      );

      // Act: This should fail validation due to schema inconsistency
      const result = await ruleLoader.loadItemsForMod(
        'test_mod',
        {
          content: { rules: ['test_rule.rule.json'] },
        },
        'rules',
        'rules',
        'rules'
      );

      // Assert: Should have 0 successful loads and 1 error
      expect(result.count).toBe(0);
      expect(result.errors).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].error.message).toMatch(
        /Primary schema validation failed/
      );
    });

    it('should fail validation for LOCK_MOVEMENT with comment field', async () => {
      // Arrange: Create a rule that uses LOCK_MOVEMENT with a comment
      const ruleWithCommentedLockMovement = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'test_lock_movement_with_comment',
        event_type: 'core:test_event',
        actions: [
          {
            type: 'LOCK_MOVEMENT',
            comment: 'Lock movement during special action',
            parameters: {
              actor_id: '{event.payload.actorId}',
            },
          },
        ],
      };

      // Setup mock to simulate schema validation failure
      mockSchemaValidator.mockValidatorFunction(defaultRuleSchemaId, () => ({
        isValid: false,
        errors: [
          {
            instancePath: '/actions/0',
            schemaPath: '#/additionalProperties',
            keyword: 'additionalProperties',
            params: { additionalProperty: 'comment' },
            message: 'must NOT have additional properties',
          },
        ],
      }));

      mockDataFetcher.fetch.mockResolvedValue(ruleWithCommentedLockMovement);
      mockPathResolver.resolveModContentPath.mockReturnValue(
        './data/mods/test_mod/rules/test_rule.rule.json'
      );

      // Act: This should fail validation due to schema inconsistency
      const result = await ruleLoader.loadItemsForMod(
        'test_mod',
        {
          content: { rules: ['test_rule.rule.json'] },
        },
        'rules',
        'rules',
        'rules'
      );

      // Assert: Should have 0 successful loads and 1 error
      expect(result.count).toBe(0);
      expect(result.errors).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].error.message).toMatch(
        /Primary schema validation failed/
      );
    });

    it('should reproduce the exact stand_up.rule.json validation failure pattern', async () => {
      // Arrange: Create a simplified version of the actual failing rule
      const standUpRuleSimplified = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'deference_handle_stand_up',
        event_type: 'core:attempt_action',
        actions: [
          {
            type: 'GET_NAME',
            parameters: { entity_ref: 'actor', result_variable: 'actorName' },
          },
          {
            type: 'UNLOCK_MOVEMENT',
            comment:
              'Unlock movement after standing (handles both legacy and anatomy entities)',
            parameters: {
              actor_id: '{event.payload.actorId}',
            },
          },
        ],
      };

      // Setup mock to simulate the exact validation failure pattern seen in logs
      mockSchemaValidator.mockValidatorFunction(defaultRuleSchemaId, () => ({
        isValid: false,
        errors: Array.from({ length: 148 }, (_, i) => ({
          instancePath: `/actions/1`,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: 'comment' },
          message: 'must NOT have additional properties',
          errorId: i,
        })),
      }));

      mockDataFetcher.fetch.mockResolvedValue(standUpRuleSimplified);
      mockPathResolver.resolveModContentPath.mockReturnValue(
        './data/mods/deference/rules/stand_up.rule.json'
      );

      // Act: This should fail with the same error pattern seen in the logs
      const result = await ruleLoader.loadItemsForMod(
        'deference',
        {
          content: { rules: ['stand_up.rule.json'] },
        },
        'rules',
        'rules',
        'rules'
      );

      // Assert: Should have 0 successful loads and 1 error
      expect(result.count).toBe(0);
      expect(result.errors).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].error.message).toMatch(
        /Primary schema validation failed for 'stand_up.rule.json'/
      );
    });
  });

  describe('Comparison with Working Operations', () => {
    it('should successfully validate operations that properly inherit from base schema', async () => {
      // Arrange: Create a rule with a properly-defined operation that includes comment
      const ruleWithWorkingOperation = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'test_working_operation',
        event_type: 'core:test_event',
        actions: [
          {
            type: 'REMOVE_COMPONENT',
            comment: 'This comment should work fine with REMOVE_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'core:test_component',
            },
          },
        ],
      };

      // Setup mock to simulate successful validation (REMOVE_COMPONENT inherits from base schema)
      mockSchemaValidator.mockValidatorFunction(defaultRuleSchemaId, () => ({
        isValid: true,
        errors: [],
      }));

      mockDataFetcher.fetch.mockResolvedValue(ruleWithWorkingOperation);
      mockPathResolver.resolveModContentPath.mockReturnValue(
        './data/mods/test_mod/rules/working_rule.rule.json'
      );

      // Act: This should succeed because REMOVE_COMPONENT inherits from base schema
      const result = await ruleLoader.loadItemsForMod(
        'test_mod',
        {
          content: { rules: ['working_rule.rule.json'] },
        },
        'rules',
        'rules',
        'rules'
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.count).toBe(1);
      expect(result.errors).toBe(0);
    });

    it('should demonstrate the schema inheritance difference between working and broken operations', async () => {
      // This test demonstrates the core issue: identical rule structures succeed or fail
      // based solely on whether the operation schema inherits from base-operation.schema.json

      const ruleTemplate = (operationType) => ({
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: `test_${operationType.toLowerCase()}`,
        event_type: 'core:test_event',
        actions: [
          {
            type: operationType,
            comment: 'Testing comment field support',
            parameters:
              operationType === 'UNLOCK_MOVEMENT' ||
              operationType === 'LOCK_MOVEMENT'
                ? { actor_id: 'test_actor' }
                : {
                    entity_ref: 'actor',
                    component_type: 'core:test_component',
                  },
          },
        ],
      });

      // Test working operation (inherits from base schema)
      mockDataFetcher.fetch
        .mockResolvedValueOnce(ruleTemplate('REMOVE_COMPONENT'))
        .mockResolvedValueOnce(ruleTemplate('UNLOCK_MOVEMENT'))
        .mockResolvedValueOnce(ruleTemplate('LOCK_MOVEMENT'));

      mockPathResolver.resolveModContentPath
        .mockReturnValueOnce('./data/mods/test_mod/rules/working.rule.json')
        .mockReturnValueOnce(
          './data/mods/test_mod/rules/broken_unlock.rule.json'
        )
        .mockReturnValueOnce(
          './data/mods/test_mod/rules/broken_lock.rule.json'
        );

      // Setup sequential validation responses - working first, then failures
      let callCount = 0;
      mockSchemaValidator.mockValidatorFunction(defaultRuleSchemaId, () => {
        callCount++;
        if (callCount === 1) {
          return { isValid: true, errors: [] }; // REMOVE_COMPONENT succeeds
        } else {
          return {
            isValid: false,
            errors: [{ message: 'must NOT have additional properties' }],
          }; // Others fail
        }
      });

      // Working operation should succeed
      const workingResult = await ruleLoader.loadItemsForMod(
        'test_mod',
        {
          content: { rules: ['working.rule.json'] },
        },
        'rules',
        'rules',
        'rules'
      );
      expect(workingResult.count).toBe(1);

      // Reset call count and setup failure responses for subsequent calls
      callCount = 0;
      mockSchemaValidator.mockValidatorFunction(defaultRuleSchemaId, () => ({
        isValid: false,
        errors: [{ message: 'must NOT have additional properties' }],
      }));

      // Broken operations should fail
      const unlockResult = await ruleLoader.loadItemsForMod(
        'test_mod',
        {
          content: { rules: ['broken_unlock.rule.json'] },
        },
        'rules',
        'rules',
        'rules'
      );

      expect(unlockResult.count).toBe(0);
      expect(unlockResult.errors).toBe(1);
      expect(unlockResult.failures[0].error.message).toMatch(
        /Primary schema validation failed/
      );

      const lockResult = await ruleLoader.loadItemsForMod(
        'test_mod',
        {
          content: { rules: ['broken_lock.rule.json'] },
        },
        'rules',
        'rules',
        'rules'
      );

      expect(lockResult.count).toBe(0);
      expect(lockResult.errors).toBe(1);
      expect(lockResult.failures[0].error.message).toMatch(
        /Primary schema validation failed/
      );
    });
  });
});
