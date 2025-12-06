/**
 * @file Unit tests for setupEntityCacheInvalidation function in entityHelpers
 * @description Tests the automatic entity cache invalidation setup via event bus
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
  COMPONENTS_BATCH_ADDED_ID,
} from '../../../../src/constants/eventIds.js';

describe('setupEntityCacheInvalidation', () => {
  let mockEventBus;
  let subscribedListeners;
  let setupEntityCacheInvalidation;
  let invalidateEntityCache;
  let entityHelpersModule;

  beforeEach(() => {
    // Reset the eventBusInstance by reimporting the module
    // This is necessary because setupEntityCacheInvalidation has an idempotency guard
    jest.resetModules();

    // Re-require the module to get fresh state
    entityHelpersModule = require('../../../../src/scopeDsl/core/entityHelpers.js');
    setupEntityCacheInvalidation =
      entityHelpersModule.setupEntityCacheInvalidation;
    invalidateEntityCache = entityHelpersModule.invalidateEntityCache;
    const { clearEntityCache } = entityHelpersModule;
    clearEntityCache();

    // Reset subscribers
    subscribedListeners = new Map();

    // Create mock event bus that tracks subscriptions
    mockEventBus = {
      subscribe: jest.fn((eventName, listener) => {
        if (!subscribedListeners.has(eventName)) {
          subscribedListeners.set(eventName, []);
        }
        subscribedListeners.get(eventName).push(listener);
        return () => {
          const listeners = subscribedListeners.get(eventName);
          const index = listeners.indexOf(listener);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        };
      }),
    };
  });

  describe('Basic Setup', () => {
    it('should subscribe to COMPONENTS_BATCH_ADDED event', () => {
      setupEntityCacheInvalidation(mockEventBus);

      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        COMPONENTS_BATCH_ADDED_ID,
        expect.any(Function)
      );
    });

    it('should subscribe to COMPONENT_ADDED event', () => {
      setupEntityCacheInvalidation(mockEventBus);

      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        COMPONENT_ADDED_ID,
        expect.any(Function)
      );
    });

    it('should subscribe to COMPONENT_REMOVED event', () => {
      setupEntityCacheInvalidation(mockEventBus);

      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        COMPONENT_REMOVED_ID,
        expect.any(Function)
      );
    });

    it('should subscribe to exactly three events', () => {
      setupEntityCacheInvalidation(mockEventBus);

      expect(mockEventBus.subscribe).toHaveBeenCalledTimes(3);
    });
  });

  describe('Idempotency', () => {
    it('should not subscribe multiple times when called repeatedly', () => {
      setupEntityCacheInvalidation(mockEventBus);
      setupEntityCacheInvalidation(mockEventBus);
      setupEntityCacheInvalidation(mockEventBus);

      // Should only subscribe once per event type
      expect(mockEventBus.subscribe).toHaveBeenCalledTimes(3);
    });

    it('should return early on subsequent calls', () => {
      setupEntityCacheInvalidation(mockEventBus);
      mockEventBus.subscribe.mockClear();

      setupEntityCacheInvalidation(mockEventBus);

      expect(mockEventBus.subscribe).not.toHaveBeenCalled();
    });
  });

  describe('Event Handling - COMPONENTS_BATCH_ADDED', () => {
    it('should handle batch updates without throwing errors', () => {
      setupEntityCacheInvalidation(mockEventBus);

      // Get the listener for COMPONENTS_BATCH_ADDED
      const listeners = subscribedListeners.get(COMPONENTS_BATCH_ADDED_ID);
      expect(listeners).toBeDefined();
      expect(listeners.length).toBe(1);

      const listener = listeners[0];

      // Verify that calling the listener with valid batch updates doesn't throw
      expect(() => {
        listener({
          type: COMPONENTS_BATCH_ADDED_ID,
          payload: {
            updates: [
              { instanceId: 'entity1' },
              { instanceId: 'entity2' },
              { instanceId: 'entity3' },
            ],
          },
        });
      }).not.toThrow();
    });

    it('should handle empty updates array', () => {
      setupEntityCacheInvalidation(mockEventBus);

      const listeners = subscribedListeners.get(COMPONENTS_BATCH_ADDED_ID);
      const listener = listeners[0];

      // Should not throw error
      expect(() => {
        listener({
          type: COMPONENTS_BATCH_ADDED_ID,
          payload: { updates: [] },
        });
      }).not.toThrow();
    });

    it('should handle missing instanceId in updates', () => {
      setupEntityCacheInvalidation(mockEventBus);

      const listeners = subscribedListeners.get(COMPONENTS_BATCH_ADDED_ID);
      const listener = listeners[0];

      // Verify that calling the listener with mixed updates doesn't throw
      expect(() => {
        listener({
          type: COMPONENTS_BATCH_ADDED_ID,
          payload: {
            updates: [{ instanceId: 'entity1' }, { otherField: 'value' }],
          },
        });
      }).not.toThrow();
    });

    it('should handle null or undefined payload', () => {
      setupEntityCacheInvalidation(mockEventBus);

      const listeners = subscribedListeners.get(COMPONENTS_BATCH_ADDED_ID);
      const listener = listeners[0];

      // Should not throw error
      expect(() => {
        listener({ type: COMPONENTS_BATCH_ADDED_ID, payload: null });
      }).not.toThrow();

      expect(() => {
        listener({ type: COMPONENTS_BATCH_ADDED_ID });
      }).not.toThrow();
    });
  });

  describe('Event Handling - COMPONENT_ADDED', () => {
    it('should handle component additions without throwing errors', () => {
      setupEntityCacheInvalidation(mockEventBus);

      const listeners = subscribedListeners.get(COMPONENT_ADDED_ID);
      const listener = listeners[0];

      // Verify that calling the listener with valid entity doesn't throw
      expect(() => {
        listener({
          type: COMPONENT_ADDED_ID,
          payload: { entity: { id: 'test-entity' } },
        });
      }).not.toThrow();
    });

    it('should handle missing entity in payload', () => {
      setupEntityCacheInvalidation(mockEventBus);

      const listeners = subscribedListeners.get(COMPONENT_ADDED_ID);
      const listener = listeners[0];

      expect(() => {
        listener({ type: COMPONENT_ADDED_ID, payload: {} });
      }).not.toThrow();
    });

    it('should handle missing entity.id in payload', () => {
      setupEntityCacheInvalidation(mockEventBus);

      const listeners = subscribedListeners.get(COMPONENT_ADDED_ID);
      const listener = listeners[0];

      // Verify that calling the listener with entity missing ID doesn't throw
      expect(() => {
        listener({
          type: COMPONENT_ADDED_ID,
          payload: { entity: { name: 'test' } },
        });
      }).not.toThrow();
    });
  });

  describe('Event Handling - COMPONENT_REMOVED', () => {
    it('should handle component removals without throwing errors', () => {
      setupEntityCacheInvalidation(mockEventBus);

      const listeners = subscribedListeners.get(COMPONENT_REMOVED_ID);
      const listener = listeners[0];

      // Verify that calling the listener with valid entity doesn't throw
      expect(() => {
        listener({
          type: COMPONENT_REMOVED_ID,
          payload: { entity: { id: 'test-entity' } },
        });
      }).not.toThrow();
    });

    it('should handle missing entity in payload', () => {
      setupEntityCacheInvalidation(mockEventBus);

      const listeners = subscribedListeners.get(COMPONENT_REMOVED_ID);
      const listener = listeners[0];

      expect(() => {
        listener({ type: COMPONENT_REMOVED_ID, payload: {} });
      }).not.toThrow();
    });

    it('should handle null payload', () => {
      setupEntityCacheInvalidation(mockEventBus);

      const listeners = subscribedListeners.get(COMPONENT_REMOVED_ID);
      const listener = listeners[0];

      expect(() => {
        listener({ type: COMPONENT_REMOVED_ID, payload: null });
      }).not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle rapid sequence of events without errors', () => {
      setupEntityCacheInvalidation(mockEventBus);

      const batchListeners = subscribedListeners.get(COMPONENTS_BATCH_ADDED_ID);
      const addedListeners = subscribedListeners.get(COMPONENT_ADDED_ID);
      const removedListeners = subscribedListeners.get(COMPONENT_REMOVED_ID);

      // Verify that rapid sequence of different event types doesn't throw
      expect(() => {
        // Simulate rapid event sequence
        batchListeners[0]({
          type: COMPONENTS_BATCH_ADDED_ID,
          payload: { updates: [{ instanceId: 'entity1' }] },
        });

        addedListeners[0]({
          type: COMPONENT_ADDED_ID,
          payload: { entity: { id: 'entity2' } },
        });

        removedListeners[0]({
          type: COMPONENT_REMOVED_ID,
          payload: { entity: { id: 'entity1' } },
        });
      }).not.toThrow();
    });

    it('should work correctly with production EventBus interface', () => {
      // Create a more realistic mock that returns unsubscribe function
      const productionMockEventBus = {
        subscribe: jest.fn((eventName, listener) => {
          return () => {
            /* unsubscribe function */
          };
        }),
      };

      setupEntityCacheInvalidation(productionMockEventBus);

      expect(productionMockEventBus.subscribe).toHaveBeenCalledTimes(3);
      expect(productionMockEventBus.subscribe).toHaveBeenCalledWith(
        COMPONENTS_BATCH_ADDED_ID,
        expect.any(Function)
      );
      expect(productionMockEventBus.subscribe).toHaveBeenCalledWith(
        COMPONENT_ADDED_ID,
        expect.any(Function)
      );
      expect(productionMockEventBus.subscribe).toHaveBeenCalledWith(
        COMPONENT_REMOVED_ID,
        expect.any(Function)
      );
    });
  });
});
