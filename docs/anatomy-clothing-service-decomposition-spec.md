# AnatomyClothingIntegrationService Decomposition Architecture Specification

## Executive Summary

This specification outlines the complete migration strategy for removing the `AnatomyClothingIntegrationService` facade in favor of direct usage of decomposed components. The migration will improve performance, reduce coupling, and provide better separation of concerns while maintaining backward compatibility during the transition period.

## Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [Target Architecture](#target-architecture)
3. [Service Migration Specifications](#service-migration-specifications)
4. [Dependency Injection Updates](#dependency-injection-updates)
5. [Testing Strategy](#testing-strategy)
6. [Implementation Timeline](#implementation-timeline)
7. [Migration Examples](#migration-examples)

## Current Architecture Analysis

### Service Dependencies

The following services currently depend on `AnatomyClothingIntegrationService`:

1. **ClothingInstantiationService**
   - Uses `setSlotEntityMappings()` for slot resolution context
   - Uses `validateClothingSlotCompatibility()` for equipment validation
   - Critical path: Anatomy generation workflow

2. **ClothingManagementService**
   - Uses `getAvailableClothingSlots()` for slot queries
   - Non-critical path: UI and management operations

3. **ClothingManagementServiceV2** (Already Migrated)
   - Supports both monolithic and decomposed architectures
   - Serves as reference implementation

### Current Component Flow

```
AnatomyClothingIntegrationService (Facade)
├── setSlotEntityMappings() → SlotResolver
├── validateClothingSlotCompatibility() → ClothingSlotValidator + SlotResolver
└── getAvailableClothingSlots() → Multiple components
    ├── AnatomyBlueprintRepository
    ├── BodyGraphService
    ├── AnatomySocketIndex
    └── AnatomyClothingCache
```

### Decomposed Components

1. **AnatomyBlueprintRepository**
   - Blueprint data access with caching
   - O(1) blueprint lookups

2. **AnatomySocketIndex**
   - O(1) socket-to-entity lookups
   - Efficient anatomy traversal

3. **SlotResolver**
   - Orchestrates resolution strategies
   - Handles slot-to-socket mapping

4. **ClothingSlotValidator**
   - Validates slot compatibility
   - Checks layer conflicts

5. **AnatomyClothingCache**
   - Unified LRU cache with TTL
   - Automatic invalidation

## Target Architecture

### Design Principles

1. **Direct Component Usage**: Services interact directly with focused components
2. **Clear Responsibilities**: Each component has a single, well-defined purpose
3. **Performance Optimization**: Eliminate facade overhead
4. **Gradual Migration**: Support both architectures during transition

### Component Interaction Model

```
Service Layer
├── ClothingInstantiationService
│   ├── SlotResolver (for slot mapping)
│   └── ClothingSlotValidator (for validation)
├── ClothingManagementService
│   ├── AnatomyBlueprintRepository (for blueprints)
│   ├── BodyGraphService (for anatomy structure)
│   └── AnatomyClothingCache (for performance)
└── EquipmentOrchestrator
    └── LayerCompatibilityService (already decomposed)
```

## Service Migration Specifications

### ClothingInstantiationService Migration

#### Current Implementation
```javascript
class ClothingInstantiationService {
  constructor({ anatomyClothingIntegrationService, ... }) {
    this.#anatomyClothingIntegrationService = anatomyClothingIntegrationService;
  }
  
  async instantiateAndEquip(actorId, recipe, anatomyData) {
    // Uses facade for slot mappings
    this.#anatomyClothingIntegrationService.setSlotEntityMappings(
      anatomyData.slotEntityMappings
    );
    
    // Uses facade for validation
    const validationResult = await this.#anatomyClothingIntegrationService
      .validateClothingSlotCompatibility(actorId, targetSlot, clothingId);
  }
}
```

#### Target Implementation
```javascript
class ClothingInstantiationService {
  constructor({ 
    slotResolver,
    clothingSlotValidator,
    anatomyBlueprintRepository,
    bodyGraphService,
    ... 
  }) {
    this.#slotResolver = slotResolver;
    this.#clothingSlotValidator = clothingSlotValidator;
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#bodyGraphService = bodyGraphService;
  }
  
  async instantiateAndEquip(actorId, recipe, anatomyData) {
    // Direct slot resolver usage
    this.#slotResolver.setSlotEntityMappings(anatomyData.slotEntityMappings);
    
    // Direct validator usage with helper method
    const validationResult = await this.#validateClothingSlot(
      actorId, 
      targetSlot, 
      clothingId
    );
  }
  
  async #validateClothingSlot(entityId, slotId, itemId) {
    // Create resolver function for validator
    const resolveAttachmentPoints = async (entityId, slotId) => {
      return await this.#slotResolver.resolveClothingSlot(entityId, slotId);
    };
    
    // Get available slots
    const availableSlots = await this.#getAvailableSlots(entityId);
    
    // Validate
    return await this.#clothingSlotValidator.validateSlotCompatibility(
      entityId,
      slotId,
      itemId,
      availableSlots,
      resolveAttachmentPoints
    );
  }
  
  async #getAvailableSlots(entityId) {
    // Get blueprint
    const anatomyData = await this.#bodyGraphService.getAnatomyData(entityId);
    if (!anatomyData?.recipeId) {
      return new Map();
    }
    
    const blueprint = await this.#anatomyBlueprintRepository
      .getBlueprintByRecipeId(anatomyData.recipeId);
      
    // Convert to expected format
    return new Map(Object.entries(blueprint.clothingSlotMappings || {}));
  }
}
```

### ClothingManagementService Migration

#### Current Implementation
```javascript
class ClothingManagementService {
  constructor({ anatomyClothingIntegrationService, ... }) {
    this.#anatomyClothingIntegration = anatomyClothingIntegrationService;
  }
  
  async getAvailableSlots(entityId) {
    const slots = await this.#anatomyClothingIntegration
      .getAvailableClothingSlots(entityId);
    return Array.from(slots.entries());
  }
}
```

#### Target Implementation
```javascript
class ClothingManagementService {
  constructor({ 
    anatomyBlueprintRepository,
    bodyGraphService,
    anatomyClothingCache,
    ... 
  }) {
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#bodyGraphService = bodyGraphService;
    this.#cache = anatomyClothingCache;
  }
  
  async getAvailableSlots(entityId) {
    // Check cache first
    const cacheKey = AnatomyClothingCache.createAvailableSlotsKey(entityId);
    const cached = this.#cache.get(CacheKeyTypes.AVAILABLE_SLOTS, cacheKey);
    if (cached) {
      return Array.from(cached.entries());
    }
    
    // Get anatomy data
    const anatomyData = await this.#bodyGraphService.getAnatomyData(entityId);
    if (!anatomyData?.recipeId) {
      return [];
    }
    
    // Get blueprint
    const blueprint = await this.#anatomyBlueprintRepository
      .getBlueprintByRecipeId(anatomyData.recipeId);
      
    if (!blueprint?.clothingSlotMappings) {
      return [];
    }
    
    // Filter by actual anatomy structure
    const availableSlots = await this.#filterByAnatomyStructure(
      entityId,
      blueprint.clothingSlotMappings,
      anatomyData
    );
    
    // Cache result
    this.#cache.set(
      CacheKeyTypes.AVAILABLE_SLOTS, 
      cacheKey, 
      availableSlots
    );
    
    return Array.from(availableSlots.entries());
  }
  
  async #filterByAnatomyStructure(entityId, slotMappings, anatomyData) {
    const availableSlots = new Map();
    
    for (const [slotId, mapping] of Object.entries(slotMappings)) {
      // Check if entity has required anatomy parts
      const hasRequiredParts = await this.#checkAnatomyParts(
        entityId,
        mapping,
        anatomyData
      );
      
      if (hasRequiredParts) {
        availableSlots.set(slotId, mapping);
      }
    }
    
    return availableSlots;
  }
}
```

## Dependency Injection Updates

### Phase 1: Backward Compatible (Current State)
```javascript
// Keep facade registration for backward compatibility
registrar.singletonFactory(tokens.AnatomyClothingIntegrationService, (c) => {
  return new AnatomyClothingIntegrationFacade({
    // ... decomposed services
  });
});
```

### Phase 2: Dual Registration
```javascript
// Add new registrations for updated services
registrar.singletonFactory(tokens.ClothingInstantiationServiceV2, (c) => {
  return new ClothingInstantiationService({
    entityManager: c.resolve(tokens.IEntityManager),
    dataRegistry: c.resolve(tokens.IDataRegistry),
    equipmentOrchestrator: c.resolve(tokens.EquipmentOrchestrator),
    // New decomposed dependencies
    slotResolver: c.resolve(tokens.SlotResolver),
    clothingSlotValidator: c.resolve(tokens.ClothingSlotValidator),
    anatomyBlueprintRepository: c.resolve(tokens.AnatomyBlueprintRepository),
    bodyGraphService: c.resolve(tokens.BodyGraphService),
    layerResolutionService: c.resolve(tokens.LayerResolutionService),
    logger: c.resolve(tokens.ILogger),
    eventBus: c.resolve(tokens.ISafeEventDispatcher),
  });
});

// Replace ClothingManagementService with V2
registrar.singletonFactory(tokens.ClothingManagementService, (c) => {
  return new ClothingManagementServiceV2({
    // ... already supports both architectures
  });
});
```

### Phase 3: Remove Facade
```javascript
// Remove facade registration
// Update all services to use decomposed components directly
```

## Testing Strategy

### Migration Tests

1. **Compatibility Tests**
   - Verify identical behavior between facade and direct usage
   - Test all edge cases and error conditions
   - Validate cache behavior consistency

2. **Performance Tests**
   - Measure performance improvements
   - Validate O(1) lookup performance
   - Test memory usage patterns

3. **Integration Tests**
   - Test anatomy generation workflow
   - Test clothing equipment workflows
   - Test UI interactions

### Test Implementation

```javascript
describe('ClothingInstantiationService Migration', () => {
  let facadeService;
  let directService;
  
  beforeEach(() => {
    // Setup both versions
    facadeService = createServiceWithFacade();
    directService = createServiceWithDirectDeps();
  });
  
  it('should produce identical results for slot validation', async () => {
    const facadeResult = await facadeService.validateSlot(...);
    const directResult = await directService.validateSlot(...);
    
    expect(directResult).toEqual(facadeResult);
  });
  
  it('should maintain performance improvements', async () => {
    const startFacade = performance.now();
    await facadeService.performOperation();
    const facadeTime = performance.now() - startFacade;
    
    const startDirect = performance.now();
    await directService.performOperation();
    const directTime = performance.now() - startDirect;
    
    expect(directTime).toBeLessThan(facadeTime * 0.8); // 20% improvement
  });
});
```

## Implementation Timeline

### Phase 1: Preparation (Week 1)
- [x] Complete architecture analysis
- [ ] Create this specification document
- [ ] Update ClothingManagementServiceV2 registration
- [ ] Create migration test suite

### Phase 2: Service Migration (Week 2)
- [ ] Migrate ClothingInstantiationService
- [ ] Update dependency injection for dual registration
- [ ] Run full test suite
- [ ] Performance validation

### Phase 3: Validation (Week 3)
- [ ] Extended testing in development environment
- [ ] Performance benchmarking
- [ ] Documentation updates
- [ ] Team review

### Phase 4: Deprecation (Week 4+)
- [ ] Add deprecation warnings to facade
- [ ] Update remaining dependent code
- [ ] Plan facade removal date
- [ ] Final migration guide

## Migration Examples

### Example 1: Simple Service Update

```javascript
// Before
class MyService {
  constructor({ anatomyClothingIntegrationService }) {
    this.#integration = anatomyClothingIntegrationService;
  }
  
  async doSomething(entityId) {
    const slots = await this.#integration.getAvailableClothingSlots(entityId);
    // Process slots
  }
}

// After
class MyService {
  constructor({ 
    anatomyBlueprintRepository,
    bodyGraphService,
    anatomyClothingCache 
  }) {
    this.#blueprintRepo = anatomyBlueprintRepository;
    this.#bodyGraph = bodyGraphService;
    this.#cache = anatomyClothingCache;
  }
  
  async doSomething(entityId) {
    const slots = await this.#getAvailableSlots(entityId);
    // Process slots
  }
  
  async #getAvailableSlots(entityId) {
    // Implementation from target architecture
  }
}
```

### Example 2: Validation Migration

```javascript
// Before
const result = await this.#integration.validateClothingSlotCompatibility(
  entityId, 
  slotId, 
  itemId
);

// After
const result = await this.#validateSlot(entityId, slotId, itemId);

async #validateSlot(entityId, slotId, itemId) {
  const availableSlots = await this.#getAvailableSlots(entityId);
  const resolveAttachmentPoints = async (entityId, slotId) => {
    return await this.#slotResolver.resolveClothingSlot(entityId, slotId);
  };
  
  return await this.#clothingSlotValidator.validateSlotCompatibility(
    entityId,
    slotId,
    itemId,
    availableSlots,
    resolveAttachmentPoints
  );
}
```

## Benefits of Migration

1. **Performance Improvements**
   - Direct component access reduces overhead
   - O(1) lookups via specialized indices
   - Optimized caching strategies

2. **Better Separation of Concerns**
   - Each component has a single responsibility
   - Easier to test and maintain
   - Clear dependency relationships

3. **Improved Flexibility**
   - Services can use only needed components
   - Custom strategies and optimizations possible
   - Better support for future enhancements

4. **Reduced Coupling**
   - Services no longer depend on monolithic integration service
   - Components can evolve independently
   - Easier to mock and test

## Risk Mitigation

1. **Backward Compatibility**
   - Facade remains available during transition
   - Dual registration supports both approaches
   - Comprehensive migration tests

2. **Performance Validation**
   - Benchmark before and after migration
   - Monitor production metrics
   - Rollback plan if issues detected

3. **Phased Rollout**
   - Migrate one service at a time
   - Validate each phase thoroughly
   - Maintain working system throughout

## Conclusion

This migration represents a significant architectural improvement that will enhance performance, maintainability, and flexibility. By following this specification, the team can safely migrate away from the monolithic integration service while maintaining system stability and backward compatibility.