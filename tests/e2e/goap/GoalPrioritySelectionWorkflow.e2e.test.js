/**
 * @file Goal Priority Selection Workflow E2E Test
 * @description Verify goal priority system works correctly with multiple competing goals
 *
 * Test Priority: CRITICAL (Priority 1, Test 2)
 * Test Complexity: Medium
 * Estimated Effort: 2-3 hours
 *
 * This test validates the GOAP goal selection workflow, ensuring that:
 * - Goals are selected in correct priority order
 * - Satisfied goals are not re-selected
 * - Irrelevant goals are not considered
 * - Goal state evaluation works with JSON Logic conditions
 *
 * Test Scenario:
 * 1. Load mods with multiple goals (find_food, rest_safely, defeat_enemy)
 * 2. Create actor with multiple goal triggers (hungry, tired, in combat)
 * 3. Verify highest-priority goal (defeat_enemy at 90) is selected first
 * 4. Satisfy highest-priority goal (remove combat component)
 * 5. Verify next-priority goal (find_food at 80) is selected
 * 6. Continue until all goals satisfied or no goals remain
 *
 * Success Criteria:
 * - Goals selected in correct priority order
 * - Satisfied goals are not re-selected
 * - Irrelevant goals are not considered
 * - Goal state evaluation works with JSON Logic conditions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestBed } from '../../common/goap/goapTestHelpers.js';
import { createComponentAccessor } from '../../../src/logic/componentAccessor.js';

describe('Goal Priority Selection Workflow E2E', () => {
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
   * Helper function to mock goal definitions
   * Returns standard test goals with simplified relevance checks
   * Note: Uses != for component existence checks instead of >= for better JSON Logic compatibility
   */
  const setupMockGoals = () => {
    const mockGoals = [
      {
        id: 'core:defeat_enemy',
        priority: 90,
        relevance: {
          and: [
            { '!=': [{ var: 'actor.components.core:actor' }, null] },
            { '!=': [{ var: 'actor.components.combat:in_combat' }, null] },
            { '!=': [{ var: 'actor.components.core:health' }, null] },
            { '>': [{ var: 'actor.components.core:health.value' }, 20] }
          ]
        },
        goalState: {
          '==': [{ var: 'actor.components.combat:in_combat' }, null]
        }
      },
      {
        id: 'core:find_food',
        priority: 80,
        relevance: {
          and: [
            { '!=': [{ var: 'actor.components.core:actor' }, null] },
            { '!=': [{ var: 'actor.components.core:hunger' }, null] },
            { '<': [{ var: 'actor.components.core:hunger.value' }, 30] },
            { '==': [{ var: 'actor.components.items:has_food' }, null] }
          ]
        },
        goalState: {
          '!=': [{ var: 'actor.components.items:has_food' }, null]
        }
      },
      {
        id: 'core:rest_safely',
        priority: 60,
        relevance: {
          and: [
            { '!=': [{ var: 'actor.components.core:actor' }, null] },
            { '!=': [{ var: 'actor.components.core:energy' }, null] },
            { '<': [{ var: 'actor.components.core:energy.value' }, 40] }
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

  describe('Priority-Based Goal Selection', () => {
    it('should select highest-priority goal when multiple goals are relevant', async () => {
      testBed.logger.info('=== Test: Highest-Priority Goal Selection ===');

      // Step 1: Set up mock goals first
      setupMockGoals();

      // Step 2: Create actor with ALL goal triggers
      // - combat:in_combat component + health > 20 triggers defeat_enemy (priority 90)
      // - hunger < 30 + no has_food triggers find_food (priority 80)
      // - energy < 40 triggers rest_safely (priority 60)
      const actor = await testBed.createActor({
        name: 'MultiGoalActor',
        type: 'goap',
        components: {
          'core:health': { value: 50 }, // Sufficient health for combat
          'combat:in_combat': {}, // Triggers defeat_enemy (priority 90)
          'core:hunger': { value: 25 }, // Triggers find_food (priority 80)
          'core:energy': { value: 35 }, // Triggers rest_safely (priority 60)
          'core:position': { locationId: 'test_location' },
        },
      });

      // Step 3: Set up component accessor for JSON Logic evaluation
      setupComponentAccessor(actor);

      testBed.logger.info(`Actor created with 3 goal triggers: ${actor.id}`);

      // Step 4: Build planning context
      const context = testBed.createContext({ actorId: actor.id });

      // Step 5: Select goal using GoalManager
      testBed.logger.info('=== Selecting highest-priority goal ===');
      const selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      // Step 6: Verify defeat_enemy (priority 90) is selected
      expect(selectedGoal).toBeDefined();
      expect(selectedGoal).not.toBeNull();
      expect(selectedGoal.id).toBe('core:defeat_enemy');
      expect(selectedGoal.priority).toBe(90);

      testBed.logger.info(`Selected goal: ${selectedGoal.id} (priority ${selectedGoal.priority})`);
      testBed.logger.info('✅ Highest-priority goal selected correctly');
    }, 60000);

    it('should select next-priority goal after highest-priority goal is satisfied', async () => {
      testBed.logger.info('=== Test: Goal Satisfaction and Re-Selection ===');

      // Step 1: Set up mock goals
      setupMockGoals();

      // Step 2: Create actor with multiple goal triggers
      const actor = await testBed.createActor({
        name: 'ProgressingActor',
        type: 'goap',
        components: {
          'core:health': { value: 50 },
          'combat:in_combat': {}, // Triggers defeat_enemy (priority 90)
          'core:hunger': { value: 25 }, // Triggers find_food (priority 80)
          'core:energy': { value: 35 }, // Triggers rest_safely (priority 60)
          'core:position': { locationId: 'test_location' },
        },
      });

      // Set up component accessor
      setupComponentAccessor(actor);

      // Add updateComponent method for actor state changes
      actor.updateComponent = (componentId, data) => {
        const existing = actor.getComponent(componentId);
        if (existing) {
          Object.assign(existing, data);
        } else {
          actor.addComponent(componentId, data);
        }
      };

      testBed.logger.info('=== Phase 1: Initial goal selection ===');

      // Step 3: Create initial context
      let context = testBed.createContext({ actorId: actor.id });

      // Step 4: Select first goal (should be defeat_enemy)
      let selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      expect(selectedGoal).toBeDefined();
      expect(selectedGoal.id).toBe('core:defeat_enemy');
      expect(selectedGoal.priority).toBe(90);

      testBed.logger.info(`Phase 1 goal: ${selectedGoal.id} (priority ${selectedGoal.priority})`);

      // Step 5: Satisfy the defeat_enemy goal (remove in_combat component)
      testBed.logger.info('=== Phase 2: Satisfying defeat_enemy goal ===');
      actor.removeComponent('combat:in_combat');

      // Update context with new state
      context = testBed.createContext({ actorId: actor.id });

      testBed.logger.info('Removed combat:in_combat component - defeat_enemy goal now satisfied');

      // Step 6: Select next goal (should be find_food)
      selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      expect(selectedGoal).toBeDefined();
      expect(selectedGoal.id).toBe('core:find_food');
      expect(selectedGoal.priority).toBe(80);

      testBed.logger.info(`Phase 2 goal: ${selectedGoal.id} (priority ${selectedGoal.priority})`);

      // Step 7: Satisfy the find_food goal (add has_food component)
      testBed.logger.info('=== Phase 3: Satisfying find_food goal ===');
      actor.addComponent('items:has_food', {});

      // Update context with new state
      context = testBed.createContext({ actorId: actor.id });

      testBed.logger.info('Added items:has_food component - find_food goal now satisfied');

      // Step 8: Select next goal (should be rest_safely)
      selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      expect(selectedGoal).toBeDefined();
      expect(selectedGoal.id).toBe('core:rest_safely');
      expect(selectedGoal.priority).toBe(60);

      testBed.logger.info(`Phase 3 goal: ${selectedGoal.id} (priority ${selectedGoal.priority})`);

      // Step 9: Satisfy the rest_safely goal (add lying_down and restore energy)
      testBed.logger.info('=== Phase 4: Satisfying rest_safely goal ===');
      actor.addComponent('positioning:lying_down', {});
      actor.updateComponent('core:energy', { value: 80 });

      // Update context with new state
      context = testBed.createContext({ actorId: actor.id });

      testBed.logger.info('Added positioning:lying_down and restored energy - rest_safely goal now satisfied');

      // Step 10: Verify no goals selected (all satisfied)
      selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      expect(selectedGoal).toBeNull();

      testBed.logger.info('Phase 4 result: No goal selected (all goals satisfied)');
      testBed.logger.info('✅ Goal priority sequence completed successfully');
    }, 60000);

    it('should not select irrelevant goals even if unsatisfied', async () => {
      testBed.logger.info('=== Test: Irrelevant Goal Filtering ===');

      // Step 1: Set up mock goals
      setupMockGoals();

      // Step 2: Create actor with only ONE goal trigger
      // - hunger < 30 + no has_food triggers find_food (priority 80)
      // - defeat_enemy is irrelevant (no combat:in_combat)
      // - rest_safely is irrelevant (energy >= 40)
      const actor = await testBed.createActor({
        name: 'SelectiveActor',
        type: 'goap',
        components: {
          'core:health': { value: 100 }, // No combat trigger
          'core:hunger': { value: 25 }, // Triggers find_food
          'core:energy': { value: 50 }, // Above rest_safely threshold (< 40)
          'core:position': { locationId: 'test_location' },
        },
      });

      setupComponentAccessor(actor);

      testBed.logger.info('Actor created with only find_food trigger');

      // Step 3: Build planning context
      const context = testBed.createContext({ actorId: actor.id });

      // Step 4: Select goal
      const selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      // Step 5: Verify find_food is selected (not defeat_enemy despite higher priority)
      expect(selectedGoal).toBeDefined();
      expect(selectedGoal.id).toBe('core:find_food');
      expect(selectedGoal.priority).toBe(80);

      testBed.logger.info(`Selected goal: ${selectedGoal.id} (priority ${selectedGoal.priority})`);
      testBed.logger.info('✅ Irrelevant higher-priority goal correctly filtered out');
    }, 60000);

    it('should not re-select already satisfied goals', async () => {
      testBed.logger.info('=== Test: Satisfied Goal Filtering ===');

      // Step 1: Set up mock goals
      setupMockGoals();

      // Step 2: Create actor with find_food trigger BUT goal already satisfied
      // - hunger < 30 (relevant)
      // - has_food exists (goal already satisfied)
      const actor = await testBed.createActor({
        name: 'SatisfiedActor',
        type: 'goap',
        components: {
          'core:hunger': { value: 25 }, // Makes find_food relevant
          'items:has_food': {}, // But goal is already satisfied
          'core:energy': { value: 50 }, // rest_safely not relevant
          'core:position': { locationId: 'test_location' },
        },
      });

      setupComponentAccessor(actor);

      testBed.logger.info('Actor created with satisfied find_food goal');

      // Step 3: Build planning context
      const context = testBed.createContext({ actorId: actor.id });

      // Step 4: Select goal
      const selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      // Step 5: Verify no goal selected (find_food is satisfied, others not relevant)
      expect(selectedGoal).toBeNull();

      testBed.logger.info('Result: No goal selected (satisfied goal correctly filtered)');
      testBed.logger.info('✅ Already satisfied goal not re-selected');
    }, 60000);

    it('should handle complex JSON Logic goal state evaluation', async () => {
      testBed.logger.info('=== Test: Complex Goal State Evaluation ===');

      // Step 1: Set up mock goals
      setupMockGoals();

      // Step 2: Create actor to test rest_safely goal's complex goal state
      // rest_safely goal state requires:
      // - positioning:lying_down component exists AND
      // - core:energy.value >= 80
      const actor = await testBed.createActor({
        name: 'ComplexStateActor',
        type: 'goap',
        components: {
          'core:energy': { value: 35 }, // Triggers rest_safely (< 40)
          'core:position': { locationId: 'test_location' },
        },
      });

      setupComponentAccessor(actor);

      // Add updateComponent method for actor state changes
      actor.updateComponent = (componentId, data) => {
        const existing = actor.getComponent(componentId);
        if (existing) {
          Object.assign(existing, data);
        } else {
          actor.addComponent(componentId, data);
        }
      };

      testBed.logger.info('Actor created for complex goal state testing');

      // Step 3: Build initial context
      let context = testBed.createContext({ actorId: actor.id });

      // Step 4: Select goal (rest_safely should be selected)
      let selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      expect(selectedGoal).toBeDefined();
      expect(selectedGoal.id).toBe('core:rest_safely');

      testBed.logger.info('Goal selected: rest_safely');

      // Step 5: Test partial satisfaction (lying down but energy not restored)
      testBed.logger.info('=== Testing partial goal satisfaction ===');
      actor.addComponent('positioning:lying_down', {});
      // Energy still 35 (< 80), goal NOT satisfied yet

      context = testBed.createContext({ actorId: actor.id });

      // Verify goal still selected (not satisfied with only 1 of 2 conditions)
      selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      expect(selectedGoal).toBeDefined();
      expect(selectedGoal.id).toBe('core:rest_safely');

      testBed.logger.info('Partial satisfaction: Goal still selected (lying_down but energy < 80)');

      // Step 6: Complete satisfaction (restore energy)
      testBed.logger.info('=== Testing complete goal satisfaction ===');
      actor.updateComponent('core:energy', { value: 80 });

      context = testBed.createContext({ actorId: actor.id });

      // Verify goal no longer selected (both conditions met)
      selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      expect(selectedGoal).toBeNull();

      testBed.logger.info('Complete satisfaction: No goal selected (lying_down AND energy >= 80)');
      testBed.logger.info('✅ Complex goal state (AND condition) evaluated correctly');
    }, 60000);

    it('should maintain priority ordering with varying relevance conditions', async () => {
      testBed.logger.info('=== Test: Priority Ordering with Varying Relevance ===');

      // Step 1: Set up mock goals
      setupMockGoals();

      // Create multiple scenarios testing priority system robustness

      // Scenario 1: Middle-priority goal relevant, others not
      testBed.logger.info('--- Scenario 1: Only middle-priority goal relevant ---');

      let actor = await testBed.createActor({
        name: 'MiddlePriorityActor',
        type: 'goap',
        components: {
          'core:hunger': { value: 25 }, // find_food (80) relevant
          'core:energy': { value: 50 }, // rest_safely (60) not relevant
          'core:health': { value: 100 }, // defeat_enemy (90) not relevant
          'core:position': { locationId: 'test_location' },
        },
      });

      setupComponentAccessor(actor);

      let context = testBed.createContext({ actorId: actor.id });

      let selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      expect(selectedGoal).toBeDefined();
      expect(selectedGoal.id).toBe('core:find_food');
      expect(selectedGoal.priority).toBe(80);

      testBed.logger.info(`Scenario 1: Selected ${selectedGoal.id} (priority ${selectedGoal.priority})`);

      // Scenario 2: Lowest-priority goal relevant, others not
      testBed.logger.info('--- Scenario 2: Only lowest-priority goal relevant ---');

      actor = await testBed.createActor({
        name: 'LowestPriorityActor',
        type: 'goap',
        components: {
          'core:energy': { value: 35 }, // rest_safely (60) relevant
          'core:hunger': { value: 50 }, // find_food (80) not relevant
          'core:health': { value: 100 }, // defeat_enemy (90) not relevant
          'core:position': { locationId: 'test_location' },
        },
      });

      setupComponentAccessor(actor);

      context = testBed.createContext({ actorId: actor.id });

      selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      expect(selectedGoal).toBeDefined();
      expect(selectedGoal.id).toBe('core:rest_safely');
      expect(selectedGoal.priority).toBe(60);

      testBed.logger.info(`Scenario 2: Selected ${selectedGoal.id} (priority ${selectedGoal.priority})`);

      // Scenario 3: Two goals relevant, higher priority selected
      testBed.logger.info('--- Scenario 3: Two goals relevant, verify higher priority wins ---');

      actor = await testBed.createActor({
        name: 'TwoGoalsActor',
        type: 'goap',
        components: {
          'core:hunger': { value: 25 }, // find_food (80) relevant
          'core:energy': { value: 35 }, // rest_safely (60) relevant
          'core:health': { value: 100 }, // defeat_enemy (90) not relevant
          'core:position': { locationId: 'test_location' },
        },
      });

      setupComponentAccessor(actor);

      context = testBed.createContext({ actorId: actor.id });

      selectedGoal = testBed.goalManager.selectGoal(actor.id, context);

      expect(selectedGoal).toBeDefined();
      expect(selectedGoal.id).toBe('core:find_food');
      expect(selectedGoal.priority).toBe(80);

      testBed.logger.info(`Scenario 3: Selected ${selectedGoal.id} (priority ${selectedGoal.priority}) over rest_safely (60)`);

      testBed.logger.info('✅ Priority ordering maintained across all scenarios');
    }, 60000);
  });
});
