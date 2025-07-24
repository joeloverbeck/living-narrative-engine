# Top-Layer Clothing JsonLogic Operator Analysis Report

**Generated**: 2025-01-23  
**Purpose**: Architectural analysis for implementing a custom JsonLogic operator that returns the topmost clothing layer entities  
**Scope**: Analysis of clothing system, layer hierarchy, and JsonLogic operator integration

---

## Executive Summary

This report analyzes the requirements and implementation approach for creating a custom JsonLogic operator that returns an array of entity instance IDs representing the topmost (outermost) clothing items in each occupied clothing slot. The operator will be used in scope resolution to determine which clothing items can be removed, following the logic that inner layers cannot be removed before outer layers.

### Key Findings:

- **Layer Hierarchy**: Well-defined 4-layer system: `underwear` → `base` → `outer` → `accessories`
- **Equipment Structure**: Nested object storage in `clothing:equipment` component
- **Existing Pattern**: Robust operator framework with `BaseEquipmentOperator` base class
- **Integration Points**: JsonLogic registration system and scope DSL compatibility
- **Use Case**: Scope resolution for intelligent clothing removal actions

---

## Current Architecture Analysis

### Clothing System Architecture

#### Layer Hierarchy Definition

The clothing system implements a strict 4-layer hierarchy defined in `LayerCompatibilityService.LAYER_ORDER`:

```javascript
static LAYER_ORDER = ['underwear', 'base', 'outer', 'accessories'];
```

**Layer Semantics**:

- **`underwear`**: Innermost layer (e.g., bra, underwear, boxer briefs)
- **`base`**: Core clothing layer (e.g., t-shirt, pants, base garments)
- **`outer`**: Outerwear layer (e.g., jacket, coat, outer garments)
- **`accessories`**: Outermost accessories (e.g., belt, jewelry, optional items)

#### Equipment Component Structure

The `clothing:equipment` component stores equipped items with this nested structure:

```json
{
  "equipped": {
    "torso_upper": {
      "underwear": "clothing:underwired_plunge_bra_nude_silk_instance_1",
      "base": "clothing:white_cotton_crew_tshirt_instance_2",
      "outer": "clothing:indigo_denim_trucker_jacket_instance_3"
    },
    "torso_lower": {
      "underwear": "clothing:fitted_navy_cotton_boxer_briefs_instance_4",
      "base": "clothing:sand_beige_cotton_chinos_instance_5"
    },
    "feet": {
      "base": "clothing:white_leather_sneakers_instance_6"
    }
  }
}
```

#### Slot Mapping System

Anatomy blueprints define clothing slot mappings with allowed layers:

```json
"clothingSlotMappings": {
  "torso_upper": {
    "anatomySockets": ["left_breast", "right_breast", "chest_center"],
    "allowedLayers": ["underwear", "base", "outer", "armor"]
  },
  "torso_lower": {
    "anatomySockets": ["left_hip", "right_hip", "pubic_hair", "vagina"],
    "allowedLayers": ["underwear", "base", "outer"]
  }
}
```

### Existing JsonLogic Operator Framework

#### Base Operator Pattern

All equipment operators extend `BaseEquipmentOperator`:

```javascript
export class BaseEquipmentOperator {
  constructor({ entityManager, logger }, operatorName) {
    this.entityManager = entityManager;
    this.logger = logger;
    this.operatorName = operatorName;
  }

  evaluate(params, context) {
    // Standard validation and entity resolution
    const [entityPath, ...operatorParams] = params;
    const { entity, isValid } = resolveEntityPath(context, entityPath);
    return this.evaluateInternal(entityId, operatorParams, context);
  }

  evaluateInternal(entityId, params, context) {
    // Subclass implementation
  }

  getEquipmentData(entityId) {
    return this.entityManager.getComponentData(entityId, 'clothing:equipment');
  }
}
```

#### Registration System

Operators are registered in `JsonLogicCustomOperators`:

```javascript
export class JsonLogicCustomOperators {
  registerOperators(jsonLogicEvaluationService) {
    // Create operator instances
    const hasClothingInSlotOp = new HasClothingInSlotOperator({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    // Register with JsonLogic engine
    jsonLogicEvaluationService.addOperation(
      'hasClothingInSlot',
      function (entityPath, slotName) {
        return hasClothingInSlotOp.evaluate([entityPath, slotName], this);
      }
    );
  }
}
```

#### Existing Equipment Operators

The codebase includes several equipment-related operators:

1. **`hasClothingInSlot`**: Checks if entity has any clothing in a specific slot
2. **`hasClothingInSlotLayer`**: Checks if entity has clothing in specific slot/layer
3. **`isSocketCovered`**: Checks if anatomical socket is covered by clothing
4. **`hasPartOfType`**: Checks if entity has specific anatomy part types
5. **`hasPartWithComponentValue`**: Advanced anatomy + component value checks

### Scope DSL Integration

#### Current Usage Patterns

Existing clothing operators are used in scope resolution:

```javascript
// Example from intimacy mod scopes
close_actors_facing_each_other_with_torso_clothing :=
  actor.intimacy:closeness.partners[][{
    "and": [
      {"condition_ref": "intimacy:both-actors-facing-each_other"},
      {"hasClothingInSlot": [".", "torso_upper"]}
    ]
  }]
```

#### Scope DSL Syntax Requirements

The new operator must support standard Scope DSL patterns:

- **Entity Path Resolution**: Support `"actor"`, `"."`, and entity variable references
- **Filter Integration**: Work within JSON Logic filter expressions
- **Array Operations**: Return arrays compatible with `"in"` operator for filtering
- **Performance**: Efficient evaluation for scope resolution contexts

---

## Proposed Implementation Analysis

### Operator Requirements

#### Functional Requirements

1. **Input**: Single entity path parameter (e.g., `"actor"`)
2. **Output**: Array of entity instance IDs representing topmost clothing items
3. **Logic**: For each occupied clothing slot, return the entity ID from the highest layer
4. **Layer Priority**: `accessories` > `outer` > `base` > `underwear`

#### Non-Functional Requirements

1. **Performance**: Efficient execution in scope resolution contexts
2. **Reliability**: Robust error handling for missing components/data
3. **Consistency**: Follow existing operator patterns and conventions
4. **Maintainability**: Clear code structure with comprehensive tests

### Algorithm Design

#### Core Algorithm Logic

```javascript
getTopLayerClothingItems(entityId) {
  const layerOrder = ['underwear', 'base', 'outer', 'accessories'];
  const topLayerItems = [];

  const equipmentData = this.getEquipmentData(entityId);
  if (!equipmentData?.equipped) return [];

  // Process each clothing slot
  for (const [slotId, slotData] of Object.entries(equipmentData.equipped)) {
    if (!slotData || typeof slotData !== 'object') continue;

    // Find the highest occupied layer in this slot
    let topLayerEntityId = null;
    for (let i = layerOrder.length - 1; i >= 0; i--) {
      const layer = layerOrder[i];
      const entityId = slotData[layer];

      if (entityId) {
        // Handle both string IDs and arrays
        if (Array.isArray(entityId)) {
          topLayerItems.push(...entityId);
        } else {
          topLayerItems.push(entityId);
        }
        break; // Found top layer for this slot
      }
    }
  }

  return topLayerItems;
}
```

#### Example Scenarios

**Scenario 1: Simple Layering**

```json
// Input Equipment:
{
  "torso_upper": {
    "underwear": "bra_1",
    "base": "tshirt_1",
    "outer": "jacket_1"
  }
}
// Output: ["jacket_1"]
```

**Scenario 2: Multiple Slots**

```json
// Input Equipment:
{
  "torso_upper": {
    "underwear": "bra_1",
    "outer": "jacket_1"
  },
  "torso_lower": {
    "underwear": "underwear_1",
    "base": "pants_1"
  },
  "feet": {
    "base": "shoes_1"
  }
}
// Output: ["jacket_1", "pants_1", "shoes_1"]
```

**Scenario 3: Accessories Priority**

```json
// Input Equipment:
{
  "torso_upper": {
    "base": "shirt_1",
    "accessories": "belt_1"
  }
}
// Output: ["belt_1"]
```

### Integration Requirements

#### JsonLogic Usage Pattern

The new operator will be used in scope expressions:

```javascript
// Scope for removable clothing items
removable_clothing := entities(core:item)[][{
  "in": [
    {"var": "entity.id"},
    {"getTopLayerClothingItems": ["actor"]}
  ]
}]
```

#### Use Cases in Intimacy/Sex Mods

1. **Clothing Removal Actions**: Determine which items can be removed first
2. **Undressing Sequences**: Implement logical undressing order
3. **Clothing State Checks**: Validate clothing state for intimate actions
4. **Layer-Aware Scopes**: Create scopes that respect clothing layer hierarchy

---

## Implementation Specifications

### File Structure

#### New Files Required

1. **`src/logic/operators/getTopLayerClothingItemsOperator.js`**
   - Main operator implementation
   - Extends `BaseEquipmentOperator`
   - Implements core top-layer detection logic

2. **`tests/unit/logic/operators/getTopLayerClothingItemsOperator.test.js`**
   - Unit tests for operator logic
   - Edge case coverage
   - Error handling validation

3. **`tests/integration/logic/getTopLayerClothingItemsOperator.integration.test.js`**
   - Integration tests with JsonLogic evaluation
   - Real equipment data scenarios
   - Scope resolution integration tests

#### Modified Files

1. **`src/logic/jsonLogicCustomOperators.js`**
   - Add operator registration
   - Import new operator class
   - Register with JsonLogic evaluation service

### Class Structure

#### Operator Class Design

```javascript
/**
 * @class GetTopLayerClothingItemsOperator
 * @augments BaseEquipmentOperator
 * @description Returns array of entity IDs for topmost clothing items in each slot
 *
 * Usage: {"getTopLayerClothingItems": ["actor"]}
 * Returns: Array of entity instance IDs from highest clothing layers
 */
export class GetTopLayerClothingItemsOperator extends BaseEquipmentOperator {
  static LAYER_ORDER = ['underwear', 'base', 'outer', 'accessories'];

  constructor({ entityManager, logger }) {
    super({ entityManager, logger }, 'getTopLayerClothingItems');
  }

  evaluateInternal(entityId, params, context) {
    // Parameter validation
    // Equipment data retrieval
    // Top layer detection algorithm
    // Result formatting and return
  }

  #findTopLayerInSlot(slotData) {
    // Helper method for single slot processing
  }

  #processEntityId(entityId) {
    // Helper method for handling arrays vs strings
  }
}
```

### Error Handling Strategy

#### Validation Requirements

1. **Parameter Validation**: Ensure correct number and type of parameters
2. **Entity Validation**: Check entity exists and has valid ID
3. **Component Validation**: Handle missing `clothing:equipment` component gracefully
4. **Data Validation**: Validate equipment data structure
5. **Layer Validation**: Handle unexpected layer names or data types

#### Error Response Strategy

```javascript
// Validation failures return empty array with warning log
if (!params || params.length !== 0) {
  this.logger.warn(`${this.operatorName}: Invalid parameters`);
  return [];
}

// Missing equipment returns empty array with debug log
if (!equipmentData) {
  this.logger.debug(`${this.operatorName}: No equipment data for entity ${entityId}`);
  return [];
}

// Errors are logged and empty array returned for graceful degradation
catch (error) {
  this.logger.error(`${this.operatorName}: Error processing entity ${entityId}`, error);
  return [];
}
```

### Testing Strategy

#### Unit Test Coverage

1. **Basic Functionality**
   - Single slot with single layer
   - Single slot with multiple layers
   - Multiple slots with varying layers
   - Empty equipment component

2. **Edge Cases**
   - Missing clothing:equipment component
   - Invalid entity ID
   - Malformed equipment data
   - Array-type entity IDs in layers
   - Unknown layer names

3. **Layer Priority Logic**
   - Accessories over outer
   - Outer over base
   - Base over underwear
   - Mixed layer scenarios

4. **Error Handling**
   - Invalid parameters
   - Non-existent entity
   - Exception scenarios

#### Integration Test Coverage

1. **JsonLogic Integration**
   - Operator registration verification
   - Evaluation context handling
   - Return value compatibility

2. **Scope Resolution Integration**
   - Usage in filter expressions
   - Array operation compatibility
   - Performance with large datasets

3. **Real-World Scenarios**
   - Human anatomy blueprint compatibility
   - Complex clothing layering situations
   - Integration with existing intimacy/sex mod scopes

### Performance Considerations

#### Optimization Strategies

1. **Early Exit**: Return immediately for entities without equipment
2. **Efficient Iteration**: Reverse layer order iteration for quick top-layer detection
3. **Minimal Allocations**: Reuse arrays and avoid unnecessary object creation
4. **Logging Efficiency**: Use appropriate log levels to minimize performance impact

#### Expected Performance Characteristics

- **Time Complexity**: O(S × L) where S = number of slots, L = number of layers (max 4)
- **Space Complexity**: O(I) where I = number of top-layer items
- **Typical Usage**: Sub-millisecond execution for typical clothing configurations

---

## Integration Impact Analysis

### Scope Resolution Enhancement

#### Current Limitations

Existing scope resolution for clothing removal relies on basic presence checks:

```javascript
// Current approach - checks if slot has any clothing
close_actors_with_torso_clothing := actor.intimacy:closeness.partners[][{
  "hasClothingInSlot": [".", "torso_upper"]
}]
```

#### Enhanced Capabilities

With the new operator, scopes can implement intelligent removal logic:

```javascript
// Enhanced approach - identifies removable items
removable_torso_clothing := entities(core:item)[][{
  "and": [
    {"hasClothingInSlot": ["actor", "torso_upper"]},
    {"in": [{"var": "entity.id"}, {"getTopLayerClothingItems": ["actor"]}]}
  ]
}]
```

### Intimacy/Sex Mod Integration

#### Use Cases

1. **Progressive Undressing Actions**
   - Create actions that can only target removable items
   - Implement logical undressing sequences
   - Prevent impossible clothing removal attempts

2. **Clothing State Validation**
   - Verify clothing state for intimate actions
   - Check accessibility of anatomy parts
   - Implement clothing-aware interaction logic

3. **Enhanced Scope Definitions**
   - Create layer-aware scopes for clothing actions
   - Implement complex clothing state requirements
   - Support advanced clothing interaction patterns

#### Example Integration

```javascript
// Action scope for "remove jacket" action
removable_jackets := entities(core:item)[][{
  "and": [
    {"==": [{"var": "entity.components.clothing:wearable.layer"}, "outer"]},
    {"==": [{"var": "entity.components.clothing:wearable.equipmentSlots.primary"}, "torso_upper"]},
    {"in": [{"var": "entity.id"}, {"getTopLayerClothingItems": ["actor"]}]}
  ]
}]
```

### Backward Compatibility

#### Existing Operator Compatibility

The new operator complements existing operators without conflicts:

- **`hasClothingInSlot`**: Continues to work for presence checks
- **`hasClothingInSlotLayer`**: Continues to work for specific layer checks
- **`isSocketCovered`**: Continues to work for anatomy coverage checks

#### Migration Strategy

1. **Additive Implementation**: New operator adds functionality without changing existing behavior
2. **Gradual Adoption**: Existing scopes continue to work while new scopes adopt enhanced logic
3. **Documentation Update**: Update scope development guidelines to include new operator

---

## Risk Analysis

### Implementation Risks

#### Technical Risks

1. **Performance Impact**: Additional operator could impact scope resolution performance
   - **Mitigation**: Efficient algorithm design and comprehensive performance testing
   - **Monitoring**: Performance benchmarks in integration tests

2. **Memory Usage**: Array returns could increase memory pressure
   - **Mitigation**: Efficient array handling and proper garbage collection
   - **Monitoring**: Memory usage profiling in performance tests

3. **Complexity**: Additional operator increases system complexity
   - **Mitigation**: Comprehensive documentation and clear code structure
   - **Monitoring**: Code review and maintainability metrics

#### Integration Risks

1. **JsonLogic Compatibility**: Potential issues with JsonLogic evaluation context
   - **Mitigation**: Thorough integration testing and existing pattern following
   - **Monitoring**: Integration test coverage and error handling

2. **Scope DSL Impact**: Changes could affect existing scope definitions
   - **Mitigation**: Backward compatibility preservation and additive approach
   - **Monitoring**: Regression testing of existing scopes

### Operational Risks

#### Deployment Risks

1. **Breaking Changes**: Incorrect implementation could break existing functionality
   - **Mitigation**: Comprehensive testing and gradual rollout approach
   - **Monitoring**: Integration tests and production monitoring

2. **Performance Degradation**: Poor implementation could slow scope resolution
   - **Mitigation**: Performance testing and optimization
   - **Monitoring**: Performance benchmarks and profiling

---

## Success Criteria

### Functional Success Criteria

1. **Correct Layer Detection**: Operator correctly identifies topmost layer items in all scenarios
2. **Array Compatibility**: Return values work correctly with `"in"` and other array operations
3. **Error Resilience**: Graceful handling of all error conditions without system failures
4. **Integration Success**: Seamless integration with existing JsonLogic and scope resolution systems

### Performance Success Criteria

1. **Execution Time**: Sub-millisecond execution for typical clothing configurations
2. **Memory Usage**: Minimal memory footprint with efficient array handling
3. **Scalability**: Linear performance scaling with number of clothing slots/items

### Quality Success Criteria

1. **Test Coverage**: 95%+ test coverage including edge cases and error scenarios
2. **Code Quality**: Adherence to existing code patterns and style guidelines
3. **Documentation**: Comprehensive documentation with usage examples and integration guides

---

## Recommendations

### Implementation Approach

1. **Phase 1**: Core operator implementation with basic functionality
2. **Phase 2**: Comprehensive testing and error handling
3. **Phase 3**: Integration testing and performance optimization
4. **Phase 4**: Documentation and example integration

### Best Practices

1. **Follow Existing Patterns**: Maintain consistency with existing operator implementations
2. **Comprehensive Testing**: Include unit, integration, and performance tests
3. **Error Handling**: Implement robust error handling with appropriate logging
4. **Documentation**: Provide clear usage examples and integration guidelines

### Future Enhancements

1. **Layer Filtering**: Optional parameter to filter by specific layers
2. **Slot Filtering**: Optional parameter to filter by specific clothing slots
3. **Priority Customization**: Configurable layer priority for different use cases
4. **Performance Caching**: Caching mechanisms for frequently accessed entities

---

## Conclusion

The implementation of a `getTopLayerClothingItems` JsonLogic operator represents a significant enhancement to the clothing system's capabilities. By providing intelligent identification of removable clothing items, this operator enables more sophisticated scope resolution for intimate actions while maintaining compatibility with the existing architecture.

The proposed implementation follows established patterns, includes comprehensive error handling, and provides the foundation for enhanced clothing interaction logic in the intimacy and sex mods. With proper testing and documentation, this operator will seamlessly integrate into the existing system and provide valuable functionality for scope-based clothing management.

**Next Steps**: Proceed with operator implementation following the specifications outlined in this report, beginning with the core operator class and progressing through testing and integration phases.

---

_This analysis provides the architectural foundation for implementing the top-layer clothing operator. For specific implementation details and code examples, refer to the implementation specifications section and existing operator patterns in the codebase._
