# ACTDESC-021: Implement Event-Driven Cache Invalidation

## Status
🟡 **Pending**

## Phase
**Phase 6: Advanced Features** (Week 4)

## Description
Implement event-driven cache invalidation system to automatically invalidate cached entity names, genders, and activity indexes when relevant component changes occur, ensuring descriptions always reflect current game state. Align the plan with the existing `EventBus` API (`subscribe`/`unsubscribe`) and the canonical `core:*` event identifiers already used across the codebase.

## Background
Caches improve performance but must stay synchronized with game state. Event-driven invalidation ensures caches never show stale data without manual clearing.

**Reference**: Design document lines 2575-2655 (Cache Invalidation Strategy)

## Technical Specification

### Event Subscriptions Setup
```javascript
import {
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
  ENTITY_REMOVED_ID,
} from '../../constants/eventIds.js';
import { NAME_COMPONENT_ID } from '../../constants/componentIds.js';

const GENDER_COMPONENT_ID = 'core:gender';
const ACTIVITY_METADATA_COMPONENT_ID = 'activity:description_metadata';

class ActivityDescriptionService {
  #eventBus = null;
  #eventUnsubscribers = [];

  constructor({ entityManager, anatomyFormattingService, eventBus = null, logger = null }) {
    // ... existing validation and initialization

    if (eventBus) {
      validateDependency(eventBus, 'EventBus', this.#logger, {
        requiredMethods: ['dispatch', 'subscribe', 'unsubscribe'],
      });
      this.#eventBus = eventBus;
      this.#subscribeToInvalidationEvents();
    }
  }

  /**
   * Subscribe to events that require cache invalidation.
   * @private
   */
  #subscribeToInvalidationEvents() {
    const subscribe = (eventId, handler) => {
      const unsubscribe = this.#eventBus.subscribe(eventId, handler);
      if (typeof unsubscribe === 'function') {
        this.#eventUnsubscribers.push(unsubscribe);
      }
    };

    const getEntityId = (event) =>
      event?.payload?.entity?.id ?? event?.payload?.entity?.instanceId ?? null;

    subscribe(COMPONENT_ADDED_ID, (event) => {
      const componentId = event?.payload?.componentTypeId;
      const entityId = getEntityId(event);

      if (!entityId || !componentId) {
        return;
      }

      if (componentId === NAME_COMPONENT_ID) {
        this.#invalidateNameCache(entityId);
      }

      if (componentId === GENDER_COMPONENT_ID) {
        this.#invalidateGenderCache(entityId);
      }

      if (componentId === ACTIVITY_METADATA_COMPONENT_ID) {
        this.#invalidateActivityCache(entityId);
      }
    });

    subscribe(COMPONENT_REMOVED_ID, (event) => {
      const componentId = event?.payload?.componentTypeId;
      const entityId = getEntityId(event);

      if (!entityId || !componentId) {
        return;
      }

      if (componentId === NAME_COMPONENT_ID) {
        this.#invalidateNameCache(entityId);
      }

      if (componentId === GENDER_COMPONENT_ID) {
        this.#invalidateGenderCache(entityId);
      }

      if (componentId === ACTIVITY_METADATA_COMPONENT_ID) {
        this.#invalidateActivityCache(entityId);
      }
    });

    subscribe(ENTITY_REMOVED_ID, (event) => {
      const entityId = getEntityId(event);
      if (entityId) {
        this.#invalidateAllCachesForEntity(entityId);
      }
    });
  }
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
  if (this.#entityNameCache.delete(entityId)) {
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
  if (this.#genderCache.delete(entityId)) {
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
  if (this.#activityIndexCache.delete(entityId)) {
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
  while (this.#eventUnsubscribers.length > 0) {
    const unsubscribe = this.#eventUnsubscribers.pop();
    try {
      unsubscribe?.();
    } catch (error) {
      this.#logger.warn('Failed to unsubscribe cache invalidation handler', error);
    }
  }

  if (this.#cleanupInterval) {
    clearInterval(this.#cleanupInterval);
    this.#cleanupInterval = null;
  }

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
2. EntityManager dispatches `core:component_added` with the updated `core:name` payload
3. ActivityDescriptionService subscriber receives the event object
4. Name cache invalidated for that entity
5. Next description generation fetches fresh name
```

## Acceptance Criteria
- [ ] Event subscriptions established in constructor
- [ ] Name cache invalidated on `core:name` changes
- [ ] Gender cache invalidated on `core:gender` changes
- [ ] Activity cache invalidated on `activity:description_metadata` changes
- [ ] All caches invalidated on `core:entity_removed`
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
  let hooks;

  beforeEach(() => {
    eventBus = new EventBus({ logger: mockLogger });
    service = new ActivityDescriptionService({
      entityManager: mockEntityManager,
      anatomyFormattingService: mockFormattingService,
      jsonLogicEvaluationService: mockJsonLogicService,
      eventBus,
    });
    hooks = service.getTestHooks();
  });

  afterEach(() => {
    service.destroy();
  });

  it('invalidates name cache when a name component is updated', async () => {
    hooks.setEntityNameCacheEntry('jon', 'Jon Ureña');

    await eventBus.dispatch(COMPONENT_ADDED_ID, {
      entity: { id: 'jon' },
      componentTypeId: NAME_COMPONENT_ID,
    });

    expect(hooks.getCacheSnapshot().entityName.has('jon')).toBe(false);
  });

  it('invalidates gender cache when the gender component changes', async () => {
    hooks.setGenderCacheEntry('jon', 'male');

    await eventBus.dispatch(COMPONENT_ADDED_ID, {
      entity: { id: 'jon' },
      componentTypeId: 'core:gender',
    });

    expect(hooks.getCacheSnapshot().gender.has('jon')).toBe(false);
  });

  it('invalidates activity cache when metadata updates', async () => {
    hooks.setActivityIndexCacheEntry('jon', { signature: 'abc', index: {} });

    await eventBus.dispatch(COMPONENT_ADDED_ID, {
      entity: { id: 'jon' },
      componentTypeId: 'activity:description_metadata',
    });

    expect(hooks.getCacheSnapshot().activityIndex.has('jon')).toBe(false);
  });

  it('invalidates all caches when an entity is removed', async () => {
    hooks.setEntityNameCacheEntry('jon', 'Jon');
    hooks.setGenderCacheEntry('jon', 'male');
    hooks.setActivityIndexCacheEntry('jon', { signature: 'abc', index: {} });

    await eventBus.dispatch(ENTITY_REMOVED_ID, {
      entity: { id: 'jon' },
    });

    const snapshot = hooks.getCacheSnapshot();
    expect(snapshot.entityName.has('jon')).toBe(false);
    expect(snapshot.gender.has('jon')).toBe(false);
    expect(snapshot.activityIndex.has('jon')).toBe(false);
  });

  it('supports batch invalidation helpers', () => {
    hooks.setEntityNameCacheEntry('jon', 'Jon');
    hooks.setEntityNameCacheEntry('alicia', 'Alicia');
    hooks.setEntityNameCacheEntry('bobby', 'Bobby');

    service.invalidateEntities(['jon', 'alicia']);

    const snapshot = hooks.getCacheSnapshot().entityName;
    expect(snapshot.has('jon')).toBe(false);
    expect(snapshot.has('alicia')).toBe(false);
    expect(snapshot.has('bobby')).toBe(true);
  });

  it('supports selective cache invalidation', () => {
    hooks.setEntityNameCacheEntry('jon', 'Jon');
    hooks.setGenderCacheEntry('jon', 'male');
    hooks.setActivityIndexCacheEntry('jon', { signature: 'abc', index: {} });

    service.invalidateCache('jon', 'name');

    const snapshot = hooks.getCacheSnapshot();
    expect(snapshot.entityName.has('jon')).toBe(false);
    expect(snapshot.gender.has('jon')).toBe(true);
    expect(snapshot.activityIndex.has('jon')).toBe(true);
  });

  it('unsubscribes from cache invalidation events on destroy', () => {
    const before = eventBus.listenerCount(COMPONENT_ADDED_ID);

    service.destroy();

    const after = eventBus.listenerCount(COMPONENT_ADDED_ID);
    expect(after).toBeLessThan(before);
  });

  it('refreshes caches after invalidation when generating descriptions', async () => {
    const jon = createEntity('jon', 'male');
    addComponent(jon, NAME_COMPONENT_ID, { text: 'Jon Ureña' });

    await service.generateActivityDescription('jon');
    expect(hooks.getCacheSnapshot().entityName.get('jon')?.value).toBe('Jon Ureña');

    updateComponent(jon, NAME_COMPONENT_ID, { text: 'Jon "Red" Ureña' });

    await eventBus.dispatch(COMPONENT_ADDED_ID, {
      entity: jon,
      componentTypeId: NAME_COMPONENT_ID,
    });

    await service.generateActivityDescription('jon');
    expect(hooks.getCacheSnapshot().entityName.get('jon')?.value).toBe('Jon "Red" Ureña');
  });

  it('does not leak listeners when services are created and destroyed repeatedly', () => {
    for (let i = 0; i < 50; i++) {
      const tempService = new ActivityDescriptionService({
        entityManager: mockEntityManager,
        anatomyFormattingService: mockFormattingService,
        jsonLogicEvaluationService: mockJsonLogicService,
        eventBus,
      });
      tempService.destroy();
    }

    expect(eventBus.listenerCount(COMPONENT_ADDED_ID)).toBeLessThan(10);
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
