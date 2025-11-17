/**
 * @file Unit tests for GoapController - Action Hint Extraction (GOAPIMPL-021-04)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GoapController from '../../../../src/goap/controllers/goapController.js';
import { createGoapPlannerMock } from '../../../common/mocks/createGoapPlannerMock.js';
import { expectGoapPlannerMock } from '../../../common/mocks/expectGoapPlannerMock.js';

describe('GoapController - Action Hint Extraction', () => {
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

  describe('constructor', () => {
    it('should accept parameterResolutionService dependency', () => {
      expect(controller).toBeInstanceOf(GoapController);
      expect(mockLogger.info).toHaveBeenCalledWith('GoapController initialized');
    });

    it('should throw if parameterResolutionService is missing', () => {
      const deps = createValidDependencies();
      deps.parameterResolutionService = undefined;

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });

    it('should throw if parameterResolutionService missing resolve method', () => {
      const deps = createValidDependencies();
      deps.parameterResolutionService = {};

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });
  });

  describe('decideTurn - with refinement and action hint extraction', () => {
    let mockActor;
    let mockWorld;
    let mockGoal;
    let mockTask;

    beforeEach(() => {
      mockActor = { id: 'actor_1' };
      mockWorld = { state: { some: 'state' } };
      mockGoal = {
        id: 'goal:reduce_hunger',
        priority: 10,
        relevance: null, // Always relevant
      };
      mockTask = {
        taskId: 'task:consume_item',
        params: { item: 'item_apple_123' },
      };

      // Default mocks for successful flow
      mockDataRegistry.getAll.mockReturnValue([mockGoal]);
      mockContextAssemblyService.assemblePlanningContext.mockReturnValue({});
      mockGoapPlanner.plan.mockReturnValue({
        tasks: [mockTask],
      });
    });

    it('should refine task and extract action hint successfully', async () => {
      // Setup refinement result
      const refinementResult = {
        success: true,
        taskId: 'task:consume_item',
        methodId: 'core:consume_item.simple',
        actorId: 'actor_1',
        timestamp: Date.now(),
        stepResults: [{ success: true, data: {}, actionId: 'items:consume_item' }],
      };

      // Setup method with first step
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

      mockRefinementEngine.refine.mockResolvedValue(refinementResult);
      mockDataRegistry.get.mockReturnValue(method);
      mockParameterResolutionService.resolve.mockResolvedValue({
        item: 'item_apple_123',
      });

      const result = await controller.decideTurn(mockActor, mockWorld);

      expect(mockRefinementEngine.refine).toHaveBeenCalledWith(
        'task:consume_item',
        'actor_1',
        { item: 'item_apple_123' }
      );
      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'refinementMethod',
        'core:consume_item.simple'
      );
      expect(mockParameterResolutionService.resolve).toHaveBeenCalledWith(
        { item: 'task.params.item' },
        {
          task: { id: 'task:consume_item', params: { item: 'item_apple_123' } },
          actor: mockActor,
          refinement: { localState: {} },
        }
      );
      expect(result).toEqual({
        actionHint: {
          actionId: 'items:consume_item',
          targetBindings: { item: 'item_apple_123' },
        },
      });
    });

    it('should handle replan flag from refinement result', async () => {
      const refinementResult = {
        success: false,
        replan: true,
        error: 'Precondition no longer holds',
        methodId: 'core:consume_item.simple',
      };

      mockRefinementEngine.refine.mockResolvedValue(refinementResult);

      const result = await controller.decideTurn(mockActor, mockWorld);

      expect(result).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Refinement requested replan',
        expect.objectContaining({
          taskId: 'task:consume_item',
          reason: 'Precondition no longer holds',
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Plan cleared',
        expect.objectContaining({
          reason: 'Refinement requested replan',
        })
      );
    });

    it('should handle skipped flag from refinement result', async () => {
      const refinementResult = {
        success: true,
        skipped: true,
        methodId: 'core:consume_item.simple',
      };

      mockRefinementEngine.refine.mockResolvedValue(refinementResult);

      const result = await controller.decideTurn(mockActor, mockWorld);

      expect(result).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Task skipped, advancing to next task',
        expect.objectContaining({
          taskId: 'task:consume_item',
        })
      );
    });

    it('should handle skipped flag when it is the last task', async () => {
      const refinementResult = {
        success: true,
        skipped: true,
        methodId: 'core:consume_item.simple',
      };

      mockRefinementEngine.refine.mockResolvedValue(refinementResult);

      const result = await controller.decideTurn(mockActor, mockWorld);

      expect(result).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Plan completed',
        expect.any(Object)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Plan cleared',
        expect.objectContaining({
          reason: 'Goal achieved (last task skipped)',
        })
      );
    });

    it('should handle refinement failure with handleRefinementFailure', async () => {
      const refinementResult = {
        success: false,
        error: 'Method execution failed',
        methodId: 'core:consume_item.simple',
      };

      mockRefinementEngine.refine.mockResolvedValue(refinementResult);

      const result = await controller.decideTurn(mockActor, mockWorld);

      // handleRefinementFailure is a stub that returns null
      expect(result).toBeNull();
    });

    it('should handle missing methodId in refinement result', async () => {
      const refinementResult = {
        success: true,
        // methodId missing
        stepResults: [{ success: true }],
      };

      mockRefinementEngine.refine.mockResolvedValue(refinementResult);

      const result = await controller.decideTurn(mockActor, mockWorld);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Refinement result missing methodId',
        expect.any(Object)
      );
      expect(result).toBeNull();
    });

    it('should handle method not found in registry', async () => {
      const refinementResult = {
        success: true,
        methodId: 'core:consume_item.simple',
        stepResults: [{ success: true }],
      };

      mockRefinementEngine.refine.mockResolvedValue(refinementResult);
      mockDataRegistry.get.mockReturnValue(null); // Method not found

      const result = await controller.decideTurn(mockActor, mockWorld);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cannot find refinement method or first step',
        expect.objectContaining({ methodId: 'core:consume_item.simple' })
      );
      expect(result).toBeNull();
    });

    it('should handle method with no steps', async () => {
      const refinementResult = {
        success: true,
        methodId: 'core:consume_item.simple',
        stepResults: [{ success: true }],
      };

      const method = {
        id: 'core:consume_item.simple',
        steps: [], // Empty steps array
      };

      mockRefinementEngine.refine.mockResolvedValue(refinementResult);
      mockDataRegistry.get.mockReturnValue(method);

      const result = await controller.decideTurn(mockActor, mockWorld);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cannot find refinement method or first step',
        expect.any(Object)
      );
      expect(result).toBeNull();
    });

    it('should handle first step with no actionId', async () => {
      const refinementResult = {
        success: true,
        methodId: 'core:consume_item.simple',
        stepResults: [{ success: true }],
      };

      const method = {
        id: 'core:consume_item.simple',
        steps: [
          {
            stepType: 'primitive_action',
            // actionId missing
            targetBindings: { item: 'task.params.item' },
          },
        ],
      };

      mockRefinementEngine.refine.mockResolvedValue(refinementResult);
      mockDataRegistry.get.mockReturnValue(method);

      const result = await controller.decideTurn(mockActor, mockWorld);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'First method step has no actionId',
        expect.any(Object)
      );
      expect(result).toBeNull();
    });

    it('should handle binding resolution failure', async () => {
      const refinementResult = {
        success: true,
        methodId: 'core:consume_item.simple',
        stepResults: [{ success: true }],
      };

      const method = {
        id: 'core:consume_item.simple',
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'items:consume_item',
            targetBindings: { item: 'task.params.item' },
          },
        ],
      };

      mockRefinementEngine.refine.mockResolvedValue(refinementResult);
      mockDataRegistry.get.mockReturnValue(method);
      mockParameterResolutionService.resolve.mockRejectedValue(
        new Error('Resolution failed')
      );

      const result = await controller.decideTurn(mockActor, mockWorld);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to resolve step bindings',
        expect.any(Object)
      );
      expect(result).toBeNull();
    });

    it('should advance plan after successful hint extraction', async () => {
      const refinementResult = {
        success: true,
        methodId: 'core:consume_item.simple',
        stepResults: [{ success: true }],
      };

      const method = {
        id: 'core:consume_item.simple',
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'items:consume_item',
            targetBindings: { item: 'task.params.item' },
          },
        ],
      };

      mockRefinementEngine.refine.mockResolvedValue(refinementResult);
      mockDataRegistry.get.mockReturnValue(method);
      mockParameterResolutionService.resolve.mockResolvedValue({
        item: 'item_apple_123',
      });

      await controller.decideTurn(mockActor, mockWorld);

      // Plan should advance (logged as completed since it's the last task)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Plan completed',
        expect.any(Object)
      );
    });

    it('should clear plan when last task completes', async () => {
      const refinementResult = {
        success: true,
        methodId: 'core:consume_item.simple',
        stepResults: [{ success: true }],
      };

      const method = {
        id: 'core:consume_item.simple',
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'items:consume_item',
            targetBindings: { item: 'task.params.item' },
          },
        ],
      };

      mockRefinementEngine.refine.mockResolvedValue(refinementResult);
      mockDataRegistry.get.mockReturnValue(method);
      mockParameterResolutionService.resolve.mockResolvedValue({
        item: 'item_apple_123',
      });

      await controller.decideTurn(mockActor, mockWorld);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Plan cleared',
        expect.objectContaining({
          reason: 'Goal achieved',
        })
      );
    });

    it('should handle empty target bindings', async () => {
      const refinementResult = {
        success: true,
        methodId: 'core:consume_item.simple',
        stepResults: [{ success: true }],
      };

      const method = {
        id: 'core:consume_item.simple',
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'items:consume_item',
            // No targetBindings field
          },
        ],
      };

      mockRefinementEngine.refine.mockResolvedValue(refinementResult);
      mockDataRegistry.get.mockReturnValue(method);
      mockParameterResolutionService.resolve.mockResolvedValue({});

      const result = await controller.decideTurn(mockActor, mockWorld);

      expect(mockParameterResolutionService.resolve).toHaveBeenCalledWith(
        {},
        expect.any(Object)
      );
      expect(result).toEqual({
        actionHint: {
          actionId: 'items:consume_item',
          targetBindings: {},
        },
      });
    });
  });
});
