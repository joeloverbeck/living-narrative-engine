# Architectural Analysis: Clothing Removal Logic Issue

**Date**: September 10, 2025  
**Analyst**: Claude Code  
**Project**: Living Narrative Engine  
**Issue**: Inconsistent clothing removal availability due to coverage mapping logic gaps

---

## Executive Summary

### Problem Statement

Character Layla Agirre incorrectly shows two simultaneous clothing removal actions:

1. Remove `clothing:dark_olive_high_rise_double_pleat_trousers` (base layer, covers torso_lower)
2. Remove `clothing:power_mesh_boxer_brief` (underwear layer, torso_lower slot)

The boxer brief should NOT be removable when trousers are equipped, as the trousers have `coveragePriority: "base"` and should block access to underlying underwear layers.

### Business Impact

- **Gameplay Logic Violation**: Players can remove underwear while fully clothed
- **Narrative Consistency**: Breaks immersion with impossible clothing interactions
- **System Reliability**: Indicates fundamental gaps in the clothing system architecture

### Root Cause Summary

The `clothing:topmost_clothing` scope system operates independently of the `coverage_mapping` component, leading to incorrect determination of accessible clothing items.

---

## Technical Analysis

### Current System Architecture

#### 1. Clothing Removal Action (`remove_clothing.action.json`)

```json
{
  "id": "clothing:remove_clothing",
  "targets": {
    "primary": {
      "scope": "clothing:topmost_clothing"
    }
  }
}
```

#### 2. Topmost Clothing Scope (`topmost_clothing.scope`)

```dsl
clothing:topmost_clothing := actor.topmost_clothing[]
```

#### 3. Scope Resolution Chain

1. **ClothingStepResolver** (`src/scopeDsl/nodes/clothingStepResolver.js:18-212`)
   - Resolves `actor.topmost_clothing` to create clothing access object
   - Mode: `'topmost'` (line 32)
   - **No coverage mapping consultation**

2. **ArrayIterationResolver** (`src/scopeDsl/nodes/arrayIterationResolver.js:16-238`)
   - Processes `topmost_clothing[]` syntax
   - Uses `LAYER_PRIORITY` system (lines 27-33):
     ```javascript
     LAYER_PRIORITY = {
       topmost: ['outer', 'base', 'underwear'],
       // ...
     };
     ```
   - **Returns ALL items from ALL priority layers**

#### 4. Priority Calculation Issues

**Problem**: Two disconnected priority systems exist:

1. **Layer Priority** (arrayIterationResolver.js:27-33)

   ```javascript
   const LAYER_PRIORITY = {
     topmost: ['outer', 'base', 'underwear'], // All layers included
   };
   ```

2. **Coverage Priority** (priorityConstants.js:10-15)
   ```javascript
   export const COVERAGE_PRIORITY = Object.freeze({
     outer: 100, // Highest priority (lowest number)
     base: 200, // Medium priority
     underwear: 300, // Lowest priority (highest number)
     direct: 400,
   });
   ```

**The Issue**: `getAllClothingItems()` function (arrayIterationResolver.js:60-103) collects items from all layers without checking if higher-priority layers should block access to lower-priority ones.

### Current Execution Flow

For Layla Agirre with the problematic clothing setup:

1. **Equipment State**:

   ```json
   {
     "equipped": {
       "torso_lower": {
         "base": "clothing:dark_olive_high_rise_double_pleat_trousers",
         "underwear": "clothing:power_mesh_boxer_brief"
       }
     }
   }
   ```

2. **Topmost Clothing Resolution**:
   - `LAYER_PRIORITY.topmost = ['outer', 'base', 'underwear']`
   - Loop through layers (arrayIterationResolver.js:71-86):
     - Check `outer`: Not present, skip
     - Check `base`: Found `trousers` → Add to candidates
     - Check `underwear`: Found `boxer_brief` → Add to candidates
   - **Result**: Both items returned as "topmost"

3. **Coverage Mapping Ignored**:
   - Trousers have `"covers": ["torso_lower"], "coveragePriority": "base"`
   - This information is never consulted during scope resolution
   - Boxer brief remains accessible despite being covered

---

## Root Cause Analysis

### Primary Issues

#### 1. **Architectural Separation of Concerns Violation**

- **Coverage Logic**: Stored in `clothing:coverage_mapping` component
- **Accessibility Logic**: Implemented in `ArrayIterationResolver.getAllClothingItems()`
- **Problem**: These systems don't communicate

**Evidence**:

- `coverage_mapping.js` component exists but is not referenced in clothing resolvers
- No integration between coverage priority and layer priority systems

#### 2. **Inconsistent Priority System Implementation**

**Layer Priority Logic** (arrayIterationResolver.js:82-86):

```javascript
if (mode === 'topmost') {
  break; // Only take the topmost for topmost mode
}
```

**Problem**: The "break" only applies WITHIN a single slot's layers, not ACROSS different covered areas.

**Expected Logic**: Should check if a base layer covering torso_lower blocks access to underwear in the same area.

#### 3. **Missing Business Rule Validation**

**Current Logic**: "Return topmost item from each layer"
**Required Logic**: "Return topmost accessible item respecting coverage blocking"

### Secondary Issues

#### 4. **Incomplete Priority Calculation**

- `getCoveragePriorityFromMode()` function exists (arrayIterationResolver.js:42-51) but doesn't implement coverage blocking
- Priority scores calculated but not used for accessibility determination

#### 5. **Test Coverage Gaps**

- Tests verify layer priority but not coverage blocking scenarios
- Missing integration tests for coverage mapping interaction

---

## System Design Issues

### 1. **Data Flow Architecture Problems**

```
Current (Problematic) Flow:
Equipment Component → Layer Priority → Available Actions
                         ↑
                   (Missing Integration)
                         ↓
                 Coverage Mapping Component
```

```
Required Flow:
Equipment Component → Coverage Analysis → Layer Priority → Available Actions
                           ↑
                   Coverage Mapping Component
```

### 2. **Component Coupling Issues**

- **Low Cohesion**: Related clothing logic scattered across multiple resolvers
- **Tight Coupling**: ArrayIterationResolver directly implements clothing-specific logic
- **Missing Abstraction**: No unified clothing accessibility service

### 3. **Extensibility Limitations**

Current architecture makes it difficult to:

- Add new coverage rules (e.g., seasonal clothing)
- Implement context-dependent accessibility (e.g., social situations)
- Support complex layering scenarios (e.g., jackets over shirts)

---

## Impact Assessment

### Immediate Issues (High Priority)

1. **Gameplay Logic Errors**: 47 clothing items in the system could be affected
2. **User Experience**: Confusing action availability
3. **Data Consistency**: Equipment state doesn't match action availability

### Systemic Issues (Medium Priority)

1. **Technical Debt**: Duplicated priority logic across components
2. **Maintainability**: Changes require updates in multiple locations
3. **Testing Complexity**: Difficult to write comprehensive coverage tests

### Future Scalability Issues (Low Priority)

1. **Performance**: O(n²) complexity when checking coverage for large wardrobes
2. **Memory Usage**: Redundant priority calculations and caching
3. **Integration**: Difficult to add new clothing interaction types

---

## Recommendations

### Phase 1: Immediate Fix (High Priority)

#### 1.1 Integrate Coverage Mapping into ArrayIterationResolver

**Location**: `src/scopeDsl/nodes/arrayIterationResolver.js:60-103`

**Change**: Modify `getAllClothingItems()` to respect coverage blocking:

```javascript
function getAllClothingItems(clothingAccess, trace) {
  const { equipped, mode, entityId } = clothingAccess;
  const candidates = [];
  const layers = LAYER_PRIORITY[mode] || LAYER_PRIORITY.topmost;

  // NEW: Collect coverage information for all items
  const coverageAnalysis = analyzeCoverageBlocking(equipped, entityId);

  for (const [slotName, slotData] of Object.entries(equipped)) {
    if (!slotData || typeof slotData !== 'object') continue;

    for (const layer of layers) {
      if (slotData[layer]) {
        const itemId = slotData[layer];

        // NEW: Check if this item is blocked by higher priority coverage
        if (!coverageAnalysis.isAccessible(itemId, slotName, layer)) {
          continue; // Skip blocked items
        }

        candidates.push({
          itemId: itemId,
          layer: layer,
          slotName: slotName,
          coveragePriority: getCoveragePriorityFromMode(mode, layer),
          source: 'coverage',
          priority: 0,
        });

        if (mode === 'topmost') {
          break; // Only take the topmost accessible for topmost mode
        }
      }
    }
  }

  // Continue with existing priority calculation...
}
```

#### 1.2 Implement Coverage Blocking Analysis

**New File**: `src/scopeDsl/clothingSystem/coverageAnalyzer.js`

```javascript
export function analyzeCoverageBlocking(equipped, entityId) {
  // Analyze which items block access to others based on coverage mapping
  // Return accessibility map for all items
}
```

### Phase 2: Architectural Improvement (Medium Priority)

#### 2.1 Create Unified Clothing Service

**New File**: `src/clothing/clothingAccessibilityService.js`

- Centralize all clothing accessibility logic
- Integrate coverage mapping, priority systems, and business rules
- Provide single API for all clothing-related queries

#### 2.2 Refactor Priority System

**Consolidate**: Merge layer priority and coverage priority into single system

- Single source of truth for clothing priorities
- Consistent priority calculation across all components
- Cached priority lookup for performance

### Phase 3: System Enhancement (Low Priority)

#### 3.1 Enhanced Testing Strategy

- Integration tests for coverage blocking scenarios
- Performance tests for large wardrobe configurations
- Edge case testing for complex layering

#### 3.2 Extensibility Framework

- Plugin system for custom clothing rules
- Context-aware accessibility (weather, social situations)
- Advanced layering scenarios support

---

## Implementation Roadmap

### Sprint 1 (Week 1): Emergency Fix

- [ ] Implement coverage blocking in `getAllClothingItems()`
- [ ] Add `analyzeCoverageBlocking()` function
- [ ] Create integration tests for Layla Agirre scenario
- [ ] Verify fix resolves the immediate issue

### Sprint 2 (Week 2-3): System Integration

- [ ] Refactor priority calculation system
- [ ] Implement unified clothing accessibility service
- [ ] Update all clothing-related resolvers to use new service
- [ ] Comprehensive test suite for clothing interactions

### Sprint 3 (Week 4): Enhancement & Optimization

- [ ] Performance optimization for large clothing sets
- [ ] Enhanced error handling and logging
- [ ] Documentation and code review
- [ ] Deployment and monitoring setup

---

## Testing Strategy

### Unit Tests Required

1. **Coverage Blocking Logic**:

   ```javascript
   describe('Coverage Blocking', () => {
     it('should block underwear when base layer covers same area', () => {
       // Test Layla Agirre scenario specifically
     });
   });
   ```

2. **Priority System Integration**:
   ```javascript
   describe('Priority Integration', () => {
     it('should respect both layer and coverage priorities', () => {
       // Test complex multi-layer scenarios
     });
   });
   ```

### Integration Tests Required

1. **Action Discovery Integration**:
   - Verify `remove_clothing` action only shows accessible items
   - Test various clothing combinations and scenarios

2. **Scope Resolution Integration**:
   - Test `clothing:topmost_clothing` scope with coverage blocking
   - Verify consistency across different scope types

### Performance Tests Required

1. **Large Wardrobe Scenarios**:
   - Test with 50+ clothing items across multiple slots
   - Verify O(n) complexity for coverage analysis

---

## Risk Assessment

### Implementation Risks

| Risk                                    | Probability | Impact | Mitigation                                |
| --------------------------------------- | ----------- | ------ | ----------------------------------------- |
| Breaking existing clothing interactions | Medium      | High   | Comprehensive regression testing          |
| Performance degradation                 | Low         | Medium | Performance benchmarking and optimization |
| Integration complexity                  | Medium      | Medium | Phased rollout with feature flags         |

### Business Risks

| Risk                             | Probability | Impact | Mitigation                            |
| -------------------------------- | ----------- | ------ | ------------------------------------- |
| User confusion during transition | Low         | Low    | Clear communication and documentation |
| Gameplay balance changes         | Low         | Medium | Gradual rollout and user feedback     |

---

## Appendix

### A. Code References

- **Remove Clothing Action**: `data/mods/clothing/actions/remove_clothing.action.json`
- **Topmost Clothing Scope**: `data/mods/clothing/scopes/topmost_clothing.scope`
- **Clothing Step Resolver**: `src/scopeDsl/nodes/clothingStepResolver.js:18-212`
- **Array Iteration Resolver**: `src/scopeDsl/nodes/arrayIterationResolver.js:60-103`
- **Priority Constants**: `src/scopeDsl/prioritySystem/priorityConstants.js:10-15`
- **Layla Agirre Recipe**: `dist/data/mods/p_erotica/recipes/layla_agirre.recipe.json`

### B. Test File References

- **Coverage Mapping Tests**: `tests/integration/scopes/clothingTopMostTorsoLowerNoAccessories.integration.test.js`
- **Priority System Tests**: `tests/unit/scopeDsl/nodes/arrayIteration.test.js`

### C. Related Issues

This analysis may reveal similar issues with:

- Other clothing-related scopes (`outer_clothing`, `base_clothing`, etc.)
- Equipment systems in other domains (weapons, accessories)
- Action availability logic in other game mechanics

---

**Report Status**: Complete  
**Next Action**: Begin Phase 1 implementation following the recommended roadmap  
**Review Required**: Technical lead approval before implementation
