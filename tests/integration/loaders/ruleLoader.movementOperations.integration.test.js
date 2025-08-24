/**
 * @file Integration tests for movement operations schema validation issues
 * @description Tests the actual mod loading pipeline with movement operations that have comments
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import Container from '../../../src/dependencyInjection/container.js';
import { registerInfrastructureServices } from '../../../src/dependencyInjection/registrations/infrastructureRegistrations.js';
import { registerLoadersServices } from '../../../src/dependencyInjection/registrations/loadersRegistrations.js';
import { tokens } from '../../../src/dependencyInjection/tokens/tokens-core.js';

describe('RuleLoader Movement Operations - Integration Tests', () => {
  let container;
  let ruleLoader;
  let tempDir;
  let tempModDir;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp('rule-loader-test-');
    tempModDir = path.join(tempDir, 'mods', 'test-mod');
    await fs.mkdir(tempModDir, { recursive: true });
    await fs.mkdir(path.join(tempModDir, 'rules'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'schemas'), { recursive: true });

    // Set up dependency injection container
    container = new Container();
    registerInfrastructureServices(container);
    registerLoadersServices(container);

    // Configure for test environment
    const config = container.resolve(tokens.IConfiguration);
    config.getBaseDataPath = () => tempDir;
    config.getModsBasePath = () => path.join(tempDir, 'mods');

    ruleLoader = container.resolve(tokens.IRuleLoader);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Schema Validation Failures', () => {
    it('should fail to load rule with UNLOCK_MOVEMENT and comment due to schema issues', async () => {
      // Arrange: Create a rule file similar to stand_up.rule.json that has the problem
      const problemRule = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'test_unlock_with_comment',
        event_type: 'core:attempt_action',
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

      const ruleFilePath = path.join(tempModDir, 'rules', 'problem_rule.rule.json');
      await fs.writeFile(ruleFilePath, JSON.stringify(problemRule, null, 2));

      const manifest = {
        id: 'test_mod',
        version: '1.0.0',
        name: 'Test Mod',
        content: {
          rules: ['problem_rule.rule.json']
        }
      };

      // Act & Assert: This should fail with schema validation error
      await expect(
        ruleLoader.loadItemsForMod('test_mod', manifest, 'rules', 'rules', 'rules')
      ).rejects.toThrow(/Primary schema validation failed/);
    });

    it('should fail to load rule with LOCK_MOVEMENT and comment due to schema issues', async () => {
      // Arrange: Create a rule file with LOCK_MOVEMENT that has a comment
      const problemRule = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'test_lock_with_comment',
        event_type: 'core:attempt_action',
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

      const ruleFilePath = path.join(tempModDir, 'rules', 'lock_problem.rule.json');
      await fs.writeFile(ruleFilePath, JSON.stringify(problemRule, null, 2));

      const manifest = {
        id: 'test_mod',
        version: '1.0.0',
        name: 'Test Mod',
        content: {
          rules: ['lock_problem.rule.json']
        }
      };

      // Act & Assert: This should fail with schema validation error
      await expect(
        ruleLoader.loadItemsForMod('test_mod', manifest, 'rules', 'rules', 'rules')
      ).rejects.toThrow(/Primary schema validation failed/);
    });

    it('should successfully load rules with operations that properly inherit from base schema', async () => {
      // Arrange: Create a rule file with an operation that works (inherits from base schema)
      const workingRule = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'test_working_operation',
        event_type: 'core:attempt_action',
        actions: [
          {
            type: 'REMOVE_COMPONENT',
            comment: 'This comment should work because REMOVE_COMPONENT inherits from base schema',
            parameters: {
              entity_ref: 'actor',
              component_type: 'positioning:kneeling_before'
            }
          }
        ]
      };

      const ruleFilePath = path.join(tempModDir, 'rules', 'working_rule.rule.json');
      await fs.writeFile(ruleFilePath, JSON.stringify(workingRule, null, 2));

      const manifest = {
        id: 'test_mod',
        version: '1.0.0',
        name: 'Test Mod',
        content: {
          rules: ['working_rule.rule.json']
        }
      };

      // Act: This should succeed
      const result = await ruleLoader.loadItemsForMod('test_mod', manifest, 'rules', 'rules', 'rules');

      // Assert
      expect(result).toBeDefined();
      expect(result.count).toBe(1);
      expect(result.errors).toBe(0);
    });

    it('should reproduce the specific stand_up.rule.json pattern that fails in production', async () => {
      // Arrange: Create a rule that mimics the actual stand_up.rule.json structure that's failing
      const standUpLikeRule = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'handle_stand_up_test',
        comment: 'Handles the positioning:stand_up action. Removes kneeling component, dispatches descriptive text and ends the turn.',
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'positioning:event-is-action-stand-up' },
        actions: [
          {
            type: 'GET_NAME',
            parameters: { entity_ref: 'actor', result_variable: 'actorName' }
          },
          {
            type: 'QUERY_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'core:position',
              result_variable: 'actorPosition'
            }
          },
          {
            type: 'REMOVE_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'positioning:kneeling_before'
            }
          },
          {
            type: 'UNLOCK_MOVEMENT',
            comment: 'Unlock movement after standing (handles both legacy and anatomy entities)',
            parameters: {
              actor_id: '{event.payload.actorId}'
            }
          },
          {
            type: 'SET_VARIABLE',
            parameters: {
              variable_name: 'logMessage',
              value: '{context.actorName} stands up from their kneeling position.'
            }
          }
        ]
      };

      const ruleFilePath = path.join(tempModDir, 'rules', 'stand_up_test.rule.json');
      await fs.writeFile(ruleFilePath, JSON.stringify(standUpLikeRule, null, 2));

      const manifest = {
        id: 'positioning_test',
        version: '1.0.0',
        name: 'Positioning Test Mod',
        content: {
          rules: ['stand_up_test.rule.json']
        }
      };

      // Act & Assert: This should fail with the same type of error seen in the logs
      await expect(
        ruleLoader.loadItemsForMod('positioning_test', manifest, 'rules', 'rules', 'rules')
      ).rejects.toThrow(/Primary schema validation failed for 'stand_up_test.rule.json'/);
    });
  });

  describe('Demonstration of Schema Inheritance Issue', () => {
    it('should show that identical rule structures succeed or fail based only on operation schema design', async () => {
      // This test demonstrates the core problem: the same comment field works with some
      // operations but not others, depending on whether they inherit from base-operation.schema.json
      
      const createRuleWithOperation = (operationType, fileName) => ({
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: `test_${operationType.toLowerCase().replace('_', '')}`,
        event_type: 'core:test_event',
        actions: [
          {
            type: operationType,
            comment: 'This exact same comment field causes different behavior',
            parameters: operationType.includes('MOVEMENT')
              ? { actor_id: 'test_actor' }
              : { entity_ref: 'actor', component_type: 'core:test_component' }
          }
        ]
      });

      // Create rule files with different operations but identical structure
      const operations = [
        { type: 'REMOVE_COMPONENT', file: 'working_remove.rule.json', shouldWork: true },
        { type: 'UNLOCK_MOVEMENT', file: 'failing_unlock.rule.json', shouldWork: false },
        { type: 'LOCK_MOVEMENT', file: 'failing_lock.rule.json', shouldWork: false }
      ];

      for (const op of operations) {
        const rule = createRuleWithOperation(op.type, op.file);
        const ruleFilePath = path.join(tempModDir, 'rules', op.file);
        await fs.writeFile(ruleFilePath, JSON.stringify(rule, null, 2));
      }

      // Test each operation
      for (const op of operations) {
        const manifest = {
          id: 'test_mod',
          version: '1.0.0',
          name: 'Test Mod',
          content: {
            rules: [op.file]
          }
        };

        if (op.shouldWork) {
          // This should succeed
          const result = await ruleLoader.loadItemsForMod('test_mod', manifest, 'rules', 'rules', 'rules');
          expect(result.count).toBe(1);
          expect(result.errors).toBe(0);
        } else {
          // This should fail due to schema inconsistency
          await expect(
            ruleLoader.loadItemsForMod('test_mod', manifest, 'rules', 'rules', 'rules')
          ).rejects.toThrow(/Primary schema validation failed/);
        }
      }
    });
  });
});