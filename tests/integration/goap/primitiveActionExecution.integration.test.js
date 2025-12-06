/**
 * @file Integration tests for primitive action execution in GOAP system
 * Tests the full integration between PrimitiveActionStepExecutor and its real dependencies
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import PrimitiveActionStepExecutor from '../../../src/goap/refinement/steps/primitiveActionStepExecutor.js';
import ParameterResolutionService from '../../../src/goap/services/parameterResolutionService.js';
import RefinementStateManager from '../../../src/goap/refinement/refinementStateManager.js';
import { createTestBed } from '../../common/testBed.js';
import { coreTokens as tokens } from '../../../src/dependencyInjection/tokens/tokens-core.js';

describe('Primitive Action Execution - Integration', () => {
  let testBed;
  let executor;
  let parameterResolutionService;
  let mockContainer;
  let mockOperationInterpreter;
  let mockActionIndex;
  let mockGameDataRepository;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    // Create real services for integration testing
    mockEntityManager = testBed.createMock('IEntityManager', [
      'getEntity',
      'hasEntity',
      'createEntity',
      'addComponent',
    ]);

    // Real ParameterResolutionService
    parameterResolutionService = new ParameterResolutionService({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    // Mock container for lazy resolution of transient RefinementStateManager
    mockContainer = testBed.createMock('IAppContainer', ['resolve']);
    mockContainer.resolve.mockImplementation((token) => {
      if (token === tokens.IRefinementStateManager) {
        // Return fresh RefinementStateManager instance for each call
        return new RefinementStateManager({ logger: mockLogger });
      }
      throw new Error(`Unexpected token resolution: ${token}`);
    });

    // Mock other dependencies
    mockOperationInterpreter = testBed.createMock('IOperationInterpreter', [
      'execute',
    ]);
    mockActionIndex = testBed.createMock('IActionIndex', ['getActionById']);
    mockGameDataRepository = testBed.createMock('IGameDataRepository', [
      'getAllActions',
    ]);

    // Create executor with mix of real and mock dependencies
    executor = new PrimitiveActionStepExecutor({
      parameterResolutionService,
      container: mockContainer,
      operationInterpreter: mockOperationInterpreter,
      actionIndex: mockActionIndex,
      gameDataRepository: mockGameDataRepository,
      logger: mockLogger,
    });
  });

  describe('Real Parameter Resolution Integration', () => {
    it('should resolve parameters using real ParameterResolutionService', async () => {
      // Arrange
      const actorId = 'actor_123';
      const itemId = 'item_456';

      // Mock entity manager responses
      mockEntityManager.hasEntity.mockReturnValue(true);

      const mockAction = {
        id: 'test:simple_action',
        operation: { type: 'LOG', parameters: { message: 'test' } },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      const context = {
        task: { params: { targetItem: itemId } },
        refinement: { localState: {} },
        actor: { id: actorId },
      };

      const step = {
        stepType: 'primitive_action',
        actionId: 'test:simple_action',
        targetBindings: { item: 'task.params.targetItem' },
      };

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert - Verify real parameter resolution was used
      expect(result.success).toBe(true);
      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          targets: { item: itemId }, // Resolved by real service
        })
      );
    });

    it('should resolve targets from task parameters', async () => {
      // Arrange
      const actorId = 'actor_123';
      const itemId = 'item_456';

      // Mock entity existence
      mockEntityManager.hasEntity.mockReturnValue(true);

      const mockAction = {
        id: 'test:simple_action',
        operation: { type: 'LOG', parameters: { message: 'test' } },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      const context = {
        task: { params: { targetItem: itemId } },
        refinement: { localState: {} },
        actor: { id: actorId },
      };

      const step = {
        stepType: 'primitive_action',
        actionId: 'test:simple_action',
        targetBindings: { item: 'task.params.targetItem' },
      };

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(result.success).toBe(true);
      expect(result.actionId).toBe('test:simple_action');
    });

    it('should merge parameters correctly', async () => {
      // Arrange
      const actorId = 'actor_123';

      const mockAction = {
        id: 'test:parameterized_action',
        operation: {
          type: 'LOG',
          parameters: { message: { var: 'parameters.message' } },
        },
        parameters: { message: 'Default message', level: 'info' },
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: actorId },
      };

      const step = {
        stepType: 'primitive_action',
        actionId: 'test:parameterized_action',
        targetBindings: {},
        parameters: { message: 'Custom message' },
      };

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(result.success).toBe(true);
      expect(result.actionId).toBe('test:parameterized_action');
      // Verify merged parameters were passed to operation interpreter
      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          parameters: { message: 'Custom message', level: 'info' },
        })
      );
    });

    it('should store results in refinement state when storeResultAs specified', async () => {
      // Arrange
      const actorId = 'actor_123';
      let capturedStateManager;

      const mockAction = {
        id: 'test:storable_action',
        operation: { type: 'LOG', parameters: { message: 'test' } },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: { result: 'stored' },
      });

      // Capture the state manager instance that will be used
      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.IRefinementStateManager) {
          capturedStateManager = new RefinementStateManager({
            logger: mockLogger,
          });
          capturedStateManager.initialize({});
          return capturedStateManager;
        }
        throw new Error(`Unexpected token resolution: ${token}`);
      });

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: actorId },
      };

      const step = {
        stepType: 'primitive_action',
        actionId: 'test:storable_action',
        targetBindings: {},
        storeResultAs: 'actionResult',
      };

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(result.success).toBe(true);
      const state = capturedStateManager.getState();
      expect(state).toHaveProperty('actionResult');
      expect(state.actionResult).toEqual(result);
    });
  });

  describe('Error Handling', () => {
    it('should return failure result for non-existent action', async () => {
      // Arrange
      const actorId = 'actor_123';

      mockActionIndex.getActionById.mockReturnValue(null);
      mockGameDataRepository.getAllActions.mockReturnValue([]);

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: actorId },
      };

      const step = {
        stepType: 'primitive_action',
        actionId: 'nonexistent:action',
        targetBindings: {},
      };

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Action not found');
    });

    it('should return failure result when target binding fails', async () => {
      // Arrange
      const actorId = 'actor_123';

      const mockAction = {
        id: 'test:action_with_target',
        operation: { type: 'LOG', parameters: { message: 'test' } },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);

      const context = {
        task: { params: {} }, // No item parameter
        refinement: { localState: {} },
        actor: { id: actorId },
      };

      const step = {
        stepType: 'primitive_action',
        actionId: 'test:action_with_target',
        targetBindings: {
          item: 'task.params.nonexistent', // This will fail
        },
      };

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to resolve target binding');
    });

    it('should store failure results when storeResultAs specified', async () => {
      // Arrange
      const actorId = 'actor_123';
      let capturedStateManager;

      mockActionIndex.getActionById.mockReturnValue(null);
      mockGameDataRepository.getAllActions.mockReturnValue([]);

      // Capture the state manager instance that will be used
      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.IRefinementStateManager) {
          capturedStateManager = new RefinementStateManager({
            logger: mockLogger,
          });
          capturedStateManager.initialize({});
          return capturedStateManager;
        }
        throw new Error(`Unexpected token resolution: ${token}`);
      });

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: { id: actorId },
      };

      const step = {
        stepType: 'primitive_action',
        actionId: 'nonexistent:action',
        targetBindings: {},
        storeResultAs: 'failedAction',
      };

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(result.success).toBe(false);
      const state = capturedStateManager.getState();
      expect(state).toHaveProperty('failedAction');
      expect(state.failedAction.success).toBe(false);
    });
  });

  describe('End-to-End Workflow', () => {
    it('should execute complete workflow with real refinement state', async () => {
      // Arrange
      const actorId = 'actor_123';
      const item1Id = 'item_1';
      const item2Id = 'item_2';
      let sharedStateManager;

      // Mock actions for workflow
      const mockAction1 = {
        id: 'test:log_action',
        operation: {
          type: 'LOG',
          parameters: { message: 'Starting workflow' },
        },
        parameters: {},
      };

      const mockAction2 = {
        id: 'test:set_variable',
        operation: {
          type: 'SET_VARIABLE',
          parameters: { key: 'workflowStep', value: 'completed' },
        },
        parameters: {},
      };

      // Use a shared state manager for this workflow test
      // (in real usage, each step would get fresh instance, but for this E2E test
      // we want to verify state accumulation across multiple steps)
      sharedStateManager = new RefinementStateManager({ logger: mockLogger });
      sharedStateManager.initialize({});

      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.IRefinementStateManager) {
          return sharedStateManager;
        }
        throw new Error(`Unexpected token resolution: ${token}`);
      });

      const context = {
        task: { params: { item1: item1Id, item2: item2Id } },
        refinement: { localState: {} },
        actor: { id: actorId },
      };

      // Step 1: Log action
      const step1 = {
        stepType: 'primitive_action',
        actionId: 'test:log_action',
        targetBindings: {},
        storeResultAs: 'logResult',
      };

      // Step 2: Set variable
      const step2 = {
        stepType: 'primitive_action',
        actionId: 'test:set_variable',
        targetBindings: {},
        storeResultAs: 'varResult',
      };

      // Mock action index responses
      mockActionIndex.getActionById.mockImplementation((id) => {
        if (id === 'test:log_action') return mockAction1;
        if (id === 'test:set_variable') return mockAction2;
        return null;
      });

      // Mock operation interpreter responses
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: {},
      });

      // Act - Execute steps sequentially
      const result1 = await executor.execute(step1, context, 0);
      const result2 = await executor.execute(step2, context, 1);

      // Assert - Verify both steps succeeded
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Verify refinement state was updated
      const finalState = sharedStateManager.getState();
      expect(finalState).toHaveProperty('logResult');
      expect(finalState).toHaveProperty('varResult');
      expect(finalState.logResult.actionId).toBe('test:log_action');
      expect(finalState.varResult.actionId).toBe('test:set_variable');
    });
  });

  describe('Target Resolution from Different Sources', () => {
    it('should resolve targets from refinement local state', async () => {
      // Arrange
      const actorId = 'actor_123';
      const itemId = 'item_from_state';

      const mockAction = {
        id: 'test:action_from_state',
        operation: { type: 'LOG', parameters: { message: 'test' } },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: {},
      });
      mockEntityManager.hasEntity.mockReturnValue(true);

      // Create a state manager with previous result
      const stateManager = new RefinementStateManager({ logger: mockLogger });
      stateManager.initialize({});
      stateManager.store('previousResult', {
        success: true,
        data: { foundItemId: itemId },
        error: null,
        timestamp: Date.now(),
        actionId: 'previous:action',
      });

      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.IRefinementStateManager) {
          return stateManager;
        }
        throw new Error(`Unexpected token resolution: ${token}`);
      });

      const context = {
        task: { params: {} },
        refinement: { localState: stateManager.getState() },
        actor: { id: actorId },
      };

      const step = {
        stepType: 'primitive_action',
        actionId: 'test:action_from_state',
        targetBindings: {
          item: 'refinement.localState.previousResult.data.foundItemId',
        },
      };

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(result.success).toBe(true);
      expect(result.actionId).toBe('test:action_from_state');
      // Verify item was resolved from refinement state
      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          targets: { item: itemId },
        })
      );
    });

    it('should resolve targets from actor data', async () => {
      // Arrange
      const actorId = 'actor_123';
      const heldItemId = 'held_item_456';

      const mockAction = {
        id: 'test:action_from_actor',
        operation: { type: 'LOG', parameters: { message: 'test' } },
        parameters: {},
      };

      mockActionIndex.getActionById.mockReturnValue(mockAction);
      mockOperationInterpreter.execute.mockResolvedValue({
        success: true,
        data: {},
      });
      mockEntityManager.hasEntity.mockReturnValue(true);

      const actorData = {
        id: actorId,
        components: {
          'core:actor': {
            name: 'Test Actor',
            heldItem: heldItemId,
          },
        },
      };

      const context = {
        task: { params: {} },
        refinement: { localState: {} },
        actor: actorData,
      };

      const step = {
        stepType: 'primitive_action',
        actionId: 'test:action_from_actor',
        targetBindings: {
          item: 'actor.components.core:actor.heldItem',
        },
      };

      // Act
      const result = await executor.execute(step, context, 0);

      // Assert
      expect(result.success).toBe(true);
      expect(result.actionId).toBe('test:action_from_actor');
      // Verify item was resolved from actor data
      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          targets: { item: heldItemId },
        })
      );
    });
  });
});
