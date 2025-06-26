import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { registerInterpreters } from '../../src/dependencyInjection/registrations/interpreterRegistrations.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import OperationRegistry from '../../src/logic/operationRegistry.js';
import OperationInterpreter from '../../src/logic/operationInterpreter.js';
import SystemLogicInterpreter from '../../src/logic/systemLogicInterpreter.js';

describe('registerInterpreters', () => {
  /** @type {AppContainer} */
  let container;

  beforeEach(() => {
    container = new AppContainer();
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    container.register(tokens.ILogger, logger);
    container.register(tokens.EventBus, {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    });
    container.register(tokens.IDataRegistry, {
      getAllSystemRules: jest.fn().mockReturnValue([]),
    });
    container.register(tokens.JsonLogicEvaluationService, {
      evaluate: jest.fn(),
    });
    container.register(tokens.IEntityManager, {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    });
    container.register(tokens.IValidatedEventDispatcher, {
      dispatch: jest.fn(),
    });
    container.register(tokens.ISafeEventDispatcher, { dispatch: jest.fn() });
  });

  it('registers and resolves interpreter services', () => {
    registerInterpreters(container);

    const reg1 = container.resolve(tokens.OperationRegistry);
    const reg2 = container.resolve(tokens.OperationRegistry);
    expect(reg1).toBeInstanceOf(OperationRegistry);
    expect(reg1).toBe(reg2); // singleton

    const interp1 = container.resolve(tokens.OperationInterpreter);
    const interp2 = container.resolve(tokens.OperationInterpreter);
    expect(interp1).toBeInstanceOf(OperationInterpreter);
    expect(interp1).toBe(interp2); // singleton

    const sys1 = container.resolve(tokens.SystemLogicInterpreter);
    const sys2 = container.resolve(tokens.SystemLogicInterpreter);
    expect(sys1).toBeInstanceOf(SystemLogicInterpreter);
    expect(sys1).toBe(sys2); // singleton
  });
});
