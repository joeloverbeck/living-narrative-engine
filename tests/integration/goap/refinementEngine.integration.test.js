/**
 * @file Integration tests for RefinementEngine
 * Tests complete refinement flows with real services and task examples.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import RefinementEngine from '../../../src/goap/refinement/refinementEngine.js';
import MethodSelectionService from '../../../src/goap/refinement/methodSelectionService.js';
import RefinementStateManager from '../../../src/goap/refinement/refinementStateManager.js';
import PrimitiveActionStepExecutor from '../../../src/goap/refinement/steps/primitiveActionStepExecutor.js';
import ConditionalStepExecutor from '../../../src/goap/refinement/steps/conditionalStepExecutor.js';
import ContextAssemblyService from '../../../src/goap/services/contextAssemblyService.js';
import ParameterResolutionService from '../../../src/goap/services/parameterResolutionService.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('RefinementEngine Integration Tests', () => {
  let testBed;
  let refinementEngine;
  let gameDataRepository;
  let entityManager;
  let eventBus;
  let logger;
  let jsonLogicService;
  let operationInterpreter;
  let actionIndex;

  // Real service instances
  let methodSelectionService;
  let refinementStateManager;
  let primitiveActionStepExecutor;
  let conditionalStepExecutor;
  let contextAssemblyService;
  let parameterResolutionService;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.createMockLogger();

    // Create mock infrastructure services
    gameDataRepository = {
      getTask: jest.fn(),
      getRefinementMethod: jest.fn(),
      getAllActions: jest.fn(), // Required by PrimitiveActionStepExecutor
      get: jest.fn(),
      tasks: {},
      refinementMethods: {},
    };

    // Configure getTask to return from tasks object
    gameDataRepository.getTask.mockImplementation(taskId => {
      return gameDataRepository.tasks[taskId] || null;
    });

    // Configure getRefinementMethod to return from refinementMethods object
    gameDataRepository.getRefinementMethod.mockImplementation(methodRef => {
      return gameDataRepository.refinementMethods[methodRef] || null;
    });

    // Configure getAllActions to return empty array (not used in these tests)
    gameDataRepository.getAllActions.mockReturnValue([]);

    // Configure get method for registry access (used by MethodSelectionService)
    gameDataRepository.get.mockImplementation(key => {
      if (key === 'tasks') {
        return gameDataRepository.tasks;
      }
      if (key === 'refinement-methods') {
        // Note: MethodSelectionService uses 'refinement-methods' with hyphen
        return gameDataRepository.refinementMethods;
      }
      return null;
    });

    entityManager = testBed.createMock('IEntityManager', [
      'createEntity',
      'hasEntity',
      'removeEntity',
      'addComponent',
      'getComponent',
      'hasComponent',
      'getEntities',
      'getEntity', // Required by ParameterResolutionService
    ]);

    eventBus = testBed.createMock('IEventBus', ['dispatch', 'subscribe']);

    // Configure event subscription to work properly
    const subscriptions = [];
    eventBus.subscribe.mockImplementation(callback => {
      subscriptions.push(callback);
      return () => {
        const index = subscriptions.indexOf(callback);
        if (index !== -1) {
          subscriptions.splice(index, 1);
        }
      };
    });

    // Configure dispatch to call all subscribers
    eventBus.dispatch.mockImplementation(event => {
      subscriptions.forEach(callback => callback(event));
    });

    jsonLogicService = testBed.createMock('JsonLogicEvaluationService', [
      'evaluate',
    ]);

    // Helper function to evaluate variable references
    const evalVar = (path, data) => {
      const parts = path.split('.');
      let result = data;
      for (const part of parts) {
        if (result && typeof result === 'object') {
          result = result[part];
        } else {
          return undefined;
        }
      }
      return result;
    };

    // Configure jsonLogicService to evaluate conditions
    jsonLogicService.evaluate.mockImplementation((logic, data) => {
      // Simple evaluation for common patterns
      if (logic['=='] && Array.isArray(logic['=='])) {
        const [left, right] = logic['=='];
        const leftVal = left?.var ? evalVar(left.var, data) : left;
        const rightVal = right?.var ? evalVar(right.var, data) : right;
        return leftVal === rightVal;
      }
      if (logic['<'] && Array.isArray(logic['<'])) {
        const [left, right] = logic['<'];
        const leftVal = left?.var ? evalVar(left.var, data) : left;
        const rightVal = right?.var ? evalVar(right.var, data) : right;
        return leftVal < rightVal;
      }
      return true; // Default to true for unknown patterns
    });

    operationInterpreter = testBed.createMock('OperationInterpreter', [
      'interpret',
      'execute', // Required by PrimitiveActionStepExecutor
    ]);

    // Configure operationInterpreter to return success
    // Note: actionId is added by PrimitiveActionStepExecutor, not by operation result
    operationInterpreter.interpret.mockResolvedValue({
      success: true,
      effects: [],
    });
    operationInterpreter.execute.mockResolvedValue({
      success: true,
      data: {}, // Operation results go in data
      error: null,
    });

    actionIndex = testBed.createMock('ActionIndex', ['getActionById']);

    // Configure actionIndex to return mock action definitions
    actionIndex.getActionById.mockImplementation(actionId => {
      return {
        id: actionId,
        displayName: `Action ${actionId}`,
        operations: [],
      };
    });

    // Mock entity data
    entityManager.hasEntity.mockReturnValue(true);
    entityManager.getEntity.mockImplementation(entityId => {
      if (entityId === 'test_actor_1') {
        return {
          id: 'test_actor_1',
          components: {
            'core:health': { value: 80 },
            'core:inventory': { items: ['test_item_1'], maxItems: 10 },
            'core:position': { locationId: 'test_location_1' },
          },
        };
      }
      return null;
    });
    entityManager.getComponent.mockImplementation((entityId, componentId) => {
      if (entityId === 'test_actor_1') {
        if (componentId === 'core:health') {
          return { value: 80 };
        }
        if (componentId === 'core:inventory') {
          return { items: ['test_item_1'], maxItems: 10 };
        }
        if (componentId === 'core:position') {
          return { locationId: 'test_location_1' };
        }
      }
      return null;
    });

    // Create real GOAP services with mocked dependencies
    parameterResolutionService = new ParameterResolutionService({
      entityManager,
      logger,
    });

    contextAssemblyService = new ContextAssemblyService({
      entityManager,
      logger,
      enableKnowledgeLimitation: false,
    });

    refinementStateManager = new RefinementStateManager({ logger });

    methodSelectionService = new MethodSelectionService({
      gameDataRepository,
      contextAssemblyService,
      jsonLogicService,
      logger,
    });

    // Create mock container for lazy resolution of state manager
    const mockContainer = testBed.createMock('IAppContainer', ['resolve']);
    mockContainer.resolve.mockImplementation((token) => {
      if (token === tokens.IRefinementStateManager) {
        return refinementStateManager;
      }
      throw new Error(`Unexpected token resolution: ${token}`);
    });

    primitiveActionStepExecutor = new PrimitiveActionStepExecutor({
      parameterResolutionService,
      container: mockContainer,
      operationInterpreter,
      actionIndex,
      gameDataRepository,
      logger,
    });

    // Create conditional executor (self-referential)
    // Create placeholder for self-reference
    const conditionalStepExecutorPlaceholder = testBed.createMock(
      'IConditionalStepExecutor',
      ['execute']
    );
    conditionalStepExecutor = new ConditionalStepExecutor({
      contextAssemblyService,
      primitiveActionStepExecutor,
      conditionalStepExecutor: conditionalStepExecutorPlaceholder,
      jsonLogicService,
      logger,
    });
    // Update placeholder to point to real instance for self-reference
    conditionalStepExecutorPlaceholder.execute.mockImplementation((...args) =>
      conditionalStepExecutor.execute(...args)
    );

    // Create RefinementEngine with real services
    refinementEngine = new RefinementEngine({
      methodSelectionService,
      container: mockContainer,
      primitiveActionStepExecutor,
      conditionalStepExecutor,
      contextAssemblyService,
      gameDataRepository,
      eventBus,
      logger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Real Task Refinement', () => {
    it('should successfully refine a task with real task definition', async () => {
      // Arrange - Load real task from repository
      const taskId = 'core:consume_nourishing_item';

      // Mock task definition (in real scenario, this would be loaded from mods)
      gameDataRepository.tasks = gameDataRepository.tasks || {};
      gameDataRepository.tasks[taskId] = {
        id: taskId,
        description: 'Consume a nourishing item to restore health',
        fallbackBehavior: 'replan',
        refinementMethods: [
          {
            methodId: 'simple_consume',
            methodRef: 'consume_nourishing_item.simple_consume',
          },
        ],
      };

      // Mock refinement method
      // Note: Registry is keyed by methodId, not methodRef
      gameDataRepository.refinementMethods =
        gameDataRepository.refinementMethods || {};
      gameDataRepository.refinementMethods['simple_consume'] = {
        id: 'consume_nourishing_item.simple_consume',
        taskId,
        description: 'Simple consumption from inventory',
        applicability: { '==': [1, 1] }, // Always applicable
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'items:consume_item',
            parameters: {
              item: { var: 'task.params.item' },
            },
          },
        ],
      };

      const eventsSeen = [];
      const unsubscribe = eventBus.subscribe(event => {
        if (event.type.startsWith('GOAP_')) {
          eventsSeen.push(event.type);
        }
      });

      try {
        // Act
        const result = await refinementEngine.refine(taskId, 'test_actor_1', {
          item: 'test_item_1',
        });

        // Assert
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.taskId).toBe(taskId);
        expect(result.actorId).toBe('test_actor_1');
        expect(result.methodId).toBe('consume_nourishing_item.simple_consume');
        expect(result.stepResults).toHaveLength(1);

        // Verify events were dispatched
        expect(eventsSeen).toContain('GOAP_REFINEMENT_STARTED');
        expect(eventsSeen).toContain('GOAP_METHOD_SELECTED');
        expect(eventsSeen).toContain('GOAP_STEP_EXECUTED');
        expect(eventsSeen).toContain('GOAP_REFINEMENT_COMPLETED');
      } finally {
        unsubscribe();
      }
    });

    it('should handle conditional branching in refinement', async () => {
      // Arrange
      const taskId = 'core:test_conditional_task';

      gameDataRepository.tasks = gameDataRepository.tasks || {};
      gameDataRepository.tasks[taskId] = {
        id: taskId,
        description: 'Test conditional task',
        fallbackBehavior: 'fail',
        refinementMethods: [
          {
            methodId: 'conditional_method',
            methodRef: 'test.conditional_method',
          },
        ],
      };

      gameDataRepository.refinementMethods =
        gameDataRepository.refinementMethods || {};
      // Note: Registry keyed by methodId
      gameDataRepository.refinementMethods['conditional_method'] = {
        id: 'test.conditional_method',
        taskId,
        description: 'Method with conditional logic',
        applicability: { '==': [1, 1] },
        steps: [
          {
            stepType: 'conditional',
            condition: {
              '<': [{ var: 'actor.components.core:health.value' }, 50],
            },
            thenSteps: [
              {
                stepType: 'primitive_action',
                actionId: 'items:consume_item',
                parameters: {
                  item: { var: 'task.params.item' },
                },
              },
            ],
            elseSteps: [],
            onFailure: 'skip',
          },
        ],
      };

      // Act - Actor has 80 health, so condition should be false
      const result = await refinementEngine.refine(taskId, 'test_actor_1', {
        item: 'test_item_1',
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.stepResults).toHaveLength(1);
      expect(result.stepResults[0].stepType).toBe('conditional');
    });
  });

  describe('Method Selection with Applicability', () => {
    it('should select applicable method based on condition', async () => {
      // Arrange
      const taskId = 'core:test_method_selection';

      gameDataRepository.tasks = gameDataRepository.tasks || {};
      gameDataRepository.tasks[taskId] = {
        id: taskId,
        description: 'Test method selection',
        fallbackBehavior: 'replan',
        refinementMethods: [
          {
            methodId: 'method_1',
            methodRef: 'test.method_1',
          },
          {
            methodId: 'method_2',
            methodRef: 'test.method_2',
          },
        ],
      };

      gameDataRepository.refinementMethods =
        gameDataRepository.refinementMethods || {};

      // Method 1: Only applicable if health < 50
      // Note: Registry keyed by methodId
      gameDataRepository.refinementMethods['method_1'] = {
        id: 'test.method_1',
        taskId,
        description: 'Low health method',
        applicability: {
          condition: {
            '<': [{ var: 'actor.components.core:health.value' }, 50],
          },
        },
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'items:consume_item',
            parameters: { item: { var: 'task.params.item' } },
          },
        ],
      };

      // Method 2: Always applicable
      gameDataRepository.refinementMethods['method_2'] = {
        id: 'test.method_2',
        taskId,
        description: 'General method',
        applicability: {
          condition: { '==': [1, 1] },
        },
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'items:consume_item',
            parameters: { item: { var: 'task.params.item' } },
          },
        ],
      };

      // Act - Actor has 80 health, so method 1 should not be applicable
      const result = await refinementEngine.refine(taskId, 'test_actor_1', {
        item: 'test_item_1',
      });

      // Assert - Method 2 should be selected
      expect(result.success).toBe(true);
      expect(result.methodId).toBe('test.method_2');
    });

    it('should handle no applicable methods with replan fallback', async () => {
      // Arrange
      const taskId = 'core:test_no_methods';

      gameDataRepository.tasks = gameDataRepository.tasks || {};
      gameDataRepository.tasks[taskId] = {
        id: taskId,
        description: 'Test no applicable methods',
        fallbackBehavior: 'replan',
        refinementMethods: [
          {
            methodId: 'impossible_method',
            methodRef: 'test.impossible_method',
          },
        ],
      };

      gameDataRepository.refinementMethods =
        gameDataRepository.refinementMethods || {};
      // Note: Registry keyed by methodId
      gameDataRepository.refinementMethods['impossible_method'] = {
        id: 'test.impossible_method',
        taskId,
        description: 'Never applicable',
        applicability: {
          condition: { '==': [1, 0] }, // Always false
        },
        steps: [],
      };

      // Act
      const result = await refinementEngine.refine(taskId, 'test_actor_1', {});

      // Assert
      expect(result.success).toBe(false);
      expect(result.replan).toBe(true);
      expect(result.reason).toBe('no_applicable_method');
    });
  });

  describe('State Accumulation Across Steps', () => {
    it('should accumulate state across multiple steps', async () => {
      // Arrange
      const taskId = 'core:test_state_accumulation';

      gameDataRepository.tasks = gameDataRepository.tasks || {};
      gameDataRepository.tasks[taskId] = {
        id: taskId,
        description: 'Test state accumulation',
        fallbackBehavior: 'fail',
        refinementMethods: [
          {
            methodId: 'multi_step',
            methodRef: 'test.multi_step',
          },
        ],
      };

      gameDataRepository.refinementMethods =
        gameDataRepository.refinementMethods || {};
      // Note: Registry keyed by methodId
      gameDataRepository.refinementMethods['multi_step'] = {
        id: 'test.multi_step',
        taskId,
        description: 'Multiple steps with state',
        applicability: {
          condition: { '==': [1, 1] },
        },
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'items:consume_item', // Note: actionId not actionRef
            parameters: { item: { var: 'task.params.item' } },
            storeResultAs: 'consumption_result',
          },
          {
            stepType: 'primitive_action',
            actionId: 'items:consume_item', // Note: actionId not actionRef
            parameters: { item: { var: 'task.params.item' } },
          },
        ],
      };

      // Act
      const result = await refinementEngine.refine(taskId, 'test_actor_1', {
        item: 'test_item_1',
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.stepResults).toHaveLength(2);

      // Both steps should have executed
      expect(result.stepResults[0].actionId).toBe('items:consume_item');
      expect(result.stepResults[1].actionId).toBe('items:consume_item');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle step execution failures gracefully', async () => {
      // Arrange
      const taskId = 'core:test_step_failure';

      gameDataRepository.tasks = gameDataRepository.tasks || {};
      gameDataRepository.tasks[taskId] = {
        id: taskId,
        description: 'Test step failure',
        fallbackBehavior: 'continue',
        refinementMethods: [
          {
            methodId: 'failing_method',
            methodRef: 'test.failing_method',
          },
        ],
      };

      gameDataRepository.refinementMethods =
        gameDataRepository.refinementMethods || {};
      // Note: Registry keyed by methodId
      gameDataRepository.refinementMethods['failing_method'] = {
        id: 'test.failing_method',
        taskId,
        description: 'Method with potential failures',
        applicability: { '==': [1, 1] },
        steps: [
          {
            stepType: 'conditional',
            condition: { '==': [1, 0] }, // Always false
            thenSteps: [],
            elseSteps: [],
            onFailure: 'skip',
          },
        ],
      };

      // Act
      const result = await refinementEngine.refine(taskId, 'test_actor_1', {});

      // Assert - Should complete despite conditional being false
      expect(result.success).toBe(true);
      expect(result.stepResults).toHaveLength(1);
    });
  });

  describe('Event Dispatching Integration', () => {
    it('should dispatch all lifecycle events in correct order', async () => {
      // Arrange
      const taskId = 'core:test_events';
      const eventsReceived = [];

      gameDataRepository.tasks = gameDataRepository.tasks || {};
      gameDataRepository.tasks[taskId] = {
        id: taskId,
        description: 'Test events',
        fallbackBehavior: 'fail',
        refinementMethods: [
          {
            methodId: 'simple_method',
            methodRef: 'test.simple_method',
          },
        ],
      };

      gameDataRepository.refinementMethods =
        gameDataRepository.refinementMethods || {};
      // Note: Registry keyed by methodId
      gameDataRepository.refinementMethods['simple_method'] = {
        id: 'test.simple_method',
        taskId,
        description: 'Simple method',
        applicability: { '==': [1, 1] },
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'items:consume_item',
            parameters: { item: { var: 'task.params.item' } },
          },
        ],
      };

      const unsubscribe = eventBus.subscribe(event => {
        if (event.type.startsWith('GOAP_')) {
          eventsReceived.push({
            type: event.type,
            payload: event.payload,
          });
        }
      });

      try {
        // Act
        await refinementEngine.refine(taskId, 'test_actor_1', {
          item: 'test_item_1',
        });

        // Assert
        expect(eventsReceived.length).toBeGreaterThanOrEqual(4);

        const eventTypes = eventsReceived.map(e => e.type);
        expect(eventTypes[0]).toBe('GOAP_REFINEMENT_STARTED');
        expect(eventTypes[1]).toBe('GOAP_METHOD_SELECTED');
        expect(eventTypes[2]).toBe('GOAP_STEP_EXECUTED');
        expect(eventTypes[3]).toBe('GOAP_REFINEMENT_COMPLETED');

        // Verify event payloads contain expected data
        const startedEvent = eventsReceived[0];
        expect(startedEvent.payload.taskId).toBe(taskId);
        expect(startedEvent.payload.actorId).toBe('test_actor_1');

        const methodEvent = eventsReceived[1];
        expect(methodEvent.payload.methodId).toBe('test.simple_method');

        const stepEvent = eventsReceived[2];
        expect(stepEvent.payload.stepIndex).toBe(0);
        expect(stepEvent.payload.stepType).toBe('primitive_action');

        const completedEvent = eventsReceived[3];
        expect(completedEvent.payload.success).toBe(true);
      } finally {
        unsubscribe();
      }
    });
  });
});
