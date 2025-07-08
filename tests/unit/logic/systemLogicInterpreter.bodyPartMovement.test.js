// tests/unit/logic/systemLogicInterpreter.bodyPartMovement.test.js

import { jest } from '@jest/globals';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';

describe('SystemLogicInterpreter - Body Part Movement Validation', () => {
  let interpreter;
  let mockEventBus;
  let mockDataRegistry;
  let mockJsonLogic;
  let mockEntityManager;
  let mockOperationInterpreter;
  let mockBodyGraphService;
  let mockLogger;
  let hasBodyPartWithComponentValueHandler;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Mock event bus
    mockEventBus = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn().mockReturnValue(true),
    };

    // Mock data registry
    mockDataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([]),
    };

    // Mock JSON logic
    mockJsonLogic = {
      evaluate: jest.fn(),
      addOperation: jest.fn(),
    };

    // Mock entity manager
    mockEntityManager = {
      getEntity: jest.fn(),
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
      getEntitiesWithComponent: jest.fn().mockReturnValue([]),
    };

    // Mock the handler
    hasBodyPartWithComponentValueHandler = jest.fn();

    // Mock operation interpreter
    mockOperationInterpreter = {
      execute: jest.fn((operation, executionContext) => {
        if (operation.type === 'HAS_BODY_PART_WITH_COMPONENT_VALUE') {
          return hasBodyPartWithComponentValueHandler(
            operation.parameters,
            executionContext
          );
        }
      }),
    };

    // Mock body graph service
    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
    };

    interpreter = new SystemLogicInterpreter({
      logger: mockLogger,
      eventBus: mockEventBus,
      dataRegistry: mockDataRegistry,
      jsonLogicEvaluationService: mockJsonLogic,
      entityManager: mockEntityManager,
      operationInterpreter: mockOperationInterpreter,
      bodyGraphService: mockBodyGraphService,
    });
  });

  describe('hasBodyPartWithComponentValue custom operation', () => {
    let customOperation;

    beforeEach(() => {
      interpreter.initialize();

      // Capture the custom operation that was registered
      expect(mockJsonLogic.addOperation).toHaveBeenCalledWith(
        'hasBodyPartWithComponentValue',
        expect.any(Function)
      );
      customOperation = mockJsonLogic.addOperation.mock.calls[0][1];
    });

    test('should pass correct operation object with parameters to operationInterpreter', () => {
      const args = ['actor', 'core:movement', 'locked', false];
      const data = { actor: { id: 'test-actor-id' } };

      hasBodyPartWithComponentValueHandler.mockReturnValue(true);

      const result = customOperation(args, data);

      // Verify the operation interpreter was called with correct structure
      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        {
          type: 'HAS_BODY_PART_WITH_COMPONENT_VALUE',
          parameters: args, // Parameters should be included
        },
        expect.objectContaining({
          evaluationContext: data,
          entityManager: mockEntityManager,
          validatedEventDispatcher: null,
          logger: expect.objectContaining({
            debug: expect.any(Function),
            error: expect.any(Function),
            info: expect.any(Function),
            warn: expect.any(Function),
          }),
        })
      );

      expect(result).toBe(true);
    });

    test('should correctly structure execution context with evaluationContext', () => {
      const args = ['target', 'core:health', 'value', 100];
      const data = {
        actor: { id: 'actor-id' },
        target: { id: 'target-id' },
      };

      hasBodyPartWithComponentValueHandler.mockReturnValue(true);

      customOperation(args, data);

      // Verify the execution context has the correct structure
      const expectedContext = expect.objectContaining({
        evaluationContext: data,
        entityManager: mockEntityManager,
        validatedEventDispatcher: null,
        logger: expect.objectContaining({
          debug: expect.any(Function),
          error: expect.any(Function),
          info: expect.any(Function),
          warn: expect.any(Function),
        }),
      });

      expect(hasBodyPartWithComponentValueHandler).toHaveBeenCalledWith(
        args,
        expectedContext
      );
    });

    test('should handle false return from handler', () => {
      const args = ['actor', 'core:movement', 'locked', false];
      const data = { actor: { id: 'test-actor-id' } };

      hasBodyPartWithComponentValueHandler.mockReturnValue(false);

      const result = customOperation(args, data);

      expect(result).toBe(false);
    });

    test('should handle undefined return from handler', () => {
      const args = ['actor', 'core:movement', 'locked', false];
      const data = { actor: { id: 'test-actor-id' } };

      hasBodyPartWithComponentValueHandler.mockReturnValue(undefined);

      const result = customOperation(args, data);

      expect(result).toBe(undefined);
    });
  });

  describe('integration with movement prerequisites', () => {
    let customOperation;

    beforeEach(() => {
      interpreter.initialize();
      customOperation = mockJsonLogic.addOperation.mock.calls[0][1];

      // Set up the handler to simulate real behavior
      hasBodyPartWithComponentValueHandler.mockImplementation((params) => {
        const [entityRef, componentId, propertyPath, expectedValue] = params;

        // Simulate checking body parts for movement component
        if (componentId === 'core:movement' && propertyPath === 'locked') {
          // Return true if checking for locked === false (not rooted)
          return expectedValue === false;
        }

        return false;
      });
    });

    test('should allow movement when checking for not locked (locked === false)', () => {
      const result = customOperation(
        ['actor', 'core:movement', 'locked', false],
        { actor: { id: 'test-actor' } }
      );

      expect(result).toBe(true);
    });

    test('should prevent movement when checking for locked === true', () => {
      const result = customOperation(
        ['actor', 'core:movement', 'locked', true],
        { actor: { id: 'test-actor' } }
      );

      expect(result).toBe(false);
    });

    test('should handle different component checks', () => {
      const result = customOperation(['actor', 'core:health', 'value', 100], {
        actor: { id: 'test-actor' },
      });

      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    let customOperation;

    beforeEach(() => {
      interpreter.initialize();
      customOperation = mockJsonLogic.addOperation.mock.calls[0][1];
    });

    test('should propagate handler exceptions', () => {
      hasBodyPartWithComponentValueHandler.mockImplementation(() => {
        throw new Error('Handler error');
      });

      expect(() => {
        customOperation(['actor', 'core:movement', 'locked', false], {});
      }).toThrow('Handler error');
    });

    test('should handle missing operation type gracefully', () => {
      // This test verifies our fix - the operation should have a type property
      mockOperationInterpreter.execute.mockImplementation((operation) => {
        if (!operation.type) {
          throw new Error('Operation must have a type property');
        }
        return true;
      });

      // Should not throw because we now pass an object with type
      expect(() => {
        customOperation(['actor', 'core:movement', 'locked', false], {});
      }).not.toThrow();
    });
  });
});
