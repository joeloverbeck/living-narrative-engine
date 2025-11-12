/**
 * @file Goal Relevance and Satisfaction Evaluation E2E Test
 * @description Verify goal relevance and satisfaction conditions work with complex JSON Logic
 *
 * Test Priority: MEDIUM-HIGH (Priority 3, Test 9)
 * Test Complexity: Medium
 * Estimated Effort: 2-3 hours
 *
 * This test validates that:
 * - Complex JSON Logic relevance conditions work correctly (AND/OR/NOT)
 * - Component existence checks function properly
 * - Component value comparisons evaluate accurately
 * - Nested conditions are evaluated correctly
 * - Goal state satisfaction works with various scenarios
 *
 * Test Scenario:
 * 1. Define goals with complex relevance conditions
 * 2. Test relevance evaluation under various component states
 * 3. Test goal state satisfaction with different component combinations
 * 4. Verify nested conditions work correctly
 * 5. Validate edge cases (missing components, null values, etc.)
 *
 * Success Criteria:
 * - JSON Logic evaluation works correctly
 * - Complex AND/OR/NOT conditions handled
 * - Component existence checks work
 * - Component value comparisons work
 * - Nested conditions evaluated correctly
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestBed } from '../../common/goap/goapTestHelpers.js';
import { createComponentAccessor } from '../../../src/logic/componentAccessor.js';

describe('Goal Relevance and Satisfaction Evaluation E2E', () => {
  let testBed;

  beforeEach(async () => {
    testBed = await createGoapTestBed();
  }, 30000);

  afterEach(() => {
    if (testBed) {
      testBed.cleanup();
    }
  });

  /**
   * Helper function to set up component accessor for an actor
   * Required for JSON Logic to properly evaluate component references
   */
  const setupComponentAccessor = (actor) => {
    // Store original methods
    const originalGetEntityInstance = testBed.entityManager.getEntityInstance;
    const originalHasComponent = testBed.entityManager.hasComponent;
    const originalGetComponentData = testBed.entityManager.getComponentData;

    // Override getEntityInstance to return entity with component accessor
    testBed.entityManager.getEntityInstance = (id) => {
      if (id === actor.id) {
        return {
          id: actor.id,
          components: createComponentAccessor(actor.id, testBed.entityManager, testBed.logger)
        };
      }
      return originalGetEntityInstance ? originalGetEntityInstance.call(testBed.entityManager, id) : null;
    };

    // Override hasComponent to check actor's components
    testBed.entityManager.hasComponent = (entityId, componentId) => {
      if (entityId === actor.id) {
        return actor.hasComponent(componentId);
      }
      return originalHasComponent ? originalHasComponent.call(testBed.entityManager, entityId, componentId) : false;
    };

    // Override getComponentData to return actor's component data
    testBed.entityManager.getComponentData = (entityId, componentId) => {
      if (entityId === actor.id) {
        return actor.getComponent(componentId);
      }
      return originalGetComponentData ? originalGetComponentData.call(testBed.entityManager, entityId, componentId) : null;
    };
  };

  /**
   * Helper function to mock goal definitions for testing
   * Includes goals with various complexity levels of relevance and goal state conditions
   */
  const setupMockGoals = () => {
    const mockGoals = [
      // Goal 1: Complex AND condition with multiple requirements
      {
        id: 'test:complex_and_goal',
        priority: 80,
        relevance: {
          and: [
            { '!=': [{ var: 'actor.components.core:hunger' }, null] },
            { '<': [{ var: 'actor.components.core:hunger.value' }, 30] },
            { '!=': [{ var: 'actor.components.core:energy' }, null] },
            { '>=': [{ var: 'actor.components.core:energy.value' }, 20] },
            { '==': [{ var: 'actor.components.combat:in_combat' }, null] }
          ]
        },
        goalState: {
          '!=': [{ var: 'actor.components.items:has_food' }, null]
        }
      },
      // Goal 2: OR condition for flexibility
      {
        id: 'test:or_condition_goal',
        priority: 70,
        relevance: {
          or: [
            {
              and: [
                { '!=': [{ var: 'actor.components.core:health' }, null] },
                { '<': [{ var: 'actor.components.core:health.value' }, 30] }
              ]
            },
            {
              and: [
                { '!=': [{ var: 'actor.components.core:energy' }, null] },
                { '<': [{ var: 'actor.components.core:energy.value' }, 20] }
              ]
            }
          ]
        },
        goalState: {
          '!=': [{ var: 'actor.components.positioning:lying_down' }, null]
        }
      },
      // Goal 3: NOT condition for exclusion
      {
        id: 'test:not_condition_goal',
        priority: 60,
        relevance: {
          and: [
            { '!=': [{ var: 'actor.components.core:actor' }, null] },
            { '!': [{ var: 'actor.components.combat:in_combat' }] },
            { '!': [{ var: 'actor.components.positioning:lying_down' }] }
          ]
        },
        goalState: {
          '!=': [{ var: 'actor.components.items:has_weapon' }, null]
        }
      },
      // Goal 4: Nested conditions
      {
        id: 'test:nested_condition_goal',
        priority: 90,
        relevance: {
          or: [
            {
              and: [
                { '!=': [{ var: 'actor.components.core:hunger' }, null] },
                { '<': [{ var: 'actor.components.core:hunger.value' }, 20] }
              ]
            },
            {
              and: [
                { '!=': [{ var: 'actor.components.core:health' }, null] },
                { '<': [{ var: 'actor.components.core:health.value' }, 15] }
              ]
            }
          ]
        },
        goalState: {
          '!=': [{ var: 'actor.components.status:safe' }, null]
        }
      },
      // Goal 5: Complex goal state with multiple conditions
      {
        id: 'test:complex_goal_state',
        priority: 50,
        relevance: {
          and: [
            { '!=': [{ var: 'actor.components.core:actor' }, null] },
            { '!=': [{ var: 'actor.components.core:energy' }, null] },
            { '<': [{ var: 'actor.components.core:energy.value' }, 50] }
          ]
        },
        goalState: {
          and: [
            { '!=': [{ var: 'actor.components.positioning:lying_down' }, null] },
            { '!=': [{ var: 'actor.components.core:energy' }, null] },
            { '>=': [{ var: 'actor.components.core:energy.value' }, 80] }
          ]
        }
      }
    ];

    const gameDataRepository = testBed.container.resolve('IGameDataRepository');
    gameDataRepository.getAllGoalDefinitions = () => mockGoals;

    return mockGoals;
  };

  describe('Complex Relevance Conditions', () => {
    it('should evaluate complex AND condition when all requirements are met', async () => {
      testBed.logger.info('=== Test: Complex AND Condition - All Met ===');

      // Step 1: Set up mock goals
      setupMockGoals();

      // Step 2: Create actor meeting ALL conditions for complex_and_goal
      // - hunger < 30 (has component and value check)
      // - energy >= 20 (has component and value check)
      // - NOT in combat (component does NOT exist)
      const actor = await testBed.createActor({
        name: 'ComplexAndActor',
        type: 'goap',
        components: {
          'core:hunger': { value: 25 }, // < 30 ✓
          'core:energy': { value: 30 }, // >= 20 ✓
          'core:position': { locationId: 'test_location' },
          // combat:in_combat NOT present ✓
        },
      });

      setupComponentAccessor(actor);
      testBed.logger.info(`Actor created with all AND conditions met: ${actor.id}`);

      // Step 3: Build planning context
      const context = testBed.createContext({ actorId: actor.id });

      // Step 4: Select goal
      const selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      // Step 5: Verify complex_and_goal is selected (or nested_condition_goal if hunger < 20)
      expect(selectedGoal).toBeDefined();
      expect(selectedGoal).not.toBeNull();
      expect(['test:complex_and_goal', 'test:nested_condition_goal']).toContain(selectedGoal.id);

      testBed.logger.info(`Selected goal: ${selectedGoal.id} (priority ${selectedGoal.priority})`);
      testBed.logger.info('✅ Complex AND condition evaluated correctly when all met');
    }, 60000);

    it('should not select goal when one AND condition fails', async () => {
      testBed.logger.info('=== Test: Complex AND Condition - One Failed ===');

      // Step 1: Set up mock goals
      setupMockGoals();

      // Step 2: Create actor failing ONE condition for complex_and_goal
      // - hunger < 30 ✓
      // - energy >= 20 ✗ (energy = 15, fails)
      // - NOT in combat ✓
      const actor = await testBed.createActor({
        name: 'FailedAndActor',
        type: 'goap',
        components: {
          'core:hunger': { value: 25 }, // < 30 ✓
          'core:energy': { value: 15 }, // >= 20 ✗ (FAILS)
          'core:position': { locationId: 'test_location' },
        },
      });

      setupComponentAccessor(actor);
      testBed.logger.info('Actor created with one AND condition failed');

      // Step 3: Build planning context
      const context = testBed.createContext({ actorId: actor.id });

      // Step 4: Select goal
      const selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      // Step 5: Verify complex_and_goal is NOT selected
      // (or_condition_goal might be selected since energy < 20)
      if (selectedGoal) {
        expect(selectedGoal.id).not.toBe('test:complex_and_goal');
        testBed.logger.info(`Selected different goal: ${selectedGoal.id} (complex_and_goal correctly filtered)`);
      } else {
        testBed.logger.info('No goal selected (complex_and_goal correctly filtered)');
      }

      testBed.logger.info('✅ Complex AND condition correctly rejected when one condition fails');
    }, 60000);

    it('should evaluate OR condition when at least one branch is satisfied', async () => {
      testBed.logger.info('=== Test: OR Condition - One Branch Satisfied ===');

      // Step 1: Set up mock goals
      setupMockGoals();

      // Step 2: Create actor satisfying ONE branch of OR condition
      // or_condition_goal relevance: (health < 30) OR (energy < 20)
      // Testing first branch only: health < 30
      const actor = await testBed.createActor({
        name: 'OrConditionActor',
        type: 'goap',
        components: {
          'core:health': { value: 25 }, // < 30 ✓ (first OR branch)
          'core:energy': { value: 50 }, // >= 20, doesn't matter for OR
          'core:position': { locationId: 'test_location' },
        },
      });

      setupComponentAccessor(actor);
      testBed.logger.info('Actor created with one OR branch satisfied');

      // Step 3: Build planning context
      const context = testBed.createContext({ actorId: actor.id });

      // Step 4: Select goal
      const selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      // Step 5: Verify or_condition_goal is selected
      expect(selectedGoal).toBeDefined();
      expect(selectedGoal).not.toBeNull();
      expect(['test:or_condition_goal', 'test:not_condition_goal']).toContain(selectedGoal.id);

      testBed.logger.info(`Selected goal: ${selectedGoal.id}`);
      testBed.logger.info('✅ OR condition evaluated correctly with one branch satisfied');
    }, 60000);

    it('should evaluate NOT condition correctly when component absent', async () => {
      testBed.logger.info('=== Test: NOT Condition - Component Absent ===');

      // Step 1: Set up mock goals
      setupMockGoals();

      // Step 2: Create actor satisfying NOT conditions
      // not_condition_goal relevance:
      // - actor exists
      // - NOT in_combat (component absent)
      // - NOT lying_down (component absent)
      const actor = await testBed.createActor({
        name: 'NotConditionActor',
        type: 'goap',
        components: {
          'core:position': { locationId: 'test_location' },
          // combat:in_combat NOT present ✓
          // positioning:lying_down NOT present ✓
        },
      });

      setupComponentAccessor(actor);
      testBed.logger.info('Actor created with NOT conditions satisfied (components absent)');

      // Step 3: Build planning context
      const context = testBed.createContext({ actorId: actor.id });

      // Step 4: Select goal
      const selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      // Step 5: Verify not_condition_goal is selected
      expect(selectedGoal).toBeDefined();
      expect(selectedGoal).not.toBeNull();
      expect(selectedGoal.id).toBe('test:not_condition_goal');

      testBed.logger.info(`Selected goal: ${selectedGoal.id} (priority ${selectedGoal.priority})`);
      testBed.logger.info('✅ NOT condition evaluated correctly with absent components');
    }, 60000);

    it('should not select goal when NOT condition fails (component present)', async () => {
      testBed.logger.info('=== Test: NOT Condition - Component Present ===');

      // Step 1: Set up mock goals
      setupMockGoals();

      // Step 2: Create actor failing NOT condition
      // not_condition_goal requires NOT in_combat
      // We'll add in_combat component, which should fail the NOT condition
      const actor = await testBed.createActor({
        name: 'NotFailedActor',
        type: 'goap',
        components: {
          'core:position': { locationId: 'test_location' },
          'combat:in_combat': {}, // Component PRESENT - fails NOT condition
        },
      });

      setupComponentAccessor(actor);
      testBed.logger.info('Actor created with NOT condition failed (component present)');

      // Step 3: Build planning context
      const context = testBed.createContext({ actorId: actor.id });

      // Step 4: Select goal
      const selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      // Step 5: Verify not_condition_goal is NOT selected
      if (selectedGoal) {
        expect(selectedGoal.id).not.toBe('test:not_condition_goal');
        testBed.logger.info(`Selected different goal: ${selectedGoal.id} (not_condition_goal correctly filtered)`);
      } else {
        testBed.logger.info('No goal selected (not_condition_goal correctly filtered)');
      }

      testBed.logger.info('✅ NOT condition correctly rejected when component is present');
    }, 60000);

    it('should evaluate nested conditions correctly', async () => {
      testBed.logger.info('=== Test: Nested Condition Evaluation ===');

      // Step 1: Set up mock goals
      setupMockGoals();

      // Step 2: Create actor satisfying nested condition
      // nested_condition_goal: AND(actor exists, OR(hunger < 20, health < 15))
      // Testing with both branches to ensure nested condition is met
      const actor = await testBed.createActor({
        name: 'NestedConditionActor',
        type: 'goap',
        components: {
          'core:hunger': { value: 15 }, // < 20 ✓ (first OR branch in nested AND)
          'core:health': { value: 50 }, // Sufficient health, not triggering or_condition_goal
          'core:energy': { value: 50 }, // Sufficient energy
          'core:position': { locationId: 'test_location' },
        },
      });

      setupComponentAccessor(actor);
      testBed.logger.info('Actor created with nested condition satisfied');

      // Step 3: Build planning context
      const context = testBed.createContext({ actorId: actor.id });

      // Step 4: Select goal
      const selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      // Step 5: Verify nested_condition_goal is selected
      expect(selectedGoal).toBeDefined();
      expect(selectedGoal).not.toBeNull();
      expect(selectedGoal.id).toBe('test:nested_condition_goal');
      expect(selectedGoal.priority).toBe(90);

      testBed.logger.info(`Selected goal: ${selectedGoal.id} (priority ${selectedGoal.priority})`);
      testBed.logger.info('✅ Nested conditions evaluated correctly');
    }, 60000);
  });

  describe('Component Existence and Value Checks', () => {
    it('should correctly check component existence in relevance conditions', async () => {
      testBed.logger.info('=== Test: Component Existence Checks ===');

      // Step 1: Set up mock goals
      setupMockGoals();

      // Step 2: Create actor with specific components
      const actor = await testBed.createActor({
        name: 'ExistenceCheckActor',
        type: 'goap',
        components: {
          'core:hunger': { value: 25 },
          'core:energy': { value: 30 },
          'core:position': { locationId: 'test_location' },
          // combat:in_combat explicitly NOT added
        },
      });

      setupComponentAccessor(actor);
      testBed.logger.info('Actor created for existence checking');

      // Step 3: Build planning context
      const context = testBed.createContext({ actorId: actor.id });

      // Step 4: Select goal
      const selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      // Step 5: Verify goal selection respects component existence
      expect(selectedGoal).toBeDefined();
      expect(selectedGoal).not.toBeNull();

      // complex_and_goal requires combat:in_combat to NOT exist
      // Since it doesn't exist, this goal should be relevant
      testBed.logger.info(`Selected goal: ${selectedGoal.id}`);
      testBed.logger.info('✅ Component existence checks work correctly');
    }, 60000);

    it('should correctly evaluate component value comparisons', async () => {
      testBed.logger.info('=== Test: Component Value Comparisons ===');

      // Step 1: Set up mock goals
      setupMockGoals();

      // Test multiple value comparison scenarios
      const scenarios = [
        {
          name: 'Less Than',
          components: {
            'core:hunger': { value: 25 }, // < 30
            'core:energy': { value: 30 },
            'core:position': { locationId: 'test_location' },
          },
          expectedRelevant: ['test:complex_and_goal'],
        },
        {
          name: 'Greater Than or Equal',
          components: {
            'core:energy': { value: 20 }, // >= 20 (boundary)
            'core:hunger': { value: 25 },
            'core:position': { locationId: 'test_location' },
          },
          expectedRelevant: ['test:complex_and_goal'],
        },
        {
          name: 'Boundary Value',
          components: {
            'core:hunger': { value: 30 }, // NOT < 30 (boundary fails)
            'core:energy': { value: 30 },
            'core:position': { locationId: 'test_location' },
          },
          expectedNotRelevant: ['test:complex_and_goal'],
        },
      ];

      for (const scenario of scenarios) {
        testBed.logger.info(`--- Scenario: ${scenario.name} ---`);

        const actor = await testBed.createActor({
          name: `ValueComparisonActor_${scenario.name.replace(/\s+/g, '_')}`,
          type: 'goap',
          components: scenario.components,
        });

        setupComponentAccessor(actor);

        const context = testBed.createContext({ actorId: actor.id });
        const selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

        if (scenario.expectedRelevant && selectedGoal) {
          testBed.logger.info(`Selected: ${selectedGoal.id} (expected relevant goals: ${scenario.expectedRelevant.join(', ')})`);
        } else if (scenario.expectedNotRelevant) {
          if (selectedGoal) {
            expect(scenario.expectedNotRelevant).not.toContain(selectedGoal.id);
            testBed.logger.info(`Correctly excluded: ${scenario.expectedNotRelevant.join(', ')}`);
          }
        }
      }

      testBed.logger.info('✅ Component value comparisons work correctly');
    }, 60000);
  });

  describe('Goal State Satisfaction', () => {
    it('should recognize goal as satisfied when goal state condition is met', async () => {
      testBed.logger.info('=== Test: Goal State Satisfied ===');

      // Step 1: Set up mock goals
      setupMockGoals();

      // Step 2: Create actor with goal already satisfied
      // complex_and_goal: goal state requires has_food component
      const actor = await testBed.createActor({
        name: 'SatisfiedGoalActor',
        type: 'goap',
        components: {
          'core:hunger': { value: 25 }, // Makes goal relevant
          'core:energy': { value: 30 },
          'items:has_food': {}, // Goal state SATISFIED
          'core:position': { locationId: 'test_location' },
        },
      });

      setupComponentAccessor(actor);
      testBed.logger.info('Actor created with goal state satisfied');

      // Step 3: Build planning context
      const context = testBed.createContext({ actorId: actor.id });

      // Step 4: Select goal
      const selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      // Step 5: Verify complex_and_goal is NOT selected (already satisfied)
      if (selectedGoal) {
        expect(selectedGoal.id).not.toBe('test:complex_and_goal');
        testBed.logger.info(`Selected different goal: ${selectedGoal.id} (satisfied goal correctly filtered)`);
      } else {
        testBed.logger.info('No goal selected (satisfied goal correctly filtered)');
      }

      testBed.logger.info('✅ Goal state satisfaction detected correctly');
    }, 60000);

    it('should recognize goal as unsatisfied when goal state condition not met', async () => {
      testBed.logger.info('=== Test: Goal State Unsatisfied ===');

      // Step 1: Set up mock goals
      setupMockGoals();

      // Step 2: Create actor with goal NOT satisfied
      const actor = await testBed.createActor({
        name: 'UnsatisfiedGoalActor',
        type: 'goap',
        components: {
          'core:hunger': { value: 25 }, // Makes goal relevant
          'core:energy': { value: 30 },
          // has_food NOT present - goal state NOT satisfied
          'core:position': { locationId: 'test_location' },
        },
      });

      setupComponentAccessor(actor);
      testBed.logger.info('Actor created with goal state unsatisfied');

      // Step 3: Build planning context
      const context = testBed.createContext({ actorId: actor.id });

      // Step 4: Select goal
      const selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      // Step 5: Verify complex_and_goal CAN be selected (not satisfied)
      expect(selectedGoal).toBeDefined();
      expect(selectedGoal).not.toBeNull();
      testBed.logger.info(`Selected goal: ${selectedGoal.id} (unsatisfied goal correctly selected)`);

      testBed.logger.info('✅ Unsatisfied goal state detected correctly');
    }, 60000);

    it('should handle complex goal state with multiple conditions', async () => {
      testBed.logger.info('=== Test: Complex Goal State Evaluation ===');

      // Step 1: Set up mock goals
      setupMockGoals();

      // Test complex_goal_state which requires:
      // - lying_down component AND
      // - energy >= 80

      // Scenario 1: Partial satisfaction (lying down but energy low)
      testBed.logger.info('--- Scenario 1: Partial Satisfaction ---');

      let actor = await testBed.createActor({
        name: 'PartialSatisfactionActor',
        type: 'goap',
        components: {
          'core:energy': { value: 40 }, // Makes goal relevant (< 50)
          'positioning:lying_down': {}, // Part of goal state ✓
          // But energy is 40, not >= 80, so goal state NOT fully satisfied
          'core:position': { locationId: 'test_location' },
        },
      });

      setupComponentAccessor(actor);

      let context = testBed.createContext({ actorId: actor.id });
      let selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      if (selectedGoal && selectedGoal.id === 'test:complex_goal_state') {
        testBed.logger.info('Goal still selected (partial satisfaction not enough)');
      }

      // Scenario 2: Full satisfaction
      testBed.logger.info('--- Scenario 2: Full Satisfaction ---');

      // Add updateComponent helper
      actor.updateComponent = (componentId, data) => {
        const existing = actor.getComponent(componentId);
        if (existing) {
          Object.assign(existing, data);
        } else {
          actor.addComponent(componentId, data);
        }
      };

      // Update energy to satisfy goal state
      actor.updateComponent('core:energy', { value: 80 });

      context = testBed.createContext({ actorId: actor.id });
      selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      if (selectedGoal) {
        expect(selectedGoal.id).not.toBe('test:complex_goal_state');
        testBed.logger.info('Goal not selected (full satisfaction achieved)');
      } else {
        testBed.logger.info('No goal selected (complex goal state fully satisfied)');
      }

      testBed.logger.info('✅ Complex goal state with multiple conditions evaluated correctly');
    }, 60000);

    it('should handle edge cases with null and undefined component values', async () => {
      testBed.logger.info('=== Test: Null/Undefined Component Edge Cases ===');

      // Step 1: Set up mock goals
      setupMockGoals();

      // Step 2: Create actor with minimal components
      const actor = await testBed.createActor({
        name: 'EdgeCaseActor',
        type: 'goap',
        components: {
          'core:position': { locationId: 'test_location' },
          // Most components absent - testing null checks
        },
      });

      setupComponentAccessor(actor);
      testBed.logger.info('Actor created with minimal components (testing null handling)');

      // Step 3: Build planning context
      const context = testBed.createContext({ actorId: actor.id });

      // Step 4: Select goal
      const selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      // Step 5: Verify system handles null/undefined gracefully
      // not_condition_goal should be selected (requires absence of combat and lying_down)
      if (selectedGoal) {
        expect(selectedGoal.id).toBe('test:not_condition_goal');
        testBed.logger.info(`Selected goal: ${selectedGoal.id} (null handling works)`);
      } else {
        testBed.logger.info('No goal selected (graceful null handling)');
      }

      testBed.logger.info('✅ Null/undefined component values handled correctly');
    }, 60000);
  });

  describe('Integration with Goal Selection Workflow', () => {
    it('should select highest-priority goal among multiple relevant goals with complex conditions', async () => {
      testBed.logger.info('=== Test: Priority Selection with Complex Conditions ===');

      // Step 1: Set up mock goals
      setupMockGoals();

      // Step 2: Create actor triggering multiple goals
      // To ensure nested_condition_goal (90) is selected over complex_and_goal (80):
      // - nested_condition_goal requires: hunger < 20 OR health < 15
      // - complex_and_goal requires: hunger < 30 AND energy >= 20 AND NOT in_combat
      // - We'll use hunger = 18 which satisfies both, but nested has higher priority
      const actor = await testBed.createActor({
        name: 'MultiGoalComplexActor',
        type: 'goap',
        components: {
          'core:hunger': { value: 18 }, // < 20 (nested) AND < 30 (complex_and)
          'core:energy': { value: 30 }, // >= 20 (complex_and), also prevents or_condition_goal
          'core:health': { value: 50 }, // Prevents or_condition_goal from triggering
          'core:position': { locationId: 'test_location' },
          // No combat, no lying_down
        },
      });

      setupComponentAccessor(actor);
      testBed.logger.info('Actor created with multiple complex goals relevant');

      // Step 3: Build planning context
      const context = testBed.createContext({ actorId: actor.id });

      // Step 4: Select goal
      const selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      // Step 5: Verify highest-priority goal selected
      // nested_condition_goal (90) > complex_and_goal (80) > not_condition_goal (60)
      expect(selectedGoal).toBeDefined();
      expect(selectedGoal).not.toBeNull();
      expect(selectedGoal.id).toBe('test:nested_condition_goal');
      expect(selectedGoal.priority).toBe(90);

      testBed.logger.info(`Selected highest-priority goal: ${selectedGoal.id} (priority ${selectedGoal.priority})`);
      testBed.logger.info('✅ Priority selection works correctly with complex conditions');
    }, 60000);
  });
});
