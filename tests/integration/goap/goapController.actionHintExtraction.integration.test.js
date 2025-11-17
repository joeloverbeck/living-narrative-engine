/**
 * @file Integration tests for GoapController - Action Hint Extraction (GOAPIMPL-021-04)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GoapController from '../../../src/goap/controllers/goapController.js';
import { createGoapPlannerMock } from '../../common/mocks/createGoapPlannerMock.js';
import { expectGoapPlannerMock } from '../../common/mocks/expectGoapPlannerMock.js';

describe('GoapController - Action Hint Extraction Integration', () => {
  let mockLogger;
  let mockGoapPlanner;
  let mockRefinementEngine;
  let mockPlanInvalidationDetector;
  let mockContextAssemblyService;
  let mockJsonLogicService;
  let mockDataRegistry;
  let mockEventBus;
  let mockParameterResolutionService;
  let controller;

  const createValidDependencies = () => ({
    goapPlanner: mockGoapPlanner,
    refinementEngine: mockRefinementEngine,
    planInvalidationDetector: mockPlanInvalidationDetector,
    contextAssemblyService: mockContextAssemblyService,
    jsonLogicService: mockJsonLogicService,
    dataRegistry: mockDataRegistry,
    eventBus: mockEventBus,
    logger: mockLogger,
    parameterResolutionService: mockParameterResolutionService,
  });

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockGoapPlanner = createGoapPlannerMock();
    expectGoapPlannerMock(mockGoapPlanner);

    mockRefinementEngine = {
      refine: jest.fn(),
    };

    mockPlanInvalidationDetector = {
      checkPlanValidity: jest.fn(),
    };

    mockContextAssemblyService = {
      assemblePlanningContext: jest.fn(),
    };

    mockJsonLogicService = {
      evaluate: jest.fn(),
    };

    mockDataRegistry = {
      getAll: jest.fn(),
      get: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    mockParameterResolutionService = {
      resolve: jest.fn(),
    };

    controller = new GoapController(createValidDependencies());
  });

  describe('Complete cycle: task → refinement → hint → plan advance', () => {
    it('should complete full cycle from goal selection to action hint', async () => {
      const mockActor = { id: 'actor_1' };
      const mockWorld = { state: { hunger: 80 } };

      // Goal selection
      const goal = {
        id: 'goal:reduce_hunger',
        priority: 10,
        relevance: null,
        goalState: { hunger: { '<': 50 } },
      };

      // Planning result
      const task = {
        taskId: 'task:consume_item',
        params: { item: 'item_apple_123' },
      };

      // Refinement result
      const refinementResult = {
        success: true,
        taskId: 'task:consume_item',
        methodId: 'core:consume_item.simple',
        actorId: 'actor_1',
        timestamp: Date.now(),
        stepResults: [{ success: true, data: {}, actionId: 'items:consume_item' }],
      };

      // Method definition
      const method = {
        id: 'core:consume_item.simple',
        taskId: 'task:consume_item',
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'items:consume_item',
            targetBindings: {
              item: 'task.params.item',
            },
          },
        ],
      };

      // Mock setup
      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockContextAssemblyService.assemblePlanningContext.mockReturnValue({});
      mockGoapPlanner.plan.mockReturnValue({ tasks: [task] });
      mockPlanInvalidationDetector.checkPlanValidity.mockReturnValue({
        valid: true,
      });
      mockRefinementEngine.refine.mockResolvedValue(refinementResult);
      mockDataRegistry.get.mockReturnValue(method);
      mockParameterResolutionService.resolve.mockResolvedValue({
        item: 'item_apple_123',
      });

      // Execute
      const result = await controller.decideTurn(mockActor, mockWorld);

      // Verify complete flow
      expect(mockDataRegistry.getAll).toHaveBeenCalledWith('goals');
      expect(mockGoapPlanner.plan).toHaveBeenCalled();
      expect(mockRefinementEngine.refine).toHaveBeenCalledWith(
        'task:consume_item',
        'actor_1',
        { item: 'item_apple_123' }
      );
      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'refinementMethod',
        'core:consume_item.simple'
      );
      expect(mockParameterResolutionService.resolve).toHaveBeenCalled();

      // Verify result
      expect(result).toEqual({
        actionHint: {
          actionId: 'items:consume_item',
          targetBindings: { item: 'item_apple_123' },
        },
      });

      // Verify plan was advanced and cleared (since it's the last task)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Plan completed',
        expect.any(Object)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Plan cleared',
        expect.objectContaining({ reason: 'Goal achieved' })
      );
    });
  });

  describe('Multi-task plan execution across turns', () => {
    it('should execute multiple tasks in sequence across turns', async () => {
      const mockActor = { id: 'actor_1' };
      const mockWorld = { state: { hunger: 80 } };

      const goal = {
        id: 'goal:reduce_hunger',
        priority: 10,
        relevance: null,
      };

      const tasks = [
        { taskId: 'task:find_item', params: { itemType: 'food' } },
        { taskId: 'task:consume_item', params: { item: 'item_apple_123' } },
      ];

      // First turn setup
      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockContextAssemblyService.assemblePlanningContext.mockReturnValue({});
      mockGoapPlanner.plan.mockReturnValue({ tasks });
      mockPlanInvalidationDetector.checkPlanValidity.mockReturnValue({
        valid: true,
      });

      // First task refinement
      mockRefinementEngine.refine.mockResolvedValueOnce({
        success: true,
        methodId: 'core:find_item.search',
        stepResults: [{ success: true }],
      });

      mockDataRegistry.get.mockReturnValueOnce({
        id: 'core:find_item.search',
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'world:search_location',
            targetBindings: {},
          },
        ],
      });

      mockParameterResolutionService.resolve.mockResolvedValueOnce({});

      // Execute first turn
      const result1 = await controller.decideTurn(mockActor, mockWorld);

      expect(result1).toEqual({
        actionHint: {
          actionId: 'world:search_location',
          targetBindings: {},
        },
      });

      // Plan should NOT be cleared (more tasks remain)
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        'Plan cleared',
        expect.any(Object)
      );

      // Second turn - plan should continue
      mockRefinementEngine.refine.mockResolvedValueOnce({
        success: true,
        methodId: 'core:consume_item.simple',
        stepResults: [{ success: true }],
      });

      mockDataRegistry.get.mockReturnValueOnce({
        id: 'core:consume_item.simple',
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'items:consume_item',
            targetBindings: { item: 'task.params.item' },
          },
        ],
      });

      mockParameterResolutionService.resolve.mockResolvedValueOnce({
        item: 'item_apple_123',
      });

      const result2 = await controller.decideTurn(mockActor, mockWorld);

      expect(result2).toEqual({
        actionHint: {
          actionId: 'items:consume_item',
          targetBindings: { item: 'item_apple_123' },
        },
      });

      // Now plan should be cleared (last task completed)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Plan cleared',
        expect.objectContaining({ reason: 'Goal achieved' })
      );
    });
  });

  describe('Replan request handling', () => {
    it('should clear plan and replan when refinement requests replan', async () => {
      const mockActor = { id: 'actor_1' };
      const mockWorld = { state: { hunger: 80 } };

      const goal = {
        id: 'goal:reduce_hunger',
        priority: 10,
        relevance: null,
      };

      const task = {
        taskId: 'task:consume_item',
        params: { item: 'item_apple_123' },
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockContextAssemblyService.assemblePlanningContext.mockReturnValue({});
      mockGoapPlanner.plan.mockReturnValue({ tasks: [task] });
      mockPlanInvalidationDetector.checkPlanValidity.mockReturnValue({
        valid: true,
      });

      // First turn - refinement requests replan
      mockRefinementEngine.refine.mockResolvedValueOnce({
        success: false,
        replan: true,
        error: 'Item no longer available',
        methodId: 'core:consume_item.simple',
      });

      const result1 = await controller.decideTurn(mockActor, mockWorld);

      expect(result1).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Plan cleared',
        expect.objectContaining({ reason: 'Refinement requested replan' })
      );

      // Second turn - should create new plan
      mockGoapPlanner.plan.mockReturnValue({
        tasks: [{ taskId: 'task:find_alternative', params: {} }],
      });

      mockRefinementEngine.refine.mockResolvedValueOnce({
        success: true,
        methodId: 'core:find_alternative.search',
        stepResults: [{ success: true }],
      });

      mockDataRegistry.get.mockReturnValueOnce({
        id: 'core:find_alternative.search',
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'world:search_location',
            targetBindings: {},
          },
        ],
      });

      mockParameterResolutionService.resolve.mockResolvedValueOnce({});

      const result2 = await controller.decideTurn(mockActor, mockWorld);

      expect(result2).toEqual({
        actionHint: {
          actionId: 'world:search_location',
          targetBindings: {},
        },
      });
    });
  });

  describe('Skipped tasks handling', () => {
    it('should advance plan when task is skipped', async () => {
      const mockActor = { id: 'actor_1' };
      const mockWorld = { state: {} };

      const goal = {
        id: 'goal:achieve_objective',
        priority: 10,
        relevance: null,
      };

      const tasks = [
        { taskId: 'task:optional_prep', params: {} },
        { taskId: 'task:main_action', params: {} },
      ];

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockContextAssemblyService.assemblePlanningContext.mockReturnValue({});
      mockGoapPlanner.plan.mockReturnValue({ tasks });
      mockPlanInvalidationDetector.checkPlanValidity.mockReturnValue({
        valid: true,
      });

      // First task is skipped
      mockRefinementEngine.refine.mockResolvedValueOnce({
        success: true,
        skipped: true,
        methodId: 'core:optional_prep.conditional',
      });

      const result1 = await controller.decideTurn(mockActor, mockWorld);

      expect(result1).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Task skipped, advancing to next task',
        expect.any(Object)
      );

      // Plan should advance to second task
      mockRefinementEngine.refine.mockResolvedValueOnce({
        success: true,
        methodId: 'core:main_action.execute',
        stepResults: [{ success: true }],
      });

      mockDataRegistry.get.mockReturnValueOnce({
        id: 'core:main_action.execute',
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'items:use_item',
            targetBindings: {},
          },
        ],
      });

      mockParameterResolutionService.resolve.mockResolvedValueOnce({});

      const result2 = await controller.decideTurn(mockActor, mockWorld);

      expect(result2).toEqual({
        actionHint: {
          actionId: 'items:use_item',
          targetBindings: {},
        },
      });
    });

    it('should handle multiple skipped tasks in sequence', async () => {
      const mockActor = { id: 'actor_1' };
      const mockWorld = { state: {} };

      const goal = {
        id: 'goal:achieve_objective',
        priority: 10,
        relevance: null,
      };

      const tasks = [
        { taskId: 'task:optional_1', params: {} },
        { taskId: 'task:optional_2', params: {} },
        { taskId: 'task:required', params: {} },
      ];

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockContextAssemblyService.assemblePlanningContext.mockReturnValue({});
      mockGoapPlanner.plan.mockReturnValue({ tasks });
      mockPlanInvalidationDetector.checkPlanValidity.mockReturnValue({
        valid: true,
      });

      // First two tasks are skipped
      mockRefinementEngine.refine
        .mockResolvedValueOnce({
          success: true,
          skipped: true,
          methodId: 'core:optional_1.conditional',
        })
        .mockResolvedValueOnce({
          success: true,
          skipped: true,
          methodId: 'core:optional_2.conditional',
        })
        .mockResolvedValueOnce({
          success: true,
          methodId: 'core:required.execute',
          stepResults: [{ success: true }],
        });

      mockDataRegistry.get.mockReturnValue({
        id: 'core:required.execute',
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'items:use_item',
            targetBindings: {},
          },
        ],
      });

      mockParameterResolutionService.resolve.mockResolvedValue({});

      // Execute turns
      const result1 = await controller.decideTurn(mockActor, mockWorld);
      expect(result1).toBeNull();

      const result2 = await controller.decideTurn(mockActor, mockWorld);
      expect(result2).toBeNull();

      const result3 = await controller.decideTurn(mockActor, mockWorld);
      expect(result3).toEqual({
        actionHint: {
          actionId: 'items:use_item',
          targetBindings: {},
        },
      });
    });

    it('should clear plan when last task is skipped', async () => {
      const mockActor = { id: 'actor_1' };
      const mockWorld = { state: {} };

      const goal = {
        id: 'goal:achieve_objective',
        priority: 10,
        relevance: null,
      };

      const tasks = [{ taskId: 'task:optional', params: {} }];

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockContextAssemblyService.assemblePlanningContext.mockReturnValue({});
      mockGoapPlanner.plan.mockReturnValue({ tasks });
      mockPlanInvalidationDetector.checkPlanValidity.mockReturnValue({
        valid: true,
      });

      mockRefinementEngine.refine.mockResolvedValueOnce({
        success: true,
        skipped: true,
        methodId: 'core:optional.conditional',
      });

      const result = await controller.decideTurn(mockActor, mockWorld);

      expect(result).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Plan cleared',
        expect.objectContaining({ reason: 'Goal achieved (last task skipped)' })
      );
    });
  });
});
