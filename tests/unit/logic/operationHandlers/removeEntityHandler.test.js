/**
 * @file Unit tests for RemoveEntityHandler
 * @see src/logic/operationHandlers/removeEntityHandler.js
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import RemoveEntityHandler from '../../../../src/logic/operationHandlers/removeEntityHandler.js';
import { INVENTORY_COMPONENT_ID } from '../../../../src/constants/componentIds.js';

describe('RemoveEntityHandler', () => {
  /** @type {ReturnType<typeof createMockDependencies>} */
  let mockDeps;
  /** @type {RemoveEntityHandler} */
  let handler;

  /**
   * Factory for mock dependencies.
   */
  const createMockDependencies = () => ({
    logger: {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    entityManager: {
      removeEntityInstance: jest.fn().mockResolvedValue(undefined),
      getEntitiesWithComponent: jest.fn().mockReturnValue([]),
      getComponentData: jest.fn().mockReturnValue(null),
      batchAddComponentsOptimized: jest.fn().mockResolvedValue(undefined),
      hasEntity: jest.fn().mockReturnValue(true),
    },
    safeEventDispatcher: {
      dispatch: jest.fn(),
    },
  });

  /**
   * Factory for a minimal execution context.
   * @param {object} [overrides] - Optional overrides for the context.
   * @returns {object} Execution context.
   */
  const createContext = (overrides = {}) => ({
    event: { type: 'test', payload: { targetId: 'entity:target_123' } },
    context: {},
    logger: mockDeps.logger,
    ...overrides,
  });

  beforeEach(() => {
    mockDeps = createMockDependencies();
    handler = new RemoveEntityHandler(mockDeps);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Constructor Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should throw if logger is missing', () => {
      expect(
        () =>
          new RemoveEntityHandler({
            entityManager: mockDeps.entityManager,
            safeEventDispatcher: mockDeps.safeEventDispatcher,
          })
      ).toThrow();
    });

    it('should throw if entityManager is missing', () => {
      expect(
        () =>
          new RemoveEntityHandler({
            logger: mockDeps.logger,
            safeEventDispatcher: mockDeps.safeEventDispatcher,
          })
      ).toThrow();
    });

    it('should throw if safeEventDispatcher is missing', () => {
      expect(
        () =>
          new RemoveEntityHandler({
            logger: mockDeps.logger,
            entityManager: mockDeps.entityManager,
          })
      ).toThrow();
    });

    it('should throw if entityManager is missing required methods', () => {
      expect(
        () =>
          new RemoveEntityHandler({
            logger: mockDeps.logger,
            entityManager: {},
            safeEventDispatcher: mockDeps.safeEventDispatcher,
          })
      ).toThrow();
    });

    it('should throw if safeEventDispatcher is missing dispatch method', () => {
      expect(
        () =>
          new RemoveEntityHandler({
            logger: mockDeps.logger,
            entityManager: mockDeps.entityManager,
            safeEventDispatcher: {},
          })
      ).toThrow();
    });

    it('should construct successfully with valid dependencies', () => {
      expect(() => new RemoveEntityHandler(mockDeps)).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Parameter Validation Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('parameter validation', () => {
    it('should return failure for null params', async () => {
      const result = await handler.execute(null, createContext());

      expect(result).toEqual({ success: false, error: 'validation_failed' });
    });

    it('should return failure for undefined params', async () => {
      const result = await handler.execute(undefined, createContext());

      expect(result).toEqual({ success: false, error: 'validation_failed' });
    });

    it('should return failure for missing entity_ref', async () => {
      const result = await handler.execute({}, createContext());

      expect(result).toEqual({ success: false, error: 'invalid_entity_ref' });
      expect(mockDeps.safeEventDispatcher.dispatch).toHaveBeenCalled();
    });

    it('should return failure for empty string entity_ref', async () => {
      const result = await handler.execute({ entity_ref: '' }, createContext());

      expect(result).toEqual({ success: false, error: 'invalid_entity_ref' });
      expect(mockDeps.safeEventDispatcher.dispatch).toHaveBeenCalled();
    });

    it('should return failure for whitespace-only entity_ref', async () => {
      const result = await handler.execute(
        { entity_ref: '   ' },
        createContext()
      );

      expect(result).toEqual({ success: false, error: 'invalid_entity_ref' });
    });

    it('should return failure for non-string entity_ref', async () => {
      const result = await handler.execute(
        { entity_ref: 123 },
        createContext()
      );

      expect(result).toEqual({ success: false, error: 'invalid_entity_ref' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Entity Resolution and Existence Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('entity resolution', () => {
    it('should return failure when entity does not exist', async () => {
      mockDeps.entityManager.hasEntity.mockReturnValue(false);

      const result = await handler.execute(
        { entity_ref: 'entity:nonexistent' },
        createContext()
      );

      expect(result).toEqual({ success: false, error: 'entity_not_found' });
      expect(mockDeps.entityManager.hasEntity).toHaveBeenCalledWith(
        'entity:nonexistent'
      );
    });

    it('should use entity_ref directly when it is a concrete ID', async () => {
      // Note: Template reference resolution (e.g., {event.payload.targetId})
      // is handled by resolveEntityId utility and tested in entityRefUtils tests.
      // This test verifies the handler passes the resolved ID correctly.
      mockDeps.entityManager.hasEntity.mockReturnValue(true);

      await handler.execute(
        { entity_ref: 'food:apple_tart_001' },
        createContext()
      );

      expect(mockDeps.entityManager.hasEntity).toHaveBeenCalledWith(
        'food:apple_tart_001'
      );
      expect(mockDeps.entityManager.removeEntityInstance).toHaveBeenCalledWith(
        'food:apple_tart_001'
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Successful Removal Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('successful removal', () => {
    it('should remove entity when not in any inventory', async () => {
      mockDeps.entityManager.hasEntity.mockReturnValue(true);
      mockDeps.entityManager.getEntitiesWithComponent.mockReturnValue([]);

      const result = await handler.execute(
        { entity_ref: 'food:apple_tart_001' },
        createContext()
      );

      expect(result).toEqual({ success: true });
      expect(mockDeps.entityManager.removeEntityInstance).toHaveBeenCalledWith(
        'food:apple_tart_001'
      );
    });

    it('should remove entity from inventory and then from game', async () => {
      const actorId = 'actor:player';
      const targetId = 'food:apple_tart_001';

      mockDeps.entityManager.hasEntity.mockReturnValue(true);
      mockDeps.entityManager.getEntitiesWithComponent.mockReturnValue([
        { id: actorId },
      ]);
      mockDeps.entityManager.getComponentData.mockReturnValue({
        items: [targetId, 'item:other'],
      });

      const result = await handler.execute(
        { entity_ref: targetId },
        createContext()
      );

      expect(result).toEqual({
        success: true,
        removedFromInventory: actorId,
      });

      // Verify inventory was updated
      expect(
        mockDeps.entityManager.batchAddComponentsOptimized
      ).toHaveBeenCalledWith(
        [
          {
            instanceId: actorId,
            componentTypeId: INVENTORY_COMPONENT_ID,
            componentData: { items: ['item:other'] },
          },
        ],
        true
      );

      // Verify entity was removed
      expect(mockDeps.entityManager.removeEntityInstance).toHaveBeenCalledWith(
        targetId
      );
    });

    it('should skip inventory cleanup when cleanup_inventory is false', async () => {
      const targetId = 'food:apple_tart_001';

      mockDeps.entityManager.hasEntity.mockReturnValue(true);

      const result = await handler.execute(
        { entity_ref: targetId, cleanup_inventory: false },
        createContext()
      );

      expect(result).toEqual({ success: true });
      expect(
        mockDeps.entityManager.getEntitiesWithComponent
      ).not.toHaveBeenCalled();
      expect(mockDeps.entityManager.removeEntityInstance).toHaveBeenCalledWith(
        targetId
      );
    });

    it('should handle entity not in any inventory when cleanup_inventory is true', async () => {
      const targetId = 'food:apple_tart_001';

      mockDeps.entityManager.hasEntity.mockReturnValue(true);
      mockDeps.entityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'actor:npc' },
      ]);
      mockDeps.entityManager.getComponentData.mockReturnValue({
        items: ['item:sword', 'item:shield'],
      });

      const result = await handler.execute(
        { entity_ref: targetId },
        createContext()
      );

      expect(result).toEqual({ success: true });
      expect(
        mockDeps.entityManager.batchAddComponentsOptimized
      ).not.toHaveBeenCalled();
      expect(mockDeps.entityManager.removeEntityInstance).toHaveBeenCalledWith(
        targetId
      );
    });

    it('should trim whitespace from entity_ref', async () => {
      mockDeps.entityManager.hasEntity.mockReturnValue(true);

      await handler.execute(
        { entity_ref: '  food:apple_tart_001  ' },
        createContext()
      );

      expect(mockDeps.entityManager.hasEntity).toHaveBeenCalledWith(
        'food:apple_tart_001'
      );
      expect(mockDeps.entityManager.removeEntityInstance).toHaveBeenCalledWith(
        'food:apple_tart_001'
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Result Variable Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('result_variable', () => {
    it('should store result in context when result_variable is specified', async () => {
      const targetId = 'food:apple_tart_001';
      mockDeps.entityManager.hasEntity.mockReturnValue(true);
      mockDeps.entityManager.getEntitiesWithComponent.mockReturnValue([]);

      const context = createContext();
      await handler.execute(
        { entity_ref: targetId, result_variable: 'removalResult' },
        context
      );

      expect(context.context.removalResult).toEqual({ success: true });
    });

    it('should store result with removedFromInventory when applicable', async () => {
      const actorId = 'actor:player';
      const targetId = 'food:apple_tart_001';

      mockDeps.entityManager.hasEntity.mockReturnValue(true);
      mockDeps.entityManager.getEntitiesWithComponent.mockReturnValue([
        { id: actorId },
      ]);
      mockDeps.entityManager.getComponentData.mockReturnValue({
        items: [targetId],
      });

      const context = createContext();
      await handler.execute(
        { entity_ref: targetId, result_variable: 'removalResult' },
        context
      );

      expect(context.context.removalResult).toEqual({
        success: true,
        removedFromInventory: actorId,
      });
    });

    it('should not store result when result_variable is not specified', async () => {
      mockDeps.entityManager.hasEntity.mockReturnValue(true);

      const context = createContext();
      await handler.execute(
        { entity_ref: 'food:apple_tart_001' },
        context
      );

      expect(context.context).toEqual({});
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Error Handling Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('should return failure and dispatch error when removeEntityInstance throws', async () => {
      const targetId = 'food:apple_tart_001';
      const errorMessage = 'Database connection failed';

      mockDeps.entityManager.hasEntity.mockReturnValue(true);
      mockDeps.entityManager.getEntitiesWithComponent.mockReturnValue([]);
      mockDeps.entityManager.removeEntityInstance.mockRejectedValue(
        new Error(errorMessage)
      );

      const result = await handler.execute(
        { entity_ref: targetId },
        createContext()
      );

      expect(result).toEqual({ success: false, error: errorMessage });
      expect(mockDeps.safeEventDispatcher.dispatch).toHaveBeenCalled();
    });

    it('should return failure when inventory cleanup throws', async () => {
      const targetId = 'food:apple_tart_001';
      const errorMessage = 'Inventory update failed';

      mockDeps.entityManager.hasEntity.mockReturnValue(true);
      mockDeps.entityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'actor:player' },
      ]);
      mockDeps.entityManager.getComponentData.mockReturnValue({
        items: [targetId],
      });
      mockDeps.entityManager.batchAddComponentsOptimized.mockRejectedValue(
        new Error(errorMessage)
      );

      const result = await handler.execute(
        { entity_ref: targetId },
        createContext()
      );

      expect(result).toEqual({ success: false, error: errorMessage });
      expect(mockDeps.safeEventDispatcher.dispatch).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge Cases
  // ─────────────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle inventory with null items array', async () => {
      mockDeps.entityManager.hasEntity.mockReturnValue(true);
      mockDeps.entityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'actor:player' },
      ]);
      mockDeps.entityManager.getComponentData.mockReturnValue({
        items: null,
      });

      const result = await handler.execute(
        { entity_ref: 'food:apple_tart_001' },
        createContext()
      );

      expect(result).toEqual({ success: true });
      expect(
        mockDeps.entityManager.batchAddComponentsOptimized
      ).not.toHaveBeenCalled();
    });

    it('should handle inventory with undefined items array', async () => {
      mockDeps.entityManager.hasEntity.mockReturnValue(true);
      mockDeps.entityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'actor:player' },
      ]);
      mockDeps.entityManager.getComponentData.mockReturnValue({});

      const result = await handler.execute(
        { entity_ref: 'food:apple_tart_001' },
        createContext()
      );

      expect(result).toEqual({ success: true });
    });

    it('should handle null inventory component data', async () => {
      mockDeps.entityManager.hasEntity.mockReturnValue(true);
      mockDeps.entityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'actor:player' },
      ]);
      mockDeps.entityManager.getComponentData.mockReturnValue(null);

      const result = await handler.execute(
        { entity_ref: 'food:apple_tart_001' },
        createContext()
      );

      expect(result).toEqual({ success: true });
    });

    it('should find entity in second inventory when multiple exist', async () => {
      const targetId = 'food:apple_tart_001';
      const ownerWithTarget = 'actor:npc_2';

      mockDeps.entityManager.hasEntity.mockReturnValue(true);
      mockDeps.entityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'actor:npc_1' },
        { id: ownerWithTarget },
      ]);
      mockDeps.entityManager.getComponentData
        .mockReturnValueOnce({ items: ['item:sword'] }) // npc_1
        .mockReturnValueOnce({ items: [targetId] }); // npc_2

      const result = await handler.execute(
        { entity_ref: targetId },
        createContext()
      );

      expect(result).toEqual({
        success: true,
        removedFromInventory: ownerWithTarget,
      });
    });
  });
});
