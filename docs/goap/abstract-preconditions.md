# Abstract Preconditions Catalog

## Overview

Abstract preconditions are condition functions used in conditional planning effects during GOAP decision-making. They evaluate conditions against simulated world state during planning to predict action outcomes.

## What Are Abstract Preconditions?

Abstract preconditions are named, parameterized functions that:

1. **Evaluate Runtime Conditions**: Check conditions against simulated world state during planning
2. **Enable Conditional Effects**: Control which effect branches (then/else) are applied during simulation
3. **Support Planning Simulation**: Allow the planner to predict action outcomes before execution
4. **Must Be Defined Inline**: Each action that uses abstract preconditions must define them in its `planningEffects.abstractPreconditions` object

### Example

```json
{
  "planningEffects": {
    "effects": [
      {
        "operation": "CONDITIONAL",
        "condition": {
          "abstractPrecondition": "hasInventoryCapacity",
          "params": ["actor", "target"]
        },
        "then": [...],
        "else": [...]
      }
    ],
    "abstractPreconditions": {
      "hasInventoryCapacity": {
        "description": "Checks if actor has inventory space for item",
        "parameters": ["actorId", "itemId"],
        "simulationFunction": "assumeTrue"
      }
    }
  }
}
```

## Why Are They Needed?

### Problem: Conditional Rule Effects Need Planning Simulation

During planning, the GOAP system needs to predict which effects an action will produce. When rules contain conditional operations, the planner must evaluate conditions against simulated world state to determine which effect branch will execute.

**Example Scenario:**
A `pick_up_item` action might conditionally add the item to inventory only if there's capacity:

```json
{
  "operation": "CONDITIONAL",
  "condition": {
    "abstractPrecondition": "hasInventoryCapacity",
    "params": ["actor", "target"]
  },
  "then": [
    { "operation": "ADD_COMPONENT", "entity": "actor", "component": "items:has_item", "data": {...} }
  ],
  "else": [
    { "operation": "ADD_COMPONENT", "entity": "actor", "component": "items:inventory_full", "data": {...} }
  ]
}
```

### How Abstract Preconditions Work

During planning simulation:

1. **ActionSelector** encounters a CONDITIONAL effect
2. Extracts the abstract precondition name and parameters
3. Resolves parameter entity references (e.g., "actor" → actual entity ID)
4. Calls **AbstractPreconditionSimulator** with the precondition name and resolved parameters
5. Simulator checks the simulated world state and returns true/false
6. ActionSelector applies the appropriate effect branch (then/else)
7. Resulting future state is used to calculate progress toward goal

## Abstract Precondition Structure

Abstract preconditions are defined within each action's `planningEffects.abstractPreconditions` object.

### Required Fields

```json
{
  "preconditionName": {
    "description": "Human-readable description of what this checks",
    "parameters": ["param1", "param2"],
    "simulationFunction": "assumeTrue"
  }
}
```

**Fields:**

- `description` (string, required): Clear description of the condition's purpose
- `parameters` (array of strings, required): List of entity parameter names (e.g., ["actorId", "itemId"])
- `simulationFunction` (string, required): Simulation strategy hint (validated but currently not used by simulator)

**Important Notes:**
- The precondition name determines simulation behavior (e.g., "hasInventoryCapacity" triggers specific capacity calculation logic)
- The `simulationFunction` field is validated but the actual simulation logic is determined by the precondition name
- Parameters must match the expected parameter count and types for the given precondition name

## Implemented Abstract Preconditions

The GOAP system currently implements **3 abstract preconditions**. Each has specific simulation logic hardcoded based on its name.

### hasInventoryCapacity

**Implementation:** `src/goap/simulation/abstractPreconditionSimulator.js`

**Description:** Calculates if an actor's inventory can hold an item based on weight

**Parameters:** `["actorId", "itemId"]`

**Simulation Logic:**
1. Retrieves actor's `items:inventory` component from simulated world state
2. Retrieves item's `items:item` component
3. Calculates current total weight of all items in inventory
4. Checks if `currentWeight + itemWeight <= max_weight`
5. Returns `true` if there's capacity, `false` otherwise

**Returns:**
- `true` if actor has no inventory component (unlimited capacity assumed)
- `true` if adding the item would not exceed max_weight
- `false` if item doesn't exist or would exceed capacity

**Usage in Planning Effects:**
```json
{
  "condition": {
    "abstractPrecondition": "hasInventoryCapacity",
    "params": ["actor", "target"]
  }
}
```

---

### hasContainerCapacity

**Implementation:** `src/goap/simulation/abstractPreconditionSimulator.js`

**Description:** Checks if a container has room for another item

**Parameters:** `["containerId", "itemId"]`

**Simulation Logic:**
1. Retrieves container's `items:container` component
2. Checks current item count in container
3. Compares against `max_capacity`
4. Returns `true` if `currentCount < maxCapacity`

**Returns:**
- `false` if entity is not a container or item doesn't exist
- `true` if container has room (current count < max capacity)
- `true` if container has no capacity limit (Infinity)

---

### hasComponent

**Implementation:** `src/goap/simulation/abstractPreconditionSimulator.js`

**Description:** Checks if an entity has a specific component in simulated world state

**Parameters:** `["entityId", "componentId"]`

**Simulation Logic:**
1. Looks up entity in `worldState.entities[entityId]`
2. Checks if `components[componentId]` exists
3. Returns boolean result

**Returns:**
- `true` if entity has the component
- `false` if entity doesn't exist or lacks the component

**Usage in Planning Effects:**
```json
{
  "condition": {
    "abstractPrecondition": "hasComponent",
    "params": ["actor", "positioning:standing"]
  }
}
```

---

## Simulation Function Field (Metadata Only)

The `simulationFunction` field is **validated but not currently used** by the simulator. Values like `"assumeTrue"`, `"assumeFalse"`, `"assumeRandom"`, and `"evaluateAtRuntime"` are accepted during validation but do not affect simulation behavior.

**Current Behavior:**
- All simulation logic is determined by the precondition **name**, not the `simulationFunction` value
- `hasInventoryCapacity` always calculates actual capacity
- `hasContainerCapacity` always calculates actual capacity
- `hasComponent` always checks actual component existence

**Example:** Both of these have identical behavior despite different `simulationFunction` values:

```json
// Both behave identically - actual capacity is calculated
{
  "hasInventoryCapacity": {
    "simulationFunction": "assumeTrue"  // Ignored
  }
}

{
  "hasInventoryCapacity": {
    "simulationFunction": "evaluateAtRuntime"  // Also ignored
  }
}
```

## Adding New Abstract Preconditions

To add a new abstract precondition to the GOAP system:

### 1. Add Simulator Function

Edit `src/goap/simulation/abstractPreconditionSimulator.js`:

```javascript
simulate(functionName, parameters, worldState) {
  const simulators = {
    hasInventoryCapacity: this.#simulateInventoryCapacity.bind(this),
    hasContainerCapacity: this.#simulateContainerCapacity.bind(this),
    hasComponent: this.#simulateHasComponent.bind(this),
    myNewPrecondition: this.#simulateMyNewPrecondition.bind(this)  // Add here
  };

  const simulator = simulators[functionName];
  if (!simulator) {
    this.#logger.warn(`No simulator for abstract function: ${functionName}`);
    return false;
  }

  return simulator(parameters, worldState);
}

// Add implementation
#simulateMyNewPrecondition([param1, param2], worldState) {
  // Implement simulation logic using worldState
  // Return true/false based on condition
}
```

### 2. (Optional) Register in Effects Analyzer

If the precondition should be auto-generated from specific operation types, add to `src/goap/analysis/effectsAnalyzer.js`:

```javascript
#operationToAbstractPrecondition(operation) {
  const preconditionMap = {
    'MY_OPERATION_TYPE': {
      description: 'Description of what this checks',
      parameters: ['param1', 'param2'],
      simulationFunction: 'assumeTrue'
    }
  };

  return preconditionMap[operation.type] || null;
}
```

### 3. Use in Action Planning Effects

Define the precondition in action's `planningEffects.abstractPreconditions`:

```json
{
  "planningEffects": {
    "effects": [
      {
        "operation": "CONDITIONAL",
        "condition": {
          "abstractPrecondition": "myNewPrecondition",
          "params": ["actor", "target"]
        },
        "then": [...],
        "else": [...]
      }
    ],
    "abstractPreconditions": {
      "myNewPrecondition": {
        "description": "Clear description of condition",
        "parameters": ["param1", "param2"],
        "simulationFunction": "assumeTrue"
      }
    }
  }
}
```

## Auto-Generated Preconditions (Effects Analyzer)

The `EffectsAnalyzer` (`src/goap/analysis/effectsAnalyzer.js`) automatically generates abstract precondition definitions when analyzing rules that contain certain operation types:

### Currently Auto-Generated

| Operation Type | Generated Precondition | Parameters | simulationFunction |
|---|---|---|---|
| `VALIDATE_INVENTORY_CAPACITY` | `hasInventoryCapacity` | `["actorId", "itemId"]` | `"assumeTrue"` |
| `VALIDATE_CONTAINER_CAPACITY` | `hasContainerCapacity` | `["containerId", "itemId"]` | `"assumeTrue"` |
| `HAS_COMPONENT` | `hasComponent` | `["entityId", "componentId"]` | `"assumeTrue"` |
| `CHECK_FOLLOW_CYCLE` | (name from data flow) | `["leaderId", "followerId"]` | `"assumeFalse"` |

**Note:** These are generated when the EffectsAnalyzer encounters these operation types during rule analysis. The generated definitions are added to the action's `planningEffects.abstractPreconditions` object.

## Implementation Details

### World State Structure

During planning simulation, abstract preconditions receive a `worldState` object with the following structure:

```javascript
{
  entities: {
    [entityId]: {
      components: {
        [componentId]: componentData
      }
    }
  },
  targetId: string,         // Optional
  tertiaryTargetId: string  // Optional
}
```

This is a **simulated snapshot** used for planning calculations, not live EntityManager queries.

### Key Implementation Classes

| Class | Location | Purpose |
|---|---|---|
| `AbstractPreconditionSimulator` | `src/goap/simulation/abstractPreconditionSimulator.js` | Evaluates abstract preconditions during planning |
| `ActionSelector` | `src/goap/selection/actionSelector.js` | Calls simulator when encountering CONDITIONAL effects |
| `EffectsAnalyzer` | `src/goap/analysis/effectsAnalyzer.js` | Auto-generates precondition definitions from rules |
| `EffectsValidator` | `src/goap/validation/effectsValidator.js` | Validates precondition structure (description, parameters, simulationFunction) |

## Testing

E2E tests for abstract preconditions are located in:
- `tests/e2e/goap/AbstractPreconditionConditionalEffects.e2e.test.js`

These tests verify:
- `hasComponent` precondition correctly evaluates component existence
- `hasInventoryCapacity` precondition correctly calculates capacity
- Conditional effects apply correct branches (then/else)
- Nested conditional effects work correctly
- Multiple independent conditional effects in single action

## Related Documentation

- [GOAP System Overview](./README.md)
- [Effects Analysis and Generation](./effects-auto-generation.md)
- [Action Selection and Planning](./action-selection.md)
