# Activity Description API Reference

## ActivityDescriptionService

Location: `src/anatomy/services/activityDescriptionService.js`

### Constructor

```javascript
new ActivityDescriptionService({
  logger,
  entityManager,
  anatomyFormattingService,
  jsonLogicEvaluationService,
  activityIndex = null,
  eventBus = null,
})
```

| Dependency | Description |
| --- | --- |
| `logger` | Must implement `info`, `warn`, `error`, and `debug`. Validated via `ensureValidLogger`. |
| `entityManager` | Provides `getEntityInstance` and component access used to gather metadata and resolve names. |
| `anatomyFormattingService` | Supplies activity formatting configuration and pronoun rules via `getActivityIntegrationConfig()`. |
| `jsonLogicEvaluationService` | Evaluates conditional visibility expressions on metadata. Must expose `evaluate(payload, data)`. |
| `activityIndex` | Optional pre-built index (used in ACTDESC-020 optimisation). Pass `null` to let the service build indexes lazily. |
| `eventBus` | Optional dispatcher implementing `dispatch`, `subscribe`, and `unsubscribe`. Enables telemetry events and cache invalidation subscriptions. |

The constructor performs dependency validation and subscribes to component events when an
`eventBus` is supplied. It also starts a cache cleanup interval based on internal defaults.

### `generateActivityDescription(entityId: string): Promise<string>`

Main entry point. Discovers inline and dedicated metadata for the supplied actor, filters and
ranks the results, and returns the formatted description string (or `""` when no activities
are visible). Throws when `entityId` is not a non-empty string.

### `getTestHooks(): ActivityDescriptionTestHooks`

Exposes white-box helpers used in tests and tooling. Functions include:

* `mergeAdverb(current, injected)` – combine adverbs without duplication.
* `injectSoftener(template, descriptor)` – insert softening descriptors into templates.
* `buildActivityIndex(activities)` – generate the internal index structure.
* `deduplicateActivitiesBySignature(activities)` – remove duplicate metadata entries.
* `truncateDescription(description, maxLength)` – enforce configured length limits.

### `invalidateEntities(entityIds: string[]): void`

Bulk-invalidate caches for multiple entity IDs. Safely ignores invalid input and logs a
warning when the argument is not an array. Typically used after large state mutations.

### `invalidateCache(entityId: string, cacheType = 'all'): void`

Invalidate caches for a single entity. Supported `cacheType` values:

* `name` – clear the entity name cache entry.
* `gender` – clear cached gender data.
* `activity` – clear cached activity indexes.
* `all` – clear all of the above.

Unknown cache types log a warning and perform no action.

### `clearAllCaches(): void`

Clears all caches (`entityName`, `gender`, `activityIndex`, `closeness`) and logs the event.
Use sparingly outside of diagnostics because it forces the service to rebuild context.

### `destroy(): void`

Cancels scheduled cleanup, unsubscribes event handlers, clears caches, and logs shutdown. Call
this when disposing of the service in tests or when reconfiguring the container.

## Related Services

### AnatomyFormattingService

* Location: `src/services/anatomyFormattingService.js`
* Method: `getActivityIntegrationConfig()` – returns merged configuration, including:
  * `prefix`, `suffix`, `separator`
  * `enableContextAwareness`, `maxActivities`, `deduplicateActivities`
  * `nameResolution` options (`usePronounsWhenAvailable`, `fallbackToNames`, `respectGenderComponents`)
  * `enableCaching`, `cacheTimeout` (Phase 3 controls)
* Must call `initialize()` before resolving configuration to avoid runtime errors.

### JsonLogicEvaluationService

* Provides `evaluate(expression, data)` used to apply metadata conditions.
* Registered in the same container bundle (`worldAndEntityRegistrations`).

### BodyDescriptionComposer

* Location: `src/anatomy/bodyDescriptionComposer.js`
* Method: `composeDescription(entity)` – orchestrates descriptor generation and embeds the
  activity summary if the actor exposes metadata.

## Events

### `ACTIVITY_DESCRIPTION_ERROR`

Dispatched whenever `generateActivityDescription` throws. Payload shape:

```json
{
  "type": "ACTIVITY_DESCRIPTION_ERROR",
  "payload": {
    "errorType": "string",
    "entityId": "string",
    "timestamp": 1710000000000
  }
}
```

Subscribe through the supplied event bus to monitor failures or surface diagnostics in tooling.
