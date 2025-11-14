/**
 * @file Unit tests for MethodSelectionService
 * @see src/goap/refinement/methodSelectionService.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MethodSelectionService from '../../../../src/goap/refinement/methodSelectionService.js';
import MethodSelectionError from '../../../../src/goap/errors/methodSelectionError.js';

describe('MethodSelectionService', () => {
  let service;
  let mockGameDataRepository;
  let mockContextAssemblyService;
  let mockJsonLogicService;
  let mockLogger;

  const TEST_TASK_ID = 'core:consume_nourishing_item';
  const TEST_ACTOR_ID = 'actor-123';
  const TEST_TASK_PARAMS = { item: 'item-456' };

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create mock game data repository
    mockGameDataRepository = {
      get: jest.fn(),
    };

    // Create mock context assembly service
    mockContextAssemblyService = {
      assembleRefinementContext: jest.fn(),
      assembleConditionContext: jest.fn(),
    };

    // Create mock JSON Logic service
    mockJsonLogicService = {
      evaluate: jest.fn(),
    };

    // Create service instance
    service = new MethodSelectionService({
      gameDataRepository: mockGameDataRepository,
      contextAssemblyService: mockContextAssemblyService,
      jsonLogicService: mockJsonLogicService,
      logger: mockLogger,
    });
  });

  /**
   * Helper factory for creating refinement method definitions with sane defaults.
   *
   * @param {object} overrides - Overrides for the default method shape
   * @returns {object} Refinement method definition
   */
  const createMethod = (overrides = {}) => ({
    id: overrides.id || 'core:test_method',
    taskId: overrides.taskId || TEST_TASK_ID,
    applicability:
      Object.prototype.hasOwnProperty.call(overrides, 'applicability')
        ? overrides.applicability
        : { condition: { var: 'canExecute' } },
    steps: overrides.steps || [{ type: 'test-step' }],
  });

  /**
   * Configures the mocked repository to return the provided task + method registry.
   *
   * @param {...object} methods - Refinement method definitions to register
   */
  const setupTaskWithMethods = (...methods) => {
    const task = {
      id: TEST_TASK_ID,
      refinementMethods: methods.map((method) => ({
        methodId: method.id,
        $ref: `ref://${method.id}.json`,
      })),
    };

    const registry = methods.reduce((acc, method) => {
      acc[method.id] = method;
      return acc;
    }, {});

    mockGameDataRepository.get.mockImplementation((key) => {
      if (key === 'tasks') {
        return { [TEST_TASK_ID]: task };
      }
      if (key === 'refinement-methods') {
        return registry;
      }
      return undefined;
    });

    return { task, registry };
  };

  describe('constructor', () => {
    it('should create service with required dependencies', () => {
      expect(service).toBeInstanceOf(MethodSelectionService);
    });

    it('should throw error if gameDataRepository is missing', () => {
      expect(() => {
        new MethodSelectionService({
          gameDataRepository: null,
          contextAssemblyService: mockContextAssemblyService,
          jsonLogicService: mockJsonLogicService,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw error if contextAssemblyService is missing', () => {
      expect(() => {
        new MethodSelectionService({
          gameDataRepository: mockGameDataRepository,
          contextAssemblyService: null,
          jsonLogicService: mockJsonLogicService,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw error if jsonLogicService is missing', () => {
      expect(() => {
        new MethodSelectionService({
          gameDataRepository: mockGameDataRepository,
          contextAssemblyService: mockContextAssemblyService,
          jsonLogicService: null,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw error if logger is missing', () => {
      expect(() => {
        new MethodSelectionService({
          gameDataRepository: mockGameDataRepository,
          contextAssemblyService: mockContextAssemblyService,
          jsonLogicService: mockJsonLogicService,
          logger: null,
        });
      }).toThrow();
    });
  });

  describe('selectMethod - Input Validation', () => {
    it('should throw error if taskId is empty string', () => {
      expect(() => {
        service.selectMethod('', TEST_ACTOR_ID, TEST_TASK_PARAMS);
      }).toThrow();
    });

    it('should throw error if taskId is null', () => {
      expect(() => {
        service.selectMethod(null, TEST_ACTOR_ID, TEST_TASK_PARAMS);
      }).toThrow();
    });

    it('should throw error if taskId is undefined', () => {
      expect(() => {
        service.selectMethod(undefined, TEST_ACTOR_ID, TEST_TASK_PARAMS);
      }).toThrow();
    });

    it('should throw error if actorId is empty string', () => {
      expect(() => {
        service.selectMethod(TEST_TASK_ID, '', TEST_TASK_PARAMS);
      }).toThrow();
    });

    it('should throw error if actorId is null', () => {
      expect(() => {
        service.selectMethod(TEST_TASK_ID, null, TEST_TASK_PARAMS);
      }).toThrow();
    });

    it('should throw MethodSelectionError if taskParams is null', () => {
      expect(() => {
        service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, null);
      }).toThrow(MethodSelectionError);
      expect(() => {
        service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, null);
      }).toThrow('Task parameters must be provided as an object');
    });

    it('should throw MethodSelectionError if taskParams is not an object', () => {
      expect(() => {
        service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, 'not-an-object');
      }).toThrow(MethodSelectionError);
    });
  });

  describe('selectMethod - Task Loading', () => {
    it('should throw MethodSelectionError if task registry not available', () => {
      mockGameDataRepository.get.mockReturnValue(null);

      expect(() => {
        service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);
      }).toThrow(MethodSelectionError);
      expect(() => {
        service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);
      }).toThrow('Task registry not available');
    });

    it('should throw MethodSelectionError if task not found', () => {
      mockGameDataRepository.get.mockReturnValue({});

      expect(() => {
        service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);
      }).toThrow(MethodSelectionError);
      expect(() => {
        service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);
      }).toThrow(`Task '${TEST_TASK_ID}' not found in game data`);
    });

    it('should call gameDataRepository.get with "tasks" key', () => {
      const mockTasks = {
        [TEST_TASK_ID]: {
          id: TEST_TASK_ID,
          refinementMethods: [],
        },
      };
      mockGameDataRepository.get.mockReturnValue(mockTasks);

      service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);

      expect(mockGameDataRepository.get).toHaveBeenCalledWith('tasks');
    });
  });

  describe('selectMethod - Empty Methods', () => {
    it('should return null when task has no refinement methods', () => {
      const mockTasks = {
        [TEST_TASK_ID]: {
          id: TEST_TASK_ID,
          refinementMethods: [],
        },
      };
      mockGameDataRepository.get.mockReturnValue(mockTasks);

      const result = service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);

      expect(result.selectedMethod).toBeNull();
      expect(result.diagnostics.methodsEvaluated).toBe(0);
      expect(result.diagnostics.evaluationResults).toEqual([]);
    });

    it('should return null when refinementMethods field is undefined', () => {
      const mockTasks = {
        [TEST_TASK_ID]: {
          id: TEST_TASK_ID,
        },
      };
      mockGameDataRepository.get.mockReturnValue(mockTasks);

      const result = service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);

      expect(result.selectedMethod).toBeNull();
    });

    it('should log warning when task has no refinement methods', () => {
      const mockTasks = {
        [TEST_TASK_ID]: {
          id: TEST_TASK_ID,
          refinementMethods: [],
        },
      };
      mockGameDataRepository.get.mockReturnValue(mockTasks);

      service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('has no refinement methods defined')
      );
    });
  });

  describe('selectMethod - Method Loading Infrastructure', () => {
    it('should throw MethodSelectionError when refinement method not found in registry', () => {
      const mockTasks = {
        [TEST_TASK_ID]: {
          id: TEST_TASK_ID,
          refinementMethods: [
            {
              methodId: 'core:consume_nourishing_item.simple_consume',
              $ref: './refinement-methods/consume_nourishing_item.simple_consume.refinement.json',
            },
          ],
        },
      };

      // First call returns tasks, second call returns empty refinement-methods registry
      mockGameDataRepository.get
        .mockReturnValueOnce(mockTasks)
        .mockReturnValueOnce({});

      expect(() => {
        service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);
      }).toThrow(MethodSelectionError);
      expect(() => {
        // Reset mocks and call again for second expectation
        mockGameDataRepository.get
          .mockReturnValueOnce(mockTasks)
          .mockReturnValueOnce({});
        service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);
      }).toThrow("Refinement method 'core:consume_nourishing_item.simple_consume' not found in registry");
    });

    it('should throw MethodSelectionError when method registry is unavailable', () => {
      const mockTasks = {
        [TEST_TASK_ID]: {
          id: TEST_TASK_ID,
          refinementMethods: [
            {
              methodId: 'core:missing_registry.method',
              $ref: './refinement-methods/missing_registry.method.json',
            },
          ],
        },
      };

      mockGameDataRepository.get.mockImplementation((key) => {
        if (key === 'tasks') {
          return mockTasks;
        }
        if (key === 'refinement-methods') {
          return undefined;
        }
        return undefined;
      });

      expect(() => {
        service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);
      }).toThrow('Refinement method registry not available');
    });

    it('should throw MethodSelectionError when method taskId differs from parent task', () => {
      const mismatchedMethod = createMethod({
        id: 'core:consume_nourishing_item.bad_ref',
        taskId: 'core:different_task',
      });

      const task = {
        id: TEST_TASK_ID,
        refinementMethods: [
          {
            methodId: mismatchedMethod.id,
            $ref: './refinement-methods/consume_nourishing_item.bad_ref.json',
          },
        ],
      };

      mockGameDataRepository.get.mockImplementation((key) => {
        if (key === 'tasks') {
          return { [TEST_TASK_ID]: task };
        }
        if (key === 'refinement-methods') {
          return { [mismatchedMethod.id]: mismatchedMethod };
        }
        return undefined;
      });

      expect(() => {
        service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);
      }).toThrow(
        `Refinement method '${mismatchedMethod.id}' taskId mismatch: expected '${TEST_TASK_ID}', got '${mismatchedMethod.taskId}'`
      );
    });
  });

  describe('selectMethod - Method evaluation logic', () => {
    it('should select the first method whose applicability condition evaluates to true', () => {
      const primaryMethod = createMethod({ id: 'core:consume.primary' });
      const fallbackMethod = createMethod({ id: 'core:consume.fallback' });
      setupTaskWithMethods(primaryMethod, fallbackMethod);

      const refinementContext = { actorId: TEST_ACTOR_ID, task: TEST_TASK_ID };
      mockContextAssemblyService.assembleRefinementContext.mockReturnValue(refinementContext);
      mockContextAssemblyService.assembleConditionContext.mockImplementation((ctx) => ctx);
      mockJsonLogicService.evaluate.mockReturnValue(true);

      const result = service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);

      expect(result.selectedMethod).toBe(primaryMethod);
      expect(result.diagnostics.methodsEvaluated).toBe(1);
      expect(result.diagnostics.evaluationResults).toHaveLength(1);
      expect(mockJsonLogicService.evaluate).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Selected method 'core:consume.primary'")
      );
    });

    it('should evaluate additional methods when earlier ones are not applicable', () => {
      const firstMethod = createMethod({ id: 'core:consume.first' });
      const secondMethod = createMethod({ id: 'core:consume.second' });
      setupTaskWithMethods(firstMethod, secondMethod);

      mockContextAssemblyService.assembleRefinementContext.mockReturnValue({});
      mockContextAssemblyService.assembleConditionContext.mockReturnValue({});
      mockJsonLogicService.evaluate
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const result = service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS, {
        enableDiagnostics: false,
      });

      expect(result.selectedMethod).toBe(secondMethod);
      expect(result.diagnostics.evaluationResults).toEqual([]);
      expect(mockJsonLogicService.evaluate).toHaveBeenCalledTimes(2);
    });

    it('should log when no applicable methods are found after evaluation', () => {
      const methodA = createMethod({ id: 'core:consume.a' });
      const methodB = createMethod({ id: 'core:consume.b' });
      setupTaskWithMethods(methodA, methodB);

      mockContextAssemblyService.assembleRefinementContext.mockReturnValue({});
      mockContextAssemblyService.assembleConditionContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockReturnValue(false);

      const result = service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);

      expect(result.selectedMethod).toBeNull();
      expect(result.diagnostics.evaluationResults).toHaveLength(2);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No applicable methods found for task')
      );
    });

    it('should treat missing applicability as always applicable', () => {
      const unconditionalMethod = createMethod({
        id: 'core:consume.unconditional',
        applicability: undefined,
      });
      setupTaskWithMethods(unconditionalMethod);

      const result = service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);

      expect(result.selectedMethod).toBe(unconditionalMethod);
      expect(mockContextAssemblyService.assembleRefinementContext).not.toHaveBeenCalled();
      expect(mockJsonLogicService.evaluate).not.toHaveBeenCalled();
    });

    it('should treat applicability without condition as always applicable', () => {
      const method = createMethod({
        id: 'core:consume.emptyCondition',
        applicability: {},
      });
      setupTaskWithMethods(method);

      const result = service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);

      expect(result.selectedMethod).toBe(method);
      expect(mockContextAssemblyService.assembleRefinementContext).not.toHaveBeenCalled();
      expect(mockJsonLogicService.evaluate).not.toHaveBeenCalled();
    });

    it('should handle JSON Logic evaluation errors gracefully', () => {
      const method = createMethod({ id: 'core:consume.errorPath' });
      setupTaskWithMethods(method);

      mockContextAssemblyService.assembleRefinementContext.mockReturnValue({});
      mockContextAssemblyService.assembleConditionContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockImplementation(() => {
        throw new Error('JSON failure');
      });

      const result = service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);

      expect(result.selectedMethod).toBeNull();
      expect(result.diagnostics.evaluationResults[0]).toEqual(
        expect.objectContaining({
          methodId: method.id,
          applicable: false,
          reason: expect.stringContaining('Evaluation error: JSON failure'),
        })
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Error evaluating applicability for method '${method.id}'`),
        expect.objectContaining({ methodId: method.id })
      );
    });

    it('should record diagnostics when applicability condition evaluates to false', () => {
      const method = createMethod({ id: 'core:consume.falseResult' });
      setupTaskWithMethods(method);

      mockContextAssemblyService.assembleRefinementContext.mockReturnValue({});
      mockContextAssemblyService.assembleConditionContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockReturnValue(false);

      const result = service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);

      expect(result.selectedMethod).toBeNull();
      expect(result.diagnostics.evaluationResults[0]).toEqual(
        expect.objectContaining({
          methodId: method.id,
          applicable: false,
          reason: expect.stringContaining('Applicability condition evaluated to false'),
        })
      );
    });
  });

  describe('selectMethod - Diagnostics', () => {
    it('should provide diagnostics by default', () => {
      const mockTasks = {
        [TEST_TASK_ID]: {
          id: TEST_TASK_ID,
          refinementMethods: [],
        },
      };
      mockGameDataRepository.get.mockReturnValue(mockTasks);

      const result = service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);

      expect(result).toHaveProperty('diagnostics');
      expect(result.diagnostics).toHaveProperty('methodsEvaluated');
      expect(result.diagnostics).toHaveProperty('evaluationResults');
    });

    it('should include diagnostics when enableDiagnostics option is true', () => {
      const mockTasks = {
        [TEST_TASK_ID]: {
          id: TEST_TASK_ID,
          refinementMethods: [],
        },
      };
      mockGameDataRepository.get.mockReturnValue(mockTasks);

      const result = service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS, {
        enableDiagnostics: true,
      });

      expect(result.diagnostics).toBeDefined();
    });

    it('should log debug message when starting method selection', () => {
      const mockTasks = {
        [TEST_TASK_ID]: {
          id: TEST_TASK_ID,
          refinementMethods: [],
        },
      };
      mockGameDataRepository.get.mockReturnValue(mockTasks);

      service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Selecting method for task'),
        expect.objectContaining({
          taskId: TEST_TASK_ID,
          actorId: TEST_ACTOR_ID,
          taskParams: TEST_TASK_PARAMS,
        })
      );
    });

    it('should log warning when no refinement methods defined', () => {
      const mockTasks = {
        [TEST_TASK_ID]: {
          id: TEST_TASK_ID,
          refinementMethods: [],
        },
      };
      mockGameDataRepository.get.mockReturnValue(mockTasks);

      service.selectMethod(TEST_TASK_ID, TEST_ACTOR_ID, TEST_TASK_PARAMS);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('has no refinement methods defined')
      );
    });
  });

});
