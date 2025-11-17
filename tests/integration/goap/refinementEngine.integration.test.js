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
import { createEventBusMock } from '../../common/mocks/createEventBusMock.js';

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

    eventBus = createEventBusMock();

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
        operation: { type: 'NOOP' }, // Required for primitive action executor
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

  describe('Event bus contract', () => {
    it('rejects the legacy dispatch signature', async () => {
      await expect(
        eventBus.dispatch({ type: 'goap:legacy_event', payload: {} })
      ).rejects.toThrow(/legacy single-object signature/i);
      expect(eventBus.getEvents()).toHaveLength(0);
    });
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
      const eventsSeen = eventBus
        .getEvents()
        .filter(event => event.type.startsWith('goap:'))
        .map(event => event.type);

      expect(eventsSeen).toContain('goap:refinement_started');
      expect(eventsSeen).toContain('goap:method_selected');
      expect(eventsSeen).toContain('goap:refinement_step_completed');
      expect(eventsSeen).toContain('goap:refinement_completed');
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

      // Act
      await refinementEngine.refine(taskId, 'test_actor_1', {
        item: 'test_item_1',
      });

      // Assert
      const eventsReceived = eventBus
        .getEvents()
        .filter(event => event.type.startsWith('goap:'))
        .map(event => ({ type: event.type, payload: event.payload }));

      expect(eventsReceived.length).toBeGreaterThanOrEqual(5);

      const eventTypes = eventsReceived.map(e => e.type);
      expect(eventTypes[0]).toBe('goap:refinement_started');
      expect(eventTypes[1]).toBe('goap:method_selected');
      expect(eventTypes[2]).toBe('goap:refinement_step_started');
      expect(eventTypes[3]).toBe('goap:refinement_step_completed');
      expect(eventTypes[4]).toBe('goap:refinement_completed');

      // Verify event payloads contain expected data
      const startedEvent = eventsReceived[0];
      expect(startedEvent.payload.taskId).toBe(taskId);
      expect(startedEvent.payload.actorId).toBe('test_actor_1');

      const methodEvent = eventsReceived[1];
      expect(methodEvent.payload.methodId).toBe('test.simple_method');

      const stepEvent = eventsReceived[2];
      expect(stepEvent.payload.stepIndex).toBe(0);
      expect(stepEvent.payload.step.stepType).toBe('primitive_action');

      const stepCompletedEvent = eventsReceived[3];
      expect(stepCompletedEvent.payload.result.success).toBe(true);
    });
  });

  describe('Step-level event dispatching', () => {
    it('should dispatch step events during full refinement', async () => {
      // Arrange

      // Create test task and method
      const testTask = {
        id: 'test.step_events_task',
        name: 'Step Events Test Task',
        params: [],
        fallbackBehavior: 'fail',
        refinementMethods: [
          {
            methodId: 'test.step_events_method',
            methodRef: 'test.step_events_method',
          },
        ],
      };

      const testMethod = {
        id: 'test.step_events_method',
        name: 'Step Events Method',
        taskId: 'test.step_events_task',
        structuralGates: [],
        planningPreconditions: [],
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'core:test_action',
            storeResultAs: 'step1',
          },
          {
            stepType: 'primitive_action',
            actionId: 'core:test_action_2',
          },
        ],
      };

      gameDataRepository.tasks[testTask.id] = testTask;
      gameDataRepository.refinementMethods = {
        [testMethod.id]: testMethod,
      };
      gameDataRepository.getTask.mockReturnValue(testTask);
      gameDataRepository.getRefinementMethod.mockReturnValue(testMethod);

      // Mock action index to return actions with operation
      actionIndex.getActionById.mockImplementation((actionId) => ({
        id: actionId,
        name: `Test Action ${actionId}`,
        targets: [],
        operation: { type: 'NOOP' }, // Required for primitive action executor
      }));

      // Act
      await refinementEngine.refine('test.step_events_task', 'test_actor_1', {});

      // Assert: Verify step events were dispatched
      const eventLog = eventBus.getEvents();
      const startedEvents = eventLog.filter(
        (e) => e.type === 'goap:refinement_step_started'
      );
      const completedEvents = eventLog.filter(
        (e) => e.type === 'goap:refinement_step_completed'
      );
      const stateUpdatedEvents = eventLog.filter(
        (e) => e.type === 'goap:refinement_state_updated'
      );

      // Should have 2 steps
      expect(startedEvents).toHaveLength(2);
      expect(completedEvents).toHaveLength(2);

      // First step has storeResultAs, so should have 1 state update event
      expect(stateUpdatedEvents).toHaveLength(1);
      expect(stateUpdatedEvents[0].payload.key).toBe('step1');

      // Verify event ordering (started before completed for each step)
      for (let i = 0; i < startedEvents.length; i++) {
        const startedIndex = eventLog.indexOf(startedEvents[i]);
        const completedIndex = eventLog.indexOf(completedEvents[i]);
        expect(startedIndex).toBeLessThan(completedIndex);
      }

      // Verify step 0 and step 1 are correctly indexed
      expect(startedEvents[0].payload.stepIndex).toBe(0);
      expect(startedEvents[1].payload.stepIndex).toBe(1);
      expect(completedEvents[0].payload.stepIndex).toBe(0);
      expect(completedEvents[1].payload.stepIndex).toBe(1);

      // Verify step details are included
      expect(startedEvents[0].payload.step).toMatchObject({
        stepType: 'primitive_action',
        actionId: 'core:test_action',
        storeResultAs: 'step1',
      });

      expect(startedEvents[1].payload.step).toMatchObject({
        stepType: 'primitive_action',
        actionId: 'core:test_action_2',
      });
    });

    it('should handle graceful step failure without throwing', async () => {
      // Arrange
      const testTask = {
        id: 'test.graceful_failure_task',
        name: 'Graceful Failure Task',
        params: [],
        fallbackBehavior: 'fail',
        refinementMethods: [
          {
            methodId: 'test.graceful_failure_method',
            methodRef: 'test.graceful_failure_method',
          },
        ],
      };

      const testMethod = {
        id: 'test.graceful_failure_method',
        name: 'Graceful Failure Method',
        taskId: 'test.graceful_failure_task',
        structuralGates: [],
        planningPreconditions: [],
        steps: [
          {
            stepType: 'primitive_action',
            actionId: 'core:failing_action',
          },
        ],
      };

      gameDataRepository.tasks[testTask.id] = testTask;
      gameDataRepository.refinementMethods = {
        [testMethod.id]: testMethod,
      };
      gameDataRepository.getTask.mockReturnValue(testTask);
      gameDataRepository.getRefinementMethod.mockReturnValue(testMethod);

      // Make action index work normally
      actionIndex.getActionById.mockReturnValue({
        id: 'core:failing_action',
        name: 'Failing Action',
        targets: [],
        operation: { type: 'NOOP' },
      });

      // Make operation fail gracefully (not throw)
      operationInterpreter.execute.mockResolvedValue({
        success: false,
        data: {},
        error: 'Operation failed gracefully',
      });

      // Act - Refinement completes even though step failed
      const result = await refinementEngine.refine('test.graceful_failure_task', 'test_actor_1', {});

      // Assert - Refinement itself succeeds
      expect(result.success).toBe(true);
      expect(result.stepResults).toHaveLength(1);
      expect(result.stepResults[0].success).toBe(false);

      // Verify step started event was dispatched
      const eventLog = eventBus.getEvents();
      const startedEvents = eventLog.filter(
        (e) => e.type === 'goap:refinement_step_started'
      );
      expect(startedEvents).toHaveLength(1);

      // Verify step completed event was dispatched (even for graceful failure)
      const completedEvents = eventLog.filter(
        (e) => e.type === 'goap:refinement_step_completed'
      );
      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0].payload.result.success).toBe(false);

      // Verify NO step failed event (graceful failures don't trigger STEP_FAILED event)
      const failedEvents = eventLog.filter(
        (e) => e.type === 'goap:refinement_step_failed'
      );
      expect(failedEvents).toHaveLength(0);
    });
  });
});
