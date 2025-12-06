# Activity Description System Examples

These examples demonstrate how to work with the activity description system in different
scenarios. They share a common setup and then branch into specialised workflows.

## Prerequisites

Before running any of the examples, bootstrap the dependency injection container and configure
the anatomy formatting service. This registers the activity description services and loads any
mod-provided configuration.

```javascript
import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';

const container = new AppContainer();
await configureBaseContainer(container, { includeGameSystems: false });

const anatomyFormatting = container.resolve(tokens.AnatomyFormattingService);
anatomyFormatting.initialize();
```

With the container initialised, the following sections focus on specific metadata and runtime
patterns.

## Example 1: Generate a Basic Activity Summary

### Register component metadata (tooling/testing)

For production builds the registry is populated by the mod loader. When running scripts or unit
tests you can store metadata manually:

```javascript
const dataRegistry = container.resolve(tokens.IDataRegistry);

dataRegistry.store('components', 'positioning:kneeling_before', {
  id: 'positioning:kneeling_before',
  dataSchema: {
    type: 'object',
    required: ['entityId'],
    properties: {
      entityId: { type: 'string' },
      activityMetadata: {
        type: 'object',
        properties: {
          shouldDescribeInActivity: { type: 'boolean', default: true },
          template: {
            type: 'string',
            default: '{actor} is kneeling before {target}',
          },
          targetRole: { type: 'string', default: 'entityId' },
          priority: { type: 'integer', default: 75 },
        },
      },
    },
  },
});
```

### Create entities with component overrides

```javascript
const entityManager = container.resolve(tokens.IEntityManager);

const actor = await entityManager.createEntityInstance('isekai:hero', {
  instanceId: 'jon_ureña',
  componentOverrides: {
    'core:name': { text: 'Jon Ureña' },
    'positioning:kneeling_before': {
      entityId: 'alicia_western',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is kneeling before {target}',
        priority: 75,
      },
    },
  },
});

await entityManager.createEntityInstance('isekai:sidekick', {
  instanceId: 'alicia_western',
  componentOverrides: { 'core:name': { text: 'Alicia Western' } },
});
```

Use definitions that exist in your data set. The example above reuses the `isekai` mod
characters and overrides their names plus activity metadata.

### Generate the description

```javascript
const activityFacade = container.resolve(tokens.ActivityDescriptionFacade);
const summary = await activityFacade.generateActivityDescription(actor.id);

console.log(summary);
// Activity: Jon Ureña is kneeling before Alicia Western.
```

Call `BodyDescriptionComposer.composeDescription(actorEntity)` to retrieve the full anatomy plus
activity block. The service returns an empty string when no visible metadata is found, so guard
against blank results before rendering.

## Example 2: Conditionally Hide an Activity

This scenario shows how to describe a stealth component only when it is active and the target is
not alert.

### Metadata definition

```json
{
  "id": "example:stealth_in_cover_metadata",
  "components": [
    {
      "componentId": "activity:description_metadata",
      "data": {
        "sourceComponent": "stealth:in_cover",
        "descriptionType": "template",
        "template": "{actor} is hiding in cover near {target}",
        "targetRole": "targetId",
        "priority": 80,
        "conditions": {
          "showOnlyIfProperty": {
            "property": "isActive",
            "equals": true
          },
          "hideIfTargetHasComponent": "awareness:alert"
        }
      }
    }
  ]
}
```

The metadata inspects the source component's `isActive` property and hides the activity when the target is alert.

### Runtime setup

```javascript
entityManager.addComponent('jon_ureña', 'stealth:in_cover', {
  targetId: 'guard_1',
  isActive: true,
});

entityManager.addComponent('guard_1', 'awareness:alert', {
  level: 'low',
});
```

With the target currently alert, the activity is suppressed.

```javascript
const summary = await activityFacade.generateActivityDescription('jon_ureña');
console.log(summary); // ""
```

Update the target state and regenerate:

```javascript
entityManager.removeComponent('guard_1', 'awareness:alert');
const updated = await activityFacade.generateActivityDescription('jon_ureña');
console.log(updated);
// Activity: Jon Ureña is hiding in cover near Guard 1.
```

#### Tips

- Combine `showOnlyIfProperty` with inline metadata flags (`shouldDescribeInActivity`) for simple
  runtime toggles.
- For more complex logic use `JsonLogicEvaluationService` by providing a `jsonLogic`
  expression in your metadata (see ACTDESC-018 examples in the unit tests).
- Conditions run against the component data and resolved target state, so ensure any referenced
  properties exist before enabling the condition.

## Example 3: Group Related Activities

Combine multiple activities into a single sentence using the `grouping` metadata block.

### Scenario

A character is both **holding hands** and **embracing** another entity. Each activity remains
individually discoverable, but the final description should read:

```
Activity: Jon Ureña is embracing Alicia Western while holding hands.
```

### Metadata

Create dedicated metadata entities that share a `groupKey` and specify compatible `combineWith`
values.

```json
{
  "id": "example:intimate_embrace_metadata",
  "components": [
    {
      "componentId": "activity:description_metadata",
      "data": {
        "sourceComponent": "intimacy:embracing",
        "descriptionType": "template",
        "template": "{actor} is embracing {target}",
        "priority": 85,
        "grouping": {
          "groupKey": "intimate_contact",
          "combineWith": ["intimacy:holding_hands"]
        }
      }
    }
  ]
}
```

```json
{
  "id": "example:holding_hands_metadata",
  "components": [
    {
      "componentId": "activity:description_metadata",
      "data": {
        "sourceComponent": "intimacy:holding_hands",
        "descriptionType": "template",
        "template": "{actor} is holding hands with {target}",
        "priority": 70,
        "grouping": {
          "groupKey": "intimate_contact",
          "combineWith": ["intimacy:embracing"]
        }
      }
    }
  ]
}
```

Both records share the same `groupKey` (`intimate_contact`). Each declares that it can be combined
with the other's `sourceComponent`.

### Runtime components

```javascript
entityManager.addComponent('jon_ureña', 'intimacy:embracing', {
  partner: 'alicia_western',
});

entityManager.addComponent('jon_ureña', 'intimacy:holding_hands', {
  partner: 'alicia_western',
});
```

### Generate description

```javascript
const summary = await activityFacade.generateActivityDescription('jon_ureña');
```

The service detects the shared group key, merges the phrases, and inserts a conjunction using the
`buildRelatedActivityFragment` helper. The result is a single sentence describing both activities
without repetition.

#### Tips

- Prioritise the primary activity by giving it the highest `priority`. The first item in the group
  controls the base template.
- Use `groupKey` values to scope combinations. Activities with different keys never merge.
- If you need custom conjunctions or phrasing, adjust the metadata templates to include the
  conjunction text directly (for example, `'{actor} is embracing {target} while {adverb}'`).

## Example 4: Optimise Performance

Keep activity generation fast under heavy load by combining caching configuration with targeted
invalidation.

### Enable caching in the formatting config

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

### Batch invalidation after state changes

When running scripted events that mutate many entities, call `invalidateEntities` once instead of
clearing caches per update.

```javascript
const actorIds = ['jon_ureña', 'alicia_western', 'guard_1'];
activityFacade.invalidateEntities(actorIds);
```

The helper iterates the relevant caches (names, genders, activity indexes, closeness) and logs how
many entities were cleared.

### Use performance tests as guardrails

Run the performance suite after large changes to ensure latency stays within targets:

```bash
npm run test:performance -- ActivityDescription
```

`tests/performance/anatomy/activityDescriptionPerformance.test.js` benchmarks scenarios with
multiple activities and reports timings for cache hits vs. misses. Treat regressions above 50ms for
10 activities as failures.

### Monitor metrics via event bus

If the service is constructed with an event bus, emit custom metrics when
`ACTIVITY_DESCRIPTION_ERROR` occurs or when cache invalidation runs.

```javascript
dispatcher.subscribe('ACTIVITY_DESCRIPTION_ERROR', ({ payload }) => {
  metrics.increment('activity.error', { errorType: payload.errorType });
});
```

### Avoid unnecessary recomputation

- Fetch the service once per container and reuse it; it is registered as a singleton.
- Refrain from calling `clearAllCaches()` in production—use targeted invalidation instead.
- When previewing data in tools, use `getTestHooks().getCacheSnapshot()` to inspect cache sizes
  before adding extra logging or instrumentation.
