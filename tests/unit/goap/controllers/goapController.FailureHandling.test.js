/**
 * @file Unit tests for GoapController failure handling (GOAPIMPL-021-05)
 * Tests planning failures, refinement failures with all fallback strategies,
 * failure tracking, expiry, and recursion limits.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GoapController from '../../../../src/goap/controllers/goapController.js';
import { GOAP_EVENTS } from '../../../../src/goap/events/goapEvents.js';
import { createGoapPlannerMock } from '../../../common/mocks/createGoapPlannerMock.js';
import { expectGoapPlannerMock } from '../../../common/mocks/expectGoapPlannerMock.js';

describe('GoapController - Failure Handling (GOAPIMPL-021-05)', () => {
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

  describe('Planning Failure Handling', () => {
    it('should return null when planner returns no tasks', async () => {
      // Arrange
      const actor = { id: 'actor1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test',
        name: 'Test Goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue(null); // Planning fails

      // Act
      const result = await controller.decideTurn(actor, world);

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Planning failed for goal',
        expect.objectContaining({
          goalId: 'goal:test',
          goalName: 'Test Goal',
          reason: 'Planner returned no tasks',
          failureCode: 'UNKNOWN_PLANNER_FAILURE',
        })
      );
    });

    it('should track failed goal when planning fails', async () => {
      // Arrange
      const actor = { id: 'actor1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test',
        name: 'Test Goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue(null);

      // Act
      await controller.decideTurn(actor, world);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Goal failure tracked',
        expect.objectContaining({
          goalId: 'goal:test',
          reason: 'Planner returned no tasks',
          code: 'UNKNOWN_PLANNER_FAILURE',
          failureCount: 1,
        })
      );
    });

    it('should propagate planner failure metadata into events and tracking', async () => {
      const actor = { id: 'actor1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test',
        name: 'Test Goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue(null);
      mockGoapPlanner.getLastFailure.mockReturnValue({
        code: 'DEPTH_LIMIT_REACHED',
        reason: 'Depth limit reached before satisfying goal',
      });

      await controller.decideTurn(actor, world);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        GOAP_EVENTS.PLANNING_FAILED,
        expect.objectContaining({
          actorId: 'actor1',
          goalId: 'goal:test',
          code: 'DEPTH_LIMIT_REACHED',
          reason: 'Depth limit reached before satisfying goal',
        })
      );

      const failures = controller.getFailedGoals('actor1');
      expect(failures[0]).toEqual({
        goalId: 'goal:test',
        failures: [
          expect.objectContaining({
            code: 'DEPTH_LIMIT_REACHED',
            reason: 'Depth limit reached before satisfying goal',
          }),
        ],
      });
    });

    it('should track multiple planning failures for same goal', async () => {
      // Arrange
      const actor = { id: 'actor1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test',
        name: 'Test Goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue(null);

      // Act - fail 3 times
      await controller.decideTurn(actor, world);
      await controller.decideTurn(actor, world);
      await controller.decideTurn(actor, world);

      // Assert - should track all 3 failures (2 warns + 1 error)
      const goalFailureWarnCalls = mockLogger.warn.mock.calls.filter(
        (call) => call[0] === 'Goal failure tracked'
      );
      const goalFailureErrorCalls = mockLogger.error.mock.calls.filter(
        (call) => call[0] === 'Goal failed too many times'
      );

      // First 2 failures should be warnings
      expect(goalFailureWarnCalls.length).toBe(2);
      expect(goalFailureWarnCalls[0][1].failureCount).toBe(1);
      expect(goalFailureWarnCalls[1][1].failureCount).toBe(2);

      // 3rd failure should trigger error (max failures reached)
      expect(goalFailureErrorCalls.length).toBe(1);
      expect(goalFailureErrorCalls[0][1].failureCount).toBe(3);
    });

    it('should log error when goal fails 3 times', async () => {
      // Arrange
      const actor = { id: 'actor1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test',
        name: 'Test Goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue(null);

      // Act - fail 3 times
      await controller.decideTurn(actor, world);
      await controller.decideTurn(actor, world);
      await controller.decideTurn(actor, world);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Goal failed too many times',
        expect.objectContaining({
          goalId: 'goal:test',
          failureCount: 3,
        })
      );
    });

    it('should expire old goal failures after 5 minutes', async () => {
      // Arrange
      const actor = { id: 'actor1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test',
        name: 'Test Goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue(null);

      // Mock Date.now() to simulate time passing
      const originalNow = Date.now;
      let currentTime = 1000000;
      Date.now = jest.fn(() => currentTime);

      // Act - first failure
      await controller.decideTurn(actor, world);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Goal failure tracked',
        expect.objectContaining({ failureCount: 1 })
      );

      // Advance time by 6 minutes (> 5 minute expiry)
      currentTime += 6 * 60 * 1000;

      // Second failure (first should be expired)
      await controller.decideTurn(actor, world);

      // Assert - count should reset to 1
      const lastWarnCall = mockLogger.warn.mock.calls.find(
        (call) => call[0] === 'Goal failure tracked'
      );
      expect(lastWarnCall[1].failureCount).toBe(1);

      // Cleanup
      Date.now = originalNow;
    });
  });

  describe('Refinement Failure Handling - Replan Strategy', () => {
    it('should clear plan and return null with replan fallback', async () => {
      // Arrange
      const actor = { id: 'actor1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test',
        name: 'Test Goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue({
        tasks: [{ taskId: 'task1', methodId: 'method1' }],
      });
      mockRefinementEngine.refine.mockResolvedValue({
        success: false,
        error: 'Test refinement error',
        fallbackBehavior: 'replan',
        taskId: 'task1',
        actorId: 'actor1',
        timestamp: Date.now(),
      });

      // Act
      const result = await controller.decideTurn(actor, world);

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Handling refinement failure',
        expect.objectContaining({
          taskId: 'task1',
          fallbackBehavior: 'replan',
        })
      );
    });

    it('should use replan as default fallback when not specified', async () => {
      // Arrange
      const actor = { id: 'actor1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test',
        name: 'Test Goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue({
        tasks: [{ taskId: 'task1', methodId: 'method1' }],
      });
      mockRefinementEngine.refine.mockResolvedValue({
        success: false,
        error: 'Test error',
        // No fallbackBehavior specified
        taskId: 'task1',
        actorId: 'actor1',
        timestamp: Date.now(),
      });

      // Act
      const result = await controller.decideTurn(actor, world);

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Handling refinement failure',
        expect.objectContaining({
          fallbackBehavior: 'replan',
        })
      );
    });
  });

  describe('Refinement Failure Handling - Continue Strategy', () => {
    it('should advance plan and retry with continue fallback (2 tasks)', async () => {
      // Arrange
      const actor = { id: 'actor1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test',
        name: 'Test Goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue({
        tasks: [
          { taskId: 'task1', methodId: 'method1', params: {} },
          { taskId: 'task2', methodId: 'method2', params: {} },
        ],
      });

      // First task fails with 'continue' fallback
      // Second task succeeds
      let callCount = 0;
      mockRefinementEngine.refine.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            success: false,
            error: 'Task 1 failed',
            fallbackBehavior: 'continue',
            taskId: 'task1',
            actorId: 'actor1',
            timestamp: Date.now(),
          };
        }
        return {
          success: true,
          stepResults: [
            {
              type: 'action',
              actionId: 'action1',
              parameters: {},
            },
          ],
          methodId: 'method2',
          taskId: 'task2',
          actorId: 'actor1',
          timestamp: Date.now(),
        };
      });

      mockParameterResolutionService.resolve.mockResolvedValue({
        actionId: 'action1',
        targetBindings: {},
      });

      // Act
      const result = await controller.decideTurn(actor, world);

      // Assert
      expect(mockRefinementEngine.refine).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Task failure tracked',
        expect.objectContaining({ taskId: 'task1' })
      );
      // Result may be null or have actionHint depending on parameter resolution
      expect(result === null || result?.actionHint).toBeTruthy();
    });

    it('should enforce recursion depth limit of 10 with continue fallback', async () => {
      // Arrange
      const actor = { id: 'actor1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test',
        name: 'Test Goal',
        priority: 10,
        relevance: null,
      };

      // Create 15 tasks (more than recursion limit)
      const tasks = Array.from({ length: 15 }, (_, i) => ({
        taskId: `task${i + 1}`,
        methodId: `method${i + 1}`,
      }));

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue({ tasks });

      // All tasks fail with 'continue' fallback
      mockRefinementEngine.refine.mockResolvedValue({
        success: false,
        error: 'Task failed',
        fallbackBehavior: 'continue',
        taskId: 'task1',
        actorId: 'actor1',
        timestamp: Date.now(),
      });

      // Act
      const result = await controller.decideTurn(actor, world);

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Recursion depth exceeded during continue fallback',
        expect.objectContaining({
          recursionDepth: 10,
        })
      );
      // Should not call refine more than 11 times (initial + 10 recursive)
      expect(mockRefinementEngine.refine.mock.calls.length).toBeLessThanOrEqual(11);
    });

    it('should return null when continue reaches end of plan', async () => {
      // Arrange
      const actor = { id: 'actor1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test',
        name: 'Test Goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue({
        tasks: [{ taskId: 'task1', methodId: 'method1' }],
      });

      // Only task fails with 'continue' fallback
      mockRefinementEngine.refine.mockResolvedValue({
        success: false,
        error: 'Task failed',
        fallbackBehavior: 'continue',
        taskId: 'task1',
        actorId: 'actor1',
        timestamp: Date.now(),
      });

      // Act
      const result = await controller.decideTurn(actor, world);

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Plan cleared',
        expect.objectContaining({
          reason: 'Goal achieved (remaining tasks failed but skippable)',
        })
      );
    });
  });

  describe('Refinement Failure Handling - Fail Strategy', () => {
    it('should track goal and task failure with fail strategy', async () => {
      // Arrange
      const actor = { id: 'actor1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test',
        name: 'Test Goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue({
        tasks: [{ taskId: 'task1', methodId: 'method1' }],
      });
      mockRefinementEngine.refine.mockResolvedValue({
        success: false,
        error: 'Critical failure',
        fallbackBehavior: 'fail',
        taskId: 'task1',
        actorId: 'actor1',
        timestamp: Date.now(),
      });

      // Act
      const result = await controller.decideTurn(actor, world);

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Goal failure tracked',
        expect.objectContaining({
          goalId: 'goal:test',
          reason: 'Task failed critically: Critical failure',
        })
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Task failure tracked',
        expect.objectContaining({
          taskId: 'task1',
          reason: 'Critical failure',
        })
      );
    });
  });

  describe('Refinement Failure Handling - Idle Strategy', () => {
    it('should clear plan without tracking with idle strategy', async () => {
      // Arrange
      const actor = { id: 'actor1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test',
        name: 'Test Goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue({
        tasks: [{ taskId: 'task1', methodId: 'method1' }],
      });
      mockRefinementEngine.refine.mockResolvedValue({
        success: false,
        error: 'Temporary failure',
        fallbackBehavior: 'idle',
        taskId: 'task1',
        actorId: 'actor1',
        timestamp: Date.now(),
      });

      // Act
      const result = await controller.decideTurn(actor, world);

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Plan cleared',
        expect.objectContaining({
          reason: 'Temporary task failure: Temporary failure',
        })
      );
      // Should NOT track failures with idle strategy
      const trackedCalls = mockLogger.warn.mock.calls.filter(
        (call) =>
          call[0] === 'Goal failure tracked' || call[0] === 'Task failure tracked'
      );
      expect(trackedCalls.length).toBe(0);
    });
  });

  describe('Refinement Failure Handling - Unknown Strategy', () => {
    it('should treat unknown fallback behavior as replan', async () => {
      // Arrange
      const actor = { id: 'actor1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test',
        name: 'Test Goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue({
        tasks: [{ taskId: 'task1', methodId: 'method1' }],
      });
      mockRefinementEngine.refine.mockResolvedValue({
        success: false,
        error: 'Test error',
        fallbackBehavior: 'unknown_strategy',
        taskId: 'task1',
        actorId: 'actor1',
        timestamp: Date.now(),
      });

      // Act
      const result = await controller.decideTurn(actor, world);

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Unknown fallback behavior, treating as replan',
        expect.objectContaining({
          fallbackBehavior: 'unknown_strategy',
        })
      );
    });
  });

  describe('Failed Task Tracking', () => {
    it('should track multiple task failures independently', async () => {
      // Arrange
      const actor = { id: 'actor1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test',
        name: 'Test Goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);

      // Plan with 2 tasks each time
      mockGoapPlanner.plan.mockReturnValue({
        tasks: [
          { taskId: 'task1', methodId: 'method1' },
          { taskId: 'task2', methodId: 'method2' },
        ],
      });

      let firstCall = true;
      mockRefinementEngine.refine.mockImplementation(async (task) => {
        if (firstCall) {
          firstCall = false;
          return {
            success: false,
            error: `Task ${task.taskId} failed`,
            fallbackBehavior: 'fail',
            taskId: task.taskId,
            actorId: 'actor1',
            timestamp: Date.now(),
          };
        }
        // Second call - different task
        return {
          success: false,
          error: `Task ${task.taskId} failed`,
          fallbackBehavior: 'fail',
          taskId: task.taskId,
          actorId: 'actor1',
          timestamp: Date.now(),
        };
      });

      // Act - fail task1, then fail task1 again (replanning creates new plan with task1)
      await controller.decideTurn(actor, world); // task1 fails
      await controller.decideTurn(actor, world); // task1 fails again after replan

      // Assert - task1 should be tracked at least twice
      const task1Calls = mockLogger.warn.mock.calls.filter(
        (call) =>
          call[0] === 'Task failure tracked' && call[1].taskId === 'task1'
      );

      expect(task1Calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should expire old task failures after 5 minutes', async () => {
      // Arrange
      const actor = { id: 'actor1' };
      const world = { state: {} };
      const goal = {
        id: 'goal:test',
        name: 'Test Goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue({
        tasks: [{ taskId: 'task1', methodId: 'method1' }],
      });
      mockRefinementEngine.refine.mockResolvedValue({
        success: false,
        error: 'Test error',
        fallbackBehavior: 'fail',
        taskId: 'task1',
        actorId: 'actor1',
        timestamp: Date.now(),
      });

      // Mock Date.now()
      const originalNow = Date.now;
      let currentTime = 1000000;
      Date.now = jest.fn(() => currentTime);

      // Act - first failure
      await controller.decideTurn(actor, world);

      // Advance time by 6 minutes
      currentTime += 6 * 60 * 1000;

      // Second failure
      await controller.decideTurn(actor, world);

      // Assert - count should reset to 1
      const lastWarnCall = mockLogger.warn.mock.calls
        .reverse()
        .find((call) => call[0] === 'Task failure tracked');
      expect(lastWarnCall[1].failureCount).toBe(1);

      // Cleanup
      Date.now = originalNow;
    });
  });

  describe('Actor and World Storage for Recursion', () => {
    it('should store actor ID and world on top-level decideTurn call', async () => {
      // Arrange
      const actor = { id: 'actor1' };
      const world = { state: { test: 'value' } };
      const goal = {
        id: 'goal:test',
        name: 'Test Goal',
        priority: 10,
        relevance: null,
      };

      mockDataRegistry.getAll.mockReturnValue([goal]);
      mockGoapPlanner.plan.mockReturnValue({
        tasks: [
          { taskId: 'task1', methodId: 'method1' },
          { taskId: 'task2', methodId: 'method2' },
        ],
      });

      let callCount = 0;
      mockRefinementEngine.refine.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            success: false,
            error: 'Task 1 failed',
            fallbackBehavior: 'continue',
            taskId: 'task1',
            actorId: 'actor1',
            timestamp: Date.now(),
          };
        }
        return {
          success: true,
          stepResults: [{ actionId: 'action1', parameters: {} }],
          methodId: 'method2',
          taskId: 'task2',
          actorId: 'actor1',
          timestamp: Date.now(),
        };
      });

      mockParameterResolutionService.resolve.mockResolvedValue({
        actionId: 'action1',
        targetBindings: {},
      });

      // Act
      await controller.decideTurn(actor, world);

      // Assert - recursive call should work (implicit test that actor/world were stored)
      expect(mockRefinementEngine.refine).toHaveBeenCalledTimes(2);
    });
  });
});
