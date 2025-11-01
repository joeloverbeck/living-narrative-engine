# Activity Description Composition System

## Overview

The Activity Description Composition System discovers metadata across mods, ranks the
results, and produces natural language activity summaries for character bodies. It is built
on top of the existing anatomy description pipeline so that activity snippets can be
inserted alongside torso, limb, and equipment descriptors with consistent formatting.

## Quick Start

1. **Preserve the activity slot** – Keep the `activity` entry when customising
   description order so `BodyDescriptionComposer` knows where to inject the summary.
   See the [Integration Guide](./integration-guide.md#1-preserve-the-activity-slot) for
   the reference snippet and additional context.
2. **Author metadata** – Attach inline `activityMetadata` blocks for simple cases or use
   `activity:description_metadata` entities for advanced logic. The
   [Metadata Authoring Guide](./metadata-patterns.md) covers both patterns with complete
   schema examples.
3. **Generate descriptions through the service** – Resolve
   `ActivityDescriptionFacade` (usually via the dependency injection container) to obtain
   summaries or use `BodyDescriptionComposer` for end-to-end body text generation. The
   [Integration Guide](./integration-guide.md#4-generating-descriptions) walks through the
   setup.

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
