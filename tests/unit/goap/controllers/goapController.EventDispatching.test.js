/**
 * @file Unit tests for GoapController event dispatching (GOAPIMPL-021-08)
 * Tests event dispatching mechanism for GOAP lifecycle events.
 *
 * NOTE: Full event coverage requires integration tests with real planner/refinement states.
 * This file verifies the event dispatching mechanism works correctly for basic happy path events.
 * Other events (REPLANNING_STARTED, PLAN_INVALIDATED, TASK_REFINED, REFINEMENT_FAILED, etc.)
 * are covered by existing integration tests in goapController.FailureHandling.test.js
 * and goapController.actionHintExtraction.test.js.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GoapController from '../../../../src/goap/controllers/goapController.js';
import { GOAP_EVENTS } from '../../../../src/goap/events/goapEvents.js';
import { createGoapPlannerMock } from '../../../common/mocks/createGoapPlannerMock.js';
import { expectGoapPlannerMock } from '../../../common/mocks/expectGoapPlannerMock.js';

describe('GoapController - Event Dispatching (GOAPIMPL-021-08)', () => {
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
      checkPlanValidity: jest.fn().mockReturnValue({ valid: true }),
    };

    mockContextAssemblyService = {
      assemblePlanningContext: jest.fn().mockReturnValue({}),
    };

    mockJsonLogicService = {
      evaluate: jest.fn().mockReturnValue(true),
    };

    mockDataRegistry = {
      getAll: jest.fn().mockReturnValue([]),
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

  describe('Basic Event Dispatching Mechanism', () => {
    it('should dispatch goap:goal_selected when goal is selected', async () => {
      // Arrange
      const actor = { id: 'actor_1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test_goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue({
        tasks: [{ taskId: 'task_1', params: {} }],
      });
      mockRefinementEngine.refine.mockResolvedValue({
        success: true,
        methodId: 'method_1',
        stepResults: [{ actionId: 'action_1' }],
      });
      mockDataRegistry.get.mockReturnValue({
        id: 'method_1',
        steps: [{ stepType: 'primitive_action', actionId: 'action_1', targetBindings: {} }],
      });
      mockParameterResolutionService.resolve.mockResolvedValue({});

      // Act
      await controller.decideTurn(actor, world);

      // Assert
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        GOAP_EVENTS.GOAL_SELECTED,
        expect.objectContaining({
          actorId: 'actor_1',
          goalId: 'goal:test_goal',
          priority: 10,
        })
      );
    });

    it('should dispatch goap:planning_started when planning begins', async () => {
      // Arrange
      const actor = { id: 'actor_1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test_goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue({
        tasks: [{ taskId: 'task_1' }],
      });
      mockRefinementEngine.refine.mockResolvedValue({
        success: true,
        methodId: 'method_1',
        stepResults: [{ actionId: 'action_1' }],
      });
      mockDataRegistry.get.mockReturnValue({
        id: 'method_1',
        steps: [{ stepType: 'primitive_action', actionId: 'action_1', targetBindings: {} }],
      });
      mockParameterResolutionService.resolve.mockResolvedValue({});

      // Act
      await controller.decideTurn(actor, world);

      // Assert
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        GOAP_EVENTS.PLANNING_STARTED,
        expect.objectContaining({
          actorId: 'actor_1',
          goalId: 'goal:test_goal',
        })
      );
    });

    it('should dispatch goap:planning_completed when planning succeeds', async () => {
      // Arrange
      const actor = { id: 'actor_1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test_goal',
        priority: 10,
        relevance: null,
      };

      const tasks = [
        { taskId: 'task_1', params: {} },
        { taskId: 'task_2', params: {} },
      ];

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue({ tasks });
      mockRefinementEngine.refine.mockResolvedValue({
        success: true,
        methodId: 'method_1',
        stepResults: [{ actionId: 'action_1' }],
      });
      mockDataRegistry.get.mockReturnValue({
        id: 'method_1',
        steps: [{ stepType: 'primitive_action', actionId: 'action_1', targetBindings: {} }],
      });
      mockParameterResolutionService.resolve.mockResolvedValue({});

      // Act
      await controller.decideTurn(actor, world);

      // Assert
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        GOAP_EVENTS.PLANNING_COMPLETED,
        expect.objectContaining({
          actorId: 'actor_1',
          goalId: 'goal:test_goal',
          planLength: 2,
          tasks: ['task_1', 'task_2'], // Array of taskId strings
        })
      );
    });

    it('should treat zero-length plans as already satisfied goals', async () => {
      // Arrange
      const actor = { id: 'actor_1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test_goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue({ tasks: [] });

      // Act
      const result = await controller.decideTurn(actor, world);

      // Assert
      expect(result).toBeNull();
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        GOAP_EVENTS.PLANNING_COMPLETED,
        expect.objectContaining({
          actorId: 'actor_1',
          goalId: 'goal:test_goal',
          planLength: 0,
          tasks: [],
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Planner returned empty plan (goal already satisfied)',
        expect.objectContaining({
          actorId: 'actor_1',
          goalId: 'goal:test_goal',
        })
      );
      expect(mockRefinementEngine.refine).not.toHaveBeenCalled();
    });

    it('should dispatch goap:planning_failed when planner returns null', async () => {
      // Arrange
      const actor = { id: 'actor_1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test_goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue(null); // Planning fails

      // Act
      await controller.decideTurn(actor, world);

      // Assert
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        GOAP_EVENTS.PLANNING_FAILED,
        expect.objectContaining({
          actorId: 'actor_1',
          goalId: 'goal:test_goal',
          reason: 'Planner returned no tasks',
          code: 'UNKNOWN_PLANNER_FAILURE',
        })
      );
    });

    it('should dispatch goap:goal_achieved when last task completes', async () => {
      // Arrange
      const actor = { id: 'actor_1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test_goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue({
        tasks: [{ taskId: 'task_1' }], // Single task
      });
      mockRefinementEngine.refine.mockResolvedValue({
        success: true,
        methodId: 'method_1',
        stepResults: [{ actionId: 'action_1' }],
      });
      mockDataRegistry.get.mockReturnValue({
        id: 'method_1',
        steps: [{ stepType: 'primitive_action', actionId: 'action_1', targetBindings: {} }],
      });
      mockParameterResolutionService.resolve.mockResolvedValue({});

      // Act
      await controller.decideTurn(actor, world);

      // Assert
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        GOAP_EVENTS.GOAL_ACHIEVED,
        expect.objectContaining({
          goalId: 'goal:test_goal',
        })
      );
    });

    it('should log event dispatch via debug logger', async () => {
      // Arrange
      const actor = { id: 'actor_1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test_goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue({
        tasks: [{ taskId: 'task_1' }],
      });
      mockRefinementEngine.refine.mockResolvedValue({
        success: true,
        methodId: 'method_1',
        stepResults: [{ actionId: 'action_1' }],
      });
      mockDataRegistry.get.mockReturnValue({
        id: 'method_1',
        steps: [{ stepType: 'primitive_action', actionId: 'action_1', targetBindings: {} }],
      });
      mockParameterResolutionService.resolve.mockResolvedValue({});

      // Act
      await controller.decideTurn(actor, world);

      // Assert - debug logging should occur for dispatched events
      const debugCalls = mockLogger.debug.mock.calls.filter(
        (call) => call[0] === 'GOAP event dispatched'
      );
      expect(debugCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Event Payload Validation', () => {
    it('should include expected payload fields in goal selected event', async () => {
      // Arrange
      const actor = { id: 'actor_1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test_goal',
        priority: 5,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue({ tasks: [{ taskId: 'task_1' }] });
      mockRefinementEngine.refine.mockResolvedValue({
        success: true,
        methodId: 'method_1',
        stepResults: [{ actionId: 'action_1' }],
      });
      mockDataRegistry.get.mockReturnValue({
        id: 'method_1',
        steps: [{ stepType: 'primitive_action', actionId: 'action_1', targetBindings: {} }],
      });
      mockParameterResolutionService.resolve.mockResolvedValue({});

      // Act
      await controller.decideTurn(actor, world);

      // Assert
      const goalSelectedCall = mockEventBus.dispatch.mock.calls.find(
        (call) => call[0] === GOAP_EVENTS.GOAL_SELECTED
      );
      expect(goalSelectedCall).toBeDefined();
      expect(goalSelectedCall[1]).toHaveProperty('actorId', 'actor_1');
      expect(goalSelectedCall[1]).toHaveProperty('goalId', 'goal:test_goal');
      expect(goalSelectedCall[1]).toHaveProperty('priority', 5);
    });
  });
});
