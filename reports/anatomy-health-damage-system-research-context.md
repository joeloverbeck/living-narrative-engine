# Anatomy-Based Health and Damage System: Research Context

## Executive Summary

This document provides context for researching and designing a health and damage system for the Living Narrative Engine, a browser-based narrative game platform. The system should leverage the existing **anatomy graph architecture** where each character's body is represented as a directed acyclic graph (DAG) of individual body parts.

**Research Objective**: Design an anatomy-aware health and damage system where damage is applied to specific body parts (e.g., torso, arm, heart), with appropriate cascading effects, injury states, and death conditions.

**Key Constraint**: The system must integrate with the existing architecture—an Entity Component System (ECS), event-driven communication, and a "modding-first" philosophy where all game mechanics are defined in data files.

---

## Part 1: Anatomy Graph Architecture

### Graph Structure

The anatomy system represents each character's body as a **Directed Acyclic Graph (DAG)**:

- **Nodes**: Each body part is a separate entity with a unique runtime ID
- **Edges**: Parent-child relationships established through "sockets" (attachment points)
- **Root**: Every anatomy graph has a single root node (typically the torso)
- **Leaves**: Terminal nodes with no children (hands, feet, eyes, etc.)

### How Parts Connect

Each body part can define **sockets**—named attachment points where child parts connect. A socket specifies:

- A unique identifier (e.g., `left_arm_socket`, `head_socket`)
- Orientation (left, right, mid, anterior, posterior, etc.)
- Allowed part types (what can attach there)

When anatomy is generated, child parts attach to parent sockets, creating the graph hierarchy.

### Example: Human Body Hierarchy

```
                          TORSO (root)
                             │
        ┌────────┬───────────┼───────────┬────────┐
        │        │           │           │        │
      HEAD    L_ARM       R_ARM       L_LEG    R_LEG
        │        │           │           │        │
     ┌──┴──┐   L_HAND     R_HAND     L_FOOT   R_FOOT
   L_EYE R_EYE

   Internal organs (also attached to torso):
   HEART, LUNGS, STOMACH, LIVER, INTESTINES
```

Each node in this tree is a **separate entity** with its own components and data.

### Graph Traversal Capabilities

The system provides these navigation patterns:

1. **Get Subgraph**: From any part, retrieve all descendant parts (e.g., from "arm" get "hand" and all fingers)
2. **Find by Type**: Find all parts of a specific type across the body (e.g., all "hand" parts)
3. **Get Path**: Find the path between two parts via their common ancestor
4. **Get Root**: From any part, traverse upward to find the body root
5. **Get All Parts**: Retrieve complete inventory of all body parts

### Non-Human Anatomies

The system supports diverse body plans:

| Blueprint  | Structure                                 |
| ---------- | ----------------------------------------- |
| Human      | Standard bipedal, two arms, two legs      |
| Centaur    | Human upper body + four-legged lower body |
| Spider     | Eight-legged arachnid body                |
| Kraken     | Central body with multiple tentacles      |
| Dragon     | Quadruped with wings and tail             |
| Cat-person | Humanoid with tail and cat features       |

Each blueprint defines which parts exist and how they connect.

---

## Part 2: Body Part Types

The system defines 120+ body part types across several categories:

### External Parts (Surface)

- **Head region**: head, face, skull, jaw, ear, nose, cheek
- **Upper body**: torso, chest, back, shoulder, arm, forearm, hand, finger
- **Lower body**: hip, leg, thigh, calf, foot, toe
- **Features**: tail, wing, horn, antenna, tentacle

### Internal Parts (Organs)

- **Vital organs**: heart, brain, lungs
- **Digestive**: stomach, liver, intestines
- **Other**: kidneys, bladder, spleen

### Sensory Parts

- **Vision**: eye, eyelid
- **Hearing**: ear, inner_ear
- **Other**: nose (smell), tongue (taste)

### Part Attributes

Each part has:

- **subType**: The anatomical type (e.g., "arm", "heart", "eye")
- **orientation**: Position variant (e.g., "left", "right", "mid", "anterior")

This allows distinguishing "left arm" from "right arm" while sharing the same type logic.

---

## Part 3: Entity Component System (ECS)

### Conceptual Model

The engine uses an Entity Component System architecture:

```
ENTITY (unique ID)
   └── COMPONENT A (data)
   └── COMPONENT B (data)
   └── COMPONENT C (data)
```

- **Entities**: Simple identifiers that group components together
- **Components**: Data containers defining properties (no behavior)
- **Systems**: Rules and handlers that process entities based on their components

### Anatomy Components

Body parts use these existing components:

| Component          | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `anatomy:part`     | Marks entity as body part, defines `subType` and `orientation` |
| `anatomy:joint`    | Links to parent part via `parentId` and `socketId`             |
| `anatomy:sockets`  | Defines attachment points for child parts                      |
| `anatomy:body`     | Root-level container referencing the recipe and all parts      |
| `anatomy:can_grab` | Marks parts capable of grasping (hands, tentacles)             |

### Adding New Components

To add health tracking to body parts, a new component would be defined with:

- A unique ID (e.g., `health:body_part_health`)
- A data schema specifying the component's properties
- Registration in the mod system

Example conceptual structure for a health component:

```
health:body_part_health
  ├── currentHealth: number
  ├── maxHealth: number
  ├── injuryState: string (healthy, wounded, disabled, destroyed)
  └── wounds: array of wound objects
```

This component would be added to body part entity definitions.

---

## Part 4: Combat System Entry Point

### Current Combat Flow

The existing combat system determines **outcome** (hit or miss) but applies **no actual damage**:

```
1. Player selects "Swing sword at target"
2. System triggers ATTEMPT_ACTION event
3. Rule matches the action and executes:
   a. Resolve skill contest (attacker vs defender)
   b. Determine outcome: SUCCESS, FAILURE, CRITICAL_SUCCESS, or FUMBLE
   c. Dispatch narrative event ("Bertram cuts Melissa's flesh")
   d. End turn
4. Target is narratively "cut" but mechanically unharmed
```

### Outcome Resolution

The skill contest produces:

- **CRITICAL_SUCCESS**: Exceptional hit (roll < 5% of threshold)
- **SUCCESS**: Normal hit (roll < threshold)
- **FAILURE**: Miss (roll > threshold)
- **FUMBLE**: Critical miss (roll > 95% of threshold)

The probability is calculated from attacker's `melee_skill` vs defender's `defense_skill`.

### Integration Point for Damage

The damage system would integrate **after SUCCESS/CRITICAL_SUCCESS outcomes**:

```
Current:
  SUCCESS → Dispatch narrative → End turn

With damage system:
  SUCCESS → APPLY DAMAGE → Check death/injury → Dispatch narrative → End turn
```

The rule structure supports inserting new operations between outcome resolution and turn end.

### Rule-Based Architecture

Combat actions are defined in JSON rule files:

- **Condition**: When does this rule trigger? (specific action attempted)
- **Operations**: What steps to execute? (get names, resolve outcome, branch on result)
- **Branching**: IF/THEN/ELSE based on outcome values

A damage operation would be added to the SUCCESS branch.

---

## Part 5: Current System Gaps

### What Exists

- Anatomy graph with individual body parts as entities
- Combat outcome resolution (hit/miss/critical)
- Skill-based probability calculations
- Narrative event dispatch system
- Component system for adding data to entities

### What's Missing

| Gap                    | Description                                |
| ---------------------- | ------------------------------------------ |
| **Health tracking**    | No component to store health on body parts |
| **Damage values**      | Weapons have no damage statistics          |
| **Armor/protection**   | No damage reduction from equipment         |
| **Damage calculation** | No logic to compute damage from hits       |
| **Injury states**      | No wounded, disabled, or destroyed states  |
| **Death condition**    | No logic for character death               |
| **Cascading effects**  | No propagation of effects through anatomy  |

### Damage Type System (Partial)

The system has **marker components** for damage types:

- `damage-types:can_cut` (slashing weapons)
- `damage-types:can_pierce` (implied, for thrusting)
- `damage-types:can_bludgeon` (implied, for blunt)

These are empty markers with no damage values—they indicate capability, not magnitude.

---

## Part 6: Architectural Constraints

### Event-Driven Communication

All significant changes must dispatch events:

- Components changing → `COMPONENT_ADDED`, `COMPONENT_REMOVED` events
- Actions completing → `PERCEPTIBLE_EVENT` for narrative
- State changes → Domain-specific events

A damage system should dispatch events like:

- `DAMAGE_APPLIED` (entity took damage to specific part)
- `INJURY_STATE_CHANGED` (part became wounded/disabled)
- `CHARACTER_DIED` (vital damage caused death)

### Modding-First Philosophy

**All game content exists as mods**—even core mechanics. This means:

- Health components defined in mod JSON files
- Damage rules defined in mod JSON files
- No hardcoded game logic in source code
- Extension through data files, not code changes

### Validation Requirements

All data must validate against JSON Schemas:

- Components have schema-validated data
- Rules have schema-validated operations
- Invalid data is rejected at load time

New health/damage components need corresponding schemas.

### Immutable Definitions, Mutable Instances

- **Entity Definitions**: Frozen templates (shared baseline)
- **Entity Instances**: Mutable runtime state (current values)

Health would be mutable instance data, while max health might come from definitions.

---

## Part 7: Research Questions

### Health Distribution

1. **Where does health live?**
   - On individual body parts only?
   - Also on the character as a whole (aggregate)?
   - Both (part HP + total HP)?

2. **How much health per part?**
   - Uniform (all parts equal)?
   - By part type (head = 20, arm = 15, finger = 5)?
   - By part importance (vital organs vs extremities)?

### Damage Propagation

3. **Should damage cascade?**
   - Damage to arm affects hand below it?
   - Internal organ damage affects the whole body?
   - Destroyed part disables all children?

4. **Parent-child damage relationships?**
   - Child destruction → parent damage?
   - Parent destruction → children destroyed?
   - Independent tracking?

### Targeting

5. **How are body parts targeted?**
   - Random weighted selection?
   - Attacker chooses (called shots)?
   - Based on attack type (slash = arms/torso, thrust = torso)?
   - Coverage by armor/clothing affects targeting?

6. **Critical hits and targeting?**
   - Critical success → vital organ hit?
   - Critical success → player chooses target?
   - Critical success → bonus damage to rolled target?

### Injury States

7. **What injury states exist?**
   - Binary (healthy/destroyed)?
   - Graduated (healthy → wounded → disabled → destroyed)?
   - Continuous (percentage-based)?

8. **What do injury states mean?**
   - Wounded: Reduced effectiveness?
   - Disabled: Cannot use that part?
   - Destroyed: Permanent loss?

### Death Conditions

9. **What causes death?**
   - Total HP reaches zero?
   - Vital organ destroyed (heart, brain)?
   - Torso (root) destroyed?
   - Accumulated injury threshold?

10. **Is death instant or gradual?**
    - Instant when condition met?
    - Dying state with time limit?
    - Bleeding out over turns?

### Armor Integration

11. **How does armor interact?**
    - Reduces damage to covered parts?
    - Has its own HP (degrades)?
    - Coverage by slots (head armor protects head)?
    - Layering (multiple armor pieces stack)?

### Non-Human Considerations

12. **How to handle different anatomies?**
    - Krakens with many tentacles?
    - Dragons with wings as targets?
    - Creatures without vital organs?
    - Regenerating body parts?

---

## Part 8: Design Space Summary

### Minimum Viable System

At minimum, the system needs:

1. **Health component** on body parts (current/max HP)
2. **Damage operation** triggered on combat success
3. **Target selection** logic (which part gets hit)
4. **Death check** after damage (some termination condition)

### Enhanced System Considerations

A fuller system might include:

- Multiple damage types (cut, pierce, bludgeon, fire, etc.)
- Armor with coverage and resistance values
- Injury states with gameplay effects
- Cascading damage through anatomy graph
- Healing and recovery mechanics
- Wound tracking for narrative detail

### Architecture Alignment

The design should:

- Use existing component patterns (data in components, behavior in rules)
- Dispatch appropriate events for each state change
- Support diverse anatomies without hardcoding
- Allow modders to customize health values and rules
- Integrate cleanly with existing combat outcome flow

---

## Appendix: Body Part Type Reference

### Complete Type List (Abbreviated)

**External**: head, face, skull, neck, torso, chest, back, shoulder, upper_arm, forearm, elbow, wrist, hand, palm, finger, thumb, hip, thigh, knee, calf, ankle, foot, heel, toe, tail, wing, horn, antenna, tentacle, claw, hoof, paw

**Internal**: brain, heart, lungs, stomach, liver, kidneys, intestines, bladder, spleen, pancreas

**Sensory**: eye, eyelid, ear, inner_ear, nose, nostril, tongue, lip

**Reproductive**: (varies by blueprint, anatomically appropriate)

**Special**: gills (aquatic), poison_gland (venomous creatures), flame_sac (dragons)

---

_This document provides context for external research. The goal is to receive recommendations on the best architecture for an anatomy-aware health and damage system that integrates with the described constraints._
