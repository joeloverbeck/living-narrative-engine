# CLOREMLOG-003: Create Integration Tests for Coverage Blocking Scenarios

## Overview
**Priority**: High  
**Phase**: 1 (Emergency Fix)  
**Estimated Effort**: 4-6 hours  
**Dependencies**: CLOREMLOG-001, CLOREMLOG-002  
**Blocks**: CLOREMLOG-004

## Problem Statement

The current test suite lacks comprehensive integration tests for coverage blocking scenarios. While unit tests exist for individual components, there are no tests that verify the complete flow from action discovery through scope resolution to coverage-aware clothing accessibility.

**Gap**: Integration tests must verify that the entire clothing removal system correctly respects coverage blocking rules when determining available actions.

## Root Cause

- Missing integration tests for coverage mapping interaction with scope resolution
- No tests for the specific Layla Agirre scenario that exposed the bug
- Insufficient test coverage for complex layering scenarios
- No performance testing for coverage blocking impact

## Acceptance Criteria

### 1. Core Integration Test Suite
- [ ] **File**: `tests/integration/scopes/clothingCoverageBlocking.integration.test.js`
- [ ] **Test scope resolution**: Verify `clothing:topmost_clothing` scope respects coverage blocking
- [ ] **Test action discovery**: Verify `remove_clothing` action only shows accessible items
- [ ] **Test various scenarios**: Multiple clothing combinations and edge cases
- [ ] **Test performance**: Ensure coverage blocking doesn't significantly impact performance

### 2. Layla Agirre Regression Test
- [ ] **Specific test case**: Reproduce exact issue from the report
- [ ] **Equipment setup**: Trousers (base layer) + boxer brief (underwear layer) on torso_lower
- [ ] **Expected result**: Only trousers should be accessible for removal
- [ ] **Verification**: Assert boxer brief is not in topmost clothing scope results

### 3. Comprehensive Coverage Scenarios
- [ ] **Single layer tests**: Verify outer, base, underwear, and direct layers work correctly
- [ ] **Multi-layer tests**: Complex combinations with multiple layers per slot
- [ ] **Cross-slot tests**: Items in different body areas should not block each other
- [ ] **Priority hierarchy tests**: Verify correct priority-based blocking behavior

### 4. Error Handling and Edge Cases
- [ ] **Missing coverage data**: Items without coverage mapping information
- [ ] **Malformed equipment**: Invalid equipment state handling
- [ ] **Empty equipment**: No clothing equipped scenarios
- [ ] **Coverage analysis failure**: Graceful degradation when coverage system fails

## Implementation Details

### Test File Structure
```
tests/integration/scopes/
├── clothingCoverageBlocking.integration.test.js (NEW)
└── laylaAgirreRegressionTest.integration.test.js (NEW)
```

### Core Integration Test Implementation

#### Main Test Suite Structure
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Clothing Coverage Blocking - Integration Tests', () => {
  let testBed;
  let scopeEngine;
  let entityManager;

  beforeEach(() => {
    testBed = createTestBed();
    scopeEngine = testBed.getScopeEngine();
    entityManager = testBed.getEntityManager();
  });

  describe('Topmost Clothing Scope with Coverage Blocking', () => {
    it('should block underwear when base layer covers same area', () => {
      // Layla Agirre scenario test
    });

    it('should allow access to highest priority layer only', () => {
      // Multi-layer priority testing
    });

    it('should not block items in different body areas', () => {
      // Cross-area independence testing
    });
  });

  describe('Remove Clothing Action Integration', () => {
    it('should only show accessible clothing in action targets', () => {
      // Action discovery integration
    });

    it('should update available actions when equipment changes', () => {
      // Dynamic action availability
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should maintain performance with large wardrobes', () => {
      // Performance regression testing
    });

    it('should handle missing coverage data gracefully', () => {
      // Error handling integration
    });
  });
});
```

### Layla Agirre Regression Test

#### Specific Test Case
```javascript
describe('Layla Agirre Regression Test', () => {
  it('should only show trousers as removable when boxer brief is covered', () => {
    // Create test entity with exact Layla Agirre equipment configuration
    const entityId = 'test:layla_agirre';
    const equipment = {
      torso_lower: {
        base: 'clothing:dark_olive_high_rise_double_pleat_trousers',
        underwear: 'clothing:power_mesh_boxer_brief'
      }
    };

    // Set up entity with equipment
    entityManager.createEntity(entityId);
    entityManager.setComponent(entityId, 'core:equipment', { equipped: equipment });

    // Query topmost clothing scope
    const scope = 'clothing:topmost_clothing';
    const result = scopeEngine.resolve(scope, { entityId });

    // Verify only trousers are accessible
    expect(result).toHaveLength(1);
    expect(result[0].itemId).toBe('clothing:dark_olive_high_rise_double_pleat_trousers');
    expect(result.find(item => item.itemId === 'clothing:power_mesh_boxer_brief')).toBeUndefined();
  });
});
```

### Test Scenarios Matrix

#### Coverage Blocking Test Matrix
| Body Area | Outer | Base | Underwear | Expected Accessible |
|-----------|-------|------|-----------|-------------------|
| torso_lower | - | trousers | boxer_brief | trousers only |
| torso_lower | jacket | shirt | undershirt | jacket only |
| torso_upper | coat | sweater | bra | coat only |
| legs | - | pants | underwear | pants only |

#### Cross-Area Independence Matrix
| Setup | Expected Result |
|-------|----------------|
| Hat + Trousers | Both accessible (different areas) |
| Gloves + Shoes | Both accessible (different areas) |
| Shirt + Pants | Both accessible (different areas) |

### Performance Testing Requirements

#### Performance Benchmarks
```javascript
describe('Coverage Blocking Performance', () => {
  it('should resolve clothing scope within performance budget', () => {
    // Large wardrobe: 20+ items across 8+ slots
    const largeWardrobe = createLargeWardrobeSetup();
    
    const startTime = performance.now();
    const result = scopeEngine.resolve('clothing:topmost_clothing', { 
      entityId: 'test:performance_entity' 
    });
    const endTime = performance.now();

    // Should complete within 10ms
    expect(endTime - startTime).toBeLessThan(10);
    expect(result).toBeDefined();
  });

  it('should not cause memory leaks with repeated queries', () => {
    // Memory leak detection test
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Perform 1000 scope resolutions
    for (let i = 0; i < 1000; i++) {
      scopeEngine.resolve('clothing:topmost_clothing', { 
        entityId: 'test:memory_test' 
      });
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = finalMemory - initialMemory;

    // Memory growth should be minimal (< 1MB)
    expect(memoryGrowth).toBeLessThan(1024 * 1024);
  });
});
```

## Testing Requirements

### Integration Test Coverage
- [ ] **Scope resolution**: Complete flow from scope query to coverage-blocked results
- [ ] **Action discovery**: Integration with action system for clothing removal
- [ ] **Entity management**: Equipment state changes and scope result updates
- [ ] **Error boundaries**: Coverage system failures and recovery

### Test Data Requirements
- [ ] **Multiple characters**: Various equipment configurations beyond Layla Agirre
- [ ] **Clothing items**: Items with different coverage priorities and body areas
- [ ] **Edge case equipment**: Unusual combinations and configurations
- [ ] **Performance data**: Large wardrobes for performance testing

### Mock and Fixture Setup
```javascript
// Test fixtures for consistent testing
const TEST_EQUIPMENT_CONFIGS = {
  laylaAgirre: {
    torso_lower: {
      base: 'clothing:dark_olive_high_rise_double_pleat_trousers',
      underwear: 'clothing:power_mesh_boxer_brief'
    }
  },
  
  multiLayer: {
    torso_upper: {
      outer: 'clothing:winter_coat',
      base: 'clothing:cotton_shirt', 
      underwear: 'clothing:undershirt'
    }
  },

  crossArea: {
    head: { base: 'clothing:baseball_cap' },
    torso_lower: { base: 'clothing:jeans' },
    feet: { base: 'clothing:sneakers' }
  }
};
```

## Risk Assessment

### Testing Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|-------------|
| Flaky tests due to async scope resolution | Medium | Medium | Proper test setup and cleanup |
| Performance tests failing on slower systems | Low | Low | Reasonable performance thresholds |
| Test data setup complexity | Medium | Low | Comprehensive test fixtures |

### Test Reliability
- [ ] **Deterministic setup**: Ensure tests are repeatable and reliable
- [ ] **Proper cleanup**: Clean entity state between tests
- [ ] **Error isolation**: Tests should not affect each other
- [ ] **Clear assertions**: Test failures should provide clear debugging information

## Definition of Done
- [ ] All integration tests pass consistently
- [ ] Layla Agirre regression test specifically validates the fix
- [ ] Performance tests establish baseline and detect regressions
- [ ] Error handling tests verify graceful degradation
- [ ] Test coverage includes all major clothing scenarios
- [ ] Tests run in CI/CD pipeline without flakiness

## Dependencies and Integration

### Upstream Dependencies
- **CLOREMLOG-001**: Coverage blocking analysis implementation
- **CLOREMLOG-002**: Array iteration resolver integration
- **Test infrastructure**: Entity management, scope engine, test bed utilities

### Downstream Impact
- **CLOREMLOG-004**: Provides verification mechanism for fix validation
- **Future development**: Establishes testing patterns for clothing system enhancements
- **Regression prevention**: Catches future coverage blocking issues

## Notes
- Tests should be comprehensive but maintainable
- Focus on realistic game scenarios, not just edge cases
- Performance tests should establish baselines for future optimization
- Integration tests complement but don't replace unit tests
- Test data should reflect actual game content where possible