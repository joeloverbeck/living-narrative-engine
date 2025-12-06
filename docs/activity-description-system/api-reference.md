# Activity Description API Reference

Complete API documentation for ActivityDescriptionFacade and all 7 specialized services.

## Table of Contents

1. [ActivityDescriptionFacade](#activitydescriptionfacade) - Main public API
2. [ActivityCacheManager](#activitycachemanager) - Caching with TTL
3. [ActivityMetadataCollectionSystem](#activitymetadatacollectionsystem) - 3-tier metadata collection
4. [ActivityNLGSystem](#activitynlgsystem) - Natural language generation
5. [ActivityGroupingSystem](#activitygroupingsystem) - Sequential grouping
6. [ActivityContextBuildingSystem](#activitycontextbuildingsystem) - Context building
7. [ActivityFilteringSystem](#activityfilteringsystem) - Condition-based filtering
8. [ActivityIndexManager](#activityindexmanager) - Index building
9. [Supporting Services](#supporting-services) - Related services
10. [Events](#events) - Event types and payloads

---

## ActivityDescriptionFacade

**Location**: `src/anatomy/services/activityDescriptionFacade.js`

**Role**: Simplified public API that orchestrates the 7 specialized services.

### Constructor

```javascript
new ActivityDescriptionFacade({
  logger,
  entityManager,
  anatomyFormattingService,
  cacheManager,
  indexManager,
  metadataCollectionSystem,
  nlgSystem,
  groupingSystem,
  contextBuildingSystem,
  filteringSystem,
  activityIndex = null,
  eventBus = null,
})
```

#### Dependencies

| Dependency                 | Interface                           | Description                                                   |
| -------------------------- | ----------------------------------- | ------------------------------------------------------------- |
| `logger`                   | `ILogger`                           | Must implement `info`, `warn`, `error`, `debug`               |
| `entityManager`            | `IEntityManager`                    | Provides `getEntityInstance` for entity access                |
| `anatomyFormattingService` | `AnatomyFormattingService`          | Supplies configuration via `getActivityIntegrationConfig()`   |
| `cacheManager`             | `IActivityCacheManager`             | Cache management with `registerCache`, `get`, `set`           |
| `indexManager`             | `IActivityIndexManager`             | Index building with `buildIndex`                              |
| `metadataCollectionSystem` | `IActivityMetadataCollectionSystem` | Metadata collection with `collectActivityMetadata`            |
| `nlgSystem`                | `IActivityNLGSystem`                | NLG with `generatePhrase`, `resolvePronoun`                   |
| `groupingSystem`           | `IActivityGroupingSystem`           | Grouping with `groupActivities`                               |
| `contextBuildingSystem`    | `IActivityContextBuildingSystem`    | Context with `buildContext`                                   |
| `filteringSystem`          | `IActivityFilteringSystem`          | Filtering with `filterActivities`                             |
| `activityIndex`            | `ActivityIndex` (optional)          | Pre-built index for Phase 3 optimization                      |
| `eventBus`                 | `IEventBus` (optional)              | Event dispatching with `dispatch`, `subscribe`, `unsubscribe` |

**Note**: All dependencies are validated via `validateDependency` with required methods checked.

### Public Methods

#### `generateActivityDescription(entityId: string): Promise<string>`

Main entry point for activity description generation.

**Parameters**:

- `entityId` (string, required) - Entity ID to generate description for

**Returns**: `Promise<string>` - Formatted activity description or empty string

**Throws**: `InvalidArgumentError` if `entityId` is not a non-empty string

**Example**:

```javascript
const facade = container.resolve('IActivityDescriptionService');
const description = await facade.generateActivityDescription('actor_123');
// Returns: "kneeling before Alice. caressing her hand gently"
```

**Workflow**:

1. Validate `entityId`
2. Check cache via `ActivityCacheManager`
3. Collect metadata via `ActivityMetadataCollectionSystem`
4. Build index via `ActivityIndexManager`
5. Filter activities via `ActivityFilteringSystem`
6. Build context via `ActivityContextBuildingSystem`
7. Generate phrases via `ActivityNLGSystem`
8. Group activities via `ActivityGroupingSystem`
9. Compose final string with prefix/suffix/separator
10. Cache result via `ActivityCacheManager`
11. Return formatted string

#### `invalidateCache(entityId: string, cacheType = 'all'): void`

Invalidate caches for a single entity.

**Parameters**:

- `entityId` (string, required) - Entity ID to invalidate
- `cacheType` (string, optional) - Cache type to invalidate (default: `'all'`)

**Supported cache types**:

- `'name'` - Clear entity name cache
- `'gender'` - Clear gender cache
- `'activity'` - Clear activity index cache
- `'closeness'` - Clear relationship closeness cache
- `'all'` - Clear all caches for entity

**Example**:

```javascript
facade.invalidateCache('actor_123', 'name'); // Invalidate only name cache
facade.invalidateCache('actor_123'); // Invalidate all caches
```

**Note**: Unknown cache types log a warning and perform no action.

#### `invalidateEntities(entityIds: string[]): void`

Bulk-invalidate caches for multiple entities.

**Parameters**:

- `entityIds` (string[], required) - Array of entity IDs to invalidate

**Example**:

```javascript
facade.invalidateEntities(['actor_1', 'actor_2', 'target_5']);
```

**Note**: Safely ignores invalid input and logs a warning if argument is not an array.

#### `clearAllCaches(): void`

Clears all caches (names, genders, activity indexes, closeness).

**Use case**: Diagnostics, testing, or when entity state changes globally.

**Warning**: Forces the system to rebuild all context - use sparingly.

**Example**:

```javascript
facade.clearAllCaches(); // Reset all caches
```

#### `destroy(): void`

Clean shutdown of the facade and all services.

**Actions**:

1. Unsubscribes all event handlers
2. Clears all caches
3. Cancels scheduled cleanup intervals
4. Logs shutdown event

**Use case**: Tests, container disposal, service reconfiguration.

**Example**:

```javascript
facade.destroy(); // Clean shutdown
```

---

## ActivityCacheManager

**Location**: `src/anatomy/cache/activityCacheManager.js`

**Role**: Centralized cache management with TTL, LRU pruning, and event-driven invalidation.

### Constructor

```javascript
new ActivityCacheManager({
  logger,
  eventBus = null
})
```

#### Dependencies

| Dependency | Interface              | Description                                   |
| ---------- | ---------------------- | --------------------------------------------- |
| `logger`   | `ILogger`              | Logging with `info`, `warn`, `error`, `debug` |
| `eventBus` | `IEventBus` (optional) | Event subscription for auto-invalidation      |

**Event Subscriptions** (when `eventBus` provided):

- `COMPONENT_ADDED` - Invalidate affected entity caches
- `COMPONENT_REMOVED` - Invalidate affected entity caches
- `COMPONENTS_BATCH_ADDED` - Bulk invalidation
- `ENTITY_REMOVED` - Remove all caches for entity

### Public Methods

#### `registerCache(cacheName: string, config = {}): void`

Register a new named cache with configuration.

**Parameters**:

- `cacheName` (string, required) - Unique cache identifier
- `config` (object, optional) - Cache configuration
  - `ttl` (number) - Time-to-live in milliseconds (default: 60000)
  - `maxSize` (number) - Max entries before LRU pruning (default: 1000)

**Example**:

```javascript
cacheManager.registerCache('entityName', { ttl: 120000, maxSize: 500 });
```

**Note**: Warns if cache already registered.

#### `get(cacheName: string, key: string): any`

Retrieve value from cache (respects TTL).

**Parameters**:

- `cacheName` (string, required) - Cache identifier
- `key` (string, required) - Cache key

**Returns**: Cached value or `null` if not found/expired

**Example**:

```javascript
const name = cacheManager.get('entityName', 'actor_123');
// Returns: "Alice" or null
```

**Behavior**:

- Returns `null` if cache doesn't exist
- Returns `null` if key not found
- Returns `null` if entry expired (TTL exceeded)
- Updates access time for LRU tracking

#### `set(cacheName: string, key: string, value: any): void`

Store value in cache with TTL.

**Parameters**:

- `cacheName` (string, required) - Cache identifier
- `key` (string, required) - Cache key
- `value` (any, required) - Value to cache

**Example**:

```javascript
cacheManager.set('entityName', 'actor_123', 'Alice');
```

**Behavior**:

- Creates cache if it doesn't exist (with defaults)
- Sets entry with current timestamp
- Triggers LRU pruning if cache exceeds `maxSize`

#### `invalidate(cacheName: string, key: string): void`

Remove specific entry from cache.

**Parameters**:

- `cacheName` (string, required) - Cache identifier
- `key` (string, required) - Cache key to remove

**Example**:

```javascript
cacheManager.invalidate('entityName', 'actor_123');
```

#### `invalidateAll(cacheName: string): void`

Clear all entries from a specific cache.

**Parameters**:

- `cacheName` (string, required) - Cache identifier

**Example**:

```javascript
cacheManager.invalidateAll('entityName');
```

#### `invalidateEntity(entityId: string): void`

Invalidate all caches for a specific entity.

**Parameters**:

- `entityId` (string, required) - Entity ID

**Example**:

```javascript
cacheManager.invalidateEntity('actor_123');
```

**Behavior**: Removes entity from all registered caches (name, gender, activity, closeness).

#### `clearAllCaches(): void`

Clear all caches completely.

**Example**:

```javascript
cacheManager.clearAllCaches();
```

#### `destroy(): void`

Shutdown cache manager and cleanup resources.

**Actions**:

1. Cancels cleanup interval
2. Unsubscribes event handlers
3. Clears all caches
4. Logs shutdown

**Example**:

```javascript
cacheManager.destroy();
```

### Cache Configuration

Default configuration for standard caches:

```javascript
{
  entityName: { ttl: 60000, maxSize: 1000 },
  gender: { ttl: 60000, maxSize: 1000 },
  activityIndex: { ttl: 60000, maxSize: 500 },
  closeness: { ttl: 60000, maxSize: 1000 }
}
```

---

## ActivityMetadataCollectionSystem

**Location**: `src/anatomy/services/activityMetadataCollectionSystem.js`

**Role**: Collects activity metadata from 3 tiers with deduplication.

### Constructor

```javascript
new ActivityMetadataCollectionSystem({
  entityManager,
  logger,
  activityIndex = null
})
```

#### Dependencies

| Dependency      | Interface                  | Description                            |
| --------------- | -------------------------- | -------------------------------------- |
| `entityManager` | `IEntityManager`           | Entity access with `getEntityInstance` |
| `logger`        | `ILogger`                  | Logging interface                      |
| `activityIndex` | `ActivityIndex` (optional) | Pre-built index for Phase 3            |

### Public Methods

#### `collectActivityMetadata(entityId: string, entity = null): Array<object>`

Collect activity metadata using 3-tier fallback strategy.

**Parameters**:

- `entityId` (string, required) - Entity ID to collect for
- `entity` (object, optional) - Pre-fetched entity instance (optimization)

**Returns**: `Array<object>` - Deduplicated activity metadata array

**Collection Tiers**:

1. **Tier 1**: Activity index lookup (if provided)
2. **Tier 2**: Inline component metadata (`activityMetadata` fields)
3. **Tier 3**: Dedicated metadata components (`activity:description_metadata`)

**Deduplication**: By semantic signature (type, template, source, target, groupKey)

**Example**:

```javascript
const activities = collector.collectActivityMetadata('actor_123');
/* Returns:
[
  {
    type: 'inline',
    template: '{actor} is kneeling before {target}',
    priority: 100,
    target: 'target_456',
    groupKey: 'kneeling',
    sourceComponent: 'positioning:kneeling'
  },
  {
    type: 'dedicated',
    template: '{actor} caresses {targetPossessive} hand',
    priority: 90,
    target: 'target_456',
    descriptor: 'gently'
  }
]
*/
```

**Metadata Structure**:

```javascript
{
  type: 'inline' | 'dedicated' | 'index',
  template: string,           // NLG template with placeholders
  priority: number,           // Sorting priority (higher = more important)
  target: string,             // Target entity ID
  groupKey: string,           // Grouping identifier
  descriptor: string,         // Softener/adverb
  sourceComponent: string,    // Component ID that provided metadata
  condition: object,          // JSON Logic condition (optional)
  visibility: boolean         // Visibility flag (default: true)
}
```

---

## ActivityNLGSystem

**Location**: `src/anatomy/services/activityNLGSystem.js`

**Role**: Self-contained natural language generation with pronoun resolution.

### Constructor

```javascript
new ActivityNLGSystem({
  logger,
  entityManager,
  cacheManager,
  config = {}
})
```

#### Dependencies

| Dependency      | Interface              | Description                         |
| --------------- | ---------------------- | ----------------------------------- |
| `logger`        | `ILogger`              | Logging interface                   |
| `entityManager` | `IEntityManager`       | Entity access for gender components |
| `cacheManager`  | `ActivityCacheManager` | Name/gender caching                 |
| `config`        | `object` (optional)    | NLG configuration (nameResolution)  |

**Important**: NLG system is **self-contained** - does NOT depend on `AnatomyFormattingService` for pronoun resolution.

### Public Methods

#### `generatePhrase(activity, context): string`

Generate natural language phrase from activity metadata and context.

**Parameters**:

- `activity` (object, required) - Activity metadata
  - `template` (string) - NLG template with placeholders
  - `descriptor` (string, optional) - Softener/adverb
  - `adverb` (string, optional) - Additional adverb
- `context` (object, required) - Context from `ActivityContextBuildingSystem`
  - `actorName` (string) - Resolved actor name or pronoun
  - `targetName` (string) - Resolved target name or pronoun
  - `relationshipTone` (string) - 'intimate' or 'formal'

**Returns**: `string` - Generated phrase

**Example**:

```javascript
const phrase = nlgSystem.generatePhrase(
  {
    template: '{actor} caresses {targetPossessive} hand',
    descriptor: 'gently',
  },
  {
    actorName: 'Alice',
    targetName: 'Bob',
    actorPronoun: 'she',
    targetPronoun: 'he',
    relationshipTone: 'intimate',
  }
);
// Returns: "Alice gently caresses his hand"
```

**Template Placeholders**:

- `{actor}` → Actor name or pronoun
- `{actorPossessive}` → Actor possessive (Alice's / her / his / their)
- `{target}` → Target name or pronoun
- `{targetPossessive}` → Target possessive
- `{descriptor}` → Softener injection point

#### `resolvePronoun(entityId: string, type: string): string`

Resolve pronoun for entity (self-contained gender detection).

**Parameters**:

- `entityId` (string, required) - Entity ID
- `type` (string, required) - Pronoun type: 'subject', 'object', 'possessive'

**Returns**: `string` - Resolved pronoun

**Example**:

```javascript
const pronoun = nlgSystem.resolvePronoun('actor_123', 'subject');
// Returns: "she" | "he" | "they"
```

**Gender Detection**:

1. Check cache via `ActivityCacheManager`
2. Query `core:gender` component via `EntityManager`
3. Extract gender value from component
4. Fallback to "they" if not found
5. Cache result for future calls

**Pronoun Map**:

```javascript
{
  male: { subject: 'he', object: 'him', possessive: 'his' },
  female: { subject: 'she', object: 'her', possessive: 'her' },
  neutral: { subject: 'they', object: 'them', possessive: 'their' }
}
```

#### `sanitizeEntityName(name: string): string`

Sanitize entity name for safe display.

**Parameters**:

- `name` (string, required) - Raw entity name

**Returns**: `string` - Sanitized name

**Example**:

```javascript
const clean = nlgSystem.sanitizeEntityName('Alice\u0000\t\n');
// Returns: "Alice"
```

**Sanitization**:

- Removes control characters
- Trims whitespace
- Normalizes multiple spaces
- Fallback to "Unknown entity" for invalid input

#### `mergeAdverb(current: string, injected: string): string`

Merge two adverbs with natural conjunction.

**Parameters**:

- `current` (string) - Current adverb
- `injected` (string) - Adverb to merge

**Returns**: `string` - Merged adverb phrase

**Example**:

```javascript
const merged = nlgSystem.mergeAdverb('softly', 'gently');
// Returns: "softly and gently"
```

**Rules**:

- Empty + X → X
- X + Empty → X
- X + X → X (no duplication)
- X + Y → "X and Y"

---

## ActivityGroupingSystem

**Location**: `src/anatomy/services/grouping/activityGroupingSystem.js`

**Role**: Groups sequential activities by target with natural language connectors.

### Constructor

```javascript
new ActivityGroupingSystem({
  logger,
  config = {}
})
```

#### Dependencies

| Dependency | Interface           | Description            |
| ---------- | ------------------- | ---------------------- |
| `logger`   | `ILogger`           | Logging interface      |
| `config`   | `object` (optional) | Grouping configuration |

**Configuration**:

```javascript
{
  simultaneityThreshold: 10,  // Max priority difference for grouping
  conjunctions: {
    primary: 'and',
    secondary: 'while also',
    tertiary: 'as well as'
  }
}
```

### Public Methods

#### `groupActivities(phrases: Array<object>): Array<string>`

Group activity phrases by target and simultaneity.

**Parameters**:

- `phrases` (Array<object>, required) - Activity phrase objects
  - `target` (string) - Target entity ID
  - `priority` (number) - Activity priority
  - `phrase` (string) - Generated NLG phrase
  - `groupByTarget` (boolean, optional) - Force grouping flag

**Returns**: `Array<string>` - Grouped phrase strings

**Example**:

```javascript
const grouped = groupingSystem.groupActivities([
  { target: 'target_1', priority: 100, phrase: 'kisses her lips' },
  { target: 'target_1', priority: 95, phrase: 'caresses her cheek' },
  { target: 'target_2', priority: 80, phrase: 'waves to Bob' },
]);
// Returns: ["kisses her lips and caresses her cheek", "waves to Bob"]
```

**Grouping Logic**:

1. Group activities with same target
2. Check priority difference ≤ `simultaneityThreshold`
3. Respect `groupByTarget` flags
4. Select conjunction based on group size and priority
5. Join with selected conjunction

**Conjunction Selection**:

- 2 activities → `primary` ("and")
- 3 activities → `secondary` ("while also")
- 4+ activities → `tertiary` ("as well as")

---

## ActivityContextBuildingSystem

**Location**: `src/anatomy/services/context/activityContextBuildingSystem.js`

**Role**: Builds context for activity generation (names, relationships, tone).

### Constructor

```javascript
new ActivityContextBuildingSystem({
  logger,
  entityManager,
  cacheManager,
});
```

#### Dependencies

| Dependency      | Interface              | Description            |
| --------------- | ---------------------- | ---------------------- |
| `logger`        | `ILogger`              | Logging interface      |
| `entityManager` | `IEntityManager`       | Entity access          |
| `cacheManager`  | `ActivityCacheManager` | Name/closeness caching |

### Public Methods

#### `buildContext(actorId: string, targetId: string): object`

Build context object for NLG generation.

**Parameters**:

- `actorId` (string, required) - Actor entity ID
- `targetId` (string, required) - Target entity ID

**Returns**: `object` - Context object

**Context Structure**:

```javascript
{
  actorName: string,          // Resolved actor name
  targetName: string,         // Resolved target name
  actorPronoun: string,       // Actor pronoun (he/she/they)
  targetPronoun: string,      // Target pronoun
  relationshipTone: string,   // 'intimate' | 'formal'
  closeness: number          // 0.0 to 1.0
}
```

**Example**:

```javascript
const context = contextBuilder.buildContext('actor_123', 'target_456');
/* Returns:
{
  actorName: 'Alice',
  targetName: 'Bob',
  actorPronoun: 'she',
  targetPronoun: 'he',
  relationshipTone: 'intimate',
  closeness: 0.85
}
*/
```

**Closeness Detection**:

1. Check cache via `ActivityCacheManager`
2. Query `positioning:closeness` component via `EntityManager`
3. Extract partner list and calculate closeness
4. Cache result for future calls
5. Default to 0.0 if not found

**Tone Adjustment**:

- `closeness >= 0.7` → `'intimate'` (use pronouns, softer language)
- `closeness < 0.7` → `'formal'` (use names, standard language)

---

## ActivityFilteringSystem

**Location**: `src/anatomy/services/filtering/activityFilteringSystem.js`

**Role**: Filters activities based on JSON Logic conditions and visibility.

### Constructor

```javascript
new ActivityFilteringSystem({
  logger,
  jsonLogicEvaluationService,
  config = {}
})
```

#### Dependencies

| Dependency                   | Interface                    | Description             |
| ---------------------------- | ---------------------------- | ----------------------- |
| `logger`                     | `ILogger`                    | Logging interface       |
| `jsonLogicEvaluationService` | `JsonLogicEvaluationService` | JSON Logic evaluation   |
| `config`                     | `object` (optional)          | Filtering configuration |

**Configuration**:

```javascript
{
  enableContextAwareness: true,
  respectVisibilityFlags: true
}
```

### Public Methods

#### `filterActivities(activities: Array<object>, context: object): Array<object>`

Filter activities by conditions and visibility.

**Parameters**:

- `activities` (Array<object>, required) - Activity metadata array
- `context` (object, required) - Context from `ActivityContextBuildingSystem`

**Returns**: `Array<object>` - Filtered activity array

**Example**:

```javascript
const filtered = filteringSystem.filterActivities(
  [
    {
      template: '{actor} kisses {target}',
      condition: { '>=': [{ var: 'closeness' }, 0.7] },
      visibility: true,
    },
    {
      template: '{actor} waves to {target}',
      visibility: false,
    },
  ],
  { closeness: 0.85 }
);
// Returns: [first activity only] (condition passes, visibility true)
```

**Filtering Rules**:

1. **Visibility check**: `visibility === false` → filter out
2. **Condition evaluation**: If `condition` present, evaluate JSON Logic
3. **Context awareness**: Pass context variables to JSON Logic
4. **Fail-safe**: Errors in evaluation → filter out activity

**JSON Logic Context Variables**:

- `closeness` - Relationship closeness (0.0 to 1.0)
- `relationshipTone` - 'intimate' or 'formal'
- `actorName` - Actor name
- `targetName` - Target name
- Any custom variables from context

---

## ActivityIndexManager

**Location**: `src/anatomy/services/activityIndexManager.js`

**Role**: Builds transient activity indexes for fast lookups.

### Constructor

```javascript
new ActivityIndexManager({
  logger,
});
```

#### Dependencies

| Dependency | Interface | Description       |
| ---------- | --------- | ----------------- |
| `logger`   | `ILogger` | Logging interface |

### Public Methods

#### `buildIndex(activities: Array<object>): object`

Build activity index from metadata array.

**Parameters**:

- `activities` (Array<object>, required) - Activity metadata array

**Returns**: `object` - Activity index structure

**Index Structure**:

```javascript
{
  byTarget: {
    'targetId_1': [activity1, activity2],
    'targetId_2': [activity3]
  },
  byPriority: {
    high: [activity1],      // priority >= 90
    medium: [activity2],    // 50 <= priority < 90
    low: [activity3]        // priority < 50
  },
  byGroup: {
    'groupKey_1': [activity1, activity2],
    'groupKey_2': [activity3]
  }
}
```

**Example**:

```javascript
const index = indexManager.buildIndex([
  { target: 'target_1', priority: 100, groupKey: 'kneeling' },
  { target: 'target_1', priority: 95, groupKey: 'kneeling' },
  { target: 'target_2', priority: 80, groupKey: 'waving' },
]);
/* Returns:
{
  byTarget: {
    'target_1': [activity1, activity2],
    'target_2': [activity3]
  },
  byPriority: {
    high: [activity1, activity2],
    medium: [activity3],
    low: []
  },
  byGroup: {
    'kneeling': [activity1, activity2],
    'waving': [activity3]
  }
}
*/
```

**Use Cases**:

- Fast target lookup
- Priority-based filtering
- Group-based queries
- Cache key generation

---

## Supporting Services

### AnatomyFormattingService

**Location**: `src/services/anatomyFormattingService.js`

**Method**: `getActivityIntegrationConfig(): object`

Returns merged activity configuration:

```javascript
{
  prefix: 'Activity: ',
  suffix: '',
  separator: '. ',
  enableContextAwareness: true,
  maxActivities: 10,
  deduplicateActivities: true,
  nameResolution: {
    usePronounsWhenAvailable: true,
    fallbackToNames: true,
    respectGenderComponents: true
  },
  caching: {
    enabled: true,
    maxSize: 1000,
    ttl: 60000,
    enableMetrics: false
  },
  grouping: {
    simultaneityThreshold: 10,
    conjunctions: {
      primary: 'and',
      secondary: 'while also',
      tertiary: 'as well as'
    }
  },
  filtering: {
    enableContextAwareness: true,
    respectVisibilityFlags: true
  }
}
```

**Note**: Must call `initialize()` before resolving configuration.

### JsonLogicEvaluationService

**Method**: `evaluate(expression: object, data: object): any`

Evaluates JSON Logic expressions for activity filtering.

**Example**:

```javascript
const result = jsonLogicService.evaluate(
  { '>=': [{ var: 'closeness' }, 0.7] },
  { closeness: 0.85 }
);
// Returns: true
```

### BodyDescriptionComposer

**Location**: `src/anatomy/bodyDescriptionComposer.js`

**Method**: `composeDescription(entity: object): string`

Orchestrates descriptor generation and embeds activity summary.

**Integration**:

```javascript
// Inside composeDescription
const activityText =
  await this.#activityDescriptionFacade.generateActivityDescription(entityId);
if (activityText) {
  descriptors.push(activityText);
}
```

---

## Events

### ACTIVITY_DESCRIPTION_ERROR

Dispatched whenever `generateActivityDescription` throws an error.

**Event Type**: `ACTIVITY_DESCRIPTION_ERROR`

**Payload**:

```json
{
  "type": "ACTIVITY_DESCRIPTION_ERROR",
  "payload": {
    "errorType": "string",
    "entityId": "string",
    "timestamp": 1710000000000,
    "message": "string"
  }
}
```

**Example Subscription**:

```javascript
eventBus.subscribe('ACTIVITY_DESCRIPTION_ERROR', (event) => {
  console.error('Activity generation failed:', event.payload);
  // Log to analytics, surface in diagnostics, etc.
});
```

### Cache Invalidation Events

**ActivityCacheManager** subscribes to:

#### COMPONENT_ADDED

**Payload**:

```json
{
  "type": "COMPONENT_ADDED",
  "payload": {
    "entityId": "string",
    "componentId": "string"
  }
}
```

**Behavior**: Invalidates all caches for `entityId`.

#### COMPONENT_REMOVED

**Payload**:

```json
{
  "type": "COMPONENT_REMOVED",
  "payload": {
    "entityId": "string",
    "componentId": "string"
  }
}
```

**Behavior**: Invalidates all caches for `entityId`.

#### COMPONENTS_BATCH_ADDED

**Payload**:

```json
{
  "type": "COMPONENTS_BATCH_ADDED",
  "payload": {
    "entityId": "string",
    "componentIds": ["string"]
  }
}
```

**Behavior**: Bulk invalidation for `entityId`.

#### ENTITY_REMOVED

**Payload**:

```json
{
  "type": "ENTITY_REMOVED",
  "payload": {
    "entityId": "string"
  }
}
```

**Behavior**: Removes all caches for `entityId`.

---

## Usage Examples

### Basic Usage

```javascript
// Resolve from DI container
const facade = container.resolve('IActivityDescriptionService');

// Generate description
const description = await facade.generateActivityDescription('actor_123');
console.log(description);
// Output: "kneeling before Alice. caressing her hand gently"
```

### Cache Management

```javascript
const facade = container.resolve('IActivityDescriptionService');

// Invalidate specific cache
facade.invalidateCache('actor_123', 'name');

// Bulk invalidation
facade.invalidateEntities(['actor_1', 'actor_2', 'target_5']);

// Full reset
facade.clearAllCaches();
```

### Custom Configuration

```javascript
// In mod's anatomy formatting config
{
  "activityIntegration": {
    "prefix": "",
    "separator": ", ",
    "maxActivities": 5,
    "nameResolution": {
      "usePronounsWhenAvailable": false
    },
    "caching": {
      "ttl": 120000
    }
  }
}
```

### Direct Service Usage (Advanced)

```javascript
// Access individual services for advanced use cases
const cacheManager = container.resolve('IActivityCacheManager');
const nlgSystem = container.resolve('IActivityNLGSystem');

// Register custom cache
cacheManager.registerCache('myCustomCache', { ttl: 30000, maxSize: 100 });

// Generate phrase directly
const phrase = nlgSystem.generatePhrase(
  { template: '{actor} greets {target}' },
  { actorName: 'Alice', targetName: 'Bob' }
);
```

---

## Error Handling

### Common Errors

#### Invalid Entity ID

```javascript
try {
  await facade.generateActivityDescription('');
} catch (err) {
  // Throws: InvalidArgumentError
  console.error(err.message);
}
```

#### Missing Dependencies

```javascript
try {
  new ActivityDescriptionFacade({ logger: null });
} catch (err) {
  // Throws during dependency validation
  console.error(err.message);
}
```

#### JSON Logic Evaluation Failure

```javascript
// Filtering system handles gracefully
const filtered = filteringSystem.filterActivities(
  [{ condition: { invalid: 'logic' } }],
  {}
);
// Returns: [] (filters out activities with failed conditions)
```

### Best Practices

1. **Always validate dependencies** - Use `validateDependency` helper
2. **Check cache before expensive operations** - Use `ActivityCacheManager`
3. **Subscribe to error events** - Monitor `ACTIVITY_DESCRIPTION_ERROR`
4. **Clean up on shutdown** - Call `destroy()` to prevent memory leaks
5. **Use bulk operations** - `invalidateEntities` over individual `invalidateCache` calls

---

## Performance Considerations

### Caching Strategy

- **Cache hits**: <0.1ms average
- **Cache misses**: 10-20ms average (full generation)
- **Target**: 95%+ cache hit rate for repeated calls

### Service Performance

| Operation           | Average Time | Optimization                       |
| ------------------- | ------------ | ---------------------------------- |
| Cache lookup        | <0.1ms       | Always check cache first           |
| Metadata collection | 2-5ms        | Use pre-built index when available |
| Index building      | 1-3ms        | Cache index signatures             |
| Filtering           | 1-2ms        | Early exit on visibility false     |
| Context building    | 1-2ms        | Cache names and closeness          |
| NLG generation      | 2-4ms        | Cache pronoun lookups              |
| Grouping            | 1-2ms        | Minimal overhead                   |

### Optimization Tips

1. **Pre-build indexes** - Provide `activityIndex` to `ActivityMetadataCollectionSystem`
2. **Batch operations** - Use `invalidateEntities` for multiple entities
3. **Configure TTL** - Balance freshness vs. performance
4. **Limit max activities** - Use `maxActivities` config to cap processing
5. **Cache warmup** - Pre-populate caches for frequently accessed entities

---

## Backward Compatibility

The `ActivityDescriptionFacade` maintains **100% backward compatibility** with the original `ActivityDescriptionService`:

✅ Same method signatures
✅ Same return types
✅ Same error behavior
✅ Same configuration format
✅ Same event types

**Migration**: Drop-in replacement via DI container - no code changes required.

See [Migration Guide](../migration/activity-description-service-refactoring.md) for details.

---

## Further Reading

- [Architecture](./architecture.md) - System design and data flow
- [Testing Guide](./testing-guide.md) - Testing patterns and strategies
- [Configuration Guide](./configuration-guide.md) - All configuration options
- [Development Guide](./development-guide.md) - Extending and customizing
- [Migration Guide](../migration/activity-description-service-refactoring.md) - Upgrading from monolithic service
