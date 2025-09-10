# CLOREMLOG-002: Integrate Coverage Blocking into Array Iteration Resolver

## Overview
**Priority**: High  
**Phase**: 1 (Emergency Fix)  
**Estimated Effort**: 6-10 hours  
**Dependencies**: CLOREMLOG-001 (Coverage Blocking Analysis)  
**Blocks**: CLOREMLOG-003, CLOREMLOG-004

## Problem Statement

The `ArrayIterationResolver.getAllClothingItems()` function currently returns all clothing items across all layers without checking if higher-priority items block access to lower-priority ones. This results in underwear being shown as removable even when covered by base layer clothing.

**Current Behavior**: Returns both trousers and boxer brief as "topmost" items  
**Expected Behavior**: Return only the trousers, blocking access to the covered boxer brief

## Root Cause

The `getAllClothingItems()` function in `src/scopeDsl/nodes/arrayIterationResolver.js:60-103` implements layer priority checking but ignores coverage blocking rules. The function iterates through all layers and adds items without consulting the coverage mapping system.

## Acceptance Criteria

### 1. Modify getAllClothingItems Function
- [ ] **Location**: `src/scopeDsl/nodes/arrayIterationResolver.js:60-103`
- [ ] **Import coverage analyzer**: Import `analyzeCoverageBlocking` from CLOREMLOG-001
- [ ] **Add coverage check**: Integrate coverage blocking validation into existing loop
- [ ] **Preserve existing logic**: Maintain all current functionality for non-blocked items
- [ ] **Performance optimization**: Ensure coverage analysis is performed only once per call

### 2. Integration Requirements
- [ ] **Coverage analysis call**: Add `analyzeCoverageBlocking(equipped, entityId)` at function start
- [ ] **Accessibility checking**: Use `isAccessible(itemId, slotName, layer)` before adding candidates
- [ ] **Error handling**: Graceful fallback if coverage analysis fails
- [ ] **Logging**: Add debug logging for coverage decisions

### 3. Specific Code Changes

#### Modified Function Signature
```javascript
// Current
function getAllClothingItems(clothingAccess, trace) 

// Modified (no signature change, internal implementation only)
function getAllClothingItems(clothingAccess, trace) {
  const { equipped, mode, entityId } = clothingAccess;
  const candidates = [];
  const layers = LAYER_PRIORITY[mode] || LAYER_PRIORITY.topmost;

  // NEW: Coverage analysis
  const coverageAnalysis = analyzeCoverageBlocking(equipped, entityId);

  // MODIFIED: Existing loop with coverage checks
  for (const [slotName, slotData] of Object.entries(equipped)) {
    // ... existing validation ...
    
    for (const layer of layers) {
      if (slotData[layer]) {
        const itemId = slotData[layer];
        
        // NEW: Coverage blocking check
        if (!coverageAnalysis.isAccessible(itemId, slotName, layer)) {
          trace?.addStep(`Skipping ${itemId}: blocked by coverage`);
          continue;
        }

        // EXISTING: Add to candidates
        candidates.push({
          itemId: itemId,
          layer: layer,
          slotName: slotName,
          // ... existing properties ...
        });

        // EXISTING: topmost mode break logic
        if (mode === 'topmost') {
          break;
        }
      }
    }
  }

  // EXISTING: Continue with priority calculation
  return prioritizeClothingCandidates(candidates, trace);
}
```

### 4. Backward Compatibility
- [ ] **No API changes**: Function signature and return format unchanged
- [ ] **Graceful degradation**: If coverage analysis fails, fall back to current behavior
- [ ] **Feature flag support**: Prepare for optional enabling/disabling of coverage blocking
- [ ] **Existing tests**: All current tests must continue to pass

## Implementation Details

### Key Changes Required

#### Import Addition
```javascript
// At top of file
import { analyzeCoverageBlocking } from '../clothingSystem/coverageAnalyzer.js';
```

#### Main Integration Point
```javascript
// Line ~65 in getAllClothingItems function
const coverageAnalysis = analyzeCoverageBlocking(equipped, entityId);

// In item processing loop (~line 75)
if (!coverageAnalysis.isAccessible(itemId, slotName, layer)) {
  trace?.addStep(`Coverage blocking: ${itemId} blocked in ${slotName}/${layer}`);
  continue;
}
```

#### Error Handling
```javascript
// Wrapper for coverage analysis with fallback
let coverageAnalysis;
try {
  coverageAnalysis = analyzeCoverageBlocking(equipped, entityId);
} catch (error) {
  trace?.addStep(`Coverage analysis failed: ${error.message}, falling back to layer-only logic`);
  coverageAnalysis = { 
    isAccessible: () => true // Fallback: allow all items
  };
}
```

### Testing Integration

#### Modified Test Cases
- [ ] Update existing tests in `tests/unit/scopeDsl/nodes/arrayIteration.test.js`
- [ ] Add coverage blocking scenarios to existing test suites
- [ ] Ensure backward compatibility with all current test cases

#### New Test Scenarios
```javascript
describe('Coverage Blocking Integration', () => {
  it('should respect coverage blocking in topmost mode', () => {
    // Layla Agirre scenario with trousers blocking boxer brief
  });
  
  it('should fall back gracefully when coverage analysis fails', () => {
    // Error handling test
  });
  
  it('should maintain performance with coverage checking enabled', () => {
    // Performance regression test
  });
});
```

## Risk Assessment

### Implementation Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|-------------|
| Breaking existing clothing logic | Medium | High | Comprehensive regression testing |
| Performance degradation | Low | Medium | Performance benchmarking |
| Integration issues with coverage analyzer | Medium | Medium | Thorough unit testing |

### Specific Risk Mitigation

#### Regression Prevention
- [ ] Run all existing clothing-related tests before and after changes
- [ ] Test with various character equipment configurations
- [ ] Verify action discovery continues to work correctly

#### Performance Monitoring
- [ ] Benchmark `getAllClothingItems()` before and after changes
- [ ] Ensure <10% performance overhead
- [ ] Add performance tests for large equipment sets

## Testing Requirements

### Unit Tests Required
- [ ] **File**: `tests/unit/scopeDsl/nodes/arrayIteration.test.js`
- [ ] **New tests**: Coverage blocking scenarios
- [ ] **Modified tests**: Update existing tests to work with coverage blocking
- [ ] **Error handling**: Test fallback behavior when coverage analysis fails

### Integration Tests Required
- [ ] **File**: `tests/integration/scopes/clothingTopMostTorsoLowerNoAccessories.integration.test.js`
- [ ] **Layla Agirre scenario**: Specific test for the reported issue
- [ ] **Multi-layer scenarios**: Complex equipment configurations
- [ ] **Cross-body-area tests**: Items covering different areas should not block each other

### Performance Tests Required
- [ ] **Benchmark suite**: Compare performance before/after integration
- [ ] **Large equipment tests**: 20+ clothing items across multiple slots
- [ ] **Memory usage**: Ensure no memory leaks from coverage analysis

## Definition of Done
- [ ] All existing tests continue to pass
- [ ] New coverage blocking tests pass
- [ ] Layla Agirre scenario correctly shows only trousers as removable
- [ ] Performance impact <10% overhead
- [ ] Code review completed and approved
- [ ] Integration with coverage analyzer working correctly

## Dependencies and Integration

### Upstream Dependencies
- **CLOREMLOG-001**: Requires `analyzeCoverageBlocking` function and coverage analyzer module
- **Existing systems**: Coverage mapping component, priority constants

### Downstream Impact
- **Action discovery**: Changes will affect which clothing removal actions are available
- **Scope resolution**: All `topmost_clothing` scope queries will respect coverage blocking
- **Future tickets**: Foundation for CLOREMLOG-003 testing and CLOREMLOG-004 validation

## Rollback Plan
- [ ] **Feature flag**: Implement toggle to disable coverage blocking
- [ ] **Backup logic**: Keep original `getAllClothingItems()` implementation available
- [ ] **Monitoring**: Add logging to detect issues in production
- [ ] **Quick revert**: Single-line change to disable coverage checking if needed

## Notes
- This ticket focuses on integration only, no new coverage logic
- Must maintain exact same API and behavior for non-blocked items
- Critical to test with actual game content and various equipment configurations
- Performance is important as this function is called frequently during action discovery