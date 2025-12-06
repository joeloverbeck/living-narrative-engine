# Dismembered Body Part Spawning Specification

## Document Information

**Version:** 1.0.0
**Status:** Design Specification
**Last Updated:** 2025-12-04
**Author:** System Architect
**Dependencies:** `anatomy` mod (v1.0.0+), `items` mod (v1.0.0+)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Goals](#architecture-goals)
3. [Problem Statement](#problem-statement)
4. [Entity Definition ID Tracking Investigation](#entity-definition-id-tracking-investigation)
5. [Component Modifications](#component-modifications)
6. [Body Part Weight Data Requirements](#body-part-weight-data-requirements)
7. [Operation Handler Modifications](#operation-handler-modifications)
8. [Event System Integration](#event-system-integration)
9. [Spawned Entity Structure](#spawned-entity-structure)
10. [Testing Strategy](#testing-strategy)

---

## System Overview

### Purpose

This specification defines a system for spawning pickable body part entities when dismemberment occurs. When a body part is severed from an entity, a new physical entity representing that body part should be created at the location of the affected character. This entity should be interactable (pickable, droppable, usable in various game mechanics).

### Key Features

- **Automatic Entity Spawning**: Dismembered body parts automatically spawn as world entities.
- **Definition-Based Instantiation**: Spawned entities inherit properties from original body part entity definitions.
- **Pickable Items**: Spawned body parts include `items:item`, `items:portable`, and `items:weight` components.
- **Named Ownership**: Entity names reflect the character (e.g., "Sarah's left leg").
- **Data-Driven Weights**: Body part weights are defined in entity definitions, not hardcoded.

---

## Architecture Goals

### Primary Goals

1. **Immersion**: Severed body parts exist physically in the game world.
2. **Interactivity**: Players/NPCs can pick up, carry, and use severed parts.
3. **Data-Driven**: All body part properties (including weight) are configurable via JSON.
4. **Traceability**: System can trace body part instance back to its original entity definition.

### Data Flow

```
APPLY_DAMAGE Operation
    ↓
DamageTypeEffectsService.applyDismemberment()
    ↓
Dismemberment Threshold Check
    ↓ (if triggered)
Add anatomy:dismembered Component
    ↓
Dispatch anatomy:dismembered Event
    ↓ [NEW]
DismemberedBodyPartSpawner Service
    ↓
Retrieve Entity Definition ID from anatomy:part.definitionId [NEW FIELD]
    ↓
Create Entity Instance from Definition
    ↓
Override core:name → "[Character Name]'s [orientation] [part type]"
    ↓
Add items:item + items:portable Components
    ↓
Inherit items:weight from Definition (must exist)
    ↓
Set core:position to Character's Location
    ↓
Dispatch anatomy:body_part_spawned Event [NEW]
```

---

## Problem Statement

### Current State

When dismemberment occurs (`anatomy:dismembered` component added, `anatomy:dismembered` event dispatched), no physical entity is created in the world. The dismembered part simply gains a component marker but remains attached to the character's entity graph (logically severed but not physically present as a separate entity).

### Desired State

When dismemberment occurs:

1. A new entity instance should be created from the original body part's entity definition.
2. The entity should spawn at the character's location.
3. The entity should have a descriptive name indicating ownership and orientation.
4. The entity should be pickable (have `items:item`, `items:portable`, `items:weight` components).
5. The entity's weight should come from the body part definition (data-driven).

---

## Entity Definition ID Tracking Investigation

### Investigation Results

**Question:** Is the original entity definition ID available at dismemberment time?

**Findings:**

1. **Entity Instance Storage**: The `Entity` class (`src/entities/entity.js:36-45`) stores the definition ID:

   ```javascript
   get definitionId() {
     return this.#data.definition.id; // e.g., "anatomy:human_torso"
   }
   ```

2. **Runtime Access**: During runtime, `entityManager.getEntityInstance(partId).definitionId` returns the definition ID.

3. **Component Storage**: The `anatomy:part` component does **NOT** currently store the definition ID - only `subType`, `orientation`, and `hit_probability_weight`.

4. **Persistence Issue**: After serialization/deserialization, the entity instance may lose access to `definitionId` unless it's explicitly stored in component data.

### Recommendation

**Add `definitionId` field to `anatomy:part` component** to ensure the definition ID is always available, even after serialization. This is the most robust solution as:

- It survives save/load cycles.
- It's explicitly part of the body part data model.
- It doesn't rely on runtime entity instance structure.

---

## Component Modifications

### 1. Update `anatomy:part` Component Schema

**File:** `data/mods/anatomy/components/part.component.json`

**Change:** Add `definitionId` field to schema.

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:part",
  "description": "Marks an entity as an anatomy body part with a specific subtype",
  "dataSchema": {
    "type": "object",
    "properties": {
      "subType": {
        "type": "string",
        "description": "The specific type of body part (e.g., 'leg', 'arm', 'breast', 'head')"
      },
      "orientation": {
        "type": "string",
        "description": "The orientation of the body part inherited from parent socket"
      },
      "hit_probability_weight": {
        "type": "number",
        "description": "Relative weight for being hit in a general attack",
        "minimum": 0,
        "default": 1.0
      },
      "definitionId": {
        "type": "string",
        "description": "The entity definition ID this body part was instantiated from (e.g., 'anatomy:human_foot')"
      }
    },
    "required": ["subType"],
    "additionalProperties": false
  }
}
```

### 2. Update EntityGraphBuilder to Store Definition ID

**File:** `src/anatomy/entityGraphBuilder.js`

**Change:** When creating body part entities, populate `anatomy:part.definitionId` with the definition ID used for instantiation.

**Location:** `createAndAttachPart()` method (lines 192-290)

**Logic:**

```javascript
// After creating entity instance
const childEntity = await this.#entityManager.createEntityInstance(
  partDefinitionId,
  { componentOverrides }
);

// Update anatomy:part component to include definitionId
const existingPartData = await this.#entityManager.getComponent(
  childEntity.id,
  'anatomy:part'
);
if (existingPartData) {
  await this.#entityManager.updateComponent(childEntity.id, 'anatomy:part', {
    ...existingPartData,
    definitionId: partDefinitionId,
  });
}
```

---

## Body Part Weight Data Requirements

### Rationale

Body part weights cannot be hardcoded because:

- Different body types have different part weights (human vs. chicken vs. dragon).
- Modders need control over weight values.
- Weights vary significantly by part type (brain ~1.4kg, leg ~10kg, finger ~0.05kg).

### Implementation Approach

**Add `items:weight` component to all body part entity definitions** in `data/mods/anatomy/entities/definitions/`.

### Required Data Changes

All body part entity definitions must include `items:weight` component with realistic weight values (in kilograms).

**Example - Updated `human_foot.entity.json`:**

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:human_foot",
  "description": "A human foot",
  "components": {
    "anatomy:part": {
      "subType": "foot",
      "hit_probability_weight": 3
    },
    "anatomy:part_health": {
      "currentHealth": 15,
      "maxHealth": 15,
      "state": "healthy"
    },
    "core:name": {
      "text": "foot"
    },
    "items:weight": {
      "weight": 1.2
    }
  }
}
```

### Reference Weight Values (Human Body Parts)

| Body Part  | Typical Weight (kg) | Notes                  |
| ---------- | ------------------- | ---------------------- |
| Head       | 4.5-5.0             | Including brain        |
| Brain      | 1.3-1.4             | Internal organ         |
| Torso      | 25-35               | Varies by build        |
| Arm (full) | 3.5-5.0             | Shoulder to fingertips |
| Hand       | 0.4-0.5             | Wrist to fingertips    |
| Finger     | 0.05-0.1            | Per finger             |
| Leg (full) | 10-15               | Hip to toes            |
| Foot       | 1.0-1.3             | Ankle to toes          |
| Eye        | 0.007-0.008         | Per eye                |
| Ear        | 0.01                | Cartilage only         |
| Breast     | 0.5-1.5             | Varies significantly   |
| Heart      | 0.25-0.35           | Internal organ         |

### Files Requiring Weight Addition

All files in `data/mods/anatomy/entities/definitions/*.entity.json` need `items:weight` component added. Based on file listing, this includes approximately 100+ entity definitions covering:

- Human parts (torso variants, feet, hands, eyes, hair, ass cheeks, breasts, etc.)
- Centaur parts (torso, legs, head)
- Chicken parts (head, beak, wing, leg, foot, etc.)
- Cat parts (ears, tail)
- Dragon parts (head, torso, tail)
- Eldritch parts (tentacles, eyes, maws, etc.)
- Horse parts (tail)

---

## Operation Handler Modifications

### New Service: DismemberedBodyPartSpawner

**File:** `src/anatomy/services/dismemberedBodyPartSpawner.js` (NEW)

**Purpose:** Listens for `anatomy:dismembered` events and spawns corresponding pickable entities.

**Dependencies:**

- `IEntityManager` - For entity creation and component access
- `IEventBus` - For listening to dismemberment events
- `ILogger` - For logging

**Constructor Signature:**

```javascript
constructor({ entityManager, eventBus, logger });
```

**Public Methods:**

```javascript
/**
 * Initializes the service by subscribing to dismemberment events.
 */
initialize()

/**
 * Handles a dismemberment event by spawning a pickable body part entity.
 * @param {Object} event - The anatomy:dismembered event
 * @param {string} event.payload.entityId - Character who lost the part
 * @param {string} event.payload.entityName - Character's name
 * @param {string} event.payload.partId - Entity ID of the dismembered part
 * @param {string} event.payload.partType - Type of body part (e.g., 'leg')
 * @param {string} event.payload.orientation - Left/right/mid
 */
async handleDismemberment(event)
```

**Spawning Logic:**

1. **Retrieve Definition ID:**

   ```javascript
   const partComponent = await entityManager.getComponent(
     partId,
     'anatomy:part'
   );
   const definitionId = partComponent.definitionId;
   if (!definitionId) {
     logger.error(
       'Cannot spawn body part: missing definitionId in anatomy:part component'
     );
     return;
   }
   ```

2. **Get Character Location:**

   ```javascript
   const characterPosition = await entityManager.getComponent(
     entityId,
     'core:position'
   );
   ```

3. **Generate Display Name:**

   ```javascript
   const displayName =
     orientation && orientation !== 'mid'
       ? `${entityName}'s ${orientation} ${partType}`
       : `${entityName}'s ${partType}`;
   ```

4. **Create Entity with Overrides:**

   ```javascript
   const spawnedEntity = await entityManager.createEntityInstance(
     definitionId,
     {
       componentOverrides: {
         'core:name': { text: displayName },
         'core:position': characterPosition,
         'items:item': {}, // Mark as item
         'items:portable': {}, // Mark as pickable
         // items:weight inherited from definition
       },
     }
   );
   ```

5. **Dispatch Spawn Event:**
   ```javascript
   eventBus.dispatch('anatomy:body_part_spawned', {
     entityId: entityId,
     entityName: entityName,
     spawnedEntityId: spawnedEntity.id,
     spawnedEntityName: displayName,
     partType: partType,
     orientation: orientation,
     definitionId: definitionId,
     timestamp: Date.now(),
   });
   ```

### DI Registration

**File:** `src/dependencyInjection/tokens/tokens-core.js`

Add token:

```javascript
DismemberedBodyPartSpawner: 'DismemberedBodyPartSpawner';
```

**File:** `src/dependencyInjection/registrations/anatomyRegistrations.js`

Register service with dependencies:

```javascript
container.registerFactory(
  tokens.DismemberedBodyPartSpawner,
  (container) =>
    new DismemberedBodyPartSpawner({
      entityManager: container.resolve(tokens.IEntityManager),
      eventBus: container.resolve(tokens.IEventBus),
      logger: container.resolve(tokens.ILogger),
    }),
  Lifecycles.SINGLETON
);
```

### Service Initialization

The `DismemberedBodyPartSpawner` service must be initialized during game startup to subscribe to events. This should be added to the anatomy module initialization sequence.

---

## Event System Integration

### New Event: `anatomy:body_part_spawned`

**File:** `data/mods/anatomy/events/body_part_spawned.event.json` (NEW)

**Schema:**

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "anatomy:body_part_spawned",
  "description": "Fired when a dismembered body part is spawned as a pickable entity in the world",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "entityId": {
        "type": "string",
        "description": "ID of the character who lost the body part"
      },
      "entityName": {
        "type": "string",
        "description": "Display name of the character"
      },
      "spawnedEntityId": {
        "type": "string",
        "description": "ID of the newly spawned body part entity"
      },
      "spawnedEntityName": {
        "type": "string",
        "description": "Display name of the spawned entity (e.g., \"Sarah's left leg\")"
      },
      "partType": {
        "type": "string",
        "description": "Type of body part (e.g., 'leg', 'arm')"
      },
      "orientation": {
        "type": "string",
        "description": "Orientation of the part (left, right, mid)"
      },
      "definitionId": {
        "type": "string",
        "description": "Entity definition ID used to spawn the body part"
      },
      "timestamp": {
        "type": "number",
        "description": "Unix timestamp when the body part was spawned"
      }
    },
    "required": [
      "entityId",
      "entityName",
      "spawnedEntityId",
      "spawnedEntityName",
      "partType",
      "definitionId",
      "timestamp"
    ],
    "additionalProperties": false
  }
}
```

---

## Spawned Entity Structure

### Example Spawned Entity

When "Sarah" loses her left leg (definition: `anatomy:human_leg`), the spawned entity would have:

```json
{
  "id": "uuid-generated-at-spawn-time",
  "definitionId": "anatomy:human_leg",
  "components": {
    "anatomy:part": {
      "subType": "leg",
      "hit_probability_weight": 15,
      "definitionId": "anatomy:human_leg"
    },
    "anatomy:part_health": {
      "currentHealth": 0,
      "maxHealth": 40,
      "state": "destroyed"
    },
    "anatomy:dismembered": {
      "sourceDamageType": "slashing"
    },
    "core:name": {
      "text": "Sarah's left leg"
    },
    "core:position": {
      "locationId": "location-where-sarah-is"
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 12.5
    }
  }
}
```

---

## Testing Strategy

### Unit Tests

#### 1. DismemberedBodyPartSpawner Service Tests

**File:** `tests/unit/anatomy/services/dismemberedBodyPartSpawner.test.js`

**Test Cases:**

1. **Service Initialization**
   - ✅ Should subscribe to `anatomy:dismembered` event on initialize()
   - ✅ Should validate all required dependencies

2. **Dismemberment Handling**
   - ✅ Should spawn entity from correct definition ID
   - ✅ Should generate correct display name with orientation (e.g., "Sarah's left leg")
   - ✅ Should generate correct display name without orientation for 'mid' parts (e.g., "Sarah's head")
   - ✅ Should set entity position to character's current location
   - ✅ Should add items:item component to spawned entity
   - ✅ Should add items:portable component to spawned entity
   - ✅ Should preserve items:weight from definition
   - ✅ Should dispatch anatomy:body_part_spawned event with correct payload

3. **Error Handling**
   - ✅ Should log error and not crash if definitionId is missing from anatomy:part
   - ✅ Should log error and not crash if entity creation fails
   - ✅ Should handle missing core:position gracefully (spawn at default location?)
   - ✅ Should handle missing items:weight in definition (log warning)

#### 2. EntityGraphBuilder Definition ID Storage Tests

**File:** `tests/unit/anatomy/entityGraphBuilder.definitionId.test.js`

**Test Cases:**

1. **Definition ID Population**
   - ✅ Should store definitionId in anatomy:part component when creating root entity
   - ✅ Should store definitionId in anatomy:part component when attaching child parts
   - ✅ Should not overwrite existing definitionId if already present
   - ✅ Should handle parts without anatomy:part component gracefully

#### 3. anatomy:part Component Schema Tests

**File:** `tests/unit/anatomy/components/part.component.test.js`

**Test Cases:**

1. **Schema Validation**
   - ✅ Should accept definitionId as optional string field
   - ✅ Should not require definitionId (backward compatibility)
   - ✅ Should reject invalid definitionId types

### Integration Tests

#### 1. Full Dismemberment Flow Integration

**File:** `tests/integration/anatomy/dismembermentSpawning.integration.test.js`

**Test Cases:**

1. **End-to-End Dismemberment Spawning**
   - ✅ Given a character with anatomy, when APPLY_DAMAGE causes dismemberment, then a pickable body part entity should be spawned at character's location
   - ✅ Spawned entity should have correct name format
   - ✅ Spawned entity should be discoverable in location's entity list
   - ✅ Spawned entity should be valid for pick_up action

2. **Multiple Dismemberments**
   - ✅ Should spawn separate entities for each dismembered part
   - ✅ Each entity should have unique ID and correct name

3. **Cross-Recipe Testing**
   - ✅ Should work with human anatomy recipe
   - ✅ Should work with non-human anatomy (centaur, chicken, etc.)
   - ✅ Should correctly spawn variant-specific parts (e.g., human_female_torso_stocky)

#### 2. Weight Inheritance Integration

**File:** `tests/integration/anatomy/dismembermentWeight.integration.test.js`

**Test Cases:**

1. **Weight Preservation**
   - ✅ Spawned body part should have same weight as defined in entity definition
   - ✅ Weight should affect inventory capacity when picked up
   - ✅ Different part types should have different weights

#### 3. Event Flow Integration

**File:** `tests/integration/anatomy/dismembermentEvents.integration.test.js`

**Test Cases:**

1. **Event Sequence**
   - ✅ anatomy:dismembered event should fire before anatomy:body_part_spawned
   - ✅ anatomy:body_part_spawned should contain correct references
   - ✅ Rules triggered by body_part_spawned should have access to spawned entity

### E2E Tests

#### 1. Player Interaction E2E

**File:** `tests/e2e/anatomy/dismembermentPickup.e2e.test.js`

**Test Cases:**

1. **Player Picks Up Severed Part**
   - ✅ After dismemberment occurs, player should see body part in location
   - ✅ Player should be able to execute pick_up action on body part
   - ✅ Body part should appear in player's inventory with correct name and weight

2. **Narrative Description**
   - ✅ Body part should be described correctly in location description
   - ✅ Body part name should include character name and orientation

### Performance Tests

#### 1. Bulk Dismemberment Performance

**File:** `tests/performance/anatomy/dismembermentSpawning.performance.test.js`

**Test Cases:**

1. **Mass Casualty Scenario**
   - ✅ Should handle 10+ simultaneous dismemberments without significant performance degradation
   - ✅ Entity spawning should complete within acceptable time threshold (< 100ms each)

### Data Validation Tests

#### 1. Body Part Definition Weight Completeness

**File:** `tests/integration/anatomy/bodyPartWeights.validation.test.js`

**Test Cases:**

1. **Weight Data Presence**
   - ✅ Every entity definition in `data/mods/anatomy/entities/definitions/` with anatomy:part component should have items:weight component
   - ✅ All weight values should be > 0
   - ✅ All weight values should be reasonable for the body part type

---

## Implementation Checklist

### Phase 1: Schema & Data Changes

- [ ] Update `anatomy:part` component schema to include `definitionId` field
- [ ] Add `items:weight` component to all body part entity definitions (~100+ files)
- [ ] Create `anatomy:body_part_spawned` event definition
- [ ] Validate all schema changes with `npm run validate`

### Phase 2: Code Implementation

- [ ] Update `EntityGraphBuilder.createAndAttachPart()` to store definitionId
- [ ] Create `DismemberedBodyPartSpawner` service
- [ ] Register service in DI container
- [ ] Initialize service during anatomy module startup
- [ ] Add service to anatomy module exports

### Phase 3: Testing

- [ ] Write unit tests for DismemberedBodyPartSpawner
- [ ] Write unit tests for EntityGraphBuilder definitionId storage
- [ ] Write integration tests for full dismemberment flow
- [ ] Write E2E tests for player interaction
- [ ] Write performance tests for bulk scenarios
- [ ] Write validation tests for weight data completeness

### Phase 4: Documentation

- [ ] Update CLAUDE.md if needed
- [ ] Document new event in modding guide
- [ ] Add weight reference table to anatomy mod documentation

---

## Open Questions

1. **Existing Body Parts**: Should we run a migration to populate `definitionId` for already-created body parts in saved games?

2. **Missing Weight Handling**: If a body part definition lacks `items:weight`, should we:
   - a) Fail spawning with error
   - b) Use a default weight (1.0 kg)
   - c) Log warning and spawn without weight component

3. **Corpse vs Parts**: Should the original body part entity (still attached to character graph) be removed when the spawned entity is created, or should both exist?

4. **Internal Organs**: Should internal organs (brain, heart) also spawn when dismembered, or only external parts?

---

## Appendix: Current File Inventory

### Key Source Files

| File                                                      | Purpose                                                |
| --------------------------------------------------------- | ------------------------------------------------------ |
| `src/anatomy/services/damageTypeEffectsService.js`        | Handles dismemberment detection and component addition |
| `src/anatomy/entityGraphBuilder.js`                       | Creates body part entities during anatomy building     |
| `src/entities/entity.js`                                  | Entity class with definitionId getter                  |
| `data/mods/anatomy/components/part.component.json`        | anatomy:part component schema                          |
| `data/mods/anatomy/components/dismembered.component.json` | anatomy:dismembered component schema                   |
| `data/mods/anatomy/events/dismembered.event.json`         | anatomy:dismembered event schema                       |
| `data/mods/items/components/weight.component.json`        | items:weight component schema                          |

### Body Part Definition Directory

`data/mods/anatomy/entities/definitions/` contains ~100+ body part entity definitions that will need `items:weight` component added.
