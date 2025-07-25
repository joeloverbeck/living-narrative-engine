# Scope DSL Extension for Clothing Target Resolution

**Date**: 2025-01-24  
**Type**: Architecture Specification  
**Status**: Design Phase  
**Target**: Scope DSL Extension for Clothing System

## Executive Summary

This specification defines an extension to the Living Narrative Engine's Scope DSL to support efficient clothing target resolution for action systems. The current approach requires complex JSON Logic expressions to retrieve topmost clothing items, making action templating cumbersome. This proposal introduces three viable architectural approaches to enable simple syntax like `actor.topmost_clothing[]` that returns arrays of entity instance IDs.

### Key Requirements

1. **Simple Syntax**: Enable intuitive expressions for clothing retrieval
2. **Action Integration**: Support dynamic action generation through templating
3. **Performance**: Efficient resolution without complex JSON Logic chains
4. **Backward Compatibility**: Maintain existing scope DSL functionality
5. **Extensibility**: Allow future clothing-related operations

### Constraint Analysis

- **JSON Logic Limitation**: Custom operators must return boolean values for filtering
- **DSL Architecture**: Must work within source → step → filter → result pipeline
- **Layer Hierarchy**: Must respect clothing layer priority (`outer > base > underwear > accessories`)
- **Entity Targeting**: Must return entity instance IDs suitable for action targeting

## Problem Context

### Current State Analysis

The clothing system uses a well-defined architecture:

```javascript
// Equipment Component Structure
{
  "clothing:equipment": {
    "equipped": {
      "torso_upper": {
        "underwear": "entity_id_1",
        "base": "entity_id_2",
        "outer": "entity_id_3"
      }
    }
  }
}
```

**Layer Priority**: `outer > base > underwear > accessories`

### Current Scope DSL Limitations

**Complex Expression Required**:

```dsl
// Current approach - overly complex
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
      ]}
    ]}
  ]
}]
```

**Desired Simplicity**:

```dsl
// Target approach - simple and intuitive
topmost_torso_upper := actor.topmost_clothing.torso_upper
all_topmost := actor.topmost_clothing[]
```

## Architectural Approaches

### Approach 1: Custom Source Node Extension

**Concept**: Extend the parser to recognize clothing-specific source nodes alongside `actor`, `location`, and `entities`.

#### Implementation Design

**Parser Modifications** (`src/scopeDsl/parser/parser.js`):

```javascript
// Extend parseSource() method
parseSource() {
  const idTok = this.expect('IDENTIFIER', 'Expected source node');

  switch (idTok.value) {
    case 'actor':
      return { type: 'Source', kind: 'actor' };

    case 'location':
      return { type: 'Source', kind: 'location', param: null };

    case 'entities':
      return this.parseEntitiesSource();

    // NEW: Clothing-specific sources
    case 'topmost_clothing':
      return this.parseClothingSource('topmost');

    case 'all_clothing':
      return this.parseClothingSource('all');

    default:
      this.error(`Unknown source node: '${idTok.value}'`);
  }
}

parseClothingSource(mode) {
  // Support both parameterized and non-parameterized forms
  if (this.match('LPAREN')) {
    this.advance(); // consume '('
    const slot = this.expect('STRING', 'Expected slot name').value;
    this.expect('RPAREN', 'Expected closing parenthesis');
    return { type: 'Source', kind: 'clothing', param: slot, mode };
  }
  return { type: 'Source', kind: 'clothing', param: null, mode };
}
```

**Source Resolver Extension** (`src/scopeDsl/nodes/sourceResolver.js`):

```javascript
// Add clothing resolution to existing resolver
resolve(node, ctx) {
  switch (node.kind) {
    case 'actor':
      result = new Set([actorEntity.id]);
      break;

    case 'location':
      // existing logic
      break;

    case 'entities':
      // existing logic
      break;

    // NEW: Clothing source resolution
    case 'clothing':
      result = this.resolveClothingSource(node, ctx);
      break;
  }

  return result;
}

resolveClothingSource(node, ctx) {
  const { actorEntity } = ctx;
  const equipment = entitiesGateway.getComponentData(actorEntity.id, 'clothing:equipment');

  if (!equipment?.equipped) {
    return new Set();
  }

  if (node.param) {
    // Single slot: topmost_clothing("torso_upper")
    return this.getTopmostFromSlot(equipment.equipped, node.param, node.mode);
  } else {
    // All slots: topmost_clothing (to be used with [] or field access)
    return this.getTopmostFromAllSlots(equipment.equipped, node.mode);
  }
}

getTopmostFromSlot(equipped, slotName, mode) {
  const slotData = equipped[slotName];
  if (!slotData) return new Set();

  // Priority order: outer, base, underwear
  const layers = ['outer', 'base', 'underwear'];

  for (const layer of layers) {
    if (slotData[layer]) {
      return new Set([slotData[layer]]);
    }
  }

  return new Set();
}

getTopmostFromAllSlots(equipped, mode) {
  const result = new Set();

  for (const slotName of Object.keys(equipped)) {
    const topmost = this.getTopmostFromSlot(equipped, slotName, mode);
    topmost.forEach(id => result.add(id));
  }

  return result;
}
```

#### Usage Examples

```dsl
// Single slot targeting
remove_upper_shirt := topmost_clothing("torso_upper")

// All slots with array iteration
all_removable := topmost_clothing[]

// Specific slot with step access (requires virtual component approach)
upper_item := topmost_clothing.torso_upper
```

#### Pros & Cons

**Advantages**:

- Clean, intuitive syntax
- Focused extension with minimal parser changes
- High performance with direct equipment access
- Clear semantic meaning

**Disadvantages**:

- Limited to predefined clothing operations
- Cannot easily extend to other clothing queries
- Parser extension required for each new operation
- Less flexible than step-based approaches

### Approach 2: Virtual Component Approach

**Concept**: Create virtual components that are dynamically computed during resolution, allowing normal DSL syntax to access clothing data.

#### Implementation Design

**Virtual Component Service** (`src/clothing/virtualClothingComponentService.js`):

```javascript
export class VirtualClothingComponentService {
  constructor({ entityManager, logger }) {
    this.entityManager = entityManager;
    this.logger = logger;
  }

  /**
   * Generates virtual component data for clothing operations
   */
  generateVirtualComponent(entityId, componentId) {
    if (componentId === 'clothing:topmost_virtual') {
      return this.generateTopmostClothingComponent(entityId);
    }

    if (componentId === 'clothing:layer_virtual') {
      return this.generateLayerMappingComponent(entityId);
    }

    return null;
  }

  generateTopmostClothingComponent(entityId) {
    const equipment = this.entityManager.getComponentData(
      entityId,
      'clothing:equipment'
    );
    if (!equipment?.equipped) {
      return { slots: {} };
    }

    const topmost = {};
    const layers = ['outer', 'base', 'underwear'];

    for (const [slotName, slotData] of Object.entries(equipment.equipped)) {
      for (const layer of layers) {
        if (slotData[layer]) {
          topmost[slotName] = slotData[layer];
          break;
        }
      }
    }

    return {
      slots: topmost,
      all: Object.values(topmost),
    };
  }
}
```

**Step Resolver Extension** (`src/scopeDsl/nodes/stepResolver.js`):

```javascript
// Extend step resolver to handle virtual components
resolve(node, ctx) {
  const { field, parent } = node;
  const parentResults = ctx.dispatcher.resolve(parent, ctx);
  const resultSet = new Set();

  for (const entityId of parentResults) {
    // Check if this is a virtual component request
    if (field?.startsWith('clothing:') && field.includes('_virtual')) {
      const virtualData = this.virtualClothingService?.generateVirtualComponent(entityId, field);
      if (virtualData) {
        // Add virtual component data to entity for this resolution
        this.addVirtualDataToResolution(entityId, field, virtualData, resultSet);
        continue;
      }
    }

    // Existing component resolution logic
    const componentData = entitiesGateway.getComponentData(entityId, field);
    // ... rest of existing logic
  }

  return resultSet;
}
```

#### Usage Examples

```dsl
// Access virtual topmost component
topmost_items := actor.clothing:topmost_virtual.all[]

// Specific slot access
upper_item := actor.clothing:topmost_virtual.slots.torso_upper

// Filter-based selection
removable_upper := actor.clothing:topmost_virtual.slots[{
  "in": [{"var": "key"}, ["torso_upper", "torso_lower"]]
}]
```

#### Pros & Cons

**Advantages**:

- Uses existing DSL syntax patterns
- No parser modifications required
- Extensible to other virtual clothing data
- Leverages existing step resolution logic

**Disadvantages**:

- Adds complexity to step resolver
- Virtual component concept may be confusing
- Performance overhead from dynamic computation
- Less intuitive than dedicated clothing syntax

### Approach 3: Custom Step Resolver (Recommended)

**Concept**: Add a specialized step resolver that handles clothing-specific field access, enabling syntax like `actor.topmost_clothing.slot_name`.

#### Implementation Design

**Clothing Step Resolver** (`src/scopeDsl/nodes/clothingStepResolver.js`):

```javascript
/**
 * Specialized resolver for clothing-related step operations
 */
export default function createClothingStepResolver({ entitiesGateway }) {
  const CLOTHING_FIELDS = {
    topmost_clothing: 'topmost',
    all_clothing: 'all',
    outer_clothing: 'outer',
    base_clothing: 'base',
    underwear: 'underwear',
  };

  const CLOTHING_SLOTS = [
    'torso_upper',
    'torso_lower',
    'legs',
    'feet',
    'head_gear',
    'hands',
    'left_arm_clothing',
    'right_arm_clothing',
  ];

  return {
    canResolve(node) {
      return (
        node.type === 'Step' &&
        node.field &&
        CLOTHING_FIELDS.hasOwnProperty(node.field)
      );
    },

    resolve(node, ctx) {
      const { field, parent, isArray } = node;
      const parentResults = ctx.dispatcher.resolve(parent, ctx);
      const resultSet = new Set();

      for (const entityId of parentResults) {
        const clothingData = this.resolveClothingField(
          entityId,
          field,
          isArray
        );
        clothingData.forEach((id) => resultSet.add(id));
      }

      return resultSet;
    },

    resolveClothingField(entityId, field, isArray) {
      const equipment = entitiesGateway.getComponentData(
        entityId,
        'clothing:equipment'
      );
      if (!equipment?.equipped) {
        return [];
      }

      const mode = CLOTHING_FIELDS[field];

      if (isArray) {
        // Return all topmost items: actor.topmost_clothing[]
        return this.getAllTopmostItems(equipment.equipped, mode);
      } else {
        // Return object for further step access: actor.topmost_clothing.torso_upper
        return this.createSlotAccessObject(equipment.equipped, mode);
      }
    },

    getAllTopmostItems(equipped, mode) {
      const result = [];
      const layers = this.getLayerPriority(mode);

      for (const [slotName, slotData] of Object.entries(equipped)) {
        for (const layer of layers) {
          if (slotData[layer]) {
            result.push(slotData[layer]);
            break; // Only take the topmost
          }
        }
      }

      return result;
    },

    createSlotAccessObject(equipped, mode) {
      // This creates a virtual object that can be accessed by subsequent steps
      // The subsequent step resolver will handle .torso_upper access
      return [
        {
          __clothingSlotAccess: true,
          equipped,
          mode,
          type: 'clothing_slot_access',
        },
      ];
    },

    getLayerPriority(mode) {
      switch (mode) {
        case 'topmost':
          return ['outer', 'base', 'underwear'];
        case 'all':
          return ['outer', 'base', 'underwear', 'accessories'];
        case 'outer':
          return ['outer'];
        case 'base':
          return ['base'];
        case 'underwear':
          return ['underwear'];
        default:
          return ['outer', 'base', 'underwear'];
      }
    },
  };
}
```

**Slot Access Resolver** (`src/scopeDsl/nodes/slotAccessResolver.js`):

```javascript
/**
 * Handles access to specific clothing slots after clothing field resolution
 */
export default function createSlotAccessResolver({ entitiesGateway }) {
  const CLOTHING_SLOTS = [
    'torso_upper',
    'torso_lower',
    'legs',
    'feet',
    'head_gear',
    'hands',
    'left_arm_clothing',
    'right_arm_clothing',
  ];

  return {
    canResolve(node) {
      return (
        node.type === 'Step' &&
        node.field &&
        CLOTHING_SLOTS.includes(node.field)
      );
    },

    resolve(node, ctx) {
      const { field, parent } = node;
      const parentResults = ctx.dispatcher.resolve(parent, ctx);
      const resultSet = new Set();

      for (const item of parentResults) {
        if (typeof item === 'object' && item.__clothingSlotAccess) {
          // This is a clothing slot access object
          const slotItem = this.resolveSlotAccess(item, field);
          if (slotItem) {
            resultSet.add(slotItem);
          }
        } else {
          // Regular entity - try to access component field
          const componentData = entitiesGateway.getComponentData(item, field);
          if (componentData !== null) {
            this.addToResultSet(resultSet, componentData);
          }
        }
      }

      return resultSet;
    },

    resolveSlotAccess(clothingAccess, slotName) {
      const { equipped, mode } = clothingAccess;
      const slotData = equipped[slotName];

      if (!slotData) return null;

      const layers = this.getLayerPriority(mode);

      for (const layer of layers) {
        if (slotData[layer]) {
          return slotData[layer];
        }
      }

      return null;
    },

    getLayerPriority(mode) {
      switch (mode) {
        case 'topmost':
          return ['outer', 'base', 'underwear'];
        case 'all':
          return ['outer', 'base', 'underwear', 'accessories'];
        case 'outer':
          return ['outer'];
        case 'base':
          return ['base'];
        case 'underwear':
          return ['underwear'];
        default:
          return ['outer', 'base', 'underwear'];
      }
    },

    addToResultSet(resultSet, data) {
      if (Array.isArray(data)) {
        data.forEach((item) => resultSet.add(item));
      } else if (typeof data === 'string') {
        resultSet.add(data);
      }
    },
  };
}
```

**Dispatcher Integration** (`src/scopeDsl/nodes/dispatcher.js`):

```javascript
// Add clothing resolvers to the resolver list
function createDispatcher(baseResolvers) {
  const clothingStepResolver = createClothingStepResolver({ entitiesGateway });
  const slotAccessResolver = createSlotAccessResolver({ entitiesGateway });

  const allResolvers = [
    clothingStepResolver, // Higher priority for clothing fields
    slotAccessResolver, // Handle slot access
    ...baseResolvers, // Existing resolvers
  ];

  return {
    resolve(node, ctx) {
      for (const resolver of allResolvers) {
        if (resolver.canResolve(node)) {
          return resolver.resolve(node, ctx);
        }
      }
      throw new Error(`No resolver found for node type: ${node.type}`);
    },
  };
}
```

#### Usage Examples

```dsl
// All topmost clothing items
all_removable := actor.topmost_clothing[]

// Specific slot access
upper_shirt := actor.topmost_clothing.torso_upper
lower_pants := actor.topmost_clothing.torso_lower

// Specific layers
all_outer := actor.outer_clothing[]
all_underwear := actor.underwear[]

// Combined with filters
visible_clothes := actor.topmost_clothing[][{
  "!=": [{"var": "entity.components.clothing:wearable.layer"}, "underwear"]
}]
```

#### Pros & Cons

**Advantages**:

- Intuitive dot-notation syntax
- Extensible to other clothing operations
- Works within existing DSL architecture
- High performance with direct access
- Clear separation of concerns

**Disadvantages**:

- Requires two new resolver types
- More complex implementation
- Need to handle virtual object passing between resolvers

## Recommended Approach

### Selection: Approach 3 (Custom Step Resolver)

**Reasoning**:

1. **Intuitive Syntax**: The dot-notation (`actor.topmost_clothing.torso_upper`) follows established DSL patterns
2. **Extensibility**: Easy to add new clothing operations (`actor.outer_clothing[]`, `actor.base_clothing.legs`)
3. **Performance**: Direct equipment component access without complex filtering
4. **Architecture Fit**: Works cleanly within the existing resolver dispatch system
5. **Future-Proof**: Can be extended for other domain-specific operations

### Implementation Complexity

**Low-Medium Complexity**:

- 2 new resolver types (~200-300 lines each)
- Dispatcher registration changes (~10 lines)
- No parser modifications required
- Extensive testing required for resolver interaction

## Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1)

**Day 1-2: Clothing Step Resolver**

- Implement `createClothingStepResolver.js`
- Support basic `topmost_clothing`, `all_clothing` fields
- Unit tests for equipment data parsing

**Day 3-4: Slot Access Resolver**

- Implement `createSlotAccessResolver.js`
- Handle virtual object passing between resolvers
- Unit tests for slot-specific access

**Day 5: Dispatcher Integration**

- Update dispatcher to include clothing resolvers
- Integration tests for resolver priority
- End-to-end scope resolution tests

### Phase 2: Extended Operations (Week 2)

**Day 1-2: Layer-Specific Operations**

- Add `outer_clothing`, `base_clothing`, `underwear` support
- Unit tests for layer filtering

**Day 3-4: Array Operations**

- Ensure `[]` array iteration works correctly
- Test complex expressions with filters

**Day 5: Performance Optimization**

- Caching for expensive equipment lookups
- Performance benchmarking

### Phase 3: Action Integration (Week 3)

**Day 1-2: Action Template Integration**

- Test with clothing removal actions
- Validate entity ID targeting

**Day 3-4: Error Handling**

- Graceful handling of missing equipment
- Clear error messages for invalid operations

**Day 5: Documentation**

- Update DSL documentation
- Create usage examples for mod developers

### Phase 4: Advanced Features (Week 4)

**Day 1-3: Extended Clothing Operations**

- Support for clothing categories
- Socket-based clothing queries
- Multi-slot operations

**Day 4-5: Testing & Validation**

- Comprehensive e2e test suite
- Performance regression testing
- Cross-mod compatibility testing

## Testing Strategy

### Unit Tests

**Clothing Step Resolver Tests** (`tests/unit/scopeDsl/nodes/clothingStepResolver.test.js`):

```javascript
describe('ClothingStepResolver', () => {
  describe('topmost_clothing field', () => {
    it('should resolve all topmost items when used with array syntax', () => {
      // Test: actor.topmost_clothing[]
    });

    it('should create slot access object for dot notation', () => {
      // Test: actor.topmost_clothing.torso_upper setup
    });
  });

  describe('layer-specific fields', () => {
    it('should resolve outer_clothing correctly', () => {
      // Test: actor.outer_clothing[]
    });
  });
});
```

**Slot Access Resolver Tests** (`tests/unit/scopeDsl/nodes/slotAccessResolver.test.js`):

```javascript
describe('SlotAccessResolver', () => {
  it('should resolve specific slot from clothing access object', () => {
    // Test: .torso_upper resolution
  });

  it('should handle missing slots gracefully', () => {
    // Test: empty result for unequipped slots
  });
});
```

### Integration Tests

**Resolver Chain Tests** (`tests/integration/scopeDsl/clothingResolverChain.test.js`):

```javascript
describe('Clothing Resolver Chain', () => {
  it('should handle complete resolution chain', () => {
    // Test: actor.topmost_clothing.torso_upper from parse to result
  });

  it('should work with array iteration and filters', () => {
    // Test: actor.topmost_clothing[][{filter}]
  });
});
```

### End-to-End Tests

**Action Integration Tests** (`tests/e2e/scopeDsl/ClothingActionIntegration.e2e.test.js`):

```javascript
describe('Clothing Action Integration', () => {
  it('should resolve clothing targets for removal actions', () => {
    // Test: Complete action discovery with clothing scopes
  });

  it('should handle dynamic action generation', () => {
    // Test: Multiple removal actions from topmost items
  });
});
```

## Performance Considerations

### Optimization Strategies

1. **Equipment Caching**: Cache equipment component data during resolution
2. **Layer Priority**: Pre-compute layer priorities to avoid repeated lookups
3. **Slot Mapping**: Use efficient slot name validation
4. **Virtual Object Pooling**: Reuse virtual objects for slot access

### Performance Targets

- **Resolution Time**: < 5ms for simple clothing queries
- **Memory Usage**: < 1MB additional for resolver instances
- **Cache Hit Rate**: > 90% for equipment lookups within same turn

## Backward Compatibility

### Compatibility Guarantees

1. **Existing Scopes**: All current scope definitions continue to work unchanged
2. **Resolver Priority**: New resolvers have higher priority only for clothing fields
3. **Error Handling**: Unknown fields fall back to existing step resolver behavior
4. **API Stability**: No changes to public scope engine API

### Migration Support

- No migration required for existing scopes
- New clothing syntax is purely additive
- Gradual adoption possible with scope-by-scope updates

## Security Considerations

### Input Validation

1. **Slot Name Validation**: Restrict to predefined clothing slots
2. **Component Access**: Validate equipment component structure
3. **Entity ID Validation**: Ensure returned IDs are valid entity instances

### Performance Protection

1. **Depth Limiting**: Respect existing DSL depth limits
2. **Cycle Detection**: Prevent infinite resolution loops
3. **Memory Bounds**: Limit clothing data cache size

## Future Extensions

### Potential Enhancements

1. **Socket-Based Queries**: `actor.covered_sockets[]`
2. **Category Filtering**: `actor.formal_clothing[]`
3. **Layer Combinations**: `actor.visible_clothing[]` (outer + accessories)
4. **Equipment State**: `actor.dirty_clothing[]`

### Extension Pattern

The resolver architecture supports easy addition of new clothing operations:

```javascript
// Future resolver for clothing categories
const CLOTHING_CATEGORIES = {
  formal_clothing: ['suit', 'dress', 'formal_shirt'],
  casual_clothing: ['t_shirt', 'jeans', 'sneakers'],
  dirty_clothing: (item) =>
    item.components['clothing:condition']?.dirty === true,
};
```

## Conclusion

The Custom Step Resolver approach provides the optimal solution for clothing target resolution in the Scope DSL. It offers:

- **Intuitive syntax** matching user expectations
- **High performance** through direct equipment access
- **Extensible architecture** for future clothing operations
- **Clean integration** with existing DSL patterns
- **Minimal complexity** while maximizing functionality

This approach transforms complex 30-line JSON Logic expressions into simple, readable scope definitions that naturally integrate with the action templating system, enabling efficient and maintainable clothing interaction mechanics.

## References

- [Clothing Scope Implementation Analysis](../reports/clothing-scope-implementation-analysis.md)
- [ScopeDSL Architecture Analysis](../reports/scopedsl-architecture-and-e2e-coverage-analysis.md)
- [Living Narrative Engine CLAUDE.md](../CLAUDE.md)
