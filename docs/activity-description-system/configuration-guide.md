# Activity Description System Configuration Guide

**Version**: 2.0 (Facade Pattern Architecture)
**Last Updated**: 2025-11-01

## Overview

This guide provides comprehensive configuration options for the Activity Description System. The system is composed of 7 specialized services orchestrated by a facade, each with its own configuration surface.

---

## Table of Contents

1. [System-Wide Configuration](#system-wide-configuration)
2. [ActivityDescriptionFacade Configuration](#activitydescriptionfacade-configuration)
3. [ActivityCacheManager Configuration](#activitycachemanager-configuration)
4. [ActivityIndexManager Configuration](#activityindexmanager-configuration)
5. [ActivityMetadataCollectionSystem Configuration](#activitymetadatacollectionsystem-configuration)
6. [ActivityNLGSystem Configuration](#activitynlgsystem-configuration)
7. [ActivityGroupingSystem Configuration](#activitygroupingsystem-configuration)
8. [ActivityContextBuildingSystem Configuration](#activitycontextbuildingsystem-configuration)
9. [ActivityFilteringSystem Configuration](#activityfilteringsystem-configuration)
10. [Environment-Specific Configurations](#environment-specific-configurations)
11. [Performance Tuning](#performance-tuning)
12. [Debugging and Diagnostics](#debugging-and-diagnostics)

---

## System-Wide Configuration

### Default Configuration Object

All services share common configuration patterns defined in `AnatomyFormattingService`.

```javascript
// src/anatomy/services/anatomyFormattingService.js
const DEFAULT_ACTIVITY_FORMATTING_CONFIG = Object.freeze({
  enabled: true,
  prefix: 'Activity: ',
  suffix: '.',
  separator: '. ',
  maxActivities: 10,
  enableContextAwareness: true,
  maxDescriptionLength: 500,
  deduplicateActivities: true,
  nameResolution: Object.freeze({
    usePronounsWhenAvailable: false,
    preferReflexivePronouns: true,
  }),
});
```

### Accessing Configuration

```javascript
const anatomyFormattingService = container.resolve('AnatomyFormattingService');
const config = anatomyFormattingService.getActivityIntegrationConfig();

console.log(config.maxActivities); // 10
console.log(config.enabled); // true
```

### Overriding Configuration

```javascript
class CustomAnatomyFormattingService extends AnatomyFormattingService {
  getActivityIntegrationConfig() {
    return {
      ...super.getActivityIntegrationConfig(),
      maxActivities: 20,           // Increase from default 10
      maxDescriptionLength: 1000,  // Increase from default 500
      prefix: '',                  // Remove "Activity: " prefix
      nameResolution: {
        usePronounsWhenAvailable: true,  // Enable pronouns
        preferReflexivePronouns: true,
      },
    };
  }
}

// Register custom service
container.register('AnatomyFormattingService', CustomAnatomyFormattingService);
```

---

## ActivityDescriptionFacade Configuration

### Constructor Parameters

```javascript
const facade = new ActivityDescriptionFacade({
  // Required dependencies
  logger,                        // ILogger implementation
  entityManager,                 // IEntityManager implementation
  anatomyFormattingService,      // AnatomyFormattingService instance
  cacheManager,                  // IActivityCacheManager implementation
  indexManager,                  // IActivityIndexManager implementation
  metadataCollectionSystem,      // IActivityMetadataCollectionSystem implementation
  nlgSystem,                     // IActivityNLGSystem implementation
  groupingSystem,                // IActivityGroupingSystem implementation
  contextBuildingSystem,         // IActivityContextBuildingSystem implementation
  filteringSystem,               // IActivityFilteringSystem implementation

  // Optional parameters
  activityIndex: null,           // Pre-built index (reserved for future)
  eventBus: null,                // EventBus for error dispatching
});
```

### Internal Cache Configuration

The facade configures caches through the `ActivityCacheManager`:

```javascript
// Internal cache configuration (not directly modifiable)
#cacheConfig = {
  maxSize: 1000,      // Maximum entries per cache
  ttl: 60000,         // 60 seconds TTL
  enableMetrics: false // Disable performance metrics
};
```

To modify cache behavior, configure the `ActivityCacheManager` directly (see section below).

### Usage Example

```javascript
// Via DI container (recommended)
const facade = container.resolve('ActivityDescriptionFacade');

// Generate description
const description = await facade.generateActivityDescription('actor_1');

// Invalidate caches
facade.invalidateCache('actor_1', 'all');
facade.invalidateEntities(['actor_1', 'actor_2']);
facade.clearAllCaches();

// Cleanup
facade.destroy();
```

---

## ActivityCacheManager Configuration

### Constructor Parameters

```javascript
const cacheManager = new ActivityCacheManager({
  logger,              // ILogger implementation (required)
  eventBus: null,      // Optional EventBus for auto-invalidation
});
```

### Cache Registration

Each cache must be registered before use:

```javascript
cacheManager.registerCache('entityName', {
  ttl: 60000,          // Time-to-live in milliseconds (default: 60000)
  maxSize: 1000,       // Maximum entries before LRU pruning (default: 1000)
});

cacheManager.registerCache('gender', {
  ttl: 60000,
  maxSize: 1000,
});

cacheManager.registerCache('activityIndex', {
  ttl: 60000,
  maxSize: 100,        // Smaller for activity indices
});

cacheManager.registerCache('closeness', {
  ttl: 60000,
  maxSize: 1000,
});
```

### Cache Operations

```javascript
// Set value
cacheManager.set('entityName', 'actor_1', 'Jon Ureña');

// Get value (respects TTL)
const name = cacheManager.get('entityName', 'actor_1'); // 'Jon Ureña' or null

// Invalidate specific entry
cacheManager.invalidate('entityName', 'actor_1');

// Invalidate all entries for entity
cacheManager.invalidateAll('actor_1');

// Clear all caches
cacheManager.clearAll();

// Cleanup (stop intervals, unsubscribe events)
cacheManager.destroy();
```

### Event-Driven Invalidation

When `eventBus` is provided, cache manager automatically subscribes to:

- `COMPONENT_ADDED` → Invalidate entity caches
- `COMPONENT_REMOVED` → Invalidate entity caches
- `COMPONENTS_BATCH_ADDED` → Invalidate affected entities
- `ENTITY_REMOVED` → Invalidate entity caches

```javascript
const cacheManager = new ActivityCacheManager({
  logger,
  eventBus, // ✅ Enable auto-invalidation
});

// Cache automatically invalidated
eventBus.dispatch({
  type: 'COMPONENT_ADDED',
  payload: { entity: { id: 'actor_1' } }
});
```

### Performance Tuning

```javascript
// High-traffic application
cacheManager.registerCache('entityName', {
  ttl: 120000,         // 2 minutes (longer TTL)
  maxSize: 5000,       // More entries
});

// Low-memory environment
cacheManager.registerCache('entityName', {
  ttl: 30000,          // 30 seconds (shorter TTL)
  maxSize: 100,        // Fewer entries
});
```

---

## ActivityIndexManager Configuration

### Constructor Parameters

```javascript
const indexManager = new ActivityIndexManager({
  logger,              // ILogger implementation (required)
  cacheManager,        // IActivityCacheManager implementation (required)
});
```

### Index Building

```javascript
const activities = [
  { id: 'kneel_1', target: 'actor_2', priority: 100, groupKey: 'positioning' },
  { id: 'hold_hand_1', target: 'actor_2', priority: 90, groupKey: 'affection' },
];

const index = indexManager.buildActivityIndex(activities);
```

### Index Structure

```javascript
{
  byTarget: Map {
    'actor_2' => [
      { id: 'kneel_1', target: 'actor_2', priority: 100 },
      { id: 'hold_hand_1', target: 'actor_2', priority: 90 }
    ]
  },
  byPriority: [
    { id: 'kneel_1', priority: 100 },
    { id: 'hold_hand_1', priority: 90 }
  ],
  byGroupKey: Map {
    'positioning' => [{ id: 'kneel_1' }],
    'affection' => [{ id: 'hold_hand_1' }]
  },
  all: [/* original activities */]
}
```

### Cached Index Retrieval

```javascript
// Build cache key
const cacheKey = indexManager.buildActivityIndexCacheKey('priority', 'actor_1');

// Get cached index or rebuild
const index = indexManager.getActivityIndex(activities, cacheKey);
```

---

## ActivityMetadataCollectionSystem Configuration

### Constructor Parameters

```javascript
const metadataSystem = new ActivityMetadataCollectionSystem({
  logger,              // ILogger implementation (required)
  entityManager,       // IEntityManager implementation (required)
});
```

### Metadata Collection Tiers

The system uses a 3-tier collection strategy (no configuration required):

1. **Tier 1**: Activity index metadata (highest priority)
2. **Tier 2**: Inline activity metadata from components
3. **Tier 3**: Dedicated activity metadata components

### Deduplication Strategy

```javascript
const activities = metadataSystem.collectActivityMetadata('actor_1', entity);

// Activities automatically deduplicated by signature:
// - sourceComponent
// - template
// - targetEntityId
// - priority
// - metadata.groupKey
```

### Custom Metadata Collectors

To add custom metadata sources, extend the component with `activityMetadata`:

```json
{
  "id": "core:custom_activity",
  "dataSchema": {
    "type": "object",
    "properties": {
      "activityMetadata": {
        "type": "object",
        "properties": {
          "template": { "type": "string" },
          "targetEntityId": { "type": "string" },
          "priority": { "type": "number" }
        }
      }
    }
  }
}
```

---

## ActivityNLGSystem Configuration

### Constructor Parameters

```javascript
const nlgSystem = new ActivityNLGSystem({
  logger,              // ILogger implementation (required)
  entityManager,       // IEntityManager implementation (required)
});
```

### Phrase Generation Options

```javascript
const context = {
  actorName: 'Jon Ureña',
  actorId: 'actor_1',
  actorPronouns: { subject: 'he', object: 'him', possessive: 'his', reflexive: 'himself' },
  preferReflexivePronouns: true,
  forceReflexivePronoun: false,
  omitActor: false,
};

const activity = {
  template: '{actor} is kneeling before {target}',
  targetEntityId: 'actor_2',
};

const phrase = nlgSystem.generateActivityPhrase('Jon Ureña', activity, false, context);
// Returns: "Jon Ureña is kneeling before Alicia Western"
```

### Name Resolution

```javascript
// Resolve entity name
const name = nlgSystem.resolveEntityName('actor_1');

// Detect gender
const gender = nlgSystem.detectEntityGender('actor_1'); // 'male', 'female', 'neutral'

// Get pronoun set
const pronouns = nlgSystem.getPronounSet('male');
// { subject: 'he', object: 'him', possessive: 'his', reflexive: 'himself' }

// Resolve pronoun
const pronoun = nlgSystem.resolvePronoun('actor_1', 'subject'); // 'he'
```

### Sanitization

```javascript
const sanitized = nlgSystem.sanitizeEntityName('Jon-Ureña_123');
// 'Jon Ureña'
```

### Adverb Merging

```javascript
const merged = nlgSystem.mergeAdverb('quickly', 'very');
// 'very quickly'

const merged2 = nlgSystem.mergeAdverb('quickly', 'quickly');
// 'quickly' (no duplication)
```

---

## ActivityGroupingSystem Configuration

### Constructor Parameters

```javascript
const groupingSystem = new ActivityGroupingSystem({
  logger,              // ILogger implementation (required)
});
```

### Priority Sorting

```javascript
const activities = [
  { id: 'act1', priority: 50 },
  { id: 'act2', priority: 100 },
  { id: 'act3', priority: 75 },
];

const sorted = groupingSystem.sortByPriority(activities);
// [{ priority: 100 }, { priority: 75 }, { priority: 50 }]
```

### Activity Grouping

```javascript
const grouped = groupingSystem.groupActivities(activities, cacheKey);

// Returns array of activity groups:
[
  {
    primaryActivity: { id: 'act1', priority: 100 },
    relatedActivities: [
      { activity: { id: 'act2', priority: 90 }, conjunction: 'and' },
      { activity: { id: 'act3', priority: 85 }, conjunction: 'while' }
    ]
  }
]
```

### Conjunction Selection

Conjunctions are selected based on activity context:

- **Sequential**: `then`, `and then`
- **Simultaneous**: `and`, `while`, `as`
- **Contrasting**: `but`, `yet`

---

## ActivityContextBuildingSystem Configuration

### Constructor Parameters

```javascript
const contextSystem = new ActivityContextBuildingSystem({
  logger,              // ILogger implementation (required)
  entityManager,       // IEntityManager implementation (required)
  nlgSystem,           // IActivityNLGSystem implementation (required)
});
```

### Context Building

```javascript
const context = contextSystem.buildActivityContext('actor_1', activity);

// Returns context object with:
{
  actorName: 'Jon Ureña',
  targetName: 'Alicia Western',
  closeness: 'partner',  // or 'stranger', 'acquaintance', etc.
  intensity: 'moderate', // or 'low', 'high'
  // ... other context data
}
```

### Contextual Tone Application

```javascript
const contextualActivity = contextSystem.applyContextualTone(activity, context);

// Adjusts activity based on context:
// - Adds softeners for low closeness ("maybe", "a little")
// - Modifies intensity based on relationship
// - Adjusts phrasing for formality
```

### Closeness Cache Management

```javascript
// Invalidate closeness cache for entity
contextSystem.invalidateClosenessCache('actor_1');
```

---

## ActivityFilteringSystem Configuration

### Constructor Parameters

```javascript
const filteringSystem = new ActivityFilteringSystem({
  logger,                      // ILogger implementation (required)
  conditionValidator,          // ActivityConditionValidator instance (required)
  jsonLogicEvaluationService,  // JsonLogicEvaluationService instance (required)
  entityManager,               // IEntityManager implementation (required)
});
```

### Condition-Based Filtering

```javascript
const activities = [
  {
    id: 'kneel_1',
    visibilityConditions: {
      "==": [{ "var": "entity.hasComponent" }, "positioning:standing"]
    }
  },
  {
    id: 'hold_hand_1',
    visibilityConditions: null // Always visible
  }
];

const filtered = filteringSystem.filterByConditions(activities, entity);
// Returns only activities that pass visibility conditions
```

### Custom Visibility Conditions

Add `visibilityConditions` to activity metadata using JSON Logic:

```json
{
  "activityMetadata": {
    "template": "{actor} sits down",
    "visibilityConditions": {
      "and": [
        { "==": [{ "var": "entity.hasComponent" }, "positioning:standing"] },
        { "!": { "==": [{ "var": "entity.hasComponent" }, "positioning:sitting"] } }
      ]
    }
  }
}
```

---

## Environment-Specific Configurations

### Development Configuration

```javascript
// config/development.js
export const activityConfig = {
  cacheManager: {
    ttl: 30000,           // 30 seconds (shorter for frequent changes)
    maxSize: 100,         // Smaller cache
    enableMetrics: true,  // Enable for debugging
  },
  facade: {
    maxActivities: 20,    // Show more activities for testing
    maxDescriptionLength: 1000, // Longer descriptions
  },
  logging: {
    level: 'debug',       // Verbose logging
  }
};
```

### Production Configuration

```javascript
// config/production.js
export const activityConfig = {
  cacheManager: {
    ttl: 120000,          // 2 minutes (longer TTL)
    maxSize: 5000,        // Larger cache
    enableMetrics: false, // Disable for performance
  },
  facade: {
    maxActivities: 10,    // Reasonable limit
    maxDescriptionLength: 500, // Standard length
  },
  logging: {
    level: 'warn',        // Only warnings and errors
  }
};
```

### Testing Configuration

```javascript
// config/testing.js
export const activityConfig = {
  cacheManager: {
    ttl: 1000,            // 1 second (fast expiration)
    maxSize: 10,          // Minimal cache
    enableMetrics: false, // Disable for speed
  },
  facade: {
    maxActivities: 5,     // Minimal for tests
    maxDescriptionLength: 200,
  },
  logging: {
    level: 'error',       // Silent tests
  }
};
```

---

## Performance Tuning

### Cache Optimization

```javascript
// High-traffic scenario
const cacheManager = new ActivityCacheManager({
  logger,
  eventBus,
});

// Larger caches, longer TTL
cacheManager.registerCache('entityName', {
  ttl: 180000,   // 3 minutes
  maxSize: 10000, // 10K entries
});

cacheManager.registerCache('activityIndex', {
  ttl: 120000,   // 2 minutes
  maxSize: 1000, // 1K indices
});
```

### Memory Constraints

```javascript
// Low-memory environment
cacheManager.registerCache('entityName', {
  ttl: 30000,    // 30 seconds
  maxSize: 50,   // Minimal entries
});

cacheManager.registerCache('activityIndex', {
  ttl: 30000,
  maxSize: 10,
});
```

### Activity Limits

```javascript
// Performance-critical: reduce activity processing
const config = {
  maxActivities: 5,              // Process fewer activities
  deduplicateActivities: true,   // Always deduplicate
  enableContextAwareness: false, // Disable context processing
};
```

### Monitoring Cache Performance

```javascript
// Enable metrics (development only)
const cacheManager = new ActivityCacheManager({
  logger,
  enableMetrics: true,
});

// Check cache snapshot
const snapshot = cacheManager._getInternalCacheForTesting('entityName');
console.log('Cache size:', snapshot.size);
console.log('Cache entries:', Array.from(snapshot.keys()));
```

---

## Debugging and Diagnostics

### Enable Verbose Logging

```javascript
const logger = createLogger({
  level: 'debug', // or 'trace' for maximum verbosity
});

const facade = new ActivityDescriptionFacade({
  logger, // All services will log debug info
  // ... other dependencies
});
```

### Inspect Cache State

```javascript
const testHooks = facade.getTestHooks();
const cacheSnapshot = testHooks.getCacheSnapshot();

console.log('Entity Name Cache:', cacheSnapshot.entityName);
console.log('Gender Cache:', cacheSnapshot.gender);
console.log('Activity Index Cache:', cacheSnapshot.activityIndex);
console.log('Closeness Cache:', cacheSnapshot.closeness);
```

### Event Diagnostics

```javascript
const eventBus = container.resolve('EventBus');

// Subscribe to error events
eventBus.subscribe('ACTIVITY_DESCRIPTION_ERROR', (event) => {
  console.error('Activity Description Error:', event.payload);
});

eventBus.subscribe('SYSTEM_ERROR_OCCURRED', (event) => {
  console.error('System Error:', event.payload);
});
```

### Performance Profiling

```javascript
import { performance } from 'perf_hooks';

const start = performance.now();
const description = await facade.generateActivityDescription('actor_1');
const end = performance.now();

console.log(`Generated in ${end - start}ms`);
```

### Cache Hit/Miss Monitoring

```javascript
let cacheHits = 0;
let cacheMisses = 0;

const originalGet = cacheManager.get.bind(cacheManager);
cacheManager.get = (cacheName, key) => {
  const value = originalGet(cacheName, key);
  if (value !== undefined) {
    cacheHits++;
  } else {
    cacheMisses++;
  }
  return value;
};

// After operations
const hitRate = (cacheHits / (cacheHits + cacheMisses)) * 100;
console.log(`Cache hit rate: ${hitRate.toFixed(2)}%`);
```

---

## Configuration Best Practices

### 1. Start with Defaults

Use default configuration and adjust based on profiling:

```javascript
const facade = container.resolve('ActivityDescriptionFacade');
// Uses all defaults from AnatomyFormattingService
```

### 2. Profile Before Optimizing

```javascript
// Measure first
const start = Date.now();
for (let i = 0; i < 1000; i++) {
  await facade.generateActivityDescription(`actor_${i}`);
}
const elapsed = Date.now() - start;

// Then optimize based on results
if (elapsed > 5000) {
  // Increase cache size, reduce activity limits
}
```

### 3. Environment-Specific Configs

```javascript
import { activityConfig } from './config/' + process.env.NODE_ENV + '.js';

const cacheManager = new ActivityCacheManager({
  logger,
  ...activityConfig.cacheManager,
});
```

### 4. Monitor in Production

```javascript
// Production monitoring
setInterval(() => {
  const snapshot = cacheManager._getInternalCacheForTesting('entityName');
  if (snapshot.size > 0.8 * cacheManager.maxSize) {
    logger.warn('Cache approaching maximum size', {
      current: snapshot.size,
      max: cacheManager.maxSize,
    });
  }
}, 60000); // Check every minute
```

---

## Summary

This configuration guide covers all aspects of the Activity Description System:

- **Facade Configuration**: Orchestration settings
- **Cache Configuration**: TTL, maxSize, event-driven invalidation
- **Index Configuration**: Activity indexing and caching
- **Metadata Configuration**: Collection tiers and deduplication
- **NLG Configuration**: Phrase generation and name resolution
- **Grouping Configuration**: Priority sorting and conjunction selection
- **Context Configuration**: Tone adjustment and closeness detection
- **Filtering Configuration**: Visibility conditions and JSON Logic
- **Environment Configs**: Development, production, testing presets
- **Performance Tuning**: Cache optimization and activity limits
- **Debugging**: Logging, diagnostics, profiling

For implementation details, see:
- **Architecture**: `docs/activity-description-system/architecture.md`
- **API Reference**: `docs/activity-description-system/api-reference.md`
- **Testing Guide**: `docs/activity-description-system/testing-guide.md`
- **Migration Guide**: `docs/migration/activity-description-service-refactoring.md`

---

**Last Updated**: 2025-11-01
**Version**: 2.0 (Facade Pattern Architecture)
