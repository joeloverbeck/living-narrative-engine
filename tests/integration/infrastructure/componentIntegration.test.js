/**
 * @file Component Integration Tests for Mod Test Infrastructure
 * @description Validates that all 5 infrastructure components work together seamlessly
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModTestHandlerFactory } from '../../common/mods/ModTestHandlerFactory.js';
import { ModEntityScenarios } from '../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../common/mods/ModAssertionHelpers.js';
import { createTestBed } from '../../common/testBed.js';

describe('Mod Test Infrastructure - Component Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Handler Factory Integration', () => {
    it('should create handlers that work with ModActionTestBase', async () => {
      // Test that handlers from factory integrate with action test base
      const mockRuleFile = {
        rule_id: 'handle_test_action',
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'test:event-is-action-test' },
        actions: [
          {
            type: 'GET_NAME',
            parameters: { entity_ref: 'actor', result_variable: 'test_name' },
          },
        ],
      };

      const mockConditionFile = {
        id: 'test:event-is-action-test',
        description: 'Test condition for action test',
        logic: { '==': [{ var: 'event.payload.actionId' }, 'test:action'] },
      };

      const fixture = await ModTestFixture.forAction(
        'positioning',
        'test:action',
        mockRuleFile,
        mockConditionFile
      );

      // Validate the handler factory was used correctly
      expect(fixture.testEnv).toBeTruthy();
      expect(fixture.eventBus).toBeDefined();
      expect(fixture.entityManager).toBeDefined();

      // Test that the test environment is properly configured
      const dataRegistry = fixture.testEnv.dataRegistry;
      expect(dataRegistry).toBeDefined();
      expect(dataRegistry.getAllSystemRules).toBeDefined();
      expect(dataRegistry.getConditionDefinition).toBeDefined();

      // Verify rules are accessible
      const rules = dataRegistry.getAllSystemRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].rule_id).toBe('handle_test_action');
    });

    it('should support all handler types (standard, positioning, intimacy)', async () => {
      const categories = ['positioning', 'intimacy', 'sex'];

      for (const category of categories) {
        const mockRuleFile = {
          rule_id: `handle_${category}_action`,
          event_type: 'core:attempt_action',
          condition: { condition_ref: `${category}:event-is-action-test` },
          actions: [
            {
              type: 'GET_NAME',
              parameters: { entity_ref: 'actor', result_variable: 'test_name' },
            },
          ],
        };

        const mockConditionFile = {
          id: `${category}:event-is-action-test`,
          description: `Test condition for ${category} action`,
          logic: {
            '==': [{ var: 'event.payload.actionId' }, `${category}:action`],
          },
        };

        const fixture = await ModTestFixture.forAction(
          category,
          `${category}:action`,
          mockRuleFile,
          mockConditionFile
        );

        // Each category should create a working test environment
        expect(fixture.testEnv).toBeTruthy();
        expect(fixture.modId).toBe(category);
      }
    });

    it('should integrate with entity manager from test environment', async () => {
      const mockRuleFile = {
        rule_id: 'handle_test_action',
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'test:condition' },
        actions: [
          {
            type: 'GET_NAME',
            parameters: { entity_ref: 'actor', result_variable: 'test_name' },
          },
        ],
      };

      const mockConditionFile = {
        id: 'test:condition',
        description: 'Test condition for entity manager integration',
        logic: { '==': [{ var: 'event.payload.actionId' }, 'test:action'] },
      };

      const fixture = await ModTestFixture.forAction(
        'intimacy',
        'test:action',
        mockRuleFile,
        mockConditionFile
      );

      // Entity manager should be accessible and functional
      const entityManager = fixture.entityManager;
      expect(entityManager).toBeDefined();
      expect(entityManager.createEntity).toBeDefined();
      expect(entityManager.getEntityInstance).toBeDefined();
      expect(entityManager.hasComponent).toBeDefined();

      // Test that entity manager integrates with handler factory
      const testEntity = entityManager.createEntity('test-entity');
      expect(testEntity).toBeDefined();

      const instance = entityManager.getEntityInstance('test-entity');
      expect(instance).toBeTruthy();
    });
  });

  describe('Entity Builder Integration', () => {
    it('should create entities that work with handlers', async () => {
      const mockRuleFile = {
        rule_id: 'handle_kiss_cheek',
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'kissing:event-is-action-kiss-cheek' },
        actions: [
          {
            type: 'GET_NAME',
            parameters: { entity_ref: 'actor', result_variable: 'test_name' },
          },
        ],
      };

      const mockConditionFile = {
        id: 'kissing:event-is-action-kiss-cheek',
        description: 'Test condition for kiss cheek action',
        logic: {
          '==': [{ var: 'event.payload.actionId' }, 'kissing:kiss_cheek'],
        },
      };

      const fixture = await ModTestFixture.forAction(
        'kissing',
        'kissing:kiss_cheek',
        mockRuleFile,
        mockConditionFile
      );

      // Create entities using ModEntityScenarios
      const { actor, target } = fixture.createCloseActors(['Alice', 'Bob']);

      // Validate entities were created with proper structure
      expect(actor).toBeDefined();
      expect(actor.id).toBeTruthy();
      expect(actor.components).toBeDefined();

      expect(target).toBeDefined();
      expect(target.id).toBeTruthy();
      expect(target.components).toBeDefined();

      // Validate entities are accessible through entity manager
      const actorInstance = fixture.entityManager.getEntityInstance(actor.id);
      const targetInstance = fixture.entityManager.getEntityInstance(target.id);

      expect(actorInstance).toBeTruthy();
      expect(targetInstance).toBeTruthy();
    });

    it('should support all component types used by mod tests', async () => {
      const mockRuleFile = {
        rule_id: 'handle_anatomy_action',
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'test:condition' },
        actions: [
          {
            type: 'GET_NAME',
            parameters: { entity_ref: 'actor', result_variable: 'test_name' },
          },
        ],
      };

      const mockConditionFile = {
        id: 'test:condition',
        description: 'Test condition for anatomy action',
        logic: { '==': [{ var: 'event.payload.actionId' }, 'test:action'] },
      };

      const fixture = await ModTestFixture.forAction(
        'intimacy',
        'test:action',
        mockRuleFile,
        mockConditionFile
      );

      // Create anatomy scenario with various component types
      const scenario = fixture.createAnatomyScenario(
        ['Alice', 'Bob'],
        ['torso', 'breast', 'breast'],
        { includeRoom: true }
      );

      // Validate all entities have required components
      expect(scenario.actor.components['core:actor']).toBeDefined();
      expect(scenario.actor.components['core:location']).toBeDefined();
      expect(scenario.actor.components['core:name']).toBeDefined();

      expect(scenario.target.components['core:actor']).toBeDefined();
      expect(scenario.target.components['core:location']).toBeDefined();
      expect(scenario.target.components['core:name']).toBeDefined();

      // Validate anatomy components
      if (scenario.bodyParts && scenario.bodyParts.length > 0) {
        scenario.bodyParts.forEach((bodyPart) => {
          expect(bodyPart.components['anatomy:part']).toBeDefined();
          expect(bodyPart.components['core:location']).toBeDefined();
        });
      }
    });

    it('should create valid entity relationships', async () => {
      const mockRuleFile = {
        rule_id: 'handle_multi_actor',
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'test:condition' },
        actions: [
          {
            type: 'GET_NAME',
            parameters: { entity_ref: 'actor', result_variable: 'test_name' },
          },
        ],
      };

      const mockConditionFile = {
        id: 'test:condition',
        description: 'Test condition for multi-actor scenario',
        logic: { '==': [{ var: 'event.payload.actionId' }, 'test:action'] },
      };

      const fixture = await ModTestFixture.forAction(
        'positioning',
        'test:action',
        mockRuleFile,
        mockConditionFile
      );

      // Create multi-actor scenario with relationships
      const scenario = fixture.createMultiActorScenario([
        'Alice',
        'Bob',
        'Charlie',
      ]);

      // Validate entity relationships
      expect(scenario.actor.components['core:location'].location).toBe('room1');
      expect(scenario.target.components['core:location'].location).toBe(
        'room1'
      );

      if (scenario.observers && scenario.observers.length > 0) {
        scenario.observers.forEach((observer) => {
          expect(observer.components['core:location'].location).toBe('room1');
        });
      }

      // Validate entities can be found through entity manager
      const allEntities = scenario.allEntities;
      allEntities.forEach((entity) => {
        const instance = fixture.entityManager.getEntityInstance(entity.id);
        expect(instance).toBeTruthy();
      });
    });
  });

  describe('Assertion Helpers Integration', () => {
    it('should validate events created by handler execution', async () => {
      const mockRuleFile = {
        rule_id: 'handle_test_action',
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'test:event-is-action-test' },
        actions: [
          {
            type: 'LOG',
            parameters: {
              message: 'Test action executed successfully',
              level: 'info',
            },
          },
          {
            type: 'DISPATCH_EVENT',
            parameters: {
              eventType: 'test:action_completed',
              payload: { success: true },
            },
          },
        ],
      };

      const mockConditionFile = {
        id: 'test:event-is-action-test',
        description: 'Test condition for event validation',
        logic: { '==': [{ var: 'event.payload.actionId' }, 'test:action'] },
      };

      const fixture = await ModTestFixture.forAction(
        'intimacy',
        'test:action',
        mockRuleFile,
        mockConditionFile
      );

      // Create scenario and execute action
      const { actor, target } = fixture.createCloseActors(['Alice', 'Bob']);

      await fixture.executeAction(actor.id, target.id);

      // Validate that assertion helpers can work with generated events
      expect(fixture.events).toBeDefined();
      expect(fixture.events.length).toBeGreaterThan(0);

      // Test that ModAssertionHelpers can analyze these events
      // The specific assertions will depend on the actual handlers, but we can
      // validate that the integration works without throwing errors
      expect(() => {
        ModAssertionHelpers.assertOnlyExpectedEvents(fixture.events, [
          'core:attempt_action',
          'LOG',
          'test:action_completed',
        ]);
      }).not.toThrow();
    });

    it('should validate entities created by builder', async () => {
      const mockRuleFile = {
        rule_id: 'handle_component_test',
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'test:condition' },
        actions: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'test:added_component',
              value: { added: true },
            },
          },
        ],
      };

      const mockConditionFile = {
        id: 'test:condition',
        description: 'Test condition for component test',
        logic: { '==': [{ var: 'event.payload.actionId' }, 'test:action'] },
      };

      const fixture = await ModTestFixture.forAction(
        'positioning',
        'test:action',
        mockRuleFile,
        mockConditionFile
      );

      // Create entities and execute action
      const { actor, target } = fixture.createCloseActors(['Alice', 'Bob']);

      await fixture.executeAction(actor.id, target.id);

      // Validate that assertion helpers can validate entity changes
      expect(() => {
        ModAssertionHelpers.assertComponentAdded(
          fixture.entityManager,
          actor.id,
          'test:added_component',
          { added: true }
        );
      }).not.toThrow();
    });

    it('should provide helpful error messages for failures', async () => {
      const mockRuleFile = {
        rule_id: 'handle_failing_action',
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'test:never-match' },
        actions: [
          {
            type: 'GET_NAME',
            parameters: { entity_ref: 'actor', result_variable: 'test_name' },
          },
        ],
      };

      const mockConditionFile = {
        id: 'test:never-match',
        description: 'Test condition that never matches',
        logic: { '==': [{ var: 'event.payload.actionId' }, 'never:matches'] },
      };

      const fixture = await ModTestFixture.forAction(
        'intimacy',
        'test:action',
        mockRuleFile,
        mockConditionFile
      );

      // Create scenario and execute action that should fail
      const { actor, target } = fixture.createCloseActors(['Alice', 'Bob']);

      await fixture.executeAction(actor.id, target.id);

      // Test that assertion helpers provide helpful error messages
      expect(() => {
        fixture.assertActionSuccess('This should fail');
      }).toThrow(); // Should throw with a helpful message about no success events
    });
  });

  describe('Base Class Integration', () => {
    it('should orchestrate all components correctly', async () => {
      const mockRuleFile = {
        rule_id: 'handle_orchestration_test',
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'test:orchestration-condition' },
        actions: [
          {
            type: 'GET_NAME',
            parameters: { entity_ref: 'actor', result_variable: 'test_name' },
          },
          {
            type: 'LOG',
            parameters: {
              message: 'Orchestration test successful',
              level: 'info',
            },
          },
        ],
      };

      const mockConditionFile = {
        id: 'test:orchestration-condition',
        description: 'Test condition for orchestration test',
        logic: {
          '==': [{ var: 'event.payload.actionId' }, 'test:orchestration'],
        },
      };

      const fixture = await ModTestFixture.forAction(
        'positioning',
        'test:orchestration',
        mockRuleFile,
        mockConditionFile
      );

      // Validate that all components are orchestrated together
      expect(fixture.testEnv).toBeTruthy();
      expect(fixture.eventBus).toBeDefined();
      expect(fixture.entityManager).toBeDefined();
      expect(fixture.logger).toBeDefined();

      // Test complete workflow
      const { actor, target } = fixture.createStandardActorTarget([
        'Alice',
        'Bob',
      ]);

      expect(actor).toBeDefined();
      expect(target).toBeDefined();

      // Execute action
      await fixture.executeAction(actor.id, target.id);

      // Validate orchestration worked
      expect(fixture.events.length).toBeGreaterThan(0);

      // Test cleanup
      expect(() => {
        fixture.cleanup();
      }).not.toThrow();
    });

    it('should support inheritance and customization', async () => {
      const mockRuleFile = {
        rule_id: 'handle_inheritance_test',
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'test:inheritance-condition' },
        actions: [
          {
            type: 'GET_NAME',
            parameters: { entity_ref: 'actor', result_variable: 'test_name' },
          },
        ],
      };

      const mockConditionFile = {
        id: 'test:inheritance-condition',
        description: 'Test condition for inheritance test',
        logic: {
          '==': [{ var: 'event.payload.actionId' }, 'test:inheritance'],
        },
      };

      // Test ModActionTestFixture
      const actionFixture = await ModTestFixture.forAction(
        'intimacy',
        'test:inheritance',
        mockRuleFile,
        mockConditionFile
      );

      expect(actionFixture.actionId).toBe('test:inheritance');
      expect(actionFixture.createCloseActors).toBeDefined();
      expect(actionFixture.executeAction).toBeDefined();

      // Test ModRuleTestFixture
      const ruleFixture = await ModTestFixture.forRule(
        'intimacy',
        'test:inheritance',
        mockRuleFile,
        mockConditionFile
      );

      expect(ruleFixture.ruleId).toBe('test:inheritance');
      expect(ruleFixture.testRuleTriggers).toBeDefined();
      expect(ruleFixture.testRuleDoesNotTrigger).toBeDefined();

      // Both should inherit from BaseModTestFixture
      expect(actionFixture.reset).toBeDefined();
      expect(actionFixture.cleanup).toBeDefined();
      expect(ruleFixture.reset).toBeDefined();
      expect(ruleFixture.cleanup).toBeDefined();
    });

    it('should maintain consistent state across operations', async () => {
      const mockRuleFile = {
        rule_id: 'handle_state_test',
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'test:state-condition' },
        actions: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'test:state_component',
              value: { step: 1 },
            },
          },
        ],
      };

      const mockConditionFile = {
        id: 'test:state-condition',
        description: 'Test condition for state test',
        logic: { '==': [{ var: 'event.payload.actionId' }, 'test:state'] },
      };

      const fixture = await ModTestFixture.forAction(
        'positioning',
        'test:state',
        mockRuleFile,
        mockConditionFile
      );

      // Create initial state
      const { actor, target } = fixture.createCloseActors(['Alice', 'Bob']);

      // Execute first action
      await fixture.executeAction(actor.id, target.id);
      const firstEventCount = fixture.events.length;

      // Add small delay to ensure async operations complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Validate state is maintained
      expect(
        fixture.entityManager.hasComponent(actor.id, 'test:state_component')
      ).toBeTruthy();

      // Reset with same entities
      fixture.reset([actor, target]);

      // State should be reset but structure maintained
      expect(fixture.entityManager.getEntityInstance(actor.id)).toBeTruthy();
      expect(fixture.entityManager.getEntityInstance(target.id)).toBeTruthy();

      // Events should be cleared after reset
      expect(fixture.events.length).toBe(0);

      // Should be able to execute again
      await fixture.executeAction(actor.id, target.id);
      expect(fixture.events.length).toBeGreaterThan(0);
    });
  });

  describe('Factory Integration', () => {
    it('should create working test instances for all categories', async () => {
      const categories = [
        'positioning',
        'intimacy',
        'sex',
        'violence',
        'exercise',
      ];

      for (const category of categories) {
        const mockRuleFile = {
          rule_id: `handle_${category}_test`,
          event_type: 'core:attempt_action',
          condition: { condition_ref: `${category}:test-condition` },
          actions: [
            {
              type: 'GET_NAME',
              parameters: { entity_ref: 'actor', result_variable: 'test_name' },
            },
          ],
        };

        const mockConditionFile = {
          id: `${category}:test-condition`,
          description: `Test condition for ${category} test`,
          logic: {
            '==': [{ var: 'event.payload.actionId' }, `${category}:test`],
          },
        };

        // Test action fixture
        const actionFixture = await ModTestFixture.forAction(
          category,
          `${category}:test`,
          mockRuleFile,
          mockConditionFile
        );

        expect(actionFixture.modId).toBe(category);
        expect(actionFixture.testEnv).toBeTruthy();

        // Test category fixture
        const categoryFixture = ModTestFixture.forCategory(category);

        expect(categoryFixture.categoryName).toBe(category);
        expect(categoryFixture.createCategoryScenario).toBeDefined();
      }
    });

    it('should auto-detect and configure components correctly', async () => {
      const mockRuleFile = {
        rule_id: 'handle_auto_detect_test',
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'positioning:auto-detect-condition' },
        actions: [
          {
            type: 'GET_NAME',
            parameters: { entity_ref: 'actor', result_variable: 'test_name' },
          },
        ],
      };

      const mockConditionFile = {
        id: 'positioning:auto-detect-condition',
        description: 'Test condition for auto-detect',
        logic: {
          '==': [{ var: 'event.payload.actionId' }, 'positioning:auto_detect'],
        },
      };

      const fixture = await ModTestFixture.forAction(
        'positioning',
        'positioning:auto_detect',
        mockRuleFile,
        mockConditionFile
      );

      // Factory should auto-detect positioning category and configure accordingly
      expect(fixture.modId).toBe('positioning');

      // Should use positioning-specific handler factory
      expect(fixture.testEnv).toBeTruthy();
      expect(fixture.testEnv.createHandlers).toBeDefined();

      // Should support positioning-specific scenarios
      expect(fixture.createStandardActorTarget).toBeDefined();
      expect(fixture.createMultiActorScenario).toBeDefined();
    });

    it('should handle file loading and configuration seamlessly', async () => {
      // Test that the factory integrates file loading with other components
      const mockRuleFile = {
        rule_id: 'handle_seamless_test',
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'affection:seamless-condition' },
        actions: [
          {
            type: 'GET_NAME',
            parameters: { entity_ref: 'actor', result_variable: 'test_name' },
          },
          {
            type: 'LOG',
            parameters: {
              message: 'Configuration successful',
              level: 'info',
            },
          },
        ],
      };

      const mockConditionFile = {
        id: 'affection:seamless-condition',
        description: 'Test condition for seamless integration',
        logic: {
          '==': [{ var: 'event.payload.actionId' }, 'affection:seamless'],
        },
      };

      const fixture = await ModTestFixture.forAction(
        'affection',
        'affection:seamless',
        mockRuleFile,
        mockConditionFile
      );

      // Configuration should be seamless and complete
      expect(fixture.ruleFile).toEqual(mockRuleFile);
      expect(fixture.conditionFile).toEqual(mockConditionFile);

      // All components should be properly configured
      expect(fixture.testEnv.dataRegistry.getAllSystemRules()).toHaveLength(1);
      expect(
        fixture.testEnv.dataRegistry.getConditionDefinition(
          'affection:seamless-condition'
        )
      ).toEqual(mockConditionFile);

      // Should be able to execute end-to-end workflow
      const { actor, target } = fixture.createCloseActors(['Alice', 'Bob']);
      await fixture.executeAction(actor.id, target.id);

      expect(fixture.events.length).toBeGreaterThan(0);

      // Cleanup should be seamless
      expect(() => {
        fixture.cleanup();
      }).not.toThrow();
    });
  });
});
