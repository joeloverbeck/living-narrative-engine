# ACTDESC-019: Implement Performance Optimization

## Status
🟡 **Pending**

## Phase
**Phase 6: Advanced Features** (Week 4)

## Description
Implement comprehensive performance optimizations including caching strategies, activity indexing, and lazy evaluation to ensure description generation remains fast even with many activities.

## Background
With all features implemented, optimize for performance to maintain <50ms generation time even with 10+ activities per entity.

**Reference**: Design document lines 2394-2483 (Performance Optimization)

## Technical Specification

### Activity Index System
```javascript
/**
 * Build activity index for fast lookups.
 * Indexes activities by target entity for quick same-target grouping.
 *
 * @param {Array<object>} activities - All activities
 * @returns {object} Indexed activities
 * @private
 */
#buildActivityIndex(activities) {
  const index = {
    byTarget: new Map(),
    byPriority: [],
    all: activities,
  };

  // Index by target
  for (const activity of activities) {
    const targetId = activity.targetEntityId || 'solo';
    if (!index.byTarget.has(targetId)) {
      index.byTarget.set(targetId, []);
    }
    index.byTarget.get(targetId).push(activity);
  }

  // Sort by priority once
  index.byPriority = [...activities].sort((a, b) => (b.priority || 50) - (a.priority || 50));

  return index;
}
```

### Enhanced Caching Strategy
```javascript
/**
 * Enhanced entity name cache with TTL and size limits.
 */
constructor({ entityManager, anatomyFormattingService, logger = null }) {
  // ... existing validation

  this.#entityManager = entityManager;
  this.#anatomyFormattingService = anatomyFormattingService;
  this.#logger = ensureValidLogger(logger, 'ActivityDescriptionService');

  // Enhanced caching with limits
  this.#entityNameCache = new Map();
  this.#genderCache = new Map();
  this.#activityIndexCache = new Map();

  // Cache configuration
  this.#cacheConfig = {
    maxSize: 1000,
    ttl: 60000, // 60 seconds
    enableMetrics: false,
  };

  // Bind cleanup to avoid memory leaks
  this.#setupCacheCleanup();
}

/**
 * Setup periodic cache cleanup.
 * @private
 */
#setupCacheCleanup() {
  if (typeof setInterval !== 'undefined') {
    this.#cleanupInterval = setInterval(() => {
      this.#cleanupCaches();
    }, 30000); // Every 30 seconds
  }
}

/**
 * Clean up old cache entries.
 * @private
 */
#cleanupCaches() {
  const now = Date.now();

  // Clean name cache
  if (this.#entityNameCache.size > this.#cacheConfig.maxSize) {
    this.#entityNameCache.clear();
  }

  // Clean gender cache
  if (this.#genderCache.size > this.#cacheConfig.maxSize) {
    this.#genderCache.clear();
  }

  // Clean activity index cache (more aggressive)
  if (this.#activityIndexCache.size > 100) {
    this.#activityIndexCache.clear();
  }
}

/**
 * Destroy service and cleanup resources.
 */
destroy() {
  if (this.#cleanupInterval) {
    clearInterval(this.#cleanupInterval);
    this.#cleanupInterval = null;
  }

  this.#entityNameCache.clear();
  this.#genderCache.clear();
  this.#activityIndexCache.clear();
}
```

### Optimized Gender Detection with Caching
```javascript
/**
 * Detect entity gender with caching.
 *
 * @param {string} entityId - Entity ID
 * @returns {string} Gender
 * @private
 */
#detectEntityGender(entityId) {
  // Check cache first
  if (this.#genderCache.has(entityId)) {
    return this.#genderCache.get(entityId);
  }

  const entity = this.#entityManager.getEntityInstance(entityId);
  if (!entity) {
    this.#genderCache.set(entityId, 'unknown');
    return 'unknown';
  }

  // Priority: core:gender explicit component > neutral fallback
  const genderComponent = entity.getComponentData('core:gender');
  if (genderComponent?.value) {
    this.#genderCache.set(entityId, genderComponent.value);
    return genderComponent.value;
  }

  this.#genderCache.set(entityId, 'neutral');
  return 'neutral';
}
```

### Lazy Evaluation for Grouping
```javascript
/**
 * Group activities with lazy evaluation.
 * Only performs expensive checks when necessary.
 *
 * @param {Array<object>} activities - Activities
 * @returns {Array<ActivityGroup>} Groups
 * @private
 */
#groupActivities(activities) {
  // Use index for fast target lookup
  const index = this.#buildActivityIndex(activities);
  const groups = [];
  const processed = new Set();

  // Group by target first (fast path)
  for (const [targetId, targetActivities] of index.byTarget) {
    if (targetActivities.length === 0) continue;

    // Skip if already processed
    if (processed.has(targetActivities[0].sourceComponent)) {
      continue;
    }

    const group = {
      primaryActivity: targetActivities[0],
      relatedActivities: targetActivities.slice(1).map((act) => ({
        activity: act,
        conjunction: this.#determineConjunction(targetActivities[0], act),
      })),
      conjunction: null,
    };

    groups.push(group);

    // Mark all as processed
    for (const act of targetActivities) {
      processed.add(act.sourceComponent);
    }
  }

  return groups;
}
```

### Configuration-Based Performance Tuning
```javascript
// Add to AnatomyFormattingService
getActivityIntegrationConfig() {
  return {
    // ... existing config
    performance: {
      enableCaching: true,
      cacheSize: 1000,
      cacheTTL: 60000,
      maxActivitiesProcessed: 20,
      enableActivityIndexing: true,
      lazyEvaluation: true,
    },
  };
}
```

### Performance Monitoring (Optional)
```javascript
/**
 * Generate description with optional performance tracking.
 *
 * @param {string} entityId - Entity ID
 * @param {object} options - Generation options
 * @returns {Promise<string>} Description
 */
async generateActivityDescription(entityId, options = {}) {
  const startTime = options.trackPerformance ? performance.now() : 0;

  // ... existing logic

  if (options.trackPerformance) {
    const duration = performance.now() - startTime;
    this.#logger.debug(`Activity description generation took ${duration.toFixed(2)}ms`);

    if (duration > 50) {
      this.#logger.warn(`Slow description generation: ${duration.toFixed(2)}ms for entity ${entityId}`);
    }
  }

  return description;
}
```

## Performance Targets

```yaml
targets:
  simple_activity: "< 5ms"
  five_activities: "< 20ms"
  ten_activities: "< 50ms"
  twenty_activities: "< 100ms"

caching:
  hit_rate: "> 80%"
  memory_overhead: "< 10MB"

optimization_gains:
  indexing: "30-40% faster for grouped activities"
  caching: "50-60% faster for repeated entities"
  lazy_evaluation: "20-30% faster for complex conditions"
```

## Acceptance Criteria
- [ ] Activity indexing implemented
- [ ] Enhanced caching with TTL and limits
- [ ] Lazy evaluation for grouping
- [ ] Periodic cache cleanup
- [ ] Destroy method for resource cleanup
- [ ] Performance targets met
- [ ] Memory usage within limits
- [ ] Configuration-based tuning
- [ ] Optional performance tracking
- [ ] Tests verify optimizations

## Dependencies
- **Requires**: All Phase 5 features (ACTDESC-014 to ACTDESC-017)
- **Blocks**: Phase 7 (Production needs optimized system)
- **Enhances**: Overall system performance

## Testing Requirements

```javascript
describe('ActivityDescriptionService - Performance', () => {
  it('should generate simple description under 5ms', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is kneeling', 'alicia', 75);

    const start = performance.now();
    await service.generateActivityDescription('jon');
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(5);
  });

  it('should handle 10 activities under 50ms', async () => {
    const jon = createEntity('jon', 'male');

    for (let i = 0; i < 10; i++) {
      addActivity(jon, `{actor} action${i}`, 'alicia', 90 - i);
    }

    const start = performance.now();
    await service.generateActivityDescription('jon');
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
  });

  it('should benefit from name caching', async () => {
    const jon = createEntity('jon', 'male');

    for (let i = 0; i < 5; i++) {
      addActivity(jon, `{actor} action${i}`, 'alicia', 90 - i);
    }

    // First generation (cold cache)
    const firstStart = performance.now();
    await service.generateActivityDescription('jon');
    const firstDuration = performance.now() - firstStart;

    // Second generation (warm cache)
    const secondStart = performance.now();
    await service.generateActivityDescription('jon');
    const secondDuration = performance.now() - secondStart;

    // Should be significantly faster with cache
    expect(secondDuration).toBeLessThan(firstDuration * 0.7);
  });

  it('should index activities efficiently', () => {
    const activities = [];
    for (let i = 0; i < 20; i++) {
      activities.push({
        sourceComponent: `comp${i}`,
        targetEntityId: i % 3 === 0 ? 'alicia' : i % 3 === 1 ? 'bobby' : null,
        priority: i,
      });
    }

    const start = performance.now();
    const index = service['#buildActivityIndex'](activities);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(2); // Very fast indexing
    expect(index.byTarget.size).toBeGreaterThan(0);
  });

  it('should cleanup caches when limit exceeded', () => {
    // Fill cache beyond limit
    for (let i = 0; i < 1500; i++) {
      service['#entityNameCache'].set(`entity${i}`, `Name ${i}`);
    }

    service['#cleanupCaches']();

    // Should be cleaned up
    expect(service['#entityNameCache'].size).toBeLessThanOrEqual(1000);
  });

  it('should destroy resources properly', () => {
    service.destroy();

    expect(service['#entityNameCache'].size).toBe(0);
    expect(service['#genderCache'].size).toBe(0);
    expect(service['#activityIndexCache'].size).toBe(0);
  });
});

describe('ActivityDescriptionService - Memory Usage', () => {
  it('should not leak memory with repeated generations', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is waving', null, 75);

    const initialMemory = process.memoryUsage().heapUsed;

    // Generate 1000 times
    for (let i = 0; i < 1000; i++) {
      await service.generateActivityDescription('jon');
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const growth = finalMemory - initialMemory;

    // Should not grow significantly (< 10MB)
    expect(growth).toBeLessThan(10 * 1024 * 1024);
  });
});
```

## Implementation Notes
1. **Indexing Strategy**: Build index once per generation, reuse for grouping
2. **Cache Sizing**: Balance between memory and performance
3. **TTL Management**: Periodic cleanup prevents unbounded growth
4. **Lazy Evaluation**: Only evaluate expensive operations when needed
5. **Monitoring**: Optional performance tracking for debugging

## Reference Files
- Service: `src/anatomy/services/activityDescriptionService.js`
- Config: `src/services/anatomyFormattingService.js`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 2394-2483)

## Success Metrics
- Performance targets met for all scenarios
- Cache hit rate >80%
- Memory usage <10MB
- No memory leaks
- Optimization gains verified

## Related Tickets
- **Requires**: ACTDESC-014 to ACTDESC-017
- **Blocks**: ACTDESC-022 (Production needs optimization)
- **Enhances**: System performance significantly
