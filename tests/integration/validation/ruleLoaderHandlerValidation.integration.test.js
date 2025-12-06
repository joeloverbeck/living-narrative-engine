/**
 * @file Integration tests for handler validation during rule loading.
 * Verifies that RuleLoader validates operation handlers via HandlerCompletenessValidator.
 * @see tickets/ROBOPEHANVAL-005-rule-loader-validation-integration.md
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import RuleLoader from '../../../src/loaders/ruleLoader.js';
import { HandlerCompletenessValidator } from '../../../src/validation/handlerCompletenessValidator.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import { ConfigurationError } from '../../../src/errors/configurationError.js';

describe('RuleLoader Handler Validation Integration', () => {
  let mockConfig;
  let mockPathResolver;
  let mockFetcher;
  let mockSchemaValidator;
  let mockDataRegistry;
  let mockLogger;
  let operationRegistry;
  let handlerValidator;

  beforeEach(() => {
    // Create mock dependencies
    mockConfig = {
      get: jest.fn().mockReturnValue('data/mods'),
      getModsBasePath: jest.fn().mockReturnValue('data/mods'),
      getContentTypeSchemaId: jest.fn().mockReturnValue('system-rule'),
    };
    mockPathResolver = {
      resolvePath: jest.fn((base, relative) => `${base}/${relative}`),
      resolveModContentPath: jest.fn(
        (modId, contentType, filename) =>
          `data/mods/${modId}/${contentType}/${filename}`
      ),
    };
    mockFetcher = {
      fetch: jest.fn(),
    };
    mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ valid: true, errors: [] }),
      getValidator: jest.fn().mockReturnValue(() => true),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
    };
    mockDataRegistry = {
      get: jest.fn().mockReturnValue(null), // Return null for "no existing item"
      store: jest.fn().mockReturnValue(false), // Return false for "did not override"
      exists: jest.fn().mockReturnValue(false),
      getMacros: jest.fn().mockReturnValue([]),
    };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create real instances for integration testing
    operationRegistry = new OperationRegistry({ logger: mockLogger });
    handlerValidator = new HandlerCompletenessValidator({ logger: mockLogger });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rule Loading with Valid Operations', () => {
    it('should load rule successfully when all operations have registered handlers', async () => {
      // Arrange - Register handlers for all operations in the rule
      operationRegistry.register('LOG', () => {});
      operationRegistry.register('SET_COMPONENT_VALUE', () => {});

      const ruleLoader = new RuleLoader(
        mockConfig,
        mockPathResolver,
        mockFetcher,
        mockSchemaValidator,
        mockDataRegistry,
        mockLogger,
        handlerValidator,
        operationRegistry
      );

      const ruleData = {
        rule_id: 'test_rule',
        trigger: { event_type: 'TEST_EVENT' },
        actions: [
          { type: 'LOG', parameters: { message: 'test' } },
          {
            type: 'SET_COMPONENT_VALUE',
            parameters: { component: 'core:test', value: 1 },
          },
        ],
      };

      // Act - Call _processFetchedItem directly (simulating internal loader flow)
      const result = await ruleLoader._processFetchedItem(
        'test_mod',
        'test_rule.rule.json',
        '/path/to/test_rule.rule.json',
        ruleData,
        'rules'
      );

      // Assert
      expect(result.qualifiedId).toBe('test_mod:test_rule');
      expect(result.didOverride).toBeDefined();
    });

    it('should validate nested operations in IF blocks', async () => {
      // Arrange - Register all handlers including those in nested blocks
      operationRegistry.register('IF', () => {});
      operationRegistry.register('LOG', () => {});
      operationRegistry.register('SET_COMPONENT_VALUE', () => {});

      const ruleLoader = new RuleLoader(
        mockConfig,
        mockPathResolver,
        mockFetcher,
        mockSchemaValidator,
        mockDataRegistry,
        mockLogger,
        handlerValidator,
        operationRegistry
      );

      const ruleData = {
        rule_id: 'nested_rule',
        trigger: { event_type: 'TEST_EVENT' },
        actions: [
          {
            type: 'IF',
            parameters: {
              condition: { '==': [1, 1] },
              then_actions: [{ type: 'LOG', parameters: { message: 'then' } }],
              else_actions: [
                {
                  type: 'SET_COMPONENT_VALUE',
                  parameters: { component: 'core:test', value: 0 },
                },
              ],
            },
          },
        ],
      };

      // Act & Assert - Should not throw
      await expect(
        ruleLoader._processFetchedItem(
          'test_mod',
          'nested_rule.rule.json',
          '/path/to/nested_rule.rule.json',
          ruleData,
          'rules'
        )
      ).resolves.toBeDefined();
    });
  });

  describe('Rule Loading with Missing Handlers', () => {
    it('should throw ConfigurationError when operation lacks registered handler', async () => {
      // Arrange - Only register LOG, not SET_COMPONENT_VALUE
      operationRegistry.register('LOG', () => {});

      const ruleLoader = new RuleLoader(
        mockConfig,
        mockPathResolver,
        mockFetcher,
        mockSchemaValidator,
        mockDataRegistry,
        mockLogger,
        handlerValidator,
        operationRegistry
      );

      const ruleData = {
        rule_id: 'bad_rule',
        trigger: { event_type: 'TEST_EVENT' },
        actions: [
          { type: 'LOG', parameters: { message: 'test' } },
          { type: 'UNREGISTERED_OPERATION', parameters: {} },
        ],
      };

      // Act & Assert
      await expect(
        ruleLoader._processFetchedItem(
          'test_mod',
          'bad_rule.rule.json',
          '/path/to/bad_rule.rule.json',
          ruleData,
          'rules'
        )
      ).rejects.toThrow(ConfigurationError);
    });

    it('should include rule ID in error message', async () => {
      // Arrange - No handlers registered
      const ruleLoader = new RuleLoader(
        mockConfig,
        mockPathResolver,
        mockFetcher,
        mockSchemaValidator,
        mockDataRegistry,
        mockLogger,
        handlerValidator,
        operationRegistry
      );

      const ruleData = {
        rule_id: 'specific_rule_name',
        trigger: { event_type: 'TEST_EVENT' },
        actions: [{ type: 'MISSING_HANDLER_OP', parameters: {} }],
      };

      // Act & Assert
      await expect(
        ruleLoader._processFetchedItem(
          'my_mod',
          'specific_rule_name.rule.json',
          '/path/to/specific_rule_name.rule.json',
          ruleData,
          'rules'
        )
      ).rejects.toThrow(/my_mod:specific_rule_name/);
    });

    it('should include operation type in error message', async () => {
      // Arrange
      const ruleLoader = new RuleLoader(
        mockConfig,
        mockPathResolver,
        mockFetcher,
        mockSchemaValidator,
        mockDataRegistry,
        mockLogger,
        handlerValidator,
        operationRegistry
      );

      const ruleData = {
        rule_id: 'test_rule',
        trigger: { event_type: 'TEST_EVENT' },
        actions: [{ type: 'CUSTOM_UNREGISTERED_TYPE', parameters: {} }],
      };

      // Act & Assert
      await expect(
        ruleLoader._processFetchedItem(
          'test_mod',
          'test_rule.rule.json',
          '/path/to/test_rule.rule.json',
          ruleData,
          'rules'
        )
      ).rejects.toThrow(/CUSTOM_UNREGISTERED_TYPE/);
    });

    it('should detect missing handlers in nested IF then_actions', async () => {
      // Arrange - Register IF but not the nested operation
      operationRegistry.register('IF', () => {});

      const ruleLoader = new RuleLoader(
        mockConfig,
        mockPathResolver,
        mockFetcher,
        mockSchemaValidator,
        mockDataRegistry,
        mockLogger,
        handlerValidator,
        operationRegistry
      );

      const ruleData = {
        rule_id: 'nested_missing',
        trigger: { event_type: 'TEST_EVENT' },
        actions: [
          {
            type: 'IF',
            parameters: {
              condition: { '==': [1, 1] },
              then_actions: [{ type: 'NESTED_UNREGISTERED', parameters: {} }],
            },
          },
        ],
      };

      // Act & Assert
      await expect(
        ruleLoader._processFetchedItem(
          'test_mod',
          'nested_missing.rule.json',
          '/path/to/nested_missing.rule.json',
          ruleData,
          'rules'
        )
      ).rejects.toThrow(/NESTED_UNREGISTERED/);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work without handler validator (optional dependency)', async () => {
      // Arrange - Create loader without validator
      const ruleLoader = new RuleLoader(
        mockConfig,
        mockPathResolver,
        mockFetcher,
        mockSchemaValidator,
        mockDataRegistry,
        mockLogger
        // No handlerValidator or operationRegistry
      );

      const ruleData = {
        rule_id: 'no_validation_rule',
        trigger: { event_type: 'TEST_EVENT' },
        actions: [{ type: 'ANYTHING_GOES', parameters: {} }],
      };

      // Act & Assert - Should not throw even with unregistered operations
      await expect(
        ruleLoader._processFetchedItem(
          'test_mod',
          'no_validation_rule.rule.json',
          '/path/to/no_validation_rule.rule.json',
          ruleData,
          'rules'
        )
      ).resolves.toBeDefined();
    });

    it('should work with only handlerValidator provided (no registry)', async () => {
      // Arrange - Provide validator but no registry
      const ruleLoader = new RuleLoader(
        mockConfig,
        mockPathResolver,
        mockFetcher,
        mockSchemaValidator,
        mockDataRegistry,
        mockLogger,
        handlerValidator,
        null // No operation registry
      );

      const ruleData = {
        rule_id: 'partial_deps_rule',
        trigger: { event_type: 'TEST_EVENT' },
        actions: [{ type: 'UNVALIDATED_OP', parameters: {} }],
      };

      // Act & Assert - Should not throw since validation requires both deps
      await expect(
        ruleLoader._processFetchedItem(
          'test_mod',
          'partial_deps_rule.rule.json',
          '/path/to/partial_deps_rule.rule.json',
          ruleData,
          'rules'
        )
      ).resolves.toBeDefined();
    });
  });

  describe('Multiple Operations Validation', () => {
    it('should collect all missing handlers, not just first', async () => {
      // Arrange - No handlers registered
      const ruleLoader = new RuleLoader(
        mockConfig,
        mockPathResolver,
        mockFetcher,
        mockSchemaValidator,
        mockDataRegistry,
        mockLogger,
        handlerValidator,
        operationRegistry
      );

      const ruleData = {
        rule_id: 'multi_missing',
        trigger: { event_type: 'TEST_EVENT' },
        actions: [
          { type: 'MISSING_A', parameters: {} },
          { type: 'MISSING_B', parameters: {} },
          { type: 'MISSING_C', parameters: {} },
        ],
      };

      // Act & Assert - Error should mention multiple missing handlers
      const resultPromise = ruleLoader._processFetchedItem(
        'test_mod',
        'multi_missing.rule.json',
        '/path/to/multi_missing.rule.json',
        ruleData,
        'rules'
      );

      await expect(resultPromise).rejects.toThrow(ConfigurationError);
      await expect(resultPromise).rejects.toThrow(/MISSING_A/);
      await expect(resultPromise).rejects.toThrow(/MISSING_B/);
      await expect(resultPromise).rejects.toThrow(/MISSING_C/);
    });
  });
});
