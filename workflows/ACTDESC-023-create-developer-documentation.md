# ACTDESC-023: Create Developer Documentation

## Status
🟡 **Pending**

## Phase
**Phase 7: Production Polish** (Week 5)

## Description
Create comprehensive developer documentation covering architecture, usage patterns, testing strategies, and troubleshooting for the Activity Description Composition System. Enable developers to understand, extend, and maintain the system effectively.

## Background
Complete implementation requires thorough documentation for knowledge transfer, onboarding, and long-term maintainability. Documentation should cover technical architecture, usage examples, and common patterns.

**Reference**: Design document lines 2746-2848 (Documentation Requirements)

## Technical Specification

### Documentation Structure

```
docs/activity-description-system/
├── README.md                    # Overview and quick start
├── architecture.md              # System architecture
├── metadata-patterns.md         # Metadata authoring guide
├── integration-guide.md         # Integration patterns
├── api-reference.md            # Service API documentation
├── testing-guide.md            # Testing strategies
├── troubleshooting.md          # Common issues and solutions
└── examples/                   # Code examples
    ├── basic-usage.md
    ├── advanced-grouping.md
    ├── conditional-visibility.md
    └── performance-optimization.md
```

### README.md

```markdown
# Activity Description Composition System

## Overview

The Activity Description System generates natural language descriptions of character activities by discovering and composing metadata from components across all mods.

## Quick Start

### 1. Enable in Configuration

```javascript
// src/anatomy/configuration/descriptionConfiguration.js
export const defaultDescriptionOrder = [
  'anatomy',
  'equipment',
  'activity',
];
```

Ensure your overrides keep the `activity` entry in the body description order. The default configuration already includes it, but custom mods or formatting services should preserve the slot so activity text is rendered.

### 2. Add Inline Metadata

```json
{
  "positioning:kneeling_before": {
    "entityId": "alicia",
    "activityMetadata": {
      "shouldDescribeInActivity": true,
      "template": "{actor} is kneeling before {target}",
      "priority": 75
    }
  }
}
```

Inline metadata lives inside the component definition (for example, `data/mods/positioning/components/kneeling_before.component.json`).

### 3. Generate Description

```javascript
const description = await activityDescriptionService.generateActivityDescription('jon');
// Output: "Activity: Jon is kneeling before Alicia"
```

## Key Features

- ✅ **Mod-Agnostic Discovery**: Works across all mods automatically
- ✅ **Natural Language Composition**: Pronouns, grouping, context awareness
- ✅ **Conditional Visibility**: JSON Logic-based dynamic filtering
- ✅ **Performance Optimized**: Caching, indexing, lazy evaluation
- ✅ **Event-Driven**: Auto-invalidation on state changes
- ✅ **Comprehensive Testing**: Unit, integration, performance tests

## Documentation

- [Architecture](./architecture.md) - System design and patterns
- [Metadata Patterns](./metadata-patterns.md) - Authoring guide
- [Integration Guide](./integration-guide.md) - Usage patterns
- [API Reference](./api-reference.md) - Service methods
- [Testing Guide](./testing-guide.md) - Testing strategies
- [Troubleshooting](./troubleshooting.md) - Common issues

## Examples

See [examples/](./examples/) for detailed code examples.
```

### architecture.md

```markdown
# Activity Description System Architecture

## System Overview

```
┌─────────────────────────────────────────────────┐
│         BodyDescriptionComposer                  │
│  (Orchestrates body description generation)     │
└────────────────┬────────────────────────────────┘
                 │
                 │ requests activity description
                 ▼
┌─────────────────────────────────────────────────┐
│      ActivityDescriptionService                  │
│  (Core service for activity composition)        │
└────────────────┬────────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ Inline       │  │ Dedicated    │
│ Metadata     │  │ Metadata     │
│ Collection   │  │ Collection   │
└──────┬───────┘  └──────┬───────┘
       │                 │
       └────────┬────────┘
                ▼
    ┌─────────────────────┐
    │ Activity Discovery  │
    │ (Find all metadata) │
    └──────────┬──────────┘
               ▼
    ┌─────────────────────┐
    │ Priority Sorting    │
    │ (Rank activities)   │
    └──────────┬──────────┘
               ▼
    ┌─────────────────────┐
    │ Conditional Filter  │
    │ (Visibility rules)  │
    └──────────┬──────────┘
               ▼
    ┌─────────────────────┐
    │ Natural Language    │
    │ Composition         │
    └──────────┬──────────┘
               ▼
         Description Output
```

## Core Components

### 1. ActivityDescriptionService

**Location**: `src/anatomy/services/activityDescriptionService.js`

**Responsibilities**:
- Activity metadata discovery (inline + dedicated)
- Priority-based sorting and filtering
- Natural language composition with pronouns
- Caching and performance optimization
- Error recovery and validation

**Key Methods**:
- `generateActivityDescription(entityId)` - Main entry point
- `#collectInlineMetadata(entity)` - Scan component metadata
- `#collectDedicatedMetadata(entity)` - Find dedicated components
- `#formatActivityDescription(activities, entity)` - Compose output

### 2. Metadata Patterns

**Inline Metadata**: Embedded in existing components
**Dedicated Metadata**: Separate `activity:description_metadata` components

### 3. Integration Point

**BodyDescriptionComposer** calls ActivityDescriptionService during body description generation, inserting activity descriptions at the configured position in the description order.

## Design Patterns

### Dependency Injection

```javascript
registrar.singletonFactory(tokens.ActivityDescriptionService, (c) => {
  return new ActivityDescriptionService({
    logger: c.resolve(tokens.ILogger),
    entityManager: c.resolve(tokens.IEntityManager),
    anatomyFormattingService: c.resolve(tokens.AnatomyFormattingService),
    jsonLogicEvaluationService: c.resolve(tokens.JsonLogicEvaluationService),
    // activityIndex provided in ACTDESC-020
  });
});
```

### Caching Strategy

- **Entity Names**: Cached per session
- **Gender Data**: Cached per session
- **Activity Index**: Built per generation, cached briefly
- **Event-Driven Invalidation**: Auto-clear on component changes

### Error Recovery

- Individual activity failures don't break generation
- Graceful degradation with partial results
- Comprehensive validation with clear error messages
- Event dispatching for error monitoring

## Performance Characteristics

- **Simple Activity**: <5ms
- **5 Activities**: <20ms
- **10 Activities**: <50ms
- **Cache Hit Rate**: >80%
- **Memory Overhead**: <10MB
```

### metadata-patterns.md

```markdown
# Activity Metadata Authoring Guide

## Inline Metadata Pattern

### Basic Structure

```json
{
  "componentId": "positioning:kneeling_before",
  "entityId": "target_entity_id",
  "activityMetadata": {
    "shouldDescribeInActivity": true,
    "template": "{actor} is kneeling before {target}",
    "priority": 75
  }
}
```

### When to Use Inline Metadata

✅ **Use inline when**:
- Activity is intrinsic to the component (e.g., kneeling, holding hands)
- One-to-one relationship between component and activity
- No need for multiple descriptions per component
- Simple templating is sufficient

❌ **Don't use inline when**:
- Component represents multiple activities
- Need different descriptions based on context
- Complex conditional logic required
- Activity is optional or contextual

## Dedicated Metadata Pattern

### Basic Structure

```json
{
  "componentId": "activity:description_metadata",
  "sourceComponent": "intimacy:kissing",
  "descriptionType": "dedicated",
  "verb": "kissing",
  "targetRole": "partner",
  "priority": 90,
  "conditions": {
    "showOnlyIfProperty": {
      "property": "initiator",
      "equals": true
    }
  }
}
```

### When to Use Dedicated Metadata

✅ **Use dedicated when**:
- Multiple activities from one component
- Complex conditional visibility
- Contextual descriptions needed
- Activity description separate from component data

## Priority Guidelines

```
90-100: Critical relationship activities (kissing, embracing)
75-89:  Positioning and movement (kneeling, straddling)
60-74:  Equipment and holding (holding item, wearing)
50-59:  Passive states (sitting, standing)
< 50:   Background activities
```

## Template Variables

| Variable | Resolves To | Example |
|----------|-------------|---------|
| `{actor}` | Entity name or pronoun | "Jon" or "he" |
| `{target}` | Target entity name/pronoun | "Alicia" or "her" |
| `{adverb}` | Optional adverb modifier | "tenderly", "gently" |

## Conditional Visibility

### Required Components

```json
{
  "conditions": {
    "requiredComponents": ["positioning:kneeling_before"]
  }
}
```

### Forbidden Components

```json
{
  "conditions": {
    "forbiddenComponents": ["positioning:standing"]
  }
}
```

### Property-Based Conditions

```json
{
  "conditions": {
    "showOnlyIfProperty": {
      "property": "initiator",
      "equals": true
    }
  }
}
```

### Custom JSON Logic

```json
{
  "conditions": {
    "customLogic": {
      "and": [
        { ">=": [{ "var": "activity.intensity" }, 80] },
        { "in": [{ "var": "target.id" }, { "var": "entity.components.relationships:partner.entityId" }] }
      ]
    }
  }
}
```

## Best Practices

1. **Keep templates concise**: Natural language, not code
2. **Use priority wisely**: Establish hierarchy within your mod
3. **Test visibility conditions**: Ensure they trigger correctly
4. **Avoid duplication**: One activity per unique combination
5. **Consider context**: Use adverbs and grouping for nuance
6. **Document complex logic**: Comment JSON Logic conditions
```

### api-reference.md

```markdown
# Activity Description Service API Reference

## ActivityDescriptionService

### Constructor

```javascript
constructor({
  logger,
  entityManager,
  anatomyFormattingService,
  jsonLogicEvaluationService,
  activityIndex = null,
  eventBus = null,
})
```

**Parameters**:
- `logger` (ILogger, required): Logging interface
- `entityManager` (IEntityManager, required): Entity management interface
- `anatomyFormattingService` (AnatomyFormattingService, required): Configuration provider
- `jsonLogicEvaluationService` (JsonLogicEvaluationService, required): JSON Logic evaluator used for conditional visibility
- `activityIndex` (ActivityIndex, optional): Precomputed index hook (Phase 3 enhancement)
- `eventBus` (EventBus, optional): Event system for cache invalidation and telemetry

**Throws**: `InvalidArgumentError` if required dependencies missing

### Methods

#### generateActivityDescription

```javascript
async generateActivityDescription(entityId)
```

Generates natural language activity description for an entity.

**Parameters**:
- `entityId` (string, required): Entity ID to generate description for

**Returns**: `Promise<string>` - Formatted activity description or empty string

**Example**:
```javascript
const description = await service.generateActivityDescription('jon');
// Output: "Activity: Jon is kneeling before Alicia and holding her hands"
```

**Errors**: Never throws - returns empty string on failure with error logging

#### invalidateCache

```javascript
invalidateCache(entityId, cacheType = 'all')
```

Manually invalidate cached data for an entity.

**Parameters**:
- `entityId` (string, required): Entity to invalidate cache for
- `cacheType` (string, optional): Cache type to invalidate
  - `'name'`: Name cache only
  - `'gender'`: Gender cache only
  - `'activity'`: Activity index only
  - `'all'`: All caches (default)

**Example**:
```javascript
service.invalidateCache('jon', 'name');
```

#### invalidateEntities

```javascript
invalidateEntities(entityIds)
```

Batch invalidate caches for multiple entities.

**Parameters**:
- `entityIds` (Array<string>, required): Entity IDs to invalidate

**Example**:
```javascript
service.invalidateEntities(['jon', 'alicia', 'bobby']);
```

#### clearAllCaches

```javascript
clearAllCaches()
```

Clear all cached data completely.

**Use Case**: Memory cleanup, test isolation

**Example**:
```javascript
service.clearAllCaches();
```

#### destroy

```javascript
destroy()
```

Clean up service resources and unsubscribe from events.

**Important**: Call before service disposal to prevent memory leaks.

**Example**:
```javascript
service.destroy();
```

## Configuration

### AnatomyFormattingService.getActivityIntegrationConfig()

```javascript
getActivityIntegrationConfig()
```

**Returns**:
```javascript
{
  prefix: 'Activity: ',
  suffix: '',
  separator: '. ',
  enableContextAwareness: true,
  maxActivities: 10,
  respectPriorityTiers: true,
  enableCaching: false,
  cacheTimeout: 5000,
  nameResolution: {
    usePronounsWhenAvailable: true,
    fallbackToNames: true,
    respectGenderComponents: true,
  },
}
```

## Events

### Input Events (Listened)

**COMPONENT_ADDED** / **COMPONENT_REMOVED**
```javascript
{
  type: 'COMPONENT_ADDED', // COMPONENT_REMOVED uses the same payload shape
  payload: {
    componentTypeId: string,
    entity: { id?: string; instanceId?: string } | null,
    entityId?: string
  }
}
```
Triggers cache invalidation for relevant components.

**ENTITY_REMOVED**
```javascript
{
  type: 'ENTITY_REMOVED',
  payload: {
    entity: { id?: string; instanceId?: string } | null,
    entityId?: string
  }
}
```
Clears all caches for destroyed entity.

### Output Events (Dispatched)

**ACTIVITY_DESCRIPTION_ERROR**
```javascript
{
  type: 'ACTIVITY_DESCRIPTION_ERROR',
  payload: {
    errorType: string,
    entityId: string,
    timestamp: number
  }
}
```
Dispatched on generation errors for monitoring.
```

## Acceptance Criteria
- [ ] Complete documentation structure created
- [ ] README.md with quick start guide
- [ ] Architecture documentation with diagrams
- [ ] Metadata authoring patterns documented
- [ ] API reference complete
- [ ] Integration guide with examples
- [ ] Testing guide with strategies
- [ ] Troubleshooting guide with solutions
- [ ] Code examples for common scenarios
- [ ] All documentation reviewed and validated

## Dependencies
- **Requires**: All Phase 6 features (ACTDESC-018 to ACTDESC-021)
- **Requires**: ACTDESC-022 (Edge cases documented)
- **Blocks**: ACTDESC-024 (Deployment needs documentation)
- **Enhances**: Developer experience and maintainability

## Implementation Notes
1. **Markdown Format**: Use standard markdown for documentation
2. **Code Examples**: Include runnable, tested code snippets
3. **Visual Aids**: Use ASCII diagrams and flowcharts
4. **Clear Structure**: Organized by audience and use case
5. **Living Documentation**: Plan for updates as system evolves

## Reference Files
- All implementation files from ACTDESC-001 to ACTDESC-022
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 2746-2848)

## Success Metrics
- Documentation coverage complete
- Developer onboarding time <2 hours
- Zero ambiguities in critical workflows
- Positive developer feedback
- Reduced support requests

## Related Tickets
- **Requires**: All implementation tickets (ACTDESC-001 to ACTDESC-022)
- **Blocks**: ACTDESC-024 (Final deployment checklist)
- **Enhances**: Long-term maintainability and team efficiency
