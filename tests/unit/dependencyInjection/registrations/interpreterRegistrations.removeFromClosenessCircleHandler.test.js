/**
 * @file Tests for RemoveFromClosenessCircleHandler DI registration.
 */
import { describe, it, expect, jest } from '@jest/globals';
import AppContainer from '../../../../src/dependencyInjection/appContainer';
import { Registrar } from '../../../../src/utils/registrarHelpers';
import { tokens } from '../../../../src/dependencyInjection/tokens';
import { registerInterpreters } from '../../../../src/dependencyInjection/registrations/interpreterRegistrations';
import RemoveFromClosenessCircleHandler from '../../../../src/logic/operationHandlers/removeFromClosenessCircleHandler.js';

describe('interpreterRegistrations', () => {
  describe('RemoveFromClosenessCircleHandler Registration', () => {
    let container;

    beforeEach(() => {
      container = new AppContainer();
      const registrar = new Registrar(container);

      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      const mockEntityManager = {
        getComponentData: jest.fn(),
        addComponent: jest.fn(),
        removeComponent: jest.fn(),
      };
      const mockSafeEventDispatcher = { dispatch: jest.fn() };
      const mockValidatedEventDispatcher = {};
      const mockWorldContext = {};
      const mockJsonLogicService = {};
      const mockOperationRegistry = {};
      const mockEventBus = {};
      const mockDataRegistry = {};

      registrar.instance(tokens.ILogger, mockLogger);
      registrar.instance(tokens.IEntityManager, mockEntityManager);
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

      // Register a mock closenessCircleService
      container.register(tokens.ClosenessCircleService, { repair: jest.fn() });

      registerInterpreters(container);
    });

    it('resolves RemoveFromClosenessCircleHandler with dependencies', () => {
      let handler;
      let resolutionError;
      try {
        handler = container.resolve(tokens.RemoveFromClosenessCircleHandler);
      } catch (err) {
        resolutionError = err;
      }

      expect(resolutionError).toBeUndefined();
      expect(handler).toBeInstanceOf(RemoveFromClosenessCircleHandler);
    });
  });
});
