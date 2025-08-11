# CLIGEN-008: Service Integration

## Overview

Complete the service integration and dependency injection setup for the Clichés Generator, connecting all services through proper IoC container registration and ensuring seamless data flow between components.

## Status

- **Status**: Ready for Implementation
- **Priority**: High
- **Estimated Time**: 4 hours
- **Complexity**: Medium
- **Dependencies**: CLIGEN-007 (Error Handling), CLIGEN-005 (Controller), CLIGEN-003 (ClicheGenerator Service)
- **Blocks**: CLIGEN-009 (UI Implementation)

## Objectives

1. **Connect Service Layers**: Integrate ClicheGenerator with CharacterBuilderService
2. **Configure Dependency Injection**: Register all services in IoC container
3. **Implement Service Orchestration**: Coordinate multi-service workflows
4. **Establish Data Flow**: Ensure proper data transformation between layers
5. **Bootstrap Integration**: Connect with CharacterBuilderBootstrap system

## Technical Architecture

### Service Dependency Graph

```
CharacterBuilderBootstrap
    ├── IoC Container
    │   ├── CharacterBuilderService (extended)
    │   ├── ClicheGenerator (new)
    │   ├── CharacterStorageService (existing)
    │   ├── CharacterDatabase (existing)
    │   ├── LLMService (existing)
    │   └── EventBus (existing)
    └── ClichesGeneratorController
        ├── CharacterBuilderService
        ├── ClicheGenerator
        └── ClicheErrorHandler
```

### Data Flow Architecture

```
User Input → Controller → Validation
    ↓
CharacterBuilderService
    ├── Load Concepts/Directions
    ├── Check Existing Clichés
    └── Trigger Generation
        ↓
ClicheGenerator Service
    ├── Build Prompt
    ├── Call LLM Service
    └── Parse Response
        ↓
CharacterStorageService
    ├── Store in IndexedDB
    └── Update Cache
        ↓
Controller → UI Update
```

## Implementation Tasks

### Task 1: Extend CharacterBuilderService Integration (60 minutes)

**File**: `src/characterBuilder/services/characterBuilderService.js`

Add integration methods to connect with ClicheGenerator:

```javascript
import { ClicheGenerator } from './ClicheGenerator.js';
import {
  ClicheGenerationError,
  ClicheStorageError
} from '../errors/clicheErrors.js';
import { validateClicheData } from '../validators/clicheValidator.js';

// Add to class properties
#clicheGenerator = null;

// Add to constructor or setter
setClicheGenerator(clicheGenerator) {
  validateDependency(clicheGenerator, 'IClicheGenerator');
  this.#clicheGenerator = clicheGenerator;
}

/**
 * Enhanced method: Generate clichés for a thematic direction
 * Orchestrates the complete generation workflow
 */
async generateClichesForDirection(concept, direction) {
  try {
    // Check if clichés already exist
    const existingCliches = await this.getClichesByDirectionId(direction.id);
    if (existingCliches) {
      this.#logger.info(`Clichés already exist for direction ${direction.id}`);
      return existingCliches;
    }

    // Ensure generator is available
    if (!this.#clicheGenerator) {
      throw new ClicheGenerationError(
        'ClicheGenerator service not configured',
        { directionId: direction.id }
      );
    }

    // Dispatch generation started event
    this.#eventBus.dispatch({
      type: 'CLICHE_GENERATION_STARTED',
      payload: {
        directionId: direction.id,
        conceptId: concept.id,
        timestamp: new Date().toISOString()
      }
    });

    // Generate clichés via dedicated service
    const generatedData = await this.#clicheGenerator.generateCliches(
      concept.text,
      {
        title: direction.title,
        description: direction.description,
        coreTension: direction.coreTension
      }
    );

    // Create cliché model
    const cliche = new Cliche({
      directionId: direction.id,
      conceptId: concept.id,
      categories: generatedData.categories,
      tropesAndStereotypes: generatedData.tropesAndStereotypes,
      llmMetadata: generatedData.metadata
    });

    // Validate before storage
    validateClicheData(cliche);

    // Store in database
    const storedCliche = await this.storeCliches(cliche);

    // Dispatch completion event
    this.#eventBus.dispatch({
      type: 'CLICHE_GENERATION_COMPLETED',
      payload: {
        directionId: direction.id,
        clicheId: storedCliche.id,
        timestamp: new Date().toISOString()
      }
    });

    return storedCliche;

  } catch (error) {
    this.#logger.error('Failed to generate clichés:', error);

    // Dispatch failure event
    this.#eventBus.dispatch({
      type: 'CLICHE_GENERATION_FAILED',
      payload: {
        directionId: direction.id,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });

    throw error;
  }
}

/**
 * Enhanced method: Store clichés with transaction support
 */
async storeCliches(cliches) {
  try {
    // Start transaction for atomic operation
    const transaction = await this.#characterStorage.beginTransaction(['cliches']);

    try {
      // Check for existing clichés (enforce one-to-one)
      const existing = await this.getClichesByDirectionId(cliches.directionId);
      if (existing) {
        throw new ClicheStorageError(
          'Clichés already exist for this direction',
          'store',
          { directionId: cliches.directionId }
        );
      }

      // Store the cliché
      const stored = await this.#characterStorage.storeCliche(cliches, transaction);

      // Commit transaction
      await transaction.commit();

      // Update cache
      this.#clicheCache.set(cliches.directionId, stored);

      return stored;

    } catch (error) {
      // Rollback on error
      await transaction.abort();
      throw error;
    }

  } catch (error) {
    this.#logger.error('Failed to store clichés:', error);
    throw new ClicheStorageError(
      'Unable to save clichés',
      'store',
      { originalError: error.message }
    );
  }
}

/**
 * Batch load directions with their clichés
 */
async getDirectionsWithCliches(conceptId) {
  try {
    // Load all directions for concept
    const directions = await this.getThematicDirections(conceptId);

    // Load clichés in parallel
    const clichePromises = directions.map(dir =>
      this.getClichesByDirectionId(dir.id).catch(() => null)
    );

    const cliches = await Promise.all(clichePromises);

    // Combine data
    return directions.map((dir, index) => ({
      ...dir,
      hasCliches: cliches[index] !== null,
      cliches: cliches[index]
    }));

  } catch (error) {
    this.#logger.error('Failed to load directions with clichés:', error);
    throw error;
  }
}
```

### Task 2: Service Dependency Registration (45 minutes)

**File**: `src/dependencyInjection/characterBuilderContainer.js` (create or extend)

```javascript
/**
 * @file IoC container configuration for character builder services
 */

import { Container } from './container.js';
import { CharacterBuilderService } from '../characterBuilder/services/characterBuilderService.js';
import { ClicheGenerator } from '../characterBuilder/services/ClicheGenerator.js';
import { CharacterStorageService } from '../characterBuilder/services/characterStorageService.js';
import { CharacterDatabase } from '../characterBuilder/services/character-database.js';
import { ClicheErrorHandler } from '../characterBuilder/services/clicheErrorHandler.js';
import { LLMService } from '../llms/llmService.js';
import { EventBus } from '../events/eventBus.js';
import { Logger } from '../utils/logger.js';

/**
 * Service tokens for dependency injection
 */
export const CharacterBuilderTokens = {
  // Core services
  ICharacterBuilderService: Symbol('ICharacterBuilderService'),
  ICharacterStorageService: Symbol('ICharacterStorageService'),
  ICharacterDatabase: Symbol('ICharacterDatabase'),

  // Cliché-specific services
  IClicheGenerator: Symbol('IClicheGenerator'),
  IClicheErrorHandler: Symbol('IClicheErrorHandler'),

  // Infrastructure services
  ILLMService: Symbol('ILLMService'),
  IEventBus: Symbol('IEventBus'),
  ILogger: Symbol('ILogger'),
};

/**
 * Configure IoC container for character builder
 */
export function configureCharacterBuilderContainer(existingContainer = null) {
  const container = existingContainer || new Container();

  // Register infrastructure services
  container.register(CharacterBuilderTokens.ILogger, () => {
    return new Logger({
      prefix: '[CharacterBuilder]',
      level: 'info',
    });
  });

  container.register(CharacterBuilderTokens.IEventBus, () => {
    return EventBus.getInstance();
  });

  // Register LLM service
  container.register(CharacterBuilderTokens.ILLMService, () => {
    const logger = container.resolve(CharacterBuilderTokens.ILogger);
    return new LLMService({
      apiUrl: '/llm-proxy',
      logger,
      timeout: 30000,
      maxRetries: 3,
    });
  });

  // Register database
  container.register(CharacterBuilderTokens.ICharacterDatabase, () => {
    const logger = container.resolve(CharacterBuilderTokens.ILogger);
    return new CharacterDatabase({
      dbName: 'CharacterBuilderDB',
      version: 2, // Incremented for cliches store
      logger,
    });
  });

  // Register storage service
  container.register(CharacterBuilderTokens.ICharacterStorageService, () => {
    const database = container.resolve(
      CharacterBuilderTokens.ICharacterDatabase
    );
    const logger = container.resolve(CharacterBuilderTokens.ILogger);
    const eventBus = container.resolve(CharacterBuilderTokens.IEventBus);

    return new CharacterStorageService({
      database,
      logger,
      eventBus,
    });
  });

  // Register ClicheGenerator service
  container.register(CharacterBuilderTokens.IClicheGenerator, () => {
    const llmService = container.resolve(CharacterBuilderTokens.ILLMService);
    const logger = container.resolve(CharacterBuilderTokens.ILogger);
    const eventBus = container.resolve(CharacterBuilderTokens.IEventBus);

    return new ClicheGenerator({
      llmService,
      logger,
      eventBus,
    });
  });

  // Register ClicheErrorHandler
  container.register(CharacterBuilderTokens.IClicheErrorHandler, () => {
    const logger = container.resolve(CharacterBuilderTokens.ILogger);
    const eventBus = container.resolve(CharacterBuilderTokens.IEventBus);

    return new ClicheErrorHandler({
      logger,
      eventBus,
    });
  });

  // Register main CharacterBuilderService with all dependencies
  container.register(CharacterBuilderTokens.ICharacterBuilderService, () => {
    const characterStorage = container.resolve(
      CharacterBuilderTokens.ICharacterStorageService
    );
    const logger = container.resolve(CharacterBuilderTokens.ILogger);
    const eventBus = container.resolve(CharacterBuilderTokens.IEventBus);
    const clicheGenerator = container.resolve(
      CharacterBuilderTokens.IClicheGenerator
    );

    const service = new CharacterBuilderService({
      characterStorage,
      logger,
      eventBus,
    });

    // Inject ClicheGenerator
    service.setClicheGenerator(clicheGenerator);

    return service;
  });

  return container;
}

/**
 * Factory function for creating configured services
 */
export function createCharacterBuilderServices() {
  const container = configureCharacterBuilderContainer();

  return {
    container,
    characterBuilderService: container.resolve(
      CharacterBuilderTokens.ICharacterBuilderService
    ),
    clicheGenerator: container.resolve(CharacterBuilderTokens.IClicheGenerator),
    clicheErrorHandler: container.resolve(
      CharacterBuilderTokens.IClicheErrorHandler
    ),
    storageService: container.resolve(
      CharacterBuilderTokens.ICharacterStorageService
    ),
    eventBus: container.resolve(CharacterBuilderTokens.IEventBus),
    logger: container.resolve(CharacterBuilderTokens.ILogger),
  };
}
```

### Task 3: Bootstrap Integration (60 minutes)

**File**: Update `src/characterBuilder/CharacterBuilderBootstrap.js`

```javascript
import {
  configureCharacterBuilderContainer,
  CharacterBuilderTokens,
} from '../dependencyInjection/characterBuilderContainer.js';
import { ClichesGeneratorController } from '../clichesGenerator/controllers/ClichesGeneratorController.js';

/**
 * Enhanced bootstrap for Clichés Generator page
 */
export class CharacterBuilderBootstrap {
  #container = null;
  #controller = null;
  #services = {};

  /**
   * Bootstrap the application with enhanced service integration
   */
  async bootstrap(config = {}) {
    try {
      const { pageName, controllerClass, additionalServices = {} } = config;

      // Initialize IoC container
      this.#container = configureCharacterBuilderContainer();

      // Register any additional services
      for (const [token, factory] of Object.entries(additionalServices)) {
        this.#container.register(token, factory);
      }

      // Initialize database
      const database = this.#container.resolve(
        CharacterBuilderTokens.ICharacterDatabase
      );
      await database.init();

      // Resolve all required services
      this.#services = {
        characterBuilderService: this.#container.resolve(
          CharacterBuilderTokens.ICharacterBuilderService
        ),
        clicheGenerator: this.#container.resolve(
          CharacterBuilderTokens.IClicheGenerator
        ),
        clicheErrorHandler: this.#container.resolve(
          CharacterBuilderTokens.IClicheErrorHandler
        ),
        storageService: this.#container.resolve(
          CharacterBuilderTokens.ICharacterStorageService
        ),
        eventBus: this.#container.resolve(CharacterBuilderTokens.IEventBus),
        logger: this.#container.resolve(CharacterBuilderTokens.ILogger),
      };

      // Special handling for Clichés Generator
      if (pageName === 'cliches-generator') {
        return this.#bootstrapClichesGenerator(controllerClass);
      }

      // Default controller initialization
      return this.#initializeController(controllerClass);
    } catch (error) {
      console.error('Bootstrap failed:', error);
      throw error;
    }
  }

  /**
   * Bootstrap specifically for Clichés Generator
   */
  async #bootstrapClichesGenerator(controllerClass) {
    try {
      // Ensure we have the right controller
      if (
        !controllerClass ||
        controllerClass.name !== 'ClichesGeneratorController'
      ) {
        throw new Error('Invalid controller for Clichés Generator page');
      }

      // Create controller with all dependencies
      this.#controller = new controllerClass({
        characterBuilderService: this.#services.characterBuilderService,
        clicheGenerator: this.#services.clicheGenerator,
        errorHandler: this.#services.clicheErrorHandler,
        logger: this.#services.logger,
        eventBus: this.#services.eventBus,
        domUtils: DomUtils, // Assuming DomUtils is available
      });

      // Set up global error handling
      this.#setupGlobalErrorHandling();

      // Set up performance monitoring
      this.#setupPerformanceMonitoring();

      // Initialize the controller
      await this.#controller.initialize();

      return {
        controller: this.#controller,
        services: this.#services,
        container: this.#container,
      };
    } catch (error) {
      this.#services.logger?.error(
        'Failed to bootstrap Clichés Generator:',
        error
      );
      throw error;
    }
  }

  /**
   * Set up global error handling
   */
  #setupGlobalErrorHandling() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.#services.logger.error('Unhandled promise rejection:', event.reason);
      this.#services.eventBus.dispatch({
        type: 'GLOBAL_ERROR',
        payload: {
          error: event.reason,
          timestamp: new Date().toISOString(),
        },
      });

      // Prevent default browser handling
      event.preventDefault();
    });

    // Handle general errors
    window.addEventListener('error', (event) => {
      this.#services.logger.error('Global error:', event.error);
      this.#services.eventBus.dispatch({
        type: 'GLOBAL_ERROR',
        payload: {
          error: event.error,
          timestamp: new Date().toISOString(),
        },
      });
    });
  }

  /**
   * Set up performance monitoring
   */
  #setupPerformanceMonitoring() {
    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            // Tasks longer than 50ms
            this.#services.logger.warn('Long task detected:', {
              duration: entry.duration,
              startTime: entry.startTime,
            });
          }
        }
      });

      observer.observe({ entryTypes: ['longtask'] });
    }

    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.#services.eventBus.dispatch({
        type: 'PAGE_VISIBILITY_CHANGED',
        payload: {
          hidden: document.hidden,
          timestamp: new Date().toISOString(),
        },
      });
    });
  }

  /**
   * Cleanup on page unload
   */
  async cleanup() {
    try {
      // Save any pending data
      if (this.#controller?.cleanup) {
        await this.#controller.cleanup();
      }

      // Close database connections
      const database = this.#services.storageService?.database;
      if (database?.close) {
        await database.close();
      }

      // Clear caches
      this.#container?.clear();

      // Remove event listeners
      this.#services.eventBus?.removeAllListeners();
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }
}
```

### Task 4: Update Entry Point (45 minutes)

**File**: `src/cliches-generator-main.js`

```javascript
/**
 * @file Entry point for Clichés Generator page with full service integration
 */

import { CharacterBuilderBootstrap } from './characterBuilder/CharacterBuilderBootstrap.js';
import { ClichesGeneratorController } from './clichesGenerator/controllers/ClichesGeneratorController.js';

// Performance mark for initialization timing
performance.mark('cliches-generator-init-start');

/**
 * Initialize the Clichés Generator application
 */
const initializeApp = async () => {
  const bootstrap = new CharacterBuilderBootstrap();
  let initialized = false;

  try {
    console.log('Initializing Clichés Generator...');

    // Bootstrap with full service integration
    const result = await bootstrap.bootstrap({
      pageName: 'cliches-generator',
      controllerClass: ClichesGeneratorController,
      additionalServices: {
        // Add any page-specific services here if needed
      },
    });

    initialized = true;

    // Performance measurement
    performance.mark('cliches-generator-init-end');
    performance.measure(
      'cliches-generator-initialization',
      'cliches-generator-init-start',
      'cliches-generator-init-end'
    );

    const measure = performance.getEntriesByName(
      'cliches-generator-initialization'
    )[0];
    console.log(
      `Clichés Generator initialized in ${measure.duration.toFixed(2)}ms`
    );

    // Set up cleanup on page unload
    window.addEventListener('beforeunload', async () => {
      await bootstrap.cleanup();
    });

    // Expose controller for debugging (development only)
    if (process.env.NODE_ENV === 'development') {
      window.__clichesController = result.controller;
      window.__clichesServices = result.services;
      console.log('Debug: Controller and services exposed on window object');
    }

    return result;
  } catch (error) {
    console.error('Failed to initialize Clichés Generator:', error);

    // Show user-friendly error
    const errorContainer = document.getElementById(
      'cliches-generator-container'
    );
    if (errorContainer) {
      errorContainer.innerHTML = `
        <div class="cb-error-page">
          <h1>Unable to Load Clichés Generator</h1>
          <p>Something went wrong while loading the page.</p>
          <p class="error-details">${error.message}</p>
          <button onclick="location.reload()" class="cb-btn cb-btn--primary">
            Reload Page
          </button>
        </div>
      `;
    }

    // Clean up if partially initialized
    if (initialized) {
      await bootstrap.cleanup();
    }

    throw error;
  }
};

// Handle DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM already loaded
  initializeApp();
}

// Export for testing
export { initializeApp };
```

### Task 5: Service Orchestration Utilities (30 minutes)

**File**: `src/characterBuilder/services/serviceOrchestrator.js` (new)

```javascript
/**
 * @file Service orchestration utilities for coordinating multi-service operations
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Orchestrates complex multi-service workflows
 */
export class ServiceOrchestrator {
  #services = new Map();
  #logger;
  #eventBus;

  constructor({ logger, eventBus }) {
    this.#logger = logger;
    this.#eventBus = eventBus;
  }

  /**
   * Register a service for orchestration
   */
  registerService(name, service) {
    validateDependency(service, `I${name}`);
    this.#services.set(name, service);
  }

  /**
   * Execute a workflow with multiple services
   */
  async executeWorkflow(workflowName, steps) {
    const context = {
      workflowName,
      startTime: Date.now(),
      results: new Map(),
    };

    try {
      this.#logger.info(`Starting workflow: ${workflowName}`);

      // Dispatch workflow start event
      this.#eventBus.dispatch({
        type: 'WORKFLOW_STARTED',
        payload: { workflowName, timestamp: new Date().toISOString() },
      });

      // Execute each step
      for (const step of steps) {
        const result = await this.#executeStep(step, context);
        context.results.set(step.name, result);
      }

      // Dispatch workflow completion
      this.#eventBus.dispatch({
        type: 'WORKFLOW_COMPLETED',
        payload: {
          workflowName,
          duration: Date.now() - context.startTime,
          timestamp: new Date().toISOString(),
        },
      });

      return context.results;
    } catch (error) {
      this.#logger.error(`Workflow ${workflowName} failed:`, error);

      // Dispatch workflow failure
      this.#eventBus.dispatch({
        type: 'WORKFLOW_FAILED',
        payload: {
          workflowName,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      });

      throw error;
    }
  }

  /**
   * Execute a single workflow step
   */
  async #executeStep(step, context) {
    const { serviceName, method, args = [], transform } = step;

    const service = this.#services.get(serviceName);
    if (!service) {
      throw new Error(`Service '${serviceName}' not found`);
    }

    // Resolve arguments (may reference previous results)
    const resolvedArgs = this.#resolveArguments(args, context);

    // Execute service method
    const result = await service[method](...resolvedArgs);

    // Apply transformation if provided
    if (transform) {
      return transform(result, context);
    }

    return result;
  }

  /**
   * Resolve arguments that may reference context
   */
  #resolveArguments(args, context) {
    return args.map((arg) => {
      if (typeof arg === 'string' && arg.startsWith('$')) {
        // Reference to previous result
        const key = arg.substring(1);
        return context.results.get(key);
      }
      return arg;
    });
  }

  /**
   * Execute parallel service calls
   */
  async executeParallel(operations) {
    const promises = operations.map((op) =>
      this.#executeOperation(op).catch((error) => ({
        error,
        operation: op,
      }))
    );

    const results = await Promise.all(promises);

    // Check for errors
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      this.#logger.error('Parallel execution had errors:', errors);
    }

    return results;
  }

  /**
   * Execute a single operation
   */
  async #executeOperation({ serviceName, method, args = [] }) {
    const service = this.#services.get(serviceName);
    if (!service) {
      throw new Error(`Service '${serviceName}' not found`);
    }

    return service[method](...args);
  }
}

/**
 * Pre-defined workflows for common operations
 */
export const ClicheWorkflows = {
  /**
   * Complete cliché generation workflow
   */
  GENERATE_CLICHES: [
    {
      name: 'loadDirection',
      serviceName: 'CharacterBuilderService',
      method: 'getThematicDirection',
      args: ['$directionId'],
    },
    {
      name: 'loadConcept',
      serviceName: 'CharacterBuilderService',
      method: 'getCharacterConcept',
      args: ['$conceptId'],
    },
    {
      name: 'checkExisting',
      serviceName: 'CharacterBuilderService',
      method: 'getClichesByDirectionId',
      args: ['$directionId'],
    },
    {
      name: 'generate',
      serviceName: 'ClicheGenerator',
      method: 'generateCliches',
      args: ['$loadConcept', '$loadDirection'],
      condition: (context) => !context.results.get('checkExisting'),
    },
    {
      name: 'store',
      serviceName: 'CharacterBuilderService',
      method: 'storeCliches',
      args: ['$generate'],
      condition: (context) => context.results.has('generate'),
    },
  ],
};
```

## Testing Requirements

### Unit Tests

**File**: `tests/unit/dependencyInjection/characterBuilderContainer.test.js`

```javascript
describe('CharacterBuilderContainer', () => {
  it('should register all required services');
  it('should resolve services with dependencies');
  it('should create singleton instances');
  it('should handle circular dependencies');
  it('should allow service overrides');
});
```

**File**: `tests/unit/characterBuilder/services/serviceOrchestrator.test.js`

```javascript
describe('ServiceOrchestrator', () => {
  it('should execute workflows sequentially');
  it('should pass context between steps');
  it('should handle step failures');
  it('should execute parallel operations');
  it('should resolve argument references');
});
```

### Integration Tests

**File**: `tests/integration/clichesGenerator/serviceIntegration.test.js`

```javascript
describe('Clichés Generator Service Integration', () => {
  let bootstrap;
  let services;

  beforeEach(async () => {
    bootstrap = new CharacterBuilderBootstrap();
    const result = await bootstrap.bootstrap({
      pageName: 'cliches-generator',
      controllerClass: ClichesGeneratorController,
    });
    services = result.services;
  });

  afterEach(async () => {
    await bootstrap.cleanup();
  });

  it('should initialize all services correctly');
  it('should coordinate generation workflow');
  it('should handle service communication');
  it('should manage transactions properly');
  it('should clean up resources on shutdown');
});
```

**File**: `tests/integration/clichesGenerator/workflowIntegration.test.js`

```javascript
describe('Cliché Generation Workflow', () => {
  it('should execute complete generation workflow');
  it('should handle existing clichés correctly');
  it('should coordinate LLM service calls');
  it('should store results atomically');
  it('should emit correct events throughout');
});
```

## Success Criteria

- [ ] All services properly registered in IoC container
- [ ] Dependency injection working without circular dependencies
- [ ] Service orchestration handles complex workflows
- [ ] Data flows correctly between all layers
- [ ] Bootstrap system initializes everything correctly
- [ ] Error propagation works across service boundaries
- [ ] Events dispatched at appropriate points
- [ ] Transaction support for atomic operations
- [ ] Clean shutdown releases all resources
- [ ] Performance monitoring integrated

## Performance Targets

| Metric             | Target  | Notes                   |
| ------------------ | ------- | ----------------------- |
| Bootstrap time     | < 500ms | Including database init |
| Service resolution | < 10ms  | Per service             |
| Workflow execution | < 100ms | Excluding LLM calls     |
| Memory usage       | < 50MB  | For service layer       |
| Event dispatch     | < 5ms   | Per event               |

## Dependencies

### Required Files (Must Exist)

- `src/characterBuilder/services/CharacterBuilderService.js`
- `src/characterBuilder/services/ClicheGenerator.js`
- `src/characterBuilder/services/characterStorageService.js`
- `src/characterBuilder/CharacterBuilderBootstrap.js`
- `src/clichesGenerator/controllers/ClichesGeneratorController.js`

### Files to Create

- `src/dependencyInjection/characterBuilderContainer.js`
- `src/characterBuilder/services/serviceOrchestrator.js`

### Files to Modify

- `src/characterBuilder/services/characterBuilderService.js` (add integration methods)
- `src/characterBuilder/CharacterBuilderBootstrap.js` (enhance for clichés)
- `src/cliches-generator-main.js` (update entry point)

## Implementation Notes

1. **Service Lifecycle**: Ensure proper initialization order
2. **Singleton Pattern**: Services should be singletons within container
3. **Lazy Loading**: Initialize services only when needed
4. **Transaction Support**: Implement proper rollback mechanisms
5. **Event Flow**: Maintain consistent event naming and payload structure
6. **Error Boundaries**: Each service should handle its own errors
7. **Performance**: Use caching and batch operations where possible
8. **Testing**: Mock all external dependencies

## Risk Mitigation

| Risk                           | Impact | Mitigation                             |
| ------------------------------ | ------ | -------------------------------------- |
| Circular dependencies          | High   | Use setter injection for circular refs |
| Service initialization failure | High   | Implement fallback services            |
| Memory leaks                   | Medium | Proper cleanup in bootstrap            |
| Performance degradation        | Medium | Lazy loading and caching               |

## Completion Checklist

- [ ] IoC container configured
- [ ] All services registered
- [ ] Dependency injection working
- [ ] Service orchestration implemented
- [ ] Bootstrap system updated
- [ ] Entry point configured
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Documentation updated
- [ ] No memory leaks
- [ ] Performance targets met

---

**Ticket Status**: Ready for implementation
**Next Steps**: Start with container configuration, then service registration, then bootstrap integration
