# ANACLOENH-007: Implement ClothingSystemFacade

## Overview
Implement the concrete ClothingSystemFacade that consolidates all clothing-related services behind a unified interface, reducing complexity and providing a single entry point for clothing operations.

## Current State
- **Services**: 6 separate services (accessibility, management, instantiation, equipment description, layer resolution, orchestration)
- **Complexity**: Direct service dependencies throughout codebase
- **Issues**: Complex service interactions, difficult to mock for testing, high coupling

## Objectives
1. Implement concrete facade following the interface from ANACLOENH-002
2. Consolidate all clothing services behind single interface
3. Simplify error handling and transaction management
4. Add performance optimizations through facade layer
5. Provide backward compatibility during migration

## Technical Requirements

### ClothingSystemFacade Implementation
```javascript
// Location: src/clothing/facades/ClothingSystemFacade.js
import BaseFacade from '../../common/facades/BaseFacade.js';

class ClothingSystemFacade extends BaseFacade {
  #accessibilityService;
  #managementService;
  #instantiationService;
  #equipmentDescriptionService;
  #layerResolutionService;
  #equipmentOrchestrator;
  #clothingValidator;
  #entityManager;
  
  constructor({
    logger,
    eventBus,
    cache,
    circuitBreaker,
    accessibilityService,
    managementService,
    instantiationService,
    equipmentDescriptionService,
    layerResolutionService,
    equipmentOrchestrator,
    clothingValidator,
    entityManager
  }) {
    super({ logger, eventBus, cache, circuitBreaker });
    
    // Validate all dependencies
    validateDependency(accessibilityService, 'IClothingAccessibilityService', logger, {
      requiredMethods: ['getAccessibleItems', 'checkAccessibility']
    });
    // ... validate other services
    
    this.#accessibilityService = accessibilityService;
    this.#managementService = managementService;
    // ... assign other services
  }
  
  // Query Operations
  async getAccessibleItems(entityId, options = {}) {
    const { mode = 'all', includeBlocked = false } = options;
    
    return await this.executeWithResilience(
      async () => {
        const cacheKey = `clothing:${entityId}:accessible:${mode}`;
        
        return await this.cacheableOperation(cacheKey, async () => {
          const items = await this.#accessibilityService.getAccessibleItems(
            entityId, 
            mode
          );
          
          if (!includeBlocked) {
            return this.#filterBlockedItems(items);
          }
          
          return items;
        });
      },
      [] // fallback to empty array
    );
  }
  
  async getEquippedItems(entityId, options = {}) {
    const { groupBySlot = false, includeMetadata = false } = options;
    
    return await this.executeWithResilience(
      async () => {
        const entity = await this.#entityManager.getEntity(entityId);
        const equipment = entity.components?.equipment?.data || {};
        
        if (groupBySlot) {
          return equipment;
        }
        
        const items = this.#flattenEquipment(equipment);
        
        if (includeMetadata) {
          return await this.#enrichWithMetadata(items);
        }
        
        return items;
      },
      {}
    );
  }
  
  // Modification Operations
  async equipItem(entityId, itemId, slot, options = {}) {
    const { 
      force = false, 
      validateCompatibility = true,
      transaction = null 
    } = options;
    
    return await this.executeWithResilience(
      async () => {
        // Start transaction if not provided
        const txn = transaction || await this.#beginTransaction(entityId);
        
        try {
          // Validation phase
          if (validateCompatibility && !force) {
            const compatible = await this.checkItemCompatibility(
              entityId, 
              itemId, 
              slot
            );
            
            if (!compatible.isCompatible) {
              throw new ClothingValidationError(
                `Item ${itemId} is not compatible with slot ${slot}`,
                'SLOT_INCOMPATIBLE',
                { entityId, itemId, slot, reasons: compatible.reasons }
              );
            }
          }
          
          // Clear conflicts if forcing
          if (force) {
            await this.#clearConflictingItems(entityId, itemId, slot, txn);
          }
          
          // Equip the item
          const result = await this.#equipmentOrchestrator.equipItem(
            entityId,
            itemId,
            slot,
            txn
          );
          
          // Invalidate caches
          this.#invalidateEntityCaches(entityId);
          
          // Commit transaction
          if (!transaction) {
            await txn.commit();
          }
          
          // Dispatch event
          this.dispatchEvent('CLOTHING_EQUIPPED', {
            entityId,
            itemId,
            slot,
            result
          });
          
          return result;
        } catch (error) {
          if (!transaction) {
            await txn.rollback();
          }
          throw error;
        }
      },
      null
    );
  }
  
  // Validation Operations
  async checkItemCompatibility(entityId, itemId, slot) {
    return await this.cacheableOperation(
      `clothing:${entityId}:compat:${itemId}:${slot}`,
      async () => {
        const validationResults = await Promise.all([
          this.#clothingValidator.validateSlot(slot, itemId),
          this.#layerResolutionService.checkLayerCompatibility(
            entityId, 
            itemId, 
            slot
          ),
          this.#checkAnatomyCompatibility(entityId, slot)
        ]);
        
        const isCompatible = validationResults.every(r => r.valid);
        const reasons = validationResults
          .filter(r => !r.valid)
          .map(r => r.reason);
        
        return {
          isCompatible,
          reasons,
          suggestions: this.#generateCompatibilitySuggestions(reasons)
        };
      }
    );
  }
  
  // Bulk Operations
  async equipMultiple(entityId, items) {
    const txn = await this.#beginTransaction(entityId);
    const results = { success: [], failed: [] };
    
    try {
      // Sort by priority to minimize conflicts
      const sortedItems = this.#sortByEquipPriority(items);
      
      for (const { itemId, slot, options } of sortedItems) {
        try {
          const result = await this.equipItem(
            entityId, 
            itemId, 
            slot,
            { ...options, transaction: txn }
          );
          results.success.push({ itemId, slot, result });
        } catch (error) {
          results.failed.push({ 
            itemId, 
            slot, 
            error: error.message 
          });
          
          if (!options?.continueOnError) {
            throw error;
          }
        }
      }
      
      await txn.commit();
      return results;
    } catch (error) {
      await txn.rollback();
      throw error;
    }
  }
  
  // Private helper methods
  #flattenEquipment(equipment) {
    const items = [];
    for (const [slot, slotItems] of Object.entries(equipment)) {
      if (Array.isArray(slotItems)) {
        items.push(...slotItems.map(item => ({ ...item, slot })));
      } else if (slotItems) {
        items.push({ ...slotItems, slot });
      }
    }
    return items;
  }
  
  #invalidateEntityCaches(entityId) {
    const patterns = [
      `clothing:${entityId}:*`,
      `validation:${entityId}:*`
    ];
    
    patterns.forEach(pattern => this.cache.invalidate(pattern));
  }
  
  async #beginTransaction(entityId) {
    // Implementation would depend on transaction system
    return {
      entityId,
      operations: [],
      commit: async () => { /* commit logic */ },
      rollback: async () => { /* rollback logic */ }
    };
  }
}

export default ClothingSystemFacade;
```

### Facade Factory
```javascript
// Location: src/clothing/facades/ClothingFacadeFactory.js
class ClothingFacadeFactory {
  static create(container) {
    return new ClothingSystemFacade({
      logger: container.resolve(tokens.ILogger),
      eventBus: container.resolve(tokens.IEventBus),
      cache: container.resolve(tokens.IUnifiedCache),
      circuitBreaker: container.resolve(tokens.ICircuitBreaker),
      accessibilityService: container.resolve(tokens.IClothingAccessibilityService),
      managementService: container.resolve(tokens.IClothingManagementService),
      instantiationService: container.resolve(tokens.IClothingInstantiationService),
      equipmentDescriptionService: container.resolve(tokens.IEquipmentDescriptionService),
      layerResolutionService: container.resolve(tokens.ILayerResolutionService),
      equipmentOrchestrator: container.resolve(tokens.IEquipmentOrchestrator),
      clothingValidator: container.resolve(tokens.IClothingValidator),
      entityManager: container.resolve(tokens.IEntityManager)
    });
  }
}
```

## Implementation Steps

1. **Implement Core Facade** (Day 1-2)
   - Create ClothingSystemFacade class
   - Implement query operations
   - Add caching layer

2. **Add Modification Operations** (Day 3-4)
   - Implement equip/unequip methods
   - Add transaction support
   - Create rollback mechanisms

3. **Implement Validation** (Day 5)
   - Add compatibility checking
   - Implement validation caching
   - Create suggestion system

4. **Add Bulk Operations** (Day 6)
   - Implement batch equip/unequip
   - Add priority sorting
   - Handle partial failures

5. **Create Factory and Registration** (Day 7)
   - Implement facade factory
   - Register in DI container
   - Add lifecycle management

## File Changes

### New Files
- `src/clothing/facades/ClothingSystemFacade.js`
- `src/clothing/facades/ClothingFacadeFactory.js`
- `src/clothing/facades/helpers/TransactionManager.js`
- `src/clothing/facades/helpers/CompatibilityAnalyzer.js`

### Modified Files
- `src/dependencyInjection/registrations/clothingRegistrations.js` - Register facade
- `src/dependencyInjection/tokens/tokens-clothing.js` - Add facade token

### Test Files
- `tests/unit/clothing/facades/ClothingSystemFacade.test.js`
- `tests/integration/clothing/facades/clothingFacade.integration.test.js`
- `tests/performance/clothing/facades/facadePerformance.test.js`

## Dependencies
- **Prerequisites**: 
  - ANACLOENH-001 (Unified Cache)
  - ANACLOENH-002 (Base Facade)
  - ANACLOENH-004 (Error Handling)
- **External**: None
- **Internal**: All clothing services, EntityManager

## Acceptance Criteria
1. ✅ All facade methods implemented and functional
2. ✅ Transaction support works correctly
3. ✅ Caching reduces service calls by >50%
4. ✅ Error handling provides clear feedback
5. ✅ Bulk operations handle partial failures
6. ✅ Performance overhead <5%
7. ✅ Backward compatibility maintained
8. ✅ 95% test coverage achieved

## Testing Requirements

### Unit Tests
- Test each facade method
- Verify caching behavior
- Test transaction rollback
- Validate error handling

### Integration Tests
- Test with real services
- Verify event dispatching
- Test bulk operations
- Validate cache invalidation

### Performance Tests
- Measure facade overhead
- Test caching effectiveness
- Benchmark bulk operations

## Risk Assessment

### Risks
1. **Service coupling**: Facade depends on many services
2. **Transaction complexity**: Distributed transactions are hard
3. **Cache coherence**: Complex invalidation patterns

### Mitigation
1. Use dependency injection for loose coupling
2. Implement saga pattern for complex transactions
3. Use event-based cache invalidation

## Estimated Effort
- **Development**: 6-7 days
- **Testing**: 2-3 days
- **Integration**: 1 day
- **Total**: 9-11 days

## Success Metrics
- 60% reduction in direct service usage
- 50% improvement in test complexity
- 30% reduction in clothing-related bugs
- 100% of new features use facade

## Notes
- Consider implementing method chaining for better DX
- Add telemetry for usage analytics
- Create migration guide for existing code
- Consider GraphQL resolver integration