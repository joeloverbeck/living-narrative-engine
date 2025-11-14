/**
 * @file Unit tests for PrimitiveActionStepExecutor
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import PrimitiveActionStepExecutor from '../../../../../src/goap/refinement/steps/primitiveActionStepExecutor.js';
import { createTestBed } from '../../../../common/testBed.js';

describe('PrimitiveActionStepExecutor', () => {
  let testBed;
  let executor;
  let mockParameterResolver;
  let mockStateManager;
  let mockOperationInterpreter;
  let mockActionIndex;
  let mockGameDataRepository;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();

    // Create mocks
    mockLogger = testBed.createMockLogger();
    mockParameterResolver = testBed.createMock('IParameterResolutionService', [
      'resolve',
      'clearCache',
    ]);
    mockStateManager = testBed.createMock('IRefinementStateManager', [
      'store',
      'getState',
    ]);
    mockOperationInterpreter = testBed.createMock('IOperationInterpreter', ['execute']);
    mockActionIndex = testBed.createMock('IActionIndex', ['getActionById']);
    mockGameDataRepository = testBed.createMock('IGameDataRepository', [
      'getAllActions',
    ]);

    // Create executor
    executor = new PrimitiveActionStepExecutor({
      parameterResolutionService: mockParameterResolver,
      refinementStateManager: mockStateManager,
      operationInterpreter: mockOperationInterpreter,
      actionIndex: mockActionIndex,
      gameDataRepository: mockGameDataRepository,
      logger: mockLogger,
    });
  });

  describe('Action Resolution', () => {
    it('should resolve action from ActionIndex', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'items:pick_up_item',
        targetBindings: { item: 'task.params.item' },
      };

      const mockAction = {
        id: 'items:pick_up_item',
        operation: { type: 'PICK_UP_ITEM' },
        parameters: { silent: false },
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockParameterResolver.resolve.mockReturnValue('item_123');
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      const context = {
        task: { params: { item: 'item_123' } },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
      };

      // Act
      await executor.execute(step, context, 0);

      // Assert
      expect(mockActionIndex.getActionById).toHaveBeenCalledWith('items:pick_up_item');
    });

    it('should throw StepExecutionError when action not found', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'invalid:action',
        targetBindings: {},
      };

      mockActionIndex.getActionById.mockReturnValue(undefined);
      mockGameDataRepository.getAllActions.mockReturnValue([
        { id: 'items:pick_up_item' },
        { id: 'items:drop_item' },
      ]);

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
      };

      // Act & Assert
      const result = await executor.execute(step, context, 0);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Action not found: invalid:action');
    });

    it('should throw StepExecutionError when action has no operation', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'items:pick_up_item',
        targetBindings: {},
      };

      const mockAction = {
        id: 'items:pick_up_item',
        // No operation field
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
      };

      // Act & Assert
      const result = await executor.execute(step, context, 0);

      expect(result.success).toBe(false);
      expect(result.error).toContain('has no operation defined');
    });
  });

  describe('Target Binding Resolution', () => {
    it('should resolve target bindings from task parameters', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'items:pick_up_item',
        targetBindings: { item: 'task.params.item' },
      };

      const mockAction = {
        id: 'items:pick_up_item',
        operation: { type: 'PICK_UP_ITEM' },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockParameterResolver.resolve.mockReturnValue('item_123');
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      const context = {
        task: { params: { item: 'item_123' } },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
      };

      // Act
      await executor.execute(step, context, 0);

      // Assert
      expect(mockParameterResolver.resolve).toHaveBeenCalledWith(
        'task.params.item',
        context,
        expect.objectContaining({
          validateEntity: true,
          contextType: 'primitive_action',
          stepIndex: 0,
        })
      );
    });

    it('should resolve target bindings from refinement local state', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'items:pick_up_item',
        targetBindings: { item: 'refinement.localState.foundItem.data.itemId' },
      };

      const mockAction = {
        id: 'items:pick_up_item',
        operation: { type: 'PICK_UP_ITEM' },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockParameterResolver.resolve.mockReturnValue('item_456');
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      const context = {
        task: { params: {} },
        refinement: {
          localState: {
            foundItem: { data: { itemId: 'item_456' } },
          },
        },
        actor: { id: 'actor_123' },
      };

      // Act
      await executor.execute(step, context, 0);

      // Assert
      expect(mockParameterResolver.resolve).toHaveBeenCalledWith(
        'refinement.localState.foundItem.data.itemId',
        context,
        expect.objectContaining({
          validateEntity: true,
          contextType: 'primitive_action',
          stepIndex: 0,
        })
      );
    });

    it('should resolve target bindings from actor data', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'items:pick_up_item',
        targetBindings: { item: 'actor.heldItem' },
      };

      const mockAction = {
        id: 'items:pick_up_item',
        operation: { type: 'PICK_UP_ITEM' },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockParameterResolver.resolve.mockReturnValue('item_789');
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123', heldItem: 'item_789' },
      };

      // Act
      await executor.execute(step, context, 0);

      // Assert
      expect(mockParameterResolver.resolve).toHaveBeenCalledWith(
        'actor.heldItem',
        context,
        expect.objectContaining({
          validateEntity: true,
          contextType: 'primitive_action',
          stepIndex: 0,
        })
      );
    });

    it('should handle multiple target bindings', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'items:transfer_item',
        targetBindings: {
          item: 'task.params.item',
          recipient: 'task.params.recipient',
        },
      };

      const mockAction = {
        id: 'items:transfer_item',
        operation: { type: 'TRANSFER_ITEM' },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockParameterResolver.resolve
        .mockReturnValueOnce('item_123')
        .mockReturnValueOnce('actor_456');
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      const context = {
        task: { params: { item: 'item_123', recipient: 'actor_456' } },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
      };

      // Act
      await executor.execute(step, context, 0);

      // Assert
      expect(mockParameterResolver.resolve).toHaveBeenCalledTimes(2);
      expect(mockParameterResolver.resolve).toHaveBeenCalledWith(
        'task.params.item',
        context,
        expect.any(Object)
      );
      expect(mockParameterResolver.resolve).toHaveBeenCalledWith(
        'task.params.recipient',
        context,
        expect.any(Object)
      );
    });

    it('should return failure result when target binding fails', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'items:pick_up_item',
        targetBindings: { item: 'task.params.invalid' },
      };

      const mockAction = {
        id: 'items:pick_up_item',
        operation: { type: 'PICK_UP_ITEM' },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockParameterResolver.resolve.mockImplementation(() => {
        throw new Error('Parameter not found');
      });

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
      };

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to resolve target binding');
    });
  });

  describe('Parameter Merging', () => {
    it('should merge step parameters over action defaults', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'items:pick_up_item',
        targetBindings: { item: 'task.params.item' },
        parameters: { silent: true, force: true },
      };

      const mockAction = {
        id: 'items:pick_up_item',
        operation: { type: 'PICK_UP_ITEM' },
        parameters: { silent: false, validate: true },
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockParameterResolver.resolve.mockReturnValue('item_123');
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      const context = {
        task: { params: { item: 'item_123' } },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
      };

      // Act
      await executor.execute(step, context, 0);

      // Assert
      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        { type: 'PICK_UP_ITEM' },
        expect.objectContaining({
          parameters: {
            silent: true,  // Step override
            validate: true, // Action default
            force: true,    // Step addition
          },
        })
      );
    });

    it('should use action defaults when step has no parameters', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'items:pick_up_item',
        targetBindings: { item: 'task.params.item' },
        // No parameters field
      };

      const mockAction = {
        id: 'items:pick_up_item',
        operation: { type: 'PICK_UP_ITEM' },
        parameters: { silent: false, validate: true },
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockParameterResolver.resolve.mockReturnValue('item_123');
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      const context = {
        task: { params: { item: 'item_123' } },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
      };

      // Act
      await executor.execute(step, context, 0);

      // Assert
      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        { type: 'PICK_UP_ITEM' },
        expect.objectContaining({
          parameters: {
            silent: false,
            validate: true,
          },
        })
      );
    });

    it('should handle empty action parameters', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'items:pick_up_item',
        targetBindings: { item: 'task.params.item' },
        parameters: { silent: true },
      };

      const mockAction = {
        id: 'items:pick_up_item',
        operation: { type: 'PICK_UP_ITEM' },
        // No parameters field
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockParameterResolver.resolve.mockReturnValue('item_123');
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      const context = {
        task: { params: { item: 'item_123' } },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
      };

      // Act
      await executor.execute(step, context, 0);

      // Assert
      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        { type: 'PICK_UP_ITEM' },
        expect.objectContaining({
          parameters: {
            silent: true,
          },
        })
      );
    });
  });

  describe('Operation Execution', () => {
    it('should execute operation via OperationInterpreter', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'items:pick_up_item',
        targetBindings: { item: 'task.params.item' },
        parameters: { silent: true },
      };

      const mockAction = {
        id: 'items:pick_up_item',
        operation: { type: 'PICK_UP_ITEM', parameters: {} },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockParameterResolver.resolve.mockReturnValue('item_123');
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: { itemId: 'item_123' },
      });

      const context = {
        task: { params: { item: 'item_123' } },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
      };

      // Act
      await executor.execute(step, context, 0);

      // Assert
      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        mockAction.operation,
        expect.objectContaining({
          task: context.task,
          refinement: context.refinement,
          actor: context.actor,
          targets: { item: 'item_123' },
          parameters: { silent: true },
          actionId: 'items:pick_up_item',
        })
      );
    });

    it('should build operation context with all required fields', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'items:pick_up_item',
        targetBindings: { item: 'task.params.item' },
      };

      const mockAction = {
        id: 'items:pick_up_item',
        operation: { type: 'PICK_UP_ITEM' },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockParameterResolver.resolve.mockReturnValue('item_123');
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      const context = {
        task: { params: { item: 'item_123' } },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
      };

      // Act
      await executor.execute(step, context, 0);

      // Assert
      const callArgs = mockOperationInterpreter.execute.mock.calls[0][1];
      expect(callArgs).toHaveProperty('task');
      expect(callArgs).toHaveProperty('refinement');
      expect(callArgs).toHaveProperty('actor');
      expect(callArgs).toHaveProperty('targets');
      expect(callArgs).toHaveProperty('parameters');
      expect(callArgs).toHaveProperty('actionId');
    });
  });

  describe('Result Construction and Storage', () => {
    it('should build structured result matching RefinementStateManager requirements', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'items:pick_up_item',
        targetBindings: { item: 'task.params.item' },
      };

      const mockAction = {
        id: 'items:pick_up_item',
        operation: { type: 'PICK_UP_ITEM' },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockParameterResolver.resolve.mockReturnValue('item_123');
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: { itemId: 'item_123', weight: 5 },
      });

      const context = {
        task: { params: { item: 'item_123' } },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
      };

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result.data).toEqual({ itemId: 'item_123', weight: 5 });
      expect(result).toHaveProperty('error', null);
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('actionId', 'items:pick_up_item');
      expect(typeof result.timestamp).toBe('number');
    });

    it('should store result when storeResultAs specified', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'items:pick_up_item',
        targetBindings: { item: 'task.params.item' },
        storeResultAs: 'pickupResult',
      };

      const mockAction = {
        id: 'items:pick_up_item',
        operation: { type: 'PICK_UP_ITEM' },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockParameterResolver.resolve.mockReturnValue('item_123');
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: { itemId: 'item_123' },
      });

      const context = {
        task: { params: { item: 'item_123' } },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
      };

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(mockStateManager.store).toHaveBeenCalledWith('pickupResult', result);
    });

    it('should not store result when storeResultAs not specified', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'items:pick_up_item',
        targetBindings: { item: 'task.params.item' },
        // No storeResultAs
      };

      const mockAction = {
        id: 'items:pick_up_item',
        operation: { type: 'PICK_UP_ITEM' },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockParameterResolver.resolve.mockReturnValue('item_123');
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      const context = {
        task: { params: { item: 'item_123' } },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
      };

      // Act
      await executor.execute(step, context, 0);

      // Assert
      expect(mockStateManager.store).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should return failure result when operation fails', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'items:pick_up_item',
        targetBindings: { item: 'task.params.item' },
      };

      const mockAction = {
        id: 'items:pick_up_item',
        operation: { type: 'PICK_UP_ITEM' },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockParameterResolver.resolve.mockReturnValue('item_123');
      mockOperationInterpreter.execute.mockResolvedValue({
        success: false,
        error: 'Item too heavy',
        data: {},
      });

      const context = {
        task: { params: { item: 'item_123' } },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
      };

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Item too heavy');
    });

    it('should handle operation interpreter throwing errors', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'items:pick_up_item',
        targetBindings: { item: 'task.params.item' },
      };

      const mockAction = {
        id: 'items:pick_up_item',
        operation: { type: 'PICK_UP_ITEM' },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockParameterResolver.resolve.mockReturnValue('item_123');
      mockOperationInterpreter.execute.mockRejectedValue(
        new Error('Operation execution failed')
      );

      const context = {
        task: { params: { item: 'item_123' } },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
      };

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Operation execution failed');
    });

    it('should store failure result when storeResultAs specified', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'items:pick_up_item',
        targetBindings: { item: 'task.params.item' },
        storeResultAs: 'pickupResult',
      };

      const mockAction = {
        id: 'items:pick_up_item',
        operation: { type: 'PICK_UP_ITEM' },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockParameterResolver.resolve.mockReturnValue('item_123');
      mockOperationInterpreter.execute.mockResolvedValue({
        success: false,
        error: 'Item locked',
        data: {},
      });

      const context = {
        task: { params: { item: 'item_123' } },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
      };

      // Act
      await executor.execute(step, context, 0);

      // Assert
      expect(mockStateManager.store).toHaveBeenCalledWith(
        'pickupResult',
        expect.objectContaining({
          success: false,
          error: 'Item locked',
        })
      );
    });
  });

  describe('Logging', () => {
    it('should log execution start and completion', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'items:pick_up_item',
        targetBindings: { item: 'task.params.item' },
      };

      const mockAction = {
        id: 'items:pick_up_item',
        operation: { type: 'PICK_UP_ITEM' },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockParameterResolver.resolve.mockReturnValue('item_123');
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      const context = {
        task: { params: { item: 'item_123' } },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
      };

      // Act
      await executor.execute(step, context, 0);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Executing primitive action step'),
        expect.any(Object)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('completed'),
        expect.any(Object)
      );
    });

    it('should log errors on failure', async () => {
      // Arrange
      const step = {
        stepType: 'primitive_action',
        actionId: 'items:pick_up_item',
        targetBindings: { item: 'task.params.item' },
      };

      const mockAction = {
        id: 'items:pick_up_item',
        operation: { type: 'PICK_UP_ITEM' },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockParameterResolver.resolve.mockReturnValue('item_123');
      mockOperationInterpreter.execute.mockRejectedValue(
        new Error('Operation failed')
      );

      const context = {
        task: { params: { item: 'item_123' } },
        refinement: { localState: {} },
        actor: { id: 'actor_123' },
      };

      // Act
      await executor.execute(step, context, 0);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('failed'),
        expect.any(Error)
      );
    });
  });
});
