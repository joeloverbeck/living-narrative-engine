# Hunger and Metabolism System Specification

## Document Information

**Version:** 1.0.0
**Status:** Design Specification
**Last Updated:** 2025-11-20
**Author:** System Architect
**Dependencies:** `anatomy` mod (v1.0.0+)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Goals](#architecture-goals)
3. [Component Definitions](#component-definitions)
4. [Operation Handlers](#operation-handlers)
5. [Mod Structure](#mod-structure)
6. [Turn System Integration](#turn-system-integration)
7. [Action Integration](#action-integration)
8. [GOAP Integration](#goap-integration)
9. [Threshold System](#threshold-system)
10. [Digestion Buffer Mechanics](#digestion-buffer-mechanics)
11. [Food Properties System](#food-properties-system)
12. [Entity Type Abstraction](#entity-type-abstraction)
13. [Data Schemas](#data-schemas)
14. [Testing Strategy](#testing-strategy)
15. [Implementation Phases](#implementation-phases)
16. [Edge Cases](#edge-cases)
17. [Future Extensions](#future-extensions)

---

## System Overview

### Purpose

The hunger and metabolism system transforms food consumption from an instant-gratification mechanic into a strategic resource management system that models realistic digestion, energy conversion, and metabolic processes. This system supports the immersive sim philosophy by making food a strategic consideration rather than a trivial mechanic.

### Key Features

- **Digestion Buffer System**: Food enters stomach before converting to energy
- **Dual-Value Food**: Volume (satiety) vs. Calories (energy)
- **Threshold-Based States**: Hidden numerical values with emergent gameplay states
- **Generic Fuel Abstraction**: Supports humans, vampires, robots, etc.
- **GOAP-Safe Design**: Prevents AI overeating through predicted energy calculation
- **Anatomy Integration**: Visual consequences of starvation through body composition
- **Turn-Based Processing**: Automatic energy burn and digestion each turn

### Design Philosophy

1. **Data-Driven**: All mechanics defined through mod files, not hardcoded
2. **Modular**: Components can be mixed and matched (human stomach, vampire stomach, etc.)
3. **Extensible**: Easy to add new fuel types, converters, and metabolic effects
4. **Immersive**: Realistic consequences that create strategic depth
5. **ECS-First**: Built entirely on the Entity Component System architecture

---

## Architecture Goals

### Primary Goals

1. **Eliminate Instant Healing**: Food must be digested before providing energy
2. **Strategic Resource Management**: Players plan meals before encounters
3. **Prevent AI Exploitation**: GOAP planners consider buffered energy, not just current
4. **Support Non-Organic Entities**: Abstract fuel system works for robots, vampires, etc.
5. **Visual Feedback**: Body composition changes reflect long-term starvation
6. **Performance Efficient**: Turn-based calculations scale to many entities

### Integration Points

```
Anatomy Mod
    ↓ (body parts can have fuel converters)
Metabolism Mod
    ↓ (energy costs on actions)
Movement/Exercise/Combat Mods
    ↓ (hunger goals and preconditions)
GOAP System
```

### Data Flow

```
Food Item (FuelSource)
    ↓ CONSUME_ITEM operation
Stomach Buffer (FuelConverter.buffer_storage)
    ↓ DIGEST_FOOD operation (per turn)
Energy Reserve (MetabolicStore.current_energy)
    ↓ BURN_ENERGY operation (per turn + per action)
Hunger State (updated via thresholds)
    ↓ UPDATE_BODY_COMPOSITION (if starving)
Body Descriptor Changes (visual feedback)
```

---

## Component Definitions

### 1. `metabolism:fuel_converter`

**Purpose:** Represents a digestive organ (stomach, fuel tank, etc.) that converts consumed items into usable energy over time.

**File:** `data/mods/metabolism/components/fuel_converter.component.json`

**Schema:**

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "metabolism:fuel_converter",
  "description": "Digestive organ that converts fuel sources into energy over time",
  "dataSchema": {
    "type": "object",
    "properties": {
      "capacity": {
        "type": "number",
        "description": "Maximum stomach content (0-100 scale)",
        "minimum": 0,
        "default": 100
      },
      "buffer_storage": {
        "type": "number",
        "description": "Current content in stomach waiting to be digested",
        "minimum": 0,
        "default": 0
      },
      "conversion_rate": {
        "type": "number",
        "description": "Points of buffer converted to energy per turn",
        "minimum": 0,
        "default": 5
      },
      "efficiency": {
        "type": "number",
        "description": "Percentage of fuel converted (0.0-1.0)",
        "minimum": 0,
        "maximum": 1,
        "default": 0.8
      },
      "accepted_fuel_tags": {
        "type": "array",
        "description": "Tags of fuel types this converter can process",
        "items": { "type": "string" },
        "default": ["organic"]
      },
      "activity_multiplier": {
        "type": "number",
        "description": "Conversion rate multiplier based on activity (1.0 = normal)",
        "minimum": 0,
        "default": 1.0
      }
    },
    "required": ["capacity", "buffer_storage", "conversion_rate", "efficiency", "accepted_fuel_tags"]
  }
}
```

**Usage Example:**

```json
{
  "metabolism:fuel_converter": {
    "capacity": 100,
    "buffer_storage": 40,
    "conversion_rate": 5,
    "efficiency": 0.8,
    "accepted_fuel_tags": ["organic", "cooked"],
    "activity_multiplier": 1.0
  }
}
```

---

### 2. `metabolism:fuel_source`

**Purpose:** Defines consumable items (food, drinks, fuel) with energy and volume properties.

**File:** `data/mods/metabolism/components/fuel_source.component.json`

**Schema:**

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "metabolism:fuel_source",
  "description": "Consumable item that provides energy and volume",
  "dataSchema": {
    "type": "object",
    "properties": {
      "energy_density": {
        "type": "number",
        "description": "Total calories/energy provided by this item",
        "minimum": 0
      },
      "bulk": {
        "type": "number",
        "description": "Volume/space this item takes in stomach (0-100 scale)",
        "minimum": 0,
        "maximum": 100
      },
      "fuel_tags": {
        "type": "array",
        "description": "Tags indicating fuel type (organic, blood, electricity, etc.)",
        "items": { "type": "string" }
      },
      "digestion_speed": {
        "type": "string",
        "enum": ["instant", "fast", "medium", "slow"],
        "description": "How quickly this fuel is processed",
        "default": "medium"
      },
      "spoilage_rate": {
        "type": "number",
        "description": "Turns until item spoils (0 = never spoils)",
        "minimum": 0,
        "default": 0
      }
    },
    "required": ["energy_density", "bulk", "fuel_tags"]
  }
}
```

**Usage Examples:**

```json
// Steak: High calories, medium volume, slow digestion
{
  "metabolism:fuel_source": {
    "energy_density": 300,
    "bulk": 40,
    "fuel_tags": ["organic", "meat", "cooked"],
    "digestion_speed": "slow",
    "spoilage_rate": 20
  }
}

// Raw spinach: Low calories, high volume, fast digestion
{
  "metabolism:fuel_source": {
    "energy_density": 50,
    "bulk": 60,
    "fuel_tags": ["organic", "vegetable", "raw"],
    "digestion_speed": "fast",
    "spoilage_rate": 10
  }
}

// Energy bar: High calories, low volume, medium digestion
{
  "metabolism:fuel_source": {
    "energy_density": 250,
    "bulk": 15,
    "fuel_tags": ["organic", "processed"],
    "digestion_speed": "medium",
    "spoilage_rate": 0
  }
}
```

---

### 3. `metabolism:metabolic_store`

**Purpose:** Tracks an actor's energy reserves, burn rate, and metabolic state.

**File:** `data/mods/metabolism/components/metabolic_store.component.json`

**Schema:**

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "metabolism:metabolic_store",
  "description": "Entity's energy reserves and metabolic parameters",
  "dataSchema": {
    "type": "object",
    "properties": {
      "current_energy": {
        "type": "number",
        "description": "Current energy level",
        "minimum": 0
      },
      "max_energy": {
        "type": "number",
        "description": "Maximum energy capacity",
        "minimum": 0
      },
      "base_burn_rate": {
        "type": "number",
        "description": "Resting energy expenditure per turn",
        "minimum": 0,
        "default": 1.0
      },
      "activity_multiplier": {
        "type": "number",
        "description": "Current activity's energy cost multiplier",
        "minimum": 0,
        "default": 1.0
      },
      "last_update_turn": {
        "type": "number",
        "description": "Turn number of last energy update",
        "minimum": 0,
        "default": 0
      }
    },
    "required": ["current_energy", "max_energy", "base_burn_rate"]
  }
}
```

**Usage Example:**

```json
{
  "metabolism:metabolic_store": {
    "current_energy": 800,
    "max_energy": 1000,
    "base_burn_rate": 1.0,
    "activity_multiplier": 1.0,
    "last_update_turn": 42
  }
}
```

---

### 4. `metabolism:hunger_state`

**Purpose:** Defines threshold-based hunger states and their gameplay effects.

**File:** `data/mods/metabolism/components/hunger_state.component.json`

**Schema:**

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "metabolism:hunger_state",
  "description": "Threshold-based hunger states with gameplay effects",
  "dataSchema": {
    "type": "object",
    "properties": {
      "state": {
        "type": "string",
        "enum": ["gluttonous", "satiated", "neutral", "hungry", "starving", "critical"],
        "description": "Current hunger state based on energy percentage"
      },
      "energy_percentage": {
        "type": "number",
        "description": "Current energy as percentage of max (0-100+)",
        "minimum": 0
      },
      "turns_in_state": {
        "type": "number",
        "description": "Consecutive turns in current state",
        "minimum": 0,
        "default": 0
      },
      "starvation_damage": {
        "type": "number",
        "description": "Cumulative health damage from starvation",
        "minimum": 0,
        "default": 0
      }
    },
    "required": ["state", "energy_percentage"]
  }
}
```

**Usage Example:**

```json
{
  "metabolism:hunger_state": {
    "state": "hungry",
    "energy_percentage": 25.5,
    "turns_in_state": 15,
    "starvation_damage": 0
  }
}
```

---

## Operation Handlers

### 1. BURN_ENERGY Operation

**Purpose:** Calculates and subtracts energy based on base burn rate and activity multiplier.

**File:** `src/logic/operationHandlers/burnEnergyHandler.js`

**Operation Schema:** `data/schemas/operations/burnEnergy.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "BURN_ENERGY Operation",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "BURN_ENERGY" },
        "parameters": { "$ref": "#/$defs/Parameters" }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "type": "object",
      "properties": {
        "entity_ref": {
          "$ref": "../common.schema.json#/definitions/entityReference",
          "description": "Entity with metabolic_store component"
        },
        "activity_multiplier": {
          "type": "number",
          "description": "Multiplier for burn rate (1.0 = resting, 2.0 = running, etc.)",
          "minimum": 0,
          "default": 1.0
        },
        "turns": {
          "type": "number",
          "description": "Number of turns to calculate burn for",
          "minimum": 1,
          "default": 1
        }
      },
      "required": ["entity_ref"]
    }
  }
}
```

**Calculation:**

```
energy_burned = base_burn_rate × activity_multiplier × turns
new_energy = max(0, current_energy - energy_burned)
```

**Handler Implementation Pattern:**

```javascript
class BurnEnergyHandler extends BaseOperationHandler {
  async execute(params, executionContext) {
    const { entity_ref, activity_multiplier = 1.0, turns = 1 } = params;
    const entityId = resolveEntityReference(entity_ref, executionContext);

    // Get metabolic store
    const store = this.#entityManager.getComponent(entityId, 'metabolism:metabolic_store');
    if (!store) {
      throw new Error(`Entity ${entityId} missing metabolism:metabolic_store`);
    }

    // Calculate burn
    const energyBurned = store.base_burn_rate * activity_multiplier * turns;
    const newEnergy = Math.max(0, store.current_energy - energyBurned);

    // Update component
    await this.#entityManager.modifyComponent(
      entityId,
      'metabolism:metabolic_store',
      { current_energy: newEnergy }
    );

    // Dispatch event
    this.#dispatcher.dispatch({
      type: 'metabolism:energy_burned',
      payload: {
        entityId,
        energyBurned,
        newEnergy,
        activityMultiplier: activity_multiplier
      }
    });
  }
}
```

---

### 2. DIGEST_FOOD Operation

**Purpose:** Converts stomach buffer content to energy reserve based on conversion rate and efficiency.

**Operation Schema:** `data/schemas/operations/digestFood.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DIGEST_FOOD Operation",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "DIGEST_FOOD" },
        "parameters": { "$ref": "#/$defs/Parameters" }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "type": "object",
      "properties": {
        "entity_ref": {
          "$ref": "../common.schema.json#/definitions/entityReference",
          "description": "Entity with fuel_converter and metabolic_store"
        },
        "turns": {
          "type": "number",
          "description": "Number of turns to process digestion",
          "minimum": 1,
          "default": 1
        }
      },
      "required": ["entity_ref"]
    }
  }
}
```

**Calculation:**

```
digestion_amount = min(buffer_storage, conversion_rate × activity_multiplier × turns)
energy_gained = digestion_amount × efficiency
new_buffer = buffer_storage - digestion_amount
new_energy = min(max_energy, current_energy + energy_gained)
```

**Key Logic:**

- Cannot digest more than what's in buffer
- Activity multiplier affects digestion speed (fighting digests faster)
- Efficiency loss represents metabolic waste
- Energy capped at max_energy (excess is wasted)

---

### 3. CONSUME_ITEM Operation

**Purpose:** Transfers fuel source to fuel converter buffer, removing item from inventory.

**Operation Schema:** `data/schemas/operations/consumeItem.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CONSUME_ITEM Operation",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "CONSUME_ITEM" },
        "parameters": { "$ref": "#/$defs/Parameters" }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "type": "object",
      "properties": {
        "consumer_ref": {
          "$ref": "../common.schema.json#/definitions/entityReference",
          "description": "Entity consuming the item"
        },
        "item_ref": {
          "$ref": "../common.schema.json#/definitions/entityReference",
          "description": "Item to consume"
        }
      },
      "required": ["consumer_ref", "item_ref"]
    }
  }
}
```

**Validation:**

1. Consumer has `metabolism:fuel_converter` component
2. Item has `metabolism:fuel_source` component
3. Item's `fuel_tags` match converter's `accepted_fuel_tags`
4. Buffer has room: `buffer_storage + item.bulk <= capacity`

**Processing:**

1. Add `item.bulk` to `fuel_converter.buffer_storage`
2. Store `item.energy_density` for future digestion
3. Remove item from consumer's inventory
4. Dispatch `metabolism:item_consumed` event

**Overeating Prevention:**

If `buffer_storage + item.bulk > capacity`:
- Add component `metabolism:overfull` with penalty duration
- Optionally dispatch `metabolism:vomit` event
- Apply movement/stamina penalties

---

### 4. UPDATE_HUNGER_STATE Operation

**Purpose:** Recalculates hunger state based on energy thresholds and applies gameplay effects.

**Operation Schema:** `data/schemas/operations/updateHungerState.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "UPDATE_HUNGER_STATE Operation",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "UPDATE_HUNGER_STATE" },
        "parameters": { "$ref": "#/$defs/Parameters" }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "type": "object",
      "properties": {
        "entity_ref": {
          "$ref": "../common.schema.json#/definitions/entityReference",
          "description": "Entity to update hunger state"
        }
      },
      "required": ["entity_ref"]
    }
  }
}
```

**Threshold Logic:**

```javascript
function calculateHungerState(energyPercentage) {
  if (energyPercentage > 100) return 'gluttonous';
  if (energyPercentage >= 75) return 'satiated';
  if (energyPercentage >= 30) return 'neutral';
  if (energyPercentage >= 10) return 'hungry';
  if (energyPercentage > 0) return 'starving';
  return 'critical';
}
```

**State Effects:**

- **Gluttonous**: Movement speed -10%, stamina regen -20%, audible breathing
- **Satiated**: Health regen +10%, focus +5%
- **Neutral**: No modifiers
- **Hungry**: Audible stomach rumbles (enemy detection), aim shake -5%
- **Starving**: Health loss per turn, carrying capacity -30%
- **Critical**: Severe health loss, movement -50%, cannot perform strenuous actions

---

### 5. UPDATE_BODY_COMPOSITION Operation

**Purpose:** Modifies `anatomy:body` component's `composition` descriptor based on prolonged starvation.

**Operation Schema:** `data/schemas/operations/updateBodyComposition.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "UPDATE_BODY_COMPOSITION Operation",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "UPDATE_BODY_COMPOSITION" },
        "parameters": { "$ref": "#/$defs/Parameters" }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "type": "object",
      "properties": {
        "entity_ref": {
          "$ref": "../common.schema.json#/definitions/entityReference",
          "description": "Entity with anatomy:body component"
        },
        "hunger_state": {
          "type": "string",
          "enum": ["gluttonous", "satiated", "neutral", "hungry", "starving", "critical"],
          "description": "Current hunger state"
        },
        "turns_in_state": {
          "type": "number",
          "description": "Consecutive turns in this state",
          "minimum": 0
        }
      },
      "required": ["entity_ref", "hunger_state", "turns_in_state"]
    }
  }
}
```

**Composition Mapping:**

```javascript
const starvationThresholds = {
  // turns_in_state → composition descriptor
  critical: {
    20: 'desiccated',
    15: 'skeletal',
    10: 'emaciated',
    5: 'wasted'
  },
  starving: {
    30: 'wasted',
    20: 'emaciated',
    10: 'malnourished'
  },
  gluttonous: {
    50: 'overweight',
    30: 'soft',
    10: 'soft'
  }
};
```

**Reversal Logic:**

- Compositions update gradually (not instantly)
- Recovery slower than decline (realistic metabolism)
- Only updates if entity has `anatomy:body` component
- Dispatches `anatomy:body_composition_changed` event

---

## Mod Structure

### Directory Organization

```
data/mods/metabolism/
├── mod-manifest.json
├── components/
│   ├── fuel_converter.component.json
│   ├── fuel_source.component.json
│   ├── metabolic_store.component.json
│   └── hunger_state.component.json
├── actions/
│   ├── eat.action.json
│   ├── drink.action.json
│   └── rest.action.json
├── rules/
│   ├── turn_energy_burn.rule.json
│   ├── turn_digestion.rule.json
│   ├── turn_hunger_update.rule.json
│   ├── handle_eat.rule.json
│   ├── handle_drink.rule.json
│   └── handle_rest.rule.json
├── conditions/
│   ├── has_energy_above.condition.json
│   ├── is_hungry.condition.json
│   ├── can_consume.condition.json
│   └── is_digesting.condition.json
├── scopes/
│   ├── nearby_food.scope
│   ├── consumable_items.scope
│   └── inventory_food.scope
└── entities/
    └── definitions/
        ├── bread.entity.json
        ├── water.entity.json
        └── steak.entity.json
```

### Mod Manifest

**File:** `data/mods/metabolism/mod-manifest.json`

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "metabolism",
  "version": "1.0.0",
  "name": "Metabolism System",
  "description": "Hunger, digestion, and energy management system",
  "dependencies": [
    { "id": "core", "version": "^1.0.0" },
    { "id": "anatomy", "version": "^1.0.0" }
  ],
  "content": {
    "components": [
      "fuel_converter.component.json",
      "fuel_source.component.json",
      "metabolic_store.component.json",
      "hunger_state.component.json"
    ],
    "actions": [
      "eat.action.json",
      "drink.action.json",
      "rest.action.json"
    ],
    "rules": [
      "turn_energy_burn.rule.json",
      "turn_digestion.rule.json",
      "turn_hunger_update.rule.json",
      "handle_eat.rule.json",
      "handle_drink.rule.json",
      "handle_rest.rule.json"
    ],
    "conditions": [
      "has_energy_above.condition.json",
      "is_hungry.condition.json",
      "can_consume.condition.json",
      "is_digesting.condition.json"
    ],
    "scopes": [
      "nearby_food.scope",
      "consumable_items.scope",
      "inventory_food.scope"
    ],
    "entities": [
      "definitions/bread.entity.json",
      "definitions/water.entity.json",
      "definitions/steak.entity.json"
    ]
  }
}
```

---

## Turn System Integration

### Turn-Based Energy Burn Rule

**File:** `data/mods/metabolism/rules/turn_energy_burn.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "turn_energy_burn",
  "event_type": "core:turn_started",
  "condition": {
    "and": [
      { "has_component": ["{event.payload.entityId}", "metabolism:metabolic_store"] },
      { "has_component": ["{event.payload.entityId}", "metabolism:fuel_converter"] }
    ]
  },
  "actions": [
    {
      "type": "BURN_ENERGY",
      "parameters": {
        "entity_ref": "{event.payload.entityId}",
        "activity_multiplier": 1.0,
        "turns": 1
      }
    }
  ]
}
```

### Turn-Based Digestion Rule

**File:** `data/mods/metabolism/rules/turn_digestion.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "turn_digestion",
  "event_type": "core:turn_started",
  "condition": {
    "and": [
      { "has_component": ["{event.payload.entityId}", "metabolism:fuel_converter"] },
      { "has_component": ["{event.payload.entityId}", "metabolism:metabolic_store"] },
      { ">": ["{component.metabolism:fuel_converter.buffer_storage}", 0] }
    ]
  },
  "actions": [
    {
      "type": "DIGEST_FOOD",
      "parameters": {
        "entity_ref": "{event.payload.entityId}",
        "turns": 1
      }
    }
  ]
}
```

### Turn-Based Hunger State Update Rule

**File:** `data/mods/metabolism/rules/turn_hunger_update.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "turn_hunger_update",
  "event_type": "core:turn_started",
  "condition": {
    "has_component": ["{event.payload.entityId}", "metabolism:metabolic_store"]
  },
  "actions": [
    {
      "type": "UPDATE_HUNGER_STATE",
      "parameters": {
        "entity_ref": "{event.payload.entityId}"
      }
    },
    {
      "type": "UPDATE_BODY_COMPOSITION",
      "parameters": {
        "entity_ref": "{event.payload.entityId}",
        "hunger_state": "{component.metabolism:hunger_state.state}",
        "turns_in_state": "{component.metabolism:hunger_state.turns_in_state}"
      }
    }
  ]
}
```

### Processing Order

1. **Turn Start Event Fired** (`core:turn_started`)
2. **Energy Burn** (reduces `current_energy`)
3. **Digestion** (converts `buffer_storage` to `current_energy`)
4. **Hunger State Update** (recalculates state based on energy percentage)
5. **Body Composition Update** (visual feedback for prolonged states)

---

## Action Integration

### Eat Action

**File:** `data/mods/metabolism/actions/eat.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "metabolism:eat",
  "name": "Eat",
  "description": "Consume a food item to restore energy",
  "targets": {
    "primary": {
      "scope": "metabolism:consumable_items",
      "placeholder": "food"
    }
  },
  "template": "eat {food}",
  "required_components": {
    "actor": ["metabolism:fuel_converter", "metabolism:metabolic_store"]
  },
  "forbidden_components": {
    "actor": ["metabolism:overfull"]
  },
  "prerequisites": [
    {
      "logic": { "condition_ref": "metabolism:can_consume" },
      "failure_message": "Your stomach is too full to eat more."
    }
  ],
  "visual_properties": {
    "category": "survival",
    "icon": "utensils"
  }
}
```

### Eat Action Rule

**File:** `data/mods/metabolism/rules/handle_eat.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_eat",
  "event_type": "core:attempt_action",
  "condition": {
    "==": ["{event.payload.actionId}", "metabolism:eat"]
  },
  "actions": [
    {
      "type": "CONSUME_ITEM",
      "parameters": {
        "consumer_ref": "{event.payload.actorId}",
        "item_ref": "{event.payload.targetId}"
      }
    },
    {
      "type": "DISPATCH_EVENT",
      "parameters": {
        "event_type": "core:action_completed",
        "payload": {
          "actorId": "{event.payload.actorId}",
          "actionId": "metabolism:eat",
          "success": true
        }
      }
    }
  ]
}
```

### Rest Action (Energy Recovery)

**File:** `data/mods/metabolism/actions/rest.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "metabolism:rest",
  "name": "Rest",
  "description": "Recover energy through rest (no food required)",
  "targets": {},
  "template": "rest",
  "required_components": {
    "actor": ["metabolism:metabolic_store"]
  },
  "prerequisites": [],
  "visual_properties": {
    "category": "survival",
    "icon": "bed"
  }
}
```

**Rest Rule:**

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_rest",
  "event_type": "core:attempt_action",
  "condition": {
    "==": ["{event.payload.actionId}", "metabolism:rest"]
  },
  "actions": [
    {
      "type": "MODIFY_COMPONENT",
      "parameters": {
        "entity_ref": "{event.payload.actorId}",
        "component_type": "metabolism:metabolic_store",
        "field": "current_energy",
        "mode": "add",
        "value": 50
      }
    },
    {
      "type": "MODIFY_COMPONENT",
      "parameters": {
        "entity_ref": "{event.payload.actorId}",
        "component_type": "metabolism:fuel_converter",
        "field": "activity_multiplier",
        "mode": "set",
        "value": 1.5
      }
    }
  ]
}
```

**Rest Mechanics:**

- Adds fixed energy amount (bypasses digestion)
- Increases digestion speed temporarily (1.5x multiplier)
- Represents body focusing on recovery
- Does not fill stomach buffer

### Modifying Existing Actions with Energy Costs

**Movement Actions:**

```json
// In data/mods/movement/rules/go.rule.json - ADD to actions array
{
  "type": "BURN_ENERGY",
  "parameters": {
    "entity_ref": "actor",
    "activity_multiplier": 1.2
  }
}
```

**Exercise Actions (Ballet, Gymnastics):**

```json
// In ballet/gymnastics rules - ADD to actions array
{
  "type": "BURN_ENERGY",
  "parameters": {
    "entity_ref": "actor",
    "activity_multiplier": 3.0
  }
}
```

**Combat/Sex Actions:**

```json
// In combat/sex action rules - ADD to actions array
{
  "type": "BURN_ENERGY",
  "parameters": {
    "entity_ref": "actor",
    "activity_multiplier": 2.5
  }
}
```

---

## GOAP Integration

### Hunger Satisfaction Goal

**File:** `data/mods/metabolism/goap/goals/satisfy_hunger.goal.json`

```json
{
  "id": "metabolism:satisfy_hunger",
  "name": "Satisfy Hunger",
  "description": "Ensure entity has sufficient energy reserves",
  "priority": 7,
  "preconditions": {
    "and": [
      { "has_component": ["self", "metabolism:metabolic_store"] },
      { "has_component": ["self", "metabolism:fuel_converter"] },
      { "or": [
        { "is_hungry": ["self"] },
        { "predicted_energy_below": ["self", 500] }
      ]}
    ]
  },
  "desired_state": {
    "is_hungry": false,
    "predicted_energy_above": 700
  },
  "valid_actions": [
    "metabolism:eat",
    "metabolism:drink"
  ]
}
```

### Custom JSON Logic Operators

**1. `is_hungry` Operator**

**File:** `src/logic/operators/isHungryOperator.js`

```javascript
export class IsHungryOperator {
  #entityManager;
  #operatorName = 'is_hungry';

  evaluate(params, context) {
    // params: [entityRef]
    const entityId = resolveEntityReference(params[0], context);
    const hungerState = this.#entityManager.getComponent(
      entityId,
      'metabolism:hunger_state'
    );

    if (!hungerState) return false;

    return ['hungry', 'starving', 'critical'].includes(hungerState.state);
  }
}
```

**2. `predicted_energy` Operator**

**File:** `src/logic/operators/predictedEnergyOperator.js`

**Purpose:** Prevents AI overeating by calculating current energy + buffered energy.

```javascript
export class PredictedEnergyOperator {
  #entityManager;
  #operatorName = 'predicted_energy';

  evaluate(params, context) {
    // params: [entityRef]
    const entityId = resolveEntityReference(params[0], context);

    const store = this.#entityManager.getComponent(
      entityId,
      'metabolism:metabolic_store'
    );
    const converter = this.#entityManager.getComponent(
      entityId,
      'metabolism:fuel_converter'
    );

    if (!store || !converter) return 0;

    // Current energy + what's in stomach (at efficiency rate)
    const bufferedEnergy = converter.buffer_storage * converter.efficiency;
    return store.current_energy + bufferedEnergy;
  }
}
```

**3. `can_consume` Operator**

**File:** `src/logic/operators/canConsumeOperator.js`

```javascript
export class CanConsumeOperator {
  #entityManager;
  #operatorName = 'can_consume';

  evaluate(params, context) {
    // params: [consumerRef, itemRef]
    const consumerId = resolveEntityReference(params[0], context);
    const itemId = resolveEntityReference(params[1], context);

    const converter = this.#entityManager.getComponent(
      consumerId,
      'metabolism:fuel_converter'
    );
    const fuelSource = this.#entityManager.getComponent(
      itemId,
      'metabolism:fuel_source'
    );

    if (!converter || !fuelSource) return false;

    // Check fuel tags match
    const hasMatchingTag = fuelSource.fuel_tags.some(tag =>
      converter.accepted_fuel_tags.includes(tag)
    );
    if (!hasMatchingTag) return false;

    // Check buffer has room
    const hasRoom = (converter.buffer_storage + fuelSource.bulk) <= converter.capacity;
    return hasRoom;
  }
}
```

### GOAP Action Costs with Energy

**Example: Movement Action Cost**

```json
{
  "actionId": "movement:go",
  "cost": {
    "base": 1,
    "energy_cost": 10,
    "modifiers": [
      {
        "condition": { "is_hungry": ["self"] },
        "multiplier": 1.5
      }
    ]
  }
}
```

### Preventing AI Overeating

**Planner Logic:**

```javascript
// In GOAP planner heuristic calculation
function shouldEat(entity) {
  const predictedEnergy = evaluateOperator('predicted_energy', [entity.id]);
  const maxEnergy = entity.components['metabolism:metabolic_store'].max_energy;

  // Only eat if predicted energy is below 70% capacity
  return predictedEnergy < (maxEnergy * 0.7);
}
```

**State Representation:**

```javascript
const entityState = {
  currentEnergy: 300,       // Low
  bufferedEnergy: 400,      // Food in stomach
  predictedEnergy: 700,     // 300 + 400
  isHungry: true,           // Current state
  shouldEat: false          // Because predicted energy is sufficient
};
```

---

## Threshold System

### State Definitions

| State | Energy % | Effects | Visual/Audio |
|-------|----------|---------|--------------|
| **Gluttonous** | 100%+ | Movement -10%, Stamina regen -20% | Heavy breathing, slower animations |
| **Satiated** | 75-100% | Health regen +10%, Focus +5% | Normal appearance, satisfied expressions |
| **Neutral** | 30-75% | No modifiers | Normal appearance |
| **Hungry** | 10-30% | Aim stability -5%, Audible stomach rumbles | Slightly gaunt, stomach sounds |
| **Starving** | 0.1-10% | Health loss per turn, Carry capacity -30% | Gaunt appearance, slow movement |
| **Critical** | ≤0% | Severe health loss, Movement -50%, Action restrictions | Emaciated, collapse animations |

### Threshold Configuration

**File:** `data/mods/metabolism/config/hunger_thresholds.json`

```json
{
  "thresholds": [
    {
      "state": "gluttonous",
      "min_percentage": 100,
      "max_percentage": 999,
      "effects": {
        "movement_speed_modifier": -0.1,
        "stamina_regen_modifier": -0.2,
        "audio_cues": ["heavy_breathing", "labored_footsteps"]
      }
    },
    {
      "state": "satiated",
      "min_percentage": 75,
      "max_percentage": 100,
      "effects": {
        "health_regen_modifier": 0.1,
        "focus_modifier": 0.05,
        "audio_cues": []
      }
    },
    {
      "state": "neutral",
      "min_percentage": 30,
      "max_percentage": 75,
      "effects": {}
    },
    {
      "state": "hungry",
      "min_percentage": 10,
      "max_percentage": 30,
      "effects": {
        "aim_stability_modifier": -0.05,
        "audio_cues": ["stomach_rumble"],
        "detection_range_modifier": 1.2
      }
    },
    {
      "state": "starving",
      "min_percentage": 0.1,
      "max_percentage": 10,
      "effects": {
        "health_loss_per_turn": 2,
        "carry_capacity_modifier": -0.3,
        "movement_speed_modifier": -0.2,
        "audio_cues": ["stomach_rumble", "weakness_sounds"]
      }
    },
    {
      "state": "critical",
      "min_percentage": 0,
      "max_percentage": 0.1,
      "effects": {
        "health_loss_per_turn": 5,
        "movement_speed_modifier": -0.5,
        "forbidden_actions": ["movement:run", "exercise:*", "combat:*"],
        "audio_cues": ["labored_breathing", "collapse_warning"]
      }
    }
  ]
}
```

### State Transition Events

**Event:** `metabolism:hunger_state_changed`

```json
{
  "type": "metabolism:hunger_state_changed",
  "payload": {
    "entityId": "entity_123",
    "previousState": "neutral",
    "newState": "hungry",
    "energyPercentage": 25.5,
    "turnsInPreviousState": 42
  }
}
```

**Usage:** Other systems can listen to this event to apply visual effects, UI updates, or gameplay modifiers.

---

## Digestion Buffer Mechanics

### Two-Value System

```
┌─────────────────────────────────┐
│  Entity with Metabolism         │
├─────────────────────────────────┤
│  Fuel Converter (Stomach)       │
│  ├─ buffer_storage: 40/100      │ ← Food waiting to digest
│  ├─ conversion_rate: 5/turn     │
│  └─ efficiency: 0.8              │
├─────────────────────────────────┤
│  Metabolic Store (Energy Tank)  │
│  ├─ current_energy: 600/1000    │ ← Usable energy
│  └─ base_burn_rate: 1.0/turn    │
└─────────────────────────────────┘
```

### Conversion Process

**Per Turn:**

```
Input:  buffer_storage = 40
        conversion_rate = 5
        efficiency = 0.8
        activity_multiplier = 1.0

Step 1: Calculate digestion
        digestion = min(40, 5 × 1.0) = 5

Step 2: Calculate energy gained
        energy_gained = 5 × 0.8 = 4

Step 3: Update buffer
        new_buffer = 40 - 5 = 35

Step 4: Update energy
        new_energy = min(1000, 600 + 4) = 604

Output: buffer_storage = 35
        current_energy = 604
```

### Activity-Based Digestion Speed

**Resting (activity_multiplier = 1.0):**
- Normal digestion rate
- 5 points/turn → 20 turns to digest 100 points

**Light Activity (activity_multiplier = 1.2):**
- Slightly faster digestion
- 6 points/turn → ~17 turns to digest 100 points

**Intense Activity (activity_multiplier = 2.0):**
- Much faster digestion
- 10 points/turn → 10 turns to digest 100 points
- BUT: Also burns energy faster (trade-off)

**Combat/Emergency (activity_multiplier = 3.0):**
- Maximum digestion speed
- 15 points/turn → ~7 turns to digest 100 points
- High energy burn rate creates risk

### Overeating Mechanics

**Capacity Check:**

```javascript
function canEat(converter, foodBulk) {
  const availableSpace = converter.capacity - converter.buffer_storage;
  return foodBulk <= availableSpace;
}
```

**Overeating Consequences:**

If `buffer_storage + food.bulk > capacity`:

1. Add `metabolism:overfull` component:
   ```json
   {
     "metabolism:overfull": {
       "penalty_duration": 10,
       "movement_penalty": 0.2,
       "stamina_penalty": 0.3
     }
   }
   ```

2. Optional vomit mechanic:
   ```json
   {
     "type": "DISPATCH_EVENT",
     "parameters": {
       "event_type": "metabolism:vomit",
       "payload": {
         "entityId": "actor_id",
         "foodLost": 30,
         "energyLost": 24
       }
     }
   }
   ```

3. Apply temporary debuffs:
   - Movement speed -20%
   - Cannot eat for N turns
   - Stamina regeneration -30%

---

## Food Properties System

### Volume vs. Density Examples

**High Volume, Low Calories (Lettuce):**

```json
{
  "id": "food:lettuce",
  "components": {
    "metabolism:fuel_source": {
      "energy_density": 30,
      "bulk": 70,
      "fuel_tags": ["organic", "vegetable", "raw"],
      "digestion_speed": "fast"
    }
  }
}
```

**Effect:** Fills stomach quickly (removes "hungry" sensation), but provides little energy.

**Low Volume, High Calories (Butter):**

```json
{
  "id": "food:butter",
  "components": {
    "metabolism:fuel_source": {
      "energy_density": 400,
      "bulk": 20,
      "fuel_tags": ["organic", "fat"],
      "digestion_speed": "slow"
    }
  }
}
```

**Effect:** Provides lots of energy, but doesn't fill stomach (still feels "hungry").

**Balanced Meal (Steak):**

```json
{
  "id": "food:steak",
  "components": {
    "metabolism:fuel_source": {
      "energy_density": 300,
      "bulk": 50,
      "fuel_tags": ["organic", "meat", "cooked"],
      "digestion_speed": "medium"
    }
  }
}
```

**Effect:** Good balance of satiety and energy.

### Digestion Speed Impact

**Fast Digestion (Fruits, vegetables):**
- `conversion_rate` × 1.5
- Empties stomach quickly
- Can eat again sooner

**Medium Digestion (Bread, cooked meals):**
- Normal `conversion_rate`
- Standard processing

**Slow Digestion (Meat, fats):**
- `conversion_rate` × 0.7
- Stays in stomach longer
- Longer satiety duration

**Instant Digestion (Special items like potions):**
- Bypasses buffer entirely
- Directly adds to energy reserve
- Magical/sci-fi items

### Food Quality Tiers

**Survival Food:**
- High bulk, low calories
- Fast digestion
- Prevents starvation but weak performance

**Standard Food:**
- Balanced bulk and calories
- Medium digestion
- Adequate for normal activity

**Luxury Food:**
- Moderate bulk, high calories
- Slow/medium digestion
- Optimal for performance

**Emergency Rations:**
- Low bulk, very high calories
- Instant/fast digestion
- Combat/crisis situations

---

## Entity Type Abstraction

### Generic Fuel System

Instead of hardcoding "stomach" and "food", use abstract fuel providers and converters.

### Human Configuration

**Body Part: Stomach**

```json
{
  "id": "anatomy:human_stomach",
  "components": {
    "anatomy:part": { "subType": "internal_organ" },
    "metabolism:fuel_converter": {
      "capacity": 100,
      "buffer_storage": 0,
      "conversion_rate": 5,
      "efficiency": 0.75,
      "accepted_fuel_tags": ["organic", "cooked", "raw"]
    },
    "core:name": { "text": "stomach" }
  }
}
```

**Actor Setup:**

```json
{
  "id": "actor:human_female",
  "components": {
    "anatomy:body": { "recipeId": "anatomy:human_female" },
    "metabolism:metabolic_store": {
      "current_energy": 800,
      "max_energy": 1000,
      "base_burn_rate": 1.0
    },
    "metabolism:hunger_state": {
      "state": "neutral",
      "energy_percentage": 80
    }
  }
}
```

### Vampire Configuration

**Vampire Stomach (Blood Only):**

```json
{
  "id": "anatomy:vampire_stomach",
  "components": {
    "anatomy:part": { "subType": "internal_organ" },
    "metabolism:fuel_converter": {
      "capacity": 50,
      "buffer_storage": 0,
      "conversion_rate": 20,
      "efficiency": 0.95,
      "accepted_fuel_tags": ["blood"]
    },
    "core:name": { "text": "vampiric digestive system" }
  }
}
```

**Blood as Fuel:**

```json
{
  "id": "consumable:blood_vial",
  "components": {
    "metabolism:fuel_source": {
      "energy_density": 200,
      "bulk": 25,
      "fuel_tags": ["blood", "organic"],
      "digestion_speed": "instant"
    },
    "core:name": { "text": "vial of blood" }
  }
}
```

**Vampire Traits:**
- High conversion rate (20/turn)
- High efficiency (0.95)
- Instant digestion
- Only accepts "blood" tag
- Smaller capacity (doesn't need much)

### Robot Configuration

**Robot Fuel Tank:**

```json
{
  "id": "robot:fuel_tank",
  "components": {
    "metabolism:fuel_converter": {
      "capacity": 200,
      "buffer_storage": 0,
      "conversion_rate": 10,
      "efficiency": 1.0,
      "accepted_fuel_tags": ["electricity", "battery"]
    },
    "core:name": { "text": "power cell" }
  }
}
```

**Battery as Fuel:**

```json
{
  "id": "consumable:battery",
  "components": {
    "metabolism:fuel_source": {
      "energy_density": 500,
      "bulk": 30,
      "fuel_tags": ["electricity", "battery"],
      "digestion_speed": "instant"
    },
    "core:name": { "text": "battery pack" }
  }
}
```

**Robot Traits:**
- Perfect efficiency (1.0)
- Instant digestion (electrical transfer)
- Large capacity
- Higher energy density per unit
- Different fuel tags

### Steam Engine Configuration

**Coal Furnace:**

```json
{
  "id": "steampunk:furnace",
  "components": {
    "metabolism:fuel_converter": {
      "capacity": 300,
      "buffer_storage": 0,
      "conversion_rate": 50,
      "efficiency": 0.5,
      "accepted_fuel_tags": ["coal", "wood", "combustible"]
    },
    "core:name": { "text": "combustion chamber" }
  }
}
```

**Coal as Fuel:**

```json
{
  "id": "consumable:coal",
  "components": {
    "metabolism:fuel_source": {
      "energy_density": 600,
      "bulk": 100,
      "fuel_tags": ["coal", "combustible"],
      "digestion_speed": "fast"
    },
    "core:name": { "text": "lump of coal" }
  }
}
```

**Steam Engine Traits:**
- Very high burn rate (50/turn)
- Low efficiency (0.5 - lots of waste heat)
- Large capacity
- High bulk fuel
- Fast conversion

---

## Data Schemas

### Complete Schema Examples

#### Fuel Converter Component Schema

**File:** `data/mods/metabolism/components/fuel_converter.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "metabolism:fuel_converter",
  "name": "Fuel Converter",
  "description": "Organ or system that converts consumed fuel into usable energy over time",
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "buffer_overflow": "Buffer storage {value} exceeds capacity {capacity}",
      "invalid_efficiency": "Efficiency must be between 0.0 and 1.0, got {value}",
      "negative_values": "All numeric values must be non-negative"
    },
    "suggestions": {
      "accepted_fuel_tags": {
        "common_values": ["organic", "blood", "electricity", "coal", "battery", "combustible"]
      }
    }
  },
  "dataSchema": {
    "type": "object",
    "properties": {
      "capacity": {
        "type": "number",
        "description": "Maximum buffer storage (0-100 scale for organic, can vary for others)",
        "minimum": 0,
        "default": 100
      },
      "buffer_storage": {
        "type": "number",
        "description": "Current fuel waiting to be converted",
        "minimum": 0,
        "default": 0
      },
      "conversion_rate": {
        "type": "number",
        "description": "Points of buffer converted per turn",
        "minimum": 0,
        "default": 5
      },
      "efficiency": {
        "type": "number",
        "description": "Percentage of fuel converted to energy (0.0-1.0)",
        "minimum": 0,
        "maximum": 1,
        "default": 0.8
      },
      "accepted_fuel_tags": {
        "type": "array",
        "description": "Types of fuel this converter can process",
        "items": { "type": "string" },
        "minItems": 1,
        "default": ["organic"]
      },
      "activity_multiplier": {
        "type": "number",
        "description": "Current activity's effect on conversion rate (1.0 = normal)",
        "minimum": 0,
        "default": 1.0
      }
    },
    "required": ["capacity", "buffer_storage", "conversion_rate", "efficiency", "accepted_fuel_tags"],
    "additionalProperties": false
  }
}
```

#### Fuel Source Component Schema

**File:** `data/mods/metabolism/components/fuel_source.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "metabolism:fuel_source",
  "name": "Fuel Source",
  "description": "Consumable item that provides energy and occupies converter buffer space",
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalid_bulk": "Bulk must be between 0 and 100, got {value}",
      "no_fuel_tags": "At least one fuel tag must be specified"
    },
    "suggestions": {
      "fuel_tags": {
        "common_values": ["organic", "meat", "vegetable", "fruit", "cooked", "raw", "blood", "electricity", "battery", "coal"]
      },
      "digestion_speed": {
        "enum_suggestions": true
      }
    }
  },
  "dataSchema": {
    "type": "object",
    "properties": {
      "energy_density": {
        "type": "number",
        "description": "Total energy/calories provided by this item",
        "minimum": 0
      },
      "bulk": {
        "type": "number",
        "description": "Volume/space occupied in converter buffer (0-100)",
        "minimum": 0,
        "maximum": 100
      },
      "fuel_tags": {
        "type": "array",
        "description": "Tags indicating what can consume this fuel",
        "items": { "type": "string" },
        "minItems": 1
      },
      "digestion_speed": {
        "type": "string",
        "enum": ["instant", "fast", "medium", "slow"],
        "description": "How quickly this fuel is processed",
        "default": "medium"
      },
      "spoilage_rate": {
        "type": "number",
        "description": "Turns until item spoils (0 = never)",
        "minimum": 0,
        "default": 0
      }
    },
    "required": ["energy_density", "bulk", "fuel_tags"],
    "additionalProperties": false
  }
}
```

---

## Testing Strategy

### Unit Tests

**Test Coverage Requirements:**
- ✅ 80%+ branch coverage
- ✅ 90%+ function coverage
- ✅ 90%+ line coverage

#### Operation Handler Tests

**File:** `tests/unit/logic/operationHandlers/burnEnergyHandler.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { BurnEnergyHandler } from '../../../src/logic/operationHandlers/burnEnergyHandler.js';
import { createTestBed } from '../../common/testBed.js';

describe('BurnEnergyHandler', () => {
  let testBed;
  let handler;

  beforeEach(() => {
    testBed = createTestBed();
    handler = new BurnEnergyHandler({
      entityManager: testBed.entityManager,
      logger: testBed.logger,
      safeEventDispatcher: testBed.dispatcher
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should reduce energy based on burn rate and activity', async () => {
    // Arrange
    const entityId = 'actor_1';
    testBed.entityManager.addComponent(entityId, 'metabolism:metabolic_store', {
      current_energy: 1000,
      max_energy: 1000,
      base_burn_rate: 10
    });

    // Act
    await handler.execute({
      entity_ref: entityId,
      activity_multiplier: 2.0,
      turns: 1
    }, testBed.context);

    // Assert
    const store = testBed.entityManager.getComponent(entityId, 'metabolism:metabolic_store');
    expect(store.current_energy).toBe(980); // 1000 - (10 * 2.0 * 1)
  });

  it('should not reduce energy below zero', async () => {
    // Arrange
    const entityId = 'actor_1';
    testBed.entityManager.addComponent(entityId, 'metabolism:metabolic_store', {
      current_energy: 5,
      max_energy: 1000,
      base_burn_rate: 10
    });

    // Act
    await handler.execute({
      entity_ref: entityId,
      activity_multiplier: 1.0,
      turns: 1
    }, testBed.context);

    // Assert
    const store = testBed.entityManager.getComponent(entityId, 'metabolism:metabolic_store');
    expect(store.current_energy).toBe(0);
  });

  it('should dispatch energy_burned event', async () => {
    // Arrange
    const entityId = 'actor_1';
    testBed.entityManager.addComponent(entityId, 'metabolism:metabolic_store', {
      current_energy: 1000,
      max_energy: 1000,
      base_burn_rate: 10
    });

    // Act
    await handler.execute({
      entity_ref: entityId,
      activity_multiplier: 1.5,
      turns: 1
    }, testBed.context);

    // Assert
    expect(testBed.dispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'metabolism:energy_burned',
        payload: expect.objectContaining({
          entityId,
          energyBurned: 15,
          activityMultiplier: 1.5
        })
      })
    );
  });
});
```

#### Component Validation Tests

**File:** `tests/unit/validation/metabolismComponents.test.js`

```javascript
describe('Metabolism Component Schemas', () => {
  it('should validate fuel_converter component', () => {
    const validComponent = {
      capacity: 100,
      buffer_storage: 40,
      conversion_rate: 5,
      efficiency: 0.8,
      accepted_fuel_tags: ['organic']
    };

    const result = validateAgainstSchema(validComponent, 'metabolism:fuel_converter');
    expect(result.valid).toBe(true);
  });

  it('should reject fuel_converter with efficiency > 1.0', () => {
    const invalidComponent = {
      capacity: 100,
      buffer_storage: 0,
      conversion_rate: 5,
      efficiency: 1.5, // Invalid
      accepted_fuel_tags: ['organic']
    };

    const result = validateAgainstSchema(invalidComponent, 'metabolism:fuel_converter');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('efficiency must be <= 1.0');
  });
});
```

### Integration Tests

**File:** `tests/integration/mods/metabolism/eatAction.test.js`

```javascript
import { ModTestFixture } from '../../../common/mods/modTestFixture.js';
import '../../../common/mods/domainMatchers.js';

describe('Eat Action Integration', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('metabolism', 'metabolism:eat');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should consume food and add to buffer', async () => {
    // Arrange
    const scenario = fixture.createStandardActorTarget(['Actor', 'Bread']);

    // Add metabolism components to actor
    fixture.entityManager.addComponent(scenario.actor.id, 'metabolism:fuel_converter', {
      capacity: 100,
      buffer_storage: 0,
      conversion_rate: 5,
      efficiency: 0.8,
      accepted_fuel_tags: ['organic']
    });

    fixture.entityManager.addComponent(scenario.actor.id, 'metabolism:metabolic_store', {
      current_energy: 500,
      max_energy: 1000,
      base_burn_rate: 1.0
    });

    // Add fuel source to bread
    fixture.entityManager.addComponent(scenario.target.id, 'metabolism:fuel_source', {
      energy_density: 200,
      bulk: 30,
      fuel_tags: ['organic', 'cooked']
    });

    // Act
    await fixture.executeAction(scenario.actor.id, scenario.target.id);

    // Assert
    const converter = fixture.entityManager.getComponent(
      scenario.actor.id,
      'metabolism:fuel_converter'
    );
    expect(converter.buffer_storage).toBe(30);

    // Bread should be removed
    expect(fixture.entityManager.hasEntity(scenario.target.id)).toBe(false);
  });

  it('should prevent eating when stomach is full', async () => {
    // Arrange
    const scenario = fixture.createStandardActorTarget(['Actor', 'Bread']);

    fixture.entityManager.addComponent(scenario.actor.id, 'metabolism:fuel_converter', {
      capacity: 100,
      buffer_storage: 90, // Almost full
      conversion_rate: 5,
      efficiency: 0.8,
      accepted_fuel_tags: ['organic']
    });

    fixture.entityManager.addComponent(scenario.target.id, 'metabolism:fuel_source', {
      energy_density: 200,
      bulk: 30, // Too much for available space
      fuel_tags: ['organic']
    });

    // Act & Assert
    await expect(
      fixture.executeAction(scenario.actor.id, scenario.target.id)
    ).rejects.toThrow('stomach is too full');
  });
});
```

### End-to-End Tests

**File:** `tests/e2e/metabolism/hungerCycle.test.js`

```javascript
describe('Complete Hunger Cycle E2E', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await createE2ETestEnvironment(['core', 'anatomy', 'metabolism']);
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should simulate complete hunger-eat-digest-burn cycle', async () => {
    // Create actor with full metabolism system
    const actor = await fixture.createActor({
      components: {
        'metabolism:fuel_converter': {
          capacity: 100,
          buffer_storage: 0,
          conversion_rate: 5,
          efficiency: 0.8,
          accepted_fuel_tags: ['organic']
        },
        'metabolism:metabolic_store': {
          current_energy: 500,
          max_energy: 1000,
          base_burn_rate: 2.0
        },
        'metabolism:hunger_state': {
          state: 'hungry',
          energy_percentage: 50
        }
      }
    });

    // Create food
    const bread = await fixture.createItem({
      components: {
        'metabolism:fuel_source': {
          energy_density: 300,
          bulk: 40,
          fuel_tags: ['organic', 'cooked']
        }
      }
    });

    // ACT 1: Eat food
    await fixture.performAction(actor.id, 'metabolism:eat', bread.id);

    // ASSERT: Food in buffer
    let converter = fixture.getComponent(actor.id, 'metabolism:fuel_converter');
    expect(converter.buffer_storage).toBe(40);

    // ACT 2: Simulate 10 turns
    for (let i = 0; i < 10; i++) {
      await fixture.advanceTurn(actor.id);
    }

    // ASSERT: Buffer partially digested, energy increased
    converter = fixture.getComponent(actor.id, 'metabolism:fuel_converter');
    const store = fixture.getComponent(actor.id, 'metabolism:metabolic_store');

    // After 10 turns:
    // - Digested: 5 * 10 = 50 (but buffer only had 40, so 40 total)
    // - Energy gained: 40 * 0.8 = 32
    // - Energy burned: 2.0 * 10 = 20
    // - Net energy change: 500 + 32 - 20 = 512

    expect(converter.buffer_storage).toBe(0); // All digested
    expect(store.current_energy).toBe(512);

    // Hunger state should improve
    const hungerState = fixture.getComponent(actor.id, 'metabolism:hunger_state');
    expect(hungerState.state).toBe('neutral'); // 51.2% energy
  });
});
```

### Performance Tests

**File:** `tests/performance/metabolism/turnProcessing.performance.test.js`

```javascript
describe('Metabolism Turn Processing Performance', () => {
  it('should process 100 entities per turn in < 100ms', async () => {
    // Arrange
    const entities = [];
    for (let i = 0; i < 100; i++) {
      const entity = await createEntityWithMetabolism();
      entities.push(entity);
    }

    // Act
    const startTime = performance.now();
    await processTurnForAllEntities(entities);
    const endTime = performance.now();

    // Assert
    const duration = endTime - startTime;
    expect(duration).toBeLessThan(100);
  });

  it('should scale linearly with entity count', async () => {
    const counts = [10, 50, 100, 200];
    const timings = [];

    for (const count of counts) {
      const entities = await createEntities(count);
      const start = performance.now();
      await processTurnForAllEntities(entities);
      const end = performance.now();
      timings.push(end - start);
    }

    // Linear scaling: 200 entities should take ~2x time of 100 entities
    const ratio = timings[3] / timings[2];
    expect(ratio).toBeGreaterThan(1.5);
    expect(ratio).toBeLessThan(2.5);
  });
});
```

### GOAP Integration Tests

**File:** `tests/integration/goap/hungerGoals.test.js`

```javascript
describe('GOAP Hunger Integration', () => {
  it('should create plan to satisfy hunger', async () => {
    // Arrange
    const actor = await createHungryActor();
    const food = await createFoodItem();
    const planner = await createGOAPPlanner();

    // Act
    const plan = await planner.createPlan(actor.id, 'metabolism:satisfy_hunger');

    // Assert
    expect(plan).toHaveLength(2);
    expect(plan[0].actionId).toBe('movement:go'); // Go to food
    expect(plan[1].actionId).toBe('metabolism:eat'); // Eat food
  });

  it('should not plan to eat when already digesting', async () => {
    // Arrange
    const actor = await createActorWithFullStomach(); // buffer_storage = 80
    const food = await createFoodItem();
    const planner = await createGOAPPlanner();

    // Act
    const plan = await planner.createPlan(actor.id, 'metabolism:satisfy_hunger');

    // Assert
    // Should not plan to eat because predicted_energy is sufficient
    expect(plan.some(action => action.actionId === 'metabolism:eat')).toBe(false);
  });
});
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goals:**
- Core component definitions
- Basic operation handlers
- Schema validation

**Deliverables:**
1. ✅ Component schemas:
   - `metabolism:fuel_converter`
   - `metabolism:fuel_source`
   - `metabolism:metabolic_store`
   - `metabolism:hunger_state`

2. ✅ Operation handlers:
   - `BurnEnergyHandler`
   - `DigestFoodHandler`
   - `ConsumeItemHandler`
   - `UpdateHungerStateHandler`

3. ✅ Operation schemas in `data/schemas/operations/`

4. ✅ DI token definitions and registrations

5. ✅ Unit tests for all operation handlers

**Success Criteria:**
- All schemas validate correctly
- All operation handlers have 90%+ test coverage
- CI/CD pipeline passes

---

### Phase 2: Mod Structure (Week 2-3)

**Goals:**
- Complete metabolism mod
- Turn-based processing
- Action definitions

**Deliverables:**
1. ✅ Mod manifest and structure

2. ✅ Turn-based rules:
   - `turn_energy_burn.rule.json`
   - `turn_digestion.rule.json`
   - `turn_hunger_update.rule.json`

3. ✅ Actions:
   - `eat.action.json`
   - `drink.action.json`
   - `rest.action.json`

4. ✅ Action handling rules:
   - `handle_eat.rule.json`
   - `handle_drink.rule.json`
   - `handle_rest.rule.json`

5. ✅ Sample food entities (bread, water, steak)

6. ✅ Integration tests for actions and rules

**Success Criteria:**
- Mod loads without errors
- Turn-based processing works correctly
- Actions execute successfully
- Integration tests pass

---

### Phase 3: GOAP Integration (Week 3-4)

**Goals:**
- Hunger-driven AI behavior
- Prevent overeating
- Energy-based action costs

**Deliverables:**
1. ✅ Custom JSON Logic operators:
   - `is_hungry`
   - `predicted_energy`
   - `can_consume`

2. ✅ GOAP goals:
   - `satisfy_hunger.goal.json`

3. ✅ Conditions:
   - `has_energy_above.condition.json`
   - `is_hungry.condition.json`
   - `can_consume.condition.json`

4. ✅ Scopes:
   - `nearby_food.scope`
   - `consumable_items.scope`

5. ✅ GOAP integration tests

**Success Criteria:**
- AI actors seek food when hungry
- AI does not spam eat actions
- Predicted energy calculation works correctly
- GOAP tests pass

---

### Phase 4: Visual Integration (Week 4-5)

**Goals:**
- Body composition updates
- UI indicators
- Audio cues

**Deliverables:**
1. ✅ `UPDATE_BODY_COMPOSITION` operation handler

2. ✅ Body composition update logic:
   - Starvation thresholds
   - Composition descriptor mapping
   - Gradual transitions

3. ✅ Event dispatching:
   - `metabolism:hunger_state_changed`
   - `metabolism:body_composition_changed`

4. ✅ Audio cue configuration (if applicable)

5. ✅ Visual feedback tests

**Success Criteria:**
- Prolonged starvation changes body composition
- State changes dispatch events
- Visual updates are gradual and realistic

---

### Phase 5: Action Energy Costs (Week 5-6)

**Goals:**
- Integrate energy costs into existing actions
- Balance gameplay
- Performance validation

**Deliverables:**
1. ✅ Energy cost modifications for:
   - Movement actions (`movement:go`, `movement:run`)
   - Exercise actions (`ballet:*`, `gymnastics:*`)
   - Combat actions (if applicable)

2. ✅ Energy cost configuration:
   - Walking: 1.2x multiplier
   - Running: 2.0x multiplier
   - Exercise: 3.0x multiplier
   - Combat: 2.5x multiplier

3. ✅ Action prerequisite updates (minimum energy requirements)

4. ✅ Performance tests for turn-based processing

5. ✅ Gameplay balance testing

**Success Criteria:**
- All actions have appropriate energy costs
- Performance remains acceptable (< 100ms per turn for 100 entities)
- Gameplay feels balanced and strategic

---

### Phase 6: Polish & Documentation (Week 6)

**Goals:**
- Complete documentation
- Edge case handling
- Final testing

**Deliverables:**
1. ✅ Edge case handling:
   - Negative energy scenarios
   - Overeating mechanics
   - Invalid fuel types
   - Missing components

2. ✅ Error messages and validation

3. ✅ Complete test coverage:
   - Unit tests
   - Integration tests
   - E2E tests
   - Performance tests

4. ✅ Modding documentation

5. ✅ Example implementations

**Success Criteria:**
- All edge cases handled gracefully
- Test coverage > 80%
- Documentation complete
- Ready for production

---

## Edge Cases

### 1. Negative Energy Scenarios

**Problem:** Entity energy drops to or below zero.

**Solution:**

```javascript
function clampEnergy(energy, min = 0, max) {
  return Math.max(min, Math.min(max, energy));
}

// In UPDATE_HUNGER_STATE
if (store.current_energy <= 0) {
  // Apply critical state effects
  await applyHealthDamage(entityId, 5); // Health loss per turn
  await addComponent(entityId, 'metabolism:critical', {
    duration: -1 // Until energy restored
  });
}
```

**Prevention:**
- Minimum energy floor of 0
- Health damage begins at critical state
- Movement/action restrictions at critical energy

---

### 2. Overeating and Vomiting

**Problem:** Player tries to eat beyond stomach capacity.

**Solution:**

```javascript
// In CONSUME_ITEM handler
const availableSpace = converter.capacity - converter.buffer_storage;
const overflow = item.bulk - availableSpace;

if (overflow > 0) {
  // Option 1: Reject consumption
  throw new Error('Stomach is too full');

  // Option 2: Consume with penalty
  await addComponent(entityId, 'metabolism:overfull', {
    penalty_duration: 10,
    movement_penalty: 0.2,
    stamina_penalty: 0.3
  });

  // Option 3: Vomit mechanic
  if (overflow > converter.capacity * 0.2) {
    await dispatchEvent('metabolism:vomit', {
      entityId,
      foodLost: overflow,
      energyLost: overflow * converter.efficiency
    });
  }
}
```

**Effects:**
- Movement speed penalty
- Cannot eat for N turns
- Stamina regeneration penalty
- Audio/visual feedback

---

### 3. Invalid Fuel Types

**Problem:** Trying to consume fuel that converter doesn't accept.

**Solution:**

```javascript
// In CONSUME_ITEM handler
const hasMatchingTag = fuelSource.fuel_tags.some(tag =>
  converter.accepted_fuel_tags.includes(tag)
);

if (!hasMatchingTag) {
  throw new InvalidFuelTypeError(
    `Cannot consume ${itemName}: incompatible fuel type. ` +
    `Accepts: ${converter.accepted_fuel_tags.join(', ')}. ` +
    `Has: ${fuelSource.fuel_tags.join(', ')}.`
  );
}
```

**User Feedback:**
- Clear error message explaining incompatibility
- Show accepted fuel types
- Prevent action from appearing in available actions list

---

### 4. Missing Components

**Problem:** Entity missing required metabolism components.

**Solution:**

```javascript
// Defensive checks in operation handlers
if (!entityManager.hasComponent(entityId, 'metabolism:metabolic_store')) {
  logger.warn(`Entity ${entityId} missing metabolism:metabolic_store, skipping energy burn`);
  return; // Graceful degradation
}

// In action prerequisites
{
  "required_components": {
    "actor": [
      "metabolism:fuel_converter",
      "metabolism:metabolic_store"
    ]
  }
}
```

**Prevention:**
- Required components in action definitions
- Graceful degradation for missing components
- Clear log messages for debugging

---

### 5. Energy Underflow/Overflow

**Problem:** Calculations causing negative or excessive energy values.

**Solution:**

```javascript
// Always clamp energy values
function updateEnergy(store, delta) {
  const newEnergy = store.current_energy + delta;
  store.current_energy = Math.max(0, Math.min(store.max_energy, newEnergy));

  // Log overflow/underflow for debugging
  if (newEnergy > store.max_energy) {
    logger.debug(`Energy overflow: ${newEnergy} > ${store.max_energy}, clamped`);
  } else if (newEnergy < 0) {
    logger.debug(`Energy underflow: ${newEnergy} < 0, clamped`);
  }
}
```

---

### 6. Turn Processing Order Issues

**Problem:** Conflicting operations in same turn (digest before burn, etc.).

**Solution:**

```javascript
// Define explicit processing order in turn manager
const metabolismProcessingOrder = [
  'metabolism:turn_energy_burn',      // 1. Burn first
  'metabolism:turn_digestion',        // 2. Then digest
  'metabolism:turn_hunger_update',    // 3. Then update state
  'metabolism:turn_body_update'       // 4. Finally visual updates
];

// Ensure rules execute in correct sequence
rules.sort((a, b) => {
  const aIndex = metabolismProcessingOrder.indexOf(a.rule_id);
  const bIndex = metabolismProcessingOrder.indexOf(b.rule_id);
  return aIndex - bIndex;
});
```

---

### 7. Division by Zero

**Problem:** Zero conversion rate or burn rate causing division errors.

**Solution:**

```javascript
// Validate non-zero rates in schemas
{
  "conversion_rate": {
    "type": "number",
    "minimum": 0.1, // Prevent zero
    "default": 5
  }
}

// Defensive checks in calculations
const safeConversionRate = Math.max(0.1, converter.conversion_rate);
const digestionAmount = Math.min(buffer, safeConversionRate * turns);
```

---

### 8. Simultaneous Consumption

**Problem:** Multiple actions trying to consume same food item.

**Solution:**

```javascript
// Lock entity during consumption
const lock = await acquireLock(itemId, 'consumption');
try {
  // Verify item still exists and available
  if (!entityManager.hasEntity(itemId)) {
    throw new Error('Item no longer available');
  }

  // Consume item
  await consumeItem(actorId, itemId);

  // Remove item
  await entityManager.removeEntity(itemId);
} finally {
  await releaseLock(lock);
}
```

---

## Future Extensions

### 1. Thirst System

**Separate from Hunger:**
- Independent `metabolism:hydration` component
- Separate threshold states (hydrated, thirsty, dehydrated, critical)
- Water sources with `fuel_tags: ["liquid", "water"]`
- Different converters for food vs. liquid
- Combined survival requirements (hunger AND thirst)

**Implementation:**

```json
{
  "metabolism:hydration": {
    "current_hydration": 800,
    "max_hydration": 1000,
    "dehydration_rate": 2.0,
    "state": "hydrated"
  }
}
```

---

### 2. Cooking and Food Preparation

**Mechanics:**
- Raw ingredients with low energy_density
- Cooking increases energy_density and changes fuel_tags
- Cooking stations as entities with capabilities
- Recipe system for combining ingredients

**Example:**

```json
// Raw steak
{
  "metabolism:fuel_source": {
    "energy_density": 150,
    "bulk": 50,
    "fuel_tags": ["organic", "meat", "raw"],
    "can_be_cooked": true
  }
}

// Cooked steak (after cooking action)
{
  "metabolism:fuel_source": {
    "energy_density": 300,
    "bulk": 40,
    "fuel_tags": ["organic", "meat", "cooked"]
  }
}
```

---

### 3. Nutritional Variety

**Complex Nutrients:**
- Vitamins, minerals, proteins, fats, carbohydrates
- Deficiency states (low vitamin C → scurvy)
- Balanced diet bonuses
- Malnutrition from single-food diets

**Example:**

```json
{
  "metabolism:nutrition": {
    "protein": 50,
    "carbs": 200,
    "fats": 80,
    "vitamin_c": 10,
    "iron": 5
  }
}
```

---

### 4. Food Poisoning and Spoilage

**Mechanics:**
- `spoilage_rate` counts down each turn
- Spoiled food causes `metabolism:food_poisoning` component
- Poisoning reduces energy absorption efficiency
- Health damage over time

**Implementation:**

```javascript
// Per turn for food items
if (fuelSource.spoilage_rate > 0) {
  fuelSource.turns_until_spoiled = Math.max(0, fuelSource.turns_until_spoiled - 1);

  if (fuelSource.turns_until_spoiled === 0) {
    await addComponent(itemId, 'metabolism:spoiled', {
      poison_severity: 'mild'
    });
  }
}
```

---

### 5. Metabolic Diseases and Conditions

**Examples:**
- Diabetes (slow energy absorption)
- Fast metabolism (higher burn rate)
- Slow metabolism (lower burn rate, easier weight gain)
- Food allergies (certain fuel_tags cause damage)

**Implementation:**

```json
{
  "metabolism:condition": {
    "type": "diabetes",
    "effects": {
      "conversion_rate_modifier": 0.7,
      "max_buffer_modifier": 0.8
    }
  }
}
```

---

### 6. Exercise and Muscle Building

**Integration with Exercise Mods:**
- High activity increases muscle mass
- Muscle mass increases base burn rate
- Protein requirements for muscle growth
- Athletic performance bonuses

---

### 7. Sleep and Rest System

**Combined with Metabolism:**
- Sleep reduces burn rate (0.5x)
- Sleep increases digestion efficiency
- Sleep deprivation increases burn rate
- Energy recovery during sleep

---

### 8. Temperature and Environment

**Environmental Effects:**
- Cold environments increase burn rate
- Hot environments increase thirst rate
- Shelter reduces environmental penalties

---

## Glossary

**Buffer Storage:** Fuel waiting in converter (stomach) to be processed
**Burn Rate:** Energy consumed per turn
**Conversion Rate:** Fuel converted to energy per turn
**Efficiency:** Percentage of fuel actually converted (rest is waste)
**Energy Reserve:** Usable energy for actions
**Fuel Converter:** Organ/system that digests fuel (stomach, fuel tank, etc.)
**Fuel Source:** Consumable item that provides energy
**Fuel Tags:** Categories indicating what can consume an item
**Hunger State:** Threshold-based gameplay state (satiated, hungry, starving, etc.)
**Metabolic Store:** Entity's energy tank and burn parameters
**Predicted Energy:** Current energy + buffered energy (for GOAP)

---

## Appendix A: File Checklist

### Components (4 files)
- [ ] `data/mods/metabolism/components/fuel_converter.component.json`
- [ ] `data/mods/metabolism/components/fuel_source.component.json`
- [ ] `data/mods/metabolism/components/metabolic_store.component.json`
- [ ] `data/mods/metabolism/components/hunger_state.component.json`

### Operation Schemas (5 files)
- [ ] `data/schemas/operations/burnEnergy.schema.json`
- [ ] `data/schemas/operations/digestFood.schema.json`
- [ ] `data/schemas/operations/consumeItem.schema.json`
- [ ] `data/schemas/operations/updateHungerState.schema.json`
- [ ] `data/schemas/operations/updateBodyComposition.schema.json`

### Operation Handlers (5 files)
- [ ] `src/logic/operationHandlers/burnEnergyHandler.js`
- [ ] `src/logic/operationHandlers/digestFoodHandler.js`
- [ ] `src/logic/operationHandlers/consumeItemHandler.js`
- [ ] `src/logic/operationHandlers/updateHungerStateHandler.js`
- [ ] `src/logic/operationHandlers/updateBodyCompositionHandler.js`

### Actions (3 files)
- [ ] `data/mods/metabolism/actions/eat.action.json`
- [ ] `data/mods/metabolism/actions/drink.action.json`
- [ ] `data/mods/metabolism/actions/rest.action.json`

### Rules (6 files)
- [ ] `data/mods/metabolism/rules/turn_energy_burn.rule.json`
- [ ] `data/mods/metabolism/rules/turn_digestion.rule.json`
- [ ] `data/mods/metabolism/rules/turn_hunger_update.rule.json`
- [ ] `data/mods/metabolism/rules/handle_eat.rule.json`
- [ ] `data/mods/metabolism/rules/handle_drink.rule.json`
- [ ] `data/mods/metabolism/rules/handle_rest.rule.json`

### Conditions (4 files)
- [ ] `data/mods/metabolism/conditions/has_energy_above.condition.json`
- [ ] `data/mods/metabolism/conditions/is_hungry.condition.json`
- [ ] `data/mods/metabolism/conditions/can_consume.condition.json`
- [ ] `data/mods/metabolism/conditions/is_digesting.condition.json`

### Scopes (3 files)
- [ ] `data/mods/metabolism/scopes/nearby_food.scope`
- [ ] `data/mods/metabolism/scopes/consumable_items.scope`
- [ ] `data/mods/metabolism/scopes/inventory_food.scope`

### JSON Logic Operators (3 files)
- [ ] `src/logic/operators/isHungryOperator.js`
- [ ] `src/logic/operators/predictedEnergyOperator.js`
- [ ] `src/logic/operators/canConsumeOperator.js`

### DI Registration Updates
- [ ] Add tokens to `src/dependencyInjection/tokens/tokens-core.js`
- [ ] Add factories to `src/dependencyInjection/registrations/operationHandlerRegistrations.js`
- [ ] Add mappings to `src/dependencyInjection/registrations/interpreterRegistrations.js`
- [ ] Add to whitelist in `src/utils/preValidationUtils.js`

### Sample Entities (3 files)
- [ ] `data/mods/metabolism/entities/definitions/bread.entity.json`
- [ ] `data/mods/metabolism/entities/definitions/water.entity.json`
- [ ] `data/mods/metabolism/entities/definitions/steak.entity.json`

### Configuration
- [ ] `data/mods/metabolism/mod-manifest.json`
- [ ] `data/mods/metabolism/config/hunger_thresholds.json` (optional)

### Tests
- [ ] Unit tests for all 5 operation handlers
- [ ] Integration tests for eat/drink/rest actions
- [ ] E2E test for complete hunger cycle
- [ ] GOAP integration tests
- [ ] Performance tests for turn processing

---

## Document History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2025-11-20 | Initial specification | System Architect |

---

**End of Specification**
