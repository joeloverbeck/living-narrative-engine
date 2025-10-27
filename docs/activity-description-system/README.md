# Activity Description Composition System

## Overview

The Activity Description Composition System discovers metadata across mods, ranks the
results, and produces natural language activity summaries for character bodies. It is built
on top of the existing anatomy description pipeline so that activity snippets can be
inserted alongside torso, limb, and equipment descriptors with consistent formatting.

## Quick Start

### 1. Preserve the activity slot in the body ordering

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

Keep the `activity` entry when overriding description order so that
`BodyDescriptionComposer` knows where to inject generated activities. Mods that
customise ordering should append additional descriptors without removing the activity
slot.

### 2. Embed inline metadata where appropriate

```json
{
  "id": "positioning:kneeling_before",
  "dataSchema": {
    "type": "object",
    "required": ["entityId"],
    "properties": {
      "entityId": { "type": "string" },
      "activityMetadata": {
        "type": "object",
        "properties": {
          "shouldDescribeInActivity": { "type": "boolean", "default": true },
          "template": {
            "type": "string",
            "default": "{actor} is kneeling before {target}"
          },
          "targetRole": { "type": "string", "default": "entityId" },
          "priority": { "type": "integer", "default": 75 }
        }
      }
    }
  }
}
```

Inline metadata lives next to the component schema. Use this pattern for simple binary
states or whenever the description follows the component one-to-one.

### 3. Generate descriptions through the service

```javascript
import ActivityDescriptionService from '../../src/anatomy/services/activityDescriptionService.js';

const service = new ActivityDescriptionService({
  logger,
  entityManager,
  anatomyFormattingService,
  jsonLogicEvaluationService,
});

const summary = await service.generateActivityDescription('jon_ureña');
// => "Activity: Jon Ureña is kneeling before Alicia Western."
```

Resolve the service through the dependency injection container in production code so it
receives the configured `AnatomyFormattingService` instance and shared caches.

## Key Features

- **Mod-agnostic discovery** – scans both inline metadata and dedicated
  `activity:description_metadata` components.
- **Priority-aware composition** – sorts activities by numeric priority, deduplicates
  signatures, and respects `maxActivities` limits.
- **Pronoun and naming support** – integrates with the anatomy formatting configuration to
  use pronouns when available and fall back to entity names.
- **Conditional visibility** – applies JSON Logic conditions, relationship closeness
  context, and grouping instructions before rendering.
- **Event-driven invalidation** – subscribes to component add/remove events so stale cache
  entries are purged automatically.
- **Error reporting** – dispatches `ACTIVITY_DESCRIPTION_ERROR` when generation fails,
  allowing monitoring and analytics hooks.

## Documentation Map

| Guide | Summary |
| --- | --- |
| [Architecture](./architecture.md) | End-to-end data flow, service responsibilities, and integration points. |
| [Metadata Patterns](./metadata-patterns.md) | Authoring guide for inline and dedicated metadata definitions. |
| [Integration Guide](./integration-guide.md) | How to wire the system into mods, DI registrations, and render pipelines. |
| [API Reference](./api-reference.md) | Constructor options, public methods, and dispatched events. |
| [Testing Guide](./testing-guide.md) | Available test suites and strategies for covering new behaviour. |
| [Troubleshooting](./troubleshooting.md) | Common misconfigurations and how to diagnose them. |
| Examples | Practical walkthroughs under [examples/](./examples/) for common use cases. |

## Additional Resources

- Detailed design notes: `brainstorming/ACTDESC-activity-description-composition-design.md`
- Body description architecture reference: `reports/BODCLODES-body-description-composition-architecture.md`
- Activity metadata schemas: `data/mods/activity/`
