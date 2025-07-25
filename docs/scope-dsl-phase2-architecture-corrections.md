# Scope DSL Phase 2 Architecture Corrections

## 🚨 Critical Analysis: Workflow Assumptions vs Reality

**Date**: 2025-01-25  
**Scope**: Phase 2 Enhanced Filter Syntax Implementation  
**Status**: ❌ Major architectural discrepancies identified

## Executive Summary

The Phase 2 workflow document (`workflows/scope-dsl-union-filter-phase2-enhanced-filters.workflow.md`) contains **fundamental misunderstandings** about the Living Narrative Engine's clothing system architecture. The assumptions made about data structures, component organization, and identifier types are inconsistent with the actual codebase implementation.

**Impact**: Following the workflow as written would result in a broken implementation that conflicts with existing, working code.

## 📊 Detailed Discrepancy Analysis

### 1. Component Structure Mismatch

#### ❌ Workflow Assumption
**Location**: Lines 1196-1198, 1221-1223
```javascript
// INCORRECT - Workflow assumes this structure
"clothing:wearing": {
  "slots": {
    "torso:upper": {
      "items": ["leather_jacket", "tshirt"],
      "topmost": "leather_jacket"
    }
  }
}
```

#### ✅ Actual Implementation  
**Source**: `data/mods/clothing/components/equipment.component.json`
```javascript
// CORRECT - Actual structure
"clothing:equipment": {
  "equipped": {
    "torso_upper": {
      "outer": "leather_jacket_001",
      "base": "cotton_shirt_002", 
      "underwear": "undershirt_003"
    }
  }
}
```

**Evidence**: 
- Component schema at lines 8-34 clearly defines `equipped` structure
- Schema documentation: "Single equipped item entity ID" (line 20)
- Test data in `tests/integration/scopeDsl/clothingResolverChain.test.js:17-42`

### 2. Identifier Type Mismatch

#### ❌ Workflow Assumption
```javascript
// INCORRECT - Simple string identifiers
"items": ["leather_jacket", "tshirt"]
```

#### ✅ Actual Implementation
```javascript  
// CORRECT - Entity instance identifiers
"outer": "leather_jacket_001",
"base": "cotton_shirt_002"
```

**Evidence**:
- Schema line 20: `"description": "Single equipped item entity ID"`
- Schema line 25: `"description": "Array of equipped item entity IDs for slots that support multiple items"`
- Current resolver implementation returns entity instance IDs

### 3. Slot Structure Mismatch

#### ❌ Workflow Assumption
```javascript
// INCORRECT - Array-based slot structure
"torso:upper": {
  "items": ["item1", "item2"],
  "topmost": "item1"
}
```

#### ✅ Actual Implementation
```javascript
// CORRECT - Layer-based slot structure  
"torso_upper": {
  "underwear": "undershirt_003",
  "base": "cotton_shirt_002",
  "outer": "leather_jacket_001"
}
```

**Evidence**:
- Schema lines 16-29 define layer-based structure
- Enum values: `["underwear", "base", "outer", "accessories"]`
- Current implementation in `clothingStepResolver.js:68-70`

## 🔍 Code Evidence Analysis

### Current Working Implementation

#### ClothingStepResolver (Lines 67-104)
```javascript
function resolveClothingField(entityId, field, trace) {
  const equipment = entitiesGateway.getComponentData(
    entityId,
    'clothing:equipment'  // ✅ CORRECT component
  );
  
  if (!equipment?.equipped) {
    // Handle missing equipment
  }
  
  return {
    __clothingSlotAccess: true,
    equipped: equipment.equipped,  // ✅ CORRECT structure
    mode: mode,
    type: 'clothing_slot_access'
  };
}
```

#### ArrayIterationResolver (Lines 22-43)
```javascript
function getAllClothingItems(clothingAccess) {
  const { equipped, mode } = clothingAccess;
  const result = [];
  
  for (const [slotName, slotData] of Object.entries(equipped)) {
    for (const layer of layers) {
      if (slotData[layer]) {
        result.push(slotData[layer]); // ✅ Returns entity instance IDs
      }
    }
  }
  
  return result;
}
```

### Test Data Validation
**File**: `tests/integration/scopeDsl/clothingResolverChain.test.js:17-42`
```javascript
const mockEquipmentData = {
  equipped: {
    torso_upper: {
      outer: 'leather_jacket_001',    // ✅ Entity instance ID
      base: 'cotton_shirt_002',       // ✅ Entity instance ID
      underwear: 'undershirt_003',    // ✅ Entity instance ID
    },
    torso_lower: {
      outer: 'jeans_004',
      base: 'shorts_005',
    }
  }
};
```

**Test Expectation** (Line 76):
```javascript
expect(result).toEqual(new Set(['leather_jacket_001'])); // ✅ Entity instance IDs
```

## 🎯 Architectural Impact Assessment

### What Works ✅
1. **Current Scope DSL Implementation**: Already handles entity instance IDs correctly
2. **Component Schema**: Properly defines equipment structure
3. **Resolver Chain**: ClothingStepResolver → ArrayIterationResolver → SlotAccessResolver works correctly
4. **Filter Integration**: Existing filter system can handle entity IDs

### What's Broken in Workflow ❌
1. **Wrong Component**: References non-existent `clothing:wearing`
2. **Wrong Structure**: Assumes array-based items instead of layer-based equipped
3. **Wrong Identifiers**: Assumes simple strings instead of entity instance IDs
4. **Wrong Access Patterns**: Examples use incorrect data access paths

## 🛠️ Corrected Implementation Approach

### Phase 2 Should Target: Entity Instance ID Filtering

#### Correct Data Flow
```
Scope Query: actor.all_clothing[]
      ↓
ClothingStepResolver: Gets clothing:equipment component
      ↓
ArrayIterationResolver: Extracts entity instance IDs
      ↓
FilterResolver: Filters entity IDs by their component properties
      ↓
Result: Set of filtered entity instance IDs
```

#### Correct Filter Examples

**✅ Instead of workflow's incorrect examples:**
```javascript
// INCORRECT (from workflow)
actor.all_clothing[][{"in": ["waterproof", {"var": "tags"}]}]
```

**✅ Should be:**
```javascript
// CORRECT - Filter entity instance IDs by their component properties
actor.all_clothing[][{"in": ["waterproof", {"var": "components.core:tags.tags"}]}]
```

### Implementation Requirements

#### 1. Enhanced Evaluation Context
The workflow's `createEvaluationContext` enhancement is **partially correct** but needs adjustment:

```javascript
// ✅ CORRECT approach - entity instance ID lookup
function createEvaluationContext(itemId, actorEntity, entitiesGateway, locationProvider, trace) {
  // First try as entity (this will work for clothing instance IDs)
  const entity = entitiesGateway.getEntity?.(itemId);
  if (entity) {
    return createEntityEvaluationContext(entity, actorEntity, entitiesGateway, locationProvider);
  }
  
  // Fallback for non-entity items (less common case)
  // ... rest of implementation
}
```

#### 2. Gateway Enhancement
The workflow's gateway enhancement concept is correct, but the examples are wrong:

```javascript
// ✅ CORRECT - should work with entity instance IDs
getItemComponents: (itemId) => {
  // First check if it's an entity (most clothing items will be)
  const entity = entityManager?.getEntity(itemId);
  if (entity) {
    const components = {};
    for (const [componentId, data] of entity.components) {
      components[componentId] = data;
    }
    return components;
  }
  // ... other lookup strategies
}
```

## 📝 Corrected Examples

### Working Filter Scenarios

#### Find Waterproof Clothing
```javascript
// ✅ CORRECT - filters entity instance IDs
const waterproofGear = engine.resolve(
  'actor.all_clothing[][{"in": ["waterproof", {"var": "components.core:tags.tags"}]}]',
  actorEntity, 
  runtimeCtx
);
// Returns: Set(['leather_jacket_001', 'boots_006']) - entity instance IDs
```

#### Find Armor by Rating
```javascript
// ✅ CORRECT - accesses entity components
const strongArmor = engine.resolve(
  'actor.all_clothing[][{">": [{"var": "components.clothing:armor.rating"}, 5]}]',
  actorEntity,
  runtimeCtx  
);
// Returns: Set(['leather_jacket_001']) - entity instance IDs with armor rating > 5
```

#### Layer-Specific Queries
```javascript
// ✅ CORRECT - works with actual layer structure
const outerClothing = engine.resolve('actor.outer_clothing[]', actorEntity, runtimeCtx);
// Returns: Set(['leather_jacket_001', 'jeans_004', 'boots_006'])
```

### Mock Data for Testing

#### Correct Test Setup
```javascript
// ✅ CORRECT test data structure
const mockEquipmentData = {
  equipped: {
    torso_upper: {
      outer: 'leather_jacket_001',
      base: 'cotton_shirt_002'
    }
  }
};

// ✅ CORRECT entity definitions (for filtering)
const mockEntities = {
  'leather_jacket_001': {
    id: 'leather_jacket_001',
    components: new Map([
      ['core:tags', { tags: ['waterproof', 'armor'] }],
      ['clothing:armor', { rating: 8 }]
    ])
  },
  'cotton_shirt_002': {
    id: 'cotton_shirt_002', 
    components: new Map([
      ['core:tags', { tags: ['casual', 'base'] }]
    ])
  }
};
```

## 🔧 Recommended Corrections

### 1. Update Workflow Document
- Replace all references to `clothing:wearing` with `clothing:equipment`
- Update all examples to use entity instance IDs instead of simple identifiers
- Correct the data structure examples to use layer-based equipped structure
- Update filter examples to work with actual component access patterns

### 2. Adjust Implementation Strategy
- **Keep** the enhanced evaluation context concept (it's good)
- **Fix** the examples to work with entity instance IDs
- **Remove** assumptions about non-existent components
- **Align** with existing working architecture

### 3. Testing Approach
- Use actual component schemas for test data
- Test with entity instance IDs, not simple identifiers
- Validate against existing working resolver chain
- Ensure backward compatibility with current Scope DSL

## ⚠️ Migration Path

### For Existing Code ✅
**No changes needed** - current Scope DSL implementation is correct and working.

### For Phase 2 Implementation
1. **Use existing architecture** as the foundation
2. **Enhance entity lookup** in evaluation contexts (as planned)
3. **Filter entity instance IDs** by their component properties
4. **Test with actual data structures** not workflow assumptions

## 🎯 Success Criteria (Corrected)

### ✅ What Should Work After Phase 2
```javascript
// Filter clothing entities by their component properties
actor.all_clothing[][{"in": ["waterproof", {"var": "components.core:tags.tags"}]}]

// Access nested component properties
actor.equipped_armor[][{">": [{"var": "components.clothing:armor.protection.physical"}, 5]}]

// Complex filters with actual entity data
actor.outer_clothing[][{
  "and": [
    {"in": ["leather", {"var": "components.core:material.type"}]},
    {">": [{"var": "components.clothing:armor.rating"}, 7]}
  ]
}]
```

### ❌ What Won't Work (From Workflow)
```javascript
// These assume incorrect data structures and won't work
actor.all_clothing[][{"==": [{"var": "type"}, "leather"]}]  // Wrong - no flattened 'type'
actor.inventory[][{"var": "quality"}]  // Wrong - assumes simple item structure
```

## 📋 Action Items

### Immediate (High Priority)
- [ ] Revise workflow document with correct architectural assumptions
- [ ] Update all code examples to use entity instance IDs
- [ ] Correct component references from `clothing:wearing` to `clothing:equipment`
- [ ] Align test scenarios with actual data structures

### Phase 2 Implementation (Medium Priority) 
- [ ] Implement enhanced evaluation context for entity instance IDs
- [ ] Add entity lookup capabilities to gateway (for filtering)
- [ ] Create integration tests with correct data structures
- [ ] Validate filter performance with actual entity data

### Documentation (Low Priority)
- [ ] Update API documentation with correct examples
- [ ] Create migration guide for Phase 2 features
- [ ] Document best practices for clothing queries

## 🔚 Conclusion

The workflow document requires **significant architectural corrections** before implementation. The current codebase is well-designed and working correctly - Phase 2 should build on this solid foundation rather than introducing incompatible assumptions.

**Key Takeaway**: Always validate architectural assumptions against actual codebase implementation before planning major features.