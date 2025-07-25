# Clothing System Scope Implementation Analysis

**Date**: 2025-01-24  
**Scope**: Architectural analysis for implementing clothing removal scopes  
**Focus**: Topmost clothing item retrieval using Scope DSL

## Executive Summary

This report analyzes the Living Narrative Engine's clothing system architecture to determine how to implement scopes that return the topmost clothing entity instance identifier for clothing slot mappings. The analysis reveals that while the system has a well-defined layer hierarchy (`underwear → base → outer → accessories`), implementing "topmost item" logic purely through Scope DSL presents significant challenges due to the DSL's design limitations.

### Key Findings

1. **Layer Priority System**: Clothing layers follow strict hierarchy: `outer > base > underwear > accessories` (separate)
2. **Equipment Structure**: Uses slot → layer → entity ID mapping in `clothing:equipment` component
3. **DSL Constraint**: Cannot easily express conditional "first non-empty" logic for layer priority
4. **Operator Limitation**: JSON Logic operators only return booleans, not entity IDs
5. **Existing Tools**: Current operators (`hasClothingInSlotLayer`, `isSocketCovered`) support layer-specific queries

### Recommended Approach

**Individual Slot Scopes** with complex JSON Logic expressions that check layers in priority order, using conditional logic to return the highest priority occupied layer.

## Current Architecture Analysis

### Clothing Components Structure

The clothing system uses three main components:

#### 1. `clothing:equipment` Component

```json
{
  "equipped": {
    "torso_upper": {
      "underwear": "entity_id_1",
      "base": "entity_id_2",
      "outer": "entity_id_3"
    },
    "torso_lower": {
      "underwear": "entity_id_4"
    }
  }
}
```

#### 2. `clothing:wearable` Component

```json
{
  "layer": "base",
  "equipmentSlots": {
    "primary": "torso_upper",
    "secondary": ["left_arm_clothing", "right_arm_clothing"]
  }
}
```

#### 3. `clothing:slot_metadata` Component

```json
{
  "slotMappings": {
    "torso_upper": {
      "coveredSockets": [
        "left_breast",
        "right_breast",
        "left_chest",
        "right_chest"
      ],
      "allowedLayers": ["underwear", "base", "outer", "armor"]
    }
  }
}
```

### Layer Priority System

The system defines layer hierarchy in `LayerCompatibilityService`:

```javascript
static LAYER_ORDER = ['underwear', 'base', 'outer', 'accessories'];
```

**Visual Priority (Topmost to Innermost)**:

```
accessories (separate category)
outer       ← Topmost visible layer
base        ← Mid layer
underwear   ← Innermost layer
```

### Clothing Slot Mappings

From anatomy blueprints, key clothing slots include:

- `torso_upper`: Covers chest, breasts, shoulders
- `torso_lower`: Covers hips, pubic area, intimate parts
- `legs`: Covers leg anatomy
- `feet`: Covers foot anatomy
- `head_gear`: Covers head
- `hands`: Covers hands

## Constraint Analysis

### JSON Logic Operator Limitation

**Critical Finding**: JSON Logic operators in the system only return boolean values for filtering purposes. This eliminates the possibility of creating custom operators like `getTopmostClothingItem` that would return entity IDs.

**Attempted Approach** (Not Viable):

```javascript
// This would NOT work - operators must return boolean
{"getTopmostClothingItem": ["actor", "torso_upper"]} // ❌
```

**Current Viable Operators** (Boolean Only):

- `{"hasClothingInSlot": ["actor", "torso_upper"]}` → `true/false`
- `{"hasClothingInSlotLayer": ["actor", "torso_upper", "outer"]}` → `true/false`
- `{"isSocketCovered": ["actor", "left_breast"]}` → `true/false`

### DSL Expression Complexity

The Scope DSL, while powerful, lacks built-in conditional logic for "return first non-empty value" patterns. Implementing topmost layer selection requires complex nested JSON Logic expressions.

## Scope DSL Solutions

### Current DSL Capabilities

**Basic Equipment Access**:

```dsl
actor.clothing:equipment.equipped.torso_upper.outer
```

**Array Iteration with Filtering**:

```dsl
entities(clothing:wearable)[{"==": [{"var": "entity.components.clothing:wearable.layer"}, "outer"]}]
```

**Existing Pattern Reference** (from sex mod):

```dsl
actor.intimacy:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "vagina"]},
    {"condition_ref": "intimacy:entity-not-in-facing-away"},
    {"isSocketCovered": [".", "vagina"]}
  ]
}]
```

## Implementation Recommendations

### Option A: Individual Slot Scopes (Recommended)

Create specific scopes for each clothing slot that need topmost item retrieval.

**File**: `data/mods/clothing/scopes/topmost_items.scope`

```dsl
// Returns topmost clothing item for torso_upper slot
topmost_torso_upper := entities(clothing:wearable)[{
  "and": [
    {"==": [{"var": "entity.components.clothing:wearable.equipmentSlots.primary"}, "torso_upper"]},
    {"or": [
      {"and": [
        {"hasClothingInSlotLayer": ["actor", "torso_upper", "outer"]},
        {"==": [{"var": "entity.components.clothing:wearable.layer"}, "outer"]}
      ]},
      {"and": [
        {"not": {"hasClothingInSlotLayer": ["actor", "torso_upper", "outer"]}},
        {"hasClothingInSlotLayer": ["actor", "torso_upper", "base"]},
        {"==": [{"var": "entity.components.clothing:wearable.layer"}, "base"]}
      ]},
      {"and": [
        {"not": {"hasClothingInSlotLayer": ["actor", "torso_upper", "outer"]}},
        {"not": {"hasClothingInSlotLayer": ["actor", "torso_upper", "base"]}},
        {"hasClothingInSlotLayer": ["actor", "torso_upper", "underwear"]},
        {"==": [{"var": "entity.components.clothing:wearable.layer"}, "underwear"]}
      ]}
    ]}
  ]
}]

// Returns topmost clothing item for torso_lower slot
topmost_torso_lower := entities(clothing:wearable)[{
  "and": [
    {"==": [{"var": "entity.components.clothing:wearable.equipmentSlots.primary"}, "torso_lower"]},
    {"or": [
      {"and": [
        {"hasClothingInSlotLayer": ["actor", "torso_lower", "outer"]},
        {"==": [{"var": "entity.components.clothing:wearable.layer"}, "outer"]}
      ]},
      {"and": [
        {"not": {"hasClothingInSlotLayer": ["actor", "torso_lower", "outer"]}},
        {"hasClothingInSlotLayer": ["actor", "torso_lower", "base"]},
        {"==": [{"var": "entity.components.clothing:wearable.layer"}, "base"]}
      ]},
      {"and": [
        {"not": {"hasClothingInSlotLayer": ["actor", "torso_lower", "outer"]}},
        {"not": {"hasClothingInSlotLayer": ["actor", "torso_lower", "base"]}},
        {"hasClothingInSlotLayer": ["actor", "torso_lower", "underwear"]},
        {"==": [{"var": "entity.components.clothing:wearable.layer"}, "underwear"]}
      ]}
    ]}
  ]
}]

// Additional slots as needed...
topmost_legs := entities(clothing:wearable)[{
  "and": [
    {"==": [{"var": "entity.components.clothing:wearable.equipmentSlots.primary"}, "legs"]},
    {"or": [
      {"and": [
        {"hasClothingInSlotLayer": ["actor", "legs", "outer"]},
        {"==": [{"var": "entity.components.clothing:wearable.layer"}, "outer"]}
      ]},
      {"and": [
        {"not": {"hasClothingInSlotLayer": ["actor", "legs", "outer"]}},
        {"hasClothingInSlotLayer": ["actor", "legs", "base"]},
        {"==": [{"var": "entity.components.clothing:wearable.layer"}, "base"]}
      ]}
    ]}
  ]
}]
```

### Option B: Parameterized Approach (Complex)

**Limitation**: Scope DSL doesn't support parameters, but we could use union operations for multiple slots.

```dsl
// Get topmost items from multiple slots for comprehensive removal actions
topmost_upper_body := topmost_torso_upper + topmost_left_arm_clothing + topmost_right_arm_clothing

// Get topmost items from lower body
topmost_lower_body := topmost_torso_lower + topmost_legs + topmost_feet
```

## Technical Specifications

### Logic Flow for Topmost Item Detection

1. **Priority Check**: Examine layers in order: `outer → base → underwear`
2. **Layer Verification**: Use `hasClothingInSlotLayer` to check if layer has items
3. **Entity Matching**: Filter `entities(clothing:wearable)` to match the slot and highest priority layer
4. **Return Entity**: Return the entity ID of the matching clothing item

### JSON Logic Breakdown

The complex OR condition implements this logic:

```
IF outer layer has items:
  RETURN entity with layer=outer AND slot=target_slot
ELSE IF base layer has items:
  RETURN entity with layer=base AND slot=target_slot
ELSE IF underwear layer has items:
  RETURN entity with layer=underwear AND slot=target_slot
ELSE:
  RETURN empty set
```

### Integration with Action System

**Usage in Action Definitions**:

```json
{
  "id": "clothing:remove_upper_clothing",
  "commandVerb": "remove",
  "name": "Remove Upper Clothing",
  "description": "Remove the topmost piece of upper body clothing",
  "scope": "topmost_torso_upper",
  "template": "remove {target}"
}
```

## Code Examples

### Example Clothing Equipment State

```json
{
  "clothing:equipment": {
    "equipped": {
      "torso_upper": {
        "underwear": "clothing:underwired_plunge_bra_nude_silk_instance_1",
        "base": "clothing:white_cotton_crew_tshirt_instance_1",
        "outer": "clothing:indigo_denim_trucker_jacket_instance_1"
      },
      "torso_lower": {
        "underwear": "clothing:nude_thong_instance_1"
      }
    }
  }
}
```

### Expected Scope Results

- `topmost_torso_upper` → `["clothing:indigo_denim_trucker_jacket_instance_1"]` (outer layer)
- `topmost_torso_lower` → `["clothing:nude_thong_instance_1"]` (only underwear present)

### Action Integration Example

```json
{
  "id": "clothing:remove_shirt",
  "commandVerb": "remove",
  "scope": "topmost_torso_upper",
  "template": "remove {target}",
  "prerequisites": [
    {
      "logic": { "hasClothingInSlot": ["actor", "torso_upper"] },
      "failure_message": "You're not wearing anything on your upper body."
    }
  ]
}
```

## Challenges & Limitations

### 1. Expression Complexity

The JSON Logic expressions are complex and difficult to maintain. Each clothing slot requires a separate, lengthy scope definition.

### 2. Performance Considerations

The nested conditional logic with multiple operator calls may impact performance, especially with many clothing items.

### 3. Maintainability

Adding new layers or slots requires updating multiple complex expressions.

### 4. DSL Depth Limit

The current DSL has a depth limit of 4, which these complex expressions approach.

### 5. No Built-in Priority Logic

The DSL lacks native support for priority-based selection, requiring manual implementation through complex conditionals.

## Alternative Approaches Considered

### Custom Scope Resolution (Engine Modification)

**Concept**: Extend the scope resolution engine to handle clothing-specific patterns.
**Status**: Would require core engine changes, outside mod scope.

### Simplified Layer-Specific Scopes

**Concept**: Create separate scopes for each layer instead of "topmost" logic.
**Example**: `outer_torso_upper`, `base_torso_upper`, `underwear_torso_upper`
**Limitation**: Actions would need to check multiple scopes in priority order.

### Equipment Component Direct Access

**Concept**: Access equipment data directly through DSL without filtering.
**Limitation**: Returns raw data, not entity instances suitable for action targets.

## Recommendations

### Immediate Implementation

1. **Start with Individual Slot Scopes**: Implement `topmost_torso_upper` and `topmost_torso_lower` as highest priority slots
2. **Create Comprehensive Scope File**: Place all topmost scopes in `data/mods/clothing/scopes/topmost.scope`
3. **Test with Simple Actions**: Create basic clothing removal actions to validate scope functionality

### Future Enhancements

1. **Performance Monitoring**: Track scope resolution performance with complex expressions
2. **Engine Enhancement Consideration**: If widely used, consider native engine support for priority-based selection
3. **Scope Helper Functions**: Consider scope composition patterns to reduce duplication

### Testing Strategy

1. **Unit Tests**: Test scope expressions with various equipment configurations
2. **Integration Tests**: Verify scopes work correctly with action system
3. **Edge Cases**: Test with empty slots, single layers, full equipment sets

## Conclusion

Implementing topmost clothing item scopes is technically feasible using complex JSON Logic expressions within the existing Scope DSL framework. While the expressions are intricate, they provide the necessary functionality for clothing removal actions without requiring engine modifications.

The recommended approach of individual slot scopes (`topmost_torso_upper`, `topmost_torso_lower`, etc.) balances functionality with maintainability, leveraging existing boolean operators to implement priority-based layer selection through conditional logic.

This solution enables the creation of intuitive clothing removal actions that automatically target the most visible/accessible clothing items, enhancing the user experience for clothing-related gameplay interactions.
