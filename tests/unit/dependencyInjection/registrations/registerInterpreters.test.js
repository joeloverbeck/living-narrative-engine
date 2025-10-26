import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { registerInterpreters } from '../../../../src/dependencyInjection/registrations/interpreterRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import OperationRegistry from '../../../../src/logic/operationRegistry.js';
import OperationInterpreter from '../../../../src/logic/operationInterpreter.js';
import SystemLogicInterpreter from '../../../../src/logic/systemLogicInterpreter.js';
import CommandOutcomeInterpreter from '../../../../src/commands/interpreters/commandOutcomeInterpreter.js';
import ActionSequenceService from '../../../../src/logic/actionSequenceService.js';
import { Registrar } from '../../../../src/utils/registrarHelpers.js';

describe('registerInterpreters', () => {
  /** @type {AppContainer} */
  let container;
  let logger;
  let safeDispatcher;

  beforeEach(() => {
    container = new AppContainer();
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    container.register(tokens.ILogger, logger);
    const bus = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };
    container.register(tokens.EventBus, bus);
    container.register(tokens.IEventBus, bus);
    container.register(tokens.IDataRegistry, {
      getAllSystemRules: jest.fn().mockReturnValue([]),
    });
    container.register(tokens.JsonLogicEvaluationService, {
      evaluate: jest.fn(),
      addOperation: jest.fn(),
    });
    container.register(tokens.IEntityManager, {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
      getEntity: jest.fn(),
    });
    container.register(tokens.BodyGraphService, {
      hasPartWithComponentValue: jest.fn().mockReturnValue({ found: false }),
    });
    container.register(tokens.IValidatedEventDispatcher, {
      dispatch: jest.fn(),
    });
    safeDispatcher = { dispatch: jest.fn() };
    container.register(tokens.ISafeEventDispatcher, safeDispatcher);
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

  it('registers command outcome interpreter as a singleton with resolved dependencies', () => {
    registerInterpreters(container);

    const interpreter1 = container.resolve(tokens.ICommandOutcomeInterpreter);
    const interpreter2 = container.resolve(tokens.ICommandOutcomeInterpreter);

    expect(interpreter1).toBeInstanceOf(CommandOutcomeInterpreter);
    expect(interpreter1).toBe(interpreter2);
    expect(container.resolve(tokens.ISafeEventDispatcher)).toBe(safeDispatcher);
    expect(logger.debug).toHaveBeenCalled();
  });

  it('registers the action sequence service as a singleton wired to the operation interpreter', () => {
    registerInterpreters(container);

    const sequenceService1 = container.resolve(tokens.ActionSequence);
    const sequenceService2 = container.resolve(tokens.ActionSequence);

    expect(sequenceService1).toBeInstanceOf(ActionSequenceService);
    expect(sequenceService1).toBe(sequenceService2);

    const operationInterpreter = container.resolve(tokens.OperationInterpreter);
    expect(operationInterpreter).toBeInstanceOf(OperationInterpreter);
  });

  it('binds operation registry handlers lazily through the container', () => {
    registerInterpreters(container);

    const registrar = new Registrar(container);
    const mockHandler = { execute: jest.fn() };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    registrar.instance(tokens.LogHandler, mockHandler);

    const registry = container.resolve(tokens.OperationRegistry);
    const handler = registry.getHandler('LOG');

    const params = { message: 'hello' };
    const context = { evaluationContext: {} };
    handler(params, context);

    expect(mockHandler.execute).toHaveBeenCalledWith(params, context);
    warnSpy.mockRestore();
  });
});
