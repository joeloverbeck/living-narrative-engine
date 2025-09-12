# ANACLOENH-002: Create Base Facade Interfaces

## Overview
Design and implement base facade interfaces that will serve as simplified entry points to the complex clothing and anatomy systems. These facades will reduce the API surface area and provide a clean abstraction layer for consumers.

## Current State
- **Clothing System**: 16 files with 6 services, 1 orchestrator, 2 validators
- **Anatomy System**: 51 files with 20+ service components across multiple layers
- **Issues**: Complex interdependencies, difficult to understand service interactions, high coupling

## Objectives
1. Define clear, minimal facade interfaces for both systems
2. Establish consistent method naming and parameter patterns
3. Create abstract base facade for shared functionality
4. Design extensible architecture for future enhancements
5. Provide clear documentation and usage examples

## Technical Requirements

### Base Facade Abstract Class
```javascript
// Location: src/common/facades/BaseFacade.js
class BaseFacade {
  #logger;
  #eventBus;
  #cache;
  #circuitBreaker;
  
  constructor({ logger, eventBus, cache, circuitBreaker }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['dispatch', 'subscribe']
    });
    
    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#cache = cache;
    this.#circuitBreaker = circuitBreaker;
  }
  
  // Protected methods for subclasses
  async executeWithResilience(operation, fallback)
  async cacheableOperation(key, operation)
  dispatchEvent(type, payload)
  logOperation(level, message, metadata)
}
```

### Clothing System Facade Interface
```javascript
// Location: src/clothing/facades/IClothingSystemFacade.js
/**
 * @interface IClothingSystemFacade
 */
class IClothingSystemFacade {
  // Query operations
  async getAccessibleItems(entityId, options = {})
  async getEquippedItems(entityId, options = {})
  async getItemsInSlot(entityId, slot)
  async checkItemCompatibility(entityId, itemId, slot)
  
  // Modification operations
  async equipItem(entityId, itemId, slot, options = {})
  async unequipItem(entityId, itemId, options = {})
  async swapItems(entityId, itemId1, itemId2)
  async clearSlot(entityId, slot)
  
  // Validation operations
  async validateEquipment(entityId)
  async getBlockedSlots(entityId)
  async getLayerConflicts(entityId)
  
  // Bulk operations
  async equipMultiple(entityId, items)
  async unequipMultiple(entityId, itemIds)
  async transferEquipment(fromEntityId, toEntityId, options = {})
}
```

### Anatomy System Facade Interface
```javascript
// Location: src/anatomy/facades/IAnatomySystemFacade.js
/**
 * @interface IAnatomySystemFacade
 */
class IAnatomySystemFacade {
  // Query operations
  async getBodyParts(entityId, options = {})
  async getBodyGraph(entityId)
  async getPartByType(entityId, partType)
  async getConnectedParts(entityId, partId)
  
  // Modification operations
  async attachPart(entityId, partId, parentPartId, options = {})
  async detachPart(entityId, partId, options = {})
  async replacePart(entityId, oldPartId, newPartId)
  async modifyPart(entityId, partId, modifications)
  
  // Graph operations
  async buildBodyGraph(entityId, blueprint)
  async validateGraph(entityId)
  async getGraphConstraints(entityId)
  
  // Description operations
  async generateDescription(entityId, options = {})
  async getPartDescription(entityId, partId)
  
  // Bulk operations
  async attachMultipleParts(entityId, parts)
  async detachMultipleParts(entityId, partIds)
  async rebuildFromBlueprint(entityId, blueprint)
}
```

## Implementation Steps

1. **Create Base Facade Infrastructure** (Day 1-2)
   - Implement BaseFacade abstract class
   - Add resilience and caching utilities
   - Create facade factory pattern

2. **Define Interface Contracts** (Day 3)
   - Create IClothingSystemFacade interface
   - Create IAnatomySystemFacade interface
   - Define shared types and options objects

3. **Implement Facade Registrations** (Day 4)
   - Create facade registration utilities
   - Add dependency injection tokens
   - Set up facade lifecycle management

4. **Create Facade Documentation** (Day 5)
   - Write comprehensive JSDoc comments
   - Create usage examples
   - Document migration guide from direct service usage

5. **Add Facade Testing Framework** (Day 6)
   - Create facade test utilities
   - Implement mock facades for testing
   - Add contract testing for interfaces

## File Changes

### New Files
- `src/common/facades/BaseFacade.js`
- `src/common/facades/FacadeFactory.js`
- `src/common/facades/FacadeRegistry.js`
- `src/clothing/facades/IClothingSystemFacade.js`
- `src/anatomy/facades/IAnatomySystemFacade.js`
- `src/common/facades/types/FacadeOptions.js`
- `src/common/facades/types/FacadeResponses.js`

### Modified Files
- `src/dependencyInjection/tokens/tokens-core.js` - Add facade tokens
- `src/dependencyInjection/registrations/coreRegistrations.js` - Register facade factory

### Test Files
- `tests/unit/common/facades/BaseFacade.test.js`
- `tests/unit/common/facades/FacadeFactory.test.js`
- `tests/unit/clothing/facades/IClothingSystemFacade.test.js`
- `tests/unit/anatomy/facades/IAnatomySystemFacade.test.js`
- `tests/integration/facades/facadeIntegration.test.js`

## Dependencies
- **Prerequisites**: ANACLOENH-001 (Unified Caching Infrastructure)
- **External**: None
- **Internal**: Logger, EventBus, Cache services

## Acceptance Criteria
1. ✅ Base facade provides resilience and caching capabilities
2. ✅ Clothing facade interface covers all primary use cases
3. ✅ Anatomy facade interface covers all primary use cases
4. ✅ Facades are properly registered in DI container
5. ✅ All methods have comprehensive JSDoc documentation
6. ✅ Mock facades available for testing
7. ✅ Performance overhead < 5% compared to direct service calls
8. ✅ 100% interface method coverage in tests

## Testing Requirements

### Unit Tests
- Test base facade resilience mechanisms
- Verify caching behavior
- Test event dispatching
- Validate error handling

### Integration Tests
- Test facade registration and instantiation
- Verify facade factory patterns
- Test facade lifecycle management

### Contract Tests
- Ensure all interface methods are properly defined
- Validate parameter and return types
- Test optional parameter handling

## Risk Assessment

### Risks
1. **Over-abstraction**: Facades might hide necessary complexity
2. **Performance overhead**: Additional layer could impact performance
3. **Adoption resistance**: Developers comfortable with current approach

### Mitigation
1. Allow direct service access for advanced use cases
2. Benchmark and optimize critical paths
3. Provide clear migration benefits and documentation

## Estimated Effort
- **Development**: 4-6 days
- **Testing**: 2 days
- **Documentation**: 1-2 days
- **Total**: 7-10 days

## Success Metrics
- 60% reduction in API surface area
- 100% of common operations available through facades
- Zero breaking changes for existing consumers
- 90% of new code uses facades instead of direct services

## Notes
- Consider using TypeScript interfaces for better IDE support
- Implement method chaining where appropriate for better DX
- Add deprecation warnings to direct service usage
- Consider creating a facade migration codemod