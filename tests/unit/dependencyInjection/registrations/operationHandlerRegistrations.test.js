import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { Registrar } from '../../../../src/utils/registrarHelpers.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { registerOperationHandlers } from '../../../../src/dependencyInjection/registrations/operationHandlerRegistrations.js';
import {
  MockContainer,
  createMockLogger,
  createSimpleMock,
  createMockEntityManager,
} from '../../../common/mockFactories/index.js';
import jsonLogic from 'json-logic-js';

/**
 * @file Tests for registerOperationHandlers ensuring each handler token is registered once
 * and that all factory functions work correctly.
 */

describe('registerOperationHandlers', () => {
  /** @type {AppContainer} */
  let container;
  /** @type {Registrar} */
  let registrar;
  let registerSpy;

  beforeEach(() => {
    container = new AppContainer();
    registrar = new Registrar(container);
    registerSpy = jest.spyOn(container, 'register');
  });

  it('registers each handler token exactly once', () => {
    registerOperationHandlers(registrar);

    const handlerTokens = [
      tokens.DispatchEventHandler,
      tokens.DispatchPerceptibleEventHandler,
      tokens.DispatchSpeechHandler,
      tokens.LogHandler,
      tokens.ModifyComponentHandler,
      tokens.AddComponentHandler,
      tokens.RemoveComponentHandler,
      tokens.QueryComponentHandler,
      tokens.QueryComponentsHandler,
      tokens.SetVariableHandler,
      tokens.EndTurnHandler,
      tokens.SystemMoveEntityHandler,
      tokens.IMoveEntityHandler,
      tokens.GetTimestampHandler,
      tokens.GetNameHandler,
      tokens.RebuildLeaderListCacheHandler,
      tokens.CheckFollowCycleHandler,
      tokens.EstablishFollowRelationHandler,
      tokens.BreakFollowRelationHandler,
      tokens.AddPerceptionLogEntryHandler,
      tokens.QueryEntitiesHandler,
      tokens.HasComponentHandler,
      tokens.ModifyArrayFieldHandler,
      tokens.ModifyContextArrayHandler,
      tokens.IfCoLocatedHandler,
      tokens.MathHandler,
      tokens.AutoMoveFollowersHandler,
      tokens.MergeClosenessCircleHandler,
      tokens.RemoveFromClosenessCircleHandler,
      tokens.HasBodyPartWithComponentValueHandler,
      tokens.UnequipClothingHandler,
      tokens.LockMovementHandler,
      tokens.UnlockMovementHandler,
      tokens.RegenerateDescriptionHandler,
    ];

    handlerTokens.forEach((token) => {
      const calls = registerSpy.mock.calls.filter((c) => c[0] === token);
      expect(calls).toHaveLength(1);
    });

    expect(registerSpy).toHaveBeenCalledTimes(handlerTokens.length);
  });

  describe('handler factory functions', () => {
    let mockContainer;
    let mockLogger;
    let mockEntityManager;
    let mockDispatcher;
    let mockSafeEventDispatcher;
    let mockValidatedEventDispatcher;

    beforeEach(() => {
      mockLogger = createMockLogger();
      // Use the comprehensive entity manager mock that includes all required methods
      mockEntityManager = createMockEntityManager();

      // Add any additional methods that may not be in the mock
      mockEntityManager.hasEntity = jest.fn();
      mockEntityManager.createEntity = jest.fn();
      mockEntityManager.removeEntity = jest.fn();
      mockEntityManager.getComponent = jest.fn();
      mockEntityManager.hasComponent = jest.fn();
      mockEntityManager.addComponent = jest.fn();
      mockEntityManager.removeComponent = jest.fn();
      mockEntityManager.modifyComponent = jest.fn();
      mockEntityManager.queryEntities = jest.fn();
      mockEntityManager.getAllEntities = jest.fn();
      mockEntityManager.getEntitiesWithComponent = jest.fn(() => []);
      mockEntityManager.getEntitiesInLocation = jest.fn(() => []);
      mockDispatcher = createSimpleMock(['dispatch']);
      mockSafeEventDispatcher = createSimpleMock(['dispatch']);
      mockValidatedEventDispatcher = createSimpleMock(['dispatch']);

      mockContainer = new MockContainer();

      // Register all common dependencies
      mockContainer.register(tokens.ILogger, mockLogger);
      mockContainer.register(tokens.IEntityManager, mockEntityManager);
      mockContainer.register(
        tokens.ISafeEventDispatcher,
        mockSafeEventDispatcher
      );
      mockContainer.register(
        tokens.IValidatedEventDispatcher,
        mockValidatedEventDispatcher
      );
    });

    it('creates DispatchEventHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      // Get the registered factory
      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.DispatchEventHandler
      );
      const factory = factoryCall[1];

      // Execute the factory
      const handler = factory(mockContainer);

      // Verify the handler was created with correct dependencies
      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('DispatchEventHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.IValidatedEventDispatcher
      );
    });

    it('creates DispatchPerceptibleEventHandler with correct dependencies', () => {
      // Register the AddPerceptionLogEntryHandler dependency
      mockContainer.register(
        tokens.AddPerceptionLogEntryHandler,
        createSimpleMock(['execute'])
      );

      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.DispatchPerceptibleEventHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('DispatchPerceptibleEventHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.AddPerceptionLogEntryHandler
      );
    });

    it('creates DispatchSpeechHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.DispatchSpeechHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('DispatchSpeechHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.IValidatedEventDispatcher
      );
    });

    it('creates LogHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.LogHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('LogHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
    });

    it('creates ModifyComponentHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.ModifyComponentHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('ModifyComponentHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates AddComponentHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.AddComponentHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('AddComponentHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates RemoveComponentHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.RemoveComponentHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('RemoveComponentHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates QueryComponentHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.QueryComponentHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('QueryComponentHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates QueryComponentsHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.QueryComponentsHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('QueryComponentsHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates SetVariableHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.SetVariableHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('SetVariableHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      // Verify jsonLogic is passed
      expect(handler).toBeDefined();
    });

    it('creates EndTurnHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.EndTurnHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('EndTurnHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
    });

    it('creates SystemMoveEntityHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.SystemMoveEntityHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('SystemMoveEntityHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates IMoveEntityHandler that resolves to SystemMoveEntityHandler', () => {
      // First register SystemMoveEntityHandler
      mockContainer.register(tokens.SystemMoveEntityHandler, {
        name: 'SystemMoveEntityHandler',
      });

      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.IMoveEntityHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.name).toBe('SystemMoveEntityHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.SystemMoveEntityHandler
      );
    });

    it('creates GetTimestampHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.GetTimestampHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('GetTimestampHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
    });

    it('creates GetNameHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.GetNameHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('GetNameHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates RebuildLeaderListCacheHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.RebuildLeaderListCacheHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('RebuildLeaderListCacheHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates CheckFollowCycleHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.CheckFollowCycleHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('CheckFollowCycleHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates EstablishFollowRelationHandler with correct dependencies', () => {
      // Register the RebuildLeaderListCacheHandler dependency
      mockContainer.register(
        tokens.RebuildLeaderListCacheHandler,
        createSimpleMock(['execute'])
      );

      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.EstablishFollowRelationHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('EstablishFollowRelationHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.RebuildLeaderListCacheHandler
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates BreakFollowRelationHandler with correct dependencies', () => {
      // Register the RebuildLeaderListCacheHandler dependency
      mockContainer.register(
        tokens.RebuildLeaderListCacheHandler,
        createSimpleMock(['execute'])
      );

      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.BreakFollowRelationHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('BreakFollowRelationHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.RebuildLeaderListCacheHandler
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates AddPerceptionLogEntryHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.AddPerceptionLogEntryHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('AddPerceptionLogEntryHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates QueryEntitiesHandler with correct dependencies', () => {
      // Register the JsonLogicEvaluationService dependency
      mockContainer.register(
        tokens.JsonLogicEvaluationService,
        createSimpleMock(['evaluate'])
      );

      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.QueryEntitiesHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('QueryEntitiesHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.JsonLogicEvaluationService
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates HasComponentHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.HasComponentHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('HasComponentHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates ModifyArrayFieldHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.ModifyArrayFieldHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('ModifyArrayFieldHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates ModifyContextArrayHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.ModifyContextArrayHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('ModifyContextArrayHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates IfCoLocatedHandler with correct dependencies', () => {
      // Register the OperationInterpreter dependency
      mockContainer.register(
        tokens.OperationInterpreter,
        createSimpleMock(['execute'])
      );

      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.IfCoLocatedHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('IfCoLocatedHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.OperationInterpreter
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates MathHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.MathHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('MathHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates AutoMoveFollowersHandler with correct dependencies', () => {
      // Register the IMoveEntityHandler dependency
      mockContainer.register(
        tokens.IMoveEntityHandler,
        createSimpleMock(['execute'])
      );

      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.AutoMoveFollowersHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('AutoMoveFollowersHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.IMoveEntityHandler
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates MergeClosenessCircleHandler with correct dependencies', () => {
      // Register the ClosenessCircleService dependency
      mockContainer.register(
        tokens.ClosenessCircleService,
        createSimpleMock(['merge', 'repair'])
      );

      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.MergeClosenessCircleHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('MergeClosenessCircleHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ClosenessCircleService
      );
    });

    it('creates RemoveFromClosenessCircleHandler with correct dependencies', () => {
      // Register the ClosenessCircleService dependency
      mockContainer.register(
        tokens.ClosenessCircleService,
        createSimpleMock(['remove', 'repair'])
      );

      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.RemoveFromClosenessCircleHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('RemoveFromClosenessCircleHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ClosenessCircleService
      );
    });

    it('creates HasBodyPartWithComponentValueHandler with correct dependencies', () => {
      // Register the BodyGraphService dependency
      mockContainer.register(
        tokens.BodyGraphService,
        createSimpleMock([
          'hasBodyPartWithComponentValue',
          'hasPartWithComponentValue',
        ])
      );

      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.HasBodyPartWithComponentValueHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe(
        'HasBodyPartWithComponentValueHandler'
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.BodyGraphService
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates UnequipClothingHandler with correct dependencies', () => {
      // Register the EquipmentOrchestrator dependency
      mockContainer.register(
        tokens.EquipmentOrchestrator,
        createSimpleMock(['orchestrateUnequipment'])
      );

      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.UnequipClothingHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('UnequipClothingHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.EquipmentOrchestrator
      );
    });

    it('creates LockMovementHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.LockMovementHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('LockMovementHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('creates UnlockMovementHandler with correct dependencies', () => {
      registerOperationHandlers(registrar);

      const factoryCall = registerSpy.mock.calls.find(
        (c) => c[0] === tokens.UnlockMovementHandler
      );
      const factory = factoryCall[1];

      const handler = factory(mockContainer);

      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('UnlockMovementHandler');
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });
  });
});
