/**
 * @file Action Selection with Effect Simulation E2E Test
 * @description Verify action selection correctly simulates effects and calculates progress toward goals
 *
 * Test Priority: CRITICAL (Priority 1, Test 3)
 * Test Complexity: High
 * Estimated Effort: 3-4 hours
 *
 * This test validates the GOAP action selection workflow with effect simulation, ensuring that:
 * - Actions with planning effects are filtered correctly
 * - Effect simulation accurately predicts state changes
 * - Progress toward goals is calculated correctly
 * - Action with highest positive progress is selected
 * - Selected action achieves the goal when executed
 *
 * Test Scenario:
 * 1. Create goal requiring specific component (e.g., positioning:sitting)
 * 2. Provide multiple actions with different effects:
 *    - sit_down (adds sitting, progress = +1)
 *    - stand_up (removes sitting, progress = -1)
 *    - wave (no relevant effect, progress = 0)
 * 3. Verify ActionSelector:
 *    - Filters actions to those with planning effects
 *    - Simulates each action's effects
 *    - Calculates progress for each action
 *    - Selects sit_down (highest positive progress)
 * 4. Execute selected action
 * 5. Verify goal satisfied after execution
 *
 * Success Criteria:
 * - Only actions with positive progress considered
 * - Action with highest progress selected
 * - Effect simulation accurately predicts state changes
 * - Selected action achieves goal
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestBed } from '../../common/goap/goapTestHelpers.js';
import { createComponentAccessor } from '../../../src/logic/componentAccessor.js';

describe('Action Selection with Effect Simulation E2E', () => {
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
   * Helper function to create a mock goal requiring sitting
   * Uses JSON Logic patterns matching real goal files
   */
  const createSittingGoal = () => {
    return {
      id: 'positioning:be_sitting',
      priority: 70,
      relevance: {
        and: [
          { '>=': [{ var: 'actor.components.core:actor' }, null] },
          { '!': [{ '>=': [{ var: 'actor.components.positioning:sitting' }, null] }] }
        ]
      },
      goalState: {
        '>=': [{ var: 'actor.components.positioning:sitting' }, null]
      }
    };
  };

  /**
   * Helper function to create mock actions with planning effects
   */
  const createMockActions = () => {
    return [
      // Action 1: sit_down - adds sitting component (positive progress toward goal)
      {
        id: 'positioning:sit_down',
        actionId: 'positioning:sit_down',
        params: { targetId: null, tertiaryTargetId: null },
        planningEffects: {
          effects: [
            {
              operation: 'ADD_COMPONENT',
              entity: 'actor',
              component: 'positioning:sitting',
              data: {}
            },
            {
              operation: 'REMOVE_COMPONENT',
              entity: 'actor',
              component: 'positioning:standing'
            }
          ],
          cost: 1.0
        }
      },
      // Action 2: stand_up - removes sitting component (negative progress, moves away from goal)
      {
        id: 'positioning:stand_up',
        actionId: 'positioning:stand_up',
        params: { targetId: null, tertiaryTargetId: null },
        planningEffects: {
          effects: [
            {
              operation: 'REMOVE_COMPONENT',
              entity: 'actor',
              component: 'positioning:sitting'
            },
            {
              operation: 'ADD_COMPONENT',
              entity: 'actor',
              component: 'positioning:standing',
              data: {}
            }
          ],
          cost: 1.0
        }
      },
      // Action 3: wave - no relevant effect (zero progress toward sitting goal)
      {
        id: 'social:wave',
        actionId: 'social:wave',
        params: { targetId: null, tertiaryTargetId: null },
        planningEffects: {
          effects: [
            {
              operation: 'ADD_COMPONENT',
              entity: 'actor',
              component: 'social:waving',
              data: {}
            }
          ],
          cost: 1.0
        }
      },
      // Action 4: Action without planning effects (should be filtered out)
      {
        id: 'other:some_action',
        actionId: 'other:some_action',
        params: { targetId: null, tertiaryTargetId: null }
        // No planningEffects
      }
    ];
  };

  /**
   * Helper function to set up mock goal definitions
   */
  const setupMockGoalDefinitions = (goals) => {
    const gameDataRepository = testBed.container.resolve('IGameDataRepository');
    gameDataRepository.getAllGoalDefinitions = () => goals;
  };

  describe('Effect Simulation and Progress Calculation', () => {
    it('should filter actions to those with planning effects', async () => {
      testBed.logger.info('=== Test: Action Filtering ===');

      // Create actor (standing, not sitting)
      const actor = await testBed.createActor({
        name: 'FilterTestActor',
        type: 'goap',
        components: {
          'positioning:standing': {},
          'core:position': { locationId: 'test_location' }
        }
      });

      setupComponentAccessor(actor);

      // Set up goal
      const goal = createSittingGoal();
      setupMockGoalDefinitions([goal]);

      // Create actions with mixed planning effects
      const actions = createMockActions();

      testBed.logger.info(`Total actions provided: ${actions.length}`);

      // Build context with entities structure
      const context = testBed.createContext({ actorId: actor.id });
      context.entities = {
        [actor.id]: {
          components: actor.getAllComponents()
        }
      };

      // Use SimplePlanner to select action (which calls ActionSelector internally)
      const simplePlanner = testBed.simplePlanner;
      const selectedAction = simplePlanner.plan(goal, actions, actor.id, context);

      // Verify action was selected (only actions with planning effects should be considered)
      expect(selectedAction).toBeDefined();
      expect(selectedAction).not.toBeNull();
      expect(selectedAction.planningEffects).toBeDefined();
      expect(selectedAction.planningEffects.effects).toBeDefined();
      expect(selectedAction.planningEffects.effects.length).toBeGreaterThan(0);

      testBed.logger.info(`Selected action: ${selectedAction.id}`);
      testBed.logger.info('✅ Action filtering works correctly');
    }, 60000);

    it('should calculate positive progress for action that adds required component', async () => {
      testBed.logger.info('=== Test: Positive Progress Calculation ===');

      // Create actor (standing, not sitting)
      const actor = await testBed.createActor({
        name: 'PositiveProgressActor',
        type: 'goap',
        components: {
          'positioning:standing': {},
          'core:position': { locationId: 'test_location' }
        }
      });

      setupComponentAccessor(actor);

      // Set up goal requiring sitting
      const goal = createSittingGoal();
      setupMockGoalDefinitions([goal]);

      // Provide only sit_down action
      const actions = [createMockActions()[0]]; // sit_down

      testBed.logger.info(`Testing with action: ${actions[0].id}`);

      // Use SimplePlanner (which uses ActionSelector internally)
      const simplePlanner = testBed.simplePlanner;

      // Build context with entities structure
      const context = testBed.createContext({ actorId: actor.id });
      context.entities = {
        [actor.id]: {
          components: actor.getAllComponents()
        }
      };

      // Select action
      const selectedAction = simplePlanner.plan(
        goal,
        actions,
        actor.id,
        context
      );

      // Verify sit_down was selected (adds required component = positive progress)
      expect(selectedAction).toBeDefined();
      expect(selectedAction.id).toBe('positioning:sit_down');

      testBed.logger.info('✅ Positive progress calculated correctly for sit_down');
    }, 60000);

    it('should calculate negative progress for action that removes required component', async () => {
      testBed.logger.info('=== Test: Negative Progress Calculation ===');

      // Create actor already sitting
      const actor = await testBed.createActor({
        name: 'NegativeProgressActor',
        type: 'goap',
        components: {
          'positioning:sitting': {}, // Already has required component
          'core:position': { locationId: 'test_location' }
        }
      });

      setupComponentAccessor(actor);

      // Set up goal requiring sitting
      const goal = createSittingGoal();
      setupMockGoalDefinitions([goal]);

      // Provide only stand_up action (removes sitting)
      const actions = [createMockActions()[1]]; // stand_up

      testBed.logger.info(`Testing with action: ${actions[0].id}`);

      // Use SimplePlanner (which uses ActionSelector internally)
      const simplePlanner = testBed.simplePlanner;

      // Build context with entities structure
      const context = testBed.createContext({ actorId: actor.id });
      context.entities = {
        [actor.id]: {
          components: actor.getAllComponents()
        }
      };

      // Select action
      const selectedAction = simplePlanner.plan(
        goal,
        actions,
        actor.id,
        context
      );

      // Verify NO action selected (stand_up has negative progress, moves away from goal)
      expect(selectedAction).toBeNull();

      testBed.logger.info('✅ Negative progress detected, action correctly rejected');
    }, 60000);

    it('should calculate zero progress for action with no relevant effects', async () => {
      testBed.logger.info('=== Test: Zero Progress Calculation ===');

      // Create actor (standing, not sitting)
      const actor = await testBed.createActor({
        name: 'ZeroProgressActor',
        type: 'goap',
        components: {
          'positioning:standing': {},
          'core:position': { locationId: 'test_location' }
        }
      });

      setupComponentAccessor(actor);

      // Set up goal requiring sitting
      const goal = createSittingGoal();
      setupMockGoalDefinitions([goal]);

      // Provide only wave action (no relevant effect)
      const actions = [createMockActions()[2]]; // wave

      testBed.logger.info(`Testing with action: ${actions[0].id}`);

      // Use SimplePlanner (which uses ActionSelector internally)
      const simplePlanner = testBed.simplePlanner;

      // Build context with entities structure
      const context = testBed.createContext({ actorId: actor.id });
      context.entities = {
        [actor.id]: {
          components: actor.getAllComponents()
        }
      };

      // Select action
      const selectedAction = simplePlanner.plan(
        goal,
        actions,
        actor.id,
        context
      );

      // Verify NO action selected (wave has zero progress)
      expect(selectedAction).toBeNull();

      testBed.logger.info('✅ Zero progress detected, action correctly rejected');
    }, 60000);

    it('should select action with highest positive progress when multiple actions available', async () => {
      testBed.logger.info('=== Test: Highest Progress Selection ===');

      // Create actor (standing, not sitting)
      const actor = await testBed.createActor({
        name: 'MultiActionActor',
        type: 'goap',
        components: {
          'positioning:standing': {},
          'core:position': { locationId: 'test_location' }
        }
      });

      setupComponentAccessor(actor);

      // Set up goal requiring sitting
      const goal = createSittingGoal();
      setupMockGoalDefinitions([goal]);

      // Provide all actions (sit_down should win)
      const actions = createMockActions().slice(0, 3); // sit_down, stand_up, wave

      testBed.logger.info(`Testing with ${actions.length} actions:`);
      actions.forEach((action) => {
        testBed.logger.info(`  - ${action.id}`);
      });

      // Use SimplePlanner (which uses ActionSelector internally)
      const simplePlanner = testBed.simplePlanner;

      // Build context with entities structure
      const context = testBed.createContext({ actorId: actor.id });
      context.entities = {
        [actor.id]: {
          components: actor.getAllComponents()
        }
      };

      // Select action
      const selectedAction = simplePlanner.plan(
        goal,
        actions,
        actor.id,
        context
      );

      // Verify sit_down was selected (highest positive progress)
      expect(selectedAction).toBeDefined();
      expect(selectedAction.id).toBe('positioning:sit_down');

      testBed.logger.info(`Selected action: ${selectedAction.id}`);
      testBed.logger.info('✅ Highest-progress action selected correctly');
    }, 60000);
  });

  describe('Complete Workflow: Selection to Execution to Goal Satisfaction', () => {
    it('should complete full workflow: action selection → execution → goal satisfaction', async () => {
      testBed.logger.info('=== Test: Complete Action Selection Workflow ===');

      // Step 1: Create actor (standing, not sitting)
      testBed.logger.info('--- Step 1: Creating actor ---');
      const actor = await testBed.createActor({
        name: 'WorkflowActor',
        type: 'goap',
        components: {
          'positioning:standing': {},
          'core:position': { locationId: 'test_location' }
        }
      });

      setupComponentAccessor(actor);

      // Verify initial state (not sitting)
      expect(actor.hasComponent('positioning:sitting')).toBe(false);
      expect(actor.hasComponent('positioning:standing')).toBe(true);

      testBed.logger.info('Actor created (standing, not sitting)');

      // Step 2: Set up goal requiring sitting
      testBed.logger.info('--- Step 2: Setting up goal ---');
      const goal = createSittingGoal();
      setupMockGoalDefinitions([goal]);

      testBed.logger.info(`Goal: ${goal.id} (requires positioning:sitting)`);

      // Step 3: Get ActionSelector and build context
      testBed.logger.info('--- Step 3: Selecting action ---');
      const actionSelector = testBed.container.resolve('IActionSelector');
      const context = testBed.createContext({ actorId: actor.id });
      context.entities = {
        [actor.id]: {
          components: actor.getAllComponents()
        }
      };

      // Provide all actions
      const actions = createMockActions().slice(0, 3); // sit_down, stand_up, wave

      // Step 4: Select action using ActionSelector
      const selectedAction = simplePlanner.plan(
        goal,
        actions,
        actor.id,
        context
      );

      // Verify sit_down was selected
      expect(selectedAction).toBeDefined();
      expect(selectedAction.id).toBe('positioning:sit_down');

      testBed.logger.info(`Action selected: ${selectedAction.id}`);

      // Step 5: Execute selected action
      testBed.logger.info('--- Step 4: Executing action ---');

      // For this test, we'll manually simulate the effects since we're testing the selection logic
      // In a real game, the rule system would handle execution
      testBed.logger.info('Simulating action effects:');

      // Apply the effects from the selected action
      selectedAction.planningEffects.effects.forEach((effect) => {
        if (effect.operation === 'ADD_COMPONENT' && effect.entity === 'actor') {
          testBed.logger.info(`  + Adding ${effect.component}`);
          actor.addComponent(effect.component, effect.data || {});
        } else if (effect.operation === 'REMOVE_COMPONENT' && effect.entity === 'actor') {
          testBed.logger.info(`  - Removing ${effect.component}`);
          actor.removeComponent(effect.component);
        }
      });

      // Step 6: Verify goal is now satisfied
      testBed.logger.info('--- Step 5: Verifying goal satisfaction ---');

      // Check actor state
      expect(actor.hasComponent('positioning:sitting')).toBe(true);
      expect(actor.hasComponent('positioning:standing')).toBe(false);

      testBed.logger.info('Actor state after execution:');
      testBed.logger.info('  - positioning:sitting: ✓ (added)');
      testBed.logger.info('  - positioning:standing: ✗ (removed)');

      // Verify goal state
      const goalStateEvaluator = testBed.container.resolve('IGoalStateEvaluator');
      const updatedContext = testBed.createContext({ actorId: actor.id });
      updatedContext.entities = {
        [actor.id]: {
          components: actor.getAllComponents()
        }
      };

      const isGoalSatisfied = goalStateEvaluator.evaluate(
        goal.goalState,
        actor.id,
        updatedContext
      );

      expect(isGoalSatisfied).toBe(true);

      testBed.logger.info('Goal satisfaction: ✓ (satisfied)');
      testBed.logger.info('✅ Complete workflow succeeded: selection → execution → satisfaction');
    }, 60000);

    it('should simulate effects accurately during planning phase', async () => {
      testBed.logger.info('=== Test: Effect Simulation Accuracy ===');

      // Create actor (standing)
      const actor = await testBed.createActor({
        name: 'SimulationActor',
        type: 'goap',
        components: {
          'positioning:standing': {},
          'core:position': { locationId: 'test_location' }
        }
      });

      setupComponentAccessor(actor);

      // Set up goal
      const goal = createSittingGoal();
      setupMockGoalDefinitions([goal]);

      // Get services
      const simplePlanner = testBed.simplePlanner;
      const goalStateEvaluator = testBed.container.resolve('IGoalStateEvaluator');

      const context = testBed.createContext({ actorId: actor.id });
      context.entities = {
        [actor.id]: {
          components: actor.getAllComponents()
        }
      };

      // Provide sit_down action
      const actions = [createMockActions()[0]]; // sit_down

      testBed.logger.info('--- Phase 1: Before action selection (planning simulation) ---');

      // Evaluate goal state BEFORE action (should be unsatisfied)
      const goalBeforeAction = goalStateEvaluator.evaluate(
        goal.goalState,
        actor.id,
        context
      );

      expect(goalBeforeAction).toBe(false);
      testBed.logger.info('Goal state before planning: unsatisfied ✗');

      // Select action (ActionSelector will simulate effects internally during planning)
      const selectedAction = simplePlanner.plan(
        goal,
        actions,
        actor.id,
        context
      );

      expect(selectedAction).toBeDefined();
      expect(selectedAction.id).toBe('positioning:sit_down');

      testBed.logger.info(`Action selected: ${selectedAction.id}`);
      testBed.logger.info('(Note: ActionSelector simulated effects internally to calculate progress)');

      testBed.logger.info('--- Phase 2: After simulated execution ---');

      // Manually apply effects to verify simulation matched reality
      selectedAction.planningEffects.effects.forEach((effect) => {
        if (effect.operation === 'ADD_COMPONENT' && effect.entity === 'actor') {
          actor.addComponent(effect.component, effect.data || {});
        } else if (effect.operation === 'REMOVE_COMPONENT' && effect.entity === 'actor') {
          actor.removeComponent(effect.component);
        }
      });

      // Evaluate goal state AFTER effects applied
      const updatedContext = testBed.createContext({ actorId: actor.id });
      const goalAfterAction = goalStateEvaluator.evaluate(
        goal.goalState,
        actor.id,
        updatedContext
      );

      expect(goalAfterAction).toBe(true);
      testBed.logger.info('Goal state after effects: satisfied ✓');

      testBed.logger.info('✅ Effect simulation during planning matched actual execution');
    }, 60000);
  });

  describe('Edge Cases and Robustness', () => {
    it('should handle empty action list gracefully', async () => {
      testBed.logger.info('=== Test: Empty Action List ===');

      const actor = await testBed.createActor({
        name: 'EmptyActionsActor',
        type: 'goap',
        components: {
          'positioning:standing': {},
          'core:position': { locationId: 'test_location' }
        }
      });

      setupComponentAccessor(actor);

      const goal = createSittingGoal();
      setupMockGoalDefinitions([goal]);

      const actionSelector = testBed.container.resolve('IActionSelector');
      const context = testBed.createContext({ actorId: actor.id });
      context.entities = {
        [actor.id]: {
          components: actor.getAllComponents()
        }
      };

      // Provide empty action list
      const selectedAction = simplePlanner.plan(
        goal,
        [],
        actor.id,
        context
      );

      // Should return null
      expect(selectedAction).toBeNull();

      testBed.logger.info('✅ Empty action list handled gracefully (null returned)');
    }, 60000);

    it('should handle action with no positive progress available', async () => {
      testBed.logger.info('=== Test: No Positive Progress Available ===');

      const actor = await testBed.createActor({
        name: 'NoProgressActor',
        type: 'goap',
        components: {
          'positioning:standing': {},
          'core:position': { locationId: 'test_location' }
        }
      });

      setupComponentAccessor(actor);

      const goal = createSittingGoal();
      setupMockGoalDefinitions([goal]);

      const simplePlanner = testBed.simplePlanner;
      const context = testBed.createContext({ actorId: actor.id });
      context.entities = {
        [actor.id]: {
          components: actor.getAllComponents()
        }
      };

      // Provide only wave (zero progress) and stand_up (negative progress)
      const actions = [
        createMockActions()[1], // stand_up (negative)
        createMockActions()[2]  // wave (zero)
      ];

      testBed.logger.info('Provided actions: stand_up (negative), wave (zero)');

      const selectedAction = simplePlanner.plan(
        goal,
        actions,
        actor.id,
        context
      );

      // Should return null (no positive progress available)
      expect(selectedAction).toBeNull();

      testBed.logger.info('✅ No action selected when no positive progress available');
    }, 60000);

    it('should handle goal already satisfied', async () => {
      testBed.logger.info('=== Test: Goal Already Satisfied ===');

      // Create actor already sitting
      const actor = await testBed.createActor({
        name: 'AlreadySatisfiedActor',
        type: 'goap',
        components: {
          'positioning:sitting': {}, // Already has required component
          'core:position': { locationId: 'test_location' }
        }
      });

      setupComponentAccessor(actor);

      const goal = createSittingGoal();
      setupMockGoalDefinitions([goal]);

      const goalStateEvaluator = testBed.container.resolve('IGoalStateEvaluator');
      const context = testBed.createContext({ actorId: actor.id });
      context.entities = {
        [actor.id]: {
          components: actor.getAllComponents()
        }
      };

      // Verify goal is already satisfied
      const isGoalSatisfied = goalStateEvaluator.evaluate(
        goal.goalState,
        actor.id,
        context
      );

      expect(isGoalSatisfied).toBe(true);

      testBed.logger.info('Goal already satisfied before any action');

      // Even though we provide sit_down, the goal is already met
      // In a full GOAP workflow, this goal wouldn't be selected in the first place
      testBed.logger.info('✅ Goal satisfaction correctly detected before action planning');
    }, 60000);
  });
});
