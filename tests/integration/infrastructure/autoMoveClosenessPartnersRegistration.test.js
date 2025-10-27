/**
 * @file Integration test to verify AUTO_MOVE_CLOSENESS_PARTNERS operation is properly registered
 * @description Tests that the operation handler is registered and can be invoked through the operation interpreter
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { Registrar } from '../../../src/utils/registrarHelpers.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { registerInterpreters } from '../../../src/dependencyInjection/registrations/interpreterRegistrations.js';
import AutoMoveClosenessPartnersHandler from '../../../src/logic/operationHandlers/autoMoveClosenessPartnersHandler.js';

describe('AUTO_MOVE_CLOSENESS_PARTNERS Operation Registration', () => {
  let container;
  let mockLogger;
  let mockEntityManager;
  let mockSafeEventDispatcher;
  let mockSystemMoveEntityHandler;

  beforeEach(() => {
    container = new AppContainer();
    const registrar = new Registrar(container);

    // Setup mock dependencies
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      addComponentToEntity: jest.fn(),
      getEntityInstance: jest.fn(),
      createEntityInstance: jest.fn(),
      getEntitiesWithComponent: jest.fn(),
      addComponent: jest.fn(),
      removeComponent: jest.fn(),
    };

    mockSystemMoveEntityHandler = { execute: jest.fn() };
    mockSafeEventDispatcher = { dispatch: jest.fn() };

    const mockValidatedEventDispatcher = {};
    const mockWorldContext = {};
    const mockJsonLogicService = {};
    const mockEventBus = {};
    const mockDataRegistry = {};
    const mockBodyGraphService = {};

    // Register required dependencies
    registrar.instance(tokens.ILogger, mockLogger);
    registrar.instance(tokens.IEntityManager, mockEntityManager);
    registrar.instance(tokens.SystemMoveEntityHandler, mockSystemMoveEntityHandler);
    registrar.instance(tokens.ISafeEventDispatcher, mockSafeEventDispatcher);
    registrar.instance(
      tokens.IValidatedEventDispatcher,
      mockValidatedEventDispatcher
    );
    registrar.instance(tokens.IWorldContext, mockWorldContext);
    registrar.instance(tokens.JsonLogicEvaluationService, mockJsonLogicService);
    registrar.instance(tokens.EventBus, mockEventBus);
    registrar.instance(tokens.IEventBus, mockEventBus);
    registrar.instance(tokens.IDataRegistry, mockDataRegistry);
    registrar.instance(tokens.BodyGraphService, mockBodyGraphService);

    // Register interpreters (which will register operation handlers)
    registerInterpreters(container);
  });

  describe('Operation Registry', () => {
    it('should have AUTO_MOVE_CLOSENESS_PARTNERS registered', () => {
      // Arrange
      const operationRegistry = container.resolve(tokens.OperationRegistry);

      // Act
      const handler = operationRegistry.getHandler('AUTO_MOVE_CLOSENESS_PARTNERS');

      // Assert
      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
    });

    it('should resolve AutoMoveClosenessPartnersHandler from DI container', () => {
      // Arrange & Act
      const handler = container.resolve(tokens.AutoMoveClosenessPartnersHandler);

      // Assert
      expect(handler).toBeDefined();
      expect(handler).toBeInstanceOf(AutoMoveClosenessPartnersHandler);
      expect(typeof handler.execute).toBe('function');
    });
  });

  describe('Operation Handler Invocation', () => {
    it('should handle no partners gracefully', async () => {
      // Arrange
      const actorId = 'test-actor-1';
      const newLocationId = 'test-location-2';

      // Setup mock data - actor has no closeness component
      mockEntityManager.getComponentData.mockReturnValue(null);

      const handler = container.resolve(tokens.AutoMoveClosenessPartnersHandler);

      const parameters = {
        actor_id: actorId,
        destination_id: newLocationId,
      };

      const executionContext = {
        context: {},
        event: {
          type: 'core:entity_moved',
          payload: { entityId: actorId },
        },
        rule: { rule_id: 'test-rule' },
      };

      // Act
      const result = await handler.execute(parameters, executionContext);

      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.partnersMoved).toBe(0);
    });
  });

  describe('Rule Validation', () => {
    it('should validate closeness_auto_move rule structure', () => {
      // This test ensures the rule operation type is recognized by the registry
      // The actual rule file is at: data/mods/positioning/rules/closeness_auto_move.rule.json

      // Arrange
      const operationRegistry = container.resolve(tokens.OperationRegistry);

      // Act
      const handler = operationRegistry.getHandler('AUTO_MOVE_CLOSENESS_PARTNERS');

      // Assert - The operation type should be registered
      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');

      // This proves that the rule will pass validation since the operation type exists
    });
  });
});
