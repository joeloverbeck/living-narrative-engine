/**
 * @file Integration tests for conditional step execution in GOAP system
 * Tests the full integration between ConditionalStepExecutor and its real dependencies
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ConditionalStepExecutor from '../../../src/goap/refinement/steps/conditionalStepExecutor.js';
import ContextAssemblyService from '../../../src/goap/services/contextAssemblyService.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import StepExecutionError from '../../../src/goap/errors/stepExecutionError.js';
import { createTestBed } from '../../common/testBed.js';

describe('Conditional Execution - Integration', () => {
  let testBed;
  let executor;
  let contextAssemblyService;
  let jsonLogicService;
  let mockPrimitiveActionExecutor;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    // Create real services for integration testing
    mockEntityManager = testBed.createMock('IEntityManager', [
      'getEntity',
      'hasEntity',
      'getComponent',
      'getComponents',
    ]);

    // Real ContextAssemblyService
    contextAssemblyService = new ContextAssemblyService({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    // Real JsonLogicEvaluationService
    jsonLogicService = new JsonLogicEvaluationService({
      logger: mockLogger,
    });

    // Mock primitive action executor
    mockPrimitiveActionExecutor = testBed.createMock('IPrimitiveActionStepExecutor', [
      'execute',
    ]);

    // Create mock self-reference initially (will be replaced with real executor)
    const mockSelfRef = testBed.createMock('IConditionalStepExecutor', ['execute']);

    // Create executor with real services
    executor = new ConditionalStepExecutor({
      contextAssemblyService,
      primitiveActionStepExecutor: mockPrimitiveActionExecutor,
      conditionalStepExecutor: mockSelfRef,
      jsonLogicService,
      logger: mockLogger,
    });

    // Replace mock self-reference with real executor for actual recursive calls
    mockSelfRef.execute.mockImplementation((...args) => executor.execute(...args));
  });

  describe('Real Context Assembly and Condition Evaluation', () => {
    it('should evaluate condition using real services - item in inventory check', async () => {
      // Arrange - Scenario: Actor has item in inventory
      const step = {
        stepType: 'conditional',
        description: 'Check if actor has item in inventory',
        condition: {
          '>': [{ var: 'actor.components.core:inventory.items.length' }, 0],
        },
        thenSteps: [
          {
            stepType: 'primitive_action',
            actionId: 'items:drop_item',
          },
        ],
        elseSteps: [
          {
            stepType: 'primitive_action',
            actionId: 'items:find_item',
          },
        ],
      };

      const actor = {
        id: 'actor_123',
        name: 'Test Actor',
        components: {
          'core:inventory': {
            items: ['item_1', 'item_2'],
            maxWeight: 100,
          },
        },
      };

      // Mock entity manager to return actor entity
      mockEntityManager.getEntity.mockReturnValue(actor);

      const context = {
        task: {
          id: 'task_1',
          goalId: 'goal_1',
          params: {},
        },
        refinement: {
          methodId: 'test:method',
          localState: {},
        },
        actor,
        world: {},
      };

      mockPrimitiveActionExecutor.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert - thenSteps should execute (inventory has items)
      expect(result.success).toBe(true);
      expect(result.data.conditionResult).toBe(true);
      expect(mockPrimitiveActionExecutor.execute).toHaveBeenCalledWith(
        step.thenSteps[0],
        context,
        expect.any(Number)
      );
    });

    it('should evaluate condition using real services - empty inventory check', async () => {
      // Arrange - Scenario: Actor has empty inventory
      const step = {
        stepType: 'conditional',
        description: 'Check if actor has item in inventory',
        condition: {
          '>': [{ var: 'actor.components.core:inventory.items.length' }, 0],
        },
        thenSteps: [
          {
            stepType: 'primitive_action',
            actionId: 'items:drop_item',
          },
        ],
        elseSteps: [
          {
            stepType: 'primitive_action',
            actionId: 'items:find_item',
          },
        ],
      };

      const actor = {
        id: 'actor_123',
        name: 'Test Actor',
        components: {
          'core:inventory': {
            items: [],
            maxWeight: 100,
          },
        },
      };

      // Mock entity manager to return actor with empty inventory
      mockEntityManager.getEntity.mockReturnValue(actor);

      const context = {
        task: {
          id: 'task_1',
          goalId: 'goal_1',
          params: {},
        },
        refinement: {
          methodId: 'test:method',
          localState: {},
        },
        actor,
        world: {},
      };

      mockPrimitiveActionExecutor.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert - elseSteps should execute (inventory is empty)
      expect(result.success).toBe(true);
      expect(result.data.conditionResult).toBe(false);
      expect(mockPrimitiveActionExecutor.execute).toHaveBeenCalledWith(
        step.elseSteps[0],
        context,
        expect.any(Number)
      );
    });

    it('should evaluate complex JSON Logic condition', async () => {
      // Arrange - Scenario: Complex condition with AND logic
      const step = {
        stepType: 'conditional',
        description: 'Check if actor is in location AND has key',
        condition: {
          and: [
            { '==': [{ var: 'actor.components.core:location.currentLocation' }, 'house'] },
            { in: ['key_item', { var: 'actor.components.core:inventory.items' }] },
          ],
        },
        thenSteps: [
          {
            stepType: 'primitive_action',
            actionId: 'location:unlock_door',
          },
        ],
        elseSteps: [],
      };

      const actor = {
        id: 'actor_123',
        name: 'Test Actor',
        components: {
          'core:location': {
            currentLocation: 'house',
          },
          'core:inventory': {
            items: ['key_item', 'sword_item'],
            maxWeight: 100,
          },
        },
      };

      // Mock entity manager
      mockEntityManager.getEntity.mockReturnValue(actor);

      const context = {
        task: { id: 'task_1', goalId: 'goal_1', params: {} },
        refinement: { methodId: 'test:method', localState: {} },
        actor,
        world: {},
      };

      mockPrimitiveActionExecutor.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert - Both conditions true, thenSteps execute
      expect(result.success).toBe(true);
      expect(result.data.conditionResult).toBe(true);
      expect(mockPrimitiveActionExecutor.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('Real Nested Conditional Execution', () => {
    it('should handle 2-level nested conditionals', async () => {
      // Arrange - Nested conditional structure
      const step = {
        stepType: 'conditional',
        description: 'Level 1: Check inventory',
        condition: { '>': [{ var: 'actor.components.core:inventory.items.length' }, 0] },
        thenSteps: [
          {
            stepType: 'conditional',
            description: 'Level 2: Check if has weapon',
            condition: { in: ['weapon', { var: 'actor.components.core:inventory.items' }] },
            thenSteps: [
              {
                stepType: 'primitive_action',
                actionId: 'combat:attack',
              },
            ],
            elseSteps: [
              {
                stepType: 'primitive_action',
                actionId: 'combat:flee',
              },
            ],
          },
        ],
        elseSteps: [],
      };

      const actor = {
        id: 'actor_123',
        name: 'Test Actor',
        components: {
          'core:inventory': {
            items: ['weapon', 'potion'],
            maxWeight: 100,
          },
        },
      };

      // Mock: Actor has inventory with weapon
      mockEntityManager.getEntity.mockReturnValue(actor);

      const context = {
        task: { id: 'task_1', goalId: 'goal_1', params: {} },
        refinement: { methodId: 'test:method', localState: {} },
        actor,
        world: {},
      };

      mockPrimitiveActionExecutor.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert - Should execute attack (has inventory AND has weapon)
      expect(result.success).toBe(true);
      expect(result.data.conditionResult).toBe(true);
      expect(mockPrimitiveActionExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({ actionId: 'combat:attack' }),
        context,
        expect.any(Number)
      );
    });

    it('should enforce 3-level nesting limit', async () => {
      // Arrange - 4-level nesting (exceeds limit)
      const step = {
        stepType: 'conditional',
        description: 'Level 1',
        condition: { '==': [1, 1] },
        thenSteps: [
          {
            stepType: 'conditional',
            description: 'Level 2',
            condition: { '==': [1, 1] },
            thenSteps: [
              {
                stepType: 'conditional',
                description: 'Level 3',
                condition: { '==': [1, 1] },
                thenSteps: [
                  {
                    stepType: 'conditional',
                    description: 'Level 4 - TOO DEEP',
                    condition: { '==': [1, 1] },
                    thenSteps: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const context = {
        task: { id: 'task_1', goalId: 'goal_1', params: {} },
        refinement: { methodId: 'test:method', localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      mockEntityManager.getEntity.mockReturnValue(context.actor);
      mockEntityManager.getComponent.mockReturnValue(null);

      // Act & Assert - Should throw at 4th level
      await expect(executor.execute(step, context, 0)).rejects.toThrow(
        StepExecutionError
      );
      await expect(executor.execute(step, context, 0)).rejects.toThrow(
        /nesting depth limit exceeded/i
      );
    });
  });

  describe('Real Failure Handling', () => {
    it('should propagate failure with onFailure=fail', async () => {
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
        task: { id: 'task_1', goalId: 'goal_1', params: {} },
        refinement: { methodId: 'test:method', localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      mockEntityManager.getEntity.mockReturnValue(context.actor);
      mockEntityManager.getComponent.mockReturnValue(null);

      // Mock action failure
      mockPrimitiveActionExecutor.execute.mockResolvedValue({
        success: false,
        error: 'Action execution failed',
      });

      // Act & Assert
      await expect(executor.execute(step, context, 0)).rejects.toThrow(
        StepExecutionError
      );
      await expect(executor.execute(step, context, 0)).rejects.toThrow(
        /onFailure=fail/i
      );
    });

    it('should skip failure with onFailure=skip', async () => {
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
        task: { id: 'task_1', goalId: 'goal_1', params: {} },
        refinement: { methodId: 'test:method', localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      mockEntityManager.getEntity.mockReturnValue(context.actor);
      mockEntityManager.getComponent.mockReturnValue(null);

      // Mock action failure
      mockPrimitiveActionExecutor.execute.mockResolvedValue({
        success: false,
        error: 'Action execution failed',
      });

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert - Treated as success with skip flag
      expect(result.success).toBe(true);
      expect(result.data.skipped).toBe(true);
    });

    it('should request replan with onFailure=replan', async () => {
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
        task: { id: 'task_1', goalId: 'goal_1', params: {} },
        refinement: { methodId: 'test:method', localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      mockEntityManager.getEntity.mockReturnValue(context.actor);
      mockEntityManager.getComponent.mockReturnValue(null);

      // Mock action failure
      mockPrimitiveActionExecutor.execute.mockResolvedValue({
        success: false,
        error: 'Action execution failed',
      });

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert - Should return failure with replan request
      expect(result.success).toBe(false);
      expect(result.data.replanRequested).toBe(true);
    });
  });

  describe('Real Multi-Step Sequences', () => {
    it('should execute sequential thenSteps and aggregate results', async () => {
      // Arrange
      const step = {
        stepType: 'conditional',
        description: 'Multi-step sequence',
        condition: { '==': [1, 1] },
        thenSteps: [
          {
            stepType: 'primitive_action',
            actionId: 'test:step1',
          },
          {
            stepType: 'primitive_action',
            actionId: 'test:step2',
          },
          {
            stepType: 'primitive_action',
            actionId: 'test:step3',
          },
        ],
      };

      const context = {
        task: { id: 'task_1', goalId: 'goal_1', params: {} },
        refinement: { methodId: 'test:method', localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      mockEntityManager.getEntity.mockReturnValue(context.actor);
      mockEntityManager.getComponent.mockReturnValue(null);

      // Mock successful execution for all steps
      mockPrimitiveActionExecutor.execute
        .mockResolvedValueOnce({
          success: true,
          data: { step: 1 },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { step: 2 },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { step: 3 },
        });

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.branchStepCount).toBe(3);
      expect(result.data.branchResults).toHaveLength(3);
      expect(result.data.branchResults[0].data).toEqual({ step: 1 });
      expect(result.data.branchResults[1].data).toEqual({ step: 2 });
      expect(result.data.branchResults[2].data).toEqual({ step: 3 });
    });

    it('should stop execution after first failure in sequence', async () => {
      // Arrange
      const step = {
        stepType: 'conditional',
        description: 'Stop on failure',
        condition: { '==': [1, 1] },
        thenSteps: [
          { stepType: 'primitive_action', actionId: 'test:step1' },
          { stepType: 'primitive_action', actionId: 'test:step2' },
          { stepType: 'primitive_action', actionId: 'test:step3' },
        ],
        onFailure: 'replan',
      };

      const context = {
        task: { id: 'task_1', goalId: 'goal_1', params: {} },
        refinement: { methodId: 'test:method', localState: {} },
        actor: { id: 'actor_123' },
        world: {},
      };

      mockEntityManager.getEntity.mockReturnValue(context.actor);
      mockEntityManager.getComponent.mockReturnValue(null);

      // Mock: step1 succeeds, step2 fails, step3 should not execute
      mockPrimitiveActionExecutor.execute
        .mockResolvedValueOnce({
          success: true,
          data: { step: 1 },
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Step 2 failed',
        });

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(mockPrimitiveActionExecutor.execute).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(false);
      expect(result.data.replanRequested).toBe(true);
    });
  });
});
