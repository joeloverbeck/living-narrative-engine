# Equipment Component & JSON Logic Analysis Report

## Executive Summary

This report analyzes the structure and usage of the `equipment.component.json` component and the JSON Logic custom operators system in the Living Narrative Engine. The analysis focuses on understanding the current architecture to determine how to implement easy clothing slot queries for action scopes and prerequisites, such as "is a certain clothing slot used for an actor?" and "is the layer of a certain clothing slot used for an actor?"

## Table of Contents

1. [Equipment Component Deep Dive](#equipment-component-deep-dive)
2. [JSON Logic System Architecture](#json-logic-system-architecture)
3. [Code Access Patterns](#code-access-patterns)
4. [Proposed Clothing Slot Query Implementation](#proposed-clothing-slot-query-implementation)
5. [Implementation Roadmap](#implementation-roadmap)
6. [Recommendations](#recommendations)

---

## Equipment Component Deep Dive

### Component Schema Analysis

The `clothing:equipment` component is defined in `/data/mods/clothing/components/equipment.component.json`:

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "clothing:equipment",
  "description": "Tracks equipped clothing items organized by slot and layer",
  "dataSchema": {
    "type": "object",
    "properties": {
      "equipped": {
        "type": "object",
        "description": "Map of equipment slots to their equipped items by layer",
        "patternProperties": {
          "^[a-zA-Z][a-zA-Z0-9_]*$": {
            "type": "object",
            "description": "Equipment slot with layered items",
            "patternProperties": {
              "^(underwear|base|outer|accessories)$": {
                "oneOf": [
                  {
                    "type": "string",
                    "description": "Single equipped item entity ID"
                  },
                  {
                    "type": "array",
                    "items": { "type": "string" },
                    "description": "Array of equipped item entity IDs for slots that support multiple items"
                  }
                ]
              }
            },
            "additionalProperties": false
          }
        },
        "additionalProperties": false
      }
    },
    "required": ["equipped"],
    "additionalProperties": false
  }
}
```

### Data Structure Hierarchy

The equipment component follows a nested hierarchy:

```
equipment: {
  equipped: {
    [slot_name]: {
      [layer]: item_id | [item_id, item_id, ...]
    }
  }
}
```

**Example data structure:**

```json
{
  "equipped": {
    "torso_upper": {
      "underwear": "entity_123",
      "base": "entity_456",
      "outer": "entity_789"
    },
    "feet": {
      "base": "entity_shoes",
      "accessories": ["entity_socks", "entity_insoles"]
    }
  }
}
```

### Key Design Features

1. **Dynamic Slot Names**: Slots can be any valid identifier (torso_upper, feet, hands, etc.)
2. **Fixed Layer System**: Four layers - underwear, base, outer, accessories
3. **Flexible Item Storage**: Single items (string) or multiple items (array)
4. **Pattern Validation**: Both slot names and layers are pattern-validated by JSON Schema

---

## JSON Logic System Architecture

### Custom Operators Framework

The JSON Logic system is implemented through a modular architecture centered around custom operators:

#### Core Components

1. **JsonLogicCustomOperators** (`/src/logic/jsonLogicCustomOperators.js`)
   - Main service for registering custom operators
   - Depends on EntityManager, BodyGraphService, Logger
   - Registers operators with JsonLogicEvaluationService

2. **BaseBodyPartOperator** (`/src/logic/operators/base/BaseBodyPartOperator.js`)
   - Abstract base class for body-part related operators
   - Handles entity resolution, context management, error handling
   - Provides `evaluateInternal()` pattern for subclasses

3. **Individual Operators** (`/src/logic/operators/`)
   - `HasPartWithComponentValueOperator`
   - `HasPartOfTypeOperator`
   - `HasPartOfTypeWithComponentValueOperator`

### Current Operator Implementation Pattern

Each operator follows this pattern:

```javascript
export class CustomOperator extends BaseBodyPartOperator {
  constructor(dependencies) {
    super(dependencies, 'operatorName');
  }

  evaluateInternal(entityId, rootId, params, context, bodyComponent) {
    // Operator-specific logic
    return boolean_result;
  }
}
```

### Registration Flow

1. Operator instances created in `JsonLogicCustomOperators`
2. Registered via `jsonLogicEvaluationService.addOperation(name, function)`
3. Function closure provides access to operator instance and evaluation context

### Usage in Action System

Operators are used in two main contexts:

1. **Action Scopes** (`.scope` files) - Define entity collections
2. **Action Prerequisites** - Validate conditions before action execution

**Example from scope file:**

```javascript
// actors_with_breasts_facing_forward.scope
sex:actors_with_breasts_facing_forward := actor.intimacy:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "breast"]},
    {"condition_ref": "intimacy:entity-not-in-facing-away"}
  ]
}]
```

---

## Code Access Patterns

### Primary Equipment Access Classes

#### 1. EquipmentOrchestrator (`/src/clothing/orchestration/equipmentOrchestrator.js`)

**Purpose**: Coordinates complex clothing equipment workflows including validation, conflict resolution, and integration.

**Key Equipment Access Patterns:**

```javascript
// Get equipment data
let equipmentData = this.#entityManager.getComponentData(
  entityId,
  'clothing:equipment'
);

// Initialize if missing
if (!equipmentData) {
  equipmentData = { equipped: {} };
}

// Access slot/layer structure
if (!equipmentData.equipped[slotId]) {
  equipmentData.equipped[slotId] = {};
}

// Store previous item
const previousItem = equipmentData.equipped[slotId][layer] || null;

// Equip new item
equipmentData.equipped[slotId][layer] = clothingItemId;

// Update component
await this.#entityManager.addComponent(
  entityId,
  'clothing:equipment',
  equipmentData
);
```

#### 2. LayerCompatibilityService (`/src/clothing/validation/layerCompatibilityService.js`)

**Purpose**: Validates layer compatibility and conflicts.

**Equipment Access Pattern:**

```javascript
const equipmentData = this.#entityManager.getComponentData(
  entityId,
  'clothing:equipment'
);

// Iterate through slots and layers
for (const [slot, layers] of Object.entries(equipmentData?.equipped || {})) {
  for (const [layer, itemId] of Object.entries(layers)) {
    // Validation logic
  }
}
```

#### 3. ClothingManagementService (`/src/clothing/services/clothingManagementService.js`)

**Purpose**: High-level API for clothing equipment, validation, and management.

**Equipment Query Pattern:**

```javascript
const equipmentData = this.#entityManager.getComponentData(
  entityId,
  'clothing:equipment'
);

return equipmentData?.equipped || {};
```

### Component Access Integration Points

1. **UI Layer**: `AnatomyVisualizerUI.js:524` - Equipment display
2. **Event System**: `clothing:equipment_updated` events
3. **Validation Layer**: Layer compatibility checks
4. **Description Services**: Equipment name resolution

---

## Proposed Clothing Slot Query Implementation

### New Operator Designs

Based on the analysis, I recommend implementing two new JSON Logic operators:

#### 1. HasClothingInSlot Operator

**Purpose**: Check if an actor has any clothing equipped in a specific slot.

**Usage**: `{"hasClothingInSlot": ["actor", "torso_upper"]}`

**Implementation Pattern:**

```javascript
export class HasClothingInSlotOperator extends BaseEquipmentOperator {
  evaluateInternal(entityId, params, context) {
    const [slotName] = params;

    const equipmentData = this.entityManager.getComponentData(
      entityId,
      'clothing:equipment'
    );

    if (!equipmentData?.equipped) return false;

    const slot = equipmentData.equipped[slotName];
    if (!slot) return false;

    // Check if any layer has items
    return Object.values(slot).some((items) =>
      Array.isArray(items) ? items.length > 0 : Boolean(items)
    );
  }
}
```

#### 2. HasClothingInSlotLayer Operator

**Purpose**: Check if an actor has clothing equipped in a specific slot and layer.

**Usage**: `{"hasClothingInSlotLayer": ["actor", "torso_upper", "base"]}`

**Implementation Pattern:**

```javascript
export class HasClothingInSlotLayerOperator extends BaseEquipmentOperator {
  evaluateInternal(entityId, params, context) {
    const [slotName, layerName] = params;

    const equipmentData = this.entityManager.getComponentData(
      entityId,
      'clothing:equipment'
    );

    if (!equipmentData?.equipped) return false;

    const slot = equipmentData.equipped[slotName];
    if (!slot) return false;

    const layerItems = slot[layerName];
    return Array.isArray(layerItems)
      ? layerItems.length > 0
      : Boolean(layerItems);
  }
}
```

### Base Equipment Operator

Create a new base class for equipment-specific operators:

```javascript
// /src/logic/operators/base/BaseEquipmentOperator.js
export class BaseEquipmentOperator {
  constructor({ entityManager, logger }, operatorName) {
    this.entityManager = entityManager;
    this.logger = logger;
    this.operatorName = operatorName;
  }

  evaluate(params, context) {
    try {
      if (!params || !Array.isArray(params) || params.length < 2) {
        this.logger.warn(`${this.operatorName}: Invalid parameters`);
        return false;
      }

      const [entityPath, ...operatorParams] = params;

      // Resolve entity from path
      const { entity, isValid } = resolveEntityPath(context, entityPath);
      if (!isValid) return false;

      const entityId = entity?.id || entity;
      if (!entityId) return false;

      return this.evaluateInternal(entityId, operatorParams, context);
    } catch (error) {
      this.logger.error(`${this.operatorName}: Error during evaluation`, error);
      return false;
    }
  }

  evaluateInternal(entityId, params, context) {
    throw new Error('evaluateInternal must be implemented by subclass');
  }
}
```

### Registration Updates

Update `JsonLogicCustomOperators` to register the new operators:

```javascript
// In JsonLogicCustomOperators.registerOperators()
const hasClothingInSlotOp = new HasClothingInSlotOperator({
  entityManager: this.#entityManager,
  logger: this.#logger,
});

const hasClothingInSlotLayerOp = new HasClothingInSlotLayerOperator({
  entityManager: this.#entityManager,
  logger: this.#logger,
});

jsonLogicEvaluationService.addOperation(
  'hasClothingInSlot',
  function (entityPath, slotName) {
    return hasClothingInSlotOp.evaluate([entityPath, slotName], this);
  }
);

jsonLogicEvaluationService.addOperation(
  'hasClothingInSlotLayer',
  function (entityPath, slotName, layerName) {
    return hasClothingInSlotLayerOp.evaluate(
      [entityPath, slotName, layerName],
      this
    );
  }
);
```

### Usage Examples

#### Action Prerequisites

```json
{
  "prerequisites": [
    {
      "logic": {
        "hasClothingInSlot": ["actor", "torso_upper"]
      },
      "failure_message": "You need to be wearing something on your torso."
    }
  ]
}
```

#### Action Scopes

```javascript
// clothed_actors_in_base_layer.scope
clothing:clothed_actors_in_base_layer := actor.intimacy:closeness.partners[][{
  "hasClothingInSlotLayer": [".", "torso_upper", "base"]
}]
```

#### Complex Conditions

```json
{
  "logic": {
    "and": [
      { "hasClothingInSlot": ["actor", "torso_upper"] },
      { "not": { "hasClothingInSlotLayer": ["actor", "torso_upper", "outer"] } }
    ]
  }
}
```

---

## Implementation Roadmap

### Phase 1: Base Infrastructure

1. **Create BaseEquipmentOperator class**
   - Location: `/src/logic/operators/base/BaseEquipmentOperator.js`
   - Implement entity resolution and error handling
   - Test with basic operator

2. **Add utility functions**
   - Equipment data validation helpers
   - Slot/layer existence checks
   - Array/string item handling

### Phase 2: Core Operators

1. **Implement HasClothingInSlotOperator**
   - Location: `/src/logic/operators/hasClothingInSlotOperator.js`
   - Comprehensive slot checking logic
   - Unit tests for all scenarios

2. **Implement HasClothingInSlotLayerOperator**
   - Location: `/src/logic/operators/hasClothingInSlotLayerOperator.js`
   - Layer-specific checking logic
   - Unit tests for layer combinations

### Phase 3: Integration

1. **Register operators in JsonLogicCustomOperators**
   - Update registration method
   - Add proper parameter validation
   - Integration tests

2. **Update dependency injection**
   - Register new classes if needed
   - Update test mocks and factories

### Phase 4: Documentation and Examples

1. **Create usage documentation**
   - Operator reference guide
   - Common pattern examples
   - Integration with existing actions

2. **Update action templates**
   - Example prerequisites
   - Example scope definitions
   - Best practice patterns

### Testing Strategy

#### Unit Tests

- **BaseEquipmentOperator**: Entity resolution, error handling
- **HasClothingInSlotOperator**: All slot scenarios, edge cases
- **HasClothingInSlotLayerOperator**: Layer-specific logic, validation
- **JsonLogicCustomOperators**: Registration and integration

#### Integration Tests

- **Action system integration**: Prerequisites and scopes
- **Equipment workflows**: Equipment + JSON Logic coordination
- **Performance testing**: Large equipment datasets

#### Test Data Patterns

```javascript
// Test equipment data structures
const testEquipmentData = {
  equipped: {
    torso_upper: {
      underwear: 'underwear_entity',
      base: 'shirt_entity',
      outer: 'jacket_entity',
    },
    feet: {
      base: 'shoes_entity',
      accessories: ['socks_entity', 'insoles_entity'],
    },
    hands: {
      accessories: 'gloves_entity',
    },
  },
};
```

---

## Recommendations

### 1. Adopt Equipment-Specific Base Class

The current `BaseBodyPartOperator` is designed for anatomy queries. Equipment queries have different patterns and should use a dedicated base class for:

- Simpler entity resolution (no body graph needed)
- Equipment-specific validation patterns
- Better error messages and logging

### 2. Extend Operator Set Gradually

Start with the two proposed operators, then consider additional operators based on usage patterns:

- `hasClothingItemEquipped` - Check for specific item
- `getEquippedItemsInSlot` - Return item list for slot
- `hasClothingConflict` - Check for layer conflicts

### 3. Consider Performance Optimization

For frequently-used queries, consider:

- Caching equipment data access
- Batch equipment queries
- Optimized data structures for common patterns

### 4. Maintain Schema Compatibility

Ensure new operators work with:

- Current equipment.component.json schema
- Existing validation patterns
- Future schema evolution

### 5. Documentation and Examples

Create comprehensive documentation including:

- Operator reference guide
- Common usage patterns
- Integration examples with actions
- Performance considerations

### 6. Error Handling Patterns

Implement robust error handling for:

- Missing equipment components
- Invalid slot/layer names
- Malformed equipment data
- Entity resolution failures

---

## Conclusion

The Living Narrative Engine's equipment component and JSON Logic system provide a solid foundation for implementing clothing slot queries. The proposed `hasClothingInSlot` and `hasClothingInSlotLayer` operators will enable easy querying of actor clothing states for action scopes and prerequisites.

The implementation follows established patterns in the codebase while addressing the specific needs of equipment queries. The modular architecture ensures the new operators integrate seamlessly with existing systems while maintaining performance and reliability.

This analysis provides the architectural foundation needed to implement the requested clothing slot query functionality within the existing framework.
