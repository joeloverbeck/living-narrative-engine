# ANASYSREF-006: Centralize Cache Management

**Priority**: 🟢 **RECOMMENDED**
**Phase**: 2 - Structural Improvements
**Estimated Effort**: 12-16 hours
**Dependencies**: ANASYSREF-004 (clothing decoupling)
**Report Reference**: `reports/anatomy-system-refactoring-analysis.md` (Section: Phase 2.3)

---

## Context

**Note**: The codebase already has a general cache invalidation system in `src/scopeDsl/core/entityHelpers.js` that listens to component lifecycle events (`core:component_added`, `core:component_removed`, `core:components_batch_added`). This workflow proposes a **dedicated anatomy-specific cache coordinator** that:
- Provides a centralized registry for anatomy-related caches
- Enables transactional invalidation across multiple cache instances
- Adds monitoring and debugging capabilities specific to anatomy caching

The existing system and the proposed coordinator can coexist, with the coordinator providing additional benefits for anatomy-specific cache management.

---

## Problem Statement

Cache invalidation logic is **spread across multiple services**, leading to:
- Timing-sensitive operations (must invalidate before queries)
- No transactional guarantees (partial invalidation possible)
- Difficult to debug cache-related issues
- Inconsistent invalidation patterns

---

## Objective

Create **AnatomyCacheCoordinator** to centralize cache management:
- Single source of truth for invalidation
- Event-driven invalidation (automatic)
- Transactional all-or-nothing invalidation
- Easier debugging and monitoring

---

## Implementation Details

### 1. Cache Coordinator Service

**File**: `src/anatomy/cache/anatomyCacheCoordinator.js`

```javascript
/**
 * @file Centralized cache management for anatomy system.
 */

export class AnatomyCacheCoordinator {
  #caches = new Map();
  #eventBus;
  #logger;

  constructor({ eventBus, logger }) {
    this.#eventBus = eventBus;
    this.#logger = logger;

    // Subscribe to invalidation events
    this.#eventBus.subscribe('core:entity_removed', this.#handleEntityRemoved.bind(this));
    this.#eventBus.subscribe('core:component_added', this.#handleComponentChanged.bind(this));
    this.#eventBus.subscribe('core:component_removed', this.#handleComponentChanged.bind(this));
    this.#eventBus.subscribe('core:components_batch_added', this.#handleComponentsBatchAdded.bind(this));
  }

  /**
   * Registers a cache for coordinated invalidation.
   * @param {string} cacheId - Unique cache identifier
   * @param {Map|Object} cache - Cache instance with delete() method
   */
  registerCache(cacheId, cache) {
    if (this.#caches.has(cacheId)) {
      this.#logger.warn(`Cache ${cacheId} already registered, overwriting`);
    }

    this.#caches.set(cacheId, cache);
    this.#logger.debug(`Registered cache: ${cacheId}`);
  }

  /**
   * Unregisters a cache.
   */
  unregisterCache(cacheId) {
    this.#caches.delete(cacheId);
    this.#logger.debug(`Unregistered cache: ${cacheId}`);
  }

  /**
   * Invalidates all caches for an entity (transactional).
   * @param {string} entityId - Entity to invalidate
   */
  invalidateEntity(entityId) {
    this.#logger.debug(`Invalidating all caches for entity ${entityId}`);

    let invalidatedCount = 0;

    for (const [cacheId, cache] of this.#caches) {
      try {
        // Support Map-based caches
        if (cache instanceof Map) {
          cache.delete(entityId);
          invalidatedCount++;
        }
        // Support object-based caches
        else if (typeof cache.invalidate === 'function') {
          cache.invalidate(entityId);
          invalidatedCount++;
        }
        else {
          this.#logger.warn(`Cache ${cacheId} doesn't support invalidation`);
        }
      } catch (err) {
        this.#logger.error(`Failed to invalidate cache ${cacheId} for ${entityId}`, err);
      }
    }

    // Publish event for monitoring
    this.#eventBus.dispatch('anatomy:cache_invalidated', {
      entityId,
      cacheCount: invalidatedCount
    });
  }

  /**
   * Invalidates all caches (full reset).
   */
  invalidateAll() {
    this.#logger.info('Invalidating all anatomy caches');

    for (const [cacheId, cache] of this.#caches) {
      try {
        if (cache instanceof Map) {
          cache.clear();
        } else if (typeof cache.clear === 'function') {
          cache.clear();
        }
      } catch (err) {
        this.#logger.error(`Failed to clear cache ${cacheId}`, err);
      }
    }

    this.#eventBus.dispatch('anatomy:caches_cleared', {});
  }

  // Event handlers
  #handleEntityRemoved({ payload }) {
    // Handle entity removal - payload may have instanceId or entity object
    const entityId = payload?.instanceId || payload?.entity?.id;
    if (entityId) {
      this.invalidateEntity(entityId);
    }
  }

  #handleComponentChanged({ payload }) {
    // Handle component additions/removals - payload has entity object
    const entityId = payload?.entity?.id;
    if (entityId) {
      this.invalidateEntity(entityId);
    }
  }

  #handleComponentsBatchAdded({ payload }) {
    // Handle batch component additions - payload has updates array
    if (payload?.updates) {
      payload.updates.forEach((update) => {
        if (update.instanceId) {
          this.invalidateEntity(update.instanceId);
        }
      });
    }
  }
}
```

### 2. Register Caches

Services register their caches with the coordinator:

```javascript
// In AnatomySocketIndex service
// File: src/anatomy/services/anatomySocketIndex.js
constructor({ logger, entityManager, bodyGraphService, cacheCoordinator }) {
  // ... existing initialization ...

  if (cacheCoordinator) {
    cacheCoordinator.registerCache('anatomySocketIndex:socketToEntity', this.#socketToEntityMap);
    cacheCoordinator.registerCache('anatomySocketIndex:entityToSockets', this.#entityToSocketsMap);
    cacheCoordinator.registerCache('anatomySocketIndex:rootEntity', this.#rootEntityCache);
  }
}

// In SlotResolver
// File: src/anatomy/integration/SlotResolver.js
constructor({ logger, entityManager, bodyGraphService, anatomyBlueprintRepository,
             anatomySocketIndex, cache, cacheCoordinator }) {
  // ... existing initialization ...

  // Note: SlotResolver already uses AnatomyClothingCache which could be registered
  if (cacheCoordinator && this.#cache instanceof Map) {
    cacheCoordinator.registerCache('slotResolver', this.#cache);
  }
}
```

### 3. Dependency Injection

**File**: `src/dependencyInjection/registrations/worldAndEntityRegistrations.js`

```javascript
import { AnatomyCacheCoordinator } from '../../anatomy/cache/anatomyCacheCoordinator.js';
import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';

export function registerWorldAndEntity(container) {
  const registrar = new Registrar(container);
  const logger = container.resolve(tokens.ILogger);

  // Register cache coordinator first (add to existing registrations)
  registrar.singletonFactory(tokens.IAnatomyCacheCoordinator, (c) => {
    return new AnatomyCacheCoordinator({
      eventBus: c.resolve(tokens.IEventBus),
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(tokens.IAnatomyCacheCoordinator)}.`
  );

  // Update existing AnatomySocketIndex registration to include coordinator
  registrar.singletonFactory(tokens.IAnatomySocketIndex, (c) => {
    return new AnatomySocketIndex({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      bodyGraphService: c.resolve(tokens.BodyGraphService),
      cacheCoordinator: c.resolve(tokens.IAnatomyCacheCoordinator),
    });
  });

  // Update existing SlotResolver registration to include coordinator
  registrar.singletonFactory(tokens.SlotResolver, (c) => {
    return new SlotResolver({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      bodyGraphService: c.resolve(tokens.BodyGraphService),
      anatomyBlueprintRepository: c.resolve(tokens.IAnatomyBlueprintRepository),
      anatomySocketIndex: c.resolve(tokens.IAnatomySocketIndex),
      cache: c.resolve(tokens.AnatomyClothingCache),
      cacheCoordinator: c.resolve(tokens.IAnatomyCacheCoordinator),
    });
  });
}
```

---

## Testing Requirements

### Unit Tests

```javascript
// tests/unit/anatomy/cache/anatomyCacheCoordinator.test.js
describe('AnatomyCacheCoordinator', () => {
  let coordinator;
  let mockEventBus;

  beforeEach(() => {
    mockEventBus = testBed.createMockEventBus();
    coordinator = new AnatomyCacheCoordinator({
      eventBus: mockEventBus,
      logger: testBed.createMockLogger()
    });
  });

  it('should register and track caches', () => {
    const cache1 = new Map();
    const cache2 = new Map();

    coordinator.registerCache('cache1', cache1);
    coordinator.registerCache('cache2', cache2);

    expect(coordinator.getCacheCount()).toBe(2);
  });

  it('should invalidate all registered caches for entity', () => {
    const cache1 = new Map([['entity1', 'data1']]);
    const cache2 = new Map([['entity1', 'data2']]);

    coordinator.registerCache('cache1', cache1);
    coordinator.registerCache('cache2', cache2);

    coordinator.invalidateEntity('entity1');

    expect(cache1.has('entity1')).toBe(false);
    expect(cache2.has('entity1')).toBe(false);
  });

  it('should handle core:entity_removed event', () => {
    const cache = new Map([['entity1', 'data']]);
    coordinator.registerCache('testCache', cache);

    // Trigger the event that coordinator subscribed to
    const handler = mockEventBus.subscribe.mock.calls.find(
      call => call[0] === 'core:entity_removed'
    )[1];

    handler({
      type: 'core:entity_removed',
      payload: { instanceId: 'entity1' }
    });

    expect(cache.has('entity1')).toBe(false);
  });

  it('should publish anatomy:cache_invalidated event', () => {
    coordinator.registerCache('cache', new Map());
    coordinator.invalidateEntity('entity1');

    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      'anatomy:cache_invalidated',
      expect.objectContaining({ entityId: 'entity1' })
    );
  });
});
```

### Integration Tests

```javascript
// tests/integration/anatomy/cacheCoordination.test.js
describe('Cache Coordination Integration', () => {
  it('should invalidate all anatomy caches when entity components change', async () => {
    // Note: This test would need to be implemented with actual game engine setup
    const container = /* create and configure container */;
    const coordinator = container.resolve(tokens.IAnatomyCacheCoordinator);
    const socketIndex = container.resolve(tokens.IAnatomySocketIndex);
    const entityManager = container.resolve(tokens.IEntityManager);

    // Create an entity with anatomy
    const entityId = 'test-entity-id';
    // ... entity creation logic ...

    // Build socket index (populates caches)
    await socketIndex.buildIndex(entityId);

    // Verify cache populated by checking internal maps
    // Note: May need to add test helper methods to AnatomySocketIndex
    const sockets = await socketIndex.getEntitySockets(entityId);
    expect(sockets.length).toBeGreaterThan(0);

    // Simulate component change that triggers cache invalidation
    await entityManager.setComponent(entityId, 'anatomy:sockets', { sockets: [] });

    // Verify caches were invalidated by coordinator
    // The next call should rebuild the index
    const socketsAfterInvalidation = await socketIndex.getEntitySockets(entityId);
    expect(socketsAfterInvalidation).toBeDefined();
  });
});
```

---

## Acceptance Criteria

- [ ] AnatomyCacheCoordinator service created
- [ ] Event-driven invalidation (core:entity_removed, core:component_added, core:component_removed, core:components_batch_added)
- [ ] Cache registration/unregistration API
- [ ] Transactional invalidation (all-or-nothing with error handling)
- [ ] Event publication for monitoring (anatomy:cache_invalidated, anatomy:caches_cleared)
- [ ] Services register their caches with coordinator
- [ ] Add IAnatomyCacheCoordinator token to tokens file
- [ ] Update AnatomySocketIndex to accept optional cacheCoordinator parameter
- [ ] Update SlotResolver to accept optional cacheCoordinator parameter
- [ ] Update worldAndEntityRegistrations.js to register coordinator and pass to services
- [ ] Unit tests achieve 95% coverage
- [ ] Integration tests verify automatic invalidation
- [ ] Existing tests still pass

---

## Risk Assessment

**Risk Level**: 🟢 **LOW**

- Improves existing functionality
- Backward compatible (services can opt-in)
- Easy to rollback

**Mitigation**:
- Gradual adoption (one cache at a time)
- Existing invalidation logic remains as fallback
- Comprehensive testing

---

## Definition of Done

- All acceptance criteria checked
- Code review approved
- Tests passing
- Documentation updated
- Merged to main branch

---

**Created**: 2025-11-03
**Status**: Not Started
