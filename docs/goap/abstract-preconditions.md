# Abstract Preconditions Catalog

## Overview

Abstract preconditions are reusable condition functions used in conditional planning effects. They represent conditions that cannot be fully evaluated during static analysis but must be simulated or deferred to runtime during planning.

## What Are Abstract Preconditions?

Abstract preconditions are named, parameterized functions that:

1. **Represent Runtime Conditions**: Conditions that depend on world state not available during analysis
2. **Enable Conditional Effects**: Allow effects to be applied conditionally during planning
3. **Support Simulation**: Provide simulation behavior for the planner
4. **Are Reusable**: Same precondition can be used across multiple actions

### Example

```json
{
  "abstractPreconditions": {
    "targetHasInventorySpace": {
      "description": "Checks if target has inventory space for an item",
      "parameters": ["target", "itemId"],
      "simulationFunction": "assumeTrue"
    }
  }
}
```

## Why Are They Needed?

### Problem: Unknown Runtime Values

During effects analysis, certain conditions reference runtime-only data:

```json
// Rule condition
{
  "type": "IF",
  "condition": { ">": [{"var": "target.inventory.capacity"}, {"var": "target.inventory.itemCount"}] },
  "then": [...]
}
```

**Issues:**
- `target.inventory.capacity` is unknown at analysis time
- `target.inventory.itemCount` changes during gameplay
- Cannot pre-compute result

### Solution: Abstract Preconditions

Create an abstract precondition to represent the condition:

```json
{
  "operation": "CONDITIONAL",
  "condition": {
    "abstractPrecondition": "targetHasInventorySpace",
    "params": ["target"]
  },
  "then": [...]
}
```

The planner will:
1. Recognize the precondition by name
2. Use the simulation function to decide if it's satisfied
3. Apply the `then` effects if satisfied

## Abstract Precondition Structure

### Required Fields

```json
{
  "preconditionName": {
    "description": "Human-readable description of what this checks",
    "parameters": ["param1", "param2"],
    "simulationFunction": "assumeTrue|assumeFalse|assumeRandom|evaluateAtRuntime"
  }
}
```

**Fields:**

- `description` (string): Clear description of the condition
- `parameters` (array of strings): List of entity/value parameters
- `simulationFunction` (string): How the planner should simulate this condition

### Optional Fields

```json
{
  "preconditionName": {
    "description": "...",
    "parameters": ["..."],
    "simulationFunction": "...",
    "metadata": {
      "estimatedProbability": 0.8,
      "affectsPlanning": true,
      "category": "inventory"
    }
  }
}
```

## Simulation Functions

Simulation functions define how the planner treats the precondition when it can't evaluate it fully.

### assumeTrue (Optimistic)

**Behavior:** Always assumes the condition is true

**Use Cases:**
- Friendly NPC interactions (assume cooperation)
- Player-initiated actions (assume player knows what they're doing)
- Generally permissive scenarios

**Example:**
```json
{
  "targetWillAcceptItem": {
    "description": "Checks if target will accept the item",
    "parameters": ["target", "itemId"],
    "simulationFunction": "assumeTrue"
  }
}
```

**Planning Behavior:**
- Planner assumes target will always accept items
- Generates plans that include giving items to targets
- May fail at runtime if target refuses

### assumeFalse (Pessimistic)

**Behavior:** Always assumes the condition is false

**Use Cases:**
- Hostile NPC interactions (assume refusal)
- Dangerous actions (assume failure)
- Conservative planning scenarios

**Example:**
```json
{
  "targetIsFriendly": {
    "description": "Checks if target is friendly towards actor",
    "parameters": ["actor", "target"],
    "simulationFunction": "assumeFalse"
  }
}
```

**Planning Behavior:**
- Planner assumes targets are never friendly
- Avoids plans requiring cooperation
- May miss opportunities at runtime if target is actually friendly

### assumeRandom (Probabilistic)

**Behavior:** Randomly returns true or false (50/50 by default)

**Use Cases:**
- Uncertain outcomes
- Balanced planning
- Exploration scenarios

**Example:**
```json
{
  "weatherIsClear": {
    "description": "Checks if weather is clear enough for outdoor activities",
    "parameters": [],
    "simulationFunction": "assumeRandom"
  }
}
```

**Planning Behavior:**
- Planner explores both branches (clear and not clear)
- Generates multiple plan variants
- Higher computational cost

### evaluateAtRuntime (Deferred)

**Behavior:** Defers evaluation to runtime, always returns true during planning

**Use Cases:**
- Complex conditions requiring full world state
- Conditions with side effects
- When simulation would be inaccurate

**Example:**
```json
{
  "complexCombatCheck": {
    "description": "Complex combat readiness check requiring full state",
    "parameters": ["actor", "target"],
    "simulationFunction": "evaluateAtRuntime"
  }
}
```

**Planning Behavior:**
- Planner assumes condition is satisfied
- Actual evaluation happens when plan is executed
- Plan may fail at execution if condition not met

## Catalog of Common Abstract Preconditions

### Inventory & Items

#### hasInventoryCapacity

```json
{
  "hasInventoryCapacity": {
    "description": "Checks if entity has inventory space for an item",
    "parameters": ["entityId", "itemId"],
    "simulationFunction": "assumeTrue"
  }
}
```

**Generated From:**
- `VALIDATE_INVENTORY_CAPACITY` operations
- Conditions checking `inventory.capacity > inventory.itemCount`

**Used In:**
- `items:pick_up_item`
- `items:give_item`
- `items:take_from_container`

---

#### hasContainerCapacity

```json
{
  "hasContainerCapacity": {
    "description": "Checks if container has space for an item",
    "parameters": ["containerId", "itemId"],
    "simulationFunction": "assumeTrue"
  }
}
```

**Generated From:**
- `VALIDATE_CONTAINER_CAPACITY` operations
- Container space checks

**Used In:**
- `items:put_in_container`

---

#### itemIsAccessible

```json
{
  "itemIsAccessible": {
    "description": "Checks if item is accessible to entity",
    "parameters": ["entityId", "itemId"],
    "simulationFunction": "assumeTrue"
  }
}
```

**Generated From:**
- Location checks for items
- Reachability conditions

**Used In:**
- `items:pick_up_item`
- `items:examine_item`

---

### Component Checks

#### hasComponent

```json
{
  "hasComponent": {
    "description": "Checks if entity has a specific component",
    "parameters": ["entityId", "componentId"],
    "simulationFunction": "evaluateAtRuntime"
  }
}
```

**Generated From:**
- `HAS_COMPONENT` operations
- Component existence conditionals

**Used In:**
- Many actions checking entity state

---

#### componentValueMatches

```json
{
  "componentValueMatches": {
    "description": "Checks if component field matches expected value",
    "parameters": ["entityId", "componentId", "field", "expectedValue"],
    "simulationFunction": "evaluateAtRuntime"
  }
}
```

**Generated From:**
- Component value comparisons in conditions
- State verification checks

---

### Relationships & Social

#### targetTrustsActor

```json
{
  "targetTrustsActor": {
    "description": "Checks if target trusts actor enough for interaction",
    "parameters": ["actor", "target"],
    "simulationFunction": "assumeTrue"
  }
}
```

**Generated From:**
- Trust level checks
- Relationship conditions

**Used In:**
- Social actions requiring trust
- Item exchanges

---

#### targetIsFriendly

```json
{
  "targetIsFriendly": {
    "description": "Checks if target is friendly towards actor",
    "parameters": ["actor", "target"],
    "simulationFunction": "assumeTrue"
  }
}
```

**Generated From:**
- Friendship checks
- Hostility conditions (negated)

---

#### targetWillCooperate

```json
{
  "targetWillCooperate": {
    "description": "Checks if target will cooperate with action",
    "parameters": ["target", "actionId"],
    "simulationFunction": "assumeTrue"
  }
}
```

**Generated From:**
- Cooperation checks in multi-actor actions

---

### Position & Movement

#### targetIsReachable

```json
{
  "targetIsReachable": {
    "description": "Checks if target is within reach of actor",
    "parameters": ["actor", "target"],
    "simulationFunction": "assumeTrue"
  }
}
```

**Generated From:**
- Distance checks
- Proximity conditions

**Used In:**
- Physical interaction actions
- Combat actions

---

#### pathIsUnobstructed

```json
{
  "pathIsUnobstructed": {
    "description": "Checks if path between locations is unobstructed",
    "parameters": ["fromLocation", "toLocation"],
    "simulationFunction": "assumeTrue"
  }
}
```

**Generated From:**
- Movement validation
- Pathfinding conditions

**Used In:**
- Movement actions
- Navigation planning

---

#### locationIsAccessible

```json
{
  "locationIsAccessible": {
    "description": "Checks if location is accessible to entity",
    "parameters": ["entityId", "locationId"],
    "simulationFunction": "assumeTrue"
  }
}
```

**Generated From:**
- Location accessibility checks
- Door/barrier conditions

---

### Containers & Objects

#### containerIsOpen

```json
{
  "containerIsOpen": {
    "description": "Checks if container is open",
    "parameters": ["containerId"],
    "simulationFunction": "evaluateAtRuntime"
  }
}
```

**Generated From:**
- Container state checks
- Pre-operation validation

**Used In:**
- `items:take_from_container`
- `items:look_in_container`

---

#### containerIsLocked

```json
{
  "containerIsLocked": {
    "description": "Checks if container is locked",
    "parameters": ["containerId"],
    "simulationFunction": "evaluateAtRuntime"
  }
}
```

**Generated From:**
- Lock state checks

**Used In:**
- `items:open_container`
- `items:unlock_container`

---

#### actorHasKey

```json
{
  "actorHasKey": {
    "description": "Checks if actor has key for locked object",
    "parameters": ["actor", "objectId"],
    "simulationFunction": "assumeFalse"
  }
}
```

**Generated From:**
- Key possession checks
- Unlock preconditions

---

### Combat & Damage

#### targetIsVulnerable

```json
{
  "targetIsVulnerable": {
    "description": "Checks if target is vulnerable to attack",
    "parameters": ["target"],
    "simulationFunction": "assumeTrue"
  }
}
```

**Generated From:**
- Vulnerability checks
- Defense state analysis

---

#### actorCanAttack

```json
{
  "actorCanAttack": {
    "description": "Checks if actor can perform attack action",
    "parameters": ["actor"],
    "simulationFunction": "evaluateAtRuntime"
  }
}
```

**Generated From:**
- Attack capability checks
- Weapon readiness conditions

---

## Implementation Requirements

### For Planner Implementation

When implementing a planner that uses abstract preconditions:

1. **Registry**: Maintain registry of all abstract preconditions
2. **Simulation**: Implement simulation functions
3. **Binding**: Bind parameters to concrete entities during planning
4. **Caching**: Cache precondition results within a planning session
5. **Runtime Evaluation**: Support `evaluateAtRuntime` preconditions

### Example Planner Code

```javascript
class Planner {
  constructor({ abstractPreconditionRegistry, worldState }) {
    this.preconditions = abstractPreconditionRegistry;
    this.worldState = worldState;
  }

  evaluatePrecondition(name, params) {
    const precondition = this.preconditions.get(name);

    switch (precondition.simulationFunction) {
      case 'assumeTrue':
        return true;

      case 'assumeFalse':
        return false;

      case 'assumeRandom':
        return Math.random() > 0.5;

      case 'evaluateAtRuntime':
        return this.evaluateAtRuntime(name, params);

      default:
        throw new Error(`Unknown simulation function: ${precondition.simulationFunction}`);
    }
  }

  evaluateAtRuntime(name, params) {
    // Access world state to evaluate condition
    // This is implementation-specific
    return this.worldState.checkCondition(name, params);
  }
}
```

## Simulation Function Guide

### Choosing the Right Simulation Function

Use this decision tree:

```
Is the condition likely to be true in most cases?
├─ Yes: assumeTrue
└─ No
   └─ Is the condition likely to be false in most cases?
      ├─ Yes: assumeFalse
      └─ No
         └─ Is the outcome uncertain/balanced?
            ├─ Yes: assumeRandom
            └─ No
               └─ Does it require complex world state?
                  └─ Yes: evaluateAtRuntime
```

### Examples

**Player giving item to friendly NPC:**
- **Precondition:** `targetWillAcceptItem`
- **Simulation:** `assumeTrue` (NPCs usually accept gifts)

**Enemy allowing player to pass:**
- **Precondition:** `targetWillLetPass`
- **Simulation:** `assumeFalse` (enemies usually block)

**Weather-dependent action:**
- **Precondition:** `weatherIsClear`
- **Simulation:** `assumeRandom` (weather is unpredictable)

**Complex combat calculation:**
- **Precondition:** `canWinCombat`
- **Simulation:** `evaluateAtRuntime` (requires full combat system)

## Adding New Abstract Preconditions

### Auto-Generated Preconditions

The effects analyzer automatically generates preconditions when it encounters:

1. **Unresolvable condition variables**
2. **Validation operations** (inventory capacity, etc.)
3. **Component checks** with runtime-dependent values

No manual definition needed for these cases.

### Manual Precondition Definition

For custom preconditions, add to action's `planningEffects`:

```json
{
  "planningEffects": {
    "effects": [
      {
        "operation": "CONDITIONAL",
        "condition": {
          "abstractPrecondition": "myCustomPrecondition",
          "params": ["actor", "target"]
        },
        "then": [...]
      }
    ],
    "abstractPreconditions": {
      "myCustomPrecondition": {
        "description": "Custom precondition for special case",
        "parameters": ["actor", "target"],
        "simulationFunction": "assumeTrue"
      }
    }
  }
}
```

### Best Practices

1. **Descriptive Names**: Use clear, descriptive names
   - ✓ `targetHasInventorySpace`
   - ✗ `check1`

2. **Complete Descriptions**: Explain what the precondition checks
   - ✓ "Checks if target has inventory space for an item"
   - ✗ "inventory check"

3. **Minimal Parameters**: Only include necessary parameters
   - ✓ `["entityId", "componentId"]`
   - ✗ `["entityId", "componentId", "timestamp", "source", "debugInfo"]`

4. **Appropriate Simulation**: Choose simulation function that matches typical usage
   - Player actions: `assumeTrue` (player knows what they're doing)
   - Enemy actions: `assumeFalse` (enemies usually resist)
   - Complex logic: `evaluateAtRuntime`

5. **Reusability**: Design preconditions to be reusable across actions
   - ✓ `hasInventoryCapacity` (general)
   - ✗ `canPickUpSwordFromTable` (too specific)

## Common Patterns

### Capacity Checks

```json
{
  "hasSpace": {
    "description": "Checks if entity has capacity for more items",
    "parameters": ["entityId"],
    "simulationFunction": "assumeTrue"
  }
}
```

**Used In:** inventory, container, location capacity checks

### Permission Checks

```json
{
  "hasPermission": {
    "description": "Checks if entity has permission for action",
    "parameters": ["entityId", "actionId", "targetId"],
    "simulationFunction": "assumeFalse"
  }
}
```

**Used In:** access control, security systems

### State Checks

```json
{
  "inCorrectState": {
    "description": "Checks if entity is in required state",
    "parameters": ["entityId", "requiredState"],
    "simulationFunction": "evaluateAtRuntime"
  }
}
```

**Used In:** state machine transitions, animation systems

## Troubleshooting

### Precondition Not Recognized

**Symptom:** Planner fails with "Unknown precondition: X"

**Causes:**
1. Precondition not in registry
2. Typo in precondition name
3. Missing precondition definition

**Solution:**
1. Check precondition is defined in `abstractPreconditions`
2. Verify name matches exactly (case-sensitive)
3. Ensure precondition is registered with planner

### Planner Ignores Precondition

**Symptom:** Planner generates plan without checking precondition

**Causes:**
1. Simulation function always returns true
2. Precondition in wrong place in effect tree
3. Precondition parameters not bound

**Solution:**
1. Check simulation function is appropriate
2. Verify precondition is in conditional effect
3. Ensure parameters are bound to entities

### Runtime Evaluation Fails

**Symptom:** Plan fails at runtime due to precondition

**Causes:**
1. Runtime evaluator not implemented
2. World state missing required data
3. Precondition too complex to evaluate

**Solution:**
1. Implement runtime evaluator for precondition
2. Ensure world state has necessary data
3. Consider simpler precondition or more conservative simulation

## Related Documentation

- [Effects Auto-Generation](./effects-auto-generation.md)
- [Operation Mapping](./operation-mapping.md)
- [Troubleshooting](./troubleshooting.md)
- [GOAP System Overview](./README.md)
