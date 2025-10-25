# ACTDESC-021: Implement Event-Driven Cache Invalidation

## Status
🟡 **Pending**

## Phase
**Phase 6: Advanced Features** (Week 4)

## Description
Implement event-driven cache invalidation system to automatically invalidate cached entity names, genders, and activity indexes when relevant component changes occur, ensuring descriptions always reflect current game state.

## Background
Caches improve performance but must stay synchronized with game state. Event-driven invalidation ensures caches never show stale data without manual clearing.

**Reference**: Design document lines 2575-2655 (Cache Invalidation Strategy)

## Technical Specification

### Event Subscriptions Setup
```javascript
constructor({ entityManager, anatomyFormattingService, eventBus = null, logger = null }) {
  // ... existing validation and initialization

  this.#eventBus = eventBus;
  this.#entityNameCache = new Map();
  this.#genderCache = new Map();
  this.#activityIndexCache = new Map();

  // Subscribe to cache-invalidating events
  if (this.#eventBus) {
    this.#subscribeToInvalidationEvents();
  }
}

/**
 * Subscribe to events that require cache invalidation.
 * @private
 */
#subscribeToInvalidationEvents() {
  // Name component changes
  this.#eventBus.on('COMPONENT_ADDED', (event) => {
    if (event.payload.componentId === 'core:name') {
      this.#invalidateNameCache(event.payload.entityId);
    }
  });

  this.#eventBus.on('COMPONENT_UPDATED', (event) => {
    if (event.payload.componentId === 'core:name') {
      this.#invalidateNameCache(event.payload.entityId);
    }
  });

  this.#eventBus.on('COMPONENT_REMOVED', (event) => {
    if (event.payload.componentId === 'core:name') {
      this.#invalidateNameCache(event.payload.entityId);
    }
  });

  // Gender component changes
  this.#eventBus.on('COMPONENT_ADDED', (event) => {
    if (event.payload.componentId === 'character:gender' || event.payload.componentId === 'anatomy:body') {
      this.#invalidateGenderCache(event.payload.entityId);
    }
  });

  this.#eventBus.on('COMPONENT_UPDATED', (event) => {
    if (event.payload.componentId === 'character:gender' || event.payload.componentId === 'anatomy:body') {
      this.#invalidateGenderCache(event.payload.entityId);
    }
  });

  // Activity metadata changes
  this.#eventBus.on('COMPONENT_ADDED', (event) => {
    if (event.payload.componentId.includes('activityMetadata') ||
        event.payload.componentId === 'activity:description_metadata') {
      this.#invalidateActivityCache(event.payload.entityId);
    }
  });

  this.#eventBus.on('COMPONENT_UPDATED', (event) => {
    if (event.payload.componentId.includes('activityMetadata') ||
        event.payload.componentId === 'activity:description_metadata') {
      this.#invalidateActivityCache(event.payload.entityId);
    }
  });

  this.#eventBus.on('COMPONENT_REMOVED', (event) => {
    if (event.payload.componentId.includes('activityMetadata') ||
        event.payload.componentId === 'activity:description_metadata') {
      this.#invalidateActivityCache(event.payload.entityId);
    }
  });

  // Entity deletion
  this.#eventBus.on('ENTITY_DESTROYED', (event) => {
    this.#invalidateAllCachesForEntity(event.payload.entityId);
  });
}
```

### Cache Invalidation Methods
```javascript
/**
 * Invalidate name cache for entity.
 *
 * @param {string} entityId - Entity ID
 * @private
 */
#invalidateNameCache(entityId) {
  if (this.#entityNameCache.has(entityId)) {
    this.#entityNameCache.delete(entityId);
    this.#logger.debug(`Invalidated name cache for ${entityId}`);
  }
}

/**
 * Invalidate gender cache for entity.
 *
 * @param {string} entityId - Entity ID
 * @private
 */
#invalidateGenderCache(entityId) {
  if (this.#genderCache.has(entityId)) {
    this.#genderCache.delete(entityId);
    this.#logger.debug(`Invalidated gender cache for ${entityId}`);
  }
}

/**
 * Invalidate activity cache for entity.
 *
 * @param {string} entityId - Entity ID
 * @private
 */
#invalidateActivityCache(entityId) {
  if (this.#activityIndexCache.has(entityId)) {
    this.#activityIndexCache.delete(entityId);
    this.#logger.debug(`Invalidated activity cache for ${entityId}`);
  }
}

/**
 * Invalidate all caches for entity.
 *
 * @param {string} entityId - Entity ID
 * @private
 */
#invalidateAllCachesForEntity(entityId) {
  this.#invalidateNameCache(entityId);
  this.#invalidateGenderCache(entityId);
  this.#invalidateActivityCache(entityId);
}

/**
 * Clear all caches completely.
 */
clearAllCaches() {
  this.#entityNameCache.clear();
  this.#genderCache.clear();
  this.#activityIndexCache.clear();
  this.#logger.info('Cleared all activity description caches');
}
```

### Batch Invalidation Support
```javascript
/**
 * Invalidate caches for multiple entities efficiently.
 *
 * @param {Array<string>} entityIds - Entity IDs to invalidate
 */
invalidateEntities(entityIds) {
  if (!Array.isArray(entityIds)) {
    this.#logger.warn('invalidateEntities called with non-array');
    return;
  }

  for (const entityId of entityIds) {
    this.#invalidateAllCachesForEntity(entityId);
  }

  this.#logger.debug(`Invalidated caches for ${entityIds.length} entities`);
}
```

### Selective Invalidation API
```javascript
/**
 * Invalidate specific cache type for entity.
 *
 * @param {string} entityId - Entity ID
 * @param {string} cacheType - Cache type: 'name', 'gender', 'activity', 'all'
 */
invalidateCache(entityId, cacheType = 'all') {
  switch (cacheType) {
    case 'name':
      this.#invalidateNameCache(entityId);
      break;
    case 'gender':
      this.#invalidateGenderCache(entityId);
      break;
    case 'activity':
      this.#invalidateActivityCache(entityId);
      break;
    case 'all':
      this.#invalidateAllCachesForEntity(entityId);
      break;
    default:
      this.#logger.warn(`Unknown cache type: ${cacheType}`);
  }
}
```

### Destroy Method Enhancement
```javascript
/**
 * Destroy service and cleanup resources.
 */
destroy() {
  // Unsubscribe from events
  if (this.#eventBus) {
    this.#eventBus.off('COMPONENT_ADDED', this.#handleComponentAdded);
    this.#eventBus.off('COMPONENT_UPDATED', this.#handleComponentUpdated);
    this.#eventBus.off('COMPONENT_REMOVED', this.#handleComponentRemoved);
    this.#eventBus.off('ENTITY_DESTROYED', this.#handleEntityDestroyed);
  }

  // Stop cleanup interval
  if (this.#cleanupInterval) {
    clearInterval(this.#cleanupInterval);
    this.#cleanupInterval = null;
  }

  // Clear all caches
  this.clearAllCaches();

  this.#logger.info('ActivityDescriptionService destroyed');
}
```

## Event-Driven Invalidation Flow

```
Component Change → Event Dispatched → Service Listens → Cache Invalidated → Next Access Refreshes
```

### Example Flow
```
1. Player changes character name
2. EntityManager dispatches COMPONENT_UPDATED event
3. ActivityDescriptionService receives event
4. Name cache invalidated for that entity
5. Next description generation fetches fresh name
```

## Acceptance Criteria
- [ ] Event subscriptions established in constructor
- [ ] Name cache invalidated on `core:name` changes
- [ ] Gender cache invalidated on `character:gender` or `anatomy:body` changes
- [ ] Activity cache invalidated on metadata changes
- [ ] All caches invalidated on entity destruction
- [ ] Batch invalidation supported
- [ ] Selective invalidation API available
- [ ] Event unsubscription on destroy
- [ ] Tests verify invalidation logic
- [ ] No memory leaks from subscriptions

## Dependencies
- **Requires**: ACTDESC-019 (Performance optimization with caching)
- **Blocks**: Phase 7 (Production needs cache synchronization)
- **Enhances**: Cache reliability and data freshness

## Testing Requirements

```javascript
describe('ActivityDescriptionService - Cache Invalidation', () => {
  let eventBus;
  let service;

  beforeEach(() => {
    eventBus = new EventBus();
    service = new ActivityDescriptionService({
      entityManager: mockEntityManager,
      anatomyFormattingService: mockFormattingService,
      eventBus,
    });
  });

  afterEach(() => {
    service.destroy();
  });

  it('should invalidate name cache on COMPONENT_UPDATED', () => {
    // Cache a name
    service['#entityNameCache'].set('jon', 'Jon Ureña');

    // Dispatch name component update
    eventBus.dispatch({
      type: 'COMPONENT_UPDATED',
      payload: {
        entityId: 'jon',
        componentId: 'core:name',
      },
    });

    // Cache should be invalidated
    expect(service['#entityNameCache'].has('jon')).toBe(false);
  });

  it('should invalidate gender cache on gender component change', () => {
    service['#genderCache'].set('jon', 'male');

    eventBus.dispatch({
      type: 'COMPONENT_UPDATED',
      payload: {
        entityId: 'jon',
        componentId: 'character:gender',
      },
    });

    expect(service['#genderCache'].has('jon')).toBe(false);
  });

  it('should invalidate activity cache on metadata change', () => {
    service['#activityIndexCache'].set('jon', { /* index */ });

    eventBus.dispatch({
      type: 'COMPONENT_ADDED',
      payload: {
        entityId: 'jon',
        componentId: 'activity:description_metadata',
      },
    });

    expect(service['#activityIndexCache'].has('jon')).toBe(false);
  });

  it('should invalidate all caches on entity destruction', () => {
    service['#entityNameCache'].set('jon', 'Jon');
    service['#genderCache'].set('jon', 'male');
    service['#activityIndexCache'].set('jon', {});

    eventBus.dispatch({
      type: 'ENTITY_DESTROYED',
      payload: {
        entityId: 'jon',
      },
    });

    expect(service['#entityNameCache'].has('jon')).toBe(false);
    expect(service['#genderCache'].has('jon')).toBe(false);
    expect(service['#activityIndexCache'].has('jon')).toBe(false);
  });

  it('should support batch invalidation', () => {
    service['#entityNameCache'].set('jon', 'Jon');
    service['#entityNameCache'].set('alicia', 'Alicia');
    service['#entityNameCache'].set('bobby', 'Bobby');

    service.invalidateEntities(['jon', 'alicia']);

    expect(service['#entityNameCache'].has('jon')).toBe(false);
    expect(service['#entityNameCache'].has('alicia')).toBe(false);
    expect(service['#entityNameCache'].has('bobby')).toBe(true);
  });

  it('should support selective cache invalidation', () => {
    service['#entityNameCache'].set('jon', 'Jon');
    service['#genderCache'].set('jon', 'male');
    service['#activityIndexCache'].set('jon', {});

    service.invalidateCache('jon', 'name');

    expect(service['#entityNameCache'].has('jon')).toBe(false);
    expect(service['#genderCache'].has('jon')).toBe(true); // Not invalidated
    expect(service['#activityIndexCache'].has('jon')).toBe(true); // Not invalidated
  });

  it('should unsubscribe from events on destroy', () => {
    const listenerCountBefore = eventBus.listenerCount('COMPONENT_UPDATED');

    service.destroy();

    const listenerCountAfter = eventBus.listenerCount('COMPONENT_UPDATED');

    expect(listenerCountAfter).toBeLessThan(listenerCountBefore);
  });

  it('should refresh cache on next access after invalidation', async () => {
    const jon = createEntity('jon', 'male');
    addComponent(jon, 'core:name', { text: 'Jon Ureña' });

    // First generation (caches name)
    await service.generateActivityDescription('jon');
    expect(service['#entityNameCache'].get('jon')).toBe('Jon Ureña');

    // Update name
    updateComponent(jon, 'core:name', { text: 'Jon "Red" Ureña' });

    // Dispatch event to invalidate
    eventBus.dispatch({
      type: 'COMPONENT_UPDATED',
      payload: {
        entityId: 'jon',
        componentId: 'core:name',
      },
    });

    // Second generation (refreshes cache)
    await service.generateActivityDescription('jon');
    expect(service['#entityNameCache'].get('jon')).toBe('Jon "Red" Ureña');
  });

  it('should not leak memory from event subscriptions', () => {
    // Create and destroy multiple services
    for (let i = 0; i < 100; i++) {
      const tempService = new ActivityDescriptionService({
        entityManager: mockEntityManager,
        anatomyFormattingService: mockFormattingService,
        eventBus,
      });
      tempService.destroy();
    }

    // Event bus listener count should not grow unboundedly
    const listenerCount = eventBus.listenerCount('COMPONENT_UPDATED');
    expect(listenerCount).toBeLessThan(10); // Reasonable limit
  });
});
```

## Implementation Notes
1. **Event Filtering**: Only listen to relevant component types
2. **Granular Invalidation**: Invalidate specific caches, not all
3. **Batch Operations**: Support invalidating multiple entities at once
4. **Memory Management**: Always unsubscribe on destroy
5. **Logging**: Debug-level logging for cache operations

## Reference Files
- Service: `src/anatomy/services/activityDescriptionService.js`
- Event system: `src/events/eventBus.js`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 2575-2655)

## Success Metrics
- Caches automatically synchronized with game state
- No stale data in descriptions
- Minimal invalidation overhead
- No memory leaks from subscriptions
- Tests verify all invalidation scenarios

## Related Tickets
- **Requires**: ACTDESC-019 (Caching system)
- **Enhances**: Cache reliability
- **Enables**: Safe production use with dynamic game state
