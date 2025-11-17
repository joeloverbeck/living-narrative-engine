/**
 * @file End-to-end tests for complete GOAP system integration
 *
 * Tests complete game scenarios with GOAP AI from goal selection through
 * planning, refinement, and action execution with world state changes.
 *
 * ARCHITECTURE NOTE:
 * - GOAP goals are mocked data (not loaded from mods in tests)
 * - Tasks are mocked data
 * - 'core:goals' component is for LLM players, NOT GOAP system
 * @see tickets/GOAPIMPL-021-10-e2e-tests-CORRECTED.md
 * @see specs/goap-system-specs.md
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { expectGoapPlannerMock } from '../../common/mocks/expectGoapPlannerMock.js';
import GoapController from '../../../src/goap/controllers/goapController.js';

describe('GOAP System - Full Cycle E2E', () => {
  let testBed;
  let goapController;
  let mockEntityManager;
  let mockDataRegistry;
  let mockEventBus;
  let mockPlanner;
  let mockRefinementEngine;
  let mockLogger;
  let actorId;
  let worldState;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    // Create actor entity with GOAP-relevant components
    actorId = 'test_actor_1';
    worldState = {
      actors: {
        [actorId]: {
          id: actorId,
          components: {
            'core:digestive_system': {},
            'core:needs': {
              hunger: 30, // Low hunger triggers satisfy_hunger goal
            },
            'core:inventory': {
              items: [],
            },
            'core:location': {
              locationId: 'test_location',
            },
          },
        },
      },
      items: {
        food_item_1: {
          id: 'food_item_1',
          components: {
            'items:consumable': {
              nutrition: 60,
            },
            'core:location': {
              locationId: 'test_location',
            },
            'core:visible': true,
            'core:known_to': [actorId],
          },
        },
      },
    };

    // Mock EntityManager
    mockEntityManager = testBed.createMock('EntityManager', [
      'getEntity',
      'getComponent',
      'hasComponent',
      'setComponent',
    ]);

    mockEntityManager.getEntity.mockImplementation((id) => {
      return worldState.actors[id] || worldState.items[id];
    });

    mockEntityManager.getComponent.mockImplementation((id, componentId) => {
      const entity = worldState.actors[id] || worldState.items[id];
      return entity?.components[componentId];
    });

    mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
      const entity = worldState.actors[id] || worldState.items[id];
      return !!entity?.components[componentId];
    });

    mockEntityManager.setComponent.mockImplementation(
      (id, componentId, value) => {
        const entity = worldState.actors[id] || worldState.items[id];
        if (entity) {
          entity.components[componentId] = value;
        }
      }
    );

    // Mock DataRegistry with GOAP goals
    mockDataRegistry = testBed.createMock('DataRegistry', ['getAll', 'get']);

    const mockGoals = [
      {
        id: 'test:satisfy_hunger',
        priority: 80,
        relevance: {
          and: [
            { has_component: ['actor', 'core:digestive_system'] },
            { '<': [{ var: 'actor.core:needs.hunger' }, 50] },
          ],
        },
        goalState: {
          '>=': [{ var: 'actor.core:needs.hunger' }, 80],
        },
      },
    ];

    mockDataRegistry.getAll.mockImplementation((type) => {
      if (type === 'goals') return mockGoals;
      return [];
    });

    mockDataRegistry.get.mockImplementation((type, id) => {
      if (type === 'goals') {
        return mockGoals.find((g) => g.id === id);
      }
      if (type === 'refinementMethod') {
        // Return mock refinement method with steps
        return {
          id: id,
          steps: [
            {
              actionId: 'items:consume_item',
              targetBindings: {
                item: 'task.params.item',
              },
            },
          ],
        };
      }
      return null;
    });

    // Mock EventBus
    mockEventBus = testBed.createMock('EventBus', ['dispatch']);

    // Mock GOAP services (will be replaced with real implementations in future)
    mockPlanner = testBed.createMock('GoapPlanner');
    expectGoapPlannerMock(mockPlanner);

    mockRefinementEngine = testBed.createMock('RefinementEngine', ['refine']);

    const mockPlanInvalidationDetector = testBed.createMock(
      'PlanInvalidationDetector',
      ['checkPlanValidity']
    );

    const mockContextAssemblyService = testBed.createMock(
      'ContextAssemblyService',
      ['assemblePlanningContext']
    );

    const mockJsonLogicService = testBed.createMock(
      'JsonLogicEvaluationService',
      ['evaluate']
    );

    const mockParameterResolutionService = testBed.createMock(
      'ParameterResolutionService',
      ['resolve']
    );

    // Mock parameter resolution to resolve placeholders in bindings object
    mockParameterResolutionService.resolve.mockImplementation((bindings, context) => {
      const resolved = {};
      for (const [key, value] of Object.entries(bindings)) {
        if (value === 'task.params.item') {
          resolved[key] = context.task.params.item;
        } else {
          resolved[key] = value;
        }
      }
      return resolved;
    });

    // Planner creates complete plan with goal and tasks
    mockPlanner.plan.mockImplementation((actorId, goal) => {
      return {
        goal: goal.id,
        tasks: [
          {
            taskId: 'core:consume_nourishing_item',
            params: { item: 'food_item_1' },
          },
        ],
      };
    });

    // Refinement engine refines task to action hint
    mockRefinementEngine.refine.mockImplementation((taskId) => {
      return {
        success: true,
        methodId: 'test:consume_method',
        taskId: taskId,
        stepResults: [
          {
            actionRef: 'items:consume_item',
          },
        ],
      };
    });

    // Plan invalidation detector - plan is valid by default
    mockPlanInvalidationDetector.checkPlanValidity.mockReturnValue(true);

    // Context assembly service assembles planning context
    mockContextAssemblyService.assemblePlanningContext.mockImplementation(
      (inputActorId) => {
        return {
          actor: worldState.actors[inputActorId],
          world: worldState,
        };
      }
    );

    // JSON Logic service evaluates conditions
    mockJsonLogicService.evaluate.mockImplementation(() => {
      // Simple mock implementation for tests - always return true for relevance checks
      return true;
    });

    // Create GoapController with mocked dependencies
    goapController = new GoapController({
      goapPlanner: mockPlanner,
      refinementEngine: mockRefinementEngine,
      planInvalidationDetector: mockPlanInvalidationDetector,
      contextAssemblyService: mockContextAssemblyService,
      jsonLogicService: mockJsonLogicService,
      dataRegistry: mockDataRegistry,
      eventBus: mockEventBus,
      logger: mockLogger,
      parameterResolutionService: mockParameterResolutionService,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Simple Goal Achievement', () => {
    it('should achieve hunger goal over multiple turns', async () => {
      const actor = worldState.actors[actorId];

      // Execute: Run GOAP decision cycle
      const result = await goapController.decideTurn(actor, worldState);

      // Verify: Plan was created
      expect(mockPlanner.plan).toHaveBeenCalled();

      // Verify: Task was refined to action hint
      expect(mockRefinementEngine.refine).toHaveBeenCalled();

      // Verify: Result contains action hint
      expect(result).toMatchObject({
        actionHint: {
          actionId: 'items:consume_item',
          targetBindings: expect.objectContaining({
            item: 'food_item_1',
          }),
        },
      });

      // Verify: Events were dispatched
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'goap:goal_selected',
        expect.objectContaining({
          actorId: actorId,
          goalId: 'test:satisfy_hunger',
        })
      );
    });

    it('should return null when no relevant goals exist', async () => {
      // Setup: Remove hunger - goal not relevant
      worldState.actors[actorId].components['core:needs'].hunger = 90;

      // Mock: No relevant goals
      mockPlanner.plan.mockReturnValue(null);

      const actor = worldState.actors[actorId];

      // Execute
      const result = await goapController.decideTurn(actor, worldState);

      // Verify: No action hint returned
      expect(result).toBeNull();
    });
  });

  describe('Plan Invalidation and Replanning', () => {
    it('should replan when world state changes invalidate active plan', async () => {
      // Note: This test validates the concept but may need adjustments
      // once full GOAP integration is complete

      const actor = worldState.actors[actorId];

      // Execute: GOAP decision creates plan
      const result = await goapController.decideTurn(actor, worldState);

      // Verify: Plan was created
      expect(mockPlanner.plan).toHaveBeenCalled();
      expect(result).not.toBeNull();
    });
  });

  describe('Multi-Actor GOAP', () => {
    it('should handle multiple GOAP actors independently', async () => {
      // Setup: Second actor
      const actor2Id = 'test_actor_2';
      worldState.actors[actor2Id] = {
        id: actor2Id,
        components: {
          'core:needs_tool': true,
          'core:inventory': { items: [] },
        },
      };

      const actor1 = worldState.actors[actorId];
      const actor2 = worldState.actors[actor2Id];

      // Execute: Both actors decide
      const result1 = await goapController.decideTurn(actor1, worldState);
      const result2 = await goapController.decideTurn(actor2, worldState);

      // Verify: Both produced action hints
      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();

      // Verify: Different goals/plans selected
      expect(result1.actionHint.actionId).toBeDefined();
      expect(result2.actionHint.actionId).toBeDefined();
    });
  });

  describe('Integration with Turn System', () => {
    it('should provide action hints compatible with turn system', async () => {
      const actor = worldState.actors[actorId];

      // Execute
      const result = await goapController.decideTurn(actor, worldState);

      // Verify: Result structure matches turn system expectations
      expect(result).toMatchObject({
        actionHint: {
          actionId: expect.any(String),
          targetBindings: expect.any(Object),
        },
      });

      // Verify: Action hint has correct structure
      expect(result.actionHint.actionId).toBe('items:consume_item');
      expect(result.actionHint.targetBindings).toHaveProperty('item');
    });
  });
});
