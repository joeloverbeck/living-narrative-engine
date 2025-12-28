# Anatomy-Driven Oxygen & Drowning System

## Executive Summary

This document analyzes the Living Narrative Engine's existing anatomy, damage, and event systems to design a data-driven, anatomically accurate oxygen tracking and drowning/asphyxiation system.

### Key Design Principles

1. **Anatomy-Driven**: Oxygen is stored in respiratory organs (lungs, gills), not as an actor-level abstraction
2. **Medically Accurate**: Death progression follows real physiology (hypoxia → unconsciousness → brain damage → death)
3. **Multi-Source**: System handles drowning, strangulation, smoke inhalation, and other oxygen-deprivation scenarios
4. **All Creatures**: Respiratory organs defined for all creature types with appropriate variations

### Proposed Solution Overview

Create a new `breathing` mod that:
- Adds respiratory organs (lungs, gills, etc.) to the anatomy system
- Implements oxygen depletion via turn-end rules when submerged or strangled
- Uses a staged progression from hypoxia to unconsciousness to brain damage to death
- Follows existing tick system patterns (like BleedingTickSystem)

---

## Current System Analysis

### 1. Anatomy System Overview

#### Vital Organs Architecture

The engine currently defines three vital organs:

| Organ | Entity ID | Max Health | Health Weight | Kill on Destroy |
|-------|-----------|------------|---------------|-----------------|
| Heart | `anatomy:human_heart` | 50 | 15 | Yes |
| Brain | `anatomy:human_brain` | 40 | 15 | Yes |
| Spine | `anatomy:human_spine` | 60 | 15 | Yes |

**Key Properties of `anatomy:vital_organ` Component:**
- `organType`: enum ["brain", "heart", "spine"]
- `killOnDestroy`: boolean (default: true) - entity dies when organ destroyed
- `healthCapThreshold`: percentage (0-100, default: 20) - when organ health drops below this, apply overall health cap
- `healthCapValue`: percentage (0-100, default: 30) - maximum overall health percentage when organ critically damaged

**Protection Pattern:** All vital organs have `hit_probability_weight: 0`, meaning they cannot be directly targeted in attacks. Damage reaches them only through propagation from parent parts.

#### Blueprint & Socket Structure

```
Torso (Root Entity)
├── heart_socket → Heart
├── spine_socket → Spine
├── head_socket → Head
│   └── brain_socket → Brain (nested under head)
├── arm_socket_left → Left Arm
├── arm_socket_right → Right Arm
├── leg_socket_left → Left Leg
└── leg_socket_right → Right Leg
```

**Key Files:**
- `data/mods/anatomy/blueprints/` - Blueprint definitions
- `data/mods/anatomy/slot-libraries/humanoid.slot-library.json` - Socket definitions
- `data/mods/anatomy/entities/definitions/` - Organ entity definitions

**Key Insight:** The system lacks respiratory organs. To implement anatomy-driven oxygen, we need to add lung entities with sockets.

#### Creature Blueprints

| Blueprint | Core Part | Notes |
|-----------|-----------|-------|
| `human_male.blueprint.json` | `humanoid_core` | Standard human anatomy |
| `human_female.blueprint.json` | `humanoid_core` | Standard human anatomy |
| `human_futa.blueprint.json` | `humanoid_core` | Standard human anatomy |
| `cat_girl_*.blueprint.json` | `feline_core` | Feline variations (ears, tail) |
| `toad_folk.blueprint.json` | `amphibian_core` | Amphibian variations |
| `red_dragon.blueprint.json` | `structure_winged_quadruped` | Dragon anatomy |
| `writhing_observer.blueprint.json` | `eldritch_core_mass` | Eldritch anatomy (40+ appendages) |

### 2. Damage System Patterns

#### Existing Status Effects

| Effect | Component | Duration | Tick-Based | Trigger |
|--------|-----------|----------|------------|---------|
| Bleeding | `anatomy:bleeding` | 2 turns | Yes | Damage with bleed enabled |
| Burning | `anatomy:burning` | 2 turns | Yes | Fire damage |
| Poisoned | `anatomy:poisoned` | 3 turns | Yes | Poison damage |
| Fractured | `anatomy:fractured` | N/A | No | Threshold-based (50%) |
| Dismembered | `anatomy:dismembered` | N/A | No | Threshold-based (80%) |

**Status Effect Registry:** `data/mods/anatomy/status-effects/status-effects.registry.json`

#### Tick Systems

The engine has established tick systems for damage-over-time effects:

1. **BleedingTickSystem** (`src/anatomy/services/bleedingTickSystem.js`)
   - Subscribes to turn events
   - Processes entities with `anatomy:bleeding` component
   - Applies tick damage each turn
   - Decrements duration counter

2. **BurningTickSystem** (`src/anatomy/services/burningTickSystem.js`)
   - Same pattern as bleeding
   - Handles burn damage per turn

3. **PoisonTickSystem** (`src/anatomy/services/poisonTickSystem.js`)
   - Same pattern
   - Handles poison damage per turn

**Key Pattern:** All tick systems follow the same architecture:
- Subscribe to `core:turn_ended` event
- Query entities with the relevant component
- Apply damage and decrement counters
- Remove component when effect ends
- Dispatch started/stopped events

#### Damage Type Schema

From `data/schemas/damage-capability-entry.schema.json`:

```json
{
  "name": "string",           // e.g., "blunt", "piercing", "slashing", "fire"
  "amount": "number",
  "penetration": "number",    // 0-1, weights internal damage
  "bleed": { "enabled", "severity", "baseDurationTurns" },
  "fracture": { "enabled", "thresholdFraction", "stunChance" },
  "burn": { "enabled", "dps", "durationTurns", "canStack" },
  "poison": { "enabled", "tickDamage", "durationTurns", "scope" },
  "dismember": { "enabled", "thresholdFraction" },
  "flags": ["string"]         // Custom extensibility
}
```

### 3. Event & Turn Mechanics

#### Turn Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `core:turn_started` | `entityId`, `entityType`, entity object | Signals turn beginning |
| `core:turn_ended` | `entityId`, `success`, optional `error` | Signals turn completion |

**Event Files:**
- `data/mods/core/events/turn_started.event.json`
- `data/mods/core/events/turn_ended.event.json`

#### Turn-End Hook Pattern

Rules can subscribe to `core:turn_ended` to execute logic at turn end:

```json
{
  "rule_id": "turn_ended",
  "event_type": "core:turn_ended",
  "actions": [
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_ref": "{event.payload.entityId}",
        "component_type": "core:current_actor"
      }
    }
  ]
}
```

#### Submerged Component

**File:** `data/mods/liquids-states/components/submerged.component.json`

```json
{
  "id": "liquids-states:submerged",
  "description": "Indicates the actor is submerged underwater (from failed swimming).",
  "dataSchema": {
    "properties": {
      "activityMetadata": {
        "shouldDescribeInActivity": true,
        "template": "{actor} is submerged",
        "priority": 75
      }
    }
  }
}
```

**Current Usage:** The component is a pure marker indicating submersion state. It does not currently trigger any oxygen depletion or damage mechanics.

---

## Design Decisions

### Decision 1: Anatomically Accurate Death Progression

**Medical Reality:**

The body's response to oxygen deprivation follows a precise progression:

| Time | Stage | Medical State | Game Representation |
|------|-------|---------------|---------------------|
| 0-30s | Initial | Breath-holding, no symptoms | Normal function, oxygen depleting |
| 30-60s | Hypoxia Onset | Increased heart rate, anxiety | Minor penalties, awareness |
| 1-2min | Moderate Hypoxia | Confusion, impaired judgment | Action penalties, disadvantage |
| 2-3min | Severe Hypoxia | Loss of consciousness | Unconscious state |
| 3-4min | Critical | Unconscious, brain damage begins | Organ damage starts |
| 4-6min | Fatal | Irreversible brain damage | Brain takes damage |
| 6min+ | Death | Cardiac arrest follows brain death | Death via vital organ destruction |

**Key Medical Facts:**
1. **Brain is first affected** - Most oxygen-dependent organ (uses 20% of body's oxygen)
2. **Heart stops AFTER brain** - Brain death causes cardiac arrest, not vice versa
3. **Lungs don't take damage** - They're not harmed by lack of oxygen, just empty
4. **Damage is cellular** - Neurons die from anoxia, not physical trauma
5. **Recovery possible** - If rescued before 4-6 minutes, brain damage may be reversible

**Game Progression Model:**

```
Phase 1: OXYGEN DEPLETION (Turns 1-2)
├── Respiratory organs deplete oxygen each turn
├── No damage yet, just resource depletion
└── Actor can still act normally

Phase 2: HYPOXIA (When oxygen reaches 0)
├── "hypoxic" status effect applied
├── Impaired actions (disadvantage/penalties)
├── Increased heart rate (flavor)
└── Still conscious and acting

Phase 3: SEVERE HYPOXIA (Hypoxic for N turns)
├── Confusion, impaired judgment
├── Higher action penalties
└── Risk of unconsciousness increases

Phase 4: UNCONSCIOUSNESS (Hypoxic threshold exceeded)
├── "unconscious_anoxia" status effect
├── Cannot act, helpless
└── Grace period for rescue

Phase 5: BRAIN DAMAGE (Unconscious for N turns)
├── Actual damage applied to brain organ
├── Each turn without oxygen = brain damage
└── If brain health reaches 0 → death (via killOnDestroy)

Phase 6: CARDIAC ARREST (After brain failure)
├── Heart stops as consequence of brain death
└── Death is confirmed
```

### Decision 2: New "breathing" Mod

**Rationale:**
- Strangulation isn't liquid-specific (shouldn't be in `liquids` mod)
- System applies to: drowning, strangulation, smoke inhalation, vacuum exposure
- Cleaner separation of concerns
- Dependencies: `core`, `anatomy`, `liquids-states`

### Decision 3: Respiratory Organs Store Oxygen

**Option A: Organ-Based Storage** ✓ Selected
- Oxygen capacity and current level stored in respiratory organ components
- Damage to lungs affects oxygen capacity
- Anatomically accurate
- Requires adding lung entities to blueprints

**Option B: Actor-Level Storage**
- Simple actor component tracks oxygen
- Easier implementation
- Not anatomy-driven
- Cannot model lung damage affecting breathing

**Rationale for Option A:** User explicitly requested "anatomy-driven" system. Lung damage should realistically affect breathing capacity.

### Decision 4: "Anoxic" Damage Type

Create a new damage type for cellular oxygen starvation:

```json
{
  "name": "anoxic",
  "amount": 5,
  "flags": ["bypasses_armor", "internal_only"],
  "target_organs": ["brain"]
}
```

**Properties:**
- Bypasses armor (cellular damage, not physical trauma)
- Targets brain only (medically accurate)
- Cannot be blocked or resisted
- Heart dies as a consequence of brain death, not independently

### Decision 5: Instant Oxygen Restoration

When actor is no longer submerged/strangled:
- Oxygen instantly restores to full
- Simplifies rescue mechanics
- Medically reasonable for short-term deprivation
- Hypoxic effects clear immediately upon breathing

### Decision 6: Strangulation Integration

Include strangulation from the start:
- `positioning:being_strangled` component (marker)
- Works identically to `submerged` for oxygen depletion
- Same rules trigger on either condition
- Future actions: `strangle`, `release_strangle`, `break_free_from_strangle`

---

## Proposed Architecture

### 1. Mod Structure

```
data/mods/breathing/
├── mod-manifest.json
├── components/
│   ├── respiratory_organ.component.json
│   ├── hypoxic.component.json
│   └── unconscious_anoxia.component.json
├── rules/
│   ├── handle_oxygen_depletion.rule.json
│   ├── handle_hypoxia_progression.rule.json
│   ├── handle_anoxic_damage.rule.json
│   └── handle_oxygen_restoration.rule.json
├── events/
│   ├── oxygen_depleted.event.json
│   ├── hypoxia_started.event.json
│   ├── hypoxia_stopped.event.json
│   ├── anoxic_unconsciousness_started.event.json
│   └── brain_damage_started.event.json
├── entities/
│   └── definitions/
│       ├── human_lung_left.entity.json
│       ├── human_lung_right.entity.json
│       ├── feline_lung_left.entity.json
│       ├── feline_lung_right.entity.json
│       ├── amphibian_lung.entity.json
│       ├── amphibian_skin_respiration.entity.json
│       ├── reptilian_lung_left.entity.json
│       ├── reptilian_lung_right.entity.json
│       └── eldritch_respiratory_mass.entity.json
└── slot-libraries/
    └── respiratory.slot-library.json
```

### 2. Component Definitions

#### respiratory_organ.component.json

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "breathing:respiratory_organ",
  "description": "Marks an anatomy part as a respiratory organ capable of storing and processing oxygen.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "respirationType": {
        "type": "string",
        "enum": ["pulmonary", "cutaneous", "branchial", "tracheal", "unusual"],
        "description": "Type of respiration: pulmonary (lungs), cutaneous (skin), branchial (gills), tracheal (insects), unusual (eldritch)"
      },
      "oxygenCapacity": {
        "type": "integer",
        "minimum": 1,
        "description": "Maximum oxygen units this organ can store"
      },
      "currentOxygen": {
        "type": "integer",
        "minimum": 0,
        "description": "Current oxygen units stored"
      },
      "depletionRate": {
        "type": "integer",
        "minimum": 1,
        "default": 1,
        "description": "Oxygen units depleted per turn when not breathing"
      },
      "restorationRate": {
        "type": "integer",
        "minimum": 1,
        "default": 10,
        "description": "Oxygen units restored per turn when breathing normally"
      },
      "environmentCompatibility": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["air", "water", "any"]
        },
        "default": ["air"],
        "description": "Environments where this organ can extract oxygen"
      }
    },
    "required": ["respirationType", "oxygenCapacity", "currentOxygen"]
  }
}
```

#### hypoxic.component.json

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "breathing:hypoxic",
  "description": "Status effect indicating oxygen deprivation with escalating severity.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "severity": {
        "type": "string",
        "enum": ["mild", "moderate", "severe"],
        "default": "mild"
      },
      "turnsInState": {
        "type": "integer",
        "minimum": 0,
        "default": 0,
        "description": "Number of turns in current hypoxic state"
      },
      "actionPenalty": {
        "type": "integer",
        "minimum": 0,
        "description": "Penalty applied to actions"
      },
      "activityMetadata": {
        "type": "object",
        "properties": {
          "shouldDescribeInActivity": { "type": "boolean", "default": true },
          "template": { "type": "string", "default": "{actor} is struggling to breathe" },
          "priority": { "type": "integer", "default": 80 }
        }
      }
    },
    "required": ["severity", "turnsInState"]
  }
}
```

#### unconscious_anoxia.component.json

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "breathing:unconscious_anoxia",
  "description": "Unconscious state specifically from oxygen deprivation. Distinct from other unconscious states.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "turnsUnconscious": {
        "type": "integer",
        "minimum": 0,
        "default": 0,
        "description": "Turns spent unconscious from anoxia"
      },
      "brainDamageStarted": {
        "type": "boolean",
        "default": false,
        "description": "Whether brain damage has begun"
      },
      "activityMetadata": {
        "type": "object",
        "properties": {
          "shouldDescribeInActivity": { "type": "boolean", "default": true },
          "template": { "type": "string", "default": "{actor} has lost consciousness from lack of oxygen" },
          "priority": { "type": "integer", "default": 95 }
        }
      }
    },
    "required": ["turnsUnconscious"]
  }
}
```

### 3. Entity Definitions

#### human_lung_left.entity.json

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "breathing:human_lung_left",
  "components": {
    "core:name": {
      "name": "left lung"
    },
    "core:weight": {
      "value": 0.6
    },
    "anatomy:part": {
      "subType": "lung",
      "orientation": "left",
      "hit_probability_weight": 0,
      "health_calculation_weight": 3
    },
    "anatomy:part_health": {
      "currentHealth": 30,
      "maxHealth": 30,
      "state": "healthy"
    },
    "breathing:respiratory_organ": {
      "respirationType": "pulmonary",
      "oxygenCapacity": 10,
      "currentOxygen": 10,
      "depletionRate": 1,
      "restorationRate": 10,
      "environmentCompatibility": ["air"]
    }
  }
}
```

### 4. Rules

#### handle_oxygen_depletion.rule.json

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "breathing:handle_oxygen_depletion",
  "description": "Depletes oxygen from respiratory organs when actor cannot breathe",
  "event_type": "core:turn_ended",
  "condition": {
    "or": [
      {
        "has_component": {
          "entity_ref": "{event.payload.entityId}",
          "component_type": "liquids-states:submerged"
        }
      },
      {
        "has_component": {
          "entity_ref": "{event.payload.entityId}",
          "component_type": "positioning:being_strangled"
        }
      }
    ]
  },
  "actions": [
    {
      "type": "DEPLETE_OXYGEN",
      "parameters": {
        "entityId": "{event.payload.entityId}",
        "amount": 1
      }
    }
  ]
}
```

#### handle_oxygen_restoration.rule.json

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "breathing:handle_oxygen_restoration",
  "description": "Instantly restores oxygen when actor can breathe normally",
  "event_type": "core:turn_ended",
  "condition": {
    "and": [
      {
        "not": {
          "has_component": {
            "entity_ref": "{event.payload.entityId}",
            "component_type": "liquids-states:submerged"
          }
        }
      },
      {
        "not": {
          "has_component": {
            "entity_ref": "{event.payload.entityId}",
            "component_type": "positioning:being_strangled"
          }
        }
      },
      {
        "has_respiratory_organs": {
          "entity_ref": "{event.payload.entityId}"
        }
      }
    ]
  },
  "actions": [
    {
      "type": "RESTORE_OXYGEN",
      "parameters": {
        "entityId": "{event.payload.entityId}",
        "restoreFull": true
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_ref": "{event.payload.entityId}",
        "component_type": "breathing:hypoxic"
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_ref": "{event.payload.entityId}",
        "component_type": "breathing:unconscious_anoxia"
      }
    }
  ]
}
```

### 5. Operation Handlers

#### DEPLETE_OXYGEN Operation

**File:** `src/logic/operationHandlers/depleteOxygenHandler.js`

```javascript
/**
 * @file Depletes oxygen from an entity's respiratory organs
 */

class DepleteOxygenHandler extends BaseOperationHandler {
  async execute(context) {
    const { entityId, amount } = context.parameters;

    // 1. Find all respiratory organs for the entity
    const respiratoryOrgans = await this.#findRespiratoryOrgans(entityId);

    // 2. Deplete oxygen from each organ
    let totalOxygenRemaining = 0;
    for (const organ of respiratoryOrgans) {
      const component = organ.getComponent('breathing:respiratory_organ');
      const newOxygen = Math.max(0, component.currentOxygen - amount);
      component.currentOxygen = newOxygen;
      totalOxygenRemaining += newOxygen;
    }

    // 3. Check if oxygen is depleted
    if (totalOxygenRemaining === 0) {
      await this.#dispatchOxygenDepletedEvent(entityId);
      await this.#applyOrEscalateHypoxia(entityId);
    }

    return { success: true, totalOxygenRemaining };
  }
}
```

#### RESTORE_OXYGEN Operation

**File:** `src/logic/operationHandlers/restoreOxygenHandler.js`

```javascript
/**
 * @file Restores oxygen to an entity's respiratory organs
 */

class RestoreOxygenHandler extends BaseOperationHandler {
  async execute(context) {
    const { entityId, restoreFull, amount } = context.parameters;

    // 1. Find all respiratory organs for the entity
    const respiratoryOrgans = await this.#findRespiratoryOrgans(entityId);

    // 2. Restore oxygen to each organ
    for (const organ of respiratoryOrgans) {
      const component = organ.getComponent('breathing:respiratory_organ');
      if (restoreFull) {
        component.currentOxygen = component.oxygenCapacity;
      } else {
        component.currentOxygen = Math.min(
          component.oxygenCapacity,
          component.currentOxygen + amount
        );
      }
    }

    // 3. Dispatch restoration event
    await this.#dispatchOxygenRestoredEvent(entityId);

    return { success: true };
  }
}
```

### 6. HypoxiaTickSystem

**File:** `src/breathing/services/hypoxiaTickSystem.js`

```javascript
/**
 * @file Processes hypoxic entities each turn, escalating severity and applying damage
 */

class HypoxiaTickSystem {
  constructor({ entityManager, eventBus, logger }) {
    this.#entityManager = entityManager;
    this.#eventBus = eventBus;
    this.#logger = logger;

    // Subscribe to turn end events
    this.#eventBus.subscribe('core:turn_ended', this.#processTurnEnd.bind(this));
  }

  async #processTurnEnd(event) {
    const entityId = event.payload.entityId;
    const entity = this.#entityManager.getEntity(entityId);

    if (!entity.hasComponent('breathing:hypoxic')) {
      return;
    }

    const hypoxicComponent = entity.getComponent('breathing:hypoxic');
    hypoxicComponent.turnsInState++;

    // Escalate severity based on turns
    if (hypoxicComponent.turnsInState >= 3 && hypoxicComponent.severity === 'mild') {
      hypoxicComponent.severity = 'moderate';
      hypoxicComponent.actionPenalty = 2;
    } else if (hypoxicComponent.turnsInState >= 5 && hypoxicComponent.severity === 'moderate') {
      hypoxicComponent.severity = 'severe';
      hypoxicComponent.actionPenalty = 4;
    }

    // Check for unconsciousness
    if (hypoxicComponent.turnsInState >= 7) {
      await this.#applyUnconscious(entityId);
    }

    // If already unconscious, check for brain damage
    if (entity.hasComponent('breathing:unconscious_anoxia')) {
      const unconsciousComponent = entity.getComponent('breathing:unconscious_anoxia');
      unconsciousComponent.turnsUnconscious++;

      if (unconsciousComponent.turnsUnconscious >= 2) {
        await this.#applyBrainDamage(entityId);
      }
    }
  }

  async #applyBrainDamage(entityId) {
    // Find brain organ and apply anoxic damage
    const brain = await this.#findBrainOrgan(entityId);
    if (brain) {
      await this.#eventBus.dispatch({
        type: 'APPLY_DAMAGE',
        payload: {
          targetEntityId: brain.id,
          damage_entry: {
            name: 'anoxic',
            amount: 5,
            flags: ['bypasses_armor', 'internal_only']
          }
        }
      });
    }
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation (Mod Structure & Components)

**Files to Create:**
- `data/mods/breathing/mod-manifest.json`
- `data/mods/breathing/components/respiratory_organ.component.json`
- `data/mods/breathing/components/hypoxic.component.json`
- `data/mods/breathing/components/unconscious_anoxia.component.json`

**Files to Modify:**
- `data/game.json` - Add breathing mod to load order

### Phase 2: Anatomy Extensions (Lung Entities)

**Files to Create:**
- `data/mods/breathing/entities/definitions/human_lung_left.entity.json`
- `data/mods/breathing/entities/definitions/human_lung_right.entity.json`
- `data/mods/breathing/entities/definitions/feline_lung_left.entity.json`
- `data/mods/breathing/entities/definitions/feline_lung_right.entity.json`
- `data/mods/breathing/entities/definitions/amphibian_lung.entity.json`
- `data/mods/breathing/entities/definitions/amphibian_skin_respiration.entity.json`
- `data/mods/breathing/entities/definitions/reptilian_lung_left.entity.json`
- `data/mods/breathing/entities/definitions/reptilian_lung_right.entity.json`
- `data/mods/breathing/entities/definitions/eldritch_respiratory_mass.entity.json`
- `data/mods/breathing/slot-libraries/respiratory.slot-library.json`

**Files to Modify:**
- `data/mods/anatomy/slot-libraries/humanoid.slot-library.json` - Add lung slots
- `data/mods/anatomy/blueprint-parts/humanoid_core.part.json` - Add lung slot definitions
- `data/mods/anatomy-creatures/slot-libraries/*.slot-library.json` - Add creature-specific lung slots
- All blueprint files - Add lung slot references
- All recipe files - Add lung preferences

### Phase 3: Operations & Handlers

**Files to Create:**
- `src/logic/operationHandlers/depleteOxygenHandler.js`
- `src/logic/operationHandlers/restoreOxygenHandler.js`
- `data/schemas/operations/deplete-oxygen.schema.json`
- `data/schemas/operations/restore-oxygen.schema.json`

**Files to Modify:**
- `data/schemas/operation.schema.json` - Add new operation references
- `src/dependencyInjection/tokens/tokens-core.js` - Add handler tokens
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` - Register handlers
- `src/dependencyInjection/registrations/interpreterRegistrations.js` - Map operations
- `src/utils/preValidationUtils.js` - Add to KNOWN_OPERATION_TYPES

### Phase 4: Events & Rules

**Files to Create:**
- `data/mods/breathing/events/oxygen_depleted.event.json`
- `data/mods/breathing/events/hypoxia_started.event.json`
- `data/mods/breathing/events/hypoxia_stopped.event.json`
- `data/mods/breathing/events/anoxic_unconsciousness_started.event.json`
- `data/mods/breathing/events/brain_damage_started.event.json`
- `data/mods/breathing/rules/handle_oxygen_depletion.rule.json`
- `data/mods/breathing/rules/handle_hypoxia_progression.rule.json`
- `data/mods/breathing/rules/handle_anoxic_damage.rule.json`
- `data/mods/breathing/rules/handle_oxygen_restoration.rule.json`

### Phase 5: Tick System

**Files to Create:**
- `src/breathing/services/hypoxiaTickSystem.js`
- `src/breathing/index.js` (module exports)

**Files to Modify:**
- `src/dependencyInjection/registrations/systemRegistrations.js` - Register HypoxiaTickSystem

### Phase 6: Damage Type Integration

**Files to Modify:**
- `data/schemas/damage-capability-entry.schema.json` - Add anoxic damage type
- `data/mods/anatomy/status-effects/status-effects.registry.json` - Add hypoxia effect

### Phase 7: Strangulation Integration

**Files to Create:**
- `data/mods/positioning/components/being_strangled.component.json`
- `data/mods/positioning/actions/strangle.action.json`
- `data/mods/positioning/actions/release_strangle.action.json`
- `data/mods/positioning/actions/break_free_from_strangle.action.json`
- `data/mods/positioning/rules/handle_strangle.rule.json`
- `data/mods/positioning/rules/handle_release_strangle.rule.json`
- `data/mods/positioning/rules/handle_break_free_from_strangle.rule.json`

---

## Open Questions for Future Consideration

### 1. Water-Breathing Creatures

How should gills work for aquatic creatures?
- Inverted oxygen logic (suffocate in air, breathe in water)?
- Separate `water_oxygen` resource?
- `environmentCompatibility` property seems sufficient

### 2. Partial Lung Damage

Should damaged lungs reduce oxygen capacity?
- Currently lungs have health but no capacity linkage
- Could add formula: `effectiveCapacity = oxygenCapacity * (currentHealth / maxHealth)`

### 3. Constitution-Based Breath Holding

Should some characters hold breath longer?
- Could add `breathHoldingBonus` attribute
- Multiplies base oxygen capacity
- Athletic/trained characters survive longer

### 4. Smoke Inhalation

How should smoke differ from drowning?
- Gradual lung damage from toxins?
- Different depletion rate?
- Could add `breathing:smoke_inhalation` component

### 5. Resurrection & Brain Damage

If resurrected after brain damage:
- Should brain damage persist?
- Partial memory loss?
- Reduced cognitive abilities?

### 6. CPR/Resuscitation Actions

Should there be rescue actions?
- `perform_cpr` to restore oxygen to unconscious victim
- `mouth_to_mouth` for drowning victims
- Requires: not submerged, adjacent, skill check

### 7. Underwater Combat

How does combat work while drowning?
- Severe penalties while hypoxic
- Impossible while unconscious
- Special underwater actions?

---

## Summary

This brainstorming document outlines a comprehensive, medically accurate, anatomy-driven oxygen and drowning system for the Living Narrative Engine. The key innovations are:

1. **Anatomical Foundation**: Oxygen stored in respiratory organs (lungs, gills) rather than as an abstract actor property
2. **Medical Accuracy**: Death progression follows real physiology with hypoxia leading to brain damage leading to death
3. **Unified System**: Same mechanics handle drowning, strangulation, and other asphyxiation scenarios
4. **Creature Diversity**: All creature types receive appropriate respiratory organs
5. **Integration Pattern**: Follows existing tick system patterns for consistency

The system leverages the engine's existing architecture (ECS, events, rules, damage system) while adding the specific components needed for oxygen tracking and asphyxiation mechanics.
