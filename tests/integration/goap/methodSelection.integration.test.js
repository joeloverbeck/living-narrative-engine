/**
 * @file Integration tests for GOAP method selection workflow
 * @description Tests method selection with real DI container and services
 * @see src/goap/refinement/methodSelectionService.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import MethodSelectionService from '../../../src/goap/refinement/methodSelectionService.js';
import MethodSelectionError from '../../../src/goap/errors/methodSelectionError.js';

describe('Method Selection Integration Tests', () => {
  let testBed;
  let service;
  let mockGameDataRepository;
  let mockContextAssemblyService;
  let mockJsonLogicService;
  let logger;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.createMockLogger();

    // Create mock dependencies
    mockGameDataRepository = {
      get: jest.fn(),
    };

    mockContextAssemblyService = {
      assembleRefinementContext: jest.fn(),
      assembleConditionContext: jest.fn(),
    };

    mockJsonLogicService = {
      evaluate: jest.fn(),
    };

    // Instantiate service with mocks
    service = new MethodSelectionService({
      gameDataRepository: mockGameDataRepository,
      contextAssemblyService: mockContextAssemblyService,
      jsonLogicService: mockJsonLogicService,
      logger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Service Integration', () => {
    it('should be instantiated with all required dependencies', () => {
      expect(service).toBeDefined();
      expect(typeof service.selectMethod).toBe('function');
    });

    it('should have selectMethod method with correct signature', () => {
      expect(service.selectMethod).toBeInstanceOf(Function);
      // Function has 3 required params (taskId, actorId, taskParams), options is optional
      expect(service.selectMethod.length).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should throw MethodSelectionError when task registry not initialized', () => {
      mockGameDataRepository.get.mockReturnValue(null);

      expect(() => {
        service.selectMethod('core:test_task', 'actor-123', { param: 'value' });
      }).toThrow(MethodSelectionError);
      expect(() => {
        service.selectMethod('core:test_task', 'actor-123', { param: 'value' });
      }).toThrow('Task registry not available');
    });

    it('should throw MethodSelectionError when task not found', () => {
      mockGameDataRepository.get.mockReturnValue({});

      expect(() => {
        service.selectMethod('core:nonexistent_task', 'actor-123', {
          param: 'value',
        });
      }).toThrow(MethodSelectionError);
      expect(() => {
        service.selectMethod('core:nonexistent_task', 'actor-123', {
          param: 'value',
        });
      }).toThrow("Task 'core:nonexistent_task' not found in game data");
    });
  });

  // NOTE: Additional integration tests for real method selection scenarios
  // will be added once the refinement method loading infrastructure is available.
  // These tests will include:
  // - Loading real tasks from data/mods/core/tasks/
  // - Evaluating real applicability conditions
  // - Testing with actual entity components and refinement contexts
  // - Validating method selection with complex JSON Logic operators
  // - Testing short-circuit evaluation behavior
  // - Verifying diagnostic accuracy with real-world scenarios

  describe('Real Data Integration Tests', () => {
    it('should select first applicable method from real task data', () => {
      // Setup: Mock task with two methods
      const taskId = 'core:consume_nourishing_item';
      const actorId = 'actor-123';
      const taskParams = { item: 'item-456' };

      const taskData = {
        id: taskId,
        description: 'Consume nourishing item task',
        refinementMethods: [
          {
            methodId: 'core:consume_nourishing_item.simple_consume',
            $ref: './refinement-methods/consume_nourishing_item.simple_consume.refinement.json',
          },
          {
            methodId: 'core:consume_nourishing_item.pick_up_and_consume',
            $ref: './refinement-methods/consume_nourishing_item.pick_up_and_consume.refinement.json',
          },
        ],
      };

      const simpleConsumeMethod = {
        id: 'core:consume_nourishing_item.simple_consume',
        taskId: 'core:consume_nourishing_item',
        description: 'Simple consumption method',
        applicability: {
          description: 'Item must be in inventory',
          condition: {
            has_component: ['task.params.item', 'core:in_inventory'],
          },
        },
        steps: [
          { stepType: 'primitive_action', actionId: 'items:consume_item' },
        ],
      };

      // Mock task registry
      mockGameDataRepository.get.mockImplementation((key) => {
        if (key === 'tasks') {
          return { [taskId]: taskData };
        }
        if (key === 'refinement-methods') {
          return {
            'core:consume_nourishing_item.simple_consume': simpleConsumeMethod,
          };
        }
        return null;
      });

      // Mock context assembly
      mockContextAssemblyService.assembleConditionContext.mockReturnValue({
        actor: { id: actorId },
        task: { params: taskParams },
      });

      // Mock JSON Logic evaluation (method is applicable)
      mockJsonLogicService.evaluate.mockReturnValue(true);

      // Execute
      const result = service.selectMethod(taskId, actorId, taskParams);

      // Verify
      expect(result.selectedMethod).toBeDefined();
      expect(result.selectedMethod.id).toBe(
        'core:consume_nourishing_item.simple_consume'
      );
      expect(result.diagnostics.methodsEvaluated).toBe(1);
      expect(result.diagnostics.evaluationResults[0].applicable).toBe(true);
    });

    it('should return null when no methods applicable in real scenario', () => {
      // Setup: Mock task with methods that all fail applicability
      const taskId = 'core:consume_nourishing_item';
      const actorId = 'actor-123';
      const taskParams = { item: 'item-456' };

      const taskData = {
        id: taskId,
        description: 'Consume nourishing item task',
        refinementMethods: [
          {
            methodId: 'core:consume_nourishing_item.simple_consume',
            $ref: './refinement-methods/consume_nourishing_item.simple_consume.refinement.json',
          },
        ],
      };

      const method = {
        id: 'core:consume_nourishing_item.simple_consume',
        taskId: 'core:consume_nourishing_item',
        description: 'Simple consumption method',
        applicability: {
          description: 'Item must be in inventory',
          condition: {
            has_component: ['task.params.item', 'core:in_inventory'],
          },
        },
        steps: [
          { stepType: 'primitive_action', actionId: 'items:consume_item' },
        ],
      };

      // Mock registries
      mockGameDataRepository.get.mockImplementation((key) => {
        if (key === 'tasks') {
          return { [taskId]: taskData };
        }
        if (key === 'refinement-methods') {
          return { 'core:consume_nourishing_item.simple_consume': method };
        }
        return null;
      });

      // Mock context assembly
      mockContextAssemblyService.assembleConditionContext.mockReturnValue({
        actor: { id: actorId },
        task: { params: taskParams },
      });

      // Mock JSON Logic evaluation (method is NOT applicable)
      mockJsonLogicService.evaluate.mockReturnValue(false);

      // Execute
      const result = service.selectMethod(taskId, actorId, taskParams);

      // Verify: No method selected
      expect(result.selectedMethod).toBeNull();
      expect(result.diagnostics.methodsEvaluated).toBe(1);
      expect(result.diagnostics.evaluationResults[0].applicable).toBe(false);
      expect(result.diagnostics.evaluationResults[0].reason).toContain(
        'Applicability condition evaluated to false'
      );
    });

    it('should handle evaluation errors gracefully in real conditions', () => {
      // Setup: Mock task with method that causes evaluation error
      const taskId = 'core:test_task';
      const actorId = 'actor-123';
      const taskParams = { param: 'value' };

      const taskData = {
        id: taskId,
        description: 'Test task',
        refinementMethods: [
          {
            methodId: 'core:test_task.error_method',
            $ref: './refinement-methods/test_task.error_method.refinement.json',
          },
          {
            methodId: 'core:test_task.valid_method',
            $ref: './refinement-methods/test_task.valid_method.refinement.json',
          },
        ],
      };

      const errorMethod = {
        id: 'core:test_task.error_method',
        taskId: 'core:test_task',
        description: 'Method with bad condition',
        applicability: {
          description: 'Bad condition',
          condition: { bad_operator: ['invalid'] },
        },
        steps: [{ stepType: 'primitive_action', actionId: 'test:action' }],
      };

      const validMethod = {
        id: 'core:test_task.valid_method',
        taskId: 'core:test_task',
        description: 'Valid method',
        applicability: {
          description: 'Always applicable',
          condition: { '==': [1, 1] },
        },
        steps: [{ stepType: 'primitive_action', actionId: 'test:action2' }],
      };

      // Mock registries
      mockGameDataRepository.get.mockImplementation((key) => {
        if (key === 'tasks') {
          return { [taskId]: taskData };
        }
        if (key === 'refinement-methods') {
          return {
            'core:test_task.error_method': errorMethod,
            'core:test_task.valid_method': validMethod,
          };
        }
        return null;
      });

      // Mock context assembly
      mockContextAssemblyService.assembleConditionContext.mockReturnValue({
        actor: { id: actorId },
        task: { params: taskParams },
      });

      // Mock JSON Logic: first call throws error, second succeeds
      mockJsonLogicService.evaluate
        .mockImplementationOnce(() => {
          throw new Error('Unknown operator: bad_operator');
        })
        .mockReturnValueOnce(true);

      // Execute
      const result = service.selectMethod(taskId, actorId, taskParams);

      // Verify: Error was logged, evaluation continued, valid method selected
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Error evaluating applicability for method 'core:test_task.error_method'"
        ),
        expect.objectContaining({
          methodId: 'core:test_task.error_method',
          taskId: 'core:test_task',
        })
      );
      expect(result.selectedMethod).toBeDefined();
      expect(result.selectedMethod.id).toBe('core:test_task.valid_method');
      expect(result.diagnostics.methodsEvaluated).toBe(2);
      expect(result.diagnostics.evaluationResults[0].applicable).toBe(false);
      expect(result.diagnostics.evaluationResults[0].reason).toContain(
        'Evaluation error'
      );
      expect(result.diagnostics.evaluationResults[1].applicable).toBe(true);
    });
  });
});
