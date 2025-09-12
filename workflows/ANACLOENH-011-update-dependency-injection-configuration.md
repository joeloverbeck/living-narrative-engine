# ANACLOENH-011: Update Dependency Injection Configuration

## Overview
Update the dependency injection container configuration to register the new facade services, manage service lifecycles, and provide proper dependency resolution for the unified caching and error handling infrastructure.

## Current State
- **DI Tokens**: 344 registered tokens across various registrations
- **Service Registration**: Scattered across multiple registration files
- **Facade Integration**: New facades need proper registration and lifecycle management
- **Dependencies**: Complex dependency graphs between old and new services

## Objectives
1. Register new facade services in the DI container
2. Update existing service registrations for new dependencies
3. Create facade factory registrations
4. Manage service lifecycle and scoping
5. Handle circular dependency resolution
6. Provide backward compatibility during migration

## Technical Requirements

### Updated Token Definitions
```javascript
// Location: src/dependencyInjection/tokens/tokens-facades.js
export const facadeTokens = {
  // Facade tokens
  IClothingSystemFacade: 'IClothingSystemFacade',
  IAnatomySystemFacade: 'IAnatomySystemFacade',
  
  // Facade factories
  IClothingFacadeFactory: 'IClothingFacadeFactory',
  IAnatomyFacadeFactory: 'IAnatomyFacadeFactory'
};

// Location: src/dependencyInjection/tokens/tokens-infrastructure.js
export const infrastructureTokens = {
  // Caching infrastructure
  IUnifiedCache: 'IUnifiedCache',
  ICacheInvalidationManager: 'ICacheInvalidationManager',
  ICacheMetrics: 'ICacheMetrics',
  
  // Error handling
  ICentralErrorHandler: 'ICentralErrorHandler',
  IRecoveryStrategyManager: 'IRecoveryStrategyManager',
  IErrorReporter: 'IErrorReporter',
  
  // Memory monitoring
  IMemoryMonitor: 'IMemoryMonitor',
  IMemoryProfiler: 'IMemoryProfiler',
  IMemoryPressureManager: 'IMemoryPressureManager',
  
  // Performance monitoring
  IPerformanceMetricsCollector: 'IPerformanceMetricsCollector',
  IPerformanceBenchmarkSuite: 'IPerformanceBenchmarkSuite',
  IPerformanceMonitor: 'IPerformanceMonitor'
};
```

### Infrastructure Registration
```javascript
// Location: src/dependencyInjection/registrations/infrastructureRegistrations.js
import { infrastructureTokens } from '../tokens/tokens-infrastructure.js';
import UnifiedCache from '../../common/cache/UnifiedCache.js';
import CacheInvalidationManager from '../../common/cache/CacheInvalidationManager.js';
import CentralErrorHandler from '../../common/errors/CentralErrorHandler.js';
import MemoryMonitor from '../../common/monitoring/MemoryMonitor.js';
import PerformanceMetricsCollector from '../../common/metrics/PerformanceMetricsCollector.js';

export function registerInfrastructureServices(container) {
  // Cache infrastructure
  container.register(infrastructureTokens.IUnifiedCache, ({ logger, eventBus }) => {
    return new UnifiedCache({
      maxSize: 1000,
      ttl: 300000,
      enablePriority: true,
      enableMetrics: true,
      logger,
      eventBus
    });
  }, { singleton: true });
  
  container.register(infrastructureTokens.ICacheInvalidationManager, ({ eventBus, logger }) => {
    const manager = new CacheInvalidationManager({ eventBus, logger });
    
    // Register caches for invalidation
    const cache = container.resolve(infrastructureTokens.IUnifiedCache);
    manager.registerCache('unified', cache);
    
    return manager;
  }, { singleton: true });
  
  // Error handling infrastructure
  container.register(infrastructureTokens.ICentralErrorHandler, ({ logger, eventBus }) => {
    return new CentralErrorHandler({
      logger,
      eventBus,
      metricsCollector: container.resolve(infrastructureTokens.IPerformanceMetricsCollector)
    });
  }, { singleton: true });
  
  // Memory monitoring
  container.register(infrastructureTokens.IMemoryMonitor, ({ eventBus, logger }) => {
    return new MemoryMonitor({
      heapThreshold: 0.8,
      samplingInterval: 5000,
      historySize: 1000,
      eventBus,
      logger
    });
  }, { singleton: true });
  
  // Performance monitoring
  container.register(infrastructureTokens.IPerformanceMetricsCollector, ({ eventBus }) => {
    return new PerformanceMetricsCollector({
      historyRetention: 7 * 24 * 60 * 60 * 1000,
      aggregationInterval: 60000,
      eventBus
    });
  }, { singleton: true });
}
```

### Facade Registration
```javascript
// Location: src/dependencyInjection/registrations/facadeRegistrations.js
import { facadeTokens } from '../tokens/tokens-facades.js';
import { infrastructureTokens } from '../tokens/tokens-infrastructure.js';
import { clothingTokens } from '../tokens/tokens-clothing.js';
import { anatomyTokens } from '../tokens/tokens-anatomy.js';
import ClothingSystemFacade from '../../clothing/facades/ClothingSystemFacade.js';
import AnatomySystemFacade from '../../anatomy/facades/AnatomySystemFacade.js';

export function registerFacadeServices(container) {
  // Clothing System Facade
  container.register(facadeTokens.IClothingSystemFacade, (dependencies) => {
    const {
      logger,
      eventBus,
      cache = dependencies[infrastructureTokens.IUnifiedCache],
      circuitBreaker = dependencies[infrastructureTokens.ICentralErrorHandler],
      accessibilityService = dependencies[clothingTokens.IClothingAccessibilityService],
      managementService = dependencies[clothingTokens.IClothingManagementService],
      instantiationService = dependencies[clothingTokens.IClothingInstantiationService],
      equipmentDescriptionService = dependencies[clothingTokens.IEquipmentDescriptionService],
      layerResolutionService = dependencies[clothingTokens.ILayerResolutionService],
      equipmentOrchestrator = dependencies[clothingTokens.IEquipmentOrchestrator],
      clothingValidator = dependencies[clothingTokens.IClothingValidator],
      entityManager = dependencies[coreTokens.IEntityManager]
    } = dependencies;
    
    return new ClothingSystemFacade({
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
    });
  }, { 
    singleton: true,
    dependencies: [
      coreTokens.ILogger,
      coreTokens.IEventBus,
      infrastructureTokens.IUnifiedCache,
      infrastructureTokens.ICentralErrorHandler,
      clothingTokens.IClothingAccessibilityService,
      clothingTokens.IClothingManagementService,
      clothingTokens.IClothingInstantiationService,
      clothingTokens.IEquipmentDescriptionService,
      clothingTokens.ILayerResolutionService,
      clothingTokens.IEquipmentOrchestrator,
      clothingTokens.IClothingValidator,
      coreTokens.IEntityManager
    ]
  });
  
  // Anatomy System Facade
  container.register(facadeTokens.IAnatomySystemFacade, (dependencies) => {
    const {
      logger,
      eventBus,
      cache = dependencies[infrastructureTokens.IUnifiedCache],
      circuitBreaker = dependencies[infrastructureTokens.ICentralErrorHandler],
      socketIndex = dependencies[anatomyTokens.IAnatomySocketIndex],
      graphBuilder = dependencies[anatomyTokens.IAnatomyGraphBuilder],
      graphValidator = dependencies[anatomyTokens.IAnatomyGraphValidator],
      partRepository = dependencies[anatomyTokens.IPartRepository],
      descriptionComposer = dependencies[anatomyTokens.IBodyDescriptionComposer],
      constraintValidator = dependencies[anatomyTokens.IConstraintValidator],
      blueprintProcessor = dependencies[anatomyTokens.IBlueprintProcessor],
      anatomyCache = dependencies[anatomyTokens.IAnatomyQueryCache],
      entityManager = dependencies[coreTokens.IEntityManager]
    } = dependencies;
    
    return new AnatomySystemFacade({
      logger,
      eventBus,
      cache,
      circuitBreaker,
      socketIndex,
      graphBuilder,
      graphValidator,
      partRepository,
      descriptionComposer,
      constraintValidator,
      blueprintProcessor,
      anatomyCache,
      entityManager
    });
  }, {
    singleton: true,
    dependencies: [
      coreTokens.ILogger,
      coreTokens.IEventBus,
      infrastructureTokens.IUnifiedCache,
      infrastructureTokens.ICentralErrorHandler,
      anatomyTokens.IAnatomySocketIndex,
      anatomyTokens.IAnatomyGraphBuilder,
      anatomyTokens.IAnatomyGraphValidator,
      anatomyTokens.IPartRepository,
      anatomyTokens.IBodyDescriptionComposer,
      anatomyTokens.IConstraintValidator,
      anatomyTokens.IBlueprintProcessor,
      anatomyTokens.IAnatomyQueryCache,
      coreTokens.IEntityManager
    ]
  });
}
```

### Updated Core Registrations
```javascript
// Location: src/dependencyInjection/registrations/worldAndEntityRegistrations.js
// Existing registrations updated to use new infrastructure

import { registerInfrastructureServices } from './infrastructureRegistrations.js';
import { registerFacadeServices } from './facadeRegistrations.js';

export function registerWorldAndEntityServices(container) {
  // First register infrastructure services
  registerInfrastructureServices(container);
  
  // Register existing services with new infrastructure dependencies
  container.register(tokens.IEntityManager, (dependencies) => {
    const {
      logger,
      eventBus,
      entityRepository,
      componentManager,
      systemRegistry,
      // New facade dependencies
      clothingSystemFacade = dependencies[facadeTokens.IClothingSystemFacade],
      anatomySystemFacade = dependencies[facadeTokens.IAnatomySystemFacade]
    } = dependencies;
    
    return new EntityManager({
      logger,
      eventBus,
      entityRepository,
      componentManager,
      systemRegistry,
      clothingSystem: clothingSystemFacade,
      anatomySystem: anatomySystemFacade
    });
  }, {
    singleton: true,
    dependencies: [
      tokens.ILogger,
      tokens.IEventBus,
      tokens.IEntityRepository,
      tokens.IComponentManager,
      tokens.ISystemRegistry,
      facadeTokens.IClothingSystemFacade,
      facadeTokens.IAnatomySystemFacade
    ]
  });
  
  // Register facade services after core services
  registerFacadeServices(container);
  
  // Update ScopeDsl engine registration
  container.register(tokens.IScopeDslEngine, (dependencies) => {
    const {
      logger,
      eventBus,
      entityManager,
      clothingAccessibilityService, // Keep for backward compatibility
      clothingSystemFacade = dependencies[facadeTokens.IClothingSystemFacade]
    } = dependencies;
    
    return new ScopeDslEngine({
      logger,
      eventBus,
      entityManager,
      // Use facade if available, fallback to service
      clothingSystem: clothingSystemFacade || clothingAccessibilityService
    });
  }, {
    dependencies: [
      tokens.ILogger,
      tokens.IEventBus,
      tokens.IEntityManager,
      tokens.IClothingAccessibilityService,
      facadeTokens.IClothingSystemFacade
    ]
  });
}
```

### Lifecycle Management
```javascript
// Location: src/dependencyInjection/lifecycle/ServiceLifecycleManager.js
class ServiceLifecycleManager {
  constructor(container) {
    this.container = container;
    this.startupOrder = [
      // Infrastructure services first
      infrastructureTokens.IUnifiedCache,
      infrastructureTokens.ICacheInvalidationManager,
      infrastructureTokens.ICentralErrorHandler,
      infrastructureTokens.IMemoryMonitor,
      infrastructureTokens.IPerformanceMetricsCollector,
      
      // Core services
      coreTokens.ILogger,
      coreTokens.IEventBus,
      coreTokens.IEntityManager,
      
      // Domain services
      clothingTokens.IClothingAccessibilityService,
      anatomyTokens.IAnatomySocketIndex,
      
      // Facades last
      facadeTokens.IClothingSystemFacade,
      facadeTokens.IAnatomySystemFacade
    ];
  }
  
  async startup() {
    for (const token of this.startupOrder) {
      try {
        const service = this.container.resolve(token);
        
        // Start services that have startup methods
        if (service && typeof service.start === 'function') {
          await service.start();
        }
        
        console.info(`Service started: ${token}`);
      } catch (error) {
        console.error(`Failed to start service ${token}:`, error);
        throw error;
      }
    }
  }
  
  async shutdown() {
    // Shutdown in reverse order
    for (const token of this.startupOrder.reverse()) {
      try {
        const service = this.container.resolve(token);
        
        if (service && typeof service.stop === 'function') {
          await service.stop();
        }
        
        console.info(`Service stopped: ${token}`);
      } catch (error) {
        console.warn(`Warning during service shutdown ${token}:`, error);
      }
    }
  }
}
```

## Implementation Steps

1. **Create New Token Definitions** (Day 1)
   - Define facade tokens
   - Define infrastructure tokens
   - Update existing token files

2. **Implement Infrastructure Registration** (Day 2)
   - Register caching services
   - Register error handling services
   - Register monitoring services

3. **Create Facade Registration** (Day 3)
   - Register clothing facade
   - Register anatomy facade
   - Handle complex dependencies

4. **Update Existing Registrations** (Day 4)
   - Update EntityManager registration
   - Update ScopeDslEngine registration
   - Add backward compatibility

5. **Implement Lifecycle Management** (Day 5)
   - Create startup sequence
   - Handle service dependencies
   - Add shutdown procedures

6. **Testing and Validation** (Day 6)
   - Test DI container resolution
   - Verify service lifecycles
   - Test backward compatibility

## File Changes

### New Files
- `src/dependencyInjection/tokens/tokens-facades.js`
- `src/dependencyInjection/tokens/tokens-infrastructure.js`
- `src/dependencyInjection/registrations/infrastructureRegistrations.js`
- `src/dependencyInjection/registrations/facadeRegistrations.js`
- `src/dependencyInjection/lifecycle/ServiceLifecycleManager.js`

### Modified Files
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js`
- `src/dependencyInjection/tokens/tokens-core.js`
- `src/dependencyInjection/container.js`
- `src/main.js` - Add lifecycle management

### Test Files
- `tests/unit/dependencyInjection/registrations/infrastructureRegistrations.test.js`
- `tests/unit/dependencyInjection/registrations/facadeRegistrations.test.js`
- `tests/integration/dependencyInjection/containerIntegration.test.js`

## Dependencies
- **Prerequisites**: 
  - ANACLOENH-001 (Unified Cache)
  - ANACLOENH-004 (Error Handling)
  - ANACLOENH-007 (Clothing Facade)
  - ANACLOENH-008 (Anatomy Facade)
- **Internal**: Existing DI container, all service implementations

## Acceptance Criteria
1. ✅ All new services registered in DI container
2. ✅ Facade services resolve correctly with all dependencies
3. ✅ Service lifecycle management works properly
4. ✅ Backward compatibility maintained during transition
5. ✅ Circular dependencies resolved properly
6. ✅ Container startup/shutdown sequences work
7. ✅ All tests pass with new configuration
8. ✅ Performance impact <2% for service resolution

## Testing Requirements

### Unit Tests
- Test each registration function
- Verify token definitions
- Test service factory functions

### Integration Tests
- Test complete container setup
- Verify service dependencies resolve
- Test facade integration

### Lifecycle Tests
- Test startup sequence
- Verify shutdown procedures
- Test error handling during lifecycle

## Risk Assessment

### Risks
1. **Circular dependencies**: Complex service graphs might create cycles
2. **Memory leaks**: Incorrect singleton management
3. **Startup failures**: Service initialization order issues

### Mitigation
1. Use dependency injection analyzer to detect cycles
2. Implement proper service disposal methods
3. Use phased startup with error recovery

## Estimated Effort
- **Token definitions**: 1 day
- **Infrastructure registration**: 1 day
- **Facade registration**: 1 day
- **Update existing**: 1 day
- **Lifecycle management**: 1 day
- **Testing**: 1 day
- **Total**: 6 days

## Success Metrics
- 100% of new services registered correctly
- Zero circular dependency issues
- Container startup time <500ms
- All existing functionality works with new DI setup

## Dependency Graph Visualization
```
Infrastructure Layer:
├─ UnifiedCache
├─ CentralErrorHandler
├─ MemoryMonitor
└─ PerformanceCollector

Core Layer:
├─ Logger → ErrorHandler
├─ EventBus → Cache
└─ EntityManager → Facades

Domain Services:
├─ ClothingServices → Core + Infrastructure
└─ AnatomyServices → Core + Infrastructure

Facade Layer:
├─ ClothingFacade → ClothingServices + Infrastructure
└─ AnatomyFacade → AnatomyServices + Infrastructure

Application Layer:
└─ ScopeDslEngine → Facades + Core
```

## Notes
- Consider implementing service health checks
- Add dependency graph visualization tools
- Implement service metrics collection
- Consider using factory pattern for complex service creation