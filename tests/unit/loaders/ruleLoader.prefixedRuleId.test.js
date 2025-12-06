/**
 * @file Tests for RuleLoader handling of prefixed rule IDs
 * @description Verifies that RuleLoader correctly warns and strips prefixed rule IDs
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import RuleLoader from '../../../src/loaders/ruleLoader.js';
import {
  createMockPathResolver,
  createMockDataFetcher,
} from '../../common/mockFactories/index.js';

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
 * Creates a mock ISchemaValidator service.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../../src/interfaces/coreServices.js').ISchemaValidator} Mocked schema validator service.
 */
const createMockSchemaValidator = (overrides = {}) => {
  const loadedSchemas = new Map();
  const schemaValidators = new Map();

  const getOrCreateValidator = (schemaId) => {
    if (!schemaValidators.has(schemaId)) {
      schemaValidators.set(schemaId, () => ({ isValid: true, errors: null }));
    }
    return schemaValidators.get(schemaId);
  };

  const mockValidator = {
    addSchema: jest.fn((schemaData, schemaId) => {
      loadedSchemas.set(schemaId, schemaData);
      getOrCreateValidator(schemaId);
    }),
    validate: jest.fn((schemaId, data) => {
      const validatorFn = getOrCreateValidator(schemaId);
      return validatorFn(data);
    }),
    validateAgainstSchema: jest.fn((schemaId, data) => {
      const validatorFn = getOrCreateValidator(schemaId);
      return validatorFn(data);
    }),
    getValidator: jest.fn((schemaId) => getOrCreateValidator(schemaId)),
    isSchemaLoaded: jest.fn((schemaId) => loadedSchemas.has(schemaId)),
    _setSchemaLoaded: (schemaId, schemaData = {}) => {
      loadedSchemas.set(schemaId, schemaData);
    },
    mockValidatorFunction: (schemaId, validatorFn) => {
      schemaValidators.set(schemaId, validatorFn);
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
const createMockDataRegistry = (overrides = {}) => ({
  set: jest.fn((registryKey, itemId, value) => {}),
  store: jest.fn((registryKey, itemId, value) => {}),
  get: jest.fn((registryKey, itemId) => undefined),
  has: jest.fn((registryKey, itemId) => false),
  delete: jest.fn((registryKey, itemId) => true),
  getAllByType: jest.fn((registryKey) => new Map()),
  clear: jest.fn(),
  ...overrides,
});

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

describe('RuleLoader - Prefixed Rule ID Handling', () => {
  let mockConfig;
  let mockPathResolver;
  let mockFetcher;
  let mockValidator;
  let mockRegistry;
  let mockLogger;
  let ruleLoader;

  beforeEach(() => {
    mockConfig = createMockConfiguration();
    mockPathResolver = createMockPathResolver();
    mockPathResolver.resolveModContentPath.mockImplementation(
      (modIdValue, diskFolder, filenameValue) => {
        const baseDataPath = mockConfig.getBaseDataPath();
        const modsBasePath = mockConfig.getModsBasePath();
        const normalizedBase = baseDataPath.endsWith('/')
          ? baseDataPath.slice(0, -1)
          : baseDataPath;
        const normalizedModsBase = modsBasePath.endsWith('/')
          ? modsBasePath.slice(0, -1)
          : modsBasePath;
        return `${normalizedBase}/${normalizedModsBase}/${modIdValue}/${diskFolder}/${filenameValue}`;
      }
    );
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();

    ruleLoader = new RuleLoader(
      mockConfig,
      mockPathResolver,
      mockFetcher,
      mockValidator,
      mockRegistry,
      mockLogger
    );

    // Mark schema as loaded
    mockValidator._setSchemaLoaded(
      'schema://living-narrative-engine/rule.schema.json'
    );
  });

  describe('handling prefixed rule_id in data', () => {
    it('should warn when rule_id is already prefixed and strip the prefix', async () => {
      const modId = 'items';
      const filename = 'handle_aim_item.rule.json';
      const resolvedPath = `./data/mods/${modId}/rules/${filename}`;

      // Rule data with prefixed rule_id
      const ruleData = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'items:handle_aim_item', // Already prefixed!
        event_type: 'core:attempt_action',
        condition: {
          condition_ref: 'items:event-is-action-aim-item',
        },
        actions: [
          {
            type: 'LOG',
            parameters: {
              message: 'aim_item action attempted',
              level: 'debug',
            },
          },
        ],
      };

      // Configure fetcher to return this data
      mockFetcher = createMockDataFetcher({
        pathToResponse: {
          [resolvedPath]: ruleData,
        },
      });

      ruleLoader = new RuleLoader(
        mockConfig,
        mockPathResolver,
        mockFetcher,
        mockValidator,
        mockRegistry,
        mockLogger
      );

      // Configure manifest
      const manifest = {
        id: modId,
        version: '1.0.0',
        content: {
          rules: [filename],
        },
      };

      // Load the rule
      const loadResult = await ruleLoader.loadItemsForMod(
        modId,
        manifest,
        'rules',
        'rules',
        'rules'
      );

      expect(loadResult.count).toBe(1);

      // Verify warning was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "rule_id 'items:handle_aim_item' in handle_aim_item.rule.json already prefixed. Stripping prefix."
        )
      );

      // Verify the rule was stored with the correct ID (without duplicate prefix)
      expect(mockRegistry.store).toHaveBeenCalledWith(
        'rules',
        'items:handle_aim_item', // Should be stored with single prefix
        expect.objectContaining({
          rule_id: 'items:handle_aim_item',
        })
      );
    });

    it('should handle multiple rules with prefixed IDs', async () => {
      const modId = 'items';

      const rules = [
        {
          filename: 'handle_aim_item.rule.json',
          data: {
            $schema: 'schema://living-narrative-engine/rule.schema.json',
            rule_id: 'items:handle_aim_item',
            event_type: 'core:attempt_action',
            condition: { condition_ref: 'items:event-is-action-aim-item' },
            actions: [
              { type: 'LOG', parameters: { message: 'test', level: 'debug' } },
            ],
          },
        },
        {
          filename: 'handle_lower_aim.rule.json',
          data: {
            $schema: 'schema://living-narrative-engine/rule.schema.json',
            rule_id: 'items:handle_lower_aim',
            event_type: 'core:attempt_action',
            condition: { condition_ref: 'items:event-is-action-lower-aim' },
            actions: [
              { type: 'LOG', parameters: { message: 'test', level: 'debug' } },
            ],
          },
        },
      ];

      // Configure fetcher with both rules
      const pathToResponse = {};
      rules.forEach(({ filename, data }) => {
        pathToResponse[`./data/mods/${modId}/rules/${filename}`] = data;
      });

      mockFetcher = createMockDataFetcher({ pathToResponse });

      ruleLoader = new RuleLoader(
        mockConfig,
        mockPathResolver,
        mockFetcher,
        mockValidator,
        mockRegistry,
        mockLogger
      );

      const manifest = {
        id: modId,
        version: '1.0.0',
        content: {
          rules: rules.map((r) => r.filename),
        },
      };

      const loadResult = await ruleLoader.loadItemsForMod(
        modId,
        manifest,
        'rules',
        'rules',
        'rules'
      );

      expect(loadResult.count).toBe(rules.length);

      // Verify warnings were logged for both rules
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "rule_id 'items:handle_aim_item' in handle_aim_item.rule.json already prefixed. Stripping prefix."
        )
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "rule_id 'items:handle_lower_aim' in handle_lower_aim.rule.json already prefixed. Stripping prefix."
        )
      );
    });

    it('should not warn for unprefixed rule_id', async () => {
      const modId = 'items';
      const filename = 'valid_rule.rule.json';
      const resolvedPath = `./data/mods/${modId}/rules/${filename}`;

      const ruleData = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'handle_something', // No prefix
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'items:event-is-action-something' },
        actions: [
          { type: 'LOG', parameters: { message: 'test', level: 'debug' } },
        ],
      };

      mockFetcher = createMockDataFetcher({
        pathToResponse: {
          [resolvedPath]: ruleData,
        },
      });

      ruleLoader = new RuleLoader(
        mockConfig,
        mockPathResolver,
        mockFetcher,
        mockValidator,
        mockRegistry,
        mockLogger
      );

      const manifest = {
        id: modId,
        version: '1.0.0',
        content: {
          rules: [filename],
        },
      };

      const loadResult = await ruleLoader.loadItemsForMod(
        modId,
        manifest,
        'rules',
        'rules',
        'rules'
      );

      expect(loadResult.count).toBe(1);

      // Verify NO warning about prefixed rule_id
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('already prefixed')
      );
    });
  });
});
