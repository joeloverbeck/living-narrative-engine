# Intelligent Clothing Coverage System - Implementation Specification

## Implementation Status

**Status**: NOT IMPLEMENTED  
**Type**: NEW FEATURE SPECIFICATION  
**Current Production State**:

- SlotAccessResolver exists but lacks coverage-aware logic
- Clothing system supports slot-based equipment only
- No coverage mapping components exist
- Actions resolve clothing based solely on direct slot equipment
- Semantic mismatches exist in intimate actions (e.g., "fondle ass over the panties" instead of "over the jeans")

This specification describes a comprehensive enhancement to the existing clothing system to support intelligent coverage resolution.

## 1. Feature Overview

### 1.1 Purpose

The Intelligent Clothing Coverage System addresses the semantic mismatch in clothing-aware actions where items equipped in one slot (e.g., pants in "legs") should logically cover and take priority over items in another slot (e.g., panties in "torso_lower") for action text generation and availability.

### 1.2 Core Problem

**Current Behavior:**

- Character wears jeans (legs slot) + panties (torso_lower slot)
- Action result: "fondle {primary}'s ass over the panties" ❌

**Desired Behavior:**

- Same configuration should result in: "fondle {primary}'s ass over the jeans" ✅

### 1.3 Key Features

- **Coverage Mapping Component**: Define which body regions clothing items cover when equipped
- **Priority-Based Resolution**: Intelligent priority system for coverage vs. direct equipment
- **Backward Compatibility**: Existing clothing system continues to work unchanged
- **Performance Optimized**: Minimal impact on scope resolution performance
- **Extensible Design**: Foundation for future coverage scenarios (coats, gloves, etc.)

## 2. Architecture & Design

### 2.1 System Architecture

```
Enhanced Clothing Resolution System
├── Component Layer
│   ├── clothing:coverage_mapping (NEW)
│   └── clothing:equipment (existing)
├── Resolution Layer
│   ├── ClothingStepResolver (existing)
│   └── SlotAccessResolver (ENHANCED)
└── Priority System
    ├── Coverage Priority Engine (NEW)
    └── Layer Priority System (existing)
```

### 2.2 Data Model

#### Coverage Mapping Component

**File**: `data/mods/clothing/components/coverage_mapping.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "clothing:coverage_mapping",
  "description": "Defines additional body slots that clothing items cover when equipped",
  "dataSchema": {
    "type": "object",
    "properties": {
      "covers": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": [
            "torso_upper",
            "torso_lower",
            "legs",
            "feet",
            "head_gear",
            "hands",
            "left_arm_clothing",
            "right_arm_clothing"
          ]
        },
        "description": "Array of clothing slots this item covers when worn",
        "uniqueItems": true
      },
      "coveragePriority": {
        "type": "string",
        "enum": ["outer", "base", "underwear"],
        "description": "Priority level for coverage resolution"
      }
    },
    "required": ["covers", "coveragePriority"],
    "additionalProperties": false
  }
}
```

#### Priority System Design

```javascript
const COVERAGE_PRIORITY = {
  outer: 100, // Outer layer coverage (coats, jackets)
  base: 200, // Base layer coverage (pants, shirts)
  underwear: 300, // Underwear layer coverage (bras, panties)
  direct: 400, // Direct slot equipment (fallback)
};

const LAYER_PRIORITY_WITHIN_COVERAGE = {
  outer: 10, // Within same coverage level, outer wins
  base: 20,
  underwear: 30,
  accessories: 40,
};
```

### 2.3 Enhanced SlotAccessResolver

**File**: `src/scopeDsl/nodes/slotAccessResolver.js` (MODIFICATIONS)

#### Core Enhancement Logic

```javascript
/**
 * Enhanced slot resolution that considers coverage mapping
 * @param {string} entityId - Entity to resolve clothing for
 * @param {string} targetSlot - Slot to resolve (e.g., 'torso_lower')
 * @param {string} mode - Resolution mode ('topmost', 'topmost_no_accessories', etc.)
 * @param {object} trace - Trace object for debugging
 * @returns {string|null} Entity ID of resolved clothing item or null
 */
function resolveCoverageAwareSlot(entityId, targetSlot, mode, trace) {
  const allCandidates = [];
  const equipment = getEquipment(entityId);

  // 1. Collect covering items from all slots
  for (const [slotName, slotData] of Object.entries(equipment.equipped || {})) {
    for (const [layer, itemId] of Object.entries(slotData)) {
      const coverageMapping = entitiesGateway.getComponentData(
        itemId,
        'clothing:coverage_mapping'
      );
      if (coverageMapping?.covers?.includes(targetSlot)) {
        allCandidates.push({
          itemId,
          layer,
          slotName,
          coveragePriority: coverageMapping.coveragePriority,
          priority: calculateCoveragePriority(
            coverageMapping.coveragePriority,
            layer
          ),
          source: 'coverage',
        });
      }
    }
  }

  // 2. Collect direct items from target slot
  const directSlotData = equipment.equipped[targetSlot] || {};
  for (const [layer, itemId] of Object.entries(directSlotData)) {
    allCandidates.push({
      itemId,
      layer,
      slotName: targetSlot,
      coveragePriority: 'direct',
      priority: calculateCoveragePriority('direct', layer),
      source: 'direct',
    });
  }

  // 3. Apply mode filtering (no_accessories, etc.)
  const filteredCandidates = filterByMode(allCandidates, mode);

  // 4. Sort by priority (lowest number = highest priority)
  filteredCandidates.sort((a, b) => a.priority - b.priority);

  // 5. Add tracing information
  if (trace) {
    trace.coverageResolution = {
      targetSlot,
      totalCandidates: allCandidates.length,
      filteredCandidates: filteredCandidates.length,
      selectedItem: filteredCandidates[0]?.itemId || null,
      candidates: filteredCandidates.map((c) => ({
        itemId: c.itemId,
        priority: c.priority,
        source: c.source,
        coveragePriority: c.coveragePriority,
        layer: c.layer,
      })),
    };
  }

  return filteredCandidates[0]?.itemId || null;
}

/**
 * Calculate priority score for coverage resolution
 * Lower scores have higher priority
 */
function calculateCoveragePriority(coveragePriority, layer) {
  const coverageScore = COVERAGE_PRIORITY[coveragePriority] || 400;
  const layerScore = LAYER_PRIORITY_WITHIN_COVERAGE[layer] || 40;
  return coverageScore + layerScore;
}

/**
 * Filter candidates based on resolution mode
 */
function filterByMode(candidates, mode) {
  const allowedLayers = LAYER_PRIORITY[mode] || LAYER_PRIORITY.topmost;
  return candidates.filter((candidate) =>
    allowedLayers.includes(candidate.layer)
  );
}
```

## 3. Implementation Plan

### 3.1 Phase 1: Component Foundation

**Duration**: 1 week

#### Tasks

1. **Create Coverage Mapping Component Schema**
   - File: `data/mods/clothing/components/coverage_mapping.component.json`
   - JSON Schema with validation rules
   - Integration with component loading system

2. **Add Coverage Data to Existing Clothing Items**
   - Update key clothing entities with coverage mapping:
     - `dark_indigo_denim_jeans.entity.json`: covers torso_lower, priority base
     - `graphite_wool_wide_leg_trousers.entity.json`: covers torso_lower, priority base
     - `white_thigh_high_socks_pink_hearts.entity.json`: covers torso_lower, priority underwear
     - `indigo_denim_trucker_jacket.entity.json`: covers torso_upper, priority outer
     - `dark_olive_cotton_twill_chore_jacket.entity.json`: covers torso_upper/torso_lower, priority outer

#### Example Implementation

```json
// dark_indigo_denim_jeans.entity.json
{
  "id": "clothing:dark_indigo_denim_jeans",
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "legs"
      },
      "allowedLayers": ["base", "outer"]
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_lower"],
      "coveragePriority": "base"
    }
    // ... existing components
  }
}
```

#### Acceptance Criteria

- [ ] Component schema validates correctly
- [ ] Component integrates with existing loading system
- [ ] At least 10 clothing items have coverage mapping added
- [ ] No breaking changes to existing clothing system

### 3.2 Phase 2: SlotAccessResolver Enhancement

**Duration**: 1.5 weeks

#### Tasks

1. **Implement Coverage Resolution Logic**
   - Add `resolveCoverageAwareSlot` function
   - Implement priority calculation system
   - Add comprehensive tracing support
   - Maintain backward compatibility

2. **Integrate with Existing Resolution Flow**
   - Modify main `resolve` method to use coverage-aware logic
   - Add fallback to existing logic for compatibility
   - Implement performance optimizations

#### Modified Files

- `src/scopeDsl/nodes/slotAccessResolver.js`

#### Key Changes

```javascript
// Enhanced resolve method
function resolve(node, context, trace) {
  if (!canResolve(node)) {
    return null;
  }

  const clothingAccess = context.getValue();
  if (!isClothingAccessResult(clothingAccess)) {
    return null;
  }

  const slotName = node.field;

  // Use coverage-aware resolution for supported slots
  if (CLOTHING_SLOTS.includes(slotName)) {
    return resolveCoverageAwareSlot(
      clothingAccess.entityId,
      slotName,
      clothingAccess.mode,
      trace
    );
  }

  // Fallback to original logic for unsupported slots
  return resolveLegacySlotAccess(clothingAccess, slotName, trace);
}
```

#### Acceptance Criteria

- [ ] Coverage-aware resolution works for all clothing slots
- [ ] Existing functionality remains unchanged
- [ ] Comprehensive tracing information available
- [ ] Performance impact < 50% increase in resolution time
- [ ] All existing tests continue to pass

### 3.3 Phase 3: Testing & Validation

**Duration**: 1 week

#### Unit Tests

**File**: `tests/unit/scopeDsl/nodes/slotAccessResolver.coverage.test.js`

```javascript
describe('SlotAccessResolver - Coverage Mapping', () => {
  let resolver, mockEntitiesGateway, testBed;

  beforeEach(() => {
    testBed = createTestBed();
    mockEntitiesGateway = testBed.createMockEntitiesGateway();
    resolver = createSlotAccessResolver({
      entitiesGateway: mockEntitiesGateway,
    });
  });

  describe('Coverage-Aware Resolution', () => {
    it('should prioritize covering items over direct items', () => {
      // Setup: Entity with jeans (covering torso_lower) and panties (direct torso_lower)
      const entityId = 'character_1';

      mockEntitiesGateway.getComponentData
        .mockReturnValueOnce({
          equipped: {
            legs: { base: 'jeans_id' },
            torso_lower: { underwear: 'panties_id' },
          },
        }) // equipment call
        .mockReturnValueOnce({
          covers: ['torso_lower'],
          coveragePriority: 'base',
        }) // coverage mapping for jeans
        .mockReturnValueOnce(null); // no coverage mapping for panties

      const node = { type: 'Step', field: 'torso_lower' };
      const context = { getValue: () => ({ entityId, mode: 'topmost' }) };
      const trace = {};

      const result = resolver.resolve(node, context, trace);

      expect(result).toBe('jeans_id');
      expect(trace.coverageResolution.selectedItem).toBe('jeans_id');
    });

    it('should respect layer priority within same coverage level', () => {
      // Setup: Entity with outer coat and base jacket both covering torso_lower
      const entityId = 'character_1';

      mockEntitiesGateway.getComponentData
        .mockReturnValueOnce({
          equipped: {
            torso_upper: {
              outer: 'coat_id',
              base: 'jacket_id',
            },
          },
        })
        .mockReturnValueOnce({
          covers: ['torso_upper', 'torso_lower'],
          coveragePriority: 'outer',
        }) // coat coverage
        .mockReturnValueOnce({
          covers: ['torso_upper'],
          coveragePriority: 'base',
        }); // jacket coverage

      const result = resolver.resolve(node, context, trace);

      expect(result).toBe('coat_id'); // Outer layer wins
    });

    it('should handle no_accessories mode with covering items', () => {
      // Test that accessories are properly excluded even in coverage resolution
      const context = {
        getValue: () => ({ entityId, mode: 'topmost_no_accessories' }),
      };

      // Setup entity with accessory that covers torso_lower
      mockEntitiesGateway.getComponentData
        .mockReturnValueOnce({
          equipped: {
            torso_lower: { accessories: 'belt_id' },
          },
        })
        .mockReturnValueOnce({
          covers: ['torso_lower'],
          coveragePriority: 'base',
        });

      const result = resolver.resolve(node, context, trace);

      expect(result).toBeNull(); // Accessory excluded by mode
    });

    it('should fallback to direct items when no covering items exist', () => {
      // Setup: Entity with only direct slot equipment, no covering items
      mockEntitiesGateway.getComponentData
        .mockReturnValueOnce({
          equipped: {
            torso_lower: { underwear: 'panties_id' },
          },
        })
        .mockReturnValueOnce(null); // no coverage mapping

      const result = resolver.resolve(node, context, trace);

      expect(result).toBe('panties_id');
    });

    it('should handle multiple covering items from different slots', () => {
      // Complex scenario: pants (legs->torso_lower) + coat (torso_upper->torso_lower)
      mockEntitiesGateway.getComponentData
        .mockReturnValueOnce({
          equipped: {
            legs: { base: 'pants_id' },
            torso_upper: { outer: 'coat_id' },
          },
        })
        .mockReturnValueOnce({
          covers: ['torso_lower'],
          coveragePriority: 'base',
        }) // pants coverage
        .mockReturnValueOnce({
          covers: ['torso_upper', 'torso_lower'],
          coveragePriority: 'outer',
        }); // coat coverage

      const result = resolver.resolve(node, context, trace);

      expect(result).toBe('coat_id'); // Outer coverage priority > base coverage
      expect(trace.coverageResolution.totalCandidates).toBe(2);
    });
  });

  describe('Performance', () => {
    it('should complete coverage resolution in under 20ms', async () => {
      // Performance test with complex clothing setup
      const startTime = performance.now();

      // Simulate complex entity with many clothing items
      mockEntitiesGateway.getComponentData.mockReturnValue({
        equipped: {
          torso_upper: { outer: 'coat', base: 'shirt' },
          torso_lower: { base: 'pants', underwear: 'underwear' },
          legs: { base: 'jeans' },
          feet: { base: 'shoes', accessories: 'socks' },
        },
      });

      for (let i = 0; i < 100; i++) {
        resolver.resolve(node, context, {});
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / 100;

      expect(avgTime).toBeLessThan(20);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing equipment component gracefully', () => {
      mockEntitiesGateway.getComponentData.mockReturnValue(null);

      const result = resolver.resolve(node, context, trace);

      expect(result).toBeNull();
      expect(trace.coverageResolution.totalCandidates).toBe(0);
    });

    it('should handle items with invalid coverage mapping data', () => {
      mockEntitiesGateway.getComponentData
        .mockReturnValueOnce({
          equipped: { legs: { base: 'invalid_item' } },
        })
        .mockReturnValueOnce({
          covers: [], // Invalid: empty covers array
          coveragePriority: 'base',
        });

      const result = resolver.resolve(node, context, trace);

      expect(result).toBeNull(); // Should handle gracefully
    });
  });
});
```

#### Integration Tests

**File**: `tests/integration/scopeDsl/clothingCoverageResolution.test.js`

```javascript
describe('Clothing Coverage Resolution Integration', () => {
  let testBed;

  beforeEach(async () => {
    testBed = createTestBed();
    await testBed.loadMods(['core', 'clothing', 'intimacy']);
  });

  it('should resolve fondle_ass action with logical clothing priority', async () => {
    // Create character with jeans + panties configuration
    const character = await testBed.createCharacter({
      equipment: {
        legs: { base: 'clothing:dark_indigo_denim_jeans' },
        torso_lower: { underwear: 'clothing:white_cotton_panties' },
      },
    });

    // Resolve the scope used by fondle_ass action
    const scopeResult = await testBed.resolveScope(
      'clothing:target_topmost_torso_lower_clothing_no_accessories',
      { target: character.id }
    );

    expect(scopeResult).toBe('clothing:dark_indigo_denim_jeans');

    // Test full action resolution
    const actionResult = await testBed.resolveAction('intimacy:fondle_ass', {
      primary: testBed.player.id,
      target: character.id,
    });

    expect(actionResult.text).toContain('over the jeans');
    expect(actionResult.text).not.toContain('over the panties');
  });

  it('should handle complex layering scenarios', async () => {
    // Character with coat + jacket + shirt + underwear
    const character = await testBed.createCharacter({
      equipment: {
        torso_upper: {
          outer: 'clothing:dark_olive_cotton_twill_chore_jacket',
          base: 'clothing:forest_green_cotton_linen_button_down',
          underwear: 'clothing:white_cotton_undershirt',
        },
      },
    });

    const scopeResult = await testBed.resolveScope(
      'clothing:target_topmost_torso_upper_clothing',
      { target: character.id }
    );

    expect(scopeResult).toBe('clothing:dark_olive_cotton_twill_chore_jacket');
  });

  it('should maintain performance under load', async () => {
    const characters = [];
    for (let i = 0; i < 50; i++) {
      characters.push(
        await testBed.createCharacter({
          equipment: {
            legs: { base: 'clothing:dark_indigo_denim_jeans' },
            torso_lower: { underwear: 'clothing:white_cotton_panties' },
            torso_upper: {
              outer: 'clothing:dark_olive_cotton_twill_chore_jacket',
            },
          },
        })
      );
    }

    const startTime = performance.now();

    // Resolve scope for all characters
    const promises = characters.map((char) =>
      testBed.resolveScope(
        'clothing:target_topmost_torso_lower_clothing_no_accessories',
        { target: char.id }
      )
    );

    await Promise.all(promises);

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    expect(totalTime).toBeLessThan(1000); // Should complete in under 1 second
  });
});
```

#### Acceptance Criteria

- [ ] All unit tests pass with >95% code coverage
- [ ] Integration tests verify real-world scenarios
- [ ] Performance tests confirm <50% resolution time increase
- [ ] All existing clothing-related tests continue to pass

### 3.4 Phase 4: Documentation & Polish

**Duration**: 0.5 weeks

#### Tasks

1. **Update Component Documentation**
   - Document coverage mapping component usage
   - Add examples for common clothing items
   - Update mod development guidelines

2. **Performance Optimization**
   - Implement coverage mapping caching
   - Add lazy evaluation for complex scenarios
   - Optimize priority calculation

3. **Final Testing**
   - End-to-end testing with all intimate actions
   - Performance benchmarking
   - Regression testing

#### Acceptance Criteria

- [ ] Documentation is comprehensive and accurate
- [ ] Performance meets optimization targets
- [ ] All edge cases are handled properly
- [ ] System is ready for production deployment

## 4. Expected Behavior Examples

### 4.1 Scenario Testing Matrix

| Clothing Configuration  | Current Behavior      | Expected Behavior         | Priority Logic                        |
| ----------------------- | --------------------- | ------------------------- | ------------------------------------- |
| Jeans + Panties         | "over the panties" ❌ | "over the jeans" ✅       | Base coverage > Direct underwear      |
| Coat + Jeans + Panties  | "over the panties" ❌ | "over the coat" ✅        | Outer coverage > Base coverage        |
| Only Panties            | "over the panties" ✅ | "over the panties" ✅     | Direct equipment fallback             |
| Belt Only (accessories) | "over the belt"       | Action unavailable        | No_accessories mode exclusion         |
| Thigh-highs + Panties   | "over the panties" ❌ | "over the thigh-highs" ✅ | Underwear coverage > Direct underwear |

### 4.2 Action Template Results

**Enhanced System Results:**

- Pants scenario: `"fondle {primary}'s ass over the jeans"`
- Coat scenario: `"fondle {primary}'s ass over the long coat"`
- Panties only: `"fondle {primary}'s ass over the panties"`
- Complex layering: `"fondle {primary}'s ass over the winter coat"`

## 5. Performance Considerations

### 5.1 Optimization Strategies

1. **Component Caching**

   ```javascript
   // Cache coverage mappings during entity loading
   const coverageCache = new Map();

   function getCachedCoverageMapping(itemId) {
     if (!coverageCache.has(itemId)) {
       const mapping = entitiesGateway.getComponentData(
         itemId,
         'clothing:coverage_mapping'
       );
       coverageCache.set(itemId, mapping);
     }
     return coverageCache.get(itemId);
   }
   ```

2. **Priority Pre-calculation**

   ```javascript
   // Pre-calculate priority scores to avoid repeated calculations
   function createCoverageCandidate(itemId, layer, coveragePriority, source) {
     return {
       itemId,
       layer,
       coveragePriority,
       source,
       priority:
         PRIORITY_CACHE.get(`${coveragePriority}:${layer}`) ||
         calculateCoveragePriority(coveragePriority, layer),
     };
   }
   ```

3. **Lazy Evaluation**
   ```javascript
   // Only process coverage when covering items exist
   function shouldUseCoverageResolution(entityId, targetSlot) {
     return hasCoveringItems(entityId, targetSlot);
   }
   ```

### 5.2 Performance Targets

- **Current Resolution Time**: ~10ms for simple clothing queries
- **Target Enhanced Time**: <15ms (50% increase acceptable)
- **Complex Scenario Target**: <25ms for 10+ clothing items
- **Cache Hit Rate**: >80% for repeated queries

## 6. Risk Assessment & Mitigation

### 6.1 Implementation Risks

| Risk                                             | Probability | Impact | Mitigation                                             |
| ------------------------------------------------ | ----------- | ------ | ------------------------------------------------------ |
| Performance degradation beyond acceptable limits | Medium      | Medium | Implement caching, profiling, and lazy evaluation      |
| Complex edge cases causing incorrect resolution  | Medium      | High   | Comprehensive test scenarios and trace logging         |
| Breaking changes to existing clothing system     | Low         | High   | Rigorous regression testing and backward compatibility |
| Memory usage increase from caching               | Low         | Low    | LRU cache with size limits and periodic cleanup        |

### 6.2 Rollback Strategy

1. **Immediate Rollback**: Feature flag to disable coverage-aware resolution
2. **Gradual Rollback**: Fallback to legacy resolution for specific slots
3. **Full Rollback**: Revert SlotAccessResolver changes, remove coverage components

## 7. Success Criteria

### 7.1 Functional Success

- ✅ Intimate actions show logical clothing priority ("over the jeans" not "over the panties")
- ✅ Complex clothing combinations resolve intuitively
- ✅ All existing clothing functionality remains unchanged
- ✅ Action availability correctly reflects coverage scenarios

### 7.2 Technical Success

- ✅ SlotAccessResolver enhancement integrates seamlessly
- ✅ Coverage mapping component validates and loads correctly
- ✅ Performance impact remains within acceptable limits (<50% increase)
- ✅ Comprehensive test coverage (>95%) with all scenarios

### 7.3 Quality Metrics

- ✅ Zero regression in existing clothing tests
- ✅ All new unit and integration tests pass
- ✅ Code follows project conventions and patterns
- ✅ Documentation is complete and accurate

## 8. Future Enhancements

### 8.1 Extended Coverage Scenarios

1. **Partial Coverage**: Items covering only portions of body regions
2. **Position-Dependent Coverage**: Coverage changes based on character position
3. **Dynamic Coverage**: Coverage affected by clothing condition/damage
4. **Seasonal Variations**: Weather-appropriate coverage priorities

### 8.2 Advanced Features

1. **Coverage Percentage System**: Numerical coverage values (0-100%)
2. **Multi-Region Coverage**: Single items covering multiple regions with different priorities
3. **Coverage Conflicts**: Resolution of conflicting coverage claims
4. **Smart Layering**: Automatic layer adjustment based on coverage

## 9. Implementation Checklist

### Phase 1: Foundation

- [ ] Create `clothing:coverage_mapping` component schema
- [ ] Add coverage data to key clothing items (jeans, pants, coats, etc.)
- [ ] Validate component integration with loading system
- [ ] Run basic component tests

### Phase 2: Core Logic

- [ ] Implement `resolveCoverageAwareSlot` function
- [ ] Add priority calculation system
- [ ] Integrate with existing SlotAccessResolver
- [ ] Add comprehensive tracing support
- [ ] Implement performance optimizations

### Phase 3: Testing

- [ ] Create unit test suite with >95% coverage
- [ ] Implement integration tests for real scenarios
- [ ] Run performance benchmarks
- [ ] Execute regression test suite

### Phase 4: Final Validation

- [ ] End-to-end testing with intimate actions
- [ ] Documentation review and updates
- [ ] Final performance optimization
- [ ] Production readiness review

## 10. Code Examples

### 10.1 Component Usage Example

```json
// Long Winter Coat Entity
{
  "id": "clothing:long_winter_coat",
  "components": {
    "core:name": { "text": "Long Winter Coat" },
    "core:description": {
      "text": "A heavy winter coat that covers most of the body"
    },
    "clothing:wearable": {
      "layer": "outer",
      "equipmentSlots": {
        "primary": "torso_upper"
      },
      "allowedLayers": ["outer"]
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_upper", "torso_lower", "legs"],
      "coveragePriority": "outer"
    }
  }
}
```

### 10.2 Resolution Trace Example

```javascript
// Example trace output for debugging
{
  coverageResolution: {
    targetSlot: 'torso_lower',
    totalCandidates: 3,
    filteredCandidates: 2,
    selectedItem: 'clothing:dark_indigo_denim_jeans',
    candidates: [
      {
        itemId: 'clothing:dark_indigo_denim_jeans',
        priority: 220, // base coverage (200) + base layer (20)
        source: 'coverage',
        coveragePriority: 'base',
        layer: 'base'
      },
      {
        itemId: 'clothing:white_cotton_panties',
        priority: 430, // direct (400) + underwear layer (30)
        source: 'direct',
        coveragePriority: 'direct',
        layer: 'underwear'
      }
    ]
  }
}
```

---

**Specification Status**: Complete Implementation Plan  
**Author**: Claude Code SuperClaude Framework  
**Date**: 2025-08-28  
**Next Steps**: Begin Phase 1 implementation with component schema creation
