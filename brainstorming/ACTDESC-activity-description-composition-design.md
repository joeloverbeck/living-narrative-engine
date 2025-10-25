# ACTDESC: Activity Description Composition System - Design Brainstorming

**Living Narrative Engine - Component Architecture Proposal**
_Generated: 2025-10-25_
_Reference: BODCLODES-body-description-composition-architecture.md_

## Executive Summary

This document explores architectural approaches for implementing a mod-agnostic activity description system that extends the existing body description composition pipeline. The system will generate dynamic "Activity:" sections describing what entities are currently doing (e.g., "Jon Ureña is holding hands with Alicia Western. Jon Ureña is kneeling before Alicia Western.") without hardcoding references to specific mod components.

### System Goals

1. **Mod-Agnostic Discovery**: Automatically detect activity-describing components through metadata markers, not hardcoded component IDs
2. **Natural Language Composition**: Generate grammatically coherent descriptions even for multiple simultaneous activities
3. **Extensible Architecture**: Allow mods to define new activity types without modifying core engine code
4. **Seamless Integration**: Follow the established Equipment service pattern for integration into `BodyDescriptionComposer`
5. **Performance Efficiency**: Minimize component iteration overhead through intelligent indexing strategies

### Integration Context

The activity description system will integrate into the existing body description pipeline as a **service extension point**, following the exact pattern established by `EquipmentDescriptionService` (see BODCLODES lines 750-856, 858-1056). It will:

- Inject into `BodyDescriptionComposer` as an optional dependency
- Process during the configured description order loop (after 'equipment')
- Return complete formatted strings to be added to the description lines array
- Support async operations for multi-entity coordination

### Key Architectural Decisions

Based on user requirements and system analysis:

| Decision Area | Choice | Rationale |
|---------------|--------|-----------|
| **Metadata Richness** | Rich metadata with priority and conditionals | Maximum flexibility for complex scenarios, future-proof |
| **Multi-Activity Handling** | Smart natural language composition | Best user experience, avoids repetitive "X is doing A. X is doing B." |
| **Discovery Pattern** | Hybrid (inline + dedicated components) | Simple cases use inline metadata, complex use dedicated components |
| **Entity Name Resolution** | Configurable with fallback to names | Supports future pronoun resolution while maintaining clarity |

---

## Design Principles

### 1. Component-First Architecture

Following LNE's modding-first philosophy, all activity descriptions are driven by **component metadata**, not hardcoded logic.

**Anti-Pattern (What We Must Avoid):**
```javascript
// ❌ WRONG: Hardcoded component checks
if (entity.hasComponent('kissing:kissing')) {
  description += 'kissing someone';
}
if (entity.hasComponent('positioning:hugging')) {
  description += 'hugging someone';
}
// This breaks when new activity mods are added!
```

**Correct Pattern (What We Will Implement):**
```javascript
// ✅ CORRECT: Metadata-driven discovery
const components = entity.getAllComponents();
for (const componentData of components) {
  if (componentData.activityMetadata?.shouldDescribeInActivity) {
    // Generate description from metadata
    descriptions.push(generateFromMetadata(componentData.activityMetadata));
  }
}
```

### 2. Metadata-Driven Description Generation

Activity components declare their descriptive properties through **metadata**, which the service interprets to generate natural language.

**Two Metadata Approaches:**

1. **Inline Metadata** (Simple cases):
```json
{
  "companionship:following": {
    "leaderId": "character_2",
    "activityMetadata": {
      "template": "{actor} is following {target}",
      "priority": 5
    }
  }
}
```

2. **Dedicated Metadata Component** (Complex cases):
```json
{
  "kissing:kissing": {
    "partner": "character_2",
    "initiator": true
  },
  "activity:description_metadata": {
    "sourceComponent": "kissing:kissing",
    "verb": "kissing",
    "targetRole": "partner",
    "priority": 10,
    "conditions": {
      "showOnlyIfInitiator": true
    }
  }
}
```

### 3. Natural Language Composition

The system must avoid robotic repetition and generate grammatically coherent sentences.

**Bad Output (Simple Concatenation):**
```
Activity: Jon Ureña is kneeling before Alicia Western. Jon Ureña is holding hands with Alicia Western.
```

**Good Output (Smart Composition):**
```
Activity: Jon Ureña is kneeling before Alicia Western and holding hands with her.
```

**Composition Rules:**
- Detect common subject (entity name)
- Group activities targeting the same entity
- Use pronouns to avoid repetition
- Respect priority ordering for multiple targets

### 4. Extension Point Pattern

Following Equipment service architecture (BODCLODES lines 257-307):

```javascript
// In BodyDescriptionComposer constructor
constructor({
  // ... existing services
  equipmentDescriptionService = null,
  activityDescriptionService = null, // ← New service
  logger = null,
}) {
  this.equipmentDescriptionService = equipmentDescriptionService;
  this.activityDescriptionService = activityDescriptionService; // ← Inject
}

// In composeDescription loop
for (const partType of descriptionOrder) {
  // ... handle body descriptors and equipment

  // Handle activity descriptions
  if (partType === 'activity' && this.activityDescriptionService) {
    const activityDescription =
      await this.activityDescriptionService.generateActivityDescription(
        bodyEntity.id
      );
    if (activityDescription) {
      lines.push(activityDescription);
    }
    processedTypes.add(partType);
    continue;
  }

  // ... handle body parts
}
```

### 5. Performance Considerations

**Challenge**: Finding activity-describing components without iterating all components on every description generation.

**Solutions**:
1. **Component Index** (Phase 1): Maintain index of components with activity metadata
2. **Event-Driven Updates** (Phase 2): Update index when components are added/removed
3. **Lazy Caching** (Phase 3): Cache generated descriptions with invalidation on component changes

---

## Component Architecture Approaches

### Approach 1: Inline Activity Metadata (Simple)

Components include activity description metadata directly in their schema.

#### Schema Extension Pattern

**Original Component Schema:**
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:kneeling_before",
  "description": "Tracks which entity the component holder is currently kneeling before.",
  "dataSchema": {
    "type": "object",
    "required": ["entityId"],
    "properties": {
      "entityId": { "type": "string" }
    }
  }
}
```

**Extended with Inline Metadata:**
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:kneeling_before",
  "description": "Tracks which entity the component holder is currently kneeling before.",
  "dataSchema": {
    "type": "object",
    "required": ["entityId"],
    "properties": {
      "entityId": {
        "type": "string",
        "description": "The entity being knelt before"
      },
      "activityMetadata": {
        "type": "object",
        "description": "Metadata for activity description generation",
        "properties": {
          "shouldDescribeInActivity": {
            "type": "boolean",
            "default": true,
            "description": "Whether to include in Activity section"
          },
          "template": {
            "type": "string",
            "default": "{actor} is kneeling before {target}",
            "description": "Description template with {actor} and {target} placeholders"
          },
          "targetRole": {
            "type": "string",
            "default": "entityId",
            "description": "Which property contains the target entity ID"
          },
          "priority": {
            "type": "integer",
            "default": 5,
            "minimum": 0,
            "maximum": 100,
            "description": "Priority for ordering multiple activities (higher = first)"
          }
        }
      }
    }
  }
}
```

#### Component Data Example

```json
{
  "positioning:kneeling_before": {
    "entityId": "character_2",
    "activityMetadata": {
      "shouldDescribeInActivity": true,
      "template": "{actor} is kneeling before {target}",
      "targetRole": "entityId",
      "priority": 8
    }
  }
}
```

#### Pros

- **Simple Integration**: No additional component types needed
- **Colocated Metadata**: Description logic near the component definition
- **Low Overhead**: Single component load, no additional lookups
- **Easy Migration**: Existing components can add metadata incrementally

#### Cons

- **Schema Bloat**: Every activity component needs metadata properties
- **Limited Flexibility**: Harder to override descriptions without changing component data
- **Coupling**: Activity metadata mixed with core component data
- **Versioning Complexity**: Changes to metadata structure require schema migrations

#### Use Cases

Best for:
- Simple positioning states (kneeling, standing, lying)
- Straightforward interactions (following, leading)
- Stable, well-defined activities unlikely to need complex customization

---

### Approach 2: Dedicated Metadata Components (Flexible)

Create separate `activity:description_metadata` components that reference the source activity components.

#### Dedicated Metadata Schema

**New Component Type: `activity:description_metadata`**

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "activity:description_metadata",
  "description": "Metadata for generating activity descriptions from related components. This is a marker component that tells the ActivityDescriptionService how to describe a component's state.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["sourceComponent", "descriptionType"],
    "properties": {
      "sourceComponent": {
        "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/componentId",
        "description": "Component ID this metadata describes (e.g., 'kissing:kissing')"
      },
      "descriptionType": {
        "type": "string",
        "enum": ["template", "verb", "custom", "conditional"],
        "description": "How to generate the description"
      },
      "template": {
        "type": "string",
        "description": "Template string with placeholders: {actor}, {target}, {verb}, {adverb}",
        "examples": [
          "{actor} is {verb} {target}",
          "{actor} is {verb} {target} {adverb}"
        ]
      },
      "verb": {
        "type": "string",
        "description": "Action verb for template-based generation",
        "examples": ["kissing", "hugging", "following", "kneeling before"]
      },
      "adverb": {
        "type": "string",
        "description": "Optional adverb modifier",
        "examples": ["passionately", "gently", "closely"]
      },
      "targetRole": {
        "type": "string",
        "description": "Property name in source component containing target entity ID",
        "default": "entityId",
        "examples": ["partner", "leaderId", "embraced_entity_id"]
      },
      "priority": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 50,
        "description": "Display priority (0=lowest, 100=highest)"
      },
      "conditions": {
        "type": "object",
        "description": "Conditional visibility rules",
        "properties": {
          "showOnlyIfProperty": {
            "type": "object",
            "description": "Show only if source component property matches value",
            "properties": {
              "property": { "type": "string" },
              "equals": {}
            }
          },
          "hideIfTargetHasComponent": {
            "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/componentId",
            "description": "Hide if target entity has this component"
          },
          "requiredComponents": {
            "type": "array",
            "items": {
              "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/componentId"
            },
            "description": "Show only if actor has these components"
          }
        }
      },
      "grouping": {
        "type": "object",
        "description": "How to group with other activities",
        "properties": {
          "groupKey": {
            "type": "string",
            "description": "Activities with same key can be combined"
          },
          "combineWith": {
            "type": "array",
            "items": { "type": "string" },
            "description": "List of description types this can combine with"
          }
        }
      }
    }
  }
}
```

#### Component Data Example

**Simple Template-Based Description:**
```json
{
  "positioning:kneeling_before": {
    "entityId": "character_2"
  },
  "activity:description_metadata": {
    "sourceComponent": "positioning:kneeling_before",
    "descriptionType": "template",
    "template": "{actor} is kneeling before {target}",
    "targetRole": "entityId",
    "priority": 75
  }
}
```

**Verb-Based Description with Conditions:**
```json
{
  "kissing:kissing": {
    "partner": "character_2",
    "initiator": true
  },
  "activity:description_metadata": {
    "sourceComponent": "kissing:kissing",
    "descriptionType": "verb",
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
}
```

**Complex Conditional with Grouping:**
```json
{
  "positioning:hugging": {
    "embraced_entity_id": "character_2",
    "initiated": true,
    "consented": true
  },
  "activity:description_metadata": {
    "sourceComponent": "positioning:hugging",
    "descriptionType": "verb",
    "verb": "hugging",
    "adverb": "tightly",
    "targetRole": "embraced_entity_id",
    "priority": 85,
    "conditions": {
      "requiredComponents": ["positioning:standing"]
    },
    "grouping": {
      "groupKey": "physical_contact",
      "combineWith": ["holding_hand", "kissing"]
    }
  }
}
```

#### Pros

- **Clean Separation**: Activity metadata separate from core component data
- **Override Flexibility**: Can define multiple metadata components for same source
- **Conditional Logic**: Rich conditional visibility without modifying source components
- **Extensibility**: New metadata types can be added without schema changes
- **Testing**: Easier to test description logic independently

#### Cons

- **Component Proliferation**: More components per entity
- **Lookup Overhead**: Need to find matching metadata components
- **Synchronization**: Must keep metadata in sync with source component
- **Complexity**: More moving parts to understand and maintain

#### Use Cases

Best for:
- Complex interactions with conditional descriptions (kissing only if initiator)
- Activities requiring rich metadata (priority, grouping, conditions)
- Scenarios needing description overrides without modifying source data
- Advanced natural language composition (grouping, combining activities)

---

### Approach 3: Hybrid Pattern (Recommended)

Use **inline metadata for simple cases**, **dedicated components for complex cases**.

#### Decision Matrix

| Activity Complexity | Recommended Approach | Example |
|---------------------|---------------------|---------|
| **Simple state** | Inline metadata | Following, leading, sitting |
| **Binary interaction** | Inline metadata | Holding hands, facing |
| **Conditional visibility** | Dedicated component | Kissing (only if initiator) |
| **Multiple description modes** | Dedicated component | Hugging (tight vs. casual) |
| **Groupable activities** | Dedicated component | Physical contact activities |
| **Context-dependent** | Dedicated component | Kneeling (before vs. general) |

#### Hybrid Detection Pattern

**Service Discovery Logic:**
```javascript
#collectActivityDescriptions(entityId) {
  const activities = [];
  const entity = this.#entityManager.getEntityInstance(entityId);
  if (!entity) return activities;

  // Strategy 1: Check for dedicated metadata components first
  if (entity.hasComponent('activity:description_metadata')) {
    const metadataComponents = entity.getAllComponentsOfType('activity:description_metadata');
    for (const metadata of metadataComponents) {
      activities.push(this.#processMetadataComponent(metadata, entity));
    }
  }

  // Strategy 2: Scan for inline activity metadata in remaining components
  const componentIds = entity.getComponentIds();
  for (const componentId of componentIds) {
    // Skip if already processed via dedicated metadata
    if (componentId === 'activity:description_metadata') continue;

    const componentData = entity.getComponentData(componentId);
    if (componentData?.activityMetadata?.shouldDescribeInActivity) {
      activities.push(this.#processInlineMetadata(componentId, componentData, entity));
    }
  }

  return activities;
}
```

#### Migration Path

**Phase 1: Start Simple**
- Implement inline metadata for existing components
- Get basic activity descriptions working
- Gather real-world usage patterns

**Phase 2: Add Dedicated for Complex Cases**
- Implement dedicated metadata component support
- Migrate complex scenarios to dedicated metadata
- Keep simple cases as inline

**Phase 3: Optimize**
- Build index of components with activity metadata
- Cache description generation
- Implement smart composition algorithms

#### Example: Simple vs. Complex

**Simple Case (Inline):**
```json
{
  "companionship:following": {
    "leaderId": "character_2",
    "activityMetadata": {
      "shouldDescribeInActivity": true,
      "template": "{actor} is following {target}",
      "targetRole": "leaderId",
      "priority": 40
    }
  }
}
```
**Output**: "Jon Ureña is following Alicia Western"

**Complex Case (Dedicated):**
```json
{
  "kissing:kissing": {
    "partner": "character_2",
    "initiator": true,
    "intensity": "passionate"
  },
  "activity:description_metadata": {
    "sourceComponent": "kissing:kissing",
    "descriptionType": "verb",
    "verb": "kissing",
    "adverb": "${source.intensity}ly", // Template reference to source property
    "targetRole": "partner",
    "priority": 95,
    "conditions": {
      "showOnlyIfProperty": {
        "property": "initiator",
        "equals": true
      }
    },
    "grouping": {
      "groupKey": "intimate_contact",
      "combineWith": ["hugging", "holding_hand"]
    }
  }
}
```
**Output (if initiator)**: "Jon Ureña is kissing Alicia Western passionately"
**Output (if not initiator)**: "" (hidden by condition)

#### Pros

- **Best of Both Worlds**: Simplicity where possible, power where needed
- **Incremental Adoption**: Start simple, add complexity as needed
- **Clear Guidelines**: Decision matrix makes approach selection straightforward
- **Performance Optimized**: Can optimize each approach independently

#### Cons

- **Two Code Paths**: Service must handle both patterns
- **Potential Confusion**: Developers must understand when to use which
- **Documentation Burden**: Need clear examples and guidelines

---

## Description Generation Strategies

### Strategy 1: Component Discovery Mechanisms

#### Option A: Naive Iteration (Simple, Slow)

```javascript
#findActivityComponents(entityId) {
  const entity = this.#entityManager.getEntityInstance(entityId);
  const activityComponents = [];

  // Iterate all components on entity
  const componentIds = entity.getComponentIds();
  for (const componentId of componentIds) {
    const data = entity.getComponentData(componentId);

    // Check for dedicated metadata
    if (componentId === 'activity:description_metadata') {
      activityComponents.push({ type: 'dedicated', data });
    }

    // Check for inline metadata
    if (data?.activityMetadata?.shouldDescribeInActivity) {
      activityComponents.push({ type: 'inline', componentId, data });
    }
  }

  return activityComponents;
}
```

**Performance**: O(n) where n = number of components on entity
**Pros**: Simple, no setup required
**Cons**: Slow for entities with many components

#### Option B: Component Type Index (Fast, Complex)

```javascript
class ActivityComponentIndex {
  #entityToActivityComponents = new Map(); // entityId → Set<componentId>
  #eventBus;

  constructor({ eventBus }) {
    this.#eventBus = eventBus;
    this.#setupEventListeners();
  }

  #setupEventListeners() {
    // Update index when components added
    this.#eventBus.subscribe('COMPONENT_ADDED', (event) => {
      const { entityId, componentId, componentData } = event.payload;

      if (this.#isActivityComponent(componentId, componentData)) {
        this.#addToIndex(entityId, componentId);
      }
    });

    // Update index when components removed
    this.#eventBus.subscribe('COMPONENT_REMOVED', (event) => {
      const { entityId, componentId } = event.payload;
      this.#removeFromIndex(entityId, componentId);
    });
  }

  #isActivityComponent(componentId, componentData) {
    return componentId === 'activity:description_metadata' ||
           componentData?.activityMetadata?.shouldDescribeInActivity === true;
  }

  #addToIndex(entityId, componentId) {
    if (!this.#entityToActivityComponents.has(entityId)) {
      this.#entityToActivityComponents.set(entityId, new Set());
    }
    this.#entityToActivityComponents.get(entityId).add(componentId);
  }

  #removeFromIndex(entityId, componentId) {
    const components = this.#entityToActivityComponents.get(entityId);
    if (components) {
      components.delete(componentId);
      if (components.size === 0) {
        this.#entityToActivityComponents.delete(entityId);
      }
    }
  }

  getActivityComponents(entityId) {
    return Array.from(this.#entityToActivityComponents.get(entityId) || []);
  }
}
```

**Performance**: O(1) lookup, O(1) updates
**Pros**: Very fast lookups, scalable
**Cons**: Memory overhead, requires event system integration

#### Option C: Lazy Caching (Middle Ground)

```javascript
class ActivityDescriptionService {
  #descriptionCache = new Map(); // entityId → { description, timestamp }
  #cacheTimeout = 5000; // 5 seconds

  async generateActivityDescription(entityId) {
    // Check cache first
    const cached = this.#descriptionCache.get(entityId);
    if (cached && Date.now() - cached.timestamp < this.#cacheTimeout) {
      return cached.description;
    }

    // Generate fresh description
    const description = await this.#generateFreshDescription(entityId);

    // Cache result
    this.#descriptionCache.set(entityId, {
      description,
      timestamp: Date.now()
    });

    return description;
  }

  // Invalidate cache when components change
  #setupCacheInvalidation() {
    this.#eventBus.subscribe('COMPONENT_ADDED', (event) => {
      this.#descriptionCache.delete(event.payload.entityId);
    });

    this.#eventBus.subscribe('COMPONENT_REMOVED', (event) => {
      this.#descriptionCache.delete(event.payload.entityId);
    });
  }
}
```

**Performance**: O(1) for cached, O(n) for fresh
**Pros**: Simple, reduces repeated generation
**Cons**: Cache invalidation complexity, stale data risk

#### Recommended Phasing

**Phase 1**: Naive iteration (simple, get it working)
**Phase 2**: Lazy caching (improve repeated lookups)
**Phase 3**: Full index (optimize for scale)

### Strategy 2: Natural Language Composition Algorithm

Goal: Transform multiple activity components into grammatically coherent sentences.

#### Algorithm Overview

```
Input: Activity metadata list
  [
    { verb: "kneeling before", target: "character_2", priority: 75 },
    { verb: "holding hands with", target: "character_2", priority: 60 },
    { verb: "following", target: "character_3", priority: 40 }
  ]

Processing Steps:
  1. Group by target entity
  2. Sort by priority within groups
  3. Construct subject-verb-object phrases
  4. Apply pronoun substitution rules
  5. Combine with appropriate conjunctions

Output: "Jon Ureña is kneeling before Alicia Western and holding hands with her. Jon Ureña is following Bob Smith."
```

#### Implementation: Activity Grouping

```javascript
#groupActivitiesByTarget(activities) {
  const grouped = new Map(); // targetId → activity[]

  for (const activity of activities) {
    const targetId = activity.targetEntityId;
    if (!grouped.has(targetId)) {
      grouped.set(targetId, []);
    }
    grouped.get(targetId).push(activity);
  }

  // Sort activities within each group by priority (descending)
  for (const [targetId, activityList] of grouped.entries()) {
    activityList.sort((a, b) => (b.priority || 50) - (a.priority || 50));
  }

  return grouped;
}
```

#### Implementation: Phrase Construction

```javascript
#constructActivityPhrases(actorName, groupedActivities) {
  const sentences = [];

  for (const [targetId, activities] of groupedActivities.entries()) {
    const targetName = this.#resolveEntityName(targetId);

    if (activities.length === 1) {
      // Single activity: "Jon is kneeling before Alicia"
      const phrase = this.#buildPhrase(actorName, activities[0].verb, targetName);
      sentences.push(phrase);
    } else {
      // Multiple activities: "Jon is kneeling before Alicia and holding hands with her"
      const phrases = activities.map((activity, index) => {
        if (index === 0) {
          return this.#buildPhrase(actorName, activity.verb, targetName);
        } else {
          // Use pronoun for subsequent activities with same target
          const pronoun = this.#getPronoun(targetId);
          return this.#buildPhrase(null, activity.verb, pronoun);
        }
      });

      sentences.push(this.#joinWithConjunctions(phrases));
    }
  }

  return sentences;
}

#buildPhrase(subject, verb, object) {
  if (subject) {
    return `${subject} is ${verb} ${object}`;
  } else {
    return `${verb} ${object}`;
  }
}

#joinWithConjunctions(phrases) {
  if (phrases.length === 1) return phrases[0];
  if (phrases.length === 2) {
    return `${phrases[0]} and ${phrases[1]}`;
  }

  // 3+ phrases: "A, B, and C"
  const allButLast = phrases.slice(0, -1).join(', ');
  const last = phrases[phrases.length - 1];
  return `${allButLast}, and ${last}`;
}
```

#### Implementation: Pronoun Resolution

```javascript
#getPronoun(entityId, config) {
  const { nameResolution } = config;

  // Check configuration preference
  if (nameResolution.usePronounsWhenAvailable) {
    // Resolve gender from entity components
    const entity = this.#entityManager.getEntityInstance(entityId);
    const genderComponent = entity?.getComponentData('core:gender');

    if (genderComponent) {
      const pronounMap = {
        male: 'him',
        female: 'her',
        other: 'them',
        nonbinary: 'them'
      };
      return pronounMap[genderComponent.gender] || 'them';
    }
  }

  // Fallback to entity name
  return this.#resolveEntityName(entityId);
}

#resolveEntityName(entityId) {
  // Check cache first
  if (this.#entityNameCache.has(entityId)) {
    return this.#entityNameCache.get(entityId);
  }

  // Resolve from entity manager
  const entity = this.#entityManager.getEntityInstance(entityId);
  const nameComponent = entity?.getComponentData('core:name');
  const name = nameComponent?.text || entityId;

  // Cache for future use
  this.#entityNameCache.set(entityId, name);

  return name;
}
```

#### Complete Algorithm Example

**Input Components:**
```json
[
  {
    "componentId": "positioning:kneeling_before",
    "verb": "kneeling before",
    "targetEntityId": "alicia",
    "priority": 75
  },
  {
    "componentId": "intimacy:holding_hand",
    "verb": "holding hands with",
    "targetEntityId": "alicia",
    "priority": 60
  },
  {
    "componentId": "companionship:following",
    "verb": "following",
    "targetEntityId": "bob",
    "priority": 40
  }
]
```

**Processing:**
```
1. Group by target:
   alicia: [kneeling_before(75), holding_hand(60)]
   bob: [following(40)]

2. Sort within groups (already sorted by priority)

3. Construct phrases:
   Group "alicia":
     - "Jon Ureña is kneeling before Alicia Western"
     - "holding hands with her"
     → Combined: "Jon Ureña is kneeling before Alicia Western and holding hands with her"

   Group "bob":
     - "Jon Ureña is following Bob Smith"

4. Join sentences:
   "Jon Ureña is kneeling before Alicia Western and holding hands with her. Jon Ureña is following Bob Smith."
```

**Final Output:**
```
Activity: Jon Ureña is kneeling before Alicia Western and holding hands with her. Jon Ureña is following Bob Smith.
```

### Strategy 3: Priority-Based Filtering

For entities with many activities, show only the most important.

#### Priority Tiers

```javascript
// Configuration-driven priority tiers
const PRIORITY_TIERS = {
  CRITICAL: { min: 90, max: 100 },  // Always show
  HIGH: { min: 70, max: 89 },       // Show if < 5 total activities
  MEDIUM: { min: 40, max: 69 },     // Show if < 3 total activities
  LOW: { min: 0, max: 39 }          // Show only if sole activity
};

#filterByPriority(activities, config) {
  const { maxActivities = 5, respectTiers = true } = config;

  if (activities.length <= maxActivities) {
    return activities; // No filtering needed
  }

  if (respectTiers) {
    // Include all CRITICAL activities
    const critical = activities.filter(a =>
      a.priority >= PRIORITY_TIERS.CRITICAL.min
    );

    // Fill remaining slots with highest priority
    const remaining = maxActivities - critical.length;
    if (remaining > 0) {
      const others = activities
        .filter(a => a.priority < PRIORITY_TIERS.CRITICAL.min)
        .slice(0, remaining);
      return [...critical, ...others];
    }

    return critical;
  } else {
    // Simple top-N filtering
    return activities.slice(0, maxActivities);
  }
}
```

### Strategy 4: Conditional Visibility

Some activities should only appear under certain conditions.

#### Condition Evaluation Engine

```javascript
#evaluateConditions(activity, entity) {
  const conditions = activity.metadata?.conditions;
  if (!conditions) return true; // No conditions = always visible

  // Check property conditions
  if (conditions.showOnlyIfProperty) {
    const { property, equals } = conditions.showOnlyIfProperty;
    const sourceData = entity.getComponentData(activity.sourceComponent);

    if (sourceData?.[property] !== equals) {
      return false; // Condition not met
    }
  }

  // Check target component conditions
  if (conditions.hideIfTargetHasComponent) {
    const targetEntity = this.#entityManager.getEntityInstance(activity.targetEntityId);
    if (targetEntity?.hasComponent(conditions.hideIfTargetHasComponent)) {
      return false; // Hide because target has component
    }
  }

  // Check required component conditions
  if (conditions.requiredComponents) {
    for (const requiredComponent of conditions.requiredComponents) {
      if (!entity.hasComponent(requiredComponent)) {
        return false; // Missing required component
      }
    }
  }

  return true; // All conditions met
}

#filterByConditions(activities, entity) {
  return activities.filter(activity =>
    this.#evaluateConditions(activity, entity)
  );
}
```

#### Example: Conditional Kissing Description

**Scenario**: Only show "kissing" in activity if the entity initiated the kiss.

**Metadata:**
```json
{
  "kissing:kissing": {
    "partner": "alicia",
    "initiator": false  // ← Not the initiator
  },
  "activity:description_metadata": {
    "sourceComponent": "kissing:kissing",
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
}
```

**Result**: Activity description will NOT include kissing because `initiator = false`.

**If initiator was true:**
```
Activity: Jon Ureña is kissing Alicia Western.
```

---

## Implementation Roadmap

### Phase 1: Minimal Viable Implementation (Week 1-2)

**Goal**: Get basic activity descriptions working with simple concatenation.

#### Deliverables

1. **Component Schema**
   - [ ] Create `activity:description_metadata` schema
   - [ ] Define minimal inline metadata pattern
   - [ ] Add validation rules

2. **ActivityDescriptionService**
   - [ ] Implement basic service class
   - [ ] Constructor with dependency injection
   - [ ] `generateActivityDescription(entityId)` with naive iteration
   - [ ] Simple string concatenation (no NLP yet)
   - [ ] Error handling and logging

3. **Integration**
   - [ ] Add `'activity'` to `DescriptionConfiguration` order
   - [ ] Inject service into `BodyDescriptionComposer`
   - [ ] Add service call in description loop
   - [ ] Add `getActivityIntegrationConfig()` to `AnatomyFormattingService`

4. **DI Registration**
   - [ ] Register service in `worldAndEntityRegistrations.js`
   - [ ] Update composer registration with dependency

5. **Basic Testing**
   - [ ] Unit tests: no activities, single activity, multiple activities
   - [ ] Integration test: full pipeline through composer
   - [ ] Null safety tests

**Example Output (Phase 1):**
```
Activity: Jon Ureña is kneeling before Alicia Western, holding hands with Alicia Western
```
_Note: Repetitive, but functional._

### Phase 2: Natural Language Composition (Week 3-4)

**Goal**: Implement smart sentence construction and pronoun usage.

#### Deliverables

1. **NLP Engine**
   - [ ] Implement activity grouping by target
   - [ ] Implement phrase construction algorithm
   - [ ] Implement conjunction joining logic
   - [ ] Add pronoun resolution (basic)

2. **Priority System**
   - [ ] Implement priority-based sorting
   - [ ] Add priority filtering configuration
   - [ ] Support tier-based filtering

3. **Configuration Enhancement**
   - [ ] Add `nameResolution` config options
   - [ ] Add `maxActivities` limits
   - [ ] Add `usePronounsWhenAvailable` flag

4. **Enhanced Testing**
   - [ ] Test multi-target scenarios
   - [ ] Test priority ordering
   - [ ] Test pronoun resolution
   - [ ] Test configuration override

**Example Output (Phase 2):**
```
Activity: Jon Ureña is kneeling before Alicia Western and holding hands with her.
```
_Note: Grammatically improved with pronoun usage._

### Phase 3: Advanced Features (Week 5-6)

**Goal**: Add conditional visibility, metadata richness, and performance optimization.

#### Deliverables

1. **Conditional Logic**
   - [ ] Implement condition evaluation engine
   - [ ] Support `showOnlyIfProperty` conditions
   - [ ] Support `hideIfTargetHasComponent` conditions
   - [ ] Support `requiredComponents` conditions

2. **Rich Metadata Support**
   - [ ] Implement dedicated metadata component processing
   - [ ] Add template variable substitution (${source.property})
   - [ ] Add grouping and combining logic
   - [ ] Support adverb modifiers

3. **Performance Optimization**
   - [ ] Implement component index
   - [ ] Add event-driven index updates
   - [ ] Add description caching with invalidation
   - [ ] Benchmark and optimize hot paths

4. **Advanced Testing**
   - [ ] Test conditional visibility
   - [ ] Test template substitution
   - [ ] Test grouping combinations
   - [ ] Performance benchmarks

**Example Output (Phase 3):**
```
Activity: Jon Ureña is kissing Alicia Western passionately and holding her close.
```
_Note: Rich metadata with adverbs and grouping._

### Phase 4: Polish and Edge Cases (Week 7-8)

**Goal**: Handle edge cases, improve robustness, and complete documentation.

#### Deliverables

1. **Edge Case Handling**
   - [ ] Handle circular references (A following B following A)
   - [ ] Handle missing target entities gracefully
   - [ ] Handle malformed metadata
   - [ ] Handle very long activity lists (>10 activities)

2. **Documentation**
   - [ ] Complete JSDoc for all public methods
   - [ ] Write integration guide for mod developers
   - [ ] Create example mod showcasing activity descriptions
   - [ ] Update BODCLODES with activity architecture

3. **Quality Assurance**
   - [ ] Code review and refactoring
   - [ ] Performance profiling
   - [ ] Memory leak testing
   - [ ] Cross-browser testing

4. **Migration Support**
   - [ ] Create migration guide for existing mods
   - [ ] Build automated migration scripts (if needed)
   - [ ] Provide metadata templates

---

## Technical Specifications

### ActivityDescriptionService Architecture

```javascript
/**
 * Service for generating activity descriptions based on component metadata.
 *
 * Follows the Equipment service pattern from BODCLODES.
 * Integrates into BodyDescriptionComposer as an optional extension point.
 *
 * @see src/clothing/services/equipmentDescriptionService.js
 * @see reports/BODCLODES-body-description-composition-architecture.md
 */
class ActivityDescriptionService {
  #logger;
  #entityManager;
  #anatomyFormattingService;
  #entityNameCache = new Map();
  #activityIndex = null; // Optional, for Phase 3

  /**
   * @param {object} dependencies
   * @param {object} dependencies.logger - Logger service
   * @param {object} dependencies.entityManager - Entity manager for component access
   * @param {object} dependencies.anatomyFormattingService - Configuration service
   * @param {object} [dependencies.activityIndex] - Optional index for performance
   */
  constructor({ logger, entityManager, anatomyFormattingService, activityIndex = null }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityInstance']
    });
    validateDependency(anatomyFormattingService, 'AnatomyFormattingService', logger);

    this.#logger = ensureValidLogger(logger, 'ActivityDescriptionService');
    this.#entityManager = entityManager;
    this.#anatomyFormattingService = anatomyFormattingService;
    this.#activityIndex = activityIndex;
  }

  /**
   * Generate activity description for an entity.
   *
   * @param {string} entityId - Entity ID to generate activity description for
   * @returns {Promise<string>} Formatted activity description (empty string if no activities)
   *
   * @example
   * const description = await service.generateActivityDescription('character_1');
   * // Returns: "Activity: Jon Ureña is kneeling before Alicia Western and holding hands with her."
   */
  async generateActivityDescription(entityId) {
    try {
      this.#logger.debug(`Generating activity description for entity: ${entityId}`);

      // Phase 1: Collect activity metadata
      const activities = this.#collectActivityMetadata(entityId);

      if (activities.length === 0) {
        this.#logger.debug(`No activities found for entity: ${entityId}`);
        return '';
      }

      this.#logger.debug(`Found ${activities.length} activities for entity: ${entityId}`);

      // Phase 2: Filter by conditions (if supported)
      const entity = this.#entityManager.getEntityInstance(entityId);
      const visibleActivities = this.#filterByConditions(activities, entity);

      if (visibleActivities.length === 0) {
        this.#logger.debug(`All activities filtered out by conditions for entity: ${entityId}`);
        return '';
      }

      // Phase 3: Sort by priority
      const sortedActivities = this.#sortByPriority(visibleActivities);

      // Phase 4: Generate formatted description
      const description = this.#formatActivityDescription(sortedActivities, entity);

      this.#logger.debug(`Generated activity description: "${description}"`);
      return description;

    } catch (error) {
      this.#logger.error(
        `Failed to generate activity description for entity ${entityId}`,
        error
      );
      return ''; // Fail gracefully
    }
  }

  /**
   * Collect all activity metadata from entity components.
   * Supports both inline metadata and dedicated metadata components.
   *
   * @param {string} entityId - Entity ID
   * @returns {Array<object>} Activity metadata objects
   * @private
   */
  #collectActivityMetadata(entityId) {
    const activities = [];
    const entity = this.#entityManager.getEntityInstance(entityId);

    if (!entity) {
      this.#logger.warn(`Entity not found: ${entityId}`);
      return activities;
    }

    // Strategy 1: Check for dedicated metadata components (Approach 2)
    const dedicatedMetadata = this.#collectDedicatedMetadata(entity);
    activities.push(...dedicatedMetadata);

    // Strategy 2: Scan for inline metadata (Approach 1)
    const inlineMetadata = this.#collectInlineMetadata(entity);
    activities.push(...inlineMetadata);

    return activities;
  }

  /**
   * Collect dedicated metadata components.
   *
   * @param {object} entity - Entity instance
   * @returns {Array<object>} Dedicated metadata activities
   * @private
   */
  #collectDedicatedMetadata(entity) {
    const activities = [];

    // Check if entity has dedicated metadata component type
    if (!entity.hasComponent('activity:description_metadata')) {
      return activities;
    }

    // Get all metadata components (there could be multiple)
    const metadataComponents = entity.getAllComponentsOfType?.('activity:description_metadata') || [];

    for (const metadata of metadataComponents) {
      try {
        const activity = this.#parseDedicatedMetadata(metadata, entity);
        if (activity) {
          activities.push(activity);
        }
      } catch (error) {
        this.#logger.error(`Failed to parse dedicated metadata`, error);
      }
    }

    return activities;
  }

  /**
   * Parse dedicated metadata component into activity object.
   *
   * @param {object} metadata - Metadata component data
   * @param {object} entity - Entity instance
   * @returns {object|null} Activity object or null if invalid
   * @private
   */
  #parseDedicatedMetadata(metadata, entity) {
    const { sourceComponent, descriptionType, targetRole, priority = 50 } = metadata;

    if (!sourceComponent) {
      this.#logger.warn('Dedicated metadata missing sourceComponent');
      return null;
    }

    // Get source component data
    const sourceData = entity.getComponentData(sourceComponent);
    if (!sourceData) {
      this.#logger.warn(`Source component not found: ${sourceComponent}`);
      return null;
    }

    // Resolve target entity ID
    const targetEntityId = sourceData[targetRole || 'entityId'];

    return {
      type: 'dedicated',
      sourceComponent,
      descriptionType,
      metadata,
      sourceData,
      targetEntityId,
      priority,
      verb: metadata.verb,
      template: metadata.template,
      adverb: metadata.adverb,
      conditions: metadata.conditions,
      grouping: metadata.grouping
    };
  }

  /**
   * Collect inline metadata from components.
   *
   * @param {object} entity - Entity instance
   * @returns {Array<object>} Inline metadata activities
   * @private
   */
  #collectInlineMetadata(entity) {
    const activities = [];
    const componentIds = entity.getComponentIds?.() || [];

    for (const componentId of componentIds) {
      // Skip dedicated metadata components (already processed)
      if (componentId === 'activity:description_metadata') {
        continue;
      }

      const componentData = entity.getComponentData(componentId);
      const activityMetadata = componentData?.activityMetadata;

      if (activityMetadata?.shouldDescribeInActivity) {
        try {
          const activity = this.#parseInlineMetadata(
            componentId,
            componentData,
            activityMetadata
          );
          if (activity) {
            activities.push(activity);
          }
        } catch (error) {
          this.#logger.error(
            `Failed to parse inline metadata for ${componentId}`,
            error
          );
        }
      }
    }

    return activities;
  }

  /**
   * Parse inline metadata into activity object.
   *
   * @param {string} componentId - Component ID
   * @param {object} componentData - Full component data
   * @param {object} activityMetadata - Activity metadata from component
   * @returns {object|null} Activity object or null if invalid
   * @private
   */
  #parseInlineMetadata(componentId, componentData, activityMetadata) {
    const { template, targetRole = 'entityId', priority = 50 } = activityMetadata;

    if (!template) {
      this.#logger.warn(`Inline metadata missing template for ${componentId}`);
      return null;
    }

    // Resolve target entity ID
    const targetEntityId = componentData[targetRole];

    return {
      type: 'inline',
      sourceComponent: componentId,
      sourceData: componentData,
      targetEntityId,
      priority,
      template
    };
  }

  /**
   * Filter activities by conditional visibility rules.
   *
   * @param {Array<object>} activities - Activity objects
   * @param {object} entity - Entity instance
   * @returns {Array<object>} Filtered activities
   * @private
   */
  #filterByConditions(activities, entity) {
    return activities.filter(activity => {
      if (!activity.conditions) return true; // No conditions = always visible

      // Evaluate conditions (Phase 3 implementation)
      return this.#evaluateConditions(activity, entity);
    });
  }

  /**
   * Evaluate conditional visibility for an activity.
   *
   * @param {object} activity - Activity object
   * @param {object} entity - Entity instance
   * @returns {boolean} True if activity should be visible
   * @private
   */
  #evaluateConditions(activity, entity) {
    const conditions = activity.conditions;

    // Check property condition
    if (conditions.showOnlyIfProperty) {
      const { property, equals } = conditions.showOnlyIfProperty;
      const actualValue = activity.sourceData[property];

      if (actualValue !== equals) {
        this.#logger.debug(
          `Activity filtered: ${property}=${actualValue}, expected ${equals}`
        );
        return false;
      }
    }

    // Check target component condition
    if (conditions.hideIfTargetHasComponent && activity.targetEntityId) {
      const targetEntity = this.#entityManager.getEntityInstance(activity.targetEntityId);
      if (targetEntity?.hasComponent(conditions.hideIfTargetHasComponent)) {
        this.#logger.debug(
          `Activity filtered: target has ${conditions.hideIfTargetHasComponent}`
        );
        return false;
      }
    }

    // Check required components
    if (conditions.requiredComponents) {
      for (const requiredComponent of conditions.requiredComponents) {
        if (!entity.hasComponent(requiredComponent)) {
          this.#logger.debug(
            `Activity filtered: missing required component ${requiredComponent}`
          );
          return false;
        }
      }
    }

    return true; // All conditions passed
  }

  /**
   * Sort activities by priority (descending).
   *
   * @param {Array<object>} activities - Activity objects
   * @returns {Array<object>} Sorted activities
   * @private
   */
  #sortByPriority(activities) {
    return activities.sort((a, b) => (b.priority || 50) - (a.priority || 50));
  }

  /**
   * Format activities into natural language description.
   *
   * Phase 1: Simple concatenation
   * Phase 2: Smart composition with grouping
   *
   * @param {Array<object>} activities - Sorted activity objects
   * @param {object} entity - Entity instance
   * @returns {string} Formatted description
   * @private
   */
  #formatActivityDescription(activities, entity) {
    const config = this.#anatomyFormattingService.getActivityIntegrationConfig();

    // Get actor name
    const actorName = this.#resolveEntityName(entity.id);

    // Phase 1 implementation: Simple concatenation
    // Phase 2 will implement: Smart composition with grouping
    const descriptions = activities.map(activity =>
      this.#generateActivityPhrase(actorName, activity)
    );

    if (descriptions.length === 0) {
      return '';
    }

    // Format with configuration
    const prefix = config.prefix || 'Activity: ';
    const suffix = config.suffix || '';
    const separator = config.separator || '. ';

    const activityText = descriptions.join(separator);
    return `${prefix}${activityText}${suffix}`;
  }

  /**
   * Generate a single activity phrase.
   *
   * @param {string} actorName - Name of the entity performing the activity
   * @param {object} activity - Activity object
   * @returns {string} Activity phrase
   * @private
   */
  #generateActivityPhrase(actorName, activity) {
    const targetName = activity.targetEntityId
      ? this.#resolveEntityName(activity.targetEntityId)
      : '';

    if (activity.type === 'inline') {
      // Use template
      return activity.template
        .replace('{actor}', actorName)
        .replace('{target}', targetName);
    } else {
      // Dedicated metadata: construct from verb/adverb
      const verb = activity.verb || 'interacting with';
      const adverb = activity.adverb ? ` ${activity.adverb}` : '';

      if (targetName) {
        return `${actorName} is ${verb} ${targetName}${adverb}`;
      } else {
        return `${actorName} is ${verb}${adverb}`;
      }
    }
  }

  /**
   * Resolve entity name from ID with caching.
   *
   * @param {string} entityId - Entity ID
   * @returns {string} Entity name or ID if not found
   * @private
   */
  #resolveEntityName(entityId) {
    // Check cache
    if (this.#entityNameCache.has(entityId)) {
      return this.#entityNameCache.get(entityId);
    }

    // Resolve from entity manager
    const entity = this.#entityManager.getEntityInstance(entityId);
    const nameComponent = entity?.getComponentData('core:name');
    const name = nameComponent?.text || entityId;

    // Cache for future use
    this.#entityNameCache.set(entityId, name);

    return name;
  }
}

export default ActivityDescriptionService;
```

### Integration into BodyDescriptionComposer

```javascript
// In src/anatomy/bodyDescriptionComposer.js

// Constructor update
constructor({
  bodyPartDescriptionBuilder,
  bodyGraphService,
  entityFinder,
  anatomyFormattingService,
  partDescriptionGenerator,
  equipmentDescriptionService = null,
  activityDescriptionService = null, // ← NEW
  logger = null,
}) {
  // ... existing validation

  this.equipmentDescriptionService = equipmentDescriptionService;
  this.activityDescriptionService = activityDescriptionService; // ← STORE

  this.#logger = ensureValidLogger(logger, 'BodyDescriptionComposer');

  // ... rest of constructor
}

// In composeDescription method
async composeDescription(bodyEntity) {
  // ... existing body descriptor and part processing

  for (const partType of descriptionOrder) {
    // ... handle body descriptors

    // Handle equipment descriptions
    if (partType === 'equipment' && this.equipmentDescriptionService) {
      const equipmentDescription =
        await this.equipmentDescriptionService.generateEquipmentDescription(
          bodyEntity.id
        );
      if (equipmentDescription) {
        lines.push(equipmentDescription);
      }
      processedTypes.add(partType);
      continue;
    }

    // Handle activity descriptions ← NEW
    if (partType === 'activity' && this.activityDescriptionService) {
      const activityDescription =
        await this.activityDescriptionService.generateActivityDescription(
          bodyEntity.id
        );
      if (activityDescription) {
        lines.push(activityDescription);
      }
      processedTypes.add(partType);
      continue;
    }

    // ... handle body parts
  }

  return lines.join('\n');
}
```

### Configuration Service Extension

```javascript
// In src/services/anatomyFormattingService.js

/**
 * Get activity integration configuration.
 *
 * @returns {object} Activity configuration
 */
getActivityIntegrationConfig() {
  return {
    prefix: 'Activity: ',
    suffix: '',
    separator: '. ',
    nameResolution: {
      usePronounsWhenAvailable: false, // Phase 2 feature
      fallbackToNames: true
    },
    maxActivities: 10, // Phase 2 feature
    respectPriorityTiers: true // Phase 3 feature
  };
}
```

### DI Container Registration

```javascript
// In src/dependencyInjection/registrations/worldAndEntityRegistrations.js

// Register ActivityDescriptionService
container.register(
  'ActivityDescriptionService',
  ActivityDescriptionService,
  {
    logger: tokens.ILogger,
    entityManager: tokens.IEntityManager,
    anatomyFormattingService: 'AnatomyFormattingService',
    // activityIndex will be added in Phase 3
  }
);

// Update BodyDescriptionComposer registration
container.register(
  'BodyDescriptionComposer',
  BodyDescriptionComposer,
  {
    bodyPartDescriptionBuilder: 'BodyPartDescriptionBuilder',
    bodyGraphService: 'BodyGraphService',
    entityFinder: tokens.IEntityFinder,
    anatomyFormattingService: 'AnatomyFormattingService',
    partDescriptionGenerator: 'PartDescriptionGenerator',
    equipmentDescriptionService: 'EquipmentDescriptionService',
    activityDescriptionService: 'ActivityDescriptionService', // ← ADD
    logger: tokens.ILogger,
  }
);
```

### Description Configuration Update

```javascript
// In src/anatomy/configuration/descriptionConfiguration.js

this._defaultDescriptionOrder = [
  'height',
  'build',
  'body_composition',
  'body_hair',
  'skin_color',
  'hair',
  'eye',
  'face',
  // ... more parts
  'equipment',
  'activity',  // ← ADD THIS LINE
];
```

---

## Example Component Metadata

### Example 1: Following (Simple Inline)

**Component Schema**: `companionship:following.component.json`
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "companionship:following",
  "description": "Marks an entity as following another",
  "dataSchema": {
    "type": "object",
    "required": ["leaderId"],
    "properties": {
      "leaderId": {
        "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
      },
      "activityMetadata": {
        "type": "object",
        "properties": {
          "shouldDescribeInActivity": { "type": "boolean", "default": true },
          "template": { "type": "string", "default": "{actor} is following {target}" },
          "targetRole": { "type": "string", "default": "leaderId" },
          "priority": { "type": "integer", "default": 40 }
        }
      }
    }
  }
}
```

**Entity Data**:
```json
{
  "companionship:following": {
    "leaderId": "character_2",
    "activityMetadata": {
      "shouldDescribeInActivity": true,
      "template": "{actor} is following {target}",
      "targetRole": "leaderId",
      "priority": 40
    }
  }
}
```

**Generated Output**:
```
Activity: Jon Ureña is following Alicia Western.
```

### Example 2: Kissing (Dedicated with Conditions)

**Component Schema**: `kissing:kissing.component.json` (unchanged)
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "kissing:kissing",
  "description": "Tracks an active kissing interaction",
  "dataSchema": {
    "type": "object",
    "required": ["partner", "initiator"],
    "properties": {
      "partner": {
        "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
      },
      "initiator": { "type": "boolean" }
    }
  }
}
```

**Entity Data**:
```json
{
  "kissing:kissing": {
    "partner": "character_2",
    "initiator": true
  },
  "activity:description_metadata": {
    "sourceComponent": "kissing:kissing",
    "descriptionType": "verb",
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
}
```

**Generated Output (initiator=true)**:
```
Activity: Jon Ureña is kissing Alicia Western.
```

**Generated Output (initiator=false)**:
```
(No output - filtered by condition)
```

### Example 3: Kneeling Before (Simple Inline)

**Component Schema**: `positioning:kneeling_before.component.json`
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:kneeling_before",
  "description": "Tracks which entity the component holder is kneeling before",
  "dataSchema": {
    "type": "object",
    "required": ["entityId"],
    "properties": {
      "entityId": { "type": "string" },
      "activityMetadata": {
        "type": "object",
        "properties": {
          "shouldDescribeInActivity": { "type": "boolean", "default": true },
          "template": { "type": "string", "default": "{actor} is kneeling before {target}" },
          "targetRole": { "type": "string", "default": "entityId" },
          "priority": { "type": "integer", "default": 75 }
        }
      }
    }
  }
}
```

**Entity Data**:
```json
{
  "positioning:kneeling_before": {
    "entityId": "character_2",
    "activityMetadata": {
      "shouldDescribeInActivity": true,
      "template": "{actor} is kneeling before {target}",
      "targetRole": "entityId",
      "priority": 75
    }
  }
}
```

**Generated Output**:
```
Activity: Jon Ureña is kneeling before Alicia Western.
```

### Example 4: Hugging (Dedicated with Adverb)

**Component Schema**: `positioning:hugging.component.json` (unchanged)
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:hugging",
  "description": "Marks an actor actively embracing another entity",
  "dataSchema": {
    "type": "object",
    "required": ["embraced_entity_id", "initiated"],
    "properties": {
      "embraced_entity_id": { "type": "string" },
      "initiated": { "type": "boolean" },
      "consented": { "type": "boolean", "default": true }
    }
  }
}
```

**Entity Data**:
```json
{
  "positioning:hugging": {
    "embraced_entity_id": "character_2",
    "initiated": true,
    "consented": true
  },
  "activity:description_metadata": {
    "sourceComponent": "positioning:hugging",
    "descriptionType": "verb",
    "verb": "hugging",
    "adverb": "tightly",
    "targetRole": "embraced_entity_id",
    "priority": 85
  }
}
```

**Generated Output**:
```
Activity: Jon Ureña is hugging Alicia Western tightly.
```

### Example 5: Multiple Activities (Phase 2 Smart Composition)

**Entity Data**:
```json
{
  "positioning:kneeling_before": {
    "entityId": "character_2",
    "activityMetadata": {
      "shouldDescribeInActivity": true,
      "template": "{actor} is kneeling before {target}",
      "targetRole": "entityId",
      "priority": 75
    }
  },
  "intimacy:holding_hand": {
    "partner": "character_2",
    "activityMetadata": {
      "shouldDescribeInActivity": true,
      "template": "{actor} is holding hands with {target}",
      "targetRole": "partner",
      "priority": 60
    }
  }
}
```

**Phase 1 Output (Simple Concatenation)**:
```
Activity: Jon Ureña is kneeling before Alicia Western. Jon Ureña is holding hands with Alicia Western.
```

**Phase 2 Output (Smart Composition)**:
```
Activity: Jon Ureña is kneeling before Alicia Western and holding hands with her.
```

### Example 6: Multi-Target Scenario

**Entity Data**:
```json
{
  "positioning:kneeling_before": {
    "entityId": "alicia",
    "activityMetadata": {
      "shouldDescribeInActivity": true,
      "template": "{actor} is kneeling before {target}",
      "targetRole": "entityId",
      "priority": 75
    }
  },
  "intimacy:holding_hand": {
    "partner": "alicia",
    "activityMetadata": {
      "shouldDescribeInActivity": true,
      "template": "{actor} is holding hands with {target}",
      "targetRole": "partner",
      "priority": 60
    }
  },
  "companionship:following": {
    "leaderId": "bob",
    "activityMetadata": {
      "shouldDescribeInActivity": true,
      "template": "{actor} is following {target}",
      "targetRole": "leaderId",
      "priority": 40
    }
  }
}
```

**Phase 2 Output (Smart Grouping)**:
```
Activity: Jon Ureña is kneeling before Alicia Western and holding hands with her. Jon Ureña is following Bob Smith.
```

---

## Natural Language Examples

### Single Activity Scenarios

**Kneeling:**
```
Activity: Jon Ureña is kneeling before Alicia Western.
```

**Following:**
```
Activity: Alicia Western is following Jon Ureña.
```

**Kissing (as initiator):**
```
Activity: Jon Ureña is kissing Alicia Western.
```

**Hugging:**
```
Activity: Jon Ureña is hugging Alicia Western tightly.
```

**Holding Hands:**
```
Activity: Jon Ureña is holding hands with Alicia Western.
```

### Multiple Activity Scenarios (Same Target)

**Phase 1 (Simple Concatenation):**
```
Activity: Jon Ureña is kneeling before Alicia Western. Jon Ureña is holding hands with Alicia Western.
```

**Phase 2 (Smart Composition):**
```
Activity: Jon Ureña is kneeling before Alicia Western and holding hands with her.
```

**Three Activities (Same Target):**
```
Activity: Jon Ureña is kneeling before Alicia Western, holding hands with her, and gazing into her eyes.
```

### Multiple Activity Scenarios (Different Targets)

**Two Targets:**
```
Activity: Jon Ureña is kneeling before Alicia Western and holding hands with her. Jon Ureña is following Bob Smith.
```

**Three Targets:**
```
Activity: Jon Ureña is kneeling before Alicia Western. Jon Ureña is following Bob Smith. Jon Ureña is waving at Charlie Brown.
```

### Complex Scenarios (Phase 3)

**Conditional Visibility (Kissing):**
```json
// Initiator
Activity: Jon Ureña is kissing Alicia Western passionately.

// Not initiator (filtered out)
Activity: Jon Ureña is holding hands with Alicia Western.
```

**Priority-Based Filtering (Many Activities):**
```json
// All activities (10):
// - kissing (priority 95)
// - kneeling before (priority 75)
// - holding hands (priority 60)
// - following (priority 40)
// - waving (priority 20)
// - [5 more low-priority activities]

// With maxActivities=3:
Activity: Jon Ureña is kissing Alicia Western, kneeling before her, and holding hands with her.
```

**Adverb Modifiers:**
```
Activity: Jon Ureña is kissing Alicia Western passionately and holding her close.
```

**Pronoun Resolution:**
```
Activity: Jon Ureña is kneeling before Alicia Western and gazing into her eyes.
```

### Edge Case Examples

**No Activities:**
```
(No Activity line in description)
```

**Single Activity (No Target):**
```
Activity: Jon Ureña is meditating.
```

**Circular Reference (A following B, B following A):**
```
// Detect and handle gracefully
Activity: Jon Ureña is following Alicia Western.
Activity: Alicia Western is following Jon Ureña.
```

**Missing Target Entity:**
```
// Fallback to entity ID if name not found
Activity: Jon Ureña is following unknown_entity_123.
```

---

## Testing Strategy

### Unit Tests

#### ActivityDescriptionService Tests

**File**: `tests/unit/anatomy/services/activityDescriptionService.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import ActivityDescriptionService from '../../../../src/anatomy/services/activityDescriptionService.js';

describe('ActivityDescriptionService', () => {
  let testBed;
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockFormattingService;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEntityManager = testBed.createMock('entityManager', [
      'getEntityInstance'
    ]);
    mockFormattingService = testBed.createMock('formattingService', [
      'getActivityIntegrationConfig'
    ]);

    // Default config
    mockFormattingService.getActivityIntegrationConfig.mockReturnValue({
      prefix: 'Activity: ',
      suffix: '',
      separator: '. '
    });

    service = new ActivityDescriptionService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      anatomyFormattingService: mockFormattingService
    });
  });

  describe('generateActivityDescription', () => {
    it('should return empty string when entity has no activities', async () => {
      const mockEntity = testBed.createMock('entity', [
        'getComponentIds',
        'getComponentData',
        'hasComponent'
      ]);
      mockEntity.id = 'entity_1';
      mockEntity.getComponentIds.mockReturnValue([]);
      mockEntity.hasComponent.mockReturnValue(false);
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('');
    });

    it('should format single inline activity', async () => {
      const mockEntity = testBed.createMock('entity', [
        'getComponentIds',
        'getComponentData',
        'hasComponent'
      ]);
      mockEntity.id = 'jon';
      mockEntity.getComponentIds.mockReturnValue(['positioning:kneeling_before']);
      mockEntity.hasComponent.mockReturnValue(false); // No dedicated metadata
      mockEntity.getComponentData.mockImplementation((id) => {
        if (id === 'positioning:kneeling_before') {
          return {
            entityId: 'alicia',
            activityMetadata: {
              shouldDescribeInActivity: true,
              template: '{actor} is kneeling before {target}',
              targetRole: 'entityId',
              priority: 75
            }
          };
        }
        if (id === 'core:name') {
          return { text: 'Jon Ureña' };
        }
        return null;
      });

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'jon') return mockEntity;
        if (id === 'alicia') {
          const alicia = testBed.createMock('entity', ['getComponentData']);
          alicia.getComponentData.mockReturnValue({ text: 'Alicia Western' });
          return alicia;
        }
        return null;
      });

      const result = await service.generateActivityDescription('jon');

      expect(result).toBe('Activity: Jon Ureña is kneeling before Alicia Western');
    });

    it('should format multiple activities (simple concatenation)', async () => {
      const mockEntity = testBed.createMock('entity', [
        'getComponentIds',
        'getComponentData',
        'hasComponent'
      ]);
      mockEntity.id = 'jon';
      mockEntity.getComponentIds.mockReturnValue([
        'positioning:kneeling_before',
        'intimacy:holding_hand'
      ]);
      mockEntity.hasComponent.mockReturnValue(false);
      mockEntity.getComponentData.mockImplementation((id) => {
        if (id === 'positioning:kneeling_before') {
          return {
            entityId: 'alicia',
            activityMetadata: {
              shouldDescribeInActivity: true,
              template: '{actor} is kneeling before {target}',
              targetRole: 'entityId',
              priority: 75
            }
          };
        }
        if (id === 'intimacy:holding_hand') {
          return {
            partner: 'alicia',
            activityMetadata: {
              shouldDescribeInActivity: true,
              template: '{actor} is holding hands with {target}',
              targetRole: 'partner',
              priority: 60
            }
          };
        }
        if (id === 'core:name') {
          return { text: 'Jon Ureña' };
        }
        return null;
      });

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'jon') return mockEntity;
        if (id === 'alicia') {
          const alicia = testBed.createMock('entity', ['getComponentData']);
          alicia.getComponentData.mockReturnValue({ text: 'Alicia Western' });
          return alicia;
        }
        return null;
      });

      const result = await service.generateActivityDescription('jon');

      // Phase 1: Simple concatenation
      expect(result).toBe(
        'Activity: Jon Ureña is kneeling before Alicia Western. ' +
        'Jon Ureña is holding hands with Alicia Western'
      );
    });

    it('should handle entity name resolution', async () => {
      const mockEntity = testBed.createMock('entity', [
        'getComponentIds',
        'getComponentData',
        'hasComponent'
      ]);
      mockEntity.id = 'jon';
      mockEntity.getComponentIds.mockReturnValue(['companionship:following']);
      mockEntity.hasComponent.mockReturnValue(false);
      mockEntity.getComponentData.mockImplementation((id) => {
        if (id === 'companionship:following') {
          return {
            leaderId: 'unknown_entity',
            activityMetadata: {
              shouldDescribeInActivity: true,
              template: '{actor} is following {target}',
              targetRole: 'leaderId',
              priority: 40
            }
          };
        }
        if (id === 'core:name') {
          return { text: 'Jon Ureña' };
        }
        return null;
      });

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'jon') return mockEntity;
        if (id === 'unknown_entity') return null; // Entity not found
        return null;
      });

      const result = await service.generateActivityDescription('jon');

      // Fallback to entity ID when name not found
      expect(result).toBe('Activity: Jon Ureña is following unknown_entity');
    });

    it('should respect priority ordering', async () => {
      const mockEntity = testBed.createMock('entity', [
        'getComponentIds',
        'getComponentData',
        'hasComponent'
      ]);
      mockEntity.id = 'jon';
      mockEntity.getComponentIds.mockReturnValue([
        'low_priority_activity',
        'high_priority_activity'
      ]);
      mockEntity.hasComponent.mockReturnValue(false);
      mockEntity.getComponentData.mockImplementation((id) => {
        if (id === 'low_priority_activity') {
          return {
            entityId: 'target',
            activityMetadata: {
              shouldDescribeInActivity: true,
              template: '{actor} is waving at {target}',
              targetRole: 'entityId',
              priority: 20
            }
          };
        }
        if (id === 'high_priority_activity') {
          return {
            entityId: 'target',
            activityMetadata: {
              shouldDescribeInActivity: true,
              template: '{actor} is kissing {target}',
              targetRole: 'entityId',
              priority: 90
            }
          };
        }
        if (id === 'core:name') {
          return { text: 'Jon' };
        }
        return null;
      });

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'jon') return mockEntity;
        if (id === 'target') {
          const target = testBed.createMock('entity', ['getComponentData']);
          target.getComponentData.mockReturnValue({ text: 'Target' });
          return target;
        }
        return null;
      });

      const result = await service.generateActivityDescription('jon');

      // High priority activity should come first
      expect(result).toMatch(/^Activity: Jon is kissing Target/);
    });

    it('should handle errors gracefully', async () => {
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe(''); // Fail gracefully
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('conditional visibility (Phase 3)', () => {
    it('should filter activities by showOnlyIfProperty condition', async () => {
      const mockEntity = testBed.createMock('entity', [
        'getComponentIds',
        'getComponentData',
        'hasComponent',
        'getAllComponentsOfType'
      ]);
      mockEntity.id = 'jon';
      mockEntity.hasComponent.mockImplementation((id) =>
        id === 'activity:description_metadata'
      );
      mockEntity.getAllComponentsOfType.mockReturnValue([
        {
          sourceComponent: 'kissing:kissing',
          descriptionType: 'verb',
          verb: 'kissing',
          targetRole: 'partner',
          priority: 90,
          conditions: {
            showOnlyIfProperty: {
              property: 'initiator',
              equals: true
            }
          }
        }
      ]);
      mockEntity.getComponentData.mockImplementation((id) => {
        if (id === 'kissing:kissing') {
          return {
            partner: 'alicia',
            initiator: false // Not initiator
          };
        }
        if (id === 'core:name') {
          return { text: 'Jon Ureña' };
        }
        return null;
      });

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = await service.generateActivityDescription('jon');

      // Should be filtered out because initiator=false
      expect(result).toBe('');
    });
  });
});
```

### Integration Tests

#### Activity Description Pipeline Test

**File**: `tests/integration/anatomy/activityDescription.integration.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Activity Description Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should include activity in full body description', async () => {
    // Create entity with body and activity
    const entity = testBed.createEntity({
      id: 'jon',
      name: 'Jon Ureña',
      components: {
        'anatomy:body': { /* body data */ },
        'positioning:kneeling_before': {
          entityId: 'alicia',
          activityMetadata: {
            shouldDescribeInActivity: true,
            template: '{actor} is kneeling before {target}',
            targetRole: 'entityId',
            priority: 75
          }
        }
      }
    });

    // Create target entity
    testBed.createEntity({
      id: 'alicia',
      name: 'Alicia Western'
    });

    // Generate full description
    const orchestrator = testBed.getService('BodyDescriptionOrchestrator');
    const { bodyDescription } = await orchestrator.generateAllDescriptions(entity);

    // Should include activity line
    expect(bodyDescription).toContain('Activity: Jon Ureña is kneeling before Alicia Western');
  });

  it('should handle multiple simultaneous activities', async () => {
    const entity = testBed.createEntity({
      id: 'jon',
      name: 'Jon Ureña',
      components: {
        'anatomy:body': { /* body data */ },
        'positioning:kneeling_before': {
          entityId: 'alicia',
          activityMetadata: {
            shouldDescribeInActivity: true,
            template: '{actor} is kneeling before {target}',
            targetRole: 'entityId',
            priority: 75
          }
        },
        'intimacy:holding_hand': {
          partner: 'alicia',
          activityMetadata: {
            shouldDescribeInActivity: true,
            template: '{actor} is holding hands with {target}',
            targetRole: 'partner',
            priority: 60
          }
        }
      }
    });

    testBed.createEntity({
      id: 'alicia',
      name: 'Alicia Western'
    });

    const orchestrator = testBed.getService('BodyDescriptionOrchestrator');
    const { bodyDescription } = await orchestrator.generateAllDescriptions(entity);

    // Should include both activities
    expect(bodyDescription).toContain('kneeling before Alicia Western');
    expect(bodyDescription).toContain('holding hands with');
  });

  it('should work without activity service (backward compatibility)', async () => {
    // Create container without ActivityDescriptionService
    const containerWithoutActivity = testBed.createContainer({
      excludeServices: ['ActivityDescriptionService']
    });

    const entity = testBed.createEntity({
      id: 'jon',
      components: {
        'anatomy:body': { /* body data */ },
        'positioning:kneeling_before': {
          entityId: 'alicia'
        }
      }
    });

    const orchestrator = containerWithoutActivity.resolve('BodyDescriptionOrchestrator');
    const { bodyDescription } = await orchestrator.generateAllDescriptions(entity);

    // Should not crash, just no Activity line
    expect(bodyDescription).not.toContain('Activity:');
  });
});
```

### Edge Case Tests

```javascript
describe('Activity Description Edge Cases', () => {
  it('should handle circular references gracefully', async () => {
    const jon = testBed.createEntity({
      id: 'jon',
      name: 'Jon',
      components: {
        'companionship:following': {
          leaderId: 'alicia',
          activityMetadata: {
            shouldDescribeInActivity: true,
            template: '{actor} is following {target}',
            targetRole: 'leaderId',
            priority: 40
          }
        }
      }
    });

    const alicia = testBed.createEntity({
      id: 'alicia',
      name: 'Alicia',
      components: {
        'companionship:following': {
          leaderId: 'jon',
          activityMetadata: {
            shouldDescribeInActivity: true,
            template: '{actor} is following {target}',
            targetRole: 'leaderId',
            priority: 40
          }
        }
      }
    });

    const service = testBed.getService('ActivityDescriptionService');

    const jonDescription = await service.generateActivityDescription('jon');
    const aliciaDescription = await service.generateActivityDescription('alicia');

    // Should describe each entity's activity without infinite loop
    expect(jonDescription).toBe('Activity: Jon is following Alicia');
    expect(aliciaDescription).toBe('Activity: Alicia is following Jon');
  });

  it('should handle very long activity lists', async () => {
    const activities = [];
    for (let i = 0; i < 20; i++) {
      activities.push(`activity_${i}`);
    }

    const entity = testBed.createEntity({
      id: 'jon',
      name: 'Jon',
      components: Object.fromEntries(
        activities.map((id, index) => [
          id,
          {
            entityId: 'target',
            activityMetadata: {
              shouldDescribeInActivity: true,
              template: `{actor} is doing activity ${index}`,
              priority: index
            }
          }
        ])
      )
    });

    const service = testBed.getService('ActivityDescriptionService');
    const description = await service.generateActivityDescription('jon');

    // Should not crash with many activities
    expect(description).toBeTruthy();
  });

  it('should handle malformed metadata', async () => {
    const entity = testBed.createEntity({
      id: 'jon',
      components: {
        'bad_component': {
          activityMetadata: {
            shouldDescribeInActivity: true
            // Missing required fields like template
          }
        }
      }
    });

    const service = testBed.getService('ActivityDescriptionService');
    const description = await service.generateActivityDescription('jon');

    // Should handle gracefully without crashing
    expect(description).toBe(''); // Or fallback description
  });
});
```

---

## Open Questions & Trade-offs

### 1. Performance vs. Flexibility

**Question**: Should we optimize for performance with indexing from day one, or start simple and optimize later?

**Trade-offs**:
- **Start Simple (Recommended)**:
  - ✅ Faster initial implementation
  - ✅ Easier to test and debug
  - ❌ Slower performance for entities with many components

- **Index from Day One**:
  - ✅ Better performance at scale
  - ❌ More complex initial implementation
  - ❌ Premature optimization risk

**Recommendation**: Start with naive iteration (Phase 1), add caching (Phase 2), implement full index if needed (Phase 3).

### 2. Natural Language Quality vs. Complexity

**Question**: How sophisticated should the natural language composition be?

**Trade-offs**:
- **Simple Concatenation**:
  - ✅ Easy to implement and debug
  - ✅ Predictable output
  - ❌ Robotic, repetitive phrasing

- **Smart Composition**:
  - ✅ Much better reading experience
  - ✅ More natural, less repetitive
  - ❌ More complex algorithm
  - ❌ Edge cases harder to predict

**Recommendation**: Implement both phases - start simple, add smart composition when basic functionality proven.

### 3. Inline vs. Dedicated Metadata Default

**Question**: What should be the default recommendation for mod developers?

**Trade-offs**:
- **Default to Inline**:
  - ✅ Simpler for mod developers
  - ✅ Less component proliferation
  - ❌ Harder to override descriptions

- **Default to Dedicated**:
  - ✅ More flexible and powerful
  - ✅ Easier to customize per scenario
  - ❌ More components to manage

**Recommendation**: Hybrid approach with clear decision matrix (as documented in Approach 3).

### 4. Pronoun Resolution Complexity

**Question**: How intelligent should pronoun resolution be?

**Trade-offs**:
- **Always Use Names**:
  - ✅ Always clear and unambiguous
  - ❌ Verbose and repetitive

- **Basic Pronouns (him/her/them)**:
  - ✅ More natural reading
  - ✅ Relatively simple to implement
  - ❌ Requires gender component

- **Context-Aware Pronouns (he/she/it/they + possessive)**:
  - ✅ Most natural language
  - ❌ Very complex algorithm
  - ❌ High risk of errors

**Recommendation**: Start with names (Phase 1), add basic pronouns (Phase 2), defer context-aware to Phase 4 if needed.

### 5. Caching Strategy

**Question**: What should be cached, and for how long?

**Trade-offs**:
- **No Caching**:
  - ✅ Always fresh data
  - ✅ No invalidation logic needed
  - ❌ Performance cost for repeated lookups

- **Entity Name Caching**:
  - ✅ Simple, low-risk
  - ✅ Significant performance gain
  - ❌ Must invalidate on name changes

- **Full Description Caching**:
  - ✅ Maximum performance
  - ❌ Complex invalidation (any component change)
  - ❌ Risk of stale data

**Recommendation**: Cache entity names (simple, safe), add description caching only if profiling shows need.

### 6. Visibility Condition Complexity

**Question**: How complex should conditional visibility rules be?

**Trade-offs**:
- **Simple Boolean Conditions**:
  - ✅ Easy to understand and debug
  - ✅ Sufficient for most use cases
  - ❌ Limited flexibility

- **JSON Logic Integration**:
  - ✅ Extremely flexible
  - ✅ Consistent with existing rule system
  - ❌ Overkill for simple visibility
  - ❌ Harder for mod developers to write

**Recommendation**: Start with simple conditions (Phase 3), add JSON Logic if demand emerges.

### 7. Activity Grouping and Combining

**Question**: Should activities be combined into more complex sentences?

**Example**: "kneeling before X" + "gazing at X" → "kneeling before X and gazing into her eyes"

**Trade-offs**:
- **No Combining**:
  - ✅ Simple, predictable
  - ❌ Potentially repetitive

- **Template-Based Combining**:
  - ✅ More natural output
  - ❌ Requires defining combination rules

- **AI-Powered Combining**:
  - ✅ Most natural language
  - ❌ Non-deterministic, expensive

**Recommendation**: Defer to Phase 4 or later; not critical for MVP.

### 8. Multi-Language Support

**Question**: Should the system support non-English descriptions?

**Trade-offs**:
- **English Only**:
  - ✅ Simpler implementation
  - ❌ Limits international adoption

- **I18n from Day One**:
  - ✅ Future-proof
  - ❌ Significant complexity increase

**Recommendation**: Design with i18n in mind (use templates, avoid hardcoded strings), but implement only English for MVP.

### 9. Testing Coverage vs. Speed

**Question**: How comprehensive should testing be for initial release?

**Trade-offs**:
- **Minimal Testing**:
  - ✅ Faster initial release
  - ❌ Higher risk of bugs in production

- **Comprehensive Testing (80%+ coverage)**:
  - ✅ High confidence in functionality
  - ❌ Slower initial development

**Recommendation**: Aim for 80%+ coverage as per project standards, but prioritize critical paths (happy path, error handling, edge cases).

### 10. Documentation Burden

**Question**: How much documentation is needed for mod developers?

**Trade-offs**:
- **Minimal Docs (Code Comments Only)**:
  - ✅ Less documentation burden
  - ❌ Harder for mod developers to understand

- **Comprehensive Guide**:
  - ✅ Easier mod adoption
  - ✅ Fewer support questions
  - ❌ More upfront work

**Recommendation**: Create comprehensive guide (integration guide, examples, decision matrix) as part of Phase 4.

---

## Conclusion

This brainstorming document outlines a comprehensive, mod-agnostic approach to implementing activity descriptions in the Living Narrative Engine. The system follows established architectural patterns (Equipment service), provides multiple implementation approaches (Inline, Dedicated, Hybrid), and offers a clear phased roadmap from MVP to advanced features.

### Key Design Decisions

1. **Hybrid Metadata Approach**: Use inline for simple cases, dedicated components for complex scenarios
2. **Phased Implementation**: Start simple (Phase 1), add natural language composition (Phase 2), enhance with conditionals and optimization (Phase 3+)
3. **Configuration-Driven**: All formatting rules externalized through `AnatomyFormattingService`
4. **Extension Point Pattern**: Follows exact Equipment service integration pattern for consistency
5. **Performance Conscious**: Design supports optimization through indexing and caching without requiring it upfront

### Next Steps

1. **Review and Approval**: Share with development team for feedback
2. **Refinement**: Adjust based on team input and constraints
3. **Phase 1 Kickoff**: Begin implementation of minimal viable system
4. **Iterative Enhancement**: Add features incrementally based on user needs

### Success Criteria

- ✅ Mod developers can add activity descriptions without modifying engine code
- ✅ Natural language quality improves user experience
- ✅ System performs well even with many simultaneous activities
- ✅ Architecture is maintainable and extensible
- ✅ Integration is seamless with existing body description pipeline

---

**End of Document**
