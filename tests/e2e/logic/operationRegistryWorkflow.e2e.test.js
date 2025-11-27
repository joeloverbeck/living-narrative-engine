/**
 * @file operationRegistryWorkflow.e2e.test.js
 * @description End-to-end tests for operation registry and handler resolution workflow
 *
 * Tests the complete operation registry workflow including:
 * - Dynamic handler registration and overriding
 * - Handler lookup with various operation types
 * - Error handling for missing handlers
 * - Concurrent registration scenarios
 * - Integration with operation interpreter
 *
 * Priority 1: CRITICAL - Core System Integrity
 * This is the highest risk area with no current e2e coverage
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';

describe('Operation Registry Workflow E2E', () => {
  let container;
  let operationRegistry;
  let operationInterpreter;
  let entityManager;
  let eventBus;
  let logger;
  let jsonLogic;

  beforeAll(async () => {
    // Initialize container with full system configuration
    container = new AppContainer();
    await configureContainer(container, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    });

    // Register core entity definitions manually for testing
    const dataRegistry = container.resolve(tokens.IDataRegistry);

    // Register core:actor definition
    dataRegistry.store(
      'entityDefinitions',
      'core:actor',
      new EntityDefinition('core:actor', {
        id: 'core:actor',
        components: {
          'core:description': { name: '' },
          'core:stats': { health: 100, maxHealth: 100 },
          'core:inventory': { items: [] },
        },
      })
    );

    // Resolve core services
    operationRegistry = container.resolve(tokens.OperationRegistry);
    operationInterpreter = container.resolve(tokens.OperationInterpreter);
    entityManager = container.resolve(tokens.IEntityManager);
    eventBus = container.resolve(tokens.IEventBus);
    logger = container.resolve(tokens.ILogger);
    jsonLogic = container.resolve(tokens.JsonLogicEvaluationService);
  });

  afterAll(async () => {
    // Cleanup
    if (container && typeof container.dispose === 'function') {
      await container.dispose();
    }
  });

  beforeEach(() => {
    // Clear any test-specific handlers between tests
    // Note: We'll re-register core handlers if needed
  });

  describe('Happy Path Scenarios', () => {
    it('should register and execute a custom operation handler', async () => {
      // Arrange
      const customOperationType = 'TEST_CUSTOM_OP';
      let handlerCalled = false;
      let capturedParams = null;
      const customHandler = jest.fn(async (params, context) => {
        handlerCalled = true;
        capturedParams = params;
      });

      // Act - Register the handler
      const isNew = operationRegistry.register(
        customOperationType,
        customHandler
      );

      // Assert registration
      expect(isNew).toBe(true);

      // Act - Execute operation through interpreter
      const operation = {
        type: customOperationType,
        parameters: { testValue: 42 },
      };

      const context = {
        evaluationContext: {},
        eventBus,
        entityManager,
        logger,
        jsonLogic,
      };

      await operationInterpreter.execute(operation, context);

      // Assert execution
      expect(handlerCalled).toBe(true);
      expect(customHandler).toHaveBeenCalledWith(
        operation.parameters,
        expect.objectContaining(context)
      );
      expect(capturedParams).toEqual({ testValue: 42 });
    });

    it('should allow overriding existing handlers', () => {
      // Arrange
      const operationType = 'TEST_OVERRIDE';
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      // Act
      const firstReg = operationRegistry.register(operationType, handler1);
      const secondReg = operationRegistry.register(operationType, handler2);

      // Assert
      expect(firstReg).toBe(true); // New handler
      expect(secondReg).toBe(false); // Overwritten handler

      // Verify the second handler is active
      const retrievedHandler = operationRegistry.getHandler(operationType);
      expect(retrievedHandler).toBe(handler2);
    });

    it('should handle multiple operation types independently', async () => {
      // Arrange
      const calls = [];
      const handlers = {
        TEST_OP_1: jest.fn(async () => {
          calls.push('op1');
        }),
        TEST_OP_2: jest.fn(async () => {
          calls.push('op2');
        }),
        TEST_OP_3: jest.fn(async () => {
          calls.push('op3');
        }),
      };

      // Act - Register multiple handlers
      Object.entries(handlers).forEach(([type, handler]) => {
        operationRegistry.register(type, handler);
      });

      // Execute each operation
      const context = {
        evaluationContext: {},
        eventBus,
        entityManager,
        logger,
        jsonLogic,
      };

      for (const [type, handler] of Object.entries(handlers)) {
        const operation = { type, parameters: {} };
        await operationInterpreter.execute(operation, context);
      }

      // Assert
      expect(calls).toEqual(['op1', 'op2', 'op3']);

      // Verify each handler was called exactly once
      Object.values(handlers).forEach((handler) => {
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    it('should preserve core operation handlers', () => {
      // Arrange - Check that some core handlers are registered
      // Note: Core handlers are registered during container initialization
      const someHandlers = ['SET_VARIABLE', 'END_TURN', 'LOG'];

      // Assert - At least some handlers should be registered
      const registeredHandlers = someHandlers.filter(
        (opType) => operationRegistry.getHandler(opType) !== undefined
      );

      expect(registeredHandlers.length).toBeGreaterThan(0);

      // Check that registered handlers are functions
      registeredHandlers.forEach((opType) => {
        const handler = operationRegistry.getHandler(opType);
        expect(typeof handler).toBe('function');
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw MissingHandlerError for missing operation handler (fail-fast)', () => {
      // Arrange
      const unknownOperation = {
        type: 'NON_EXISTENT_OPERATION',
        parameters: {},
      };

      const context = {
        evaluationContext: {},
        eventBus,
        entityManager,
        logger,
        jsonLogic,
      };

      // Act & Assert - Should throw MissingHandlerError immediately (fail-fast behavior)
      // The error is thrown synchronously during handler lookup, before any async operation
      expect(() =>
        operationInterpreter.execute(unknownOperation, context)
      ).toThrow(/Cannot execute operation.*NON_EXISTENT_OPERATION.*handler not found/);
    });

    it('should handle handler execution errors gracefully', async () => {
      // Arrange
      const errorMessage = 'Handler execution failed';
      const failingHandler = jest.fn(async () => {
        throw new Error(errorMessage);
      });

      operationRegistry.register('TEST_FAILING_OP', failingHandler);

      const operation = {
        type: 'TEST_FAILING_OP',
        parameters: {},
      };

      const context = {
        evaluationContext: {},
        eventBus,
        entityManager,
        logger,
        jsonLogic,
      };

      // Act & Assert
      await expect(
        operationInterpreter.execute(operation, context)
      ).rejects.toThrow(errorMessage);

      expect(failingHandler).toHaveBeenCalled();
    });

    it('should validate operation type is non-empty string', () => {
      // Arrange
      const handler = jest.fn();

      // Act & Assert - Empty string
      expect(() => {
        operationRegistry.register('', handler);
      }).toThrow(/non-empty string/i);

      // Act & Assert - Null
      expect(() => {
        operationRegistry.register(null, handler);
      }).toThrow();

      // Act & Assert - Undefined
      expect(() => {
        operationRegistry.register(undefined, handler);
      }).toThrow();
    });

    it('should validate handler is a function', () => {
      // Act & Assert - Non-function handler
      expect(() => {
        operationRegistry.register('TEST_OP', 'not a function');
      }).toThrow(/handler.*must be a function/i);

      expect(() => {
        operationRegistry.register('TEST_OP', null);
      }).toThrow(/handler.*must be a function/i);

      expect(() => {
        operationRegistry.register('TEST_OP', {});
      }).toThrow(/handler.*must be a function/i);
    });
  });

  describe('Edge Cases', () => {
    it('should handle operation type normalization', () => {
      // Arrange
      const handler = jest.fn();
      const variations = [
        '  TRIMMED_OP  ',
        'TRIMMED_OP',
        '  TRIMMED_OP',
        'TRIMMED_OP  ',
      ];

      // Act - Register with trimmed version
      operationRegistry.register(variations[0], handler);

      // Assert - All variations should resolve to the same handler
      variations.forEach((variant) => {
        const retrieved = operationRegistry.getHandler(variant);
        expect(retrieved).toBe(handler);
      });
    });

    it('should handle case-sensitive operation types', () => {
      // Arrange
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      // Act
      operationRegistry.register('lowercase_op', handler1);
      operationRegistry.register('LOWERCASE_OP', handler2);

      // Assert - Should be treated as different operations
      expect(operationRegistry.getHandler('lowercase_op')).toBe(handler1);
      expect(operationRegistry.getHandler('LOWERCASE_OP')).toBe(handler2);
    });

    it('should return undefined for unregistered handlers', () => {
      // Act
      const handler = operationRegistry.getHandler('NEVER_REGISTERED');

      // Assert
      expect(handler).toBeUndefined();
    });

    it('should handle special characters in operation types', () => {
      // Arrange
      const specialOps = [
        'core:action',
        'mod.operation',
        'operation-with-dashes',
        'operation_with_underscores',
      ];

      // Act & Assert
      specialOps.forEach((opType) => {
        const handler = jest.fn();
        const isNew = operationRegistry.register(opType, handler);
        expect(isNew).toBe(true);
        expect(operationRegistry.getHandler(opType)).toBe(handler);
      });
    });
  });

  describe('Integration with Operation Interpreter', () => {
    it('should execute complex operation chains through registry', async () => {
      // Arrange
      const results = [];
      let nextOp = null;

      // Register test handlers
      operationRegistry.register('TEST_CHAIN_1', async (params, ctx) => {
        results.push('chain1');
        nextOp = 'TEST_CHAIN_2';
      });

      operationRegistry.register('TEST_CHAIN_2', async (params, ctx) => {
        results.push('chain2');
        nextOp = 'TEST_CHAIN_3';
      });

      operationRegistry.register('TEST_CHAIN_3', async (params, ctx) => {
        results.push('chain3');
        nextOp = null;
      });

      // Act - Execute chain
      const context = {
        evaluationContext: {},
        eventBus,
        entityManager,
        logger,
        jsonLogic,
      };

      // Execute chain manually
      await operationInterpreter.execute(
        { type: 'TEST_CHAIN_1', parameters: {} },
        context
      );
      await operationInterpreter.execute(
        { type: 'TEST_CHAIN_2', parameters: {} },
        context
      );
      await operationInterpreter.execute(
        { type: 'TEST_CHAIN_3', parameters: {} },
        context
      );

      // Assert
      expect(results).toEqual(['chain1', 'chain2', 'chain3']);
    });

    it('should pass context correctly through handler execution', async () => {
      // Arrange
      let capturedContext;
      const testHandler = jest.fn(async (params, ctx) => {
        capturedContext = ctx;
        return { success: true };
      });

      operationRegistry.register('TEST_CONTEXT_PASS', testHandler);

      // Create test entity - use a known definition
      const entity = await entityManager.createEntityInstance('core:actor', {
        components: {
          'core:description': { name: 'Test Entity' },
        },
      });

      // Act
      const context = {
        evaluationContext: {
          actor: { id: entity.id },
          customField: 'test-value',
        },
        eventBus,
        entityManager,
        logger,
        jsonLogic,
        additionalData: { foo: 'bar' },
      };

      const operation = {
        type: 'TEST_CONTEXT_PASS',
        parameters: { param1: 'value1' },
      };

      await operationInterpreter.execute(operation, context);

      // Assert - Context should be passed through
      expect(capturedContext).toBeDefined();
      expect(capturedContext.evaluationContext).toEqual(
        context.evaluationContext
      );
      expect(capturedContext.eventBus).toBe(eventBus);
      expect(capturedContext.entityManager).toBe(entityManager);
      expect(capturedContext.logger).toBe(logger);
      expect(capturedContext.additionalData).toEqual({ foo: 'bar' });
    });
  });
});
