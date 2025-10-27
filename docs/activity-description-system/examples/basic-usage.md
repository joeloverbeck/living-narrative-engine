# Basic Usage: Generate an Activity Summary

This walkthrough shows how to bootstrap the container, create a simple entity, and request an
activity summary.

## 1. Boot the container

```javascript
import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';

const container = new AppContainer();
await configureBaseContainer(container, { includeGameSystems: false });

const anatomyFormatting = container.resolve(tokens.AnatomyFormattingService);
anatomyFormatting.initialize();
```

The base configuration registers `ActivityDescriptionService`, `BodyDescriptionComposer`, and
supporting services. Initialising the formatting service loads mod-provided configuration.

## 2. Register component metadata (tooling/testing)

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

For production builds the registry is populated by the mod loader. The snippet above mirrors
the real component found in `data/mods/positioning/components/kneeling_before.component.json`.

## 3. Create entities with component overrides

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
characters and overrides their names + activity metadata.

## 4. Generate the description

```javascript
const activityService = container.resolve(tokens.ActivityDescriptionService);
const summary = await activityService.generateActivityDescription(actor.id);

console.log(summary);
// Activity: Jon Ureña is kneeling before Alicia Western.
```

Alternatively call `BodyDescriptionComposer.composeDescription(actorEntity)` to retrieve the
full anatomy + activity block. The service returns an empty string when no visible metadata is
found, so consumers should guard against blank results before rendering.
