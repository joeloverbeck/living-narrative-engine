# Unified Page Bootstrap System Specification

## Overview

The Unified Page Bootstrap System is a standardized initialization framework for all character builder pages in the Living Narrative Engine. This system eliminates code duplication, ensures consistent error handling, and simplifies the creation of new character builder pages.

### Purpose

- **Eliminate Duplication**: Reduce ~60% of initialization code duplication across character builder pages
- **Ensure Consistency**: Provide a standardized initialization flow for all pages
- **Simplify Development**: Enable rapid creation of new character builder pages
- **Centralize Configuration**: Manage common dependencies and services in one place
- **Improve Maintainability**: Single point of modification for initialization logic

## Requirements and Design Goals

### Functional Requirements

1. **Unified Initialization**
   - Single entry point for all character builder page initialization
   - Support for both mod-loading and non-mod-loading pages
   - Automatic dependency injection container setup
   - Standardized error handling and display

2. **Service Management**
   - Automatic registration of common character builder services
   - Support for page-specific service registration
   - Proper service lifecycle management

3. **Schema and Event Support**
   - Batch loading of required schemas
   - Event definition registration
   - Support for custom schemas and events per page

4. **Controller Integration**
   - Generic controller instantiation
   - Automatic initialization after bootstrap
   - Error boundary for controller failures

### Non-Functional Requirements

1. **Performance**
   - Bootstrap time < 500ms on average hardware
   - Minimal blocking operations
   - Efficient resource loading

2. **Extensibility**
   - Support for custom initialization steps
   - Hook system for page-specific logic
   - Plugin architecture for additional features

3. **Developer Experience**
   - Clear error messages with actionable guidance
   - Comprehensive logging for debugging
   - Simple API with sensible defaults

4. **Backward Compatibility**
   - Migration path for existing pages
   - No breaking changes to existing APIs
   - Gradual adoption strategy

## Implementation Guidelines

### Core Architecture

```javascript
// src/characterBuilder/CharacterBuilderBootstrap.js
export class CharacterBuilderBootstrap {
  /**
   * Bootstrap a character builder page with standardized initialization
   * @param {BootstrapConfig} config - Configuration object
   * @returns {Promise<BootstrapResult>} Bootstrap result with controller instance
   */
  async bootstrap(config) {
    // Implementation details below
  }
}
```

### Configuration Object Structure

```javascript
/**
 * @typedef {Object} BootstrapConfig
 * @property {string} pageName - Unique identifier for the page
 * @property {Function} controllerClass - Constructor for the page controller
 * @property {boolean} [includeModLoading=false] - Whether to load mod data
 * @property {Array<EventDefinition>} [eventDefinitions=[]] - Custom event definitions
 * @property {Array<string>} [customSchemas=[]] - Additional schema paths to load
 * @property {Object} [services={}] - Page-specific services to register
 * @property {Object} [hooks={}] - Lifecycle hooks for customization
 * @property {Object} [errorDisplay={}] - Custom error display configuration
 */
```

### Implementation Details

#### 1. Bootstrap Flow

```javascript
class CharacterBuilderBootstrap {
  async bootstrap(config) {
    const startTime = performance.now();
    
    try {
      // Step 1: Validate configuration
      this.#validateConfig(config);
      
      // Step 2: Setup container with base services
      const container = await this.#setupContainer(config);
      
      // Step 3: Load schemas (including custom)
      await this.#loadSchemas(container, config);
      
      // Step 4: Register event definitions
      await this.#registerEvents(container, config);
      
      // Step 5: Load mods if required
      if (config.includeModLoading) {
        await this.#loadMods(container);
      }
      
      // Step 6: Register page-specific services
      await this.#registerCustomServices(container, config);
      
      // Step 7: Instantiate controller
      const controller = await this.#createController(container, config);
      
      // Step 8: Initialize controller
      await this.#initializeController(controller, config);
      
      // Step 9: Setup error display
      this.#setupErrorDisplay(container, config);
      
      const bootstrapTime = performance.now() - startTime;
      console.log(`[CharacterBuilderBootstrap] Page '${config.pageName}' bootstrapped in ${bootstrapTime.toFixed(2)}ms`);
      
      return {
        controller,
        container,
        bootstrapTime
      };
      
    } catch (error) {
      this.#handleBootstrapError(error, config);
      throw error;
    }
  }
}
```

#### 2. Container Setup

```javascript
async #setupContainer(config) {
  const container = new Container();
  
  // Register core services
  container.registerSingleton(tokens.ILogger, Logger);
  container.registerSingleton(tokens.IEventBus, EventBus);
  container.registerSingleton(tokens.IDataRegistry, DataRegistry);
  container.registerSingleton(tokens.ISchemaValidator, AjvSchemaValidator);
  
  // Register character builder specific services
  container.registerSingleton(tokens.ICharacterBuilderService, CharacterBuilderService);
  container.registerSingleton(tokens.ISessionManager, SessionManager);
  container.registerSingleton(tokens.IErrorReporter, ErrorReporter);
  
  // Execute pre-container hook if provided
  if (config.hooks?.preContainer) {
    await config.hooks.preContainer(container);
  }
  
  return container;
}
```

#### 3. Schema Loading

```javascript
async #loadSchemas(container, config) {
  const schemaValidator = container.resolve(tokens.ISchemaValidator);
  const logger = container.resolve(tokens.ILogger);
  
  // Base schemas required by all character builder pages
  const baseSchemas = [
    '/data/schemas/character-concept.schema.json',
    '/data/schemas/thematic-direction.schema.json',
    '/data/schemas/ui-state.schema.json'
  ];
  
  // Combine with custom schemas
  const allSchemas = [...baseSchemas, ...(config.customSchemas || [])];
  
  logger.info(`[CharacterBuilderBootstrap] Loading ${allSchemas.length} schemas`);
  
  await schemaValidator.loadSchemas(allSchemas);
}
```

#### 4. Event Registration

```javascript
async #registerEvents(container, config) {
  const dataRegistry = container.resolve(tokens.IDataRegistry);
  const schemaValidator = container.resolve(tokens.ISchemaValidator);
  
  // Base events used by all character builder pages
  const baseEvents = [
    CHARACTER_CONCEPT_CREATED,
    CHARACTER_CONCEPT_UPDATED,
    CHARACTER_CONCEPT_DELETED,
    THEMATIC_DIRECTION_GENERATED,
    THEMATIC_DIRECTION_UPDATED
  ];
  
  // Combine with custom events
  const allEvents = [...baseEvents, ...(config.eventDefinitions || [])];
  
  // Register events
  for (const eventDef of allEvents) {
    await dataRegistry.registerEventDefinition(eventDef, schemaValidator);
  }
}
```

#### 5. Controller Creation and Initialization

```javascript
async #createController(container, config) {
  const { controllerClass } = config;
  
  // Resolve controller dependencies
  const dependencies = {
    logger: container.resolve(tokens.ILogger),
    characterBuilderService: container.resolve(tokens.ICharacterBuilderService),
    eventBus: container.resolve(tokens.IEventBus),
    sessionManager: container.resolve(tokens.ISessionManager),
    ...config.services // Additional page-specific services
  };
  
  // Create controller instance
  return new controllerClass(dependencies);
}

async #initializeController(controller, config) {
  try {
    // Execute pre-init hook
    if (config.hooks?.preInit) {
      await config.hooks.preInit(controller);
    }
    
    // Initialize controller
    await controller.initialize();
    
    // Execute post-init hook
    if (config.hooks?.postInit) {
      await config.hooks.postInit(controller);
    }
    
  } catch (error) {
    throw new Error(`Controller initialization failed: ${error.message}`);
  }
}
```

#### 6. Error Display Setup

```javascript
#setupErrorDisplay(container, config) {
  const errorReporter = container.resolve(tokens.IErrorReporter);
  const eventBus = container.resolve(tokens.IEventBus);
  
  // Configure error display element
  const errorElement = document.getElementById(config.errorDisplay?.elementId || 'error-display');
  
  if (errorElement) {
    errorReporter.setDisplayElement(errorElement);
    
    // Listen for error events
    eventBus.on('SYSTEM_ERROR_OCCURRED', (event) => {
      errorReporter.displayError(event.payload.error);
    });
  }
}
```

### API Documentation

#### Basic Usage

```javascript
// thematic-direction-main.js
import { CharacterBuilderBootstrap } from './characterBuilder/CharacterBuilderBootstrap.js';
import { ThematicDirectionController } from './controllers/ThematicDirectionController.js';
import { CUSTOM_EVENT_DEFINITION } from './events/customEvents.js';

const bootstrap = new CharacterBuilderBootstrap();

const config = {
  pageName: 'thematic-direction-generator',
  controllerClass: ThematicDirectionController,
  includeModLoading: false,
  eventDefinitions: [CUSTOM_EVENT_DEFINITION],
  customSchemas: ['/data/schemas/custom-schema.json']
};

try {
  const { controller, container } = await bootstrap.bootstrap(config);
  console.log('Page initialized successfully');
} catch (error) {
  console.error('Bootstrap failed:', error);
}
```

#### Advanced Usage with Hooks

```javascript
const config = {
  pageName: 'character-concepts-manager',
  controllerClass: CharacterConceptsController,
  includeModLoading: true,
  
  // Custom services
  services: {
    customAnalyzer: container.resolve(tokens.ICustomAnalyzer)
  },
  
  // Lifecycle hooks
  hooks: {
    preContainer: async (container) => {
      // Register additional services before container setup
      container.registerSingleton(tokens.ICustomAnalyzer, CustomAnalyzer);
    },
    
    preInit: async (controller) => {
      // Perform setup before controller initialization
      await controller.loadUserPreferences();
    },
    
    postInit: async (controller) => {
      // Perform actions after controller initialization
      await controller.checkForUpdates();
    }
  },
  
  // Custom error display
  errorDisplay: {
    elementId: 'custom-error-container',
    displayDuration: 5000,
    dismissible: true
  }
};
```

### Error Handling Strategy

#### Error Types and Handling

1. **Configuration Errors**
   - Invalid or missing required configuration properties
   - Handler: Throw immediately with clear message

2. **Dependency Errors**
   - Service resolution failures
   - Handler: Log detailed error, throw with user-friendly message

3. **Resource Loading Errors**
   - Schema or mod loading failures
   - Handler: Continue with partial functionality, display warning

4. **Controller Errors**
   - Initialization or runtime failures
   - Handler: Display error in UI, maintain page stability

#### Error Display Mechanism

```javascript
class ErrorReporter {
  displayError(error) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'cb-error-message';
    errorDiv.innerHTML = `
      <div class="cb-error-icon">⚠️</div>
      <div class="cb-error-text">${this.#formatError(error)}</div>
      <button class="cb-error-dismiss">×</button>
    `;
    
    this.#displayElement.appendChild(errorDiv);
    
    // Auto-dismiss after timeout
    setTimeout(() => errorDiv.remove(), this.#displayDuration);
  }
}
```

## Migration Guide

### Step 1: Identify Current Implementation

Analyze existing page initialization code:

```javascript
// OLD: thematic-direction-main.js
class ThematicDirectionApp {
  constructor() {
    this.container = new Container();
    // Manual setup...
  }
  
  async initialize() {
    // Manual initialization...
  }
}
```

### Step 2: Extract Configuration

Create bootstrap configuration from existing code:

```javascript
// NEW: thematic-direction-main.js
const config = {
  pageName: 'thematic-direction-generator',
  controllerClass: ThematicDirectionController,
  includeModLoading: false,
  eventDefinitions: extractedEventDefinitions,
  customSchemas: extractedSchemas
};
```

### Step 3: Replace Initialization

Replace custom initialization with bootstrap:

```javascript
// Remove old initialization code
// Add bootstrap
const bootstrap = new CharacterBuilderBootstrap();
await bootstrap.bootstrap(config);
```

### Step 4: Update Controller

Ensure controller follows expected interface:

```javascript
class ThematicDirectionController {
  constructor({ logger, characterBuilderService, eventBus }) {
    // Standard constructor
  }
  
  async initialize() {
    // Standard initialization
  }
}
```

### Step 5: Test and Verify

1. Verify all functionality works as before
2. Check error handling displays properly
3. Confirm performance is acceptable
4. Validate all services are available

## Testing Approach

### Unit Tests

```javascript
describe('CharacterBuilderBootstrap', () => {
  it('should bootstrap with minimal configuration', async () => {
    const bootstrap = new CharacterBuilderBootstrap();
    const result = await bootstrap.bootstrap({
      pageName: 'test',
      controllerClass: MockController
    });
    
    expect(result.controller).toBeInstanceOf(MockController);
    expect(result.bootstrapTime).toBeLessThan(500);
  });
  
  it('should handle configuration errors gracefully', async () => {
    const bootstrap = new CharacterBuilderBootstrap();
    
    await expect(bootstrap.bootstrap({}))
      .rejects.toThrow('Missing required configuration');
  });
});
```

### Integration Tests

```javascript
describe('CharacterBuilderBootstrap Integration', () => {
  it('should initialize complete page with all services', async () => {
    // Test with real services and DOM
  });
  
  it('should recover from partial failures', async () => {
    // Test error scenarios
  });
});
```

## Performance Considerations

### Optimization Strategies

1. **Parallel Loading**
   - Load schemas and mods concurrently
   - Use Promise.all() for independent operations

2. **Lazy Loading**
   - Defer non-critical service initialization
   - Load resources on-demand

3. **Caching**
   - Cache parsed schemas
   - Reuse service instances across pages

### Performance Targets

- Bootstrap time: < 500ms
- Memory usage: < 10MB additional
- Time to interactive: < 1s

### Monitoring

```javascript
// Built-in performance monitoring
const performanceMetrics = {
  containerSetup: 0,
  schemaLoading: 0,
  eventRegistration: 0,
  modLoading: 0,
  controllerInit: 0,
  total: 0
};
```

## Future Enhancements

### Phase 2 Considerations

1. **Hot Module Replacement**
   - Support for development mode HMR
   - Preserve state during reloads

2. **Progressive Enhancement**
   - Basic functionality without JavaScript
   - Enhanced features with full bootstrap

3. **Analytics Integration**
   - Page load performance tracking
   - Error rate monitoring
   - User interaction metrics

### Extensibility Points

1. **Plugin System**
   - Allow third-party extensions
   - Standardized plugin API

2. **Theme Support**
   - Dynamic theme loading
   - Per-page theme configuration

3. **Internationalization**
   - Language pack loading
   - Locale-specific initialization

## Conclusion

The Unified Page Bootstrap System provides a robust, extensible foundation for all character builder pages. By centralizing initialization logic, it reduces code duplication by 60% while ensuring consistent behavior and error handling across the application.

Implementation of this system will significantly improve developer productivity, reduce maintenance burden, and provide a better user experience through consistent page behavior and error handling.