# CLIGEN-008: Service Integration

## Overview

Complete the service integration for the Clichés Generator by properly configuring the existing dependency injection system and fixing the entry point to use the correct Bootstrap pattern.

## Status

- **Status**: Ready for Implementation
- **Priority**: High
- **Estimated Time**: 2 hours
- **Complexity**: Low-Medium
- **Dependencies**: CLIGEN-007 (Error Handling), CLIGEN-005 (Controller), CLIGEN-003 (ClicheGenerator Service)
- **Blocks**: CLIGEN-009 (UI Implementation)

## Objectives

1. **Verify Service Integration**: Ensure ClicheGenerator is properly integrated with CharacterBuilderService
2. **Fix Entry Point**: Update cliches-generator-main.js to use correct Bootstrap pattern
3. **Add Error Handling**: Implement any missing error handling classes
4. **Create Tests**: Add integration tests for service coordination
5. **Performance Monitoring**: Add performance metrics if not present

## Technical Architecture

### Actual Service Dependency Graph (Current Implementation)

```
AppContainer (via configureMinimalContainer)
    ├── Core Services (tokens.js)
    │   ├── ILogger
    │   ├── ISafeEventDispatcher
    │   ├── ISchemaValidator
    │   └── ILLMConfigurationManager
    ├── LLM Services (already registered)
    │   ├── LLMAdapter (ConfigurableLLMAdapter)
    │   └── LlmJsonService
    └── Character Builder Services (characterBuilderRegistrations.js)
        ├── CharacterDatabase
        ├── CharacterStorageService
        ├── ThematicDirectionGenerator
        ├── ClicheGenerator (already integrated)
        └── CharacterBuilderService
            └── Receives clicheGenerator in constructor
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

### Task 1: Verify CharacterBuilderService Integration (15 minutes)

**File**: `src/characterBuilder/services/characterBuilderService.js`

**Current Status**: ✅ ALREADY IMPLEMENTED

The service already has the following methods properly implemented:

- `generateClichesForDirection(concept, direction)` - Line 964
- `getClichesByDirectionId(directionId)` - Line 756
- `storeCliches(cliches)` - Line 868
- Constructor already accepts `clicheGenerator` parameter (line 90 in registrations)

**What to verify**:

1. Check that `#clicheGenerator` is properly initialized in constructor
2. Ensure error handling uses proper error classes
3. Verify event dispatching is working correctly

**Note**: The service integration is already complete. The main issue is that the entry point doesn't use the correct Bootstrap pattern.

### Task 2: Fix Entry Point (45 minutes)

**File**: `src/cliches-generator-main.js`

**Current Issues**:

1. The constructor `new CharacterBuilderBootstrap({...})` is incorrect - it doesn't accept config in constructor
2. The `bootstrap.registerService()` method doesn't exist
3. Not using the proper `bootstrap()` method with configuration

**Required Changes**:

```javascript
/**
 * @file Entry point for Clichés Generator page
 */

import { CharacterBuilderBootstrap } from './characterBuilder/CharacterBuilderBootstrap.js';
import { ClichesGeneratorController } from './clichesGenerator/controllers/ClichesGeneratorController.js';

/**
 * Initialize the Clichés Generator application
 */
const initializeApp = async () => {
  const bootstrap = new CharacterBuilderBootstrap();

  try {
    console.log('Initializing Clichés Generator...');

    // Bootstrap with proper configuration
    const result = await bootstrap.bootstrap({
      pageName: 'cliches-generator',
      controllerClass: ClichesGeneratorController,
      customSchemas: ['/data/schemas/cliche.schema.json'],
      eventDefinitions: [
        {
          id: 'core:cliche_generation_started',
          description: 'Fired when cliché generation begins',
          payloadSchema: {
            type: 'object',
            required: ['directionId', 'conceptId'],
            properties: {
              directionId: { type: 'string' },
              conceptId: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
        {
          id: 'core:cliche_generation_completed',
          description: 'Fired when cliché generation completes',
          payloadSchema: {
            type: 'object',
            required: ['directionId', 'clicheId'],
            properties: {
              directionId: { type: 'string' },
              clicheId: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
        {
          id: 'core:cliche_generation_failed',
          description: 'Fired when cliché generation fails',
          payloadSchema: {
            type: 'object',
            required: ['directionId', 'error'],
            properties: {
              directionId: { type: 'string' },
              error: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
      ],
      hooks: {
        postInit: (controller) => {
          // Store controller reference for debugging
          if (process.env.NODE_ENV === 'development') {
            window.__clichesController = controller;
            console.log('Debug: Controller exposed on window object');
          }
        },
      },
    });

    console.log(
      `Clichés Generator initialized in ${result.bootstrapTime.toFixed(2)}ms`
    );

    // Set up cleanup on page unload
    window.addEventListener('beforeunload', async () => {
      if (result.controller?.cleanup) {
        await result.controller.cleanup();
      }
    });

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

### Task 3: Verify Bootstrap Configuration (15 minutes)

**File**: `src/characterBuilder/CharacterBuilderBootstrap.js`

**Current Status**: ✅ ALREADY PROPERLY IMPLEMENTED

The Bootstrap class is already properly implemented with:

- Proper `bootstrap(config)` method that accepts configuration
- Support for custom schemas and event definitions
- Automatic service resolution from the container
- Controller instantiation with all required dependencies
- Error handling and performance monitoring

**No changes needed** - The Bootstrap already handles:

- Container setup via `configureMinimalContainer()`
- Service resolution from registered services
- Controller creation with proper dependencies
- Error display configuration
- Performance monitoring

### Task 4: Add Error Handling Classes (30 minutes)

**File**: `src/characterBuilder/errors/characterBuilderError.js`

Check if `CharacterBuilderError` class properly handles cliché-related errors. The service currently uses this for error handling.

```javascript
/**
 * @file Character builder specific error classes
 */

export class CharacterBuilderError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'CharacterBuilderError';
    this.context = context;
  }
}

// Optionally create specific cliché error classes
export class ClicheGenerationError extends CharacterBuilderError {
  constructor(message, context = {}) {
    super(message, context);
    this.name = 'ClicheGenerationError';
  }
}

export class ClicheStorageError extends CharacterBuilderError {
  constructor(message, operation, context = {}) {
    super(message, { ...context, operation });
    this.name = 'ClicheStorageError';
  }
}
```

**Note**: Service orchestration is not required. The existing CharacterBuilderService already handles the complete cliché generation workflow through its `generateClichesForDirection` method.

## Testing Requirements

### Unit Tests

**File**: `tests/unit/cliches-generator-main.test.js`

```javascript
describe('Clichés Generator Entry Point', () => {
  it('should bootstrap with correct configuration');
  it('should handle initialization errors gracefully');
  it('should set up performance monitoring');
  it('should expose debug objects in development mode');
  it('should clean up on page unload');
});
```

### Integration Tests

**File**: `tests/integration/clichesGenerator/bootstrapIntegration.test.js`

```javascript
describe('Clichés Generator Bootstrap Integration', () => {
  let bootstrap;
  let result;

  beforeEach(async () => {
    bootstrap = new CharacterBuilderBootstrap();
    result = await bootstrap.bootstrap({
      pageName: 'cliches-generator',
      controllerClass: ClichesGeneratorController,
    });
  });

  afterEach(async () => {
    if (result?.controller?.cleanup) {
      await result.controller.cleanup();
    }
  });

  it('should initialize with correct services');
  it('should resolve ClicheGenerator from container');
  it('should create controller with all dependencies');
  it('should handle database initialization');
  it('should set up event handling correctly');
});
```

## Success Criteria

- [ ] Entry point uses correct Bootstrap pattern
- [ ] All services properly registered in existing IoC container
- [ ] ClicheGenerator properly integrated with CharacterBuilderService
- [ ] Controller receives all required dependencies
- [ ] Error handling classes available for cliché operations
- [ ] Events dispatched at appropriate points
- [ ] Performance monitoring working
- [ ] Clean shutdown on page unload
- [ ] User-friendly error display
- [ ] Debug objects exposed in development mode

## Performance Targets

| Metric             | Target  | Notes                   |
| ------------------ | ------- | ----------------------- |
| Bootstrap time     | < 500ms | Including database init |
| Service resolution | < 10ms  | Per service             |
| Workflow execution | < 100ms | Excluding LLM calls     |
| Memory usage       | < 50MB  | For service layer       |
| Event dispatch     | < 5ms   | Per event               |

## Dependencies

### Required Files (Already Exist)

- ✅ `src/characterBuilder/services/CharacterBuilderService.js`
- ✅ `src/characterBuilder/services/ClicheGenerator.js`
- ✅ `src/characterBuilder/services/characterStorageService.js`
- ✅ `src/characterBuilder/CharacterBuilderBootstrap.js`
- ✅ `src/clichesGenerator/controllers/ClichesGeneratorController.js`
- ✅ `src/dependencyInjection/registrations/characterBuilderRegistrations.js`
- ✅ `src/dependencyInjection/tokens.js`

### Files to Modify

- `src/cliches-generator-main.js` - Fix to use correct Bootstrap pattern
- `src/characterBuilder/errors/characterBuilderError.js` - Add cliché-specific error classes (optional)

## Implementation Notes

1. **Use Existing Infrastructure**: The DI system is already in place - don't recreate it
2. **Bootstrap Pattern**: Follow the existing Bootstrap configuration pattern
3. **Service Registration**: Services are already registered in `characterBuilderRegistrations.js`
4. **Error Handling**: Use existing `CharacterBuilderError` or extend it for specific cases
5. **Event System**: Events are already defined and dispatched correctly
6. **Performance**: Bootstrap includes performance monitoring out of the box
7. **Testing**: Focus on integration tests for the entry point

## Risk Mitigation

| Risk                       | Impact | Mitigation                               |
| -------------------------- | ------ | ---------------------------------------- |
| Bootstrap misconfiguration | High   | Follow existing pattern from other pages |
| Missing dependencies       | High   | Container will throw clear errors        |
| Memory leaks               | Low    | Bootstrap handles cleanup automatically  |
| Entry point errors         | Medium | User-friendly error display included     |

## Completion Checklist

- [ ] Verify CharacterBuilderService has cliché methods
- [ ] Update entry point to use Bootstrap correctly
- [ ] Add cliché-specific error classes (optional)
- [ ] Write tests for entry point
- [ ] Test Bootstrap integration
- [ ] Verify performance monitoring works
- [ ] Test error display functionality
- [ ] Confirm cleanup on page unload

---

**Ticket Status**: Ready for implementation
**Next Steps**: Update the entry point file to use the correct Bootstrap pattern, then test the integration
