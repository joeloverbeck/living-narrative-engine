# CLOREMLOG-005-05: Register Service in Dependency Injection

## Overview
**Parent**: CLOREMLOG-005  
**Priority**: High  
**Estimated Effort**: 1.5 hours  
**Dependencies**: CLOREMLOG-005-01 through CLOREMLOG-005-04  
**Blocks**: CLOREMLOG-005-06, CLOREMLOG-005-07

## Problem Statement
The ClothingAccessibilityService needs to be registered in the dependency injection container to be available throughout the application.

## Acceptance Criteria

### 1. Add DI Token
- [ ] Add `ClothingAccessibilityService` token to `tokens-core.js`
- [ ] Follow existing token naming conventions
- [ ] Place after other clothing service tokens

### 2. Register Service Factory
- [ ] Add service registration in `worldAndEntityRegistrations.js`
- [ ] Configure as singleton instance
- [ ] Wire up all required dependencies
- [ ] Register after coverage analyzer dependencies

### 3. Update Dependent Services
- [ ] Update `ClothingManagementService` to accept accessibility service
- [ ] Update `ArrayIterationResolver` to accept accessibility service
- [ ] Maintain backward compatibility during transition

## Implementation Details

### Step 1: Add Token
```javascript
// src/dependencyInjection/tokens/tokens-core.js
// Add after line 96 (existing clothing services)

export const coreTokens = freeze({
  // ... existing tokens ...
  ClothingManagementService: 'ClothingManagementService',
  ClothingAccessibilityService: 'ClothingAccessibilityService', // NEW
  EquipmentOrchestrator: 'EquipmentOrchestrator',
  // ... rest of tokens ...
});
```

### Step 2: Create EntitiesGateway Adapter
```javascript
// src/dependencyInjection/registrations/worldAndEntityRegistrations.js
// Add helper class before registration section

/**
 * Adapter to provide IEntitiesGateway interface for coverage analyzer
 * @private
 */
class EntitiesGatewayAdapter {
  #entityManager;
  
  constructor(entityManager) {
    this.#entityManager = entityManager;
  }
  
  getComponentData(entityId, componentId) {
    return this.#entityManager.getComponent(entityId, componentId);
  }
}
```

### Step 3: Register Service
```javascript
// src/dependencyInjection/registrations/worldAndEntityRegistrations.js
// Add after ClothingManagementService registration (around line 570)

// Register ClothingAccessibilityService
registrar.singletonFactory(tokens.ClothingAccessibilityService, (c) => {
  const entityManager = c.resolve(tokens.IEntityManager);
  const logger = c.resolve(tokens.ILogger);
  
  // Create entities gateway adapter for coverage analyzer
  const entitiesGateway = new EntitiesGatewayAdapter(entityManager);
  
  // Import is at top of file
  const { ClothingAccessibilityService } = await import(
    '../../clothing/services/clothingAccessibilityService.js'
  );
  
  return new ClothingAccessibilityService({
    logger,
    entityManager,
    entitiesGateway
  });
});

logger.debug(
  `World and Entity Registration: Registered ${String(
    tokens.ClothingAccessibilityService
  )}.`
);
```

### Step 4: Update ClothingManagementService
```javascript
// src/clothing/services/clothingManagementService.js
// Update constructor to accept optional accessibility service

export class ClothingManagementService {
  // Add new private field
  /** @type {object|null} */
  #accessibilityService;
  
  constructor({
    entityManager,
    logger,
    eventDispatcher,
    equipmentOrchestrator,
    anatomyBlueprintRepository,
    clothingSlotValidator,
    bodyGraphService,
    anatomyClothingCache,
    clothingAccessibilityService // NEW optional parameter
  }) {
    // ... existing validation ...
    
    // Store accessibility service if provided
    this.#accessibilityService = clothingAccessibilityService || null;
    
    if (this.#accessibilityService) {
      this.#logger.info(
        'ClothingManagementService: Using unified accessibility service'
      );
    }
  }
  
  // Add delegating method for compatibility
  /**
   * Get accessible clothing items
   * @param {string} entityId - Entity ID
   * @param {object} options - Query options
   * @returns {Array} Accessible items
   */
  getAccessibleClothing(entityId, options = {}) {
    if (this.#accessibilityService) {
      return this.#accessibilityService.getAccessibleItems(entityId, options);
    }
    
    // Fallback to basic implementation
    this.#logger.warn('No accessibility service available, returning all items');
    const equipment = this.#entityManager.getComponent(entityId, 'clothing:equipment');
    if (!equipment || !equipment.equipped) {
      return [];
    }
    
    // Simple fallback - return all item IDs
    const items = [];
    for (const slot of Object.values(equipment.equipped)) {
      for (const itemId of Object.values(slot)) {
        if (itemId) items.push(itemId);
      }
    }
    return items;
  }
}
```

### Step 5: Update Registration to Include Service
```javascript
// src/dependencyInjection/registrations/worldAndEntityRegistrations.js
// Update ClothingManagementService registration to include accessibility service

registrar.singletonFactory(tokens.ClothingManagementService, (c) => {
  return new ClothingManagementService({
    entityManager: c.resolve(tokens.IEntityManager),
    logger: c.resolve(tokens.ILogger),
    eventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    equipmentOrchestrator: c.resolve(tokens.EquipmentOrchestrator),
    anatomyBlueprintRepository: c.resolve(tokens.IAnatomyBlueprintRepository),
    clothingSlotValidator: c.resolve(tokens.ClothingSlotValidator),
    bodyGraphService: c.resolve(tokens.BodyGraphService),
    anatomyClothingCache: c.resolve(tokens.AnatomyClothingCache),
    clothingAccessibilityService: c.resolve(tokens.ClothingAccessibilityService) // NEW
  });
});
```

## Testing Requirements

### Integration Test
```javascript
// tests/integration/clothing/clothingAccessibilityServiceDI.integration.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import { setupTestContainer } from '../../common/testContainerSetup.js';

describe('ClothingAccessibilityService DI Integration', () => {
  let container;
  let accessibilityService;
  let clothingManagementService;
  
  beforeEach(async () => {
    container = await setupTestContainer();
    accessibilityService = container.resolve('ClothingAccessibilityService');
    clothingManagementService = container.resolve('ClothingManagementService');
  });
  
  it('should resolve ClothingAccessibilityService from container', () => {
    expect(accessibilityService).toBeDefined();
    expect(accessibilityService.getAccessibleItems).toBeDefined();
  });
  
  it('should wire up dependencies correctly', () => {
    // Service should be functional
    const result = accessibilityService.getAccessibleItems('test-entity');
    expect(Array.isArray(result)).toBe(true);
  });
  
  it('should inject into ClothingManagementService', () => {
    expect(clothingManagementService.getAccessibleClothing).toBeDefined();
    
    // Should delegate to accessibility service
    const spy = jest.spyOn(accessibilityService, 'getAccessibleItems');
    clothingManagementService.getAccessibleClothing('test-entity');
    expect(spy).toHaveBeenCalled();
  });
});
```

### Manual Testing Steps
1. Start the application
2. Verify no DI registration errors in console
3. Test clothing removal functionality still works
4. Check that Layla Agirre scenario behaves correctly

## Success Metrics
- [ ] Token added to tokens-core.js
- [ ] Service registered in DI container
- [ ] No circular dependency issues
- [ ] ClothingManagementService integration working
- [ ] Integration tests pass
- [ ] Application starts without errors

## Notes
- Register after entity manager and logger are available
- Use singleton lifecycle for service instance
- EntitiesGateway adapter provides compatibility layer
- Backward compatibility maintained through optional injection