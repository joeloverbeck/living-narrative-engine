# CLIGEN-006: State Management & Data Flow

## Summary

Documentation of the current state management and data flow implementation in the Clichés Generator. The controller manages state through private fields and handles data flow directly through its methods, extending the base character builder controller functionality.

## Status

- **Type**: Documentation (Current Implementation)
- **Priority**: N/A (Documenting existing code)
- **Complexity**: Low
- **Dependencies**: CLIGEN-005 (Controller Implementation)

## Current Implementation Overview

### State Management Approach

The Clichés Generator uses a straightforward state management approach:

1. **Private Fields** - State stored in controller's private fields
2. **Direct Management** - Controller manages state directly without intermediary
3. **UI State Manager** - Inherits UI state management from base class
4. **Event Bus** - Uses EventBus for event-driven communication
5. **No Persistence** - State exists only during page lifecycle

### Key Components

- `ClichesGeneratorController` - Main controller extending BaseCharacterBuilderController
- `BaseCharacterBuilderController` - Provides shared UI state management
- `UIStateManager` - Manages loading, error, and display states
- `EventBus` - Handles event dispatching and subscriptions

## Technical Specification

### 1. Controller State Management

#### File: `src/clichesGenerator/controllers/ClichesGeneratorController.js`

```javascript
/**
 * Current state management implementation
 */
export class ClichesGeneratorController extends BaseCharacterBuilderController {
  // Page-specific state using private fields
  #selectedDirectionId = null;
  #currentConcept = null;
  #currentDirection = null;
  #currentCliches = null;
  #directionsData = [];
  #isGenerating = false;

  // DOM element cache
  #directionSelector = null;
  #generateBtn = null;
  #directionDisplay = null;
  #conceptDisplay = null;
  #clichesContainer = null;
  #statusMessages = null;
  #loadingOverlay = null;

  /**
   * Initialize page state
   * @private
   */
  #initializeState() {
    this.#selectedDirectionId = null;
    this.#currentConcept = null;
    this.#currentDirection = null;
    this.#currentCliches = null;
    this.#directionsData = [];
    this.#isGenerating = false;
  }
}
```

### 2. Data Flow Patterns

#### Direction Selection Flow

```javascript
/**
 * Handle direction selection - main data flow entry point
 * @private
 */
async #handleDirectionSelection(directionId) {
  if (!directionId) {
    this.#clearSelection();
    return;
  }

  try {
    // Show loading state (inherited from base)
    this._showLoading('Loading direction details...');

    // Find direction in cached data
    const directionData = this.#findDirectionById(directionId);
    
    // Update internal state
    this.#selectedDirectionId = directionId;
    this.#currentDirection = directionData.direction;
    this.#currentConcept = directionData.concept;

    // Update UI displays
    this.#displayDirectionInfo(this.#currentDirection);
    this.#displayConceptInfo(directionData.concept);

    // Check for existing clichés
    const hasCliches = await this.characterBuilderService
      .hasClichesForDirection(directionId);

    if (hasCliches) {
      // Load and display existing
      const cliches = await this.characterBuilderService
        .getClichesByDirectionId(directionId);
      this.#currentCliches = cliches;
      this.#displayCliches(cliches);
    }

    // Update UI state
    this._showState('idle');
  } catch (error) {
    this.logger.error('Failed to handle direction selection:', error);
    this._showError('Failed to load direction details');
    this.#clearSelection();
  }
}
```

#### Cliché Generation Flow

```javascript
/**
 * Handle cliché generation - async operation with state updates
 * @private
 */
async #handleGenerateCliches() {
  if (!this.#selectedDirectionId || this.#isGenerating) {
    return;
  }

  try {
    // Update generation state
    this.#isGenerating = true;
    this.#updateGenerateButton(false, 'Generating...');
    this._showLoading('Generating clichés...');

    // Generate via service
    const cliches = await this.characterBuilderService
      .generateClichesForDirection(
        this.#currentConcept,
        this.#currentDirection
      );

    // Update state with results
    this.#currentCliches = cliches;
    
    // Display results
    this.#displayCliches(cliches);
    
    // Show success
    this._showResults({
      message: `Generated ${cliches.getTotalCount()} clichés successfully!`
    });
  } catch (error) {
    this.logger.error('Failed to generate clichés:', error);
    this._showError(error.message || 'Failed to generate clichés');
  } finally {
    this.#isGenerating = false;
    this._showState('idle');
  }
}
```

### 3. Event System Integration

#### Event Subscription Pattern

```javascript
/**
 * Subscribe to relevant events using EventBus
 * @private
 */
_subscribeToEvents() {
  // EventBus uses subscribe/unsubscribe pattern
  this.eventBus.on('CLICHES_GENERATION_STARTED', (event) => {
    this.logger.debug('Cliché generation started', event.payload);
  });

  this.eventBus.on('CLICHES_GENERATION_COMPLETED', (event) => {
    this.logger.info('Cliché generation completed', event.payload);
  });

  this.eventBus.on('CLICHES_GENERATION_FAILED', (event) => {
    this.logger.error('Cliché generation failed', event.payload);
  });
}
```

Note: The EventBus uses `on/off` methods for subscriptions, not `emit`. Events are dispatched using `dispatch()`.

### 4. UI State Management (Inherited)

The controller inherits UI state management from `BaseCharacterBuilderController`:

```javascript
// From BaseCharacterBuilderController
class BaseCharacterBuilderController {
  constructor(dependencies) {
    // UIStateManager handles loading, error, success states
    this.uiStateManager = dependencies.uiStateManager;
  }

  // Protected methods available to child controllers
  _showLoading(message) { /* ... */ }
  _showError(message) { /* ... */ }
  _showResults(data) { /* ... */ }
  _showState(state) { /* ... */ }
  _showEmpty() { /* ... */ }
}
```

### 5. Data Organization

#### Initial Data Loading

```javascript
async _loadInitialData() {
  try {
    this._showLoading('Loading thematic directions...');

    // Load all directions
    const directions = await this.characterBuilderService
      .getAllThematicDirections();

    // Organize by concept
    this.#directionsData = await this.#organizeDirectionsByConcept(directions);

    // Populate UI
    this.#populateDirectionSelector(this.#directionsData);

    this._showState('idle');
  } catch (error) {
    this.logger.error('Failed to load initial data:', error);
    this._showError('Failed to load thematic directions');
  }
}
```

### 6. State Cleanup

```javascript
async cleanup() {
  // Clear state
  this.#initializeState();

  // Clear DOM references
  this.#directionSelector = null;
  this.#generateBtn = null;
  // ... other DOM elements

  // Call parent cleanup
  await super.cleanup();
}
```

## Current Data Flow Diagram

```
User Action → Controller Method → State Update → UI Update
                    ↓
              Service Call
                    ↓
              Event Dispatch
```

## State Management Characteristics

### What Exists

1. **Private Field State** - Simple, direct state management
2. **UI State Manager** - Loading, error, success states
3. **Event Bus** - Event-driven communication
4. **Service Layer** - Data fetching and operations
5. **DOM Caching** - Efficient element access

### What Doesn't Exist

1. **State Manager Class** - No separate state management class
2. **EventEmitter** - Uses EventBus instead
3. **State Persistence** - No session/local storage
4. **Caching Layer** - No data caching implemented
5. **State History** - No undo/redo functionality
6. **Data Flow Orchestrator** - Controller handles flow directly

## Testing Approach

### Current Test Structure

```javascript
// From tests/unit/clichesGenerator/controllers/ClichesGeneratorController.test.js
describe('ClichesGeneratorController', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ClichesGeneratorControllerTestBed();
  });

  it('should handle direction selection', async () => {
    // Test uses testBed pattern for setup
    const controller = testBed.createController();
    
    // Simulate user action
    await testBed.selectDirection('dir-1');
    
    // Verify state changes
    expect(testBed.getDisplayedDirection()).toBeTruthy();
  });
});
```

## Dependency Injection

Dependencies are injected through the CharacterBuilderBootstrap:

```javascript
// From bootstrap process
const controller = new ClichesGeneratorController({
  logger: container.get('ILogger'),
  eventBus: container.get('IEventBus'),
  characterBuilderService: container.get('ICharacterBuilderService'),
  clicheGenerator: container.get('IClicheGenerator'),
  uiStateManager: container.get('IUIStateManager'),
  // ... other dependencies
});
```

## Event Types

Current event types used:
- `CLICHES_GENERATION_STARTED`
- `CLICHES_GENERATION_COMPLETED`
- `CLICHES_GENERATION_FAILED`

## Future Enhancement Opportunities

If state management needs enhancement, consider:

1. **Data Caching** - Cache loaded directions and concepts
2. **Session Persistence** - Save selection across page refreshes
3. **State History** - Add undo/redo capabilities
4. **Optimistic Updates** - Update UI before async operations complete
5. **State Validation** - Validate state consistency

## Summary

The current implementation uses a straightforward approach:
- State managed through private controller fields
- Data flow handled directly by controller methods
- UI state management inherited from base class
- Event-driven communication via EventBus
- No persistence or caching layer

This approach is simple, maintainable, and sufficient for current requirements.

## Definition of Done

- [x] Document reflects actual implementation
- [x] No references to non-existent components
- [x] Accurate method signatures and patterns
- [x] Correct event system documentation
- [x] Clear separation of current vs. future