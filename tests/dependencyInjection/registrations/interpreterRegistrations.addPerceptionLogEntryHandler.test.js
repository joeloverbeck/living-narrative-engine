/**
 * @file Integration tests for interpreter-layer service registrations.
 * @see tests/dependencyInjection/registrations/interpreterRegistrations.addPerceptionLogEntryHandler.test.js
 */

import { describe, it, expect, jest } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer';
import { Registrar } from '../../../src/dependencyInjection/registrarHelpers';
import { tokens } from '../../../src/dependencyInjection/tokens';
import { registerInterpreters } from '../../../src/dependencyInjection/registrations/interpreterRegistrations';
import AddPerceptionLogEntryHandler from '../../../src/logic/operationHandlers/addPerceptionLogEntryHandler';

describe('interpreterRegistrations', () => {
  describe('AddPerceptionLogEntryHandler Registration', () => {
    it('should resolve AddPerceptionLogEntryHandler with all its dependencies without error', () => {
      // Arrange
      const container = new AppContainer();
      const registrar = new Registrar(container);

      // Mock all necessary dependencies for the handlers
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      // --- FIX START ---
      // The original mock was an empty object `{}`. The AddPerceptionLogEntryHandler
      // constructor requires an `entityManager` with a `getEntitiesInLocation` method.
      // This mock now satisfies that contract.
      const mockEntityManager = {
        getEntitiesInLocation: jest.fn(),
        hasComponent: jest.fn(),
        getComponentData: jest.fn(),
        addComponent: jest.fn(),
      };
      // --- FIX END ---

      const mockSafeEventDispatcher = {
        dispatch: jest.fn(),
      };
      const mockValidatedEventDispatcher = {};
      const mockWorldContext = {};
      const mockJsonLogicService = {};
      const mockOperationRegistry = {};
      const mockEventBus = {};
      const mockDataRegistry = {};

      // Register mock dependencies
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

      // Act
      // Run the actual registration function
      registerInterpreters(container);

      let handler;
      let resolutionError;

      // Try to resolve the handler and catch any potential error
      try {
        handler = container.resolve(tokens.AddPerceptionLogEntryHandler);
      } catch (error) {
        resolutionError = error;
      }

      // Assert
      // This is the core of the test. We ensure no error was thrown during resolution.
      expect(resolutionError).toBeUndefined();
      // We also verify that the resolved object is of the correct type.
      expect(handler).toBeInstanceOf(AddPerceptionLogEntryHandler);
    });
  });
});
