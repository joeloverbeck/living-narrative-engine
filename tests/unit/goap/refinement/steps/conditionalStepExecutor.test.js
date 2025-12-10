/**
 * @file Unit tests for ConditionalStepExecutor
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ConditionalStepExecutor from '../../../../../src/goap/refinement/steps/conditionalStepExecutor.js';
import StepExecutionError from '../../../../../src/goap/errors/stepExecutionError.js';
import { createTestBed } from '../../../../common/testBed.js';

describe('ConditionalStepExecutor', () => {
  let testBed;
  let executor;
  let mockContextAssemblyService;
  let mockPrimitiveActionExecutor;
  let mockConditionalExecutor; // Self-reference
  let mockJsonLogicService;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();

    // Create mocks
    mockLogger = testBed.createMockLogger();
    mockContextAssemblyService = testBed.createMock('IContextAssemblyService', [
      'assembleConditionContext',
    ]);
    mockPrimitiveActionExecutor = testBed.createMock(
      'IPrimitiveActionStepExecutor',
      ['execute']
    );
    mockJsonLogicService = testBed.createMock('JsonLogicEvaluationService', [
      'evaluate',
    ]);

    // Create mock self-reference for testing (will be replaced with real executor below)
    mockConditionalExecutor = testBed.createMock('IConditionalStepExecutor', [
      'execute',
    ]);

    // Create executor with mock self-reference initially
    executor = new ConditionalStepExecutor({
      contextAssemblyService: mockContextAssemblyService,
      primitiveActionStepExecutor: mockPrimitiveActionExecutor,
      conditionalStepExecutor: mockConditionalExecutor,
      jsonLogicService: mockJsonLogicService,
      logger: mockLogger,
    });

    // Replace mock self-reference with real executor for actual recursive calls
    mockConditionalExecutor.execute.mockImplementation((...args) =>
      executor.execute(...args)
    );
  });

  describe('Condition Evaluation', () => {
    it('should execute thenSteps when condition is truthy', async () => {
      // Arrange
      const step = {
        stepType: 'conditional',
        description: 'Check if item in inventory',
        condition: { '==': [{ var: 'actor.inventory.length' }, 1] },
        thenSteps: [
          {
            stepType: 'primitive_action',
            actionId: 'item-handling:drop_item',
          },
        ],
        elseSteps: [],
      };

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123', inventory: ['item_1'] },
        world: {},
      };

      const conditionContext = {
        actor: { inventory: { length: 1 } },
        task: {},
        refinement: {},
        world: {},
      };

      mockContextAssemblyService.assembleConditionContext.mockReturnValue(
        conditionContext
      );
      mockJsonLogicService.evaluate.mockReturnValue(true);
      mockPrimitiveActionExecutor.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(mockJsonLogicService.evaluate).toHaveBeenCalledWith(
        step.condition,
        conditionContext
      );
      expect(mockPrimitiveActionExecutor.execute).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.data.conditionResult).toBe(true);
      expect(result.data.branchStepCount).toBe(1);
    });

    it('should execute elseSteps when condition is falsy', async () => {
      // Arrange
      const step = {
        stepType: 'conditional',
        description: 'Check if item in inventory',
        condition: { '==': [{ var: 'actor.inventory.length' }, 1] },
        thenSteps: [
          {
            stepType: 'primitive_action',
            actionId: 'item-handling:drop_item',
          },
        ],
        elseSteps: [
          {
            stepType: 'primitive_action',
            actionId: 'item-handling:pick_up_item',
          },
        ],
      };

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123', inventory: [] },
        world: {},
      };

      const conditionContext = {
        actor: { inventory: { length: 0 } },
        task: {},
        refinement: {},
        world: {},
      };

      mockContextAssemblyService.assembleConditionContext.mockReturnValue(
        conditionContext
      );
      mockJsonLogicService.evaluate.mockReturnValue(false);
      mockPrimitiveActionExecutor.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(mockJsonLogicService.evaluate).toHaveBeenCalledWith(
        step.condition,
        conditionContext
      );
      expect(mockPrimitiveActionExecutor.execute).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.data.conditionResult).toBe(false);
    });

    it('should treat missing elseSteps as no-op when condition is falsy', async () => {
      // Arrange
      const step = {
        stepType: 'conditional',
        description: 'Check if item in inventory',
        condition: { '==': [{ var: 'actor.inventory.length' }, 1] },
        thenSteps: [
          {
            stepType: 'primitive_action',
            actionId: 'item-handling:drop_item',
          },
        ],
        // No elseSteps property
      };

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123', inventory: [] },
        world: {},
      };

      const conditionContext = {
        actor: { inventory: { length: 0 } },
        task: {},
        refinement: {},
        world: {},
      };

      mockContextAssemblyService.assembleConditionContext.mockReturnValue(
        conditionContext
      );
      mockJsonLogicService.evaluate.mockReturnValue(false);

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(mockPrimitiveActionExecutor.execute).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data.branchStepCount).toBe(0);
    });

    it('should treat condition evaluation errors as falsy', async () => {
      // Arrange
      const step = {
        stepType: 'conditional',
        description: 'Invalid condition',
        condition: { invalid_operator: [] },
        thenSteps: [
          {
            stepType: 'primitive_action',
            actionId: 'item-handling:drop_item',
          },
        ],
        elseSteps: [
          {
            stepType: 'primitive_action',
            actionId: 'item-handling:pick_up_item',
          },
        ],
      };

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      const conditionContext = {
        actor: {},
        task: {},
        refinement: {},
        world: {},
      };

      mockContextAssemblyService.assembleConditionContext.mockReturnValue(
        conditionContext
      );
      mockJsonLogicService.evaluate.mockImplementation(() => {
        throw new Error('Invalid JSON Logic operator');
      });
      mockPrimitiveActionExecutor.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert - elseSteps should be executed
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockPrimitiveActionExecutor.execute).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });
  });

  describe('Nesting Depth Validation', () => {
    it('should allow 1-level nesting', async () => {
      // Arrange
      const step = {
        stepType: 'conditional',
        description: 'Level 1',
        condition: { '==': [1, 1] },
        thenSteps: [
          {
            stepType: 'primitive_action',
            actionId: 'test:action',
          },
        ],
      };

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      mockContextAssemblyService.assembleConditionContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockReturnValue(true);
      mockPrimitiveActionExecutor.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      // Act & Assert - should not throw
      await expect(
        executor.execute(step, context, 0, 0)
      ).resolves.toBeDefined();
    });

    it('should allow 2-level nesting', async () => {
      // Arrange - depth 0 passed, so internal depth will be 1, then 2
      const step = {
        stepType: 'conditional',
        description: 'Level 1',
        condition: { '==': [1, 1] },
        thenSteps: [],
      };

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      mockContextAssemblyService.assembleConditionContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockReturnValue(true);

      // Act & Assert - depth 1 should be allowed
      await expect(
        executor.execute(step, context, 0, 1)
      ).resolves.toBeDefined();
    });

    it('should allow 3-level nesting (at limit)', async () => {
      // Arrange
      const step = {
        stepType: 'conditional',
        description: 'Level 3',
        condition: { '==': [1, 1] },
        thenSteps: [],
      };

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      mockContextAssemblyService.assembleConditionContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockReturnValue(true);

      // Act & Assert - depth 2 should be allowed (3rd level)
      await expect(
        executor.execute(step, context, 0, 2)
      ).resolves.toBeDefined();
    });

    it('should throw error when nesting exceeds 3 levels', async () => {
      // Arrange
      const step = {
        stepType: 'conditional',
        description: 'Level 4 - too deep',
        condition: { '==': [1, 1] },
        thenSteps: [],
      };

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      // Act & Assert - depth 3 should throw (4th level)
      await expect(executor.execute(step, context, 0, 3)).rejects.toThrow(
        StepExecutionError
      );
      await expect(executor.execute(step, context, 0, 3)).rejects.toThrow(
        /nesting depth limit exceeded/i
      );
    });
  });

  describe('onFailure Mode Handling', () => {
    it('should throw error when branch step fails with onFailure=fail', async () => {
      // Arrange
      const step = {
        stepType: 'conditional',
        description: 'Fail on error',
        condition: { '==': [1, 1] },
        thenSteps: [
          {
            stepType: 'primitive_action',
            actionId: 'test:failing_action',
          },
        ],
        onFailure: 'fail',
      };

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      mockContextAssemblyService.assembleConditionContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockReturnValue(true);
      mockPrimitiveActionExecutor.execute.mockResolvedValue({
        success: false,
        error: 'Action failed',
      });

      // Act & Assert
      await expect(executor.execute(step, context, 0)).rejects.toThrow(
        StepExecutionError
      );
      await expect(executor.execute(step, context, 0)).rejects.toThrow(
        /onFailure=fail/i
      );
    });

    it('should skip and return success when branch step fails with onFailure=skip', async () => {
      // Arrange
      const step = {
        stepType: 'conditional',
        description: 'Skip on error',
        condition: { '==': [1, 1] },
        thenSteps: [
          {
            stepType: 'primitive_action',
            actionId: 'test:failing_action',
          },
        ],
        onFailure: 'skip',
      };

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      mockContextAssemblyService.assembleConditionContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockReturnValue(true);
      mockPrimitiveActionExecutor.execute.mockResolvedValue({
        success: false,
        error: 'Action failed',
      });

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.skipped).toBe(true);
      expect(result.data.reason).toMatch(/onFailure=skip/i);
    });

    it('should request replan when branch step fails with onFailure=replan', async () => {
      // Arrange
      const step = {
        stepType: 'conditional',
        description: 'Replan on error',
        condition: { '==': [1, 1] },
        thenSteps: [
          {
            stepType: 'primitive_action',
            actionId: 'test:failing_action',
          },
        ],
        onFailure: 'replan',
      };

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      mockContextAssemblyService.assembleConditionContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockReturnValue(true);
      mockPrimitiveActionExecutor.execute.mockResolvedValue({
        success: false,
        error: 'Action failed',
      });

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(result.success).toBe(false);
      expect(result.data.replanRequested).toBe(true);
      expect(result.data.reason).toMatch(/onFailure=replan/i);
    });

    it('should default to replan when onFailure not specified', async () => {
      // Arrange
      const step = {
        stepType: 'conditional',
        description: 'Default replan',
        condition: { '==': [1, 1] },
        thenSteps: [
          {
            stepType: 'primitive_action',
            actionId: 'test:failing_action',
          },
        ],
        // No onFailure property - should default to 'replan'
      };

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      mockContextAssemblyService.assembleConditionContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockReturnValue(true);
      mockPrimitiveActionExecutor.execute.mockResolvedValue({
        success: false,
        error: 'Action failed',
      });

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(result.success).toBe(false);
      expect(result.data.replanRequested).toBe(true);
    });
  });

  describe('Branch Execution', () => {
    it('should execute multiple thenSteps sequentially', async () => {
      // Arrange
      const step = {
        stepType: 'conditional',
        description: 'Multiple steps',
        condition: { '==': [1, 1] },
        thenSteps: [
          { stepType: 'primitive_action', actionId: 'test:action1' },
          { stepType: 'primitive_action', actionId: 'test:action2' },
          { stepType: 'primitive_action', actionId: 'test:action3' },
        ],
      };

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      mockContextAssemblyService.assembleConditionContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockReturnValue(true);
      mockPrimitiveActionExecutor.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(mockPrimitiveActionExecutor.execute).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
      expect(result.data.branchStepCount).toBe(3);
    });

    it('should stop executing steps after first failure', async () => {
      // Arrange
      const step = {
        stepType: 'conditional',
        description: 'Stop on failure',
        condition: { '==': [1, 1] },
        thenSteps: [
          { stepType: 'primitive_action', actionId: 'test:action1' },
          { stepType: 'primitive_action', actionId: 'test:action2' },
          { stepType: 'primitive_action', actionId: 'test:action3' },
        ],
        onFailure: 'replan',
      };

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      mockContextAssemblyService.assembleConditionContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockReturnValue(true);

      // First action succeeds, second fails, third should not be called
      mockPrimitiveActionExecutor.execute
        .mockResolvedValueOnce({ success: true, data: {} })
        .mockResolvedValueOnce({ success: false, error: 'Failed' });

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(mockPrimitiveActionExecutor.execute).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(false);
    });

    it('should aggregate results from all successful steps', async () => {
      // Arrange
      const step = {
        stepType: 'conditional',
        description: 'Aggregate results',
        condition: { '==': [1, 1] },
        thenSteps: [
          { stepType: 'primitive_action', actionId: 'test:action1' },
          { stepType: 'primitive_action', actionId: 'test:action2' },
        ],
      };

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      mockContextAssemblyService.assembleConditionContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockReturnValue(true);
      mockPrimitiveActionExecutor.execute
        .mockResolvedValueOnce({
          success: true,
          data: { item: 'item_1' },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { item: 'item_2' },
        });

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.branchResults).toHaveLength(2);
      expect(result.data.branchResults[0].data).toEqual({ item: 'item_1' });
      expect(result.data.branchResults[1].data).toEqual({ item: 'item_2' });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty thenSteps array', async () => {
      // Arrange
      const step = {
        stepType: 'conditional',
        description: 'Empty then branch',
        condition: { '==': [1, 1] },
        thenSteps: [],
      };

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      mockContextAssemblyService.assembleConditionContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockReturnValue(true);

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(mockPrimitiveActionExecutor.execute).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data.branchStepCount).toBe(0);
    });

    it('should handle empty elseSteps array', async () => {
      // Arrange
      const step = {
        stepType: 'conditional',
        description: 'Empty else branch',
        condition: { '==': [1, 2] },
        thenSteps: [{ stepType: 'primitive_action', actionId: 'test:action1' }],
        elseSteps: [],
      };

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      mockContextAssemblyService.assembleConditionContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockReturnValue(false);

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(mockPrimitiveActionExecutor.execute).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data.branchStepCount).toBe(0);
    });

    it('should include description in result', async () => {
      // Arrange
      const step = {
        stepType: 'conditional',
        description: 'Custom description',
        condition: { '==': [1, 1] },
        thenSteps: [],
      };

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      mockContextAssemblyService.assembleConditionContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockReturnValue(true);

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(result.description).toBe('Custom description');
    });

    it('should use "unnamed conditional" when description not provided', async () => {
      // Arrange
      const step = {
        stepType: 'conditional',
        condition: { '==': [1, 1] },
        thenSteps: [],
      };

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      mockContextAssemblyService.assembleConditionContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockReturnValue(true);

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(result.description).toBe('unnamed conditional');
    });
  });

  describe('Constructor Validation', () => {
    it('should throw error when contextAssemblyService is invalid', () => {
      const mockSelfRef = testBed.createMock('IConditionalStepExecutor', [
        'execute',
      ]);
      expect(() => {
        new ConditionalStepExecutor({
          contextAssemblyService: {},
          primitiveActionStepExecutor: mockPrimitiveActionExecutor,
          conditionalStepExecutor: mockSelfRef,
          jsonLogicService: mockJsonLogicService,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw error when primitiveActionStepExecutor is invalid', () => {
      const mockSelfRef = testBed.createMock('IConditionalStepExecutor', [
        'execute',
      ]);
      expect(() => {
        new ConditionalStepExecutor({
          contextAssemblyService: mockContextAssemblyService,
          primitiveActionStepExecutor: {},
          conditionalStepExecutor: mockSelfRef,
          jsonLogicService: mockJsonLogicService,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw error when conditionalStepExecutor is invalid', () => {
      expect(() => {
        new ConditionalStepExecutor({
          contextAssemblyService: mockContextAssemblyService,
          primitiveActionStepExecutor: mockPrimitiveActionExecutor,
          conditionalStepExecutor: {},
          jsonLogicService: mockJsonLogicService,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw error when jsonLogicService is invalid', () => {
      const mockSelfRef = testBed.createMock('IConditionalStepExecutor', [
        'execute',
      ]);
      expect(() => {
        new ConditionalStepExecutor({
          contextAssemblyService: mockContextAssemblyService,
          primitiveActionStepExecutor: mockPrimitiveActionExecutor,
          conditionalStepExecutor: mockSelfRef,
          jsonLogicService: {},
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw error when logger is invalid', () => {
      const mockSelfRef = testBed.createMock('IConditionalStepExecutor', [
        'execute',
      ]);
      expect(() => {
        new ConditionalStepExecutor({
          contextAssemblyService: mockContextAssemblyService,
          primitiveActionStepExecutor: mockPrimitiveActionExecutor,
          conditionalStepExecutor: mockSelfRef,
          jsonLogicService: mockJsonLogicService,
          logger: {},
        });
      }).toThrow();
    });
  });
});
