# ACTDESSERREF-009: Implement Facade Pattern

**Priority**: LOW | **Effort**: 4 days | **Risk**: LOW
**Dependencies**: ACTDESSERREF-001 through ACTDESSERREF-008 | **Phase**: 4 - Integration & Cleanup (Weeks 11-12)

## Context

After extracting all services (Caching, Index, Metadata, Filtering, NLG, Grouping, Context), implement a facade pattern to provide a simplified API for external consumers and orchestrate the extracted services.

## Target Architecture

**Location**: `src/anatomy/services/activityDescriptionFacade.js`

```javascript
/**
 * Facade for Activity Description System
 * Orchestrates all extracted services with simplified API
 */
class ActivityDescriptionFacade {
  #cacheManager;
  #indexManager;
  #metadataSystem;
  #filteringSystem;
  #nlgSystem;
  #groupingSystem;
  #contextSystem;
  #logger;

  constructor({
    cacheManager,
    indexManager,
    metadataSystem,
    filteringSystem,
    nlgSystem,
    groupingSystem,
    contextSystem,
    logger
  }) {
    // Validate all services
    this.#cacheManager = cacheManager;
    this.#indexManager = indexManager;
    this.#metadataSystem = metadataSystem;
    this.#filteringSystem = filteringSystem;
    this.#nlgSystem = nlgSystem;
    this.#groupingSystem = groupingSystem;
    this.#contextSystem = contextSystem;
    this.#logger = logger;
  }

  /**
   * Generate activity description (simplified API)
   */
  generateActivityDescription(entityId) {
    // 1. Collect metadata
    const entity = this.#getEntity(entityId);
    const activities = this.#metadataSystem.collectActivityMetadata(entityId, entity);

    // 2. Filter by visibility
    const visibleActivities = this.#filteringSystem.filterByConditions(activities, entity);

    // 3. Group activities
    const cacheKey = this.#buildCacheKey('activity', entityId);
    const groups = this.#groupingSystem.groupActivities(visibleActivities, cacheKey);

    // 4. Build context
    const context = this.#contextSystem.buildActivityContext(entityId, groups[0]?.primaryActivity);

    // 5. Format natural language description
    const description = this.#nlgSystem.formatActivityDescription(groups, entityId, context);

    return description;
  }

  // Expose test hooks for backward compatibility
  getTestHooks() {
    return {
      ...this.#nlgSystem.getTestHooks(),
      ...this.#filteringSystem.getTestHooks(),
      ...this.#groupingSystem.getTestHooks(),
      ...this.#contextSystem.getTestHooks(),
    };
  }

  // Cleanup
  destroy() {
    this.#cacheManager.destroy();
  }
}

export default ActivityDescriptionFacade;
```

## Service Registration

Update DI container to register facade:

```javascript
import { tokens } from './tokens.js';
import ActivityDescriptionFacade from '../anatomy/services/activityDescriptionFacade.js';

// Register all extracted services first
container.register(tokens.ActivityCacheManager, ActivityCacheManager);
container.register(tokens.ActivityIndexManager, ActivityIndexManager);
container.register(tokens.ActivityMetadataCollectionSystem, ActivityMetadataCollectionSystem);
container.register(tokens.ActivityFilteringSystem, ActivityFilteringSystem);
container.register(tokens.ActivityNLGSystem, ActivityNLGSystem);
container.register(tokens.ActivityGroupingSystem, ActivityGroupingSystem);
container.register(tokens.ActivityContextBuildingSystem, ActivityContextBuildingSystem);

// Register facade
container.register(tokens.ActivityDescriptionService, ActivityDescriptionFacade);
```

## Acceptance Criteria

- [ ] ActivityDescriptionFacade class created
- [ ] All 7 services orchestrated correctly
- [ ] Simplified API (`generateActivityDescription`)
- [ ] Test hooks exposed (backward compatibility)
- [ ] DI registration updated
- [ ] All existing tests pass (zero modifications)
- [ ] Documentation updated

## Dependencies

All previous refactorings (ACTDESSERREF-001 through ACTDESSERREF-008) must be complete.

## Related Tickets

- All previous tickets (facade integrates everything)
- ACTDESSERREF-010 (Test Migration)
