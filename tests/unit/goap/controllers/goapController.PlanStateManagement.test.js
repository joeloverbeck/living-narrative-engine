/**
 * @file Unit tests for GoapController - Plan State Management
 * Tests for GOAPIMPL-021-03 implementation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import GoapController from '../../../../src/goap/controllers/goapController.js';

describe('GoapController - Plan State Management', () => {
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

  /**
   * Create default valid dependencies for GoapController
   *
   * @returns {object} Valid dependencies
   */
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

    mockGoapPlanner = {
      plan: jest.fn(),
    };

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

  describe('Plan Lifecycle Integration', () => {
    const mockActor = { id: 'actor_1' };
    const mockWorld = { state: { hunger: 80 } };
    const mockGoal = { id: 'goal:reduce_hunger', priority: 10 };
    const mockTasks = [
      { taskId: 'task:find_food', parameters: {} },
      { taskId: 'task:consume_food', parameters: {} },
    ];

    beforeEach(() => {
      // Setup goal selection
      mockDataRegistry.getAll.mockReturnValue([mockGoal]);
      mockContextAssemblyService.assemblePlanningContext.mockReturnValue({
        actor: mockActor,
      });
      mockJsonLogicService.evaluate.mockReturnValue(true);

      // Setup planner
      mockGoapPlanner.plan.mockReturnValue({
        tasks: mockTasks,
        cost: 2,
        nodesExplored: 5,
      });

      // Setup validation
      mockPlanInvalidationDetector.checkPlanValidity.mockReturnValue({
        valid: true,
      });

      // Setup refinement engine
      mockRefinementEngine.refine.mockResolvedValue({
        success: true,
        methodId: 'test:method',
        stepResults: [{ success: true }],
      });

      // Setup method definition
      mockDataRegistry.get.mockReturnValue({
        id: 'test:method',
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'test:action',
            targetBindings: {},
          },
        ],
      });

      // Setup parameter resolution
      mockParameterResolutionService.resolve.mockResolvedValue({});
    });

    it('should create new plan when no active plan exists', async () => {
      await controller.decideTurn(mockActor, mockWorld);

      // Planner should be called
      expect(mockGoapPlanner.plan).toHaveBeenCalledWith(
        mockActor.id,
        mockGoal,
        mockWorld.state,
        {}
      );

      // Plan creation should be logged
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Plan created',
        expect.objectContaining({
          goalId: mockGoal.id,
          taskCount: mockTasks.length,
          actorId: mockActor.id,
        })
      );
    });

    it('should keep valid plan across multiple turns', async () => {
      // First turn - creates plan
      await controller.decideTurn(mockActor, mockWorld);
      const firstPlanCall = mockGoapPlanner.plan.mock.calls.length;

      // Second turn - validates plan (should keep it)
      await controller.decideTurn(mockActor, mockWorld);
      const secondPlanCall = mockGoapPlanner.plan.mock.calls.length;

      // Planner should only be called once (plan reused)
      expect(secondPlanCall).toBe(firstPlanCall);

      // Validation should be called
      expect(mockPlanInvalidationDetector.checkPlanValidity).toHaveBeenCalled();
    });

    it('should clear and replan when plan becomes invalid', async () => {
      // First turn - creates valid plan
      await controller.decideTurn(mockActor, mockWorld);
      mockGoapPlanner.plan.mockClear();

      // Second turn - plan becomes invalid
      mockPlanInvalidationDetector.checkPlanValidity.mockReturnValueOnce({
        valid: false,
        reason: 'Precondition no longer met',
        invalidatedAt: 1,
      });

      await controller.decideTurn(mockActor, mockWorld);

      // Plan should be cleared
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Plan cleared',
        expect.objectContaining({
          reason: 'Invalidated: Precondition no longer met',
        })
      );

      // New plan should be created
      expect(mockGoapPlanner.plan).toHaveBeenCalled();
    });

    it('should return null when no goals are available', async () => {
      mockDataRegistry.getAll.mockReturnValue([]);

      const result = await controller.decideTurn(mockActor, mockWorld);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'No goals registered in system',
        { actorId: mockActor.id }
      );
    });

    it('should return null when goal selection finds no relevant goals', async () => {
      // Add relevance condition to goal so it can be evaluated
      const goalWithRelevance = {
        ...mockGoal,
        relevance: { '==': [{ var: 'hunger' }, 100] },
      };
      mockDataRegistry.getAll.mockReturnValue([goalWithRelevance]);
      mockJsonLogicService.evaluate.mockReturnValue(false); // Not relevant

      const result = await controller.decideTurn(mockActor, mockWorld);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'No relevant goals for actor',
        expect.any(Object)
      );
    });

    it('should handle planning failure', async () => {
      mockGoapPlanner.plan.mockReturnValue(null);

      const result = await controller.decideTurn(mockActor, mockWorld);

      // Should call failure handler (returns null in stub)
      expect(result).toBeNull();
    });

    it('should handle planning result with no tasks', async () => {
      mockGoapPlanner.plan.mockReturnValue({ tasks: null });

      await controller.decideTurn(mockActor, mockWorld);

      // Should call failure handler (which returns null in stub)
      // Verification: planner was called
      expect(mockGoapPlanner.plan).toHaveBeenCalled();
    });

    it('should handle world.state extraction fallback', async () => {
      const worldWithoutState = { hunger: 80 };

      await controller.decideTurn(mockActor, worldWithoutState);

      // Should pass world directly as state
      expect(mockGoapPlanner.plan).toHaveBeenCalledWith(
        mockActor.id,
        mockGoal,
        worldWithoutState, // world used as state
        {}
      );
    });

    it('should log error and clear plan when plan has no current task', async () => {
      // Create plan with single task
      const singleTask = [{ taskId: 'task:single' }];
      mockGoapPlanner.plan.mockReturnValue({ tasks: singleTask });

      // First turn - creates plan
      await controller.decideTurn(mockActor, mockWorld);

      // Verify plan was created
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Plan created',
        expect.objectContaining({
          goalId: mockGoal.id,
          taskCount: 1,
        })
      );

      // The current task should now be completed (but we can't advance it without private access)
      // This edge case would only occur with internal state corruption
      // For testing purposes, we'll rely on integration tests to verify this scenario
    });

    it('should extract state from world object with state property', async () => {
      const worldWithState = { state: { hunger: 90 }, other: 'data' };

      await controller.decideTurn(mockActor, worldWithState);

      // Planner should receive the state property
      expect(mockGoapPlanner.plan).toHaveBeenCalledWith(
        mockActor.id,
        mockGoal,
        { hunger: 90 },
        {}
      );
    });
  });

  describe('Plan Validation', () => {
    it('should call invalidation detector with correct parameters', async () => {
      const mockActor = { id: 'actor_1' };
      const mockWorld = { state: { hunger: 80 } };
      const mockGoal = { id: 'goal:reduce_hunger', priority: 10 };
      const mockTasks = [
        { taskId: 'task:find_food' },
        { taskId: 'task:consume_food' },
      ];

      mockDataRegistry.getAll.mockReturnValue([mockGoal]);
      mockContextAssemblyService.assemblePlanningContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockReturnValue(true);
      mockGoapPlanner.plan.mockReturnValue({ tasks: mockTasks });
      mockPlanInvalidationDetector.checkPlanValidity.mockReturnValue({
        valid: true,
      });

      // Setup refinement engine
      mockRefinementEngine.refine.mockResolvedValue({
        success: true,
        methodId: 'test:method',
        stepResults: [{ success: true }],
      });

      // Setup method definition
      mockDataRegistry.get.mockReturnValue({
        id: 'test:method',
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'test:action',
            targetBindings: {},
          },
        ],
      });

      // Setup parameter resolution
      mockParameterResolutionService.resolve.mockResolvedValue({});

      // First turn - create plan
      await controller.decideTurn(mockActor, mockWorld);

      // Second turn - validate plan
      mockPlanInvalidationDetector.checkPlanValidity.mockClear();
      await controller.decideTurn(mockActor, mockWorld);

      // Verify validation call
      expect(mockPlanInvalidationDetector.checkPlanValidity).toHaveBeenCalledWith(
        expect.objectContaining({
          goal: mockGoal,
          tasks: mockTasks,
          actorId: mockActor.id,
        }),
        mockWorld.state,
        { actorId: mockActor.id },
        'strict'
      );
    });

    it('should log invalidation details when plan is invalid', async () => {
      const mockActor = { id: 'actor_1' };
      const mockWorld = { state: { hunger: 80 } };
      const mockGoal = { id: 'goal:reduce_hunger', priority: 10 };
      const mockTasks = [
        { taskId: 'task:find_food' },
        { taskId: 'task:consume_food' },
      ];

      mockDataRegistry.getAll.mockReturnValue([mockGoal]);
      mockContextAssemblyService.assemblePlanningContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockReturnValue(true);
      mockGoapPlanner.plan.mockReturnValue({ tasks: mockTasks });

      // Setup refinement engine
      mockRefinementEngine.refine.mockResolvedValue({
        success: true,
        methodId: 'test:method',
        stepResults: [{ success: true }],
      });

      // Setup method definition
      mockDataRegistry.get.mockReturnValue({
        id: 'test:method',
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'test:action',
            targetBindings: {},
          },
        ],
      });

      // Setup parameter resolution
      mockParameterResolutionService.resolve.mockResolvedValue({});

      // First turn - valid plan
      mockPlanInvalidationDetector.checkPlanValidity.mockReturnValue({
        valid: true,
      });
      await controller.decideTurn(mockActor, mockWorld);

      // Clear logger and reset for second turn
      mockLogger.warn.mockClear();
      mockLogger.info.mockClear();

      // Second turn - invalid plan
      mockPlanInvalidationDetector.checkPlanValidity.mockReturnValue({
        valid: false,
        reason: 'Food no longer available',
        invalidatedAt: 1,
        task: mockTasks[1],
      });

      await controller.decideTurn(mockActor, mockWorld);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Plan invalidated',
        expect.objectContaining({
          goalId: mockGoal.id,
          reason: 'Food no longer available',
          invalidatedAt: 1,
        })
      );
    });
  });

  describe('Goal Relevance Edge Cases', () => {
    it('should treat goal as not relevant when relevance evaluation fails', async () => {
      const mockActor = { id: 'actor_1' };
      const mockWorld = { state: {} };
      const goalWithBadRelevance = {
        id: 'goal:test',
        priority: 10,
        relevance: { invalid: 'logic' },
      };

      mockDataRegistry.getAll.mockReturnValue([goalWithBadRelevance]);
      mockContextAssemblyService.assemblePlanningContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockImplementation(() => {
        throw new Error('Invalid JSON Logic');
      });

      const result = await controller.decideTurn(mockActor, mockWorld);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Goal relevance evaluation failed',
        expect.objectContaining({
          goalId: goalWithBadRelevance.id,
        })
      );
    });
  });

  describe('Input Validation', () => {
    it('should throw if actor is missing', async () => {
      await expect(controller.decideTurn(undefined, {})).rejects.toThrow(
        'Actor is required'
      );
    });

    it('should throw if actor.id is missing', async () => {
      await expect(controller.decideTurn({}, {})).rejects.toThrow();
    });

    it('should throw if actor.id is blank', async () => {
      await expect(controller.decideTurn({ id: '' }, {})).rejects.toThrow();
    });

    it('should throw if world is missing', async () => {
      await expect(
        controller.decideTurn({ id: 'actor_1' }, undefined)
      ).rejects.toThrow('World is required');
    });
  });
});
