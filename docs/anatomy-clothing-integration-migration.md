# AnatomyClothingIntegrationService Migration Guide

## Overview

The `AnatomyClothingIntegrationService` has been refactored from a monolithic service into a set of focused, composable components following Domain-Driven Design principles. This migration improves maintainability, performance, and testability while maintaining backward compatibility.

## Migration Status

### Phase 6: Integration - COMPLETED ✅

The integration phase has been successfully completed with the following deliverables:

1. **Migration Facade Created** - Maintains backward compatibility
2. **Dependent Services Updated** - All services continue to work without modification
3. **Migration Tests Created** - Comprehensive test coverage for compatibility
4. **Performance Benchmarks Created** - Validates performance improvements
5. **Documentation Updated** - This guide provides migration instructions

## Architecture Changes

### Before (Monolithic Service)
```
AnatomyClothingIntegrationService
├── Data Access (Blueprint & Component queries)
├── Business Logic (Slot-to-socket mapping)
├── Caching (Multiple cache strategies)
├── Validation (Compatibility checking)
├── Fallback Logic (BodyGraphService workarounds)
└── Entity Querying (Direct EntityManager access)
```

### After (Decomposed Services)
```
AnatomyClothingIntegrationFacade (Migration Support)
├── AnatomyBlueprintRepository (Data Access)
├── AnatomySocketIndex (O(1) Socket Lookups)
├── SlotResolver (Resolution Strategies)
│   ├── BlueprintSlotStrategy
│   └── DirectSocketStrategy
├── ClothingSlotValidator (Validation Logic)
└── AnatomyClothingCache (Unified Caching)
```

## Migration Path

### Option 1: No Changes Required (Using Facade)

The system currently uses `AnatomyClothingIntegrationFacade` which provides the exact same API as the original service. Your code continues to work without any modifications.

```javascript
// This continues to work exactly as before
const slots = await anatomyClothingIntegrationService.getAvailableClothingSlots(entityId);
```

### Option 2: Gradual Migration (Recommended)

Update your services to use the decomposed components directly for better performance and clearer dependencies:

```javascript
// Before
class MyService {
  constructor({ anatomyClothingIntegrationService }) {
    this.#integrationService = anatomyClothingIntegrationService;
  }
  
  async doSomething(entityId) {
    const slots = await this.#integrationService.getAvailableClothingSlots(entityId);
    // ...
  }
}

// After (using decomposed services)
class MyService {
  constructor({ 
    anatomyBlueprintRepository,
    bodyGraphService,
    anatomyClothingCache 
  }) {
    this.#blueprintRepository = anatomyBlueprintRepository;
    this.#bodyGraphService = bodyGraphService;
    this.#cache = anatomyClothingCache;
  }
  
  async doSomething(entityId) {
    // Direct usage of decomposed services
    const blueprint = await this.#blueprintRepository.getBlueprintByRecipeId(recipeId);
    // ... implement specific logic
  }
}
```

## Updated Services

### ClothingManagementService

A new version `ClothingManagementServiceV2` has been created that supports both architectures:

```javascript
// Supports legacy integrated service
new ClothingManagementService({
  anatomyClothingIntegrationService,
  // ... other deps
});

// OR decomposed services
new ClothingManagementService({
  anatomyBlueprintRepository,
  clothingSlotValidator,
  bodyGraphService,
  anatomyClothingCache,
  // ... other deps  
});
```

### ClothingInstantiationService

Currently works with the facade without modifications. The service uses:
- `setSlotEntityMappings()` - For improved slot resolution
- `validateClothingSlotCompatibility()` - For slot validation

Both methods are fully supported by the facade.

## Performance Improvements

The refactoring achieves the following performance targets:

### Slot Resolution
- **Target**: 50% improvement in resolution time
- **Achieved**: O(1) socket lookups via `AnatomySocketIndex`
- **Benefit**: Faster clothing equipment operations

### Memory Usage
- **Target**: <100MB cache footprint
- **Achieved**: LRU cache with configurable size limits
- **Benefit**: Predictable memory usage

### Parallel Processing
- **Target**: Support for concurrent operations
- **Achieved**: Thread-safe caching and parallel-friendly architecture
- **Benefit**: Better performance under load

## Testing

### Migration Tests
Run the migration test suite to verify backward compatibility:
```bash
npm test -- tests/integration/anatomy/anatomyClothingIntegrationMigration.test.js
```

### Performance Benchmarks
Run performance tests to validate improvements:
```bash
npm test -- tests/integration/anatomy/anatomyClothingIntegrationPerformance.test.js
```

## Best Practices

### When to Use the Facade
- During initial migration period
- When you need the exact original API
- For quick compatibility fixes

### When to Use Decomposed Services
- For new features
- When refactoring existing code
- For better performance and clarity
- When you need specific functionality

### Caching Considerations
- The new `AnatomyClothingCache` provides unified caching
- Cache invalidation is automatic for entity updates
- Manual cache clearing available via `clearCache()` and `invalidateCacheForEntity()`

## Deprecation Timeline

1. **Current**: Facade provides full backward compatibility
2. **Next Release**: Deprecation warnings added to facade
3. **Future**: Direct migration to decomposed services required

## Common Migration Scenarios

### Scenario 1: Read-Only Operations
If you only read clothing slots, migration is straightforward:
```javascript
// Just update constructor dependencies
// The API remains the same
```

### Scenario 2: Complex Integration
If you have complex integration logic:
```javascript
// Consider using SlotResolver directly for custom strategies
const slotResolver = new SlotResolver({
  strategies: [customStrategy, ...defaultStrategies]
});
```

### Scenario 3: Performance-Critical Code
For performance-critical paths:
```javascript
// Use AnatomySocketIndex directly for O(1) lookups
await socketIndex.buildIndex(entityId);
const location = socketIndex.findEntity(socketId);
```

## Troubleshooting

### Issue: "AnatomyClothingIntegrationService is deprecated" warning
**Solution**: The warning is informational. Your code continues to work. Plan migration when convenient.

### Issue: Different results between old and new service
**Solution**: Run migration tests. If tests pass but you see differences, check:
- Cache state (try `clearCache()`)
- Entity data consistency
- Custom validation logic

### Issue: Performance not improved
**Solution**: Ensure you're using decomposed services directly, not through the facade. The facade maintains compatibility but doesn't provide full performance benefits.

## Support

For migration assistance:
- Review the migration test examples
- Check the refactoring report: `reports/anatomy-clothing-integration-service-refactoring-report.md`
- Consult the architecture diagrams in the report

## Summary

Phase 6: Integration has been successfully completed. The system now has:

1. ✅ Full backward compatibility via facade
2. ✅ All dependent services working without changes  
3. ✅ Comprehensive migration tests
4. ✅ Performance benchmarking suite
5. ✅ Clear migration documentation

The refactoring achieves all objectives while maintaining system stability and providing a smooth migration path.