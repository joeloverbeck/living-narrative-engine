# Anatomy System: Slots vs Sockets Distinction

## Overview

The Living Narrative Engine anatomy system uses two distinct concepts that must not be confused:

1. **Blueprint Slots**: Named positions in the anatomy hierarchy that define where body parts can be attached (e.g., "left_hand", "right_foot")
2. **Sockets**: Generic attachment points on body parts that allow physical connections (e.g., "wrist", "ankle")

This distinction is critical for understanding how the anatomy system works and why the proposed clothing integration needs revision.

## Key Concepts

### Blueprint Slots

Blueprint slots are defined in anatomy blueprints and represent specific positions in a body structure:

```json
{
  "slots": {
    "left_hand": {
      "parent": "left_arm",
      "socket": "wrist",
      "requirements": {
        "partType": "hand"
      }
    },
    "right_hand": {
      "parent": "right_arm",
      "socket": "wrist",
      "requirements": {
        "partType": "hand"
      }
    }
  }
}
```

**Key Properties**:

- Have explicit orientation/position in their names ("left_hand", "right_arm")
- Define parent-child relationships
- Specify which socket on the parent to connect to
- Are unique within a blueprint

### Sockets

Sockets are attachment points defined on individual body parts:

```json
// humanoid_arm.entity.json
{
  "anatomy:sockets": {
    "sockets": [
      {
        "id": "wrist",
        "allowedTypes": ["hand"],
        "nameTpl": "{{parent.name}} {{type}}"
      }
    ]
  }
}
```

**Key Properties**:

- Are generic and reusable (both arms have a "wrist" socket)
- Do not encode orientation or position
- Define what types of parts can attach
- Are defined per body part type, not per instance

## The Current Problem

The proposed clothing system design incorrectly assumes that sockets have orientation-specific names:

```json
// INCORRECT - These socket names don't exist!
"hands": {
  "anatomySockets": ["left_hand", "right_hand"],
  ...
}
```

In reality:

- There is no "left_hand" socket or "right_hand" socket
- Hands don't have sockets at all (they are terminal parts)
- Arms have a generic "wrist" socket that hands attach to
- The "left" or "right" orientation comes from the blueprint slot hierarchy

## Examples from the Current System

### Torso (Mixed Approach)

The torso is unique in having orientation-specific sockets:

```json
// human_male_torso.entity.json
"sockets": [
  {"id": "left_shoulder", "orientation": "left", ...},
  {"id": "right_shoulder", "orientation": "right", ...},
  {"id": "left_hip", "orientation": "left", ...},
  {"id": "right_hip", "orientation": "right", ...}
]
```

### Extremities (Generic Sockets)

Arms and legs use generic sockets:

```json
// humanoid_arm.entity.json
"sockets": [
  {"id": "wrist", ...}  // No left/right distinction
]

// human_leg.entity.json
"sockets": [
  {"id": "ankle", ...}  // No left/right distinction
]
```

### Terminal Parts (No Sockets)

Hands and feet have no sockets:

```json
// human_hand.entity.json
// No sockets component at all

// human_foot.entity.json
// No sockets component at all
```

## How Orientation is Determined

The orientation of a body part is determined by its position in the blueprint hierarchy:

1. Blueprint defines "left_arm" slot on torso
2. Arm entity is attached to torso's "left_shoulder" socket
3. Hand is attached to arm's "wrist" socket via "left_hand" slot
4. The hand is "left" because it's attached via the "left_hand" slot, not because of socket names

## Implications for Clothing System

The clothing system must:

1. **Reference blueprint slots, not sockets** when defining coverage for oriented parts
2. **Use a runtime resolution system** to find actual sockets from slot references
3. **Handle both approaches**: Direct socket references (torso) and slot-based references (extremities)

## Correct Mapping Approach

Instead of:

```json
// INCORRECT
"anatomySockets": ["left_hand", "right_hand"]
```

Use:

```json
// CORRECT
"blueprintSlots": ["left_hand", "right_hand"]
```

Or for direct socket references (torso items):

```json
// CORRECT for torso
"anatomySockets": ["left_shoulder", "right_shoulder", "left_hip", "right_hip"]
```

## Runtime Resolution Process

When equipping clothing:

1. Look up the blueprint slot definitions
2. Find which entity instances occupy those slots
3. Trace the parent-child relationships to find actual sockets
4. Map clothing coverage to the resolved body parts

This approach maintains the flexibility of the anatomy system while providing the specificity needed for clothing.
