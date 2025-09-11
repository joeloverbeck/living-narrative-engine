# CLOREMLOG-005: Create Unified Clothing Accessibility Service

## Overview
**Priority**: Medium  
**Phase**: 2 (Architectural Improvement)  
**Estimated Effort**: 12-16 hours  
**Dependencies**: CLOREMLOG-004 (Phase 1 complete)  
**Blocks**: CLOREMLOG-006, CLOREMLOG-007

## Problem Statement

The current clothing accessibility logic is scattered across multiple files and systems, making it difficult to maintain, test, and extend. Coverage blocking logic added in Phase 1 is embedded in `ArrayIterationResolver`, violating separation of concerns and making the system harder to reason about.

**Current Architecture Issues**:
- Coverage logic in `coverage_mapping` component (data layer)
- Accessibility logic in `ArrayIterationResolver` (scope layer)
- Priority logic in `priorityConstants` (constants layer)
- No centralized service for clothing-related queries

**Target Architecture**: Unified service that centralizes all clothing accessibility logic with clear separation of concerns and extensible design.

## Root Cause

**Architectural Debt**: The clothing system evolved organically without a central service, leading to:
- Low cohesion: Related logic spread across multiple components
- Tight coupling: ArrayIterationResolver knows too much about clothing specifics
- Duplication: Priority logic exists in multiple places
- Hard to extend: Adding new clothing rules requires changes in multiple files

## Acceptance Criteria

### 1. Create Clothing Accessibility Service
- [ ] **File**: `src/clothing/services/clothingAccessibilityService.js`
- [ ] **Centralized API**: Single service for all clothing accessibility queries
- [ ] **Dependency injection**: Service should be injectable and testable
- [ ] **Clear interfaces**: Well-defined methods for different types of queries
- [ ] **Performance optimized**: Caching and efficient algorithms for repeated queries

### 2. Service API Design
- [ ] **Core methods**: `getAccessibleItems()`, `isItemAccessible()`, `getBlockingItem()`
- [ ] **Query types**: Support topmost, all, by-layer, by-priority queries
- [ ] **Context aware**: Handle different contexts (removal, equipping, inspection)
- [ ] **Error handling**: Graceful degradation and clear error messages

### 3. Integration Architecture
- [ ] **Coverage mapping**: Integrate with existing coverage mapping component
- [ ] **Priority system**: Unified priority calculation and caching
- [ ] **Equipment state**: Clean interface to equipment component
- [ ] **Dependency injection**: Register as singleton service in DI container

### 4. Testing and Documentation
- [ ] **Comprehensive tests**: Unit tests with >95% coverage
- [ ] **Performance tests**: Benchmarks for large wardrobes
- [ ] **API documentation**: Clear JSDoc with examples
- [ ] **Migration guide**: How to migrate from old approach

## Implementation Details

### Service Architecture

#### Core Service Structure
```javascript
/**
 * @file Unified clothing accessibility service
 * Centralizes all clothing accessibility logic including coverage blocking,
 * priority calculation, and business rule validation.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

export class ClothingAccessibilityService {
  #logger;
  #entityManager;
  #coverageAnalyzer;
  #priorityCalculator;
  #cache;

  constructor({ logger, entityManager, coverageAnalyzer, priorityCalculator }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error']
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getComponent']
    });
    
    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#coverageAnalyzer = coverageAnalyzer;
    this.#priorityCalculator = priorityCalculator;
    this.#cache = new Map();
  }

  /**
   * Get all accessible clothing items for an entity based on query type
   * @param {string} entityId - Entity to query
   * @param {Object} options - Query options
   * @returns {Array} Accessible clothing items with metadata
   */
  getAccessibleItems(entityId, options = {}) {
    const {
      mode = 'topmost',
      bodyArea = null,
      layer = null,
      context = 'removal'
    } = options;

    // Implementation details...
  }

  /**
   * Check if a specific item is accessible
   * @param {string} entityId - Entity to check
   * @param {string} itemId - Item to check accessibility
   * @returns {Object} Accessibility result with reason
   */
  isItemAccessible(entityId, itemId) {
    // Implementation details...
  }

  /**
   * Get the item blocking access to a specific item
   * @param {string} entityId - Entity to check
   * @param {string} itemId - Item to check
   * @returns {string|null} ID of blocking item or null
   */
  getBlockingItem(entityId, itemId) {
    // Implementation details...
  }

  /**
   * Clear accessibility cache for entity
   * @param {string} entityId - Entity to clear cache for
   */
  clearCache(entityId) {
    // Implementation details...
  }
}
```

#### Dependency Registration
```javascript
// src/dependencyInjection/registrations/worldAndEntityRegistrations.js
// Add to existing file after other clothing service registrations
import { ClothingAccessibilityService } from '../../clothing/services/clothingAccessibilityService.js';

// In the registration section, add:
registrar.singletonFactory(tokens.ClothingAccessibilityService, (c) => {
  return new ClothingAccessibilityService({
    logger: c.resolve(tokens.ILogger),
    entityManager: c.resolve(tokens.IEntityManager),
    coverageAnalyzer: createCoverageAnalyzer({
      entitiesGateway: c.resolve(tokens.IEntitiesGateway),
      errorHandler: null
    }),
    priorityCalculator: null // Will use existing priority system from scopeDsl
  });
});

// Also need to add token to src/dependencyInjection/tokens/tokens-core.js:
// ClothingAccessibilityService: 'ClothingAccessibilityService',
```

### Key Implementation Components

#### 1. Equipment State Management
```javascript
class EquipmentStateManager {
  constructor(entityManager) {
    this.entityManager = entityManager;
  }

  getEquipmentState(entityId) {
    const equipment = this.entityManager.getComponent(entityId, 'core:equipment');
    return equipment?.equipped || {};
  }

  getItemsInSlot(equipmentState, slotName) {
    const slot = equipmentState[slotName];
    if (!slot || typeof slot !== 'object') return [];
    
    return Object.entries(slot).map(([layer, itemId]) => ({
      itemId,
      layer,
      slotName
    }));
  }
}
```

#### 2. Coverage Analysis Integration
```javascript
class CoverageBlockingCalculator {
  constructor(coverageAnalyzer, priorityCalculator) {
    this.coverageAnalyzer = coverageAnalyzer;
    this.priorityCalculator = priorityCalculator;
  }

  calculateAccessibility(equipmentState, entityId) {
    // Use existing coverage analyzer from src/clothing/analysis/coverageAnalyzer.js
    // The analyzer is already implemented as a factory function
    const coverageAnalysis = this.coverageAnalyzer.analyzeCoverageBlocking(
      equipmentState, 
      entityId
    );

    // Add priority-based filtering
    return this.priorityCalculator.applyPriorityRules(coverageAnalysis);
  }
}
```

#### 3. Unified Priority System
```javascript
class ClothingPriorityCalculator {
  constructor() {
    this.priorityMap = new Map();
  }

  calculatePriority(itemId, layer, bodyArea, context) {
    // Unified priority calculation combining:
    // - Coverage priority from src/scopeDsl/prioritySystem/priorityConstants.js COVERAGE_PRIORITY
    // - Layer priority from existing LAYER_PRIORITY in arrayIterationResolver.js
    // - Context-specific modifiers
    
    const cacheKey = `${itemId}:${layer}:${bodyArea}:${context}`;
    if (this.priorityMap.has(cacheKey)) {
      return this.priorityMap.get(cacheKey);
    }

    const priority = this.computePriority(itemId, layer, bodyArea, context);
    this.priorityMap.set(cacheKey, priority);
    return priority;
  }

  private computePriority(itemId, layer, bodyArea, context) {
    // Implementation details...
  }
}
```

### Performance Optimization

#### Caching Strategy
```javascript
class AccessibilityCache {
  constructor(ttlMs = 5000) {
    this.cache = new Map();
    this.ttl = ttlMs;
  }

  get(entityId, queryHash) {
    const key = `${entityId}:${queryHash}`;
    const entry = this.cache.get(key);
    
    if (!entry || Date.now() - entry.timestamp > this.ttl) {
      return null;
    }
    
    return entry.result;
  }

  set(entityId, queryHash, result) {
    const key = `${entityId}:${queryHash}`;
    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  clear(entityId) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${entityId}:`)) {
        this.cache.delete(key);
      }
    }
  }
}
```

### API Examples

#### Basic Usage
```javascript
// Get topmost accessible clothing items
const accessibleItems = clothingService.getAccessibleItems('character123', {
  mode: 'topmost'
});

// Check if specific item is accessible
const canRemove = clothingService.isItemAccessible('character123', 'clothing:trousers');

// Find what's blocking an item
const blockingItem = clothingService.getBlockingItem('character123', 'clothing:underwear');
```

#### Advanced Queries
```javascript
// Get all base layer items
const baseItems = clothingService.getAccessibleItems('character123', {
  mode: 'all',
  layer: 'base'
});

// Get items for specific body area
const torsoItems = clothingService.getAccessibleItems('character123', {
  mode: 'topmost',
  bodyArea: 'torso_upper'
});

// Context-aware queries
const equipItems = clothingService.getAccessibleItems('character123', {
  mode: 'all',
  context: 'equipping'
});
```

## Testing Requirements

### Unit Test Structure
```javascript
// tests/unit/clothing/services/clothingAccessibilityService.test.js
describe('ClothingAccessibilityService', () => {
  describe('getAccessibleItems', () => {
    it('should return only topmost accessible items in topmost mode', () => {
      // Test Layla Agirre scenario through service API
    });

    it('should handle empty equipment gracefully', () => {
      // Edge case testing
    });

    it('should cache results for performance', () => {
      // Performance optimization testing
    });
  });

  describe('isItemAccessible', () => {
    it('should correctly identify blocked items', () => {
      // Coverage blocking validation
    });

    it('should return detailed accessibility reasons', () => {
      // Debugging support testing
    });
  });

  describe('Performance', () => {
    it('should handle large wardrobes efficiently', () => {
      // Performance regression testing
    });
  });
});
```

### Integration Testing
- [ ] **Service integration**: Test with real entity manager and coverage components
- [ ] **Performance benchmarks**: Compare against Phase 1 implementation
- [ ] **Cache efficiency**: Verify caching provides performance benefits
- [ ] **Error handling**: Test graceful degradation scenarios

## Risk Assessment

### Implementation Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|-------------|
| Performance regression | Medium | Medium | Comprehensive benchmarking and optimization |
| API complexity | Medium | Low | Simple, well-documented API design |
| Integration complexity | Low | Medium | Phased migration approach |
| Cache invalidation bugs | Medium | Low | Conservative cache TTL and clear invalidation |

### Migration Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|-------------|
| Breaking existing integrations | Low | High | Backward compatibility layer |
| Service registration issues | Low | Medium | Comprehensive DI testing |
| Conflicts with ClothingManagementService | Medium | Medium | Clear separation of responsibilities |
| Performance impact during migration | Low | Low | Parallel implementation approach |

## Definition of Done
- [ ] Service implements all required API methods
- [ ] Unit tests achieve >95% coverage
- [ ] Performance benchmarks show improvement or neutral impact
- [ ] Integration tests validate service works with existing systems
- [ ] API documentation is complete and clear
- [ ] Service is registered in DI container
- [ ] Migration guide for updating existing code

## Dependencies and Integration

### Upstream Dependencies
- **Phase 1 completion**: Validated coverage blocking approach
- **Existing systems**: 
  - Coverage analyzer: `src/clothing/analysis/coverageAnalyzer.js`
  - Coverage mapping component: `data/mods/clothing/components/coverage_mapping.component.json`
  - Priority constants: `src/scopeDsl/prioritySystem/priorityConstants.js`
  - Entity manager: Registered in DI container
  - Existing ClothingManagementService: `src/clothing/services/clothingManagementService.js`

### Downstream Impact
- **CLOREMLOG-006**: Priority system refactoring will use this service
- **CLOREMLOG-007**: Clothing resolvers will migrate to use this service
- **Future development**: Foundation for all clothing-related features

## Migration Strategy
1. **Parallel implementation**: Build service alongside existing code
2. **Backward compatibility**: Maintain existing APIs during transition
3. **Gradual migration**: Update one resolver at a time in CLOREMLOG-007
4. **Performance validation**: Ensure no regression during migration
5. **Complete cutover**: Remove old implementations once migration complete

## Notes
- This service is the foundation for all future clothing system improvements
- Focus on clean, testable design over premature optimization
- API should be intuitive for developers but powerful enough for complex scenarios
- Consider future extensibility for new clothing mechanics
- Documentation and examples are critical for adoption