# CLOREMLOG-005-08: Migration Strategy and Documentation

## Overview
**Parent**: CLOREMLOG-005  
**Priority**: Medium  
**Estimated Effort**: 2 hours  
**Dependencies**: CLOREMLOG-005-01 through CLOREMLOG-005-07  
**Blocks**: None (Final ticket)

## Problem Statement
The new ClothingAccessibilityService needs proper documentation and a migration strategy to ensure smooth adoption and future maintenance.

## Acceptance Criteria

### 1. Migration Guide
- [ ] Document step-by-step migration process
- [ ] Identify all affected components
- [ ] Provide code examples for migration
- [ ] Create rollback strategy

### 2. API Documentation
- [ ] Complete JSDoc for all public methods
- [ ] Create usage examples
- [ ] Document configuration options
- [ ] Explain caching behavior

### 3. Architecture Documentation
- [ ] Update architecture diagrams
- [ ] Document service responsibilities
- [ ] Explain integration points
- [ ] Add to developer guide

## Implementation Details

### Migration Guide
```markdown
# ClothingAccessibilityService Migration Guide

## Overview
This guide helps migrate from embedded clothing logic in ArrayIterationResolver to the new centralized ClothingAccessibilityService.

## Migration Steps

### Step 1: Deploy Service (No Breaking Changes)
1. Deploy ClothingAccessibilityService to production
2. Register in DI container
3. Service is available but not yet used
4. Rollback: Simply remove registration

### Step 2: Update ClothingManagementService (Optional Usage)
1. Update ClothingManagementService to accept accessibility service
2. Add delegation methods for compatibility
3. Existing code continues to work
4. New code can use improved API
5. Rollback: Remove service parameter

### Step 3: Migrate ArrayIterationResolver (Breaking Change)
1. Update ArrayIterationResolver to use service
2. Remove embedded clothing logic
3. Test thoroughly with existing scopes
4. Rollback: Restore previous resolver version

### Step 4: Update Dependent Components
Components that may need updates:
- `src/scopeDsl/factories/nodeResolverFactory.js`
- Any custom resolvers using clothing logic
- Test files mocking clothing behavior

### Step 5: Cleanup and Optimization
1. Remove deprecated methods
2. Optimize caching settings
3. Update documentation
4. Remove backward compatibility shims

## Code Migration Examples

### Before (Embedded Logic)
```javascript
// In ArrayIterationResolver
function getAllClothingItems(clothingAccess, trace) {
  const { equipped, mode, entityId } = clothingAccess;
  // 150+ lines of embedded logic
  // Coverage analysis, priority calculation, etc.
}
```

### After (Service Delegation)
```javascript
// In ArrayIterationResolver
function processClothingAccess(clothingAccess, trace) {
  const { entityId, mode } = clothingAccess;
  return clothingAccessibilityService.getAccessibleItems(entityId, {
    mode,
    context: 'removal',
    sortByPriority: true
  });
}
```

### Using the Service Directly
```javascript
// In application code
const accessibilityService = container.resolve('ClothingAccessibilityService');

// Get accessible items
const items = accessibilityService.getAccessibleItems('character_id', {
  mode: 'topmost',
  context: 'removal'
});

// Check if item is accessible
const result = accessibilityService.isItemAccessible('character_id', 'item_id');
if (!result.accessible) {
  console.log(`Item blocked by: ${result.blockingItems.join(', ')}`);
}

// Find blocking item
const blocker = accessibilityService.getBlockingItem('character_id', 'item_id');
```

## Rollback Strategy

### Phase 1 Rollback (Service Deployment)
- Remove service registration from DI container
- No other changes needed

### Phase 2 Rollback (Service Integration)
- Restore previous ClothingManagementService version
- Remove accessibility service parameter

### Phase 3 Rollback (Resolver Migration)
- Restore previous ArrayIterationResolver with embedded logic
- Update resolver factory to remove service injection
- Rerun all integration tests

## Testing Migration

### Pre-Migration Tests
1. Run full test suite, save results
2. Benchmark current performance
3. Document known issues

### Post-Migration Validation
1. Run same test suite, compare results
2. Verify Layla Agirre scenario still passes
3. Check performance metrics
4. Monitor for new issues

### Integration Points to Test
- Clothing removal UI actions
- Equipment/unequip operations
- Scope DSL queries with clothing access
- Save/load with equipped items
```

### API Documentation
```javascript
/**
 * @module ClothingAccessibilityService
 * @description Centralized service for clothing accessibility queries and coverage blocking logic
 * 
 * @example
 * // Basic usage
 * const service = container.resolve('ClothingAccessibilityService');
 * const items = service.getAccessibleItems('entity_id');
 * 
 * @example
 * // Advanced queries
 * const items = service.getAccessibleItems('entity_id', {
 *   mode: 'topmost',        // 'topmost' | 'all' | 'base' | 'outer' | 'underwear'
 *   bodyArea: 'torso',      // Filter by body area
 *   layer: 'base',          // Filter by specific layer
 *   context: 'removal',     // 'removal' | 'equipping' | 'inspection'
 *   sortByPriority: true    // Sort results by priority
 * });
 * 
 * @example
 * // Check accessibility
 * const result = service.isItemAccessible('entity_id', 'item_id');
 * // result = { 
 * //   accessible: false, 
 * //   reason: 'Blocked by: jacket, coat',
 * //   blockingItems: ['jacket', 'coat']
 * // }
 * 
 * @example
 * // Find specific blocker
 * const blocker = service.getBlockingItem('entity_id', 'underwear_id');
 * // Returns 'trousers' or null if accessible
 */

/**
 * Configuration Options
 * 
 * The service uses the following configuration from priorityConstants.js:
 * - PRIORITY_CONFIG.enableCaching: Enable/disable result caching
 * - PRIORITY_CONFIG.maxCacheSize: Maximum cache entries (default: 1000)
 * - PRIORITY_CONFIG.enableTieBreaking: Stable sort for equal priorities
 * 
 * Cache TTL is hardcoded to 5 seconds for query results.
 * Priority calculations are cached indefinitely until clearCache() is called.
 */

/**
 * Query Modes
 * 
 * - 'topmost': Returns only the outermost accessible item per slot
 *   Applies coverage blocking rules
 *   Used for: Clothing removal UI
 * 
 * - 'all': Returns all equipped items without filtering
 *   No coverage blocking applied
 *   Used for: Inventory display, full equipment list
 * 
 * - 'base': Returns only base layer items
 *   No coverage blocking between different slots
 *   Used for: Layer-specific queries
 * 
 * - 'outer': Returns only outer layer items
 *   No coverage blocking between different slots
 *   Used for: Coat/jacket checks
 * 
 * - 'underwear': Returns only underwear layer items
 *   No coverage blocking between different slots
 *   Used for: Underwear-specific logic
 */

/**
 * Contexts
 * 
 * - 'removal': Default context for clothing removal operations
 *   Outer items get slight priority boost
 *   Used by: Unequip actions, removal UI
 * 
 * - 'equipping': Context for putting on clothes
 *   Empty slots prioritized (handled externally)
 *   Used by: Equip actions
 * 
 * - 'inspection': Context for viewing/examining clothes
 *   All items treated equally
 *   Used by: Inspect/examine actions
 */

/**
 * Priority System
 * 
 * Priority = coverage_priority + (layer_priority / 100)
 * 
 * Coverage priorities (lower = higher priority):
 * - outer: 100
 * - base: 200  
 * - underwear: 300
 * - direct: 400
 * 
 * Layer priorities (for tie-breaking):
 * - outer: 10
 * - base: 20
 * - underwear: 30
 * - accessories: 40
 * 
 * Context modifiers can adjust final priority by ±10%
 */

/**
 * Performance Characteristics
 * 
 * - Query caching: 5 second TTL, ~10x speedup for repeated queries
 * - Priority caching: Indefinite, cleared with clearCache()
 * - Complexity: O(n) for n equipped items
 * - Memory: ~1KB per cached query, auto-managed to limit
 * - Coverage analysis: O(n²) worst case, typically O(n)
 */
```

### Architecture Documentation
```markdown
# Clothing System Architecture

## Service Responsibilities

### ClothingAccessibilityService (NEW)
**Responsibility**: Centralized clothing accessibility queries
- Coverage blocking analysis
- Priority calculation and sorting
- Query caching and optimization
- Mode-specific filtering

### ClothingManagementService
**Responsibility**: High-level clothing operations
- Equipment/unequip orchestration
- Validation and conflict resolution
- Event dispatching
- Delegates accessibility queries to ClothingAccessibilityService

### CoverageAnalyzer
**Responsibility**: Low-level coverage blocking logic
- Body area overlap detection
- Coverage priority comparison
- Blocking relationship mapping

### ArrayIterationResolver
**Responsibility**: Scope DSL array operations
- Array flattening and iteration
- Delegates clothing queries to ClothingAccessibilityService
- No embedded clothing logic

## Data Flow

```
User Action (Remove Clothing)
    ↓
Scope DSL Query (topmost_clothing)
    ↓
ArrayIterationResolver
    ↓
ClothingAccessibilityService.getAccessibleItems()
    ↓
CoverageAnalyzer.analyzeCoverageBlocking()
    ↓
Priority Calculation & Sorting
    ↓
Cached Result
    ↓
UI Display
```

## Integration Points

1. **Dependency Injection**
   - Token: `ClothingAccessibilityService`
   - Lifecycle: Singleton
   - Dependencies: IEntityManager, ILogger, EntitiesGateway

2. **Service Consumers**
   - ArrayIterationResolver (required)
   - ClothingManagementService (optional)
   - Future: Direct UI integration

3. **Data Sources**
   - Entity components: `clothing:equipment`
   - Coverage mappings: `clothing:coverage_mapping`
   - Priority constants: `priorityConstants.js`

## Design Principles

1. **Single Responsibility**: Each service has one clear purpose
2. **Dependency Injection**: All services use DI for testability
3. **Caching Strategy**: Performance through intelligent caching
4. **Graceful Degradation**: Failures don't crash, provide fallbacks
5. **Backward Compatibility**: Phased migration minimizes disruption

## Future Enhancements

1. **Context-Aware Priorities**: More sophisticated context modifiers
2. **Dynamic Cache TTL**: Adaptive based on usage patterns
3. **Bulk Operations**: Batch queries for performance
4. **Event Integration**: Cache invalidation on equipment changes
5. **Direct UI Binding**: Remove intermediate Scope DSL layer
```

### Developer Guide Addition
```markdown
## Working with Clothing Accessibility

### When to Use ClothingAccessibilityService

Use the service when you need to:
- Determine which clothing items can be removed
- Check if a specific item is blocked by others
- Get items filtered by layer or body area
- Implement clothing-related UI features

### Basic Patterns

```javascript
// Get service from DI container
const accessibilityService = container.resolve('ClothingAccessibilityService');

// Common queries
const removableItems = accessibilityService.getAccessibleItems(entityId, {
  mode: 'topmost'
});

const allUnderwear = accessibilityService.getAccessibleItems(entityId, {
  mode: 'all',
  layer: 'underwear'
});

// Check before operation
const check = accessibilityService.isItemAccessible(entityId, itemId);
if (!check.accessible) {
  showMessage(`Cannot remove ${itemName}: ${check.reason}`);
  return;
}
```

### Testing Your Code

```javascript
// Mock the service in tests
const mockAccessibilityService = {
  getAccessibleItems: jest.fn().mockReturnValue(['item1', 'item2']),
  isItemAccessible: jest.fn().mockReturnValue({ 
    accessible: true, 
    reason: 'Item is accessible' 
  }),
  getBlockingItem: jest.fn().mockReturnValue(null),
  clearCache: jest.fn()
};

// Inject mock in test setup
container.register('ClothingAccessibilityService', mockAccessibilityService);
```

### Performance Tips

1. **Use caching**: Results are cached for 5 seconds automatically
2. **Batch queries**: Get all items once rather than checking individually
3. **Clear cache**: Call `clearCache()` after equipment changes
4. **Specify mode**: Use most specific mode to reduce processing

### Common Pitfalls

1. **Not checking accessibility**: Always verify before allowing removal
2. **Ignoring blocking items**: Show user what needs to be removed first
3. **Wrong mode**: Use 'topmost' for removal, 'all' for inventory
4. **Cache staleness**: Clear cache after equipment state changes
```

## Testing Requirements

### Documentation Tests
- [ ] All code examples compile and run
- [ ] JSDoc generates without errors
- [ ] Migration steps validated in test environment

### Integration Tests
- [ ] Migration process tested end-to-end
- [ ] Rollback procedures verified
- [ ] Performance benchmarks documented

## Success Metrics
- [ ] Complete migration guide created
- [ ] API documentation comprehensive
- [ ] Architecture diagrams updated
- [ ] Developer guide enhanced
- [ ] All examples tested and working

## Notes
- Documentation should be maintained as code evolves
- Include in project's main documentation
- Consider creating video walkthrough for complex migrations
- Keep migration guide until all systems migrated