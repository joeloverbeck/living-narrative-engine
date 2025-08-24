/**
 * @file Tests for schema inconsistency issues in RuleLoader
 * @description Reproduces runtime errors caused by operation schemas that don't inherit from base-operation.schema.json
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import RuleLoader from '../../../src/loaders/ruleLoader.js';
import {
  createMockPathResolver,
  createMockDataFetcher,
} from '../../common/mockFactories/index.js';

describe('RuleLoader - Schema Inconsistency Issues', () => {
  let ruleLoader;
  let mockConfig;
  let mockPathResolver;
  let mockDataFetcher;
  let mockSchemaValidator;
  let mockDataRegistry;
  let mockLogger;

  beforeEach(() => {
    // Create mock services following the pattern from ruleLoader.test.js
    mockConfig = {
      getContentBasePath: jest.fn(() => './data/mods/test-mod/rules'),
      getContentTypeSchemaId: jest.fn(() => 'schema://living-narrative-engine/rule.schema.json'),
      getSchemaBasePath: jest.fn(() => 'schemas'),
      getSchemaFiles: jest.fn(() => []),
      getWorldBasePath: jest.fn(() => 'worlds'),
      getBaseDataPath: jest.fn(() => './data'),
      getGameConfigFilename: jest.fn(() => 'game.json'),
      getModsBasePath: jest.fn(() => 'mods'),
      getModManifestFilename: jest.fn(() => 'mod-manifest.json'),
      getRuleBasePath: jest.fn(() => 'rules'),
      getRuleSchemaId: jest.fn(() => 'schema://living-narrative-engine/rule.schema.json'),
    };

    mockPathResolver = createMockPathResolver();
    mockDataFetcher = createMockDataFetcher();
    
    mockSchemaValidator = {
      validateData: jest.fn(),
      validate: jest.fn(),
      isSchemaLoaded: jest.fn(() => true),
      getValidationErrors: jest.fn(() => []),
      addSchema: jest.fn(),
      removeSchema: jest.fn(),
      getValidator: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(() => false),
      delete: jest.fn(),
      clear: jest.fn(),
      getKeys: jest.fn(() => []),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

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
            comment: 'Unlock movement after standing (handles both legacy and anatomy entities)',
            parameters: {
              actor_id: '{event.payload.actorId}'
            }
          }
        ]
      };

      // Setup mock to simulate schema validation failure
      mockSchemaValidator.validateData.mockReturnValue({
        isValid: false,
        errors: [
          {
            instancePath: '/actions/0',
            schemaPath: '#/additionalProperties',
            keyword: 'additionalProperties',
            params: { additionalProperty: 'comment' },
            message: 'must NOT have additional properties'
          }
        ]
      });

      mockDataFetcher.fetchData.mockResolvedValue(ruleWithCommentedUnlockMovement);
      mockPathResolver.resolvePath.mockReturnValue('./data/mods/test_mod/rules/test_rule.rule.json');

      // Act & Assert: This should fail validation due to schema inconsistency
      await expect(
        ruleLoader.loadItemsForMod('test_mod', {
          content: { rules: ['test_rule.rule.json'] }
        }, 'rules', 'rules', 'rules')
      ).rejects.toThrow(/Primary schema validation failed/);
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
              actor_id: '{event.payload.actorId}'
            }
          }
        ]
      };

      // Setup mock to simulate schema validation failure
      mockSchemaValidator.validateData.mockReturnValue({
        isValid: false,
        errors: [
          {
            instancePath: '/actions/0',
            schemaPath: '#/additionalProperties',
            keyword: 'additionalProperties',
            params: { additionalProperty: 'comment' },
            message: 'must NOT have additional properties'
          }
        ]
      });

      mockDataFetcher.fetchData.mockResolvedValue(ruleWithCommentedLockMovement);
      mockPathResolver.resolvePath.mockReturnValue('./data/mods/test_mod/rules/test_rule.rule.json');

      // Act & Assert: This should fail validation due to schema inconsistency
      await expect(
        ruleLoader.loadItemsForMod('test_mod', {
          content: { rules: ['test_rule.rule.json'] }
        }, 'rules', 'rules', 'rules')
      ).rejects.toThrow(/Primary schema validation failed/);
    });

    it('should reproduce the exact stand_up.rule.json validation failure pattern', async () => {
      // Arrange: Create a simplified version of the actual failing rule
      const standUpRuleSimplified = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'handle_stand_up',
        event_type: 'core:attempt_action',
        actions: [
          {
            type: 'GET_NAME',
            parameters: { entity_ref: 'actor', result_variable: 'actorName' }
          },
          {
            type: 'UNLOCK_MOVEMENT',
            comment: 'Unlock movement after standing (handles both legacy and anatomy entities)',
            parameters: {
              actor_id: '{event.payload.actorId}'
            }
          }
        ]
      };

      // Setup mock to simulate the exact validation failure pattern seen in logs
      mockSchemaValidator.validateData.mockReturnValue({
        isValid: false,
        errors: Array.from({ length: 148 }, (_, i) => ({
          instancePath: `/actions/1`,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: 'comment' },
          message: 'must NOT have additional properties',
          errorId: i
        }))
      });

      mockDataFetcher.fetchData.mockResolvedValue(standUpRuleSimplified);
      mockPathResolver.resolvePath.mockReturnValue('./data/mods/positioning/rules/stand_up.rule.json');

      // Act & Assert: This should fail with the same error pattern seen in the logs
      await expect(
        ruleLoader.loadItemsForMod('positioning', {
          content: { rules: ['stand_up.rule.json'] }
        }, 'rules', 'rules', 'rules')
      ).rejects.toThrow(/Primary schema validation failed for 'stand_up.rule.json'/);
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
              component_type: 'core:test_component'
            }
          }
        ]
      };

      // Setup mock to simulate successful validation (REMOVE_COMPONENT inherits from base schema)
      mockSchemaValidator.validateData.mockReturnValue({
        isValid: true,
        errors: []
      });

      mockDataFetcher.fetchData.mockResolvedValue(ruleWithWorkingOperation);
      mockPathResolver.resolvePath.mockReturnValue('./data/mods/test_mod/rules/working_rule.rule.json');

      // Act: This should succeed because REMOVE_COMPONENT inherits from base schema
      const result = await ruleLoader.loadItemsForMod('test_mod', {
        content: { rules: ['working_rule.rule.json'] }
      }, 'rules', 'rules', 'rules');

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
            parameters: operationType === 'UNLOCK_MOVEMENT' || operationType === 'LOCK_MOVEMENT'
              ? { actor_id: 'test_actor' }
              : { entity_ref: 'actor', component_type: 'core:test_component' }
          }
        ]
      });

      // Test working operation (inherits from base schema)
      mockSchemaValidator.validateData
        .mockReturnValueOnce({ isValid: true, errors: [] }) // REMOVE_COMPONENT succeeds
        .mockReturnValueOnce({ isValid: false, errors: [{ message: 'must NOT have additional properties' }] }) // UNLOCK_MOVEMENT fails
        .mockReturnValueOnce({ isValid: false, errors: [{ message: 'must NOT have additional properties' }] }); // LOCK_MOVEMENT fails

      mockDataFetcher.fetchData
        .mockResolvedValueOnce(ruleTemplate('REMOVE_COMPONENT'))
        .mockResolvedValueOnce(ruleTemplate('UNLOCK_MOVEMENT'))
        .mockResolvedValueOnce(ruleTemplate('LOCK_MOVEMENT'));

      mockPathResolver.resolvePath
        .mockReturnValueOnce('./data/mods/test_mod/rules/working.rule.json')
        .mockReturnValueOnce('./data/mods/test_mod/rules/broken_unlock.rule.json')
        .mockReturnValueOnce('./data/mods/test_mod/rules/broken_lock.rule.json');

      // Working operation should succeed
      const workingResult = await ruleLoader.loadItemsForMod('test_mod', {
        content: { rules: ['working.rule.json'] }
      }, 'rules', 'rules', 'rules');
      expect(workingResult.count).toBe(1);

      // Broken operations should fail
      await expect(
        ruleLoader.loadItemsForMod('test_mod', {
          content: { rules: ['broken_unlock.rule.json'] }
        }, 'rules', 'rules', 'rules')
      ).rejects.toThrow(/Primary schema validation failed/);

      await expect(
        ruleLoader.loadItemsForMod('test_mod', {
          content: { rules: ['broken_lock.rule.json'] }
        }, 'rules', 'rules', 'rules')
      ).rejects.toThrow(/Primary schema validation failed/);
    });
  });
});