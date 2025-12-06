/**
 * @file Unit tests for RefinementEngine
 * Tests the main orchestration engine for task-to-action refinement.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import RefinementEngine from '../../../../src/goap/refinement/refinementEngine.js';
import RefinementError from '../../../../src/goap/errors/refinementError.js';

describe('RefinementEngine', () => {
  let refinementEngine;
  let mockMethodSelectionService;
  let mockRefinementStateManager;
  let mockContainer;
  let mockPrimitiveActionStepExecutor;
  let mockConditionalStepExecutor;
  let mockContextAssemblyService;
  let mockGameDataRepository;
  let mockEventBus;
  let mockLogger;

  beforeEach(() => {
    // Create mock services
    mockMethodSelectionService = {
      selectMethod: jest.fn(),
    };

    mockRefinementStateManager = {
      initialize: jest.fn(),
      store: jest.fn(),
      getSnapshot: jest.fn(() => ({})),
      clear: jest.fn(),
      has: jest.fn(() => false),
      get: jest.fn(() => undefined),
    };

    // Create mock container that resolves IRefinementStateManager
    mockContainer = {
      resolve: jest.fn((token) => {
        // Return state manager when IRefinementStateManager is requested
        if (token === 'IRefinementStateManager') {
          return mockRefinementStateManager;
        }
        throw new Error(`Unexpected token resolution: ${token}`);
      }),
    };

    mockPrimitiveActionStepExecutor = {
      execute: jest.fn(),
    };

    mockConditionalStepExecutor = {
      execute: jest.fn(),
    };

    mockContextAssemblyService = {
      assembleRefinementContext: jest.fn(() =>
        Promise.resolve({
          actor: { id: 'actor_1' },
          world: {},
          task: { id: 'task_1', params: {} },
          refinement: { localState: {} },
        })
      ),
    };

    mockGameDataRepository = {
      getTask: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    refinementEngine = new RefinementEngine({
      methodSelectionService: mockMethodSelectionService,
      container: mockContainer,
      primitiveActionStepExecutor: mockPrimitiveActionStepExecutor,
      conditionalStepExecutor: mockConditionalStepExecutor,
      contextAssemblyService: mockContextAssemblyService,
      gameDataRepository: mockGameDataRepository,
      eventBus: mockEventBus,
      logger: mockLogger,
    });
  });

  describe('Constructor', () => {
    it('should validate all required dependencies', () => {
      expect(() => {
        new RefinementEngine({
          methodSelectionService: null,
          container: mockContainer,
          primitiveActionStepExecutor: mockPrimitiveActionStepExecutor,
          conditionalStepExecutor: mockConditionalStepExecutor,
          contextAssemblyService: mockContextAssemblyService,
          gameDataRepository: mockGameDataRepository,
          eventBus: mockEventBus,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should initialize with all dependencies', () => {
      expect(refinementEngine).toBeDefined();
    });
  });

  describe('refine()', () => {
    describe('Successful Refinement Flow', () => {
      it('should complete refinement with primitive action steps', async () => {
        // Arrange
        const task = {
          id: 'core:consume_nourishing_item',
          fallbackBehavior: 'fail',
        };

        const selectedMethod = {
          id: 'consume_nourishing_item.simple_consume',
          steps: [
            {
              stepType: 'primitive_action',
              actionRef: 'items:consume_item',
            },
          ],
        };

        mockGameDataRepository.getTask.mockReturnValue(task);
        mockMethodSelectionService.selectMethod.mockReturnValue({
          selectedMethod,
          diagnostics: {},
        });
        mockPrimitiveActionStepExecutor.execute.mockResolvedValue({
          success: true,
          data: { consumed: true },
          error: null,
          timestamp: Date.now(),
          actionId: 'items:consume_item',
        });

        // Act
        const result = await refinementEngine.refine(
          'core:consume_nourishing_item',
          'actor_1',
          { item: 'item_7' }
        );

        // Assert
        expect(result.success).toBe(true);
        expect(result.stepResults).toHaveLength(1);
        expect(result.methodId).toBe('consume_nourishing_item.simple_consume');
        expect(result.taskId).toBe('core:consume_nourishing_item');
        expect(result.actorId).toBe('actor_1');

        // Verify state management lifecycle
        expect(mockRefinementStateManager.initialize).toHaveBeenCalled();
        expect(mockRefinementStateManager.clear).toHaveBeenCalled();

        // Verify events dispatched
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'goap:refinement_started',
          expect.objectContaining({ taskId: 'core:consume_nourishing_item' })
        );
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'goap:method_selected',
          expect.objectContaining({ taskId: 'core:consume_nourishing_item' })
        );
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'goap:refinement_step_started',
          expect.objectContaining({ taskId: 'core:consume_nourishing_item' })
        );
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'goap:refinement_step_completed',
          expect.objectContaining({ taskId: 'core:consume_nourishing_item' })
        );
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'goap:refinement_completed',
          expect.objectContaining({ taskId: 'core:consume_nourishing_item' })
        );
      });

      it('should handle multi-step refinement with state accumulation', async () => {
        // Arrange
        const task = {
          id: 'core:consume_nourishing_item',
          fallbackBehavior: 'fail',
        };

        const selectedMethod = {
          id: 'consume_nourishing_item.pick_up_and_consume',
          steps: [
            {
              stepType: 'primitive_action',
              actionRef: 'items:pick_up_item',
              storeResultAs: 'picked_item',
            },
            {
              stepType: 'primitive_action',
              actionRef: 'items:consume_item',
            },
          ],
        };

        mockGameDataRepository.getTask.mockReturnValue(task);
        mockMethodSelectionService.selectMethod.mockReturnValue({
          selectedMethod,
          diagnostics: {},
        });

        mockPrimitiveActionStepExecutor.execute
          .mockResolvedValueOnce({
            success: true,
            data: { itemId: 'item_7' },
            error: null,
            timestamp: Date.now(),
            actionId: 'items:pick_up_item',
          })
          .mockResolvedValueOnce({
            success: true,
            data: { consumed: true },
            error: null,
            timestamp: Date.now(),
            actionId: 'items:consume_item',
          });

        // Act
        const result = await refinementEngine.refine(
          'core:consume_nourishing_item',
          'actor_1',
          { item: 'item_7' }
        );

        // Assert
        expect(result.success).toBe(true);
        expect(result.stepResults).toHaveLength(2);
        expect(mockPrimitiveActionStepExecutor.execute).toHaveBeenCalledTimes(
          2
        );

        // Verify each step was executed
        const firstCallContext =
          mockPrimitiveActionStepExecutor.execute.mock.calls[0][1];
        const secondCallContext =
          mockPrimitiveActionStepExecutor.execute.mock.calls[1][1];

        expect(firstCallContext.task.id).toBe('task_1');
        expect(secondCallContext.task.id).toBe('task_1');
      });

      it('should handle conditional steps', async () => {
        // Arrange
        const task = {
          id: 'core:consume_nourishing_item',
          fallbackBehavior: 'fail',
        };

        const selectedMethod = {
          id: 'consume_nourishing_item.conditional',
          steps: [
            {
              stepType: 'conditional',
              condition: {
                '==': [{ var: 'actor.inventory.items.length' }, 0],
              },
              thenSteps: [
                {
                  stepType: 'primitive_action',
                  actionRef: 'items:pick_up_item',
                },
              ],
              elseSteps: [],
            },
            {
              stepType: 'primitive_action',
              actionRef: 'items:consume_item',
            },
          ],
        };

        mockGameDataRepository.getTask.mockReturnValue(task);
        mockMethodSelectionService.selectMethod.mockReturnValue({
          selectedMethod,
          diagnostics: {},
        });

        mockConditionalStepExecutor.execute.mockResolvedValue({
          success: true,
          data: { branchTaken: 'then' },
          error: null,
          timestamp: Date.now(),
          stepType: 'conditional',
        });

        mockPrimitiveActionStepExecutor.execute.mockResolvedValue({
          success: true,
          data: { consumed: true },
          error: null,
          timestamp: Date.now(),
          actionId: 'items:consume_item',
        });

        // Act
        const result = await refinementEngine.refine(
          'core:consume_nourishing_item',
          'actor_1',
          { item: 'item_7' }
        );

        // Assert
        expect(result.success).toBe(true);
        expect(result.stepResults).toHaveLength(2);
        expect(mockConditionalStepExecutor.execute).toHaveBeenCalledTimes(1);
        expect(mockPrimitiveActionStepExecutor.execute).toHaveBeenCalledTimes(
          1
        );
      });
    });

    describe('Method Selection', () => {
      it('should handle no applicable method with fallbackBehavior=replan', async () => {
        // Arrange
        const task = {
          id: 'core:consume_nourishing_item',
          fallbackBehavior: 'replan',
        };

        mockGameDataRepository.getTask.mockReturnValue(task);
        mockMethodSelectionService.selectMethod.mockReturnValue({
          selectedMethod: null,
          diagnostics: { methodsEvaluated: 2, evaluationResults: [] },
        });

        // Act
        const result = await refinementEngine.refine(
          'core:consume_nourishing_item',
          'actor_1',
          {}
        );

        // Assert
        expect(result.success).toBe(false);
        expect(result.replan).toBe(true);
        expect(result.reason).toBe('no_applicable_method');
      });

      it('should handle no applicable method with fallbackBehavior=fail', async () => {
        // Arrange
        const task = {
          id: 'core:consume_nourishing_item',
          fallbackBehavior: 'fail',
        };

        mockGameDataRepository.getTask.mockReturnValue(task);
        mockMethodSelectionService.selectMethod.mockReturnValue({
          selectedMethod: null,
          diagnostics: {},
        });

        // Act & Assert
        await expect(
          refinementEngine.refine('core:consume_nourishing_item', 'actor_1', {})
        ).rejects.toThrow(RefinementError);
        await expect(
          refinementEngine.refine('core:consume_nourishing_item', 'actor_1', {})
        ).rejects.toThrow('No applicable method');
      });

      it('should handle no applicable method with fallbackBehavior=continue', async () => {
        // Arrange
        const task = {
          id: 'core:consume_nourishing_item',
          fallbackBehavior: 'continue',
        };

        mockGameDataRepository.getTask.mockReturnValue(task);
        mockMethodSelectionService.selectMethod.mockReturnValue({
          selectedMethod: null,
          diagnostics: {},
        });

        // Act
        const result = await refinementEngine.refine(
          'core:consume_nourishing_item',
          'actor_1',
          {}
        );

        // Assert
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
        expect(result.reason).toBe('no_applicable_method');
      });
    });

    describe('State Management', () => {
      it('should initialize state before execution', async () => {
        // Arrange
        const task = { id: 'task_1', fallbackBehavior: 'fail' };
        const selectedMethod = {
          id: 'method_1',
          steps: [{ stepType: 'primitive_action', actionRef: 'action_1' }],
        };

        mockGameDataRepository.getTask.mockReturnValue(task);
        mockMethodSelectionService.selectMethod.mockReturnValue({
          selectedMethod,
          diagnostics: {},
        });
        mockPrimitiveActionStepExecutor.execute.mockResolvedValue({
          success: true,
          data: {},
          error: null,
          timestamp: Date.now(),
          actionId: 'action_1',
        });

        // Act
        await refinementEngine.refine('task_1', 'actor_1', {});

        // Assert
        expect(mockRefinementStateManager.initialize).toHaveBeenCalledBefore(
          mockPrimitiveActionStepExecutor.execute
        );
      });

      it('should clear state after successful execution', async () => {
        // Arrange
        const task = { id: 'task_1', fallbackBehavior: 'fail' };
        const selectedMethod = {
          id: 'method_1',
          steps: [{ stepType: 'primitive_action', actionRef: 'action_1' }],
        };

        mockGameDataRepository.getTask.mockReturnValue(task);
        mockMethodSelectionService.selectMethod.mockReturnValue({
          selectedMethod,
          diagnostics: {},
        });
        mockPrimitiveActionStepExecutor.execute.mockResolvedValue({
          success: true,
          data: {},
          error: null,
          timestamp: Date.now(),
          actionId: 'action_1',
        });

        // Act
        await refinementEngine.refine('task_1', 'actor_1', {});

        // Assert
        expect(mockRefinementStateManager.clear).toHaveBeenCalled();
      });

      it('should clear state after failed execution', async () => {
        // Arrange
        const task = { id: 'task_1', fallbackBehavior: 'fail' };
        const selectedMethod = {
          id: 'method_1',
          steps: [{ stepType: 'primitive_action', actionRef: 'action_1' }],
        };

        mockGameDataRepository.getTask.mockReturnValue(task);
        mockMethodSelectionService.selectMethod.mockReturnValue({
          selectedMethod,
          diagnostics: {},
        });
        mockPrimitiveActionStepExecutor.execute.mockRejectedValue(
          new Error('Step failed')
        );

        // Act & Assert
        await expect(
          refinementEngine.refine('task_1', 'actor_1', {})
        ).rejects.toThrow();

        // State should still be cleared due to finally block
        expect(mockRefinementStateManager.clear).toHaveBeenCalled();
      });

      it('should provide state snapshot to each step', async () => {
        // Arrange
        const task = { id: 'task_1', fallbackBehavior: 'fail' };
        const selectedMethod = {
          id: 'method_1',
          steps: [{ stepType: 'primitive_action', actionRef: 'action_1' }],
        };

        const stateSnapshot = { step1Result: 'data' };
        mockRefinementStateManager.getSnapshot.mockReturnValue(stateSnapshot);

        mockGameDataRepository.getTask.mockReturnValue(task);
        mockMethodSelectionService.selectMethod.mockReturnValue({
          selectedMethod,
          diagnostics: {},
        });
        mockPrimitiveActionStepExecutor.execute.mockResolvedValue({
          success: true,
          data: {},
          error: null,
          timestamp: Date.now(),
          actionId: 'action_1',
        });

        // Act
        await refinementEngine.refine('task_1', 'actor_1', {});

        // Assert
        expect(mockRefinementStateManager.getSnapshot).toHaveBeenCalled();
        expect(
          mockContextAssemblyService.assembleRefinementContext
        ).toHaveBeenCalledWith(
          'actor_1',
          expect.objectContaining({ id: 'task_1' }),
          stateSnapshot
        );
      });
    });

    describe('Event Dispatching', () => {
      it('should dispatch all lifecycle events for successful refinement', async () => {
        // Arrange
        const task = { id: 'task_1', fallbackBehavior: 'fail' };
        const selectedMethod = {
          id: 'method_1',
          steps: [{ stepType: 'primitive_action', actionRef: 'action_1' }],
        };

        mockGameDataRepository.getTask.mockReturnValue(task);
        mockMethodSelectionService.selectMethod.mockReturnValue({
          selectedMethod,
          diagnostics: {},
        });
        mockPrimitiveActionStepExecutor.execute.mockResolvedValue({
          success: true,
          data: {},
          error: null,
          timestamp: Date.now(),
          actionId: 'action_1',
        });

        // Act
        await refinementEngine.refine('task_1', 'actor_1', {});

        // Assert - verify event sequence
        const dispatchCalls = mockEventBus.dispatch.mock.calls.map(
          (call) => call[0]
        );
        expect(dispatchCalls).toEqual([
          'goap:refinement_started',
          'goap:method_selected',
          'goap:refinement_step_started',
          'goap:refinement_step_completed',
          'goap:refinement_completed',
        ]);
      });

      it('should dispatch goap:refinement_failed on error', async () => {
        // Arrange
        const task = { id: 'task_1', fallbackBehavior: 'fail' };
        const selectedMethod = {
          id: 'method_1',
          steps: [{ stepType: 'primitive_action', actionRef: 'action_1' }],
        };

        mockGameDataRepository.getTask.mockReturnValue(task);
        mockMethodSelectionService.selectMethod.mockReturnValue({
          selectedMethod,
          diagnostics: {},
        });
        mockPrimitiveActionStepExecutor.execute.mockRejectedValue(
          new Error('Execution failed')
        );

        // Act & Assert
        await expect(
          refinementEngine.refine('task_1', 'actor_1', {})
        ).rejects.toThrow();

        // Verify failure event was dispatched
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'goap:refinement_failed',
          expect.objectContaining({ taskId: 'task_1' })
        );
      });

      it('should dispatch step events for each step', async () => {
        // Arrange
        const task = { id: 'task_1', fallbackBehavior: 'fail' };
        const selectedMethod = {
          id: 'method_1',
          steps: [
            { stepType: 'primitive_action', actionRef: 'action_1' },
            { stepType: 'primitive_action', actionRef: 'action_2' },
            { stepType: 'primitive_action', actionRef: 'action_3' },
          ],
        };

        mockGameDataRepository.getTask.mockReturnValue(task);
        mockMethodSelectionService.selectMethod.mockReturnValue({
          selectedMethod,
          diagnostics: {},
        });
        mockPrimitiveActionStepExecutor.execute.mockResolvedValue({
          success: true,
          data: {},
          error: null,
          timestamp: Date.now(),
          actionId: 'action_1',
        });

        // Act
        await refinementEngine.refine('task_1', 'actor_1', {});

        // Assert
        const stepStartedEvents = mockEventBus.dispatch.mock.calls.filter(
          (call) => call[0] === 'goap:refinement_step_started'
        );

        const stepCompletedEvents = mockEventBus.dispatch.mock.calls.filter(
          (call) => call[0] === 'goap:refinement_step_completed'
        );

        expect(stepStartedEvents).toHaveLength(3);
        expect(stepCompletedEvents).toHaveLength(3);
        expect(stepStartedEvents[0][1].stepIndex).toBe(0);
        expect(stepStartedEvents[1][1].stepIndex).toBe(1);
        expect(stepStartedEvents[2][1].stepIndex).toBe(2);
        expect(stepCompletedEvents[0][1].stepIndex).toBe(0);
        expect(stepCompletedEvents[1][1].stepIndex).toBe(1);
        expect(stepCompletedEvents[2][1].stepIndex).toBe(2);
      });
    });

    describe('Error Handling', () => {
      it('should throw RefinementError when task not found', async () => {
        // Arrange
        mockGameDataRepository.getTask.mockReturnValue(null);

        // Act & Assert
        await expect(
          refinementEngine.refine('nonexistent_task', 'actor_1', {})
        ).rejects.toThrow(RefinementError);
        await expect(
          refinementEngine.refine('nonexistent_task', 'actor_1', {})
        ).rejects.toThrow('Task not found');
      });

      it('should handle step execution failure with replan request', async () => {
        // Arrange
        const task = { id: 'task_1', fallbackBehavior: 'fail' };
        const selectedMethod = {
          id: 'method_1',
          steps: [
            {
              stepType: 'conditional',
              condition: {},
              thenSteps: [],
              elseSteps: [],
            },
          ],
        };

        mockGameDataRepository.getTask.mockReturnValue(task);
        mockMethodSelectionService.selectMethod.mockReturnValue({
          selectedMethod,
          diagnostics: {},
        });
        mockConditionalStepExecutor.execute.mockResolvedValue({
          success: false,
          data: { replanRequested: true },
          error: 'Condition failed',
          timestamp: Date.now(),
          stepType: 'conditional',
        });

        // Act & Assert
        await expect(
          refinementEngine.refine('task_1', 'actor_1', {})
        ).rejects.toThrow(RefinementError);
        await expect(
          refinementEngine.refine('task_1', 'actor_1', {})
        ).rejects.toThrow('requested replan');
      });

      it('should handle unknown step type', async () => {
        // Arrange
        const task = { id: 'task_1', fallbackBehavior: 'fail' };
        const selectedMethod = {
          id: 'method_1',
          steps: [{ stepType: 'unknown_type' }],
        };

        mockGameDataRepository.getTask.mockReturnValue(task);
        mockMethodSelectionService.selectMethod.mockReturnValue({
          selectedMethod,
          diagnostics: {},
        });

        // Act & Assert
        await expect(
          refinementEngine.refine('task_1', 'actor_1', {})
        ).rejects.toThrow(RefinementError);
        await expect(
          refinementEngine.refine('task_1', 'actor_1', {})
        ).rejects.toThrow('Unknown step type');
      });

      it('should handle unknown fallback behavior', async () => {
        // Arrange
        const task = {
          id: 'task_1',
          fallbackBehavior: 'invalid_behavior',
        };

        mockGameDataRepository.getTask.mockReturnValue(task);
        mockMethodSelectionService.selectMethod.mockReturnValue({
          selectedMethod: null,
          diagnostics: {},
        });

        // Act & Assert
        await expect(
          refinementEngine.refine('task_1', 'actor_1', {})
        ).rejects.toThrow(RefinementError);
        await expect(
          refinementEngine.refine('task_1', 'actor_1', {})
        ).rejects.toThrow('Unknown fallback behavior');
      });
    });

    describe('Step Failure Handling', () => {
      it('should continue execution when step fails but does not request replan', async () => {
        // Arrange
        const task = { id: 'task_1', fallbackBehavior: 'fail' };
        const selectedMethod = {
          id: 'method_1',
          steps: [
            { stepType: 'primitive_action', actionRef: 'action_1' },
            { stepType: 'primitive_action', actionRef: 'action_2' },
          ],
        };

        mockGameDataRepository.getTask.mockReturnValue(task);
        mockMethodSelectionService.selectMethod.mockReturnValue({
          selectedMethod,
          diagnostics: {},
        });

        // First step fails but doesn't request replan
        mockPrimitiveActionStepExecutor.execute
          .mockResolvedValueOnce({
            success: false,
            data: {},
            error: 'Step failed',
            timestamp: Date.now(),
            actionId: 'action_1',
          })
          .mockResolvedValueOnce({
            success: true,
            data: {},
            error: null,
            timestamp: Date.now(),
            actionId: 'action_2',
          });

        // Act
        const result = await refinementEngine.refine('task_1', 'actor_1', {});

        // Assert
        expect(result.success).toBe(true);
        expect(result.stepResults).toHaveLength(2);
        expect(result.stepResults[0].success).toBe(false);
        expect(result.stepResults[1].success).toBe(true);
      });
    });
  });

  describe('Step-level events', () => {
    beforeEach(() => {
      // Setup common task and method for all step event tests
      const mockTask = {
        id: 'task_1',
        name: 'Test Task',
        fallbackBehavior: 'abort',
      };

      mockGameDataRepository.getTask.mockReturnValue(mockTask);

      const mockMethod = {
        id: 'method_1',
        name: 'Test Method',
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'action_1',
            storeResultAs: 'step1Result',
          },
        ],
      };

      mockMethodSelectionService.selectMethod.mockReturnValue({
        selectedMethod: mockMethod,
        diagnostics: {},
      });
    });

    it('should dispatch REFINEMENT_STEP_STARTED before each step', async () => {
      // Arrange
      mockPrimitiveActionStepExecutor.execute.mockResolvedValue({
        success: true,
        data: {},
        error: null,
        timestamp: Date.now(),
        actionId: 'action_1',
      });

      // Act
      await refinementEngine.refine('task_1', 'actor_1', {});

      // Assert
      const startedEvents = mockEventBus.dispatch.mock.calls.filter(
        (call) => call[0] === 'goap:refinement_step_started'
      );

      expect(startedEvents).toHaveLength(1);
      expect(startedEvents[0][1]).toMatchObject({
        actorId: 'actor_1',
        taskId: 'task_1',
        methodId: 'method_1',
        stepIndex: 0,
        step: {
          stepType: 'primitive_action',
          actionId: 'action_1',
          storeResultAs: 'step1Result',
        },
      });
      expect(startedEvents[0][1].timestamp).toBeDefined();
    });

    it('should dispatch REFINEMENT_STEP_COMPLETED after successful step', async () => {
      // Arrange
      const mockResult = {
        success: true,
        data: {},
        error: null,
        timestamp: Date.now(),
        actionId: 'action_1',
      };
      mockPrimitiveActionStepExecutor.execute.mockResolvedValue(mockResult);

      // Act
      await refinementEngine.refine('task_1', 'actor_1', {});

      // Assert
      const completedEvents = mockEventBus.dispatch.mock.calls.filter(
        (call) => call[0] === 'goap:refinement_step_completed'
      );

      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0][1]).toMatchObject({
        actorId: 'actor_1',
        taskId: 'task_1',
        methodId: 'method_1',
        stepIndex: 0,
        result: {
          success: true,
          actionId: 'action_1',
        },
      });
      expect(completedEvents[0][1].duration).toBeDefined();
      expect(completedEvents[0][1].timestamp).toBeDefined();
    });

    it('should dispatch REFINEMENT_STEP_FAILED on step error', async () => {
      // Arrange
      const stepError = new Error('Step execution failed');
      mockPrimitiveActionStepExecutor.execute.mockRejectedValue(stepError);

      // Act & Assert
      await expect(
        refinementEngine.refine('task_1', 'actor_1', {})
      ).rejects.toThrow();

      const failedEvents = mockEventBus.dispatch.mock.calls.filter(
        (call) => call[0] === 'goap:refinement_step_failed'
      );

      expect(failedEvents).toHaveLength(1);
      expect(failedEvents[0][1]).toMatchObject({
        actorId: 'actor_1',
        taskId: 'task_1',
        methodId: 'method_1',
        stepIndex: 0,
        error: 'Step execution failed',
      });
      expect(failedEvents[0][1].timestamp).toBeDefined();
    });

    it('should dispatch REFINEMENT_STATE_UPDATED when storeResultAs is used', async () => {
      // Arrange
      const mockResult = {
        success: true,
        data: { value: 42 },
        error: null,
        timestamp: Date.now(),
        actionId: 'action_1',
      };
      mockPrimitiveActionStepExecutor.execute.mockResolvedValue(mockResult);

      mockRefinementStateManager.has.mockReturnValue(false);

      // Act
      await refinementEngine.refine('task_1', 'actor_1', {});

      // Assert
      const stateUpdatedEvents = mockEventBus.dispatch.mock.calls.filter(
        (call) => call[0] === 'goap:refinement_state_updated'
      );

      expect(stateUpdatedEvents).toHaveLength(1);
      expect(stateUpdatedEvents[0][1]).toMatchObject({
        actorId: 'actor_1',
        taskId: 'task_1',
        key: 'step1Result',
        oldValue: undefined,
        newValue: mockResult,
      });
      expect(stateUpdatedEvents[0][1].timestamp).toBeDefined();
    });

    it('should maintain correct event ordering: started before completed', async () => {
      // Arrange
      mockPrimitiveActionStepExecutor.execute.mockResolvedValue({
        success: true,
        data: {},
        error: null,
        timestamp: Date.now(),
        actionId: 'action_1',
      });

      // Act
      await refinementEngine.refine('task_1', 'actor_1', {});

      // Assert
      const allEvents = mockEventBus.dispatch.mock.calls.map((call) => call[0]);
      const startedIndex = allEvents.indexOf('goap:refinement_step_started');
      const completedIndex = allEvents.indexOf(
        'goap:refinement_step_completed'
      );

      expect(startedIndex).toBeGreaterThanOrEqual(0);
      expect(completedIndex).toBeGreaterThan(startedIndex);
    });

    it('should include all required fields in step events', async () => {
      // Arrange
      mockPrimitiveActionStepExecutor.execute.mockResolvedValue({
        success: true,
        data: {},
        error: null,
        timestamp: Date.now(),
        actionId: 'action_1',
      });

      // Act
      await refinementEngine.refine('task_1', 'actor_1', {});

      // Assert
      const startedEventPayload = mockEventBus.dispatch.mock.calls.find(
        (call) => call[0] === 'goap:refinement_step_started'
      )[1];

      expect(startedEventPayload).toHaveProperty('actorId');
      expect(startedEventPayload).toHaveProperty('taskId');
      expect(startedEventPayload).toHaveProperty('methodId');
      expect(startedEventPayload).toHaveProperty('stepIndex');
      expect(startedEventPayload).toHaveProperty('step');
      expect(startedEventPayload).toHaveProperty('timestamp');

      const completedEventPayload = mockEventBus.dispatch.mock.calls.find(
        (call) => call[0] === 'goap:refinement_step_completed'
      )[1];

      expect(completedEventPayload).toHaveProperty('actorId');
      expect(completedEventPayload).toHaveProperty('taskId');
      expect(completedEventPayload).toHaveProperty('methodId');
      expect(completedEventPayload).toHaveProperty('stepIndex');
      expect(completedEventPayload).toHaveProperty('result');
      expect(completedEventPayload).toHaveProperty('duration');
      expect(completedEventPayload).toHaveProperty('timestamp');
    });

    it('should dispatch events for multiple steps', async () => {
      // Arrange
      const mockMethod = {
        id: 'method_multi',
        name: 'Multi-Step Method',
        steps: [
          { stepType: 'primitive_action', actionId: 'action_1' },
          { stepType: 'primitive_action', actionId: 'action_2' },
          { stepType: 'conditional', branches: [] },
        ],
      };

      mockMethodSelectionService.selectMethod.mockReturnValue({
        selectedMethod: mockMethod,
        diagnostics: {},
      });

      mockPrimitiveActionStepExecutor.execute
        .mockResolvedValueOnce({
          success: true,
          data: {},
          error: null,
          timestamp: Date.now(),
          actionId: 'action_1',
        })
        .mockResolvedValueOnce({
          success: true,
          data: {},
          error: null,
          timestamp: Date.now(),
          actionId: 'action_2',
        });

      mockConditionalStepExecutor.execute.mockResolvedValue({
        success: true,
        data: {},
        error: null,
        timestamp: Date.now(),
      });

      // Act
      await refinementEngine.refine('task_1', 'actor_1', {});

      // Assert
      const startedEvents = mockEventBus.dispatch.mock.calls.filter(
        (call) => call[0] === 'goap:refinement_step_started'
      );
      const completedEvents = mockEventBus.dispatch.mock.calls.filter(
        (call) => call[0] === 'goap:refinement_step_completed'
      );

      expect(startedEvents).toHaveLength(3);
      expect(completedEvents).toHaveLength(3);
    });
  });
});
