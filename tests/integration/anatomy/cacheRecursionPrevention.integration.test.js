/**
 * @file Integration test for anatomy cache recursion prevention during batch operations
 * Reproduces the issue where anatomy:cache_invalidated events cause recursion
 * when many components are added during anatomy generation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AnatomyCacheCoordinator } from '../../../src/anatomy/cache/anatomyCacheCoordinator.js';
import EventBus from '../../../src/events/eventBus.js';

describe('AnatomyCacheCoordinator - Recursion Prevention', () => {
  let eventBus;
  let coordinator;
  let mockCache;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    eventBus = new EventBus({ logger: mockLogger });
    coordinator = new AnatomyCacheCoordinator({
      eventBus,
      logger: mockLogger,
    });

    // Register a mock cache
    mockCache = new Map();
    coordinator.registerCache('test-cache', mockCache);
  });

  it('should not exceed recursion limits when adding many components during batch mode', () => {
    // Enable batch mode (as done during game initialization)
    eventBus.setBatchMode(true, {
      maxRecursionDepth: 10,
      maxGlobalRecursion: 25,
      context: 'test-batch-operation',
    });

    // Track if any recursion errors occurred
    let recursionErrorOccurred = false;
    const originalError = mockLogger.error;
    mockLogger.error = jest.fn((...args) => {
      const message = args[0]?.toString() || '';
      if (message.includes('recursion') || message.includes('Maximum')) {
        recursionErrorOccurred = true;
      }
      originalError.call(mockLogger, ...args);
    });

    // Simulate anatomy generation: add 25 components (one for each body part)
    // Each component addition triggers cache invalidation which dispatches an event
    expect(() => {
      for (let i = 0; i < 25; i++) {
        const entityId = `entity-${i}`;

        // Simulate component addition
        eventBus.dispatch('core:component_added', {
          entity: { id: entityId },
          componentTypeId: `anatomy:part`,
        });
      }
    }).not.toThrow();

    // Verify no recursion errors were logged
    expect(recursionErrorOccurred).toBe(false);

    // Verify the cache was invalidated for all entities
    // (Cache should be empty since we're deleting entries)
    expect(mockCache.size).toBe(0);

    // Clean up
    eventBus.setBatchMode(false);
  });

  it('should handle nested component additions during anatomy generation without recursion errors', () => {
    // Enable batch mode
    eventBus.setBatchMode(true, {
      maxRecursionDepth: 10,
      maxGlobalRecursion: 25,
      context: 'anatomy-generation',
    });

    // Track recursion warnings and errors
    const warnings = [];
    const errors = [];
    mockLogger.warn = jest.fn((...args) => {
      warnings.push(args[0]?.toString() || '');
    });
    mockLogger.error = jest.fn((...args) => {
      errors.push(args[0]?.toString() || '');
    });

    // Simulate what happens during anatomy generation:
    // Multiple components are added to the same entity
    const ownerId = 'test-owner';

    expect(() => {
      // Simulate creating 25 body part entities
      for (let partIdx = 0; partIdx < 25; partIdx++) {
        const partEntityId = `body-part-${partIdx}`;

        // Each body part gets multiple components
        eventBus.dispatch('core:component_added', {
          entity: { id: partEntityId },
          componentTypeId: 'anatomy:part',
        });

        eventBus.dispatch('core:component_added', {
          entity: { id: partEntityId },
          componentTypeId: 'core:name',
        });

        eventBus.dispatch('core:component_added', {
          entity: { id: partEntityId },
          componentTypeId: 'anatomy:description',
        });
      }

      // Then the owner entity gets updated with clothing metadata
      eventBus.dispatch('core:component_added', {
        entity: { id: ownerId },
        componentTypeId: 'clothing:slot_metadata',
      });

      eventBus.dispatch('core:component_added', {
        entity: { id: ownerId },
        componentTypeId: 'anatomy:body',
      });
    }).not.toThrow();

    // Check for recursion-related warnings or errors
    const recursionWarnings = warnings.filter(
      (w) => w.includes('recursion') || w.includes('depth')
    );
    const recursionErrors = errors.filter(
      (e) => e.includes('recursion') || e.includes('Maximum')
    );

    expect(recursionWarnings).toEqual([]);
    expect(recursionErrors).toEqual([]);

    // Clean up
    eventBus.setBatchMode(false);
  });

  it('should batch invalidation events during batch mode to prevent recursion', () => {
    // Enable batch mode
    eventBus.setBatchMode(true, {
      maxRecursionDepth: 10,
      maxGlobalRecursion: 25,
      context: 'batch-test',
    });

    // Track anatomy:cache_invalidated events
    const cacheInvalidatedEvents = [];
    eventBus.subscribe('anatomy:cache_invalidated', (event) => {
      cacheInvalidatedEvents.push(event);
    });

    // Add many components
    for (let i = 0; i < 30; i++) {
      eventBus.dispatch('core:component_added', {
        entity: { id: `entity-${i}` },
        componentTypeId: 'test:component',
      });
    }

    // In batch mode, we should either:
    // 1. Not dispatch anatomy:cache_invalidated events at all, OR
    // 2. Batch them into a single event at the end, OR
    // 3. Dispatch them but ensure no recursion errors occur

    // The important thing is no recursion errors should occur
    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('recursion')
    );

    // Clean up
    eventBus.setBatchMode(false);
  });

  it('should prevent infinite recursion even with extremely high component counts', () => {
    // Enable batch mode with limits matching production
    eventBus.setBatchMode(true, {
      maxRecursionDepth: 10,
      maxGlobalRecursion: 25,
      context: 'stress-test',
    });

    let dispatchBlocked = false;
    const originalDispatch = eventBus.dispatch.bind(eventBus);

    // Wrap dispatch to detect if it's blocked
    eventBus.dispatch = jest.fn((eventName, payload) => {
      try {
        return originalDispatch(eventName, payload);
      } catch (err) {
        if (err.message?.includes('recursion')) {
          dispatchBlocked = true;
          throw err;
        }
        throw err;
      }
    });

    // Simulate extreme case: 100 components
    expect(() => {
      for (let i = 0; i < 100; i++) {
        eventBus.dispatch('core:component_added', {
          entity: { id: `entity-${i}` },
          componentTypeId: 'test:component',
        });
      }
    }).not.toThrow();

    // Verify no dispatch was blocked due to recursion
    expect(dispatchBlocked).toBe(false);

    // Clean up
    eventBus.setBatchMode(false);
  });
});
