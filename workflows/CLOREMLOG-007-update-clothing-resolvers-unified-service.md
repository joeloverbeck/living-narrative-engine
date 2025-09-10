# CLOREMLOG-007: Update All Clothing Resolvers to Use New Service

## Overview
**Priority**: Medium  
**Phase**: 2 (Architectural Improvement)  
**Estimated Effort**: 10-14 hours  
**Dependencies**: CLOREMLOG-005, CLOREMLOG-006  
**Blocks**: CLOREMLOG-008

## Problem Statement

With the unified clothing accessibility service (CLOREMLOG-005) and consolidated priority system (CLOREMLOG-006) now available, all clothing-related resolvers need to be updated to use these centralized services instead of their own embedded logic.

**Current State**: Multiple resolvers implement their own clothing logic
- `ArrayIterationResolver` - Has embedded clothing-specific getAllClothingItems logic  
- `ClothingStepResolver` - Creates clothing access objects with custom logic
- Other potential resolvers with clothing-related functionality

**Target State**: All resolvers use unified clothing accessibility service for consistent behavior and maintainability.

## Root Cause

**Scattered Implementation**: Clothing logic was implemented directly in resolvers before centralized services existed. Now that unified services are available, resolvers should delegate to these services rather than maintaining their own implementations.

## Acceptance Criteria

### 1. Update ArrayIterationResolver
- [ ] **File**: `src/scopeDsl/nodes/arrayIterationResolver.js`
- [ ] **Remove embedded logic**: Extract clothing-specific logic from `getAllClothingItems()`
- [ ] **Integrate service**: Use `ClothingAccessibilityService` for clothing queries
- [ ] **Maintain API**: Keep same method signatures and return formats
- [ ] **Preserve performance**: Ensure no performance regression

### 2. Update ClothingStepResolver  
- [ ] **File**: `src/scopeDsl/nodes/clothingStepResolver.js`
- [ ] **Service integration**: Use unified service for clothing access object creation
- [ ] **Priority system**: Use consolidated priority system from CLOREMLOG-006
- [ ] **Simplify logic**: Remove custom clothing-specific implementations
- [ ] **Maintain compatibility**: Ensure existing scopes continue to work

### 3. Identify and Update Other Resolvers
- [ ] **Code search**: Find all resolvers with clothing-related logic
- [ ] **Impact assessment**: Determine which resolvers need updates
- [ ] **Systematic updates**: Update each resolver to use unified services
- [ ] **Testing**: Validate each resolver update individually

### 4. Service Integration Architecture
- [ ] **Dependency injection**: Inject clothing service into all relevant resolvers
- [ ] **Error handling**: Graceful fallback if service is unavailable
- [ ] **Logging**: Add appropriate logging for debugging and monitoring
- [ ] **Performance**: Optimize service calls for resolver usage patterns

## Implementation Details

### ArrayIterationResolver Updates

#### Current Implementation Issues
```javascript
// Current problematic implementation in arrayIterationResolver.js
function getAllClothingItems(clothingAccess, trace) {
  // Custom clothing logic embedded in resolver
  const { equipped, mode, entityId } = clothingAccess;
  const candidates = [];
  const layers = LAYER_PRIORITY[mode] || LAYER_PRIORITY.topmost;

  // Coverage blocking added in CLOREMLOG-002
  const coverageAnalysis = analyzeCoverageBlocking(equipped, entityId);

  // Custom loop and priority logic...
}
```

#### Updated Implementation
```javascript
// Updated implementation using unified service
class ArrayIterationResolver {
  #clothingAccessibilityService;
  #logger;

  constructor({ clothingAccessibilityService, logger, ...otherDeps }) {
    validateDependency(clothingAccessibilityService, 'IClothingAccessibilityService', logger, {
      requiredMethods: ['getAccessibleItems']
    });
    
    this.#clothingAccessibilityService = clothingAccessibilityService;
    this.#logger = logger;
    // ... other initialization
  }

  getAllClothingItems(clothingAccess, trace) {
    const { entityId, mode } = clothingAccess;
    
    try {
      trace?.addStep(`Delegating clothing query to ClothingAccessibilityService`);
      
      // Delegate to unified service
      const accessibleItems = this.#clothingAccessibilityService.getAccessibleItems(entityId, {
        mode: mode,
        context: 'removal'  // Default context for array iteration
      });

      trace?.addStep(`Found ${accessibleItems.length} accessible clothing items`);
      
      // Convert service result to resolver format
      return this.convertServiceResultToResolverFormat(accessibleItems, trace);
      
    } catch (error) {
      this.#logger.error('Failed to query clothing accessibility service', error);
      trace?.addStep(`Service failed: ${error.message}, using fallback`);
      
      // Graceful fallback to legacy implementation if service fails
      return this.fallbackToLegacyImplementation(clothingAccess, trace);
    }
  }

  private convertServiceResultToResolverFormat(serviceItems, trace) {
    // Convert from service format to resolver's expected format
    return serviceItems.map(item => ({
      itemId: item.itemId,
      layer: item.layer,
      slotName: item.slotName,
      coveragePriority: item.priority,
      source: 'clothing_service',
      priority: 0  // Maintain compatibility with existing format
    }));
  }

  private fallbackToLegacyImplementation(clothingAccess, trace) {
    // Keep legacy implementation as backup
    trace?.addStep('Using legacy implementation as fallback');
    // ... legacy implementation
  }
}
```

### ClothingStepResolver Updates

#### Current Implementation
```javascript
// Current implementation in clothingStepResolver.js
class ClothingStepResolver {
  resolve(step, context, trace) {
    // Custom clothing access object creation
    const clothingAccess = {
      equipped: equipment.equipped,
      mode: step.property, // 'topmost', etc.
      entityId: context.entityId
    };
    
    return clothingAccess;
  }
}
```

#### Updated Implementation  
```javascript
// Updated implementation using unified service
class ClothingStepResolver {
  #clothingAccessibilityService;
  #logger;

  constructor({ clothingAccessibilityService, logger, ...otherDeps }) {
    validateDependency(clothingAccessibilityService, 'IClothingAccessibilityService', logger, {
      requiredMethods: ['getAccessibleItems']
    });
    
    this.#clothingAccessibilityService = clothingAccessibilityService;
    this.#logger = logger;
    // ... other initialization
  }

  resolve(step, context, trace) {
    const { entityId } = context;
    const mode = step.property; // 'topmost', 'all', etc.

    trace?.addStep(`Creating clothing access object for mode: ${mode}`);

    // Enhanced clothing access object with service integration
    const clothingAccess = {
      equipped: this.getEquipmentState(entityId),
      mode: mode,
      entityId: entityId,
      // Add service integration
      accessibilityService: this.#clothingAccessibilityService,
      getAccessibleItems: () => {
        return this.#clothingAccessibilityService.getAccessibleItems(entityId, {
          mode: mode,
          context: 'resolution'
        });
      }
    };

    trace?.addStep('Clothing access object created with service integration');
    return clothingAccess;
  }

  private getEquipmentState(entityId) {
    // Get equipment state using existing logic
    const equipment = this.entityManager.getComponent(entityId, 'core:equipment');
    return equipment?.equipped || {};
  }
}
```

### Service Integration Pattern

#### Dependency Registration Updates
```javascript
// src/dependencyInjection/registrations/scopeRegistrations.js
import { ArrayIterationResolver } from '../scopeDsl/nodes/arrayIterationResolver.js';
import { ClothingStepResolver } from '../scopeDsl/nodes/clothingStepResolver.js';
import { tokens } from '../tokens.js';

export function registerScopeResolvers(container) {
  // Updated registrations with clothing service dependency
  container.register(tokens.IArrayIterationResolver, ArrayIterationResolver, {
    dependencies: [
      tokens.ILogger,
      tokens.IClothingAccessibilityService, // New dependency
      tokens.IClothingPriorityManager,      // New dependency
      // ... other dependencies
    ]
  });

  container.register(tokens.IClothingStepResolver, ClothingStepResolver, {
    dependencies: [
      tokens.ILogger,
      tokens.IEntityManager,
      tokens.IClothingAccessibilityService, // New dependency
      // ... other dependencies
    ]
  });
}
```

#### Error Handling Strategy
```javascript
class ResolverErrorHandler {
  constructor(logger) {
    this.logger = logger;
  }

  handleServiceFailure(serviceName, error, fallbackFn) {
    this.logger.warn(`${serviceName} failed: ${error.message}, using fallback`);
    
    try {
      return fallbackFn();
    } catch (fallbackError) {
      this.logger.error(`Fallback also failed: ${fallbackError.message}`);
      throw new Error(`Both service and fallback failed for ${serviceName}`);
    }
  }

  wrapServiceCall(serviceName, serviceCall, fallbackCall) {
    try {
      return serviceCall();
    } catch (error) {
      return this.handleServiceFailure(serviceName, error, fallbackCall);
    }
  }
}
```

### Resolver Discovery and Updates

#### Code Search Strategy
```bash
# Find all files that might have clothing-related logic
grep -r "clothing" src/scopeDsl/nodes/ --include="*.js"
grep -r "topmost\|layer\|equipment" src/scopeDsl/nodes/ --include="*.js"
grep -r "LAYER_PRIORITY\|COVERAGE_PRIORITY" src/ --include="*.js"
```

#### Update Checklist for Each Resolver
- [ ] **Identify clothing logic**: Find clothing-specific implementations
- [ ] **Assess dependencies**: Determine what services are needed
- [ ] **Update constructor**: Add service dependencies
- [ ] **Replace logic**: Use service calls instead of custom implementations
- [ ] **Add error handling**: Graceful fallback for service failures
- [ ] **Update tests**: Ensure all tests pass with new implementation
- [ ] **Performance test**: Verify no performance regression

### Testing Updates Required

#### Unit Test Updates
```javascript
// tests/unit/scopeDsl/nodes/arrayIterationResolver.test.js
describe('ArrayIterationResolver with Clothing Service', () => {
  let resolver;
  let mockClothingService;
  let mockLogger;

  beforeEach(() => {
    mockClothingService = createMockClothingService();
    mockLogger = createMockLogger();
    resolver = new ArrayIterationResolver({
      clothingAccessibilityService: mockClothingService,
      logger: mockLogger
    });
  });

  it('should delegate clothing queries to clothing service', () => {
    // Test service delegation
    const clothingAccess = createTestClothingAccess();
    
    resolver.getAllClothingItems(clothingAccess);
    
    expect(mockClothingService.getAccessibleItems).toHaveBeenCalledWith(
      clothingAccess.entityId,
      { mode: clothingAccess.mode, context: 'removal' }
    );
  });

  it('should fall back gracefully when service fails', () => {
    // Test error handling
    mockClothingService.getAccessibleItems.mockImplementation(() => {
      throw new Error('Service failure');
    });

    const result = resolver.getAllClothingItems(createTestClothingAccess());
    
    expect(result).toBeDefined(); // Should not throw
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should maintain same API and return format', () => {
    // Test backward compatibility
    const result = resolver.getAllClothingItems(createTestClothingAccess());
    
    // Should have same format as before
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        itemId: expect.any(String),
        layer: expect.any(String),
        slotName: expect.any(String),
        coveragePriority: expect.any(Number),
        source: expect.any(String),
        priority: expect.any(Number)
      })
    ]));
  });
});
```

#### Integration Test Updates
```javascript
// tests/integration/scopes/clothingResolverIntegration.test.js
describe('Clothing Resolver Integration', () => {
  it('should produce same results as before service integration', () => {
    // Regression test to ensure identical behavior
    const beforeResults = getResultsWithLegacyImplementation();
    const afterResults = getResultsWithServiceImplementation();
    
    expect(afterResults).toEqual(beforeResults);
  });

  it('should handle complex clothing scenarios through service', () => {
    // Test complex scenarios end-to-end
    const laylaAgirreResult = resolveClothingForEntity('layla_agirre');
    
    expect(laylaAgirreResult).toEqual([
      expect.objectContaining({
        itemId: 'clothing:dark_olive_high_rise_double_pleat_trousers'
      })
    ]);
    
    expect(laylaAgirreResult.find(item => 
      item.itemId === 'clothing:power_mesh_boxer_brief'
    )).toBeUndefined();
  });
});
```

## Risk Assessment

### Implementation Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|-------------|
| Breaking existing resolver behavior | Medium | High | Comprehensive regression testing |
| Service integration bugs | Medium | Medium | Thorough unit and integration testing |
| Performance regression | Low | Medium | Performance benchmarking |
| Dependency injection issues | Low | Medium | DI container testing |

### Migration Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|-------------|
| Inconsistent behavior during rollout | Low | High | Resolver-by-resolver validation |
| Service unavailability | Low | Medium | Graceful fallback implementations |
| Complex resolver logic missing edge cases | Medium | Medium | Comprehensive test coverage |

## Definition of Done
- [ ] All clothing-related resolvers updated to use unified service
- [ ] ArrayIterationResolver delegates to ClothingAccessibilityService  
- [ ] ClothingStepResolver integrates with unified services
- [ ] All resolver unit tests pass with new implementations
- [ ] Integration tests validate end-to-end behavior
- [ ] Performance tests show no significant regression
- [ ] Error handling provides graceful degradation
- [ ] Dependency injection working correctly for all resolvers

## Dependencies and Integration

### Upstream Dependencies
- **CLOREMLOG-005**: ClothingAccessibilityService must be complete and tested
- **CLOREMLOG-006**: ClothingPriorityManager must be available and integrated
- **DI Container**: Service registration must be working

### Downstream Impact
- **CLOREMLOG-008**: Test suite will validate resolver integration
- **Action discovery**: Clothing removal actions will use updated resolvers
- **Scope resolution**: All clothing scopes will use consistent logic

## Migration Strategy
1. **One resolver at a time**: Update and validate each resolver individually
2. **Backward compatibility**: Maintain fallback implementations during transition
3. **Comprehensive testing**: Test each resolver thoroughly before moving to next
4. **Performance validation**: Benchmark each resolver update
5. **Rollback capability**: Keep ability to revert to legacy implementations

## Performance Considerations
- **Service call overhead**: Minimize service calls through efficient design
- **Caching coordination**: Ensure service caching benefits resolver usage patterns
- **Fallback performance**: Legacy implementations should perform adequately
- **Memory usage**: Monitor for memory leaks in service integration

## Notes
- Focus on maintaining exact API compatibility during migration
- Resolver updates should be transparent to users of the resolvers
- Error handling is critical for system reliability
- Performance monitoring during rollout is essential
- Document any behavior changes clearly
- Consider feature flags for gradual rollout if needed