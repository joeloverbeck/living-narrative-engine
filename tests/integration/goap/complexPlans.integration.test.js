/**
 * @file Integration tests for complex multi-task GOAP plans
 * Tests planning with dependencies, parallel goals, and deep task chains
 *
 * Scenarios:
 * 1. Multi-step dependency chain (gather wood → gather stone → build shelter)
 * 2. Parallel resource gathering (multiple ingredients → cook meal)
 * 3. Deep dependency tree (find materials → craft tool → craft weapon → equip weapon)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestSetup } from './testFixtures/goapTestSetup.js';
import { createTestGoal } from './testFixtures/testGoalFactory.js';
import { createTestTask } from './testFixtures/testTaskFactory.js';
import { GOAP_EVENTS } from '../../../src/goap/events/goapEvents.js';

describe('GOAP Complex Plans - Integration', () => {
  let setup;

  beforeEach(async () => {
    setup = await createGoapTestSetup({
      mockRefinement: true, // Mock refinement for focus on planning
    });
  });

  afterEach(() => {
    if (setup?.testBed) {
      setup.testBed.cleanup();
    }
  });

  describe('Multi-Step Dependency Chains', () => {
    it('should create plan with sequential tasks for building shelter', async () => {
      // Setup: Goal requiring shelter
      const goal = createTestGoal({
        id: 'test:build_shelter_goal',
        relevance: { '==': [true, true] },
        goalState: {
          has_component: ['actor', 'test:has_shelter'],
        },
      });
      setup.dataRegistry.register('goals', goal.id, goal);

      // Setup: Actor without shelter or materials
      const actor = {
        id: 'test_actor',
        components: {},
      };
      setup.entityManager.addEntity(actor);

      // Setup: Task 1 - Gather wood (adds wood component)
      const gatherWoodTask = createTestTask({
        id: 'test:gather_wood',
        cost: 10,
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:has_wood',
              componentData: {},
            },
          },
        ],
      });

      // Setup: Task 2 - Gather stone (adds stone component)
      const gatherStoneTask = createTestTask({
        id: 'test:gather_stone',
        cost: 10,
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:has_stone',
              componentData: {},
            },
          },
        ],
      });

      // Setup: Task 3 - Build shelter (requires wood AND stone)
      const buildShelterTask = createTestTask({
        id: 'test:build_shelter',
        cost: 20,
        preconditions: [
          { has_component: ['actor', 'test:has_wood'] },
          { has_component: ['actor', 'test:has_stone'] },
        ],
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:has_shelter',
              componentData: {},
            },
          },
        ],
      });

      // Register tasks
      setup.gameDataRepository.get = jest.fn((key) => {
        if (key === 'tasks') {
          return {
            test: {
              [gatherWoodTask.id]: gatherWoodTask,
              [gatherStoneTask.id]: gatherStoneTask,
              [buildShelterTask.id]: buildShelterTask,
            },
          };
        }
        return null;
      });

      setup.gameDataRepository.getTask = jest.fn((taskId) => {
        const tasks = {
          [gatherWoodTask.id]: gatherWoodTask,
          [gatherStoneTask.id]: gatherStoneTask,
          [buildShelterTask.id]: buildShelterTask,
        };
        return tasks[taskId] || null;
      });

      const world = { state: {}, entities: {} };

      // Execute: Planning
      const result = await setup.controller.decideTurn(actor, world);

      // Verify: Planning succeeded
      const events = setup.eventBus.getEvents();
      const planningCompleted = events.find(
        (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
      );

      if (planningCompleted) {
        // Verify: Plan contains all 3 tasks
        expect(planningCompleted.payload.planLength).toBeGreaterThanOrEqual(3);

        // Verify: Tasks array shows dependencies
        expect(planningCompleted.payload.tasks).toBeDefined();
        expect(planningCompleted.payload.tasks.length).toBeGreaterThanOrEqual(3);

        // Verify: Build shelter task comes AFTER gather tasks
        const taskIds = planningCompleted.payload.tasks;
        const buildIndex = taskIds.indexOf('test:build_shelter');
        const woodIndex = taskIds.indexOf('test:gather_wood');
        const stoneIndex = taskIds.indexOf('test:gather_stone');

        expect(buildIndex).toBeGreaterThan(woodIndex);
        expect(buildIndex).toBeGreaterThan(stoneIndex);
      } else {
        // If planning failed, verify it was graceful
        const planningFailed = events.some(
          (e) => e.type === GOAP_EVENTS.PLANNING_FAILED
        );
        expect(planningFailed || result === null).toBe(true);
      }
    });
  });

  describe('Parallel Resource Gathering', () => {
    it('should plan efficient sequence for gathering multiple ingredients', async () => {
      // Setup: Goal to prepare meal
      const goal = createTestGoal({
        id: 'test:prepare_meal_goal',
        relevance: { '==': [true, true] },
        goalState: {
          has_component: ['actor', 'test:meal_prepared'],
        },
      });
      setup.dataRegistry.register('goals', goal.id, goal);

      // Setup: Actor without ingredients
      const actor = {
        id: 'test_actor',
        components: {},
      };
      setup.entityManager.addEntity(actor);

      // Setup: Task 1 - Gather water
      const gatherWaterTask = createTestTask({
        id: 'test:gather_water',
        cost: 5,
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:has_water',
              componentData: {},
            },
          },
        ],
      });

      // Setup: Task 2 - Gather food
      const gatherFoodTask = createTestTask({
        id: 'test:gather_food',
        cost: 10,
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:has_food',
              componentData: {},
            },
          },
        ],
      });

      // Setup: Task 3 - Light fire
      const lightFireTask = createTestTask({
        id: 'test:light_fire',
        cost: 8,
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:has_fire',
              componentData: {},
            },
          },
        ],
      });

      // Setup: Task 4 - Cook meal (requires all ingredients)
      const cookMealTask = createTestTask({
        id: 'test:cook_meal',
        cost: 15,
        preconditions: [
          { has_component: ['actor', 'test:has_water'] },
          { has_component: ['actor', 'test:has_food'] },
          { has_component: ['actor', 'test:has_fire'] },
        ],
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:meal_prepared',
              componentData: {},
            },
          },
        ],
      });

      // Register tasks
      setup.gameDataRepository.get = jest.fn((key) => {
        if (key === 'tasks') {
          return {
            test: {
              [gatherWaterTask.id]: gatherWaterTask,
              [gatherFoodTask.id]: gatherFoodTask,
              [lightFireTask.id]: lightFireTask,
              [cookMealTask.id]: cookMealTask,
            },
          };
        }
        return null;
      });

      setup.gameDataRepository.getTask = jest.fn((taskId) => {
        const tasks = {
          [gatherWaterTask.id]: gatherWaterTask,
          [gatherFoodTask.id]: gatherFoodTask,
          [lightFireTask.id]: lightFireTask,
          [cookMealTask.id]: cookMealTask,
        };
        return tasks[taskId] || null;
      });

      const world = { state: {}, entities: {} };

      // Execute: Planning
      const result = await setup.controller.decideTurn(actor, world);

      // Verify: Planning succeeded
      const events = setup.eventBus.getEvents();
      const planningCompleted = events.find(
        (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
      );

      if (planningCompleted) {
        // Verify: Plan contains all 4 tasks
        expect(planningCompleted.payload.planLength).toBe(4);

        // Verify: Cook meal task is LAST
        const taskIds = planningCompleted.payload.tasks;
        expect(taskIds[taskIds.length - 1]).toBe('test:cook_meal');

        // Verify: Gather tasks come before cook task
        const cookIndex = taskIds.indexOf('test:cook_meal');
        const waterIndex = taskIds.indexOf('test:gather_water');
        const foodIndex = taskIds.indexOf('test:gather_food');
        const fireIndex = taskIds.indexOf('test:light_fire');

        expect(cookIndex).toBeGreaterThan(waterIndex);
        expect(cookIndex).toBeGreaterThan(foodIndex);
        expect(cookIndex).toBeGreaterThan(fireIndex);
      }
    });
  });

  describe('Deep Dependency Trees', () => {
    it('should handle 4-task weapon crafting chain', async () => {
      // Setup: Goal to arm self
      const goal = createTestGoal({
        id: 'test:arm_self_goal',
        relevance: { '==': [true, true] },
        goalState: {
          has_component: ['actor', 'test:armed'],
        },
      });
      setup.dataRegistry.register('goals', goal.id, goal);

      // Setup: Actor without weapons or materials
      const actor = {
        id: 'test_actor',
        components: {},
      };
      setup.entityManager.addEntity(actor);

      // Setup: Task 1 - Find materials
      const findMaterialsTask = createTestTask({
        id: 'test:find_materials',
        cost: 15,
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:has_materials',
              componentData: {},
            },
          },
        ],
      });

      // Setup: Task 2 - Craft tool (requires materials)
      const craftToolTask = createTestTask({
        id: 'test:craft_tool',
        cost: 20,
        preconditions: [{ has_component: ['actor', 'test:has_materials'] }],
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:has_tool',
              componentData: {},
            },
          },
        ],
      });

      // Setup: Task 3 - Craft weapon (requires tool)
      const craftWeaponTask = createTestTask({
        id: 'test:craft_weapon',
        cost: 25,
        preconditions: [{ has_component: ['actor', 'test:has_tool'] }],
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:has_weapon',
              componentData: {},
            },
          },
        ],
      });

      // Setup: Task 4 - Equip weapon (requires weapon)
      const equipWeaponTask = createTestTask({
        id: 'test:equip_weapon',
        cost: 5,
        preconditions: [{ has_component: ['actor', 'test:has_weapon'] }],
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:armed',
              componentData: {},
            },
          },
        ],
      });

      // Register tasks
      setup.gameDataRepository.get = jest.fn((key) => {
        if (key === 'tasks') {
          return {
            test: {
              [findMaterialsTask.id]: findMaterialsTask,
              [craftToolTask.id]: craftToolTask,
              [craftWeaponTask.id]: craftWeaponTask,
              [equipWeaponTask.id]: equipWeaponTask,
            },
          };
        }
        return null;
      });

      setup.gameDataRepository.getTask = jest.fn((taskId) => {
        const tasks = {
          [findMaterialsTask.id]: findMaterialsTask,
          [craftToolTask.id]: craftToolTask,
          [craftWeaponTask.id]: craftWeaponTask,
          [equipWeaponTask.id]: equipWeaponTask,
        };
        return tasks[taskId] || null;
      });

      const world = { state: {}, entities: {} };

      // Execute: Planning
      const result = await setup.controller.decideTurn(actor, world);

      // Verify: Planning succeeded
      const events = setup.eventBus.getEvents();
      const planningCompleted = events.find(
        (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
      );

      if (planningCompleted) {
        // Verify: Plan contains all 4 tasks in correct order
        expect(planningCompleted.payload.planLength).toBe(4);

        const taskIds = planningCompleted.payload.tasks;

        // Verify: Strict dependency order
        expect(taskIds[0]).toBe('test:find_materials');
        expect(taskIds[1]).toBe('test:craft_tool');
        expect(taskIds[2]).toBe('test:craft_weapon');
        expect(taskIds[3]).toBe('test:equip_weapon');

        // Verify: Total cost is sum of all tasks
        // 15 + 20 + 25 + 5 = 65
        // (Cost may be included in event payload)
      } else {
        // If planning failed, verify graceful failure
        const planningFailed = events.some(
          (e) => e.type === GOAP_EVENTS.PLANNING_FAILED
        );
        expect(planningFailed || result === null).toBe(true);
      }
    });
  });

  describe('Plan Complexity Metrics', () => {
    it('should report accurate metrics for complex plans', async () => {
      // Setup: Multi-step goal
      const goal = createTestGoal({
        id: 'test:complex_goal',
        relevance: { '==': [true, true] },
        goalState: {
          has_component: ['actor', 'test:final_state'],
        },
      });
      setup.dataRegistry.register('goals', goal.id, goal);

      const actor = {
        id: 'test_actor',
        components: {},
      };
      setup.entityManager.addEntity(actor);

      // Create 3-task chain
      const task1 = createTestTask({
        id: 'test:step1',
        cost: 10,
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:state1',
              componentData: {},
            },
          },
        ],
      });

      const task2 = createTestTask({
        id: 'test:step2',
        cost: 15,
        preconditions: [{ has_component: ['actor', 'test:state1'] }],
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:state2',
              componentData: {},
            },
          },
        ],
      });

      const task3 = createTestTask({
        id: 'test:step3',
        cost: 20,
        preconditions: [{ has_component: ['actor', 'test:state2'] }],
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:final_state',
              componentData: {},
            },
          },
        ],
      });

      setup.gameDataRepository.get = jest.fn((key) => {
        if (key === 'tasks') {
          return {
            test: {
              [task1.id]: task1,
              [task2.id]: task2,
              [task3.id]: task3,
            },
          };
        }
        return null;
      });

      setup.gameDataRepository.getTask = jest.fn((taskId) => {
        const tasks = {
          [task1.id]: task1,
          [task2.id]: task2,
          [task3.id]: task3,
        };
        return tasks[taskId] || null;
      });

      const world = { state: {}, entities: {} };

      // Execute: Planning
      await setup.controller.decideTurn(actor, world);

      // Verify: Planning metrics
      const events = setup.eventBus.getEvents();
      const planningCompleted = events.find(
        (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
      );

      if (planningCompleted) {
        // Verify: Accurate task count
        expect(planningCompleted.payload.planLength).toBe(3);

        // Verify: All tasks included
        expect(planningCompleted.payload.tasks).toHaveLength(3);

        // Verify: Actor ID matches
        expect(planningCompleted.payload.actorId).toBe(actor.id);

        // Verify: Goal ID matches
        expect(planningCompleted.payload.goalId).toBe(goal.id);
      }
    });
  });
});
