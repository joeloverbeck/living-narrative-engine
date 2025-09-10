# CLOREMLOG-001: Implement Coverage Blocking Analysis Foundation

## Overview
**Priority**: High  
**Phase**: 1 (Emergency Fix)  
**Estimated Effort**: 8-12 hours  
**Dependencies**: None  
**Blocks**: CLOREMLOG-002, CLOREMLOG-003

## Problem Statement

The clothing removal system incorrectly allows access to underwear layers when base layers are equipped and covering the same body areas. This occurs because the current `ArrayIterationResolver` doesn't consult the coverage mapping component when determining clothing accessibility.

**Specific Issue**: Character Layla Agirre shows both "Remove trousers" and "Remove boxer brief" actions simultaneously, when the boxer brief should be inaccessible due to being covered by the trousers.

## Root Cause

- Coverage logic stored in `clothing:coverage_mapping` component is not integrated with accessibility logic in `ArrayIterationResolver.getAllClothingItems()`
- Two disconnected priority systems exist without coordination
- Missing business rule validation for coverage blocking

## Acceptance Criteria

### 1. Create Coverage Analyzer Module
- [ ] Create new file: `src/scopeDsl/clothingSystem/coverageAnalyzer.js`
- [ ] Implement `analyzeCoverageBlocking(equipped, entityId)` function
- [ ] Function must return accessibility map for all equipped items
- [ ] Integration with existing coverage mapping component
- [ ] Support for all coverage priority levels: outer (100), base (200), underwear (300), direct (400)

### 2. Coverage Analysis Logic Requirements
- [ ] **Input validation**: Verify equipped object structure and entityId
- [ ] **Coverage mapping lookup**: Query coverage mapping component for each item
- [ ] **Blocking calculation**: Determine which items block access to others based on:
  - Body area overlap (e.g., both items cover "torso_lower")
  - Coverage priority (higher priority blocks lower priority)
  - Layer relationships (base layer blocks underwear layer)
- [ ] **Accessibility map**: Return object with `isAccessible(itemId, slotName, layer)` method

### 3. Integration Points
- [ ] Import and use existing `COVERAGE_PRIORITY` constants from `src/scopeDsl/prioritySystem/priorityConstants.js`
- [ ] Query coverage mapping component for item coverage data
- [ ] Handle edge cases: items without coverage data, malformed equipment objects

### 4. Error Handling
- [ ] Graceful degradation when coverage mapping is unavailable
- [ ] Logging for debugging coverage calculation issues
- [ ] Fallback to current behavior if coverage analysis fails

## Implementation Details

### File Structure
```
src/scopeDsl/clothingSystem/
├── coverageAnalyzer.js (NEW)
└── index.js (NEW - barrel export)
```

### Key Functions to Implement

#### `analyzeCoverageBlocking(equipped, entityId)`
```javascript
/**
 * Analyzes which clothing items block access to others based on coverage rules
 * @param {Object} equipped - Equipment state from entity
 * @param {string} entityId - Entity ID for coverage mapping lookup
 * @returns {Object} Accessibility analyzer with isAccessible method
 */
export function analyzeCoverageBlocking(equipped, entityId) {
  // Implementation details in ticket
}
```

#### `isAccessible(itemId, slotName, layer)`
```javascript
/**
 * Determines if a clothing item is accessible given current equipment state
 * @param {string} itemId - ID of clothing item to check
 * @param {string} slotName - Equipment slot name
 * @param {string} layer - Layer type (outer, base, underwear, direct)
 * @returns {boolean} True if item is accessible, false if blocked
 */
```

### Coverage Blocking Rules
1. **Same Area Rule**: Items covering the same body area can block each other
2. **Priority Rule**: Higher priority (lower number) blocks lower priority
3. **Layer Rule**: outer > base > underwear > direct in blocking hierarchy
4. **Exception Rule**: direct skin contact items are never blocking others

## Testing Requirements

### Unit Tests Required
- [ ] `tests/unit/scopeDsl/clothingSystem/coverageAnalyzer.test.js`
- [ ] Test coverage blocking calculation with various equipment combinations
- [ ] Test edge cases: empty equipment, missing coverage data, invalid inputs
- [ ] Test performance with large equipment sets

### Test Scenarios
```javascript
describe('Coverage Blocking Analysis', () => {
  it('should block underwear when base layer covers same area', () => {
    // Layla Agirre scenario: trousers blocking boxer brief
  });
  
  it('should allow access to outer layer items', () => {
    // Outer items should never be blocked
  });
  
  it('should handle multiple layers in same slot', () => {
    // Complex layering scenarios
  });
});
```

## Risk Assessment

### Implementation Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|-------------|
| Performance impact from coverage calculations | Medium | Low | Implement caching and optimize algorithms |
| Integration issues with coverage mapping | Low | Medium | Thorough testing with existing components |
| Breaking changes to existing behavior | Low | High | Feature flag for gradual rollout |

### Rollback Plan
- Keep existing `getAllClothingItems()` functionality intact
- Use feature flag to enable/disable coverage blocking
- Comprehensive logging for debugging issues

## Definition of Done
- [ ] All unit tests passing with >90% coverage
- [ ] Performance benchmarks show <10ms overhead for typical equipment sets
- [ ] Integration tests verify coverage mapping component interaction
- [ ] Code review completed and approved
- [ ] Documentation updated with new API

## Dependencies and Integration

### Upstream Dependencies
- `src/scopeDsl/prioritySystem/priorityConstants.js` (COVERAGE_PRIORITY)
- Coverage mapping component system
- Entity management system for equipment data

### Downstream Impact
- Will be consumed by CLOREMLOG-002 for integration into ArrayIterationResolver
- Foundation for CLOREMLOG-005 unified clothing service

## Notes
- This ticket focuses only on the analysis foundation
- No changes to existing ArrayIterationResolver in this ticket
- Emphasis on creating robust, testable coverage blocking logic
- Must maintain backward compatibility during implementation