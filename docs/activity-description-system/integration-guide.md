# Activity Description Integration Guide

This guide explains how to wire the activity description system into game flows, mods, and
supporting tooling.

## 1. Preserve the Activity Slot

Activity text is injected when the body description order reaches the `activity` slot.
If a mod overrides the ordering it must keep that slot in place:

```javascript
// src/anatomy/configuration/descriptionConfiguration.js
export const defaultDescriptionOrder = [
  'height',
  'build',
  'body_composition',
  'body_hair',
  'skin_color',
  'hair',
  'eye',
  'face',
  'ear',
  'nose',
  'mouth',
  'neck',
  'breast',
  'torso',
  'arm',
  'hand',
  'leg',
  'foot',
  'tail',
  'wing',
  'activity',
];
```

Append new descriptors before or after `activity` rather than removing it. Without the
slot `BodyDescriptionComposer` has nowhere to insert the generated summary.

## 2. Dependency Registration

`ActivityDescriptionService` is registered alongside other anatomy services inside
`registerWorldAndEntity`:

```javascript
registrar.singletonFactory(tokens.ActivityDescriptionService, (c) => {
  return new ActivityDescriptionService({
    logger: c.resolve(tokens.ILogger),
    entityManager: c.resolve(tokens.IEntityManager),
    anatomyFormattingService: c.resolve(tokens.AnatomyFormattingService),
    jsonLogicEvaluationService: c.resolve(tokens.JsonLogicEvaluationService),
  });
});
```

Ensure the world/entity registration bundle is invoked (it is part of
`configureBaseContainer`). Consumers should always resolve the service from the DI container
rather than instantiating it manually in production code.

## 3. Formatting Configuration

`AnatomyFormattingService` must be initialised before the activity service is used. During
container bootstrapping call `anatomyFormattingService.initialize()` to merge formatting
configs from mods.

Mods can override activity formatting by providing an `activityIntegration` block in their
formatting config. Typical properties include `prefix`, `separator`, `maxActivities`, and
pronoun behaviour. The merged configuration is returned via
`getActivityIntegrationConfig()` and consumed automatically by the activity service.

## 4. Generating Descriptions

Activity descriptions are produced indirectly through `BodyDescriptionComposer`. The
composer injects activity text when the description order reaches the `activity` slot.

```javascript
const container = new AppContainer();
await configureBaseContainer(container, { includeGameSystems: false });

const composer = container.resolve(tokens.BodyDescriptionComposer);
const description = await composer.composeDescription(bodyEntity);
```

`composeDescription` will internally call
`ActivityDescriptionService.generateActivityDescription(entityId)` using the same entity. To
invoke the service directly (for diagnostics or previews) resolve it from the container:

```javascript
const activityService = container.resolve(tokens.ActivityDescriptionService);
const summary = await activityService.generateActivityDescription(
  bodyEntity.getId()
);
```

## 5. Data Requirements

- **Actor state** – the entity must expose `anatomy:body` (required by the composer) and any
  components that define activity metadata.
- **Target resolution** – ensure referenced target IDs exist in the entity manager so that
  pronoun/label lookups succeed.
- **Formatting config** – mods that override description order should keep the `activity`
  slot present. Removing it prevents the composer from rendering activities.

## 6. Event Bus Integration

When an event bus is supplied to the service it subscribes to component change events and
dispatches `ACTIVITY_DESCRIPTION_ERROR` on failures. Ensure your application resolves a
compatible bus (`ISafeEventDispatcher`) so monitoring hooks work:

```javascript
const service = container.resolve(tokens.ActivityDescriptionService);
const dispatcher = container.resolve(tokens.ISafeEventDispatcher);
dispatcher.subscribe('ACTIVITY_DESCRIPTION_ERROR', (event) => {
  console.warn('Activity description error:', event.payload);
});
```

## 7. Cache Invalidation Hooks

Most integrations can rely on automatic invalidation (component add/remove events). If you
mutate entity state outside of the normal component lifecycle, call:

```javascript
service.invalidateCache(entityId); // Clear caches for the actor
service.invalidateCache(entityId, 'name'); // Clear only the name cache
service.invalidateEntities([actorId, targetId]);
```

Use these helpers after batch updates or script-driven world changes to ensure subsequent
activity requests see fresh data.

## 8. Tooling and Preview Use Cases

For mod tooling or previews you can instantiate the service with lightweight mocks:

```javascript
const service = new ActivityDescriptionService({
  logger: createMockLogger(),
  entityManager: testBed.entityManager,
  anatomyFormattingService: testBed.anatomyFormattingService,
  jsonLogicEvaluationService: testBed.jsonLogicEvaluationService,
});
```

The service exposes `getTestHooks()` to obtain white-box helpers for building deterministic
unit tests or authoring tools that need direct access to formatting utilities.
