# Activity Description Troubleshooting

Use this guide when activity summaries are missing, incorrect, or slow to generate.

## Common Symptoms and Fixes

| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| Activity text never appears | `activity` removed from description order | Ensure `activity` remains in the order returned by `DescriptionConfiguration.getDescriptionOrder()` or formatting overrides. |
| Only some activities render | Metadata `shouldDescribeInActivity` set to `false` or conditions hiding entries | Inspect component data and dedicated metadata entities. Use `getTestHooks().buildActivityIndex()` in tests to verify visibility flags. |
| Pronouns default to names | `AnatomyFormattingService` not initialised or `nameResolution.usePronounsWhenAvailable` disabled | Call `anatomyFormattingService.initialize()` during boot and review mod-provided `activityIntegration` config. |
| Duplicate descriptions | Metadata lacks unique signatures or `deduplicateActivities` disabled | Confirm templates/targets differ and that formatting config has `deduplicateActivities: true`. |
| Stale data after scripts mutate entities | External code bypassed component add/remove events | Call `ActivityDescriptionService.invalidateCache(entityId)` or `invalidateEntities([...])` after manual changes. |
| JSON Logic errors in logs | Invalid expressions in metadata conditions | Validate expressions with unit tests using `jsonLogicEvaluationService.evaluate()` and ensure metadata values exist. |
| `ACTIVITY_DESCRIPTION_ERROR` dispatched frequently | Downstream dependency threw during generation | Subscribe to the event, log `errorType`, and inspect stack traces. Common causes include missing target entities or malformed templates. |
| Performance degradation | Cache disabled or frequent cache clearing | Check `activityIntegration.enableCaching` and `cacheTimeout`. Avoid unnecessary `clearAllCaches()` calls. |

## Debugging Tips

* Enable verbose logging on the container logger to trace cache invalidations and metadata
  discovery.
* Use the unit test suite (`tests/unit/anatomy/services/activityDescriptionService.test.js`) as
  a diagnostic harness—copy relevant scenarios and adapt metadata to reproduce issues.
* Subscribe to `COMPONENT_ADDED`/`COMPONENT_REMOVED` events in tooling to confirm the service is
  receiving invalidation notifications.
* Inspect dedicated metadata entities via data dumps or registry viewers to ensure they are
  loaded when expected.
* When working on mods, add temporary assertions that call
  `generateActivityDescription(entityId)` directly to confirm metadata is discoverable before
  integrating with the full body composer.
