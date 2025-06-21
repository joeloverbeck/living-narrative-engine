// src/tests/dependencyInjection/registrations/interpreterRegistrations.test.js
// ****** CORRECTED FILE ******

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/events/eventBus.js').default} EventBus */
/** @typedef {import('../../../../src/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../../src/logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../../../src/entities/entityManager.js').default} EntityManager */ // Concrete EntityManager for mock
/** @typedef {import('../../../../src/interfaces/IEntityManager.js').IEntityManager} IEntityManager */ // Interface for resolving
/** @typedef {import('../../../../src/logic/operationInterpreter.js').default} OperationInterpreter */
/** @typedef {import('../../../../src/logic/operationRegistry.js').default} OperationRegistry */
/** @typedef {import('../../../../src/events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {any} AppContainer */

// --- Jest Imports ---
import { describe, beforeEach, it, expect, jest } from '@jest/globals';

// --- Class Under Test ---
import { registerInterpreters } from '../../../../src/dependencyInjection/registrations/interpreterRegistrations.js';

// --- Dependencies ---
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { createMockContainerWithRegistration } from '../../../common/mockFactories/index.js';

// --- Mock Modules ---
jest.mock('../../../../src/logic/operationRegistry.js');
jest.mock('../../../../src/logic/operationInterpreter.js');
jest.mock('../../../../src/logic/systemLogicInterpreter.js');
jest.mock('../../../../src/logic/operationHandlers/dispatchEventHandler.js');
jest.mock('../../../../src/logic/operationHandlers/logHandler.js');
jest.mock('../../../../src/logic/operationHandlers/modifyComponentHandler.js');
jest.mock('../../../../src/logic/operationHandlers/addComponentHandler.js');
jest.mock('../../../../src/logic/operationHandlers/removeComponentHandler.js');
jest.mock('../../../../src/logic/operationHandlers/queryComponentHandler.js');
jest.mock('../../../../src/logic/operationHandlers/setVariableHandler.js');

// --- Import AFTER mocking ---
import OperationRegistry from '../../../../src/logic/operationRegistry.js';
import OperationInterpreter from '../../../../src/logic/operationInterpreter.js';
import SystemLogicInterpreter from '../../../../src/logic/systemLogicInterpreter.js';
import DispatchEventHandler from '../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import LogHandler from '../../../../src/logic/operationHandlers/logHandler.js';
import ModifyComponentHandler from '../../../../src/logic/operationHandlers/modifyComponentHandler.js';
import AddComponentHandler from '../../../../src/logic/operationHandlers/addComponentHandler.js';
import RemoveComponentHandler from '../../../../src/logic/operationHandlers/removeComponentHandler.js';
import QueryComponentHandler from '../../../../src/logic/operationHandlers/queryComponentHandler.js';
import SetVariableHandler from '../../../../src/logic/operationHandlers/setVariableHandler.js';

// --- Mock Implementations ---
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
const mockEventBus = {
  subscribe: jest.fn(),
  publish: jest.fn(),
  unsubscribe: jest.fn(),
};
const mockDataRegistry = { getAllSystemRules: jest.fn().mockReturnValue([]) };
const mockJsonLogicService = { evaluate: jest.fn(), addOperation: jest.fn() };
const mockEntityManager = {
  getEntityInstance: jest.fn(),
  getComponentData: jest.fn(),
  addComponent: jest.fn(),
  removeComponent: jest.fn(),
  hasComponent: jest.fn(),
};
const mockvalidatedEventDispatcher = {
  dispatch: jest.fn().mockResolvedValue(true),
};
const mockSafeEventDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };

describe('registerInterpreters', () => {
  /** @type {ReturnType<typeof createMockContainerWithRegistration>} */
  let mockContainer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContainer = createMockContainerWithRegistration();

    // Pre-register core dependencies NEEDED by the interpreter factories
    // These are the services the factories themselves will resolve.
    mockContainer.register(tokens.ILogger, mockLogger, {
      lifecycle: 'singleton',
    });
    mockContainer.register(tokens.EventBus, mockEventBus, {
      lifecycle: 'singleton',
    });
    mockContainer.register(tokens.IDataRegistry, mockDataRegistry, {
      lifecycle: 'singleton',
    });
    mockContainer.register(
      tokens.JsonLogicEvaluationService,
      mockJsonLogicService,
      { lifecycle: 'singleton' }
    );

    // Register both the concrete EntityManager (if anything uses it directly) AND the IEntityManager interface
    mockContainer.register(tokens.EntityManager, mockEntityManager, {
      lifecycle: 'singleton',
    });
    // ***** THIS IS THE PRIMARY FIX *****
    mockContainer.register(tokens.IEntityManager, mockEntityManager, {
      lifecycle: 'singleton',
    });
    // ***********************************

    mockContainer.register(
      tokens.IValidatedEventDispatcher,
      mockvalidatedEventDispatcher,
      { lifecycle: 'singleton' }
    );

    // Register SafeEventDispatcher for handlers that require it
    mockContainer.register(
      tokens.ISafeEventDispatcher,
      mockSafeEventDispatcher,
      {
        lifecycle: 'singleton',
      }
    );

    // Clear implementation mocks
    Object.values(mockLogger).forEach((fn) => fn.mockClear?.());
    Object.values(mockEventBus).forEach((fn) => fn.mockClear?.());
    Object.values(mockDataRegistry).forEach((fn) => fn.mockClear?.());
    Object.values(mockJsonLogicService).forEach((fn) => fn.mockClear?.());
    Object.values(mockEntityManager).forEach((fn) => fn.mockClear?.());
    Object.values(mockvalidatedEventDispatcher).forEach((fn) =>
      fn.mockClear?.()
    );
    Object.values(mockSafeEventDispatcher).forEach((fn) => fn.mockClear?.());

    // Clear constructor mocks defined via jest.mock() for USED handlers/interpreters
    OperationRegistry.mockClear?.();
    if (OperationRegistry.mock?.instances) {
      OperationRegistry.mock.instances.forEach((inst) => {
        if (inst?.register?.mockClear) inst.register.mockClear();
      });
    }
    OperationInterpreter.mockClear?.();
    SystemLogicInterpreter.mockClear?.();
    DispatchEventHandler.mockClear?.();
    LogHandler.mockClear?.();
    ModifyComponentHandler.mockClear?.();
    AddComponentHandler.mockClear?.();
    RemoveComponentHandler.mockClear?.();
    QueryComponentHandler.mockClear?.();
    SetVariableHandler.mockClear?.();
  }); // End beforeEach

  // --- Tests ---

  it('should register required services without throwing errors', () => {
    expect(() => registerInterpreters(mockContainer)).not.toThrow();

    // Assertions for currently registered handlers and interpreters
    expect(mockContainer.register).toHaveBeenCalledWith(
      tokens.DispatchEventHandler,
      expect.any(Function),
      expect.objectContaining({ lifecycle: 'singletonFactory' })
    );
    expect(mockContainer.register).toHaveBeenCalledWith(
      tokens.LogHandler,
      expect.any(Function),
      expect.objectContaining({ lifecycle: 'singletonFactory' })
    );
    expect(mockContainer.register).toHaveBeenCalledWith(
      tokens.ModifyComponentHandler,
      expect.any(Function),
      expect.objectContaining({ lifecycle: 'singletonFactory' })
    );
    expect(mockContainer.register).toHaveBeenCalledWith(
      tokens.AddComponentHandler,
      expect.any(Function),
      expect.objectContaining({ lifecycle: 'singletonFactory' })
    );
    expect(mockContainer.register).toHaveBeenCalledWith(
      tokens.RemoveComponentHandler,
      expect.any(Function),
      expect.objectContaining({ lifecycle: 'singletonFactory' })
    );
    expect(mockContainer.register).toHaveBeenCalledWith(
      tokens.QueryComponentHandler,
      expect.any(Function),
      expect.objectContaining({ lifecycle: 'singletonFactory' })
    );
    expect(mockContainer.register).toHaveBeenCalledWith(
      tokens.SetVariableHandler,
      expect.any(Function),
      expect.objectContaining({ lifecycle: 'singletonFactory' })
    );
    expect(mockContainer.register).toHaveBeenCalledWith(
      tokens.OperationRegistry,
      expect.any(Function),
      expect.objectContaining({ lifecycle: 'singletonFactory' })
    );
    expect(mockContainer.register).toHaveBeenCalledWith(
      tokens.OperationInterpreter,
      expect.any(Function),
      expect.objectContaining({ lifecycle: 'singletonFactory' })
    );
    expect(mockContainer.register).toHaveBeenCalledWith(
      tokens.SystemLogicInterpreter,
      expect.any(Function),
      expect.objectContaining({
        lifecycle: 'singletonFactory',
        tags: expect.arrayContaining(['initializableSystem', 'shutdownable']), // Corrected assertion from your provided file
      })
    );
    expect(mockContainer.register).toHaveBeenCalledWith(
      tokens.ICommandOutcomeInterpreter,
      expect.any(Function),
      expect.objectContaining({ lifecycle: 'singletonFactory' })
    );

    // Explicitly check that removed handlers are NOT registered
    expect(mockContainer.register).not.toHaveBeenCalledWith(
      tokens.ModifyDomElementHandler,
      expect.any(Function),
      expect.anything()
    );
    expect(mockContainer.register).not.toHaveBeenCalledWith(
      tokens.AppendUiMessageHandler,
      expect.any(Function),
      expect.anything()
    );
  });

  it('resolving SystemLogicInterpreter does not throw', () => {
    registerInterpreters(mockContainer);
    let resolved;
    expect(() => {
      resolved = mockContainer.resolve(tokens.SystemLogicInterpreter);
    }).not.toThrow();
    expect(resolved).toBeDefined();
    expect(SystemLogicInterpreter).toHaveBeenCalledTimes(1);
    expect(SystemLogicInterpreter).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: mockLogger,
        eventBus: mockEventBus,
        dataRegistry: mockDataRegistry,
        jsonLogicEvaluationService: mockJsonLogicService,
        entityManager: mockEntityManager, // Should be the mockEntityManager via IEntityManager
        operationInterpreter: expect.anything(),
      })
    );
  });

  it('resolving OperationInterpreter does not throw', () => {
    registerInterpreters(mockContainer);
    let resolved;
    expect(() => {
      resolved = mockContainer.resolve(tokens.OperationInterpreter);
    }).not.toThrow();
    expect(resolved).toBeDefined();
    expect(OperationInterpreter).toHaveBeenCalledTimes(1);
    expect(OperationInterpreter).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: mockLogger,
        operationRegistry: expect.anything(),
      })
    );
  });

  it('resolving OperationRegistry does not throw and its factory registers handlers', () => {
    registerInterpreters(mockContainer);
    let registry;
    expect(() => {
      registry = mockContainer.resolve(tokens.OperationRegistry);
    }).not.toThrow();
    expect(registry).toBeDefined();
    expect(OperationRegistry).toHaveBeenCalledTimes(1);

    const mockInstance = OperationRegistry.mock.instances[0];
    expect(mockInstance).toBeDefined();
    expect(mockInstance.register).toHaveBeenCalledWith(
      'DISPATCH_EVENT',
      expect.any(Function)
    );
    expect(mockInstance.register).toHaveBeenCalledWith(
      'LOG',
      expect.any(Function)
    );
    expect(mockInstance.register).toHaveBeenCalledWith(
      'MODIFY_COMPONENT',
      expect.any(Function)
    );
    expect(mockInstance.register).toHaveBeenCalledWith(
      'ADD_COMPONENT',
      expect.any(Function)
    );
    expect(mockInstance.register).toHaveBeenCalledWith(
      'REMOVE_COMPONENT',
      expect.any(Function)
    );
    expect(mockInstance.register).toHaveBeenCalledWith(
      'QUERY_COMPONENT',
      expect.any(Function)
    );
    expect(mockInstance.register).toHaveBeenCalledWith(
      'QUERY_COMPONENTS',
      expect.any(Function)
    );
    expect(mockInstance.register).toHaveBeenCalledWith(
      'SET_VARIABLE',
      expect.any(Function)
    );

    // Ensure removed handlers weren't called
    expect(mockInstance.register).not.toHaveBeenCalledWith(
      'MODIFY_DOM_ELEMENT',
      expect.any(Function)
    );
    expect(mockInstance.register).not.toHaveBeenCalledWith(
      'APPEND_UI_MESSAGE',
      expect.any(Function)
    );
  });

  it('interpreters are registered as singletons', () => {
    registerInterpreters(mockContainer);

    const r1 = mockContainer.resolve(tokens.OperationRegistry);
    const r2 = mockContainer.resolve(tokens.OperationRegistry);
    expect(r1).toBe(r2);
    expect(OperationRegistry).toHaveBeenCalledTimes(1); // Factory called once

    const i1 = mockContainer.resolve(tokens.OperationInterpreter);
    const i2 = mockContainer.resolve(tokens.OperationInterpreter);
    expect(i1).toBe(i2);
    expect(OperationInterpreter).toHaveBeenCalledTimes(1); // Factory called once

    const s1 = mockContainer.resolve(tokens.SystemLogicInterpreter);
    const s2 = mockContainer.resolve(tokens.SystemLogicInterpreter);
    expect(s1).toBe(s2);
    expect(SystemLogicInterpreter).toHaveBeenCalledTimes(1); // Factory called once
  });

  it('resolving SetVariableHandler does not throw', () => {
    registerInterpreters(mockContainer);
    let handler;
    expect(() => {
      handler = mockContainer.resolve(tokens.SetVariableHandler);
    }).not.toThrow();
    expect(handler).toBeDefined();
    expect(SetVariableHandler).toHaveBeenCalledTimes(1);
    expect(SetVariableHandler).toHaveBeenCalledWith(
      expect.objectContaining({ logger: mockLogger })
    );
  });
}); // End describe
