import { describe, it, expect, jest } from '@jest/globals';
import AppContainer from '../../../../src/dependencyInjection/appContainer';
import { Registrar } from '../../../../src/utils/registrarHelpers';
import { tokens } from '../../../../src/dependencyInjection/tokens';
import { registerInterpreters } from '../../../../src/dependencyInjection/registrations/interpreterRegistrations';
import AutoMoveFollowersHandler from '../../../../src/logic/operationHandlers/autoMoveFollowersHandler.js';
import MergeClosenessCircleHandler from '../../../../src/logic/operationHandlers/mergeClosenessCircleHandler.js';

describe('interpreterRegistrations', () => {
  describe('AutoMoveFollowersHandler and MergeClosenessCircleHandler Registration', () => {
    it('resolves both handlers with dependencies', () => {
      const container = new AppContainer();
      const registrar = new Registrar(container);

      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      const mockEntityManager = {
        getEntitiesWithComponent: jest.fn(),
        getComponentData: jest.fn(),
        addComponent: jest.fn(),
        removeComponent: jest.fn(),
      };
      const mockSystemMoveEntityHandler = { execute: jest.fn() };
      const mockSafeEventDispatcher = { dispatch: jest.fn() };
      const mockValidatedEventDispatcher = {};
      const mockWorldContext = {};
      const mockJsonLogicService = {};
      const mockOperationRegistry = {};
      const mockEventBus = {};
      const mockDataRegistry = {};

      registrar.instance(tokens.ILogger, mockLogger);
      registrar.instance(tokens.IEntityManager, mockEntityManager);
      registrar.instance(
        tokens.SystemMoveEntityHandler,
        mockSystemMoveEntityHandler
      );
      registrar.instance(tokens.ISafeEventDispatcher, mockSafeEventDispatcher);
      registrar.instance(
        tokens.IValidatedEventDispatcher,
        mockValidatedEventDispatcher
      );
      registrar.instance(tokens.IWorldContext, mockWorldContext);
      registrar.instance(
        tokens.JsonLogicEvaluationService,
        mockJsonLogicService
      );
      registrar.instance(tokens.OperationRegistry, mockOperationRegistry);
      registrar.instance(tokens.EventBus, mockEventBus);
      registrar.instance(tokens.IDataRegistry, mockDataRegistry);

      container.register(tokens.ClosenessCircleService, { merge: jest.fn() });
      registerInterpreters(container);

      let autoHandler;
      let mergeHandler;
      let resolutionError;
      try {
        autoHandler = container.resolve(tokens.AutoMoveFollowersHandler);
        mergeHandler = container.resolve(tokens.MergeClosenessCircleHandler);
      } catch (err) {
        resolutionError = err;
      }

      expect(resolutionError).toBeUndefined();
      expect(autoHandler).toBeInstanceOf(AutoMoveFollowersHandler);
      expect(mergeHandler).toBeInstanceOf(MergeClosenessCircleHandler);
    });
  });

  describe('OperationRegistry binds new handlers', () => {
    it('invokes the underlying handler when registered operations are called', () => {
      const container = new AppContainer();
      const registrar = new Registrar(container);
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      registrar.instance(tokens.ILogger, mockLogger);

      container.register(tokens.ClosenessCircleService, { merge: jest.fn() });
      registerInterpreters(container);

      const mockAutoMoveFollowersHandler = { execute: jest.fn() };
      const mockMergeClosenessCircleHandler = { execute: jest.fn() };
      registrar.instance(
        tokens.AutoMoveFollowersHandler,
        mockAutoMoveFollowersHandler
      );
      registrar.instance(
        tokens.MergeClosenessCircleHandler,
        mockMergeClosenessCircleHandler
      );

      const registry = container.resolve(tokens.OperationRegistry);
      const autoOp = registry.getHandler('AUTO_MOVE_FOLLOWERS');
      const mergeOp = registry.getHandler('MERGE_CLOSENESS_CIRCLE');

      const params = { leader_id: 'a', destination_id: 'b' };
      const context = { evaluationContext: {} };
      autoOp(params, context);
      mergeOp(params, context);

      expect(mockAutoMoveFollowersHandler.execute).toHaveBeenCalledWith(
        params,
        context
      );
      expect(mockMergeClosenessCircleHandler.execute).toHaveBeenCalledWith(
        params,
        context
      );
    });
  });
});
