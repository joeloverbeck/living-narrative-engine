# ANASYSREF-006: Centralize Cache Management

**Priority**: 🟢 **RECOMMENDED**
**Phase**: 2 - Structural Improvements
**Estimated Effort**: 12-16 hours
**Dependencies**: ANASYSREF-004 (clothing decoupling)
**Report Reference**: `reports/anatomy-system-refactoring-analysis.md` (Section: Phase 2.3)

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
    this.#eventBus.on('ENTITY_DESTROYED', this.#handleEntityDestroyed.bind(this));
    this.#eventBus.on('ANATOMY_MODIFIED', this.#handleAnatomyModified.bind(this));
    this.#eventBus.on('COMPONENTS_BATCH_REMOVED', this.#handleComponentsRemoved.bind(this));
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
    this.#eventBus.dispatch({
      type: 'ANATOMY_CACHE_INVALIDATED',
      payload: { entityId, cacheCount: invalidatedCount }
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

    this.#eventBus.dispatch({ type: 'ANATOMY_CACHES_CLEARED' });
  }

  // Event handlers
  #handleEntityDestroyed({ payload: { entityId } }) {
    this.invalidateEntity(entityId);
  }

  #handleAnatomyModified({ payload: { entityId } }) {
    this.invalidateEntity(entityId);
  }

  #handleComponentsRemoved({ payload: { entityId } }) {
    this.invalidateEntity(entityId);
  }
}
```

### 2. Register Caches

Services register their caches with the coordinator:

```javascript
// In socketIndex service initialization
constructor({ cacheCoordinator }) {
  this.#cache = new Map();

  if (cacheCoordinator) {
    cacheCoordinator.registerCache('socketIndex', this.#cache);
  }
}

// In SlotResolver
constructor({ cacheCoordinator }) {
  this.#cache = new Map();

  if (cacheCoordinator) {
    cacheCoordinator.registerCache('slotResolver', this.#cache);
  }
}
```

### 3. Dependency Injection

**File**: `src/dependencyInjection/registrations/anatomyRegistrations.js`

```javascript
import { AnatomyCacheCoordinator } from '../../anatomy/cache/anatomyCacheCoordinator.js';

export function registerAnatomyServices(container) {
  // Register cache coordinator first
  container.registerSingleton('IAnatomyCacheCoordinator', ({ eventBus, logger }) => {
    return new AnatomyCacheCoordinator({ eventBus, logger });
  });

  // Other services receive coordinator as dependency
  container.register('ISocketIndex', ({ cacheCoordinator, logger }) => {
    return new SocketIndex({ cacheCoordinator, logger });
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

  it('should handle ENTITY_DESTROYED event', () => {
    const cache = new Map([['entity1', 'data']]);
    coordinator.registerCache('testCache', cache);

    mockEventBus.dispatch({
      type: 'ENTITY_DESTROYED',
      payload: { entityId: 'entity1' }
    });

    expect(cache.has('entity1')).toBe(false);
  });

  it('should publish ANATOMY_CACHE_INVALIDATED event', () => {
    coordinator.registerCache('cache', new Map());
    coordinator.invalidateEntity('entity1');

    expect(mockEventBus.dispatch).toHaveBeenCalledWith({
      type: 'ANATOMY_CACHE_INVALIDATED',
      payload: expect.objectContaining({ entityId: 'entity1' })
    });
  });
});
```

### Integration Tests

```javascript
// tests/integration/anatomy/cacheCoordination.test.js
describe('Cache Coordination Integration', () => {
  it('should invalidate all anatomy caches when entity destroyed', async () => {
    const testBed = createTestBed();
    const coordinator = testBed.container.resolve('IAnatomyCacheCoordinator');
    const socketIndex = testBed.container.resolve('ISocketIndex');

    // Generate anatomy (populates caches)
    const entityId = await testBed.generateAnatomy({ blueprintId: 'anatomy:humanoid_body' });

    // Verify cache populated
    expect(socketIndex.getCachedSockets(entityId)).toBeDefined();

    // Destroy entity
    await testBed.destroyEntity(entityId);

    // Verify caches invalidated
    expect(socketIndex.getCachedSockets(entityId)).toBeUndefined();
  });
});
```

---

## Acceptance Criteria

- [ ] AnatomyCacheCoordinator service created
- [ ] Event-driven invalidation (ENTITY_DESTROYED, ANATOMY_MODIFIED)
- [ ] Cache registration/unregistration API
- [ ] Transactional invalidation (all-or-nothing)
- [ ] Event publication for monitoring
- [ ] Services register their caches with coordinator
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
