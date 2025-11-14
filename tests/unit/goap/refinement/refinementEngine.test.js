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
    };

    mockPrimitiveActionStepExecutor = {
      execute: jest.fn(),
    };

    mockConditionalStepExecutor = {
      execute: jest.fn(),
    };

    mockContextAssemblyService = {
      assembleRefinementContext: jest.fn(() => Promise.resolve({
        actor: { id: 'actor_1' },
        world: {},
        task: { id: 'task_1', params: {} },
        refinement: { localState: {} },
      })),
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
      refinementStateManager: mockRefinementStateManager,
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
          refinementStateManager: mockRefinementStateManager,
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
          expect.objectContaining({
            type: 'GOAP_REFINEMENT_STARTED',
          })
        );
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'GOAP_METHOD_SELECTED',
          })
        );
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'GOAP_STEP_EXECUTED',
          })
        );
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'GOAP_REFINEMENT_COMPLETED',
          })
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
        expect(mockPrimitiveActionStepExecutor.execute).toHaveBeenCalledTimes(2);

        // Verify each step was executed
        const firstCallContext = mockPrimitiveActionStepExecutor.execute.mock.calls[0][1];
        const secondCallContext = mockPrimitiveActionStepExecutor.execute.mock.calls[1][1];

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
        expect(mockPrimitiveActionStepExecutor.execute).toHaveBeenCalledTimes(1);
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
          steps: [
            { stepType: 'primitive_action', actionRef: 'action_1' },
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
        expect(mockRefinementStateManager.initialize).toHaveBeenCalledBefore(
          mockPrimitiveActionStepExecutor.execute
        );
      });

      it('should clear state after successful execution', async () => {
        // Arrange
        const task = { id: 'task_1', fallbackBehavior: 'fail' };
        const selectedMethod = {
          id: 'method_1',
          steps: [
            { stepType: 'primitive_action', actionRef: 'action_1' },
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
        expect(mockRefinementStateManager.clear).toHaveBeenCalled();
      });

      it('should clear state after failed execution', async () => {
        // Arrange
        const task = { id: 'task_1', fallbackBehavior: 'fail' };
        const selectedMethod = {
          id: 'method_1',
          steps: [
            { stepType: 'primitive_action', actionRef: 'action_1' },
          ],
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
          steps: [
            { stepType: 'primitive_action', actionRef: 'action_1' },
          ],
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
        expect(mockContextAssemblyService.assembleRefinementContext).toHaveBeenCalledWith(
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
          steps: [
            { stepType: 'primitive_action', actionRef: 'action_1' },
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

        // Assert - verify event sequence
        const dispatchCalls = mockEventBus.dispatch.mock.calls.map(call => call[0].type);
        expect(dispatchCalls).toEqual([
          'GOAP_REFINEMENT_STARTED',
          'GOAP_METHOD_SELECTED',
          'GOAP_STEP_EXECUTED',
          'GOAP_REFINEMENT_COMPLETED',
        ]);
      });

      it('should dispatch GOAP_REFINEMENT_FAILED on error', async () => {
        // Arrange
        const task = { id: 'task_1', fallbackBehavior: 'fail' };
        const selectedMethod = {
          id: 'method_1',
          steps: [
            { stepType: 'primitive_action', actionRef: 'action_1' },
          ],
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
          expect.objectContaining({
            type: 'GOAP_REFINEMENT_FAILED',
          })
        );
      });

      it('should dispatch GOAP_STEP_EXECUTED for each step', async () => {
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
        const stepEvents = mockEventBus.dispatch.mock.calls
          .map(call => call[0])
          .filter(event => event.type === 'GOAP_STEP_EXECUTED');

        expect(stepEvents).toHaveLength(3);
        expect(stepEvents[0].payload.stepIndex).toBe(0);
        expect(stepEvents[1].payload.stepIndex).toBe(1);
        expect(stepEvents[2].payload.stepIndex).toBe(2);
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
            { stepType: 'conditional', condition: {}, thenSteps: [], elseSteps: [] },
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
          steps: [
            { stepType: 'unknown_type' },
          ],
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
});
