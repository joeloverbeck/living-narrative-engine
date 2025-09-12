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
- [ ] Register after entity manager and logger dependencies

### 3. Service Integration
- [ ] Register service as standalone dependency
- [ ] Services remain loosely coupled
- [ ] No direct service-to-service dependencies needed

## Implementation Details

### Step 1: Add Token
```javascript
// src/dependencyInjection/tokens/tokens-core.js
// Add after line 87 (ClothingManagementService)

export const coreTokens = freeze({
  // ... existing tokens ...
  ClothingManagementService: 'ClothingManagementService',
  ClothingAccessibilityService: 'ClothingAccessibilityService', // NEW
  EquipmentOrchestrator: 'EquipmentOrchestrator',
  // ... rest of tokens ...
});
```

### Step 2: Register Service
```javascript
// src/dependencyInjection/registrations/worldAndEntityRegistrations.js
// Add import at top of file
import { ClothingAccessibilityService } from '../../clothing/services/clothingAccessibilityService.js';

// Add after ClothingManagementService registration (around line 663)

// Register ClothingAccessibilityService
registrar.singletonFactory(tokens.ClothingAccessibilityService, (c) => {
  const entityManager = c.resolve(tokens.IEntityManager);
  const logger = c.resolve(tokens.ILogger);
  
  return new ClothingAccessibilityService({
    logger,
    entityManager,
    entitiesGateway: entityManager // Use EntityManager directly as gateway
  });
});

logger.debug(
  `World and Entity Registration: Registered ${String(
    tokens.ClothingAccessibilityService
  )}.`
);
```

### Step 3: Verify Registration Location
```javascript
// src/dependencyInjection/registrations/worldAndEntityRegistrations.js
// The service will be registered as a standalone service
// Services remain loosely coupled - no direct integration needed
```

## Testing Requirements

### Integration Test
```javascript
// tests/integration/clothing/clothingAccessibilityServiceDI.integration.test.js

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { Registrar } from '../../../src/utils/registrarHelpers.js';
import { ClothingAccessibilityService } from '../../../src/clothing/services/clothingAccessibilityService.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

describe('ClothingAccessibilityService DI Integration', () => {
  let container;
  let accessibilityService;
  
  beforeEach(async () => {
    container = new AppContainer();
    const registrar = new Registrar(container);
    
    // Register minimal dependencies
    const logger = new ConsoleLogger(LogLevel.ERROR);
    registrar.instance(tokens.ILogger, logger);
    
    // Create mock entity manager
    const mockEntityManager = {
      getComponent: jest.fn().mockReturnValue(null),
    };
    registrar.instance(tokens.IEntityManager, mockEntityManager);
    
    // Register ClothingAccessibilityService
    registrar.singletonFactory(tokens.ClothingAccessibilityService, (c) => {
      return new ClothingAccessibilityService({
        logger: c.resolve(tokens.ILogger),
        entityManager: c.resolve(tokens.IEntityManager),
        entitiesGateway: c.resolve(tokens.IEntityManager),
      });
    });
    
    accessibilityService = container.resolve(tokens.ClothingAccessibilityService);
  });
  
  afterEach(() => {
    if (container) {
      container = null;
    }
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
  
  it('should use EntityManager as entitiesGateway', () => {
    // Should be able to call service methods without errors
    expect(() => {
      accessibilityService.getAccessibleItems('test-entity', {});
    }).not.toThrow();
  });
});
```

### Manual Testing Steps
1. Start the application
2. Verify no DI registration errors in console
3. Verify ClothingAccessibilityService can be resolved from container
4. Test that service methods work without throwing errors

## Success Metrics
- [ ] Token added to tokens-core.js
- [ ] Service registered in DI container
- [ ] No circular dependency issues
- [ ] Service resolves correctly from container
- [ ] Integration tests pass
- [ ] Application starts without errors

## Notes
- Register after entity manager and logger are available
- Use singleton lifecycle for service instance
- Use EntityManager directly as entitiesGateway parameter
- Services remain loosely coupled through event system