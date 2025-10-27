# Performance Optimisation Example

This example highlights configuration and API hooks that keep activity generation fast under
heavy load.

## 1. Enable caching in formatting config

Mods can opt into the Phase 3 caching knobs provided by
`AnatomyFormattingService.getActivityIntegrationConfig()`.

```json
{
  "id": "example:anatomy_formatting",
  "data": {
    "activityIntegration": {
      "enableCaching": true,
      "cacheTimeout": 15000,
      "maxActivities": 8,
      "respectPriorityTiers": true
    }
  }
}
```

With caching enabled the service stores activity indexes for up to 15 seconds, cutting down on
repeated discovery work when NPCs poll for descriptions frequently.

## 2. Batch invalidation after state changes

When running scripted events that mutate many entities, call `invalidateEntities` once instead
of clearing caches per update.

```javascript
const actorIds = ['jon_ureña', 'alicia_western', 'guard_1'];
activityService.invalidateEntities(actorIds);
```

The helper iterates the relevant caches (names, genders, activity indexes, closeness) and logs
how many entities were cleared.

## 3. Use performance tests as guardrails

Run the performance suite after large changes to ensure latency stays within targets:

```bash
npm run test:performance -- ActivityDescription
```

`tests/performance/anatomy/activityDescriptionPerformance.test.js` benchmarks scenarios with
multiple activities and reports timings for cache hits vs. misses. Treat regressions above 50ms
for 10 activities as failures.

## 4. Monitor metrics via event bus

If the service is constructed with an event bus, emit custom metrics when
`ACTIVITY_DESCRIPTION_ERROR` occurs or when cache invalidation runs. Example subscriber:

```javascript
dispatcher.subscribe('ACTIVITY_DESCRIPTION_ERROR', ({ payload }) => {
  metrics.increment('activity.error', { errorType: payload.errorType });
});
```

## 5. Avoid unnecessary recomputation

* Fetch the service once per container and reuse it; it is registered as a singleton.
* Refrain from calling `clearAllCaches()` in production—use targeted invalidation instead.
* When previewing data in tools, use `getTestHooks().getCacheSnapshot()` to inspect cache sizes
  before adding extra logging or instrumentation.
