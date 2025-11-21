# HUNMETSYS-020: Documentation & Examples

**Status**: Not Started  
**Priority**: Low  
**Estimated Effort**: 1-2 days  
**Dependencies**: HUNMETSYS-001 through HUNMETSYS-019

---

## Objective

Create comprehensive documentation and practical examples for the Hunger and Metabolism System, enabling modders and developers to understand, extend, and maintain the system effectively.

---

## Context

With the Hunger and Metabolism System fully implemented and tested (HUNMETSYS-001 through HUNMETSYS-019), this final ticket focuses on creating high-quality documentation and examples that demonstrate:

1. **How the system works** - conceptual overview and architecture
2. **How to use the system** - modder guide for creating food items and metabolic entities
3. **How to extend the system** - developer guide for adding new features
4. **Real-world examples** - practical scenarios and use cases

From **specs/hunger-metabolism-system.md § Documentation Requirements**:

> "Complete documentation should include conceptual overviews, API references, integration guides, and practical examples that enable both modders and developers to work with the system effectively."

---

## Files to Touch

### Documentation Files to Create

**User-Facing Documentation** (`docs/modding/`):
- `docs/modding/hunger-metabolism-guide.md` - Comprehensive modder guide
- `docs/modding/food-item-creation.md` - Creating consumable items
- `docs/modding/metabolic-entity-setup.md` - Setting up actors with metabolism

**Developer Documentation** (`docs/development/`):
- `docs/development/metabolism-system-architecture.md` - System architecture overview
- `docs/development/metabolism-operation-handlers.md` - Operation handler reference
- `docs/development/metabolism-json-logic-operators.md` - JSON Logic operator reference
- `docs/development/extending-metabolism-system.md` - Adding new features

**Examples** (`examples/metabolism/`):
- `examples/metabolism/basic-food-items.json` - Simple food entity examples
- `examples/metabolism/complex-meals.json` - Multi-component meals
- `examples/metabolism/survival-scenario.json` - Complete survival game setup
- `examples/metabolism/custom-fuel-types.json` - Extending with new fuel types

### Existing Files to Update

- `README.md` - Add metabolism system to feature list
- `docs/README.md` - Add links to metabolism documentation
- `docs/systems-overview.md` - Add metabolism system section

---

## Implementation Details

### Step 1: Modder Documentation

**Hunger Metabolism Guide** (`docs/modding/hunger-metabolism-guide.md`):

```markdown
# Hunger and Metabolism System - Modder Guide

## Overview

The Hunger and Metabolism System simulates energy consumption, digestion, and hunger states for entities in your game world. It provides:

- **Energy Management**: Entities consume energy through activities and replenish it by eating/drinking
- **Digestion System**: Food is processed over time through a buffer storage mechanism
- **Hunger States**: Automatic state transitions (satiated → neutral → hungry → starving → critical)
- **Body Composition**: Long-term hunger affects entity appearance through anatomy changes
- **GOAP Integration**: AI autonomously seeks food when hungry

## Core Concepts

### Energy Flow

```
Food Item → Consume → Buffer Storage → Digest → Current Energy → Burn → Activities
```

1. **Consumption**: Entity consumes food item, adding energy to buffer storage
2. **Digestion**: Buffer energy transfers to current energy over time (per turn)
3. **Energy Burn**: Activities consume current energy (walking, running, combat)
4. **Hunger States**: System updates hunger state based on current energy percentage

### Components

#### Fuel Converter (metabolism:fuel_converter)

Defines what an entity can consume and how efficiently they convert fuel to energy.

```json
{
  "metabolism:fuel_converter": {
    "fuel_types": ["solid", "liquid"],
    "efficiency": 0.8
  }
}
```

- **fuel_types**: Array of fuel types this entity can consume (e.g., "solid", "liquid", "gaseous")
- **efficiency**: Percentage of buffer energy converted to current energy per turn (0.0-1.0)

#### Metabolic Store (metabolism:metabolic_store)

Tracks an entity's current energy, buffer storage, and maximum capacity.

```json
{
  "metabolism:metabolic_store": {
    "current_energy": 800,
    "buffer_storage": 200,
    "max_energy": 1000
  }
}
```

- **current_energy**: Available energy for activities
- **buffer_storage**: Energy waiting to be digested (from recently consumed food)
- **max_energy**: Maximum energy capacity

#### Fuel Source (metabolism:fuel_source)

Defines how much energy a consumable item provides.

```json
{
  "metabolism:fuel_source": {
    "fuel_type": "solid",
    "energy_value": 500
  }
}
```

- **fuel_type**: Type of fuel ("solid", "liquid", etc.)
- **energy_value**: Total energy provided when consumed

#### Hunger State (metabolism:hunger_state)

Tracks the entity's current hunger level (automatically updated by the system).

```json
{
  "metabolism:hunger_state": {
    "state": "neutral",
    "turns_in_state": 5
  }
}
```

- **state**: Current hunger level (gluttonous, satiated, neutral, hungry, starving, critical)
- **turns_in_state**: How many turns entity has been in current state

### Hunger State Thresholds

| State | Energy Range | Description |
|-------|-------------|-------------|
| **gluttonous** | >100% | Energy exceeds maximum (temporary after overeating) |
| **satiated** | 75-100% | Well-fed, no hunger |
| **neutral** | 30-75% | Normal state, not hungry yet |
| **hungry** | 10-30% | Needs food soon |
| **starving** | 0.1-10% | Critical hunger, body deteriorating |
| **critical** | 0-0.1% | Near death from starvation |

## Creating Food Items

### Simple Food Item (Bread)

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "metabolism:bread",
  "components": {
    "core:name": { "value": "bread" },
    "core:description": { "value": "A fresh loaf of bread" },
    "items:item": { "weight": 0.5, "value": 2 },
    "metabolism:fuel_source": {
      "fuel_type": "solid",
      "energy_value": 500
    }
  }
}
```

**Key Points**:
- All food items need `metabolism:fuel_source` component
- `fuel_type` must match consumer's `fuel_types` array
- `energy_value` determines how filling the item is

### Liquid Food (Water)

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "metabolism:water",
  "components": {
    "core:name": { "value": "water" },
    "core:description": { "value": "A flask of clean water" },
    "items:item": { "weight": 1.0, "value": 1 },
    "metabolism:fuel_source": {
      "fuel_type": "liquid",
      "energy_value": 100
    }
  }
}
```

**Key Points**:
- Use `"fuel_type": "liquid"` for drinks
- Typically lower energy values than solid food
- Consumers need `"liquid"` in their `fuel_types` array

### High-Energy Food (Steak)

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "metabolism:steak",
  "components": {
    "core:name": { "value": "cooked steak" },
    "core:description": { "value": "A juicy, well-cooked steak" },
    "items:item": { "weight": 0.8, "value": 10 },
    "metabolism:fuel_source": {
      "fuel_type": "solid",
      "energy_value": 800
    }
  }
}
```

**Key Points**:
- Higher `energy_value` for more filling foods
- Consider item weight and value for game balance

## Setting Up Metabolic Entities

### Basic Actor with Metabolism

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "game:survivor",
  "components": {
    "core:actor": {},
    "core:name": { "value": "Survivor" },
    "metabolism:fuel_converter": {
      "fuel_types": ["solid", "liquid"],
      "efficiency": 0.8
    },
    "metabolism:metabolic_store": {
      "current_energy": 800,
      "buffer_storage": 0,
      "max_energy": 1000
    },
    "metabolism:hunger_state": {
      "state": "neutral",
      "turns_in_state": 0
    }
  }
}
```

**Required Components**:
1. `metabolism:fuel_converter` - What the actor can eat and efficiency
2. `metabolism:metabolic_store` - Energy tracking
3. `metabolism:hunger_state` - Hunger level (system updates automatically)

### Actor with Body Composition Integration

If your actor has the anatomy system, hunger affects their appearance:

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "game:character",
  "components": {
    "core:actor": {},
    "anatomy:body": {
      "composition": "average"
    },
    "metabolism:fuel_converter": {
      "fuel_types": ["solid", "liquid"],
      "efficiency": 0.75
    },
    "metabolism:metabolic_store": {
      "current_energy": 600,
      "buffer_storage": 0,
      "max_energy": 1000
    },
    "metabolism:hunger_state": {
      "state": "neutral",
      "turns_in_state": 0
    }
  }
}
```

**Body Composition Changes**:
- **20+ turns in critical state** → composition becomes "desiccated"
- **30+ turns in starving state** → composition becomes "wasted"
- **50+ turns in gluttonous state** → composition becomes "overweight"

## Using Actions

The system provides three built-in actions:

### Eat Action (metabolism:eat)

Allows actor to consume solid food items.

```json
// Rule example (already implemented in metabolism mod)
{
  "rule_id": "metabolism:handle_eat",
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
    }
  ]
}
```

**Usage**: Actor selects food item → Execute eat action → Item consumed, energy added to buffer

### Drink Action (metabolism:drink)

Allows actor to consume liquid items.

**Usage**: Same as eat, but targets items with `"fuel_type": "liquid"`

### Rest Action (metabolism:rest)

Reduces energy burn rate for one turn.

**Usage**: Actor rests → Energy burn reduced by 50% for that turn

## AI Integration (GOAP)

The system includes a GOAP goal that makes AI actors autonomously seek food when hungry.

### Goal: Satisfy Hunger (metabolism:satisfy_hunger)

**Activation Conditions**:
- Actor's `is_hungry` operator returns true (states: hungry, starving, critical)
- OR predicted energy (current + buffer × efficiency) < 500

**Desired State**:
- Actor is not hungry
- AND predicted energy > 700

**What the AI Does**:
1. Detects hunger
2. Finds nearby food using scopes (in inventory, in room, in containers)
3. Plans action sequence: navigate → pick up → eat
4. Executes plan
5. Goal satisfied when hunger returns to neutral/satiated

### Custom GOAP Goals

You can create custom goals that use metabolism:

```json
{
  "goal_id": "game:prepare_meal",
  "priority": 7,
  "conditions": {
    "activate_when": {
      "and": [
        {"is_hungry": ["{self}"]},
        {"has_component": ["{self}", "skills:cooking"]}
      ]
    },
    "desired_state": {
      "and": [
        {"not": {"is_hungry": ["{self}"]}},
        {"has_component": ["{self}", "game:prepared_meal"]}
      ]
    }
  }
}
```

## Balancing Tips

### Energy Values

Recommended energy values for different food types:

| Food Type | Energy Value | Real-World Equivalent |
|-----------|-------------|----------------------|
| **Snack** | 100-300 | Apple, crackers |
| **Light Meal** | 400-600 | Sandwich, salad |
| **Full Meal** | 700-1000 | Steak dinner, large pasta dish |
| **Feast** | 1200+ | Multi-course meal |

### Activity Multipliers

Standard energy burn for activities (from spec):

| Activity | Multiplier | Energy/Turn (base 50) |
|----------|-----------|----------------------|
| **Idle** | 1.0x | 50 |
| **Walking** | 1.2x | 60 |
| **Running** | 2.0x | 100 |
| **Combat** | 2.5x | 125 |
| **Ballet/Gymnastics** | 3.0x | 150 |

### Efficiency Recommendations

- **Normal humans**: 0.75-0.85 efficiency
- **Athletes/trained**: 0.85-0.95 efficiency
- **Diseased/injured**: 0.50-0.70 efficiency
- **Supernatural beings**: 0.95-1.0 efficiency

### Max Energy

Typical max_energy values:

- **Children**: 600-800
- **Adult humans**: 800-1200
- **Athletes**: 1200-1500
- **Large creatures**: 1500-2500

## Troubleshooting

### "Actor won't eat food"

**Check**:
1. Does food item have `metabolism:fuel_source` component?
2. Does actor have `metabolism:fuel_converter` component?
3. Does actor's `fuel_types` array include the food's `fuel_type`?
4. Is food item in actor's inventory or accessible location?

### "Hunger state not updating"

**Check**:
1. Are turn-based rules firing? (metabolism:process_turn_hunger_update)
2. Does entity have `metabolism:hunger_state` component?
3. Is `metabolism:metabolic_store` component properly configured?

### "Energy not increasing after eating"

**Check**:
1. Energy goes to **buffer storage** first, not current energy
2. Digestion happens per turn (check `core:turn_ended` event firing)
3. Verify `fuel_converter.efficiency` is > 0

### "Body composition not changing"

**Check**:
1. Does entity have `anatomy:body` component? (required for visual changes)
2. Has entity been in extreme state long enough? (20+ turns for critical, 30+ for starving, 50+ for gluttonous)
3. Are turn-based rules processing? (metabolism:process_turn_body_composition)

## Further Reading

- **Developer Guide**: `docs/development/metabolism-system-architecture.md`
- **Operation Handlers**: `docs/development/metabolism-operation-handlers.md`
- **JSON Logic Operators**: `docs/development/metabolism-json-logic-operators.md`
- **Examples**: `examples/metabolism/`
```

### Step 2: Developer Documentation

**System Architecture** (`docs/development/metabolism-system-architecture.md`):

```markdown
# Hunger and Metabolism System - Architecture

## Overview

The Hunger and Metabolism System is a turn-based energy management system integrated with the Living Narrative Engine's ECS architecture, event bus, JSON Logic evaluation, and GOAP AI planning.

## System Components

### Component Definitions

| Component | Purpose | Schema Location |
|-----------|---------|----------------|
| `metabolism:fuel_converter` | Defines consumption capabilities | `data/schemas/components/fuel_converter.component.json` |
| `metabolism:fuel_source` | Defines energy provided by items | `data/schemas/components/fuel_source.component.json` |
| `metabolism:metabolic_store` | Tracks energy state | `data/schemas/components/metabolic_store.component.json` |
| `metabolism:hunger_state` | Tracks hunger level | `data/schemas/components/hunger_state.component.json` |

### Operation Handlers

| Handler | Purpose | Location |
|---------|---------|----------|
| `BurnEnergyHandler` | Reduces current energy | `src/logic/operationHandlers/burnEnergyHandler.js` |
| `DigestFoodHandler` | Transfers buffer to current | `src/logic/operationHandlers/digestFoodHandler.js` |
| `ConsumeItemHandler` | Adds item energy to buffer | `src/logic/operationHandlers/consumeItemHandler.js` |
| `UpdateHungerStateHandler` | Updates hunger level | `src/logic/operationHandlers/updateHungerStateHandler.js` |
| `UpdateBodyCompositionHandler` | Modifies anatomy | `src/logic/operationHandlers/updateBodyCompositionHandler.js` |

### JSON Logic Operators

| Operator | Purpose | Location |
|----------|---------|----------|
| `is_hungry` | Check if entity needs food | `src/logic/operators/isHungryOperator.js` |
| `predicted_energy` | Calculate future energy | `src/logic/operators/predictedEnergyOperator.js` |
| `can_consume` | Check if item consumable | `src/logic/operators/canConsumeOperator.js` |

## Data Flow

### Consumption Flow

```
User Action: "Eat bread"
  ↓
Event: core:attempt_action { actionId: "metabolism:eat", actorId, targetId }
  ↓
Rule: metabolism:handle_eat (event_type: core:attempt_action)
  ↓
Operation: CONSUME_ITEM { consumer_ref, item_ref }
  ↓
Handler: ConsumeItemHandler.execute()
  ↓
  1. Validate consumer has fuel_converter
  2. Validate item has fuel_source
  3. Check fuel_type compatibility
  4. Add fuel_source.energy_value to metabolic_store.buffer_storage
  5. Destroy item entity
  6. Dispatch: metabolism:item_consumed event
  ↓
Event: core:action_completed { success: true }
```

### Turn-Based Processing Flow

```
Event: core:turn_ended
  ↓
Rule: metabolism:process_turn_digestion
  ↓
Operation: DIGEST_FOOD (for all entities with metabolic_store)
  ↓
Handler: DigestFoodHandler.execute()
  ↓
  1. Calculate transfer: buffer_storage × fuel_converter.efficiency
  2. Add to current_energy (clamped at max_energy)
  3. Reduce buffer_storage by transferred amount
  4. Dispatch: metabolism:digestion_processed event

  ↓ (parallel)

Rule: metabolism:process_turn_burn
  ↓
Operation: BURN_ENERGY (for all entities with metabolic_store)
  ↓
Handler: BurnEnergyHandler.execute()
  ↓
  1. Calculate burn: base_burn (50) × activity_multiplier
  2. Reduce current_energy by burn amount (clamped at 0)
  3. Dispatch: metabolism:energy_burned event

  ↓ (after burn and digestion)

Rule: metabolism:process_turn_hunger_update
  ↓
Operation: UPDATE_HUNGER_STATE (for all entities)
  ↓
Handler: UpdateHungerStateHandler.execute()
  ↓
  1. Calculate energy_percentage: current_energy / max_energy
  2. Map to hunger state (see thresholds below)
  3. Update hunger_state.state
  4. Increment or reset turns_in_state
  5. Dispatch: metabolism:hunger_state_changed event

  ↓ (after hunger update, if needed)

Rule: metabolism:process_turn_body_composition
  ↓
Operation: UPDATE_BODY_COMPOSITION (for entities with anatomy:body)
  ↓
Handler: UpdateBodyCompositionHandler.execute()
  ↓
  1. Check hunger_state.state and turns_in_state
  2. If threshold met, update anatomy:body.composition
  3. Dispatch: metabolism:body_composition_changed event
```

### GOAP Integration Flow

```
AI Planner: Evaluate goals
  ↓
Goal: metabolism:satisfy_hunger
  ↓
Activation Check: is_hungry OR predicted_energy < 500
  ↓
Scope Query: metabolism:available_food (inventory + room + containers)
  ↓
Action Discovery: metabolism:eat (available for each food item)
  ↓
Planner: Generate action sequence
  1. navigate_to (if food not in inventory)
  2. pick_up_item (if food not in inventory)
  3. eat (consume food)
  ↓
Execute Plan
  ↓
Goal Satisfied: NOT is_hungry AND predicted_energy > 700
```

## Hunger State Thresholds (Implementation)

```javascript
// From UpdateHungerStateHandler

function calculateHungerState(energyPercentage) {
  if (energyPercentage > 1.0) return 'gluttonous';
  if (energyPercentage >= 0.75) return 'satiated';
  if (energyPercentage >= 0.30) return 'neutral';
  if (energyPercentage >= 0.10) return 'hungry';
  if (energyPercentage > 0.001) return 'starving';
  return 'critical';
}
```

## Body Composition Thresholds (Implementation)

```javascript
// From UpdateBodyCompositionHandler

const BODY_COMPOSITION_THRESHOLDS = {
  critical: { turns: 20, composition: 'desiccated' },
  starving: { turns: 30, composition: 'wasted' },
  gluttonous: { turns: 50, composition: 'overweight' }
};

function shouldUpdateBodyComposition(hungerState) {
  const threshold = BODY_COMPOSITION_THRESHOLDS[hungerState.state];
  return threshold && hungerState.turns_in_state >= threshold.turns;
}
```

## Event Schema

### Dispatched Events

| Event Type | Payload | Purpose |
|-----------|---------|---------|
| `metabolism:item_consumed` | `{ actorId, itemId, energyGained }` | Item was eaten/drunk |
| `metabolism:digestion_processed` | `{ entityId, energyTransferred }` | Buffer → current transfer |
| `metabolism:energy_burned` | `{ entityId, amountBurned }` | Energy consumed by activity |
| `metabolism:hunger_state_changed` | `{ entityId, oldState, newState }` | Hunger level changed |
| `metabolism:body_composition_changed` | `{ entityId, composition }` | Body appearance changed |
| `metabolism:energy_depleted` | `{ entityId }` | Energy reached zero |

## Dependency Injection

### Tokens

```javascript
// From tokens-core.js

export const tokens = {
  // ... existing tokens
  BurnEnergyHandler: 'BurnEnergyHandler',
  DigestFoodHandler: 'DigestFoodHandler',
  ConsumeItemHandler: 'ConsumeItemHandler',
  UpdateHungerStateHandler: 'UpdateHungerStateHandler',
  UpdateBodyCompositionHandler: 'UpdateBodyCompositionHandler',
  IsHungryOperator: 'IsHungryOperator',
  PredictedEnergyOperator: 'PredictedEnergyOperator',
  CanConsumeOperator: 'CanConsumeOperator'
};
```

### Registration

```javascript
// From operationHandlerRegistrations.js

export function registerOperationHandlers(container) {
  const handlerFactories = [
    // ... existing handlers
    {
      token: tokens.BurnEnergyHandler,
      factory: ({ logger, entityManager, eventBus }) =>
        new BurnEnergyHandler({ logger, entityManager, eventBus })
    },
    // ... (similar for other handlers)
  ];
  
  handlerFactories.forEach(({ token, factory }) => {
    container.register(token, factory);
  });
}
```

## Extension Points

### Adding New Fuel Types

1. **No code changes required** - fuel types are data-driven
2. Update entity definitions:
   - Add new `fuel_type` to food items
   - Add to consumers' `fuel_types` array

Example: Adding "magical" fuel type

```json
// In food item
{
  "metabolism:fuel_source": {
    "fuel_type": "magical",
    "energy_value": 1500
  }
}

// In consumer
{
  "metabolism:fuel_converter": {
    "fuel_types": ["solid", "liquid", "magical"],
    "efficiency": 0.9
  }
}
```

### Adding New Hunger States

1. Update `UpdateHungerStateHandler.js`:
   ```javascript
   function calculateHungerState(energyPercentage) {
     if (energyPercentage > 1.2) return 'overfed'; // New state
     if (energyPercentage > 1.0) return 'gluttonous';
     // ... existing states
   }
   ```

2. Update schema `data/schemas/components/hunger_state.component.json`:
   ```json
   {
     "properties": {
       "state": {
         "type": "string",
         "enum": ["overfed", "gluttonous", "satiated", "neutral", "hungry", "starving", "critical"]
       }
     }
   }
   ```

### Adding New Operations

To add metabolism-related operations:

1. Create operation schema in `data/schemas/operations/`
2. Add schema reference to `data/schemas/operation.schema.json`
3. Implement handler in `src/logic/operationHandlers/`
4. Define DI token in `src/dependencyInjection/tokens/tokens-core.js`
5. Register factory in `src/dependencyInjection/registrations/operationHandlerRegistrations.js`
6. Map operation to handler in `src/dependencyInjection/registrations/interpreterRegistrations.js`
7. Add to pre-validation whitelist in `src/utils/preValidationUtils.js`

### Adding Custom Energy Costs

Energy costs are configured in action rules using the `activity_multiplier` parameter:

```json
{
  "rule_id": "game:handle_sprint",
  "event_type": "core:attempt_action",
  "condition": {
    "==": ["{event.payload.actionId}", "game:sprint"]
  },
  "actions": [
    {
      "type": "BURN_ENERGY",
      "parameters": {
        "entity_ref": "{event.payload.actorId}",
        "amount": 50,
        "activity_multiplier": 2.5
      }
    }
  ]
}
```

## Performance Considerations

### Turn Processing

- **Parallel processing**: Digestion, burn, and state updates are independent
- **Batch operations**: Process all entities in single pass
- **Event throttling**: Limit event dispatching for performance-critical loops

### Memory Management

- **Component cleanup**: Destroyed items properly remove components
- **Event cleanup**: Short-lived events cleaned up after processing
- **Cache invalidation**: Component caches invalidated on state changes

### Optimization Strategies

- Use `entityManager.getComponentsOfType()` for batch processing
- Cache frequently accessed components
- Minimize event payload size
- Defer non-critical updates (body composition) to reduce per-turn cost

## Testing Architecture

### Unit Tests

- Each operation handler has dedicated test file
- Mock all dependencies (logger, eventBus, entityManager)
- Test happy path, error paths, edge cases

### Integration Tests

- Test complete workflows (eat → digest → burn → state update)
- Test GOAP integration
- Test multi-actor scenarios
- Test performance benchmarks

### Coverage Requirements

- Branch coverage: ≥80%
- Function coverage: ≥90%
- Line coverage: ≥90%

See `docs/testing/` for detailed testing guides.
```

### Step 3: Practical Examples

**Basic Food Items** (`examples/metabolism/basic-food-items.json`):

```json
{
  "$schema": "schema://living-narrative-engine/entity-definitions-collection.schema.json",
  "entities": [
    {
      "$comment": "Simple solid food - bread",
      "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
      "id": "examples:bread",
      "components": {
        "core:name": { "value": "bread" },
        "core:description": { "value": "A fresh loaf of bread" },
        "items:item": { "weight": 0.5, "value": 2 },
        "metabolism:fuel_source": {
          "fuel_type": "solid",
          "energy_value": 500
        }
      }
    },
    {
      "$comment": "Liquid consumable - water",
      "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
      "id": "examples:water",
      "components": {
        "core:name": { "value": "water" },
        "core:description": { "value": "A flask of clean water" },
        "items:item": { "weight": 1.0, "value": 1 },
        "metabolism:fuel_source": {
          "fuel_type": "liquid",
          "energy_value": 100
        }
      }
    },
    {
      "$comment": "High-energy food - steak",
      "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
      "id": "examples:steak",
      "components": {
        "core:name": { "value": "cooked steak" },
        "core:description": { "value": "A juicy, well-cooked steak" },
        "items:item": { "weight": 0.8, "value": 10 },
        "metabolism:fuel_source": {
          "fuel_type": "solid",
          "energy_value": 800
        }
      }
    },
    {
      "$comment": "Snack food - apple",
      "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
      "id": "examples:apple",
      "components": {
        "core:name": { "value": "apple" },
        "core:description": { "value": "A crisp, red apple" },
        "items:item": { "weight": 0.2, "value": 1 },
        "metabolism:fuel_source": {
          "fuel_type": "solid",
          "energy_value": 200
        }
      }
    },
    {
      "$comment": "Low-efficiency food - raw meat (harder to digest)",
      "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
      "id": "examples:raw_meat",
      "components": {
        "core:name": { "value": "raw meat" },
        "core:description": { "value": "A piece of uncooked meat" },
        "items:item": { "weight": 0.7, "value": 5 },
        "metabolism:fuel_source": {
          "fuel_type": "solid",
          "energy_value": 600
        },
        "$comment_efficiency": "Note: This provides 600 energy, but a consumer with 0.5 efficiency would only get 300 per turn from buffer"
      }
    }
  ]
}
```

**Survival Scenario** (`examples/metabolism/survival-scenario.json`):

```json
{
  "$comment": "Complete survival game setup with metabolism",
  "$schema": "schema://living-narrative-engine/scenario.schema.json",
  "scenario_id": "examples:survival_scenario",
  "entities": [
    {
      "$comment": "Survivor character with metabolism",
      "id": "scenario:survivor",
      "components": {
        "core:actor": {},
        "core:name": { "value": "Alex" },
        "core:description": { "value": "A resourceful survivor" },
        "anatomy:body": {
          "composition": "average",
          "height": "average",
          "build": "athletic"
        },
        "metabolism:fuel_converter": {
          "fuel_types": ["solid", "liquid"],
          "efficiency": 0.8
        },
        "metabolism:metabolic_store": {
          "current_energy": 400,
          "buffer_storage": 0,
          "max_energy": 1000
        },
        "metabolism:hunger_state": {
          "state": "hungry",
          "turns_in_state": 0
        },
        "$comment": "Character starts hungry to demonstrate hunger system"
      }
    },
    {
      "$comment": "Food items scattered in environment",
      "id": "scenario:canned_beans",
      "components": {
        "core:name": { "value": "canned beans" },
        "core:description": { "value": "An old can of beans, still edible" },
        "positioning:location": { "location_id": "scenario:shelter" },
        "items:item": { "weight": 0.6, "value": 3 },
        "metabolism:fuel_source": {
          "fuel_type": "solid",
          "energy_value": 600
        }
      }
    },
    {
      "id": "scenario:stream_water",
      "components": {
        "core:name": { "value": "stream water" },
        "core:description": { "value": "Fresh water from a nearby stream" },
        "positioning:location": { "location_id": "scenario:forest" },
        "items:item": { "weight": 1.5, "value": 1 },
        "metabolism:fuel_source": {
          "fuel_type": "liquid",
          "energy_value": 50
        }
      }
    },
    {
      "id": "scenario:wild_berries",
      "components": {
        "core:name": { "value": "wild berries" },
        "core:description": { "value": "A handful of edible berries" },
        "positioning:location": { "location_id": "scenario:forest" },
        "items:item": { "weight": 0.1, "value": 2 },
        "metabolism:fuel_source": {
          "fuel_type": "solid",
          "energy_value": 150
        }
      }
    }
  ],
  "initial_state": {
    "$comment": "Scenario starts with survivor hungry and needing to find food",
    "survivor_location": "scenario:shelter",
    "time_of_day": "morning",
    "turns_survived": 0
  },
  "objectives": [
    {
      "id": "survive_7_days",
      "description": "Survive for 7 days without starving",
      "success_condition": {
        "and": [
          { ">=": ["{scenario_state.turns_survived}", 168] },
          { "not": { "==": ["{entity:scenario:survivor.metabolism:hunger_state.state}", "critical"] } }
        ]
      }
    },
    {
      "id": "maintain_health",
      "description": "Keep body composition from deteriorating",
      "success_condition": {
        "!=": ["{entity:scenario:survivor.anatomy:body.composition}", "wasted"]
      }
    }
  ],
  "$comment": "This scenario demonstrates: hunger-driven gameplay, food scarcity, resource management, and survival mechanics"
}
```

### Step 4: README Updates

**Update main README.md**:

```markdown
### Hunger and Metabolism System

Realistic energy management and survival mechanics:

- **Energy System**: Turn-based energy consumption and replenishment
- **Digestion**: Food processes through buffer storage over time
- **Hunger States**: Automatic state transitions from satiated to critical
- **Body Effects**: Long-term hunger affects character appearance
- **AI Integration**: NPCs autonomously seek food when hungry via GOAP

See [Hunger Metabolism Guide](docs/modding/hunger-metabolism-guide.md) for details.
```

---

## Out of Scope

- **Video tutorials** - documentation is text/code-based only
- **Interactive examples** - examples are JSON definitions, not playable scenarios
- **API reference generator** - manual documentation only
- **Localization** - documentation in English only
- **Code comments** - this ticket focuses on external documentation, not inline comments

---

## Acceptance Criteria

### Documentation Completeness

- [ ] Modder guide created and covers all common use cases
- [ ] Developer architecture document created
- [ ] Operation handler reference created
- [ ] JSON Logic operator reference created
- [ ] Extension guide created
- [ ] All examples functional and tested

### Documentation Quality

- [ ] Clear, beginner-friendly language in modder guide
- [ ] Technical accuracy in developer documentation
- [ ] Code examples are syntactically correct and tested
- [ ] All cross-references and links work correctly
- [ ] Troubleshooting section addresses common issues

### Examples Quality

- [ ] Basic examples cover common food item types
- [ ] Complex examples demonstrate advanced features
- [ ] Survival scenario is complete and functional
- [ ] All examples follow project conventions
- [ ] Examples validated against schemas

### Integration

- [ ] README.md updated with metabolism system section
- [ ] `docs/README.md` links to new documentation
- [ ] `docs/systems-overview.md` includes metabolism section
- [ ] All documentation indexed and discoverable

---

## Testing Strategy

### Documentation Testing

**Validation**:
```bash
# Validate all JSON examples
npm run validate:examples

# Check markdown formatting
npm run lint:docs

# Verify all links
npm run check:links
```

**Example Testing**:
- Load each example entity definition
- Verify schemas validate
- Test example scenarios end-to-end
- Confirm code snippets in docs are accurate

---

## References

### Specification Sections

- **specs/hunger-metabolism-system.md § Documentation Requirements** (Lines 1490-1530)
- **specs/hunger-metabolism-system.md § Complete System Overview** (All sections)

### Related Tickets

- **HUNMETSYS-000**: Overview providing documentation structure
- **HUNMETSYS-001 through HUNMETSYS-019**: All implementation details to document

### Project Documentation Standards

- **docs/README.md**: Documentation structure and guidelines
- **CLAUDE.md § Documentation**: Project documentation requirements
- **docs/modding/**: Existing modder documentation patterns

---

## Implementation Notes

### Documentation Writing Tips

- **Start with use cases**: Show practical examples before diving into theory
- **Progressive disclosure**: Simple concepts first, advanced topics later
- **Code-heavy**: Developers prefer code examples over lengthy prose
- **Troubleshooting-first**: Address common problems prominently

### Example Quality Standards

- All examples must validate against schemas
- Examples should demonstrate ONE concept clearly
- Include comments explaining non-obvious choices
- Use realistic, relatable scenarios (food, survival, etc.)

### Maintenance Strategy

- Documentation should be updated when features change
- Examples should be version-controlled alongside code
- Broken examples are bugs, not documentation issues

---

## Completion Checklist

- [ ] Modder guide written and reviewed
- [ ] Developer architecture doc written
- [ ] Operation handler reference written
- [ ] JSON Logic operator reference written
- [ ] Extension guide written
- [ ] Basic examples created and tested
- [ ] Complex examples created and tested
- [ ] Survival scenario created and tested
- [ ] README.md updated
- [ ] `docs/README.md` updated
- [ ] `docs/systems-overview.md` updated
- [ ] All markdown files linted
- [ ] All links validated
- [ ] All JSON examples validated
- [ ] Peer review completed
