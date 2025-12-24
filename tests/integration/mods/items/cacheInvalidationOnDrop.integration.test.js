/**
 * @file Integration test for AvailableActionsProvider cache invalidation on component changes
 * @description Verifies that the cache invalidates when items are dropped, allowing pickup actions to appear
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AvailableActionsProvider } from '../../../../src/data/providers/availableActionsProvider.js';
import {
  COMPONENT_ADDED_ID,
  COMPONENTS_BATCH_ADDED_ID,
} from '../../../../src/constants/eventIds.js';

describe('AvailableActionsProvider - Cache Invalidation Integration', () => {
  let provider;
  let mockDiscoveryService;
  let mockIndexer;
  let mockEntityManager;
  let mockEventBus;
  let mockLogger;
  let eventHandlers;

  beforeEach(() => {
    // Track event subscriptions
    eventHandlers = new Map();

    // Mock discovery service
    mockDiscoveryService = {
      getValidActions: jest.fn().mockResolvedValue({
        actions: [{ id: 'core:wait', command: 'Wait', params: {} }],
        errors: [],
        trace: null,
      }),
    };

    // Mock indexer
    mockIndexer = {
      index: jest.fn((actions) => actions),
    };

    // Mock entity manager
    mockEntityManager = {
      getEntityInstance: jest.fn().mockResolvedValue(null),
    };

    // Mock event bus with subscription tracking
    mockEventBus = {
      subscribe: jest.fn((eventType, handler) => {
        eventHandlers.set(eventType, handler);
        return { eventType, handler };
      }),
      unsubscribe: jest.fn(),
    };

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create provider instance
    provider = new AvailableActionsProvider({
      actionDiscoveryService: mockDiscoveryService,
      actionIndexingService: mockIndexer,
      entityManager: mockEntityManager,
      eventBus: mockEventBus,
      logger: mockLogger,
    });
  });

  describe('Event Subscription Setup', () => {
    it('should subscribe to COMPONENT_ADDED_ID event on construction', () => {
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        COMPONENT_ADDED_ID,
        expect.any(Function)
      );
    });

    it('should subscribe to COMPONENTS_BATCH_ADDED_ID event on construction', () => {
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        COMPONENTS_BATCH_ADDED_ID,
        expect.any(Function)
      );
    });

    it('should subscribe to exactly 2 events', () => {
      expect(mockEventBus.subscribe).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache Invalidation on Component Changes', () => {
    let actor;
    let turnContext;

    beforeEach(() => {
      actor = {
        id: 'actor_1',
        getComponentData: jest.fn().mockReturnValue(null),
      };
      turnContext = { game: {}, turnNumber: 1 };
    });

    it('should invalidate cache when core:position component is added', async () => {
      // First call - should cache results
      await provider.get(actor, turnContext, mockLogger);
      expect(mockDiscoveryService.getValidActions).toHaveBeenCalledTimes(1);

      // Fire component added event with core:position
      const handler = eventHandlers.get(COMPONENT_ADDED_ID);
      handler({
        type: COMPONENT_ADDED_ID,
        payload: { componentTypeId: 'core:position' },
      });

      // Second call - should NOT use cache (discovery called again)
      await provider.get(actor, turnContext, mockLogger);
      expect(mockDiscoveryService.getValidActions).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache when items-core:portable component is added', async () => {
      // First call - should cache results
      await provider.get(actor, turnContext, mockLogger);
      expect(mockDiscoveryService.getValidActions).toHaveBeenCalledTimes(1);

      // Fire component added event with items-core:portable
      const handler = eventHandlers.get(COMPONENT_ADDED_ID);
      handler({
        type: COMPONENT_ADDED_ID,
        payload: { componentTypeId: 'items-core:portable' },
      });

      // Second call - should NOT use cache
      await provider.get(actor, turnContext, mockLogger);
      expect(mockDiscoveryService.getValidActions).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache when containers-core:container component is added', async () => {
      // First call - should cache results
      await provider.get(actor, turnContext, mockLogger);
      expect(mockDiscoveryService.getValidActions).toHaveBeenCalledTimes(1);

      // Fire component added event with containers-core:container
      const handler = eventHandlers.get(COMPONENT_ADDED_ID);
      handler({
        type: COMPONENT_ADDED_ID,
        payload: { componentTypeId: 'containers-core:container' },
      });

      // Second call - should NOT use cache
      await provider.get(actor, turnContext, mockLogger);
      expect(mockDiscoveryService.getValidActions).toHaveBeenCalledTimes(2);
    });

    it('should NOT invalidate cache for unrelated component changes', async () => {
      // First call - should cache results
      await provider.get(actor, turnContext, mockLogger);
      expect(mockDiscoveryService.getValidActions).toHaveBeenCalledTimes(1);

      // Fire component added event with unrelated component
      const handler = eventHandlers.get(COMPONENT_ADDED_ID);
      handler({
        type: COMPONENT_ADDED_ID,
        payload: { componentTypeId: 'core:actor' },
      });

      // Second call - SHOULD use cache (discovery NOT called again)
      await provider.get(actor, turnContext, mockLogger);
      expect(mockDiscoveryService.getValidActions).toHaveBeenCalledTimes(1);
    });

    it('should handle batch component changes with core:position', async () => {
      // First call - should cache results
      await provider.get(actor, turnContext, mockLogger);
      expect(mockDiscoveryService.getValidActions).toHaveBeenCalledTimes(1);

      // Fire batch component added event
      const handler = eventHandlers.get(COMPONENTS_BATCH_ADDED_ID);
      handler({
        type: COMPONENTS_BATCH_ADDED_ID,
        payload: {
          componentTypeIds: ['core:actor', 'core:position', 'items-core:portable'],
        },
      });

      // Second call - should NOT use cache
      await provider.get(actor, turnContext, mockLogger);
      expect(mockDiscoveryService.getValidActions).toHaveBeenCalledTimes(2);
    });

    it('should NOT invalidate cache for batch changes without action-affecting components', async () => {
      // First call - should cache results
      await provider.get(actor, turnContext, mockLogger);
      expect(mockDiscoveryService.getValidActions).toHaveBeenCalledTimes(1);

      // Fire batch component added event with only unrelated components
      const handler = eventHandlers.get(COMPONENTS_BATCH_ADDED_ID);
      handler({
        type: COMPONENTS_BATCH_ADDED_ID,
        payload: {
          componentTypeIds: ['core:actor', 'core:health'],
        },
      });

      // Second call - SHOULD use cache
      await provider.get(actor, turnContext, mockLogger);
      expect(mockDiscoveryService.getValidActions).toHaveBeenCalledTimes(1);
    });

    it('should handle events with missing payload gracefully', async () => {
      // First call - should cache results
      await provider.get(actor, turnContext, mockLogger);
      expect(mockDiscoveryService.getValidActions).toHaveBeenCalledTimes(1);

      // Fire event with no payload
      const handler = eventHandlers.get(COMPONENT_ADDED_ID);
      handler({ type: COMPONENT_ADDED_ID });

      // Should not crash, cache should remain intact
      await provider.get(actor, turnContext, mockLogger);
      expect(mockDiscoveryService.getValidActions).toHaveBeenCalledTimes(1);
    });

    it('should log cache invalidation when action-affecting component changes', async () => {
      await provider.get(actor, turnContext, mockLogger);

      // Fire component added event
      const handler = eventHandlers.get(COMPONENT_ADDED_ID);
      handler({
        type: COMPONENT_ADDED_ID,
        payload: { componentTypeId: 'core:position' },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'AvailableActionsProvider: Cache invalidated due to core:position component change'
        )
      );
    });
  });

  describe('Drop-Pickup Workflow Simulation', () => {
    let actor;
    let turnContext;

    beforeEach(() => {
      actor = {
        id: 'actor_1',
        getComponentData: jest.fn().mockReturnValue({ locationId: 'room_1' }),
      };
      turnContext = { game: {}, turnNumber: 1 };
    });

    it('should discover pickup actions after item drop adds core:position', async () => {
      // Simulate initial action discovery (no items on ground)
      mockDiscoveryService.getValidActions.mockResolvedValueOnce({
        actions: [{ id: 'core:wait', command: 'Wait', params: {} }],
        errors: [],
        trace: null,
      });

      const initialActions = await provider.get(actor, turnContext, mockLogger);
      expect(initialActions).toHaveLength(1);
      expect(initialActions[0].id).toBe('core:wait');

      // Simulate item being dropped - core:position component added to item
      const handler = eventHandlers.get(COMPONENT_ADDED_ID);
      handler({
        type: COMPONENT_ADDED_ID,
        payload: { componentTypeId: 'core:position' },
      });

      // Simulate UI refresh - now pickup action should be available
      mockDiscoveryService.getValidActions.mockResolvedValueOnce({
        actions: [
          { id: 'core:wait', command: 'Wait', params: {} },
          {
            id: 'item-handling:pick_up_item',
            command: 'Pick up sword',
            params: { target: 'sword_1' },
          },
        ],
        errors: [],
        trace: null,
      });

      const updatedActions = await provider.get(actor, turnContext, mockLogger);
      expect(updatedActions).toHaveLength(2);
      expect(updatedActions.some((a) => a.id === 'item-handling:pick_up_item')).toBe(
        true
      );
      expect(mockDiscoveryService.getValidActions).toHaveBeenCalledTimes(2);
    });
  });

  describe('Destroy Method', () => {
    it('should unsubscribe from all events on destroy', () => {
      provider.destroy();

      expect(mockEventBus.unsubscribe).toHaveBeenCalledTimes(2);
    });

    it('should clear cache on destroy', async () => {
      const actor = {
        id: 'actor_1',
        getComponentData: jest.fn().mockReturnValue(null),
      };
      const turnContext = { game: {}, turnNumber: 1 };

      // Cache some results
      await provider.get(actor, turnContext, mockLogger);
      expect(mockDiscoveryService.getValidActions).toHaveBeenCalledTimes(1);

      // Destroy provider
      provider.destroy();

      // Verify cleanup message was logged
      const cleanupCalls = mockLogger.debug.mock.calls.filter((call) =>
        call[0].includes('Destroyed and cleaned up')
      );
      expect(cleanupCalls.length).toBeGreaterThan(0);
    });
  });
});
