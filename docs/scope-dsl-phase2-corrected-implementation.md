# Scope DSL Phase 2: Corrected Enhanced Filter Implementation

## 🎯 Overview

This document provides the **architecturally correct** approach for implementing Phase 2 Enhanced Filter Syntax, based on the actual Living Narrative Engine codebase architecture.

**Key Principle**: Build on existing working systems rather than introducing incompatible assumptions.

## 🏗️ Correct Architecture Foundation

### Actual Clothing System Structure

#### Component: `clothing:equipment`
```javascript
{
  "equipped": {
    "torso_upper": {
      "underwear": "undershirt_instance_001",
      "base": "cotton_shirt_instance_002", 
      "outer": "leather_jacket_instance_003"
    },
    "torso_lower": {
      "base": "jeans_instance_004",
      "outer": "coat_instance_005"
    },
    "feet": {
      "outer": "boots_instance_006"
    }
  }
}
```

#### Entity Instance IDs
- Values in equipped slots are **entity instance identifiers**
- Each represents a specific instance of a clothing item
- These entities have their own components (tags, materials, stats, etc.)

#### Current Scope DSL Flow
```
Query: actor.all_clothing[]
  ↓
ClothingStepResolver: Accesses clothing:equipment.equipped
  ↓ 
ArrayIterationResolver: Extracts entity instance IDs
  ↓
Result: Set(['leather_jacket_instance_003', 'cotton_shirt_instance_002', ...])
```

## 🔧 Phase 2 Implementation Strategy

### Goal: Enable Property-Based Filtering on Entity Instance IDs

The current system returns entity instance IDs from clothing queries. Phase 2 should enable filtering these IDs based on their component properties.

### Implementation Approach

#### 1. Enhanced Evaluation Context (✅ Correct Concept)

```javascript
/**
 * Creates evaluation context for entity instance IDs returned by clothing queries
 */
function createEvaluationContext(itemId, actorEntity, entitiesGateway, locationProvider, trace) {
  // Handle null/undefined
  if (itemId == null) {
    return null;
  }

  // Handle string items (entity instance IDs from clothing system)
  if (typeof itemId === 'string') {
    // First try as entity (this is the primary path for clothing items)
    const entity = entitiesGateway.getEntity?.(itemId);
    if (entity) {
      if (trace) {
        trace.addLog('debug', `Item ${itemId} resolved as entity`, 'createEvaluationContext');
      }
      
      // Use existing entity context creation
      return createEntityEvaluationContext(
        entity,
        actorEntity, 
        entitiesGateway,
        locationProvider
      );
    }

    // Fallback: Try component registry lookup for non-entity items
    const components = resolveItemComponents(itemId, entitiesGateway);
    if (components) {
      return createItemEvaluationContext(itemId, components, actorEntity, locationProvider);
    }
  }

  // Fallback for non-string items
  return createBasicEvaluationContext(itemId, actorEntity, locationProvider);
}
```

#### 2. Gateway Enhancement for Non-Entity Lookups

```javascript
// In engine.js _createEntitiesGateway method
getItemComponents: (itemId) => {
  // Primary path: Check if it's an entity (most clothing items)
  const entity = entityManager?.getEntity(itemId);
  if (entity) {
    // Convert entity components to plain object for JSON Logic
    const components = {};
    for (const [componentId, data] of entity.components) {
      components[componentId] = data;
    }
    return components;
  }

  // Fallback: Try component registry for item templates/definitions
  if (componentRegistry) {
    // Check for item definitions in registry
    const itemDef = componentRegistry.getDefinition?.(`item:${itemId}`);
    if (itemDef?.components) {
      return itemDef.components;
    }

    // Check clothing-specific definitions
    const clothingDef = componentRegistry.getDefinition?.(`clothing:${itemId}`);
    if (clothingDef?.components) {
      return clothingDef.components;
    }
  }

  return null;
}
```

### 3. Filter Resolution (✅ Minimal Changes Needed)

The existing filter resolver should work correctly with minimal modifications:

```javascript
// In filterResolver.js - the existing logic should work
for (const item of parentResult) {
  try {
    // Enhanced context creation handles entity instance IDs
    const evalCtx = createEvaluationContext(
      item,              // Entity instance ID from clothing system
      actorEntity,
      entitiesGateway,   // Enhanced with getItemComponents
      locationProvider,
      trace
    );

    if (!evalCtx) {
      continue;
    }

    // JSON Logic evaluation with entity context
    const evalResult = logicEval.evaluate(node.logic, evalCtx);

    if (evalResult) {
      result.add(item);
    }
  } catch (error) {
    // Handle errors gracefully
    if (trace) {
      trace.addLog('error', `Error filtering item ${item}: ${error.message}`, 'filterResolver');
    }
  }
}
```

## 🎨 Correct Usage Examples

### Basic Property Filtering

#### Find Waterproof Clothing
```javascript
// Query: Get all clothing, filter by tags
const expression = 'actor.all_clothing[][{"in": ["waterproof", {"var": "components.core:tags.tags"}]}]';
const ast = engine.parse(expression);
const result = engine.resolve(ast, actorEntity, runtimeCtx);

// Returns: Set(['leather_jacket_instance_003', 'boots_instance_006'])
// These are entity instance IDs that have 'waterproof' in their core:tags component
```

#### Find High-Quality Items
```javascript
const expression = 'actor.all_clothing[][{"==": [{"var": "components.core:material.quality"}, "high"]}]';
const result = engine.resolve(ast, actorEntity, runtimeCtx);
// Returns entity instance IDs with high-quality materials
```

### Complex Filtering

#### Find Protective Outer Wear
```javascript
const expression = `actor.outer_clothing[][{
  "and": [
    {"in": ["armor", {"var": "components.core:tags.tags"}]},
    {">": [{"var": "components.clothing:armor.rating"}, 5]}
  ]
}]`;

// Returns outer layer clothing that:
// 1. Has 'armor' in tags
// 2. Has armor rating > 5
```

#### Combined Slot Filtering
```javascript
const expression = `(actor.topmost_clothing.torso_upper | actor.topmost_clothing.feet)[{
  "in": ["leather", {"var": "components.core:material.type"}]
}]`;

// Returns leather items from torso_upper OR feet slots
```

### Entity Context Structure

When filtering, each entity instance ID gets this evaluation context:

```javascript
{
  // Entity properties
  id: "leather_jacket_instance_003",
  
  // Component access (existing entity evaluation context)
  components: {
    "core:tags": { tags: ["waterproof", "armor", "outer"] },
    "core:material": { type: "leather", quality: "high" },
    "clothing:armor": { rating: 8, protection: { physical: 8, magical: 2 } },
    "clothing:wearable": { layer: "outer", equipmentSlots: { primary: "torso_upper" } }
  },
  
  // Flattened access (for convenience - optional enhancement)
  tags: ["waterproof", "armor", "outer"],
  
  // Context properties
  actor: { /* actor entity context */ },
  location: { /* location context */ }
}
```

## 🧪 Testing Strategy

### Test Data Setup

#### Mock Equipment Data
```javascript
const mockEquipmentData = {
  equipped: {
    torso_upper: {
      outer: 'leather_jacket_001',
      base: 'cotton_shirt_002'
    },
    feet: {
      outer: 'boots_003'
    }
  }
};
```

#### Mock Entity Instances
```javascript
const mockEntities = {
  'leather_jacket_001': {
    id: 'leather_jacket_001',
    components: new Map([
      ['core:tags', { tags: ['waterproof', 'armor'] }],
      ['core:material', { type: 'leather', quality: 'high' }],
      ['clothing:armor', { rating: 8 }]
    ])
  },
  'cotton_shirt_002': {
    id: 'cotton_shirt_002',
    components: new Map([
      ['core:tags', { tags: ['casual', 'base'] }],
      ['core:material', { type: 'cotton', quality: 'normal' }]
    ])
  },
  'boots_003': {
    id: 'boots_003', 
    components: new Map([
      ['core:tags', { tags: ['waterproof', 'durable'] }],
      ['core:material', { type: 'leather', quality: 'high' }]
    ])
  }
};
```

### Test Scenarios

#### Integration Test Example
```javascript
it('should filter clothing entities by component properties', () => {
  // Setup entity manager to return mock entities
  mockRuntimeCtx.entityManager.getEntity
    .mockImplementation(id => mockEntities[id] || null);

  const expression = 'actor.all_clothing[][{"in": ["waterproof", {"var": "components.core:tags.tags"}]}]';
  const ast = engine.parse(expression);
  const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);

  // Should return entity instance IDs that have 'waterproof' tag
  expect(Array.from(result).sort()).toEqual(['boots_003', 'leather_jacket_001']);
});
```

## 📋 Implementation Tickets (Corrected)

### Ticket 2.1: Enhanced Evaluation Context
- **Time**: 2 hours (reduced - simpler than workflow assumed)
- **Focus**: Handle entity instance IDs in evaluation contexts
- **Key Change**: Ensure `createEvaluationContext` works with entity IDs from clothing system

### Ticket 2.2: Gateway Enhancement  
- **Time**: 1 hour (reduced - minimal changes needed)
- **Focus**: Add `getItemComponents` for fallback cases
- **Key Change**: Support non-entity lookups while keeping entity path primary

### Ticket 2.3: Filter Integration
- **Time**: 1 hour (reduced - minimal changes)
- **Focus**: Verify filter resolver works with enhanced contexts
- **Key Change**: Add trace logging and error handling

### Ticket 2.4: Integration Testing
- **Time**: 3 hours (maintained - comprehensive testing important)
- **Focus**: Test with actual entity instance IDs and component structures
- **Key Change**: Use correct data structures in tests

### Ticket 2.5: Documentation
- **Time**: 2 hours (maintained)
- **Focus**: Document correct usage patterns
- **Key Change**: All examples use entity instance IDs and actual component access

**Total Time**: 9 hours (reduced from workflow's 12 hours due to architectural alignment)

## ⚡ Quick Start Implementation

### 1. Verify Current System Works
```javascript
// This should already work - test it first
const result = engine.resolve('actor.all_clothing[]', actorEntity, runtimeCtx);
console.log(Array.from(result)); 
// Should show entity instance IDs like ['leather_jacket_001', 'cotton_shirt_002']
```

### 2. Test Entity Lookup
```javascript
// This should work if entities exist
const entity = runtimeCtx.entityManager.getEntity('leather_jacket_001');
console.log(entity.components); 
// Should show entity's component data
```

### 3. Implement Enhanced Context
Start with the `createEvaluationContext` enhancement to handle entity instance IDs.

### 4. Test Filtering
```javascript
// Try basic filtering once context is enhanced
const filtered = engine.resolve(
  'actor.all_clothing[][{"in": ["waterproof", {"var": "components.core:tags.tags"}]}]',
  actorEntity, 
  runtimeCtx
);
```

## 🚀 Success Metrics

### ✅ Working Examples After Implementation
```javascript
// Basic property access
actor.all_clothing[][{"var": "components.core:tags.tags"}]

// Property filtering  
actor.all_clothing[][{"in": ["armor", {"var": "components.core:tags.tags"}]}]

// Nested property access
actor.all_clothing[][{">": [{"var": "components.clothing:armor.rating"}, 5]}]

// Complex conditions
actor.outer_clothing[][{
  "and": [
    {"==": [{"var": "components.core:material.type"}, "leather"]},
    {"in": ["waterproof", {"var": "components.core:tags.tags"}]}
  ]
}]
```

### 📊 Performance Expectations
- **Entity Lookup**: O(1) for entity instance IDs (existing hash map)
- **Component Access**: O(1) for component data (existing Map structure)  
- **Filter Evaluation**: O(n) where n = number of clothing items (acceptable)

## 🔚 Summary

Phase 2 implementation should be **simpler and more reliable** when aligned with actual architecture:

1. **Build on working foundation** - current clothing system is solid
2. **Entity instance IDs are the correct abstraction** - they have rich component data
3. **Minimal changes needed** - mainly enhancing evaluation contexts
4. **Real-world testing possible** - using actual entities and components

This approach ensures Phase 2 integrates seamlessly with existing systems while providing powerful filtering capabilities.