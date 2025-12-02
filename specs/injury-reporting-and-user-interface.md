# Injury Reporting and User Interface System Specification

**Version:** 1.0.0
**Status:** Design Specification
**Last Updated:** 2025-12-02
**Author:** System Architect
**Dependencies:** `anatomy` mod (v1.0.0+), damage-application-mechanics, per-part-health-system

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Goals](#2-architecture-goals)
3. [Dependencies to Implement](#3-dependencies-to-implement)
4. [Component Definitions](#4-component-definitions)
5. [Service Specifications](#5-service-specifications)
6. [Event System Integration](#6-event-system-integration)
7. [UI Components](#7-ui-components)
8. [LLM Prompt Integration](#8-llm-prompt-integration)
9. [Testing Requirements](#9-testing-requirements)
10. [Implementation Phases](#10-implementation-phases)
11. [Appendix: File Checklist](#11-appendix-file-checklist)

---

## 1. System Overview

### 1.1 Purpose

The Injury Reporting and User Interface system provides comprehensive injury visualization and narrative generation for the Living Narrative Engine. It serves three primary functions:

1. **Player Visibility**: Display current physical condition in a dedicated UI panel
2. **Narrative Feedback**: Generate atmospheric damage event messages in the chat panel
3. **AI Awareness**: Include health state in LLM prompt context for informed NPC decisions

### 1.2 Key Features

- **Injury Aggregation**: Collect all injured parts and status effects into structured summaries
- **Dual Voice Formatting**: First-person sensory (status panel) and third-person narrative (chat)
- **UI Integration**: Status panel widget and chat message components
- **LLM Context**: Health state inclusion in character XML for AI decision-making
- **Death System**: Vital organ tracking and dying/death state management
- **Damage Propagation**: Internal damage when parent parts are hit
- **DoT Effect Reporting**: Severity-based status effect display (without duration)

### 1.3 Design Philosophy

Following the engine's modding-first approach, all injury display configurations, thresholds, and narrative templates are data-driven. New injury types, status effects, or display styles can be added through JSON definitions without engine code changes.

---

## 2. Architecture Goals

### 2.1 Primary Goals

1. **Real-Time Visibility**: Players see injury status immediately after damage events
2. **Narrative Immersion**: Injuries described in atmospheric, context-appropriate language
3. **AI Awareness**: LLMs can reference character health when generating responses
4. **Extensibility**: Easy to add new injury types, effects, or formatting styles
5. **Performance**: Efficient injury aggregation even with complex anatomy graphs

### 2.2 Data Flow

```
Damage Events (anatomy:damage_applied, anatomy:part_state_changed, etc.)
    |
    v
DamagePropagationService (calculate internal damage)
    |
    v
DeathCheckService (monitor vital organs, overall health)
    |
    v
InjuryAggregationService (collect all injury data for entity)
    |
    v
InjurySummaryDTO (structured injury data)
    |
    +------------------------------------------+
    |                    |                     |
    v                    v                     v
InjuryNarrativeFormatter  DamageEventMessageRenderer    ActorDataExtractor
(first-person)            (third-person, chat)          (LLM context)
    |                         |                              |
    v                         v                              v
InjuryStatusPanel         Chat Panel                    CharacterDataXmlBuilder
(left pane widget)        (center #message-list)        (<current_state> section)
```

### 2.3 Integration Points

| System | Integration Method | Purpose |
|--------|-------------------|---------|
| Damage System | Event subscription | React to `anatomy:damage_applied`, `anatomy:part_state_changed` |
| Effects System | Component queries | Read `anatomy:bleeding`, `anatomy:burning`, etc. |
| Anatomy System | Graph traversal | Find all parts, parent-child relationships |
| Event Bus | Event dispatch | Dispatch `anatomy:entity_dying`, `anatomy:entity_died` |
| DOM UI | Widget rendering | Update status panel, chat messages |
| LLM Prompting | Data extraction | Include health in `ActorPromptDataDTO` |

---

## 3. Dependencies to Implement

This spec requires implementing two systems from the brainstorming document that are not yet present in the codebase.

### 3.1 Damage Propagation System

**Purpose**: When a parent body part is hit, internal/child parts may also take damage based on configurable probabilities and damage type penetration values.

**Mechanism**:
1. When damage is applied to a part with children (via sockets), check for propagation
2. Roll against propagation probability (modified by damage type's `penetration` value)
3. Apply a fraction of the damage to affected child parts
4. Dispatch `anatomy:internal_damage_propagated` event

**Example**: Arrow hits torso (40 damage, piercing with 0.8 penetration)
- Check heart socket: 30% base chance × 0.8 penetration = 24% chance
- If triggered: Apply 50% of damage (20) to heart
- Dispatch event with details of propagated damage

**Configuration**:
- Each parent part can define `propagationRules` in its component data
- Damage types define `penetration` factor (already exists in schema)
- Propagation fraction is configurable per rule

### 3.2 Death and Critical State Logic

**Purpose**: Determine when an entity dies based on vital organ destruction or critical overall health.

**Death Conditions**:
1. **Vital Organ Destruction**: Brain, heart, or spine destroyed → immediate death
2. **Overall Health Critical**: Weighted health < 10% → enter dying state
3. **Dying Countdown**: Each turn in dying state decrements counter; at 0 → death
4. **Stabilization**: Healing action can remove dying state before death

**State Flow**:
```
Normal → (vital organ destroyed) → Dead
Normal → (overall health < 10%) → Dying → (countdown expires) → Dead
Dying → (stabilized) → Normal (but still injured)
```

---

## 4. Component Definitions

### 4.1 `anatomy:vital_organ` (NEW)

**Purpose**: Marks a body part as essential for survival. Destruction triggers immediate death.

**File**: `data/mods/anatomy/components/vital_organ.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:vital_organ",
  "description": "Marks a body part as vital for survival. Destruction triggers immediate death.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "organType": {
        "type": "string",
        "enum": ["brain", "heart", "spine"],
        "description": "Category of vital organ for narrative purposes"
      },
      "deathMessage": {
        "type": "string",
        "description": "Custom death message when this organ is destroyed (optional)"
      }
    },
    "required": ["organType"],
    "additionalProperties": false
  }
}
```

### 4.2 `anatomy:dying` (NEW)

**Purpose**: Tracks the dying state countdown when overall health is critical.

**File**: `data/mods/anatomy/components/dying.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:dying",
  "description": "Entity is in a dying state and will die if not stabilized.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "turnsRemaining": {
        "type": "integer",
        "minimum": 0,
        "default": 3,
        "description": "Turns until death if not stabilized"
      },
      "causeOfDying": {
        "type": "string",
        "description": "What triggered the dying state (e.g., 'overall_health_critical', 'heart_failing')"
      },
      "stabilizedBy": {
        "type": ["string", "null"],
        "default": null,
        "description": "Entity ID that stabilized this entity (null if not stabilized)"
      }
    },
    "required": ["turnsRemaining", "causeOfDying"],
    "additionalProperties": false
  }
}
```

### 4.3 `anatomy:dead` (NEW)

**Purpose**: Marks an entity as dead.

**File**: `data/mods/anatomy/components/dead.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:dead",
  "description": "Entity has died and can no longer take actions.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "causeOfDeath": {
        "type": "string",
        "description": "What killed the entity (vital_organ_destroyed, bleeding_out, overall_health_depleted, etc.)"
      },
      "vitalOrganDestroyed": {
        "type": ["string", "null"],
        "default": null,
        "description": "If death was due to vital organ destruction, which organ"
      },
      "killedBy": {
        "type": ["string", "null"],
        "default": null,
        "description": "Entity ID of the killer (if applicable)"
      },
      "deathTimestamp": {
        "type": "integer",
        "description": "Unix timestamp when death occurred"
      }
    },
    "required": ["causeOfDeath", "deathTimestamp"],
    "additionalProperties": false
  }
}
```

### 4.4 `anatomy:damage_propagation` (NEW)

**Purpose**: Configures how damage propagates from a parent part to its children.

**File**: `data/mods/anatomy/components/damage_propagation.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:damage_propagation",
  "description": "Configures internal damage propagation when this part is hit.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "rules": {
        "type": "array",
        "description": "Propagation rules for each child socket",
        "items": {
          "type": "object",
          "properties": {
            "childSocketId": {
              "type": "string",
              "description": "Socket ID containing the child part"
            },
            "baseProbability": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "description": "Base probability (0-1) that damage propagates to this child"
            },
            "damageFraction": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "default": 0.5,
              "description": "Fraction of parent damage applied to child (0-1)"
            },
            "damageTypeModifiers": {
              "type": "object",
              "description": "Probability modifiers per damage type (multiplied with base)",
              "additionalProperties": {
                "type": "number",
                "minimum": 0
              }
            }
          },
          "required": ["childSocketId", "baseProbability"],
          "additionalProperties": false
        }
      }
    },
    "required": ["rules"],
    "additionalProperties": false
  }
}
```

**Example Usage** (on torso entity):
```json
{
  "anatomy:damage_propagation": {
    "rules": [
      {
        "childSocketId": "heart_socket",
        "baseProbability": 0.3,
        "damageFraction": 0.5,
        "damageTypeModifiers": {
          "piercing": 1.5,
          "blunt": 0.3,
          "slashing": 0.8
        }
      },
      {
        "childSocketId": "lung_left_socket",
        "baseProbability": 0.4,
        "damageFraction": 0.4,
        "damageTypeModifiers": {
          "piercing": 1.3,
          "blunt": 0.5
        }
      }
    ]
  }
}
```

---

## 5. Service Specifications

### 5.1 InjuryAggregationService

**Purpose**: Collects all injury information for an entity into a structured summary.

**File**: `src/anatomy/services/injuryAggregationService.js`

**Dependencies**:
- `IEntityManager` - Access entity components
- `ILogger` - Logging

**TypeDefs**:

```javascript
/**
 * @typedef {Object} InjuredPartInfo
 * @property {string} partEntityId - Entity ID of the injured part
 * @property {string} partType - Type of part (arm, leg, torso, head, etc.)
 * @property {string|null} orientation - left, right, or null
 * @property {string} state - Current health state (bruised, wounded, badly_damaged, destroyed)
 * @property {number} healthPercentage - 0-100
 * @property {number} currentHealth - Current health points
 * @property {number} maxHealth - Maximum health points
 * @property {boolean} isBleeding - Has anatomy:bleeding component
 * @property {string|null} bleedingSeverity - minor, moderate, severe, or null
 * @property {boolean} isBurning - Has anatomy:burning component
 * @property {boolean} isPoisoned - Has anatomy:poisoned component
 * @property {boolean} isFractured - Has anatomy:fractured component
 * @property {boolean} isStunned - Has anatomy:stunned component (on owner, sourced from this part)
 */

/**
 * @typedef {Object} InjurySummaryDTO
 * @property {string} entityId - Owner entity ID
 * @property {string} entityName - Name of the entity
 * @property {string} entityPronoun - Pronoun (he/she/they/it)
 * @property {InjuredPartInfo[]} injuredParts - All parts not in 'healthy' state
 * @property {InjuredPartInfo[]} bleedingParts - Parts with active bleeding
 * @property {InjuredPartInfo[]} burningParts - Parts with active burning
 * @property {InjuredPartInfo[]} poisonedParts - Parts with poison
 * @property {InjuredPartInfo[]} fracturedParts - Parts with fractures
 * @property {InjuredPartInfo[]} destroyedParts - Parts that are destroyed
 * @property {number} overallHealthPercentage - Weighted average health (0-100)
 * @property {boolean} isDying - Has anatomy:dying component
 * @property {number|null} dyingTurnsRemaining - If dying, turns until death
 * @property {string|null} dyingCause - If dying, what caused it
 * @property {boolean} isDead - Has anatomy:dead component
 * @property {string|null} causeOfDeath - If dead, what killed them
 */
```

**Key Methods**:

```javascript
/**
 * Aggregates all injury data for an entity.
 * @param {string} entityId - The entity to aggregate injuries for
 * @returns {InjurySummaryDTO} Complete injury summary
 */
aggregateInjuries(entityId)

/**
 * Calculates weighted overall health percentage.
 * Weights: torso (3), head (2), limbs (1), internal organs (0.5)
 * @param {InjuredPartInfo[]} allParts - All body parts (including healthy)
 * @returns {number} Weighted health percentage 0-100
 */
#calculateOverallHealth(allParts)

/**
 * Finds all body parts for an entity by traversing anatomy graph.
 * @param {string} entityId - Owner entity
 * @returns {string[]} Array of part entity IDs
 */
#findAllBodyParts(entityId)
```

### 5.2 InjuryNarrativeFormatterService

**Purpose**: Formats injury data into natural language descriptions.

**File**: `src/anatomy/services/injuryNarrativeFormatterService.js`

**Dependencies**:
- `ILogger` - Logging

**Formatting Rules**:

#### First-Person Voice (Status Panel)
- Sensory, internal experience
- Uses "I feel...", "My [part]...", "I can barely..."
- Groups by severity: destroyed > badly_damaged > wounded > bruised
- Effects show severity only: "bleeding heavily" (severe), "bleeding" (moderate), "seeping blood" (minor)

**Examples**:
- "I feel sharp pain in my left arm, blood seeping from the wound."
- "My torso aches with deep bruising. Every breath is agony."
- "I can barely feel my right leg - it's completely destroyed."
- "Fire sears across my back. The burning is unbearable."

#### Third-Person Voice (Chat Panel)
- Narrative, observable
- Uses entity name or pronoun
- Structure: [Who] suffers [damage type] damage to [part]. [State change]. [Propagation consequences].

**Examples**:
- "Vespera Nightwhisper suffers piercing damage to her torso."
- "Her torso is now badly wounded and bleeding heavily."
- "As a result of this attack, her heart has been bruised."

**Key Methods**:

```javascript
/**
 * Formats injury summary in first-person sensory voice.
 * @param {InjurySummaryDTO} summary - The injury summary
 * @returns {string} First-person narrative description
 */
formatFirstPerson(summary)

/**
 * Formats a damage event in third-person narrative voice.
 * @param {Object} damageEventData - Data from damage events
 * @param {string} damageEventData.entityName - Target entity name
 * @param {string} damageEventData.entityPronoun - Pronoun
 * @param {string} damageEventData.partType - Part that was hit
 * @param {string} damageEventData.orientation - left/right/null
 * @param {string} damageEventData.damageType - piercing/blunt/slashing
 * @param {number} damageEventData.damageAmount - Amount of damage
 * @param {string} damageEventData.previousState - State before damage
 * @param {string} damageEventData.newState - State after damage
 * @param {string[]} damageEventData.effectsTriggered - bleeding, burning, etc.
 * @param {Object[]} damageEventData.propagatedDamage - Internal damage results
 * @returns {string} Third-person narrative description
 */
formatDamageEvent(damageEventData)

/**
 * Formats part name with orientation.
 * @param {string} partType - Type of part
 * @param {string|null} orientation - left/right/null
 * @returns {string} Formatted name (e.g., "left arm", "torso", "heart")
 */
#formatPartName(partType, orientation)

/**
 * Converts state to narrative adjective.
 * @param {string} state - Health state
 * @returns {string} Narrative adjective
 */
#stateToAdjective(state)
```

**State to Adjective Mapping**:
| State | First-Person | Third-Person |
|-------|--------------|--------------|
| bruised | "aches with bruising" | "is bruised" |
| wounded | "throbs with pain" | "is wounded" |
| badly_damaged | "screams with agony" | "is badly damaged" |
| destroyed | "is completely destroyed" | "has been destroyed" |

**Effect to Description Mapping**:
| Effect | Severity | First-Person | Third-Person |
|--------|----------|--------------|--------------|
| bleeding | minor | "blood seeping from the wound" | "bleeding lightly" |
| bleeding | moderate | "bleeding steadily" | "bleeding" |
| bleeding | severe | "blood pouring freely" | "bleeding heavily" |
| burning | - | "fire sears across" | "burning" |
| poisoned | - | "poison courses through" | "poisoned" |
| fractured | - | "bones grinding" | "fractured" |

### 5.3 DeathCheckService

**Purpose**: Monitors for death conditions after damage events.

**File**: `src/anatomy/services/deathCheckService.js`

**Dependencies**:
- `IEntityManager` - Access entity components
- `IEventBus` - Dispatch death events
- `InjuryAggregationService` - Get overall health
- `ILogger` - Logging

**Key Methods**:

```javascript
/**
 * Checks all death conditions after damage is applied.
 * Should be called after any damage event.
 * @param {string} entityId - Entity to check
 * @param {string|null} damageCauserId - Entity that caused the damage (for killedBy)
 * @returns {Object} Result with isDead, isDying, deathInfo
 */
checkDeathConditions(entityId, damageCauserId = null)

/**
 * Checks if any vital organs are destroyed.
 * @param {string} entityId - Entity to check
 * @returns {Object|null} { organType, partEntityId } or null if none destroyed
 */
#checkVitalOrganDestruction(entityId)

/**
 * Checks if overall health is critically low.
 * @param {string} entityId - Entity to check
 * @returns {boolean} True if below 10% threshold
 */
#checkOverallHealthCritical(entityId)

/**
 * Processes dying state at turn end.
 * Decrements counter, triggers death if expired.
 * @param {string} entityId - Entity in dying state
 */
processDyingTurn(entityId)

/**
 * Finalizes death: adds dead component, dispatches event.
 * @param {string} entityId - Entity that died
 * @param {string} causeOfDeath - What killed them
 * @param {string|null} killedBy - Killer entity ID
 * @param {string|null} vitalOrganDestroyed - If applicable
 */
#finalizeDeath(entityId, causeOfDeath, killedBy, vitalOrganDestroyed)
```

### 5.4 DamagePropagationService

**Purpose**: Handles internal damage propagation when parent parts are hit.

**File**: `src/anatomy/services/damagePropagationService.js`

**Dependencies**:
- `IEntityManager` - Access entity components
- `IEventBus` - Dispatch propagation events
- `ILogger` - Logging

**Key Methods**:

```javascript
/**
 * Calculates and applies internal damage propagation.
 * @param {string} partEntityId - Part that received damage
 * @param {number} damageAmount - Amount of damage applied
 * @param {string} damageTypeId - Type of damage (piercing, blunt, etc.)
 * @returns {PropagationResult[]} Array of propagation results
 */
propagateDamage(partEntityId, damageAmount, damageTypeId)

/**
 * @typedef {Object} PropagationResult
 * @property {string} childPartId - Part that received propagated damage
 * @property {string} childPartType - Type of child part
 * @property {number} damageApplied - Amount of damage applied
 * @property {string} previousState - State before propagation
 * @property {string} newState - State after propagation
 * @property {string[]} effectsTriggered - Any effects triggered
 */

/**
 * Loads damage type data to get penetration value.
 * @param {string} damageTypeId - Damage type ID
 * @returns {number} Penetration value (0-1)
 */
#getDamageTypePenetration(damageTypeId)
```

---

## 6. Event System Integration

### 6.1 New Event Definitions

#### `anatomy:entity_dying` (NEW)

**File**: `data/mods/anatomy/events/entity_dying.event.json`

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "anatomy:entity_dying",
  "description": "Dispatched when an entity enters the dying state.",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "entityId": { "type": "string" },
      "entityName": { "type": "string" },
      "turnsRemaining": { "type": "integer" },
      "causeOfDying": { "type": "string" },
      "timestamp": { "type": "integer" }
    },
    "required": ["entityId", "entityName", "turnsRemaining", "causeOfDying", "timestamp"]
  }
}
```

#### `anatomy:entity_died` (NEW)

**File**: `data/mods/anatomy/events/entity_died.event.json`

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "anatomy:entity_died",
  "description": "Dispatched when an entity dies.",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "entityId": { "type": "string" },
      "entityName": { "type": "string" },
      "causeOfDeath": { "type": "string" },
      "vitalOrganDestroyed": { "type": ["string", "null"] },
      "killedBy": { "type": ["string", "null"] },
      "finalMessage": { "type": "string" },
      "timestamp": { "type": "integer" }
    },
    "required": ["entityId", "entityName", "causeOfDeath", "timestamp"]
  }
}
```

#### `anatomy:entity_stabilized` (NEW)

**File**: `data/mods/anatomy/events/entity_stabilized.event.json`

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "anatomy:entity_stabilized",
  "description": "Dispatched when a dying entity is stabilized.",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "entityId": { "type": "string" },
      "entityName": { "type": "string" },
      "stabilizedBy": { "type": "string" },
      "timestamp": { "type": "integer" }
    },
    "required": ["entityId", "entityName", "stabilizedBy", "timestamp"]
  }
}
```

#### `anatomy:internal_damage_propagated` (NEW)

**File**: `data/mods/anatomy/events/internal_damage_propagated.event.json`

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "anatomy:internal_damage_propagated",
  "description": "Dispatched when damage propagates to internal parts.",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "ownerEntityId": { "type": "string" },
      "sourcePartId": { "type": "string" },
      "sourcePartType": { "type": "string" },
      "targetPartId": { "type": "string" },
      "targetPartType": { "type": "string" },
      "damageAmount": { "type": "number" },
      "damageTypeId": { "type": "string" },
      "previousState": { "type": "string" },
      "newState": { "type": "string" },
      "effectsTriggered": { "type": "array", "items": { "type": "string" } },
      "timestamp": { "type": "integer" }
    },
    "required": ["ownerEntityId", "sourcePartId", "targetPartId", "damageAmount", "timestamp"]
  }
}
```

### 6.2 Event Flow Integration

The damage event flow should be updated to include propagation and death checking:

```
APPLY_DAMAGE operation triggered
    |
    v
ApplyDamageHandler processes damage
    |
    v
Dispatch: anatomy:damage_applied
    |
    v
DamageTypeEffectsService applies effects (bleeding, etc.)
    |
    v
DamagePropagationService checks for internal damage
    |
    +--- For each propagated damage:
    |        - Apply damage to child part
    |        - Dispatch: anatomy:internal_damage_propagated
    |
    v
DeathCheckService checks death conditions
    |
    +--- If vital organ destroyed → Dispatch: anatomy:entity_died
    +--- If overall health < 10% → Add anatomy:dying, Dispatch: anatomy:entity_dying
    |
    v
UI components update (status panel, chat messages)
```

---

## 7. UI Components

### 7.1 InjuryStatusPanel

**Purpose**: Displays current physical condition in the left pane.

**File**: `src/domUI/injuryStatusPanel.js`

**HTML Target**: New widget in `#left-pane`, between `#current-turn-actor-panel` and `#perception-log-widget`

**HTML Structure**:
```html
<div
  id="injury-status-widget"
  class="widget"
  role="region"
  aria-labelledby="injury-status-heading"
  aria-live="polite"
>
  <h3 id="injury-status-heading">Physical Condition</h3>
  <div id="injury-status-content">
    <!-- Dynamically populated -->
    <div class="injury-overall">
      <span class="overall-label">Overall:</span>
      <span class="overall-value">75%</span>
      <div class="health-bar">
        <div class="health-bar-fill" style="width: 75%"></div>
      </div>
    </div>
    <ul class="injury-list">
      <li class="injury-item severity-wounded">
        <span class="injury-icon">🩸</span>
        <span class="injury-text">I feel sharp pain in my left arm, blood seeping from the wound.</span>
      </li>
      <!-- More items... -->
    </ul>
  </div>
</div>
```

**Pattern**: Extends `BoundDomRendererBase` following `PerceptionLogRenderer` pattern

**CSS Classes**:
| Class | Purpose |
|-------|---------|
| `.severity-bruised` | Yellow/amber indicator (#f0ad4e) |
| `.severity-wounded` | Red indicator (#d9534f) |
| `.severity-badly_damaged` | Dark red indicator (#8b0000) |
| `.severity-destroyed` | Gray indicator (#4a4a4a) |
| `.effect-bleeding` | Blood drop icon |
| `.effect-burning` | Fire icon |
| `.effect-poisoned` | Skull icon |
| `.effect-fractured` | Bone icon |
| `.state-dying` | Pulsing red animation |
| `.state-dead` | Grayed out, 50% opacity |

**Event Subscriptions**:
- `anatomy:part_health_changed` - Update on any health change
- `anatomy:part_state_changed` - Update on state transitions
- `anatomy:bleeding_started`, `anatomy:bleeding_stopped` - Effect changes
- `anatomy:burning_started`, `anatomy:burning_stopped`
- `anatomy:poisoned_started`, `anatomy:poisoned_stopped`
- `anatomy:fractured` - Fracture status
- `anatomy:entity_dying`, `anatomy:entity_died` - Death states
- `TURN_STARTED` - Refresh display for current actor

**Key Methods**:

```javascript
/**
 * Updates display for the current turn actor.
 * @param {string} actorId - Current actor entity ID
 */
updateForActor(actorId)

/**
 * Renders the complete injury panel.
 * @param {InjurySummaryDTO} summary - Aggregated injury data
 */
#render(summary)

/**
 * Renders overall health bar.
 * @param {number} percentage - 0-100
 * @param {boolean} isDying - Show dying state
 */
#renderOverallHealth(percentage, isDying)

/**
 * Renders individual injury item.
 * @param {InjuredPartInfo} injury - Single injury info
 * @returns {HTMLElement} List item element
 */
#renderInjuryItem(injury)
```

### 7.2 DamageEventMessageRenderer

**Purpose**: Renders damage event messages in the chat panel.

**File**: `src/domUI/damageEventMessageRenderer.js`

**HTML Target**: Messages appended to `#message-list` in center pane

**Message Structure**:
```html
<li class="message damage-event">
  <div class="damage-message-content">
    <p class="damage-primary">Vespera Nightwhisper suffers piercing damage to her torso.</p>
    <p class="damage-state-change">Her torso is now badly wounded and bleeding heavily.</p>
    <p class="damage-propagation">As a result, her heart has been bruised.</p>
  </div>
</li>
```

**CSS Classes**:
| Class | Purpose |
|-------|---------|
| `.damage-event` | Base styling for damage messages |
| `.damage-primary` | Main damage description |
| `.damage-state-change` | State transition info |
| `.damage-propagation` | Internal damage consequences |
| `.damage-death` | Death message (bold, different color) |
| `.damage-dying` | Dying state warning |

**Event Subscriptions**:
- `anatomy:damage_applied` - Primary damage event
- `anatomy:part_state_changed` - State transitions
- `anatomy:internal_damage_propagated` - Propagation results
- `anatomy:entity_dying` - Dying state warning
- `anatomy:entity_died` - Death announcement

**Message Batching**:
Since multiple related events fire in sequence (damage → state change → effects → propagation), use `queueMicrotask()` to batch them into a single coherent message:

```javascript
/**
 * Queues a damage event for batched rendering.
 * Uses microtask to collect related events before rendering.
 */
#queueDamageEvent(eventData) {
  this.#pendingEvents.push(eventData);
  if (!this.#batchScheduled) {
    this.#batchScheduled = true;
    queueMicrotask(() => this.#flushBatch());
  }
}

/**
 * Renders all pending events as a single message.
 */
#flushBatch() {
  const events = this.#pendingEvents;
  this.#pendingEvents = [];
  this.#batchScheduled = false;

  // Combine events into formatted message
  const formattedMessage = this.#narrativeFormatter.formatDamageEvent(events);
  this.#appendToMessageList(formattedMessage);
}
```

---

## 8. LLM Prompt Integration

### 8.1 ActorPromptDataDTO Extensions

**File**: `src/turns/dtos/AIGameStateDTO.js`

Add new fields to `ActorPromptDataDTO`:

```javascript
/**
 * @typedef {Object} ActorPromptDataDTO
 * @property {string} name - Character name
 * @property {string} description - Physical description
 * // ... existing fields ...
 *
 * // NEW: Health state fields
 * @property {ActorHealthStateDTO|null} healthState - Current physical condition
 */

/**
 * @typedef {Object} ActorHealthStateDTO
 * @property {number} overallHealthPercentage - 0-100
 * @property {boolean} isDying - In dying state
 * @property {number|null} dyingTurnsRemaining - If dying, turns left
 * @property {ActorInjuryDTO[]} injuries - List of injuries
 * @property {Object} activeEffects - Count of active effects
 * @property {number} activeEffects.bleeding - Count of bleeding parts
 * @property {number} activeEffects.burning - Count of burning parts
 * @property {number} activeEffects.poisoned - Count of poisoned parts
 * @property {number} activeEffects.fractured - Count of fractured parts
 */

/**
 * @typedef {Object} ActorInjuryDTO
 * @property {string} part - Part name with orientation (e.g., "left arm", "torso")
 * @property {string} state - Health state (bruised, wounded, badly_damaged, destroyed)
 * @property {string[]} effects - Active effects on this part
 */
```

### 8.2 ActorDataExtractor Changes

**File**: `src/turns/services/actorDataExtractor.js`

Add `#extractHealthData()` method:

```javascript
/**
 * Extracts health state data for LLM context.
 * @param {string} actorId - Actor entity ID
 * @returns {ActorHealthStateDTO|null} Health state or null if no anatomy
 */
#extractHealthData(actorId) {
  if (!actorId) return null;

  const summary = this.injuryAggregationService.aggregateInjuries(actorId);
  if (!summary) return null;

  return {
    overallHealthPercentage: summary.overallHealthPercentage,
    isDying: summary.isDying,
    dyingTurnsRemaining: summary.dyingTurnsRemaining,
    injuries: summary.injuredParts.map(part => ({
      part: this.#formatPartName(part.partType, part.orientation),
      state: part.state,
      effects: this.#collectPartEffects(part)
    })),
    activeEffects: {
      bleeding: summary.bleedingParts.length,
      burning: summary.burningParts.length,
      poisoned: summary.poisonedParts.length,
      fractured: summary.fracturedParts.length
    }
  };
}

#collectPartEffects(part) {
  const effects = [];
  if (part.isBleeding) effects.push(`bleeding_${part.bleedingSeverity}`);
  if (part.isBurning) effects.push('burning');
  if (part.isPoisoned) effects.push('poisoned');
  if (part.isFractured) effects.push('fractured');
  return effects;
}
```

Modify `extractPromptData()` to include health:

```javascript
extractPromptData(actorState, actorId = null) {
  // ... existing code ...

  // NEW: Extract health state
  promptData.healthState = this.#extractHealthData(actorId);

  return promptData;
}
```

### 8.3 CharacterDataXmlBuilder Changes

**File**: `src/prompting/characterDataXmlBuilder.js`

Add `#buildPhysicalConditionSection()`:

```javascript
/**
 * Builds physical condition XML section.
 * @param {ActorHealthStateDTO|null} healthState - Health state data
 * @returns {string} XML string or empty if no health data
 */
#buildPhysicalConditionSection(healthState) {
  if (!healthState) return '';

  const parts = [];
  parts.push('<physical_condition>');

  // Overall status
  const statusText = this.#getOverallStatusText(healthState.overallHealthPercentage, healthState.isDying);
  parts.push(this.#xmlBuilder.wrap('overall_status', statusText));

  // Injuries list
  if (healthState.injuries.length > 0) {
    const injuryLines = healthState.injuries.map(injury => {
      const effectsStr = injury.effects.length > 0 ? ` (${injury.effects.join(', ')})` : '';
      return `- ${injury.part}: ${injury.state}${effectsStr}`;
    });
    parts.push(this.#xmlBuilder.wrap('injuries', '\n' + injuryLines.join('\n') + '\n'));
  } else {
    parts.push(this.#xmlBuilder.wrap('injuries', 'No significant injuries'));
  }

  // Dying warning
  if (healthState.isDying) {
    parts.push(this.#xmlBuilder.wrap('critical_warning',
      `DYING - ${healthState.dyingTurnsRemaining} turns until death without intervention`));
  }

  parts.push('</physical_condition>');
  return parts.join('\n');
}

#getOverallStatusText(percentage, isDying) {
  if (isDying) return `Critical condition (${percentage}% - dying)`;
  if (percentage >= 90) return `Good condition (${percentage}%)`;
  if (percentage >= 70) return `Minor injuries (${percentage}%)`;
  if (percentage >= 50) return `Moderate injuries (${percentage}%)`;
  if (percentage >= 25) return `Serious injuries (${percentage}%)`;
  return `Severe injuries (${percentage}%)`;
}
```

Modify `#buildCurrentStateSection()` to include physical condition:

```javascript
#buildCurrentStateSection(characterData) {
  const parts = [];
  parts.push('<current_state>');

  // NEW: Physical condition (placed first in current_state for prominence)
  const physicalCondition = this.#buildPhysicalConditionSection(characterData.healthState);
  if (physicalCondition) {
    parts.push(physicalCondition);
  }

  // Existing: goals, notes, recent_thoughts
  // ... existing code ...

  parts.push('</current_state>');
  return parts.join('\n');
}
```

**Example Output**:
```xml
<current_state>
  <physical_condition>
    <overall_status>Serious injuries (35%)</overall_status>
    <injuries>
      - left arm: wounded (bleeding_moderate, fractured)
      - torso: badly_damaged (bleeding_severe)
      - heart: bruised
    </injuries>
  </physical_condition>
  <goals>...</goals>
  <notes>...</notes>
</current_state>
```

---

## 9. Testing Requirements

### 9.1 Unit Tests

#### InjuryAggregationService Tests

**File**: `tests/unit/anatomy/services/injuryAggregationService.test.js`

```javascript
describe('InjuryAggregationService', () => {
  describe('aggregateInjuries', () => {
    it('should return empty injury list for healthy entity');
    it('should collect all injured parts with correct state');
    it('should detect bleeding parts with severity');
    it('should detect burning parts');
    it('should detect poisoned parts');
    it('should detect fractured parts');
    it('should detect destroyed parts separately');
    it('should calculate correct overall health percentage');
    it('should apply correct weights (torso: 3, head: 2, limbs: 1)');
    it('should detect dying state and remaining turns');
    it('should detect dead state and cause');
  });

  describe('#findAllBodyParts', () => {
    it('should traverse complete anatomy graph');
    it('should handle entities without anatomy');
    it('should handle nested sockets (e.g., hand inside arm)');
  });
});
```

#### InjuryNarrativeFormatterService Tests

**File**: `tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js`

```javascript
describe('InjuryNarrativeFormatterService', () => {
  describe('formatFirstPerson', () => {
    it('should generate sensory description for single injury');
    it('should group injuries by severity');
    it('should include bleeding with correct severity adjective');
    it('should include burning description');
    it('should include poisoned description');
    it('should include fractured description');
    it('should handle destroyed parts with dramatic language');
    it('should handle dying state with urgency');
    it('should return appropriate message when healthy');
  });

  describe('formatDamageEvent', () => {
    it('should format primary damage with type and part');
    it('should include state change description');
    it('should include triggered effects');
    it('should include propagated damage consequences');
    it('should use correct pronoun for entity');
    it('should handle death event appropriately');
    it('should batch multiple propagations into single narrative');
  });

  describe('#formatPartName', () => {
    it('should prepend orientation when present');
    it('should capitalize internal organs (heart, brain, lung)');
    it('should handle null orientation');
  });

  describe('#stateToAdjective', () => {
    it('should map all health states to appropriate adjectives');
    it('should use different adjectives for first vs third person');
  });
});
```

#### DeathCheckService Tests

**File**: `tests/unit/anatomy/services/deathCheckService.test.js`

```javascript
describe('DeathCheckService', () => {
  describe('checkDeathConditions', () => {
    it('should trigger immediate death on brain destruction');
    it('should trigger immediate death on heart destruction');
    it('should trigger immediate death on spine destruction');
    it('should enter dying state when overall health < 10%');
    it('should not trigger death or dying when above threshold');
    it('should dispatch anatomy:entity_died event with correct payload');
    it('should dispatch anatomy:entity_dying event with correct payload');
    it('should record killedBy when provided');
    it('should record vitalOrganDestroyed when applicable');
  });

  describe('processDyingTurn', () => {
    it('should decrement turnsRemaining each turn');
    it('should trigger death when turnsRemaining reaches 0');
    it('should not process if entity is stabilized');
    it('should dispatch death event with bleeding_out cause');
  });

  describe('#checkVitalOrganDestruction', () => {
    it('should find destroyed organ with vital_organ component');
    it('should return null if no vital organs destroyed');
    it('should handle multiple vital organs (return first destroyed)');
  });
});
```

#### DamagePropagationService Tests

**File**: `tests/unit/anatomy/services/damagePropagationService.test.js`

```javascript
describe('DamagePropagationService', () => {
  describe('propagateDamage', () => {
    it('should propagate damage to child parts based on probability');
    it('should apply penetration modifier from damage type');
    it('should apply correct damage fraction to child');
    it('should dispatch anatomy:internal_damage_propagated event');
    it('should return array of propagation results');
    it('should handle parts without propagation rules');
    it('should handle parts without children');
    it('should apply damage type specific modifiers');
    it('should trigger effects on propagated damage');
  });

  describe('probability calculations', () => {
    it('should multiply base probability by penetration');
    it('should apply damage type modifier if specified');
    it('should cap probability at 1.0');
  });
});
```

### 9.2 Integration Tests

**File**: `tests/integration/anatomy/injuryReportingFlow.integration.test.js`

```javascript
describe('Injury Reporting Flow', () => {
  describe('Damage to UI Flow', () => {
    it('should update status panel when damage is applied');
    it('should show correct first-person description');
    it('should show bleeding indicator when effect applied');
    it('should append chat message with third-person narrative');
    it('should batch related events into single chat message');
  });

  describe('Damage Propagation Flow', () => {
    it('should propagate damage from torso to heart');
    it('should include propagation in chat message');
    it('should update status panel with internal injuries');
  });

  describe('Death Flow', () => {
    it('should trigger death when heart destroyed');
    it('should trigger dying state when overall health critical');
    it('should count down dying turns and trigger death');
    it('should show death message in chat');
    it('should update status panel to dead state');
  });

  describe('LLM Integration', () => {
    it('should include health state in ActorPromptDataDTO');
    it('should format physical_condition XML correctly');
    it('should include dying warning in XML when applicable');
  });
});
```

**File**: `tests/integration/anatomy/deathSystem.integration.test.js`

```javascript
describe('Death System Integration', () => {
  it('should complete full damage → propagation → death flow');
  it('should handle multiple vital organ checks correctly');
  it('should stabilize dying entity and prevent death');
  it('should track killedBy across propagated damage');
});
```

### 9.3 E2E Tests

**File**: `tests/e2e/injuryDisplay.e2e.test.js`

```javascript
describe('Injury Display E2E', () => {
  it('should show injury status panel in game.html');
  it('should update panel in real-time when damage applied');
  it('should show damage message in chat panel');
  it('should display death sequence correctly');
  it('should handle rapid damage events without UI lag');
});
```

### 9.4 Performance Tests

**File**: `tests/performance/anatomy/injuryAggregation.performance.test.js`

```javascript
describe('Injury Aggregation Performance', () => {
  it('should aggregate 50-part anatomy in < 10ms');
  it('should aggregate 100-part anatomy in < 25ms');
  it('should handle 10 damage events/second without backlog');
  it('should batch UI updates efficiently');
});
```

### 9.5 Test Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Single damage, no propagation | Status panel shows injury, chat shows damage message |
| Damage with bleeding | Status shows bleeding icon, chat mentions bleeding |
| Damage propagates to heart | Chat shows "As a result, heart is bruised" |
| Heart destroyed | Immediate death, death message in chat |
| Overall health < 10% | Enter dying state, warning in status panel |
| Dying countdown expires | Death triggered, UI reflects dead state |
| Multiple injuries same turn | Single batched chat message |
| Healing while dying | Stabilized, dying state removed |

---

## 10. Implementation Phases

### Phase 1: Core Infrastructure (Est. 3-4 days)

**Components**:
- [ ] Component JSON files (`vital_organ`, `dying`, `dead`, `damage_propagation`)
- [ ] Event JSON files (`entity_dying`, `entity_died`, `entity_stabilized`, `internal_damage_propagated`)
- [ ] `InjuryAggregationService` with full aggregation logic
- [ ] Unit tests for `InjuryAggregationService`

**Deliverables**:
- All new component schemas validated
- Event schemas validated
- Aggregation service passing all unit tests

### Phase 2: Death System (Est. 2-3 days)

**Components**:
- [ ] `DeathCheckService` implementation
- [ ] `DamagePropagationService` implementation
- [ ] Integration with `ApplyDamageHandler` event flow
- [ ] Update vital organ entity definitions (heart, brain)
- [ ] Unit tests for death and propagation services

**Deliverables**:
- Death conditions properly detected
- Propagation working with probability rolls
- Death events dispatched correctly

### Phase 3: Narrative Formatting (Est. 2 days)

**Components**:
- [ ] `InjuryNarrativeFormatterService` implementation
- [ ] First-person voice formatting
- [ ] Third-person voice formatting
- [ ] Grammar handling (possessives, pluralization)
- [ ] Unit tests for formatter

**Deliverables**:
- Narrative generation working for all injury states
- Both voice styles producing correct output

### Phase 4: UI Components (Est. 3-4 days)

**Components**:
- [ ] Modify `game.html` to add `#injury-status-widget`
- [ ] `InjuryStatusPanel` component
- [ ] `DamageEventMessageRenderer` component
- [ ] CSS styling for all states and effects
- [ ] Event subscription wiring

**Deliverables**:
- Status panel displaying in left pane
- Chat messages appearing after damage
- Event batching working correctly

### Phase 5: LLM Integration (Est. 2 days)

**Components**:
- [ ] Extend `ActorPromptDataDTO` with health fields
- [ ] Add `#extractHealthData()` to `ActorDataExtractor`
- [ ] Add `#buildPhysicalConditionSection()` to `CharacterDataXmlBuilder`
- [ ] Wire health extraction into `extractPromptData()`

**Deliverables**:
- Health state included in LLM context
- XML output validates correctly

### Phase 6: Integration & Polish (Est. 2-3 days)

**Components**:
- [ ] Integration tests for full flow
- [ ] E2E tests for UI
- [ ] Performance tests
- [ ] Edge case handling
- [ ] Documentation updates

**Deliverables**:
- All tests passing
- Performance within targets
- System fully operational

---

## 11. Appendix: File Checklist

### New Files to Create

| File Path | Type | Purpose |
|-----------|------|---------|
| `data/mods/anatomy/components/vital_organ.component.json` | Component | Mark organs as vital |
| `data/mods/anatomy/components/dying.component.json` | Component | Dying state tracking |
| `data/mods/anatomy/components/dead.component.json` | Component | Death marker |
| `data/mods/anatomy/components/damage_propagation.component.json` | Component | Propagation config |
| `data/mods/anatomy/events/entity_dying.event.json` | Event | Dying state event |
| `data/mods/anatomy/events/entity_died.event.json` | Event | Death event |
| `data/mods/anatomy/events/entity_stabilized.event.json` | Event | Stabilization event |
| `data/mods/anatomy/events/internal_damage_propagated.event.json` | Event | Propagation event |
| `src/anatomy/services/injuryAggregationService.js` | Service | Injury data collection |
| `src/anatomy/services/injuryNarrativeFormatterService.js` | Service | Narrative generation |
| `src/anatomy/services/deathCheckService.js` | Service | Death condition monitoring |
| `src/anatomy/services/damagePropagationService.js` | Service | Internal damage propagation |
| `src/domUI/injuryStatusPanel.js` | UI | Status panel widget |
| `src/domUI/damageEventMessageRenderer.js` | UI | Chat damage messages |
| `tests/unit/anatomy/services/injuryAggregationService.test.js` | Test | Aggregation tests |
| `tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js` | Test | Formatter tests |
| `tests/unit/anatomy/services/deathCheckService.test.js` | Test | Death system tests |
| `tests/unit/anatomy/services/damagePropagationService.test.js` | Test | Propagation tests |
| `tests/integration/anatomy/injuryReportingFlow.integration.test.js` | Test | Flow integration |
| `tests/integration/anatomy/deathSystem.integration.test.js` | Test | Death integration |
| `tests/e2e/injuryDisplay.e2e.test.js` | Test | E2E UI tests |
| `tests/performance/anatomy/injuryAggregation.performance.test.js` | Test | Performance tests |

### Files to Modify

| File Path | Modification |
|-----------|--------------|
| `game.html` | Add `#injury-status-widget` div in left pane |
| `css/style.css` | Add injury panel and damage message styles |
| `src/turns/dtos/AIGameStateDTO.js` | Add `ActorHealthStateDTO` typedef |
| `src/turns/services/actorDataExtractor.js` | Add `#extractHealthData()` method |
| `src/prompting/characterDataXmlBuilder.js` | Add `#buildPhysicalConditionSection()` |
| `src/logic/operationHandlers/applyDamageHandler.js` | Integrate propagation and death checks |
| `src/dependencyInjection/tokens/` | Add tokens for new services |
| `src/dependencyInjection/registrations/` | Register new services |
| `data/mods/anatomy/entities/definitions/` | Update heart/brain with vital_organ |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-02 | System Architect | Initial specification |
