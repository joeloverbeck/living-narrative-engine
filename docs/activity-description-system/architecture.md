# Activity Description System Architecture

## System Overview

```
┌──────────────────────────────┐      ┌────────────────────────────┐
│  BodyDescriptionComposer     │─────▶│ ActivityDescriptionService │
│  (description orchestrator)  │      │ (activity generation core) │
└───────────────┬──────────────┘      └───────────────┬────────────┘
                │                                     │
                │ requests activity text              │ collects + formats
                │                                     │
        ┌───────▼────────┐                  ┌─────────▼─────────┐
        │ Inline metadata│                  │ Dedicated metadata│
        │ (component data│                  │ activity:description│
        │  activityMetadata)                │ _metadata entities) │
        └────────┬───────┘                  └─────────┬─────────┘
                 │                                    │
                 └───────┐                    ┌───────┘
                         ▼                    ▼
                 ┌───────────────┐    ┌───────────────────────┐
                 │ Activity index│◀──▶│ Priority + filter flow│
                 └──────┬────────┘    └───────────┬───────────┘
                        │                         │
                        ▼                         ▼
               ┌────────────────┐        ┌─────────────────────┐
               │ Pronoun + name │        │ Natural language    │
               │ resolution     │        │ formatting pipeline │
               └────────────────┘        └──────────┬──────────┘
                                                    ▼
                                           Activity summary text
```

The system plugs into the anatomy description pipeline by letting
`BodyDescriptionComposer` request a formatted activity block after body descriptors have
been built. The service collects metadata from inline component definitions and dedicated
metadata components, ranks the resulting activities, filters them through conditional logic,
and renders the final prose.

## Core Components

### ActivityDescriptionService (`src/anatomy/services/activityDescriptionService.js`)

* Discovers inline metadata from entity components using `activityMetadata` payloads.
* Collects dedicated metadata from `activity:description_metadata` entities for advanced
  scenarios.
* Builds a transient activity index (grouped by target, priority, and group keys) to
  support fast filtering and grouping.
* Applies visibility rules using `JsonLogicEvaluationService` and relationship closeness
  data from `positioning:closeness` components.
* Formats natural language phrases, including pronoun substitution and optional grouping of
  related activities.
* Maintains caches for entity names, gender lookups, activity indexes, and closeness data
  with automatic cleanup.

### BodyDescriptionComposer (`src/anatomy/bodyDescriptionComposer.js`)

* Coordinates descriptor generation for an entity.
* Invokes `generateActivityDescription(entityId)` when the description order reaches the
  `activity` slot.
* Merges activity text with existing body descriptors and equipment summaries.

### AnatomyFormattingService (`src/services/anatomyFormattingService.js`)

* Loads formatting configuration from mods and exposes
  `getActivityIntegrationConfig()`.
* Provides limits, separators, and pronoun preferences consumed by the activity service.
* Must be initialized before activity generation so that merged configuration is available.

### Dependency Injection (`src/dependencyInjection/registrations/worldAndEntityRegistrations.js`)

* Registers `ActivityDescriptionService` as a container singleton alongside the anatomy
  formatting service and the body composer.
* Ensures all consumers resolve the same instance, enabling cache reuse and coordinated
  event subscriptions.

## Data Flow

1. **Request** – `BodyDescriptionComposer` calls
   `ActivityDescriptionService.generateActivityDescription(entityId)`.
2. **Collection** – the service gathers inline metadata from the actor's components and
   dedicated metadata records registered for the actor.
3. **Indexing** – activities are deduplicated and sorted by priority while building helper
   indexes for grouping and conditional checks.
4. **Filtering** – JSON Logic conditions, visibility flags, and context awareness rules are
   evaluated. Activities that fail checks are dropped.
5. **Context building** – the service determines actor/target names, pronouns, and
   relationship tone (using closeness data when present).
6. **Composition** – the service formats each activity phrase, combines grouped fragments,
   and joins them with the configured separator.
7. **Return** – the composed string (prefixed/suffixed per configuration) is returned to the
   composer. An empty string indicates no visible activities.

## Event Handling

* Subscribes to `COMPONENT_ADDED`, `COMPONENT_REMOVED`, and `ENTITY_REMOVED` events so that
  caches are invalidated whenever the underlying entity state changes.
* Dispatches `ACTIVITY_DESCRIPTION_ERROR` via the optional event bus dependency whenever a
  generation error occurs. Subscribers can log, trace, or surface diagnostics in tooling.

## Caching Strategy

* **Entity names** – caches resolved display names keyed by entity ID.
* **Genders** – caches gender component lookups to accelerate pronoun decisions.
* **Activity index** – caches deterministic signatures of metadata collections for reuse
  when the actor's state is unchanged.
* **Relationship closeness** – stores partner lists pulled from `positioning:closeness`
  components to avoid repeated component reads.
* Automatic pruning runs on an interval established during construction. Manual invalidation
  is available through `invalidateCache()` and `invalidateEntities()`.

## Configuration Integration

`ActivityDescriptionService` merges defaults with the result of
`anatomyFormattingService.getActivityIntegrationConfig()`:

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
    respectGenderComponents: true,
  },
}
```

Mods can override these values by supplying an `activityIntegration` block inside their
anatomy formatting configuration. The merged configuration is applied to all consumers of
`ActivityDescriptionService`.

## Extension Points

* **Metadata schemas** – Extend inline metadata schemas or add new
  `activity:description_metadata` components to introduce custom activities.
* **Name resolution** – Provide additional logic in `AnatomyFormattingService` or extend the
  service to honour new pronoun rules.
* **Event subscribers** – Listen for `ACTIVITY_DESCRIPTION_ERROR` to feed dashboards,
  analytics, or player-facing diagnostics.
* **Caching hooks** – Call `invalidateCache(entityId, cacheType)` when external systems
  mutate entity state outside of the normal component lifecycle.
