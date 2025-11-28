# Damage Application Mechanics Specification

## Document Information

**Version:** 1.0.0
**Status:** Design Specification
**Last Updated:** 2025-11-28
**Author:** System Architect
**Dependencies:** `anatomy` mod (v1.0.0+)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Goals](#architecture-goals)
3. [Component Definitions](#component-definitions)
4. [Operation Handlers](#operation-handlers)
5. [Mod Structure](#mod-structure)
6. [Damage Application Logic](#damage-application-logic)
7. [Event System Integration](#event-system-integration)
8. [Data Schemas](#data-schemas)
9. [Testing Strategy](#testing-strategy)

---

## System Overview

### Purpose

The Damage Application Mechanics system provides a granular, realistic simulation of injury and damage distribution across an entity's anatomy. Unlike simple HP pools, this system applies damage to specific body parts, supports internal damage propagation (e.g., a hit to the torso damaging the heart), and handles both targeted and general attacks.

### Key Features

- **Anatomy-Based Targeting**: Hits are distributed to body parts based on size/exposure probability.
- **Damage Propagation**: Damage can penetrate parent parts to injure internal child parts (organs).
- **Per-Part Health**: Each body part tracks its own health and narrative state.
- **Data-Driven Design**: Part sizes, propagation probabilities, and damage types are fully configurable via JSON.
- **Event-Driven**: Damage events trigger narrative responses, status effects, and AI reactions.

---

## Architecture Goals

### Primary Goals

1. **Granularity**: Enable specific injuries (e.g., "broken left arm") rather than just "took 10 damage".
2. **Realism**: Simulate internal injuries through damage propagation.
3. **Configurability**: Allow modders to define new anatomies and damage rules easily.
4. **Integration**: Seamlessly connect with the Event Bus and Narrative Engine for rich descriptions.

### Data Flow

```
Damage Source (Action/Event)
    ↓
APPLY_DAMAGE Operation
    ↓
Target Selection (Specific Part vs. General Hit)
    ↓ (if General)
RESOLVE_HIT_LOCATION Operation (Weighted Random)
    ↓
Primary Part Damage Application
    ↓
Internal Propagation Check (Probability Roll)
    ↓ (if Success)
Child Part Damage Application (Recursive)
    ↓
Events Dispatched (anatomy:damage_applied, anatomy:part_health_changed, etc.)
```

---

## Component Definitions

### 1. `anatomy:part` (Update)

**Purpose:** Extended to include size/weight for targeting probability.

**File:** `data/mods/anatomy/components/part.component.json` (Existing)

**Schema Extension:**

```json
{
  "properties": {
    "hit_probability_weight": {
      "type": "number",
      "description": "Relative weight for being hit in a general attack (e.g., torso > finger)",
      "minimum": 0,
      "default": 1.0
    },
    "damage_propagation": {
      "type": "object",
      "description": "Rules for propagating damage to child parts",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "probability": { "type": "number", "minimum": 0, "maximum": 1 },
          "damage_fraction": { "type": "number", "minimum": 0, "default": 0.5 },
          "damage_types": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  }
}
```

### 2. `anatomy:part_health` (Existing)

**Purpose:** Tracks current and max health for a specific body part.

**File:** `data/mods/anatomy/components/part_health.component.json`

**Schema:**

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:part_health",
  "description": "Tracks health status of a body part entity. Maps numeric health values to narrative state labels based on percentage thresholds.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "currentHealth": {
        "type": "number",
        "minimum": 0,
        "description": "Current health points of the body part. Must not exceed maxHealth."
      },
      "maxHealth": {
        "type": "number",
        "minimum": 1,
        "description": "Maximum health capacity of the body part."
      },
      "state": {
        "type": "string",
        "enum": [
          "healthy",
          "bruised",
          "wounded",
          "badly_damaged",
          "destroyed"
        ],
        "description": "Narrative health state based on percentage thresholds."
      },
      "turnsInState": {
        "type": "integer",
        "minimum": 0,
        "default": 0,
        "description": "Consecutive turns the part has been in the current state."
      }
    },
    "required": [
      "currentHealth",
      "maxHealth",
      "state"
    ],
    "additionalProperties": false
  }
}
```

---

## Operation Handlers

### 1. RESOLVE_HIT_LOCATION Operation

**Purpose:** Determines which body part is hit during a general (untargeted) attack.

**Operation Schema:** `data/schemas/operations/resolveHitLocation.schema.json`

**Logic:**
1. Collect all direct child parts of the root entity (or exposed parts).
2. Sum their `hit_probability_weight`.
3. Generate a random number between 0 and sum.
4. Select the part corresponding to the random value.
5. Return the selected `part_id`.

### 2. APPLY_DAMAGE Operation

**Purpose:** Applies damage to a specific part and handles propagation.

**Operation Schema:** `data/schemas/operations/applyDamage.schema.json`

**Parameters:**
- `entity_ref`: Target entity.
- `part_ref`: Specific part ID (optional, if null, calls `RESOLVE_HIT_LOCATION`).
- `amount`: Damage amount.
- `damage_type`: String (cutting, blunt, piercing, etc.).

**Logic:**
1. **Targeting**: If `part_ref` is null, call `RESOLVE_HIT_LOCATION` to find target.
2. **Direct Damage**: Subtract `amount` from target part's `currentHealth`.
3. **Update State**: Check thresholds (healthy -> bruised -> etc.) and set state to `destroyed` if health <= 0.
4. **Propagation**:
   - Iterate through `damage_propagation` rules of the target part.
   - Check `damage_type` match (if specified).
   - Roll against `probability`.
   - If successful, calculate `propagated_amount` (default or fraction).
   - Recursively call `APPLY_DAMAGE` on the child part (as a targeted hit).
5. **Events**: Dispatch `anatomy:damage_applied` and `anatomy:part_health_changed`.

---

## Damage Application Logic

### Targeting & Hit Distribution

For untargeted attacks, the system uses a weighted random distribution.
Example weights:
- Torso: 30
- Arm (L/R): 15 each
- Leg (L/R): 15 each
- Head: 10

Total = 100. A roll of 85 might hit the Head.

### Internal Damage Propagation

Simulates penetration.
**Example:**
- **Part:** Torso
- **Child:** Heart
- **Rule:** 30% chance on "piercing" damage.
- **Action:** Arrow hits Torso (Piercing, 20 dmg).
- **Process:**
    1. Torso takes 20 dmg.
    2. Roll for Heart (0.30). Success.
    3. Heart takes 10 dmg (0.5 fraction).

### Thresholds & Narrative Labels

Health percentage maps to labels:
- **100-75%**: healthy
- **75-50%**: bruised
- **50-25%**: wounded
- **25-0%**: badly_damaged
- **0%**: destroyed

---

## Event System Integration

### `anatomy:damage_applied`

Emitted when damage is successfully processed.

```json
{
  "type": "anatomy:damage_applied",
  "payload": {
    "entityId": "entity_123",
    "partId": "torso",
    "amount": 20,
    "damageType": "piercing",
    "propagatedFrom": null
  }
}
```

### `anatomy:part_health_changed`

Emitted whenever `currentHealth` changes.

```json
{
  "type": "anatomy:part_health_changed",
  "payload": {
    "entityId": "entity_123",
    "partId": "torso",
    "oldHealth": 50,
    "newHealth": 30,
    "maxHealth": 100,
    "statusLabel": "wounded"
  }
}
```

### `anatomy:part_destroyed`

Emitted when a part reaches 0 health.

```json
{
  "type": "anatomy:part_destroyed",
  "payload": {
    "entityId": "entity_123",
    "partId": "torso"
  }
}
```

---

## Testing Strategy

### Unit Tests

1.  **Hit Resolution**:
    - Mock an anatomy with known weights.
    - Run `RESOLVE_HIT_LOCATION` 1000 times.
    - Verify distribution matches weights within statistical margin.

2.  **Damage Application**:
    - Test simple damage reduction.
    - Test threshold updates (Healthy -> Bruised).
    - Test destruction state (health <= 0).

3.  **Propagation**:
    - Mock a part with 100% propagation chance to child.
    - Apply damage to parent.
    - Assert child also took damage.
    - Test damage type filtering (e.g., propagation only on "piercing").

### Integration Tests

- Create a full entity with complex anatomy.
- Execute a generic "Attack" action.
- Verify damage is distributed and events are fired correctly.
- Verify Narrative Engine receives correct injury report (via mock or event inspection).
