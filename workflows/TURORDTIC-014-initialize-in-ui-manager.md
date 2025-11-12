# TURORDTIC-014: Initialize Ticker Renderer in UI Manager

## Status
Ready for Implementation

## Priority
High - Final integration step

## Dependencies
- TURORDTIC-013 (DI registration complete)

## Description
Initialize the `TurnOrderTickerRenderer` in the UI manager or facade, ensuring it's created after DOM is ready and properly cleaned up on shutdown. Handle the coexistence or replacement of the existing `TitleRenderer`.

## Affected Files
- `src/domUI/engineUIManager.js` OR `src/domUI/domUiFacade.js` (modify)
- `src/domUI/titleRenderer.js` (modify - optional)

## Current State Analysis

### Locate UI Initialization
The ticker needs to be initialized in the main UI orchestrator. Check:
1. `src/domUI/engineUIManager.js` - Main UI manager
2. `src/domUI/domUiFacade.js` - UI facade
3. `src/main.js` - Application entry point

### TitleRenderer Handling
From spec lines 707-721, choose one approach:

**Option A: Coexistence** (Recommended)
- Keep `TitleRenderer` for error messages
- Hide title element during gameplay
- Show title element only for loading/errors

**Option B: Replacement**
- Remove `TitleRenderer` entirely
- Move error handling to separate component

## Implementation - Option A (Coexistence)

### 1. Modify TitleRenderer

**File:** `src/domUI/titleRenderer.js`

Add method to hide title during gameplay:

```javascript
/**
 * Hide the title element (used when ticker is active).
 *
 * @public
 */
hideTitle() {
  if (this.#titleElement) {
    this.#titleElement.style.display = 'none';
    this.#logger.debug('Title element hidden');
  }
}

/**
 * Show the title element (used for errors/loading).
 *
 * @public
 */
showTitle() {
  if (this.#titleElement) {
    this.#titleElement.style.display = 'block';
    this.#logger.debug('Title element shown');
  }
}
```

Subscribe to events to auto-hide:

```javascript
// In constructor or init method
this.#eventBus.subscribe('initialization:initialization_service:completed', () => {
  this.hideTitle(); // Hide once game is ready
});

this.#eventBus.subscribe('core:system_error', () => {
  this.showTitle(); // Show for critical errors
});
```

### 2. Initialize Ticker in UI Manager

**File:** `src/domUI/engineUIManager.js` (or `domUiFacade.js`)

Add ticker renderer initialization:

```javascript
/**
 * @file Engine UI Manager
 * Coordinates all UI components for the game engine.
 */

import { tokens } from '../dependencyInjection/tokens/tokens.js';

class EngineUIManager {
  #logger;
  #container;
  #titleRenderer;
  #turnOrderTickerRenderer; // NEW
  // ... other UI components

  constructor({ logger, container }) {
    this.#logger = logger;
    this.#container = container;
  }

  /**
   * Initialize all UI components.
   * Must be called after DOM is ready.
   *
   * @public
   */
  async initialize() {
    try {
      this.#logger.info('Initializing Engine UI Manager');

      // Initialize existing components
      this.#titleRenderer = this.#container.resolve(tokens.ITitleRenderer);

      // Initialize turn order ticker
      try {
        this.#turnOrderTickerRenderer = this.#container.resolve(
          tokens.ITurnOrderTickerRenderer
        );
        this.#logger.info('Turn order ticker initialized');
      } catch (error) {
        this.#logger.error('Failed to initialize turn order ticker', {
          error: error.message,
        });
        // Continue without ticker (non-critical for basic functionality)
      }

      // ... initialize other UI components

      this.#logger.info('Engine UI Manager initialized successfully');

    } catch (error) {
      this.#logger.error('Failed to initialize Engine UI Manager', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Clean up all UI components.
   *
   * @public
   */
  dispose() {
    this.#logger.info('Disposing Engine UI Manager');

    // Dispose ticker renderer
    if (this.#turnOrderTickerRenderer) {
      try {
        this.#turnOrderTickerRenderer.dispose();
        this.#logger.debug('Turn order ticker disposed');
      } catch (error) {
        this.#logger.warn('Error disposing turn order ticker', {
          error: error.message,
        });
      }
    }

    // ... dispose other components

    this.#logger.info('Engine UI Manager disposed');
  }

  /**
   * Get the turn order ticker renderer.
   * For testing or external access.
   *
   * @returns {TurnOrderTickerRenderer|null}
   * @public
   */
  getTurnOrderTickerRenderer() {
    return this.#turnOrderTickerRenderer;
  }
}

export default EngineUIManager;
```

### 3. Ensure DOM Ready

**File:** `src/main.js` (or entry point)

Ensure UI initialization happens after DOM is ready:

```javascript
/**
 * Initialize the application.
 */
async function initializeApp() {
  const logger = createLogger();

  try {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve);
      });
    }

    logger.info('DOM ready, initializing application');

    // Setup DI container
    const container = setupContainer();

    // Initialize UI manager (includes ticker)
    const uiManager = container.resolve(tokens.IEngineUIManager);
    await uiManager.initialize();

    // Start game engine
    // ...

  } catch (error) {
    logger.error('Application initialization failed', { error: error.message });
    throw error;
  }
}

// Start application
initializeApp().catch(error => {
  console.error('Fatal error:', error);
});
```

## Alternative: Direct Initialization (No UI Manager)

If there's no centralized UI manager:

**File:** `src/main.js`

```javascript
async function initializeApp() {
  const container = setupContainer();
  const logger = container.resolve(tokens.ILogger);

  // Wait for DOM
  if (document.readyState === 'loading') {
    await new Promise(resolve => {
      document.addEventListener('DOMContentLoaded', resolve);
    });
  }

  // Initialize ticker directly
  let tickerRenderer = null;
  try {
    tickerRenderer = container.resolve(tokens.ITurnOrderTickerRenderer);
    logger.info('Turn order ticker initialized');
  } catch (error) {
    logger.error('Failed to initialize turn order ticker', { error: error.message });
  }

  // Store for cleanup
  window.addEventListener('beforeunload', () => {
    if (tickerRenderer) {
      tickerRenderer.dispose();
    }
  });

  // Continue with other initialization...
}
```

## Testing

### Manual Testing

1. **Start Application:**
   ```bash
   npm run dev
   ```

2. **Verify Ticker Visible:**
   - Open browser to game page
   - Check that ticker container is at the top
   - Verify "ROUND 1" label is visible

3. **Start Game:**
   - Create/load a game
   - Verify ticker populates with actors when round starts

4. **Console Check:**
   ```javascript
   // In browser console
   console.log('Ticker initialized:', !!window.tickerRenderer);
   ```

### Unit Test

**File:** `tests/unit/domUI/engineUIManager.test.js`

```javascript
describe('EngineUIManager - Ticker Initialization', () => {
  let uiManager;
  let mockContainer;
  let mockLogger;
  let mockTickerRenderer;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <h1 id="title-element">Game</h1>
      <div id="turn-order-ticker">
        <span id="ticker-round-number">ROUND 1</span>
        <div id="ticker-actor-queue"></div>
      </div>
    `;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockTickerRenderer = {
      dispose: jest.fn(),
      render: jest.fn(),
    };

    mockContainer = {
      resolve: jest.fn((token) => {
        if (token === 'ITurnOrderTickerRenderer') {
          return mockTickerRenderer;
        }
        throw new Error(`Unknown token: ${token}`);
      }),
    };

    uiManager = new EngineUIManager({
      logger: mockLogger,
      container: mockContainer,
    });
  });

  it('should initialize turn order ticker', async () => {
    await uiManager.initialize();

    expect(mockContainer.resolve).toHaveBeenCalledWith('ITurnOrderTickerRenderer');
    expect(mockLogger.info).toHaveBeenCalledWith('Turn order ticker initialized');
  });

  it('should dispose ticker on cleanup', async () => {
    await uiManager.initialize();
    uiManager.dispose();

    expect(mockTickerRenderer.dispose).toHaveBeenCalled();
  });

  it('should handle ticker initialization failure gracefully', async () => {
    mockContainer.resolve.mockImplementation(() => {
      throw new Error('Ticker init failed');
    });

    await expect(uiManager.initialize()).resolves.not.toThrow();

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to initialize turn order ticker',
      expect.any(Object)
    );
  });

  it('should provide access to ticker renderer', async () => {
    await uiManager.initialize();

    const ticker = uiManager.getTurnOrderTickerRenderer();
    expect(ticker).toBe(mockTickerRenderer);
  });
});
```

### Integration Test

**File:** `tests/integration/domUI/tickerInitialization.integration.test.js`

```javascript
describe('Turn Order Ticker - Full Initialization', () => {
  it('should initialize and respond to game events', async () => {
    // Setup full application
    const { container, eventBus } = await setupFullTestEnvironment();

    // Verify ticker exists
    const uiManager = container.resolve(tokens.IEngineUIManager);
    await uiManager.initialize();

    const ticker = uiManager.getTurnOrderTickerRenderer();
    expect(ticker).toBeDefined();

    // Create actors
    const entityManager = container.resolve(tokens.IEntityManager);
    await entityManager.createEntity('actor-1', ['core:actor', 'core:name']);
    await entityManager.createEntity('actor-2', ['core:actor', 'core:name']);

    // Dispatch round started
    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['actor-1', 'actor-2'],
      strategy: 'round-robin',
    });

    // Verify ticker populated
    const queueElement = document.querySelector('#ticker-actor-queue');
    expect(queueElement.children.length).toBe(2);
  });
});
```

### Testing Commands
```bash
# Run UI manager tests
NODE_ENV=test npm run test:unit -- tests/unit/domUI/engineUIManager.test.js --verbose

# Run integration test
NODE_ENV=test npm run test:integration -- tests/integration/domUI/tickerInitialization.integration.test.js --silent

# Full application test
npm run dev
# Then manually test in browser
```

## Acceptance Criteria
- [ ] Ticker initialized in UI manager or entry point
- [ ] Initialization happens after DOM is ready
- [ ] Ticker resolved from DI container
- [ ] Ticker disposed on application shutdown
- [ ] Error handling for initialization failures
- [ ] TitleRenderer coexists or is replaced appropriately
- [ ] Title element hidden during gameplay (if coexistence)
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing confirms ticker renders

## Error Handling

### DOM Not Ready
**Scenario:** Ticker initialized before DOM loaded
**Solution:** Wait for `DOMContentLoaded` event

### Element Not Found
**Scenario:** `#turn-order-ticker` missing from HTML
**Solution:** DI resolution will throw, logged as error, application continues

### Ticker Initialization Failure
**Scenario:** Exception during ticker construction
**Solution:** Catch error, log it, continue without ticker (non-critical)

## Cleanup Considerations

Ensure ticker is disposed:
1. **On Application Shutdown:** `window.beforeunload` event
2. **On UI Manager Disposal:** `dispose()` method
3. **On Hot Reload (Development):** Module cleanup hooks

## TitleRenderer Coexistence

If keeping TitleRenderer:
- Title element hidden after initialization
- Title element shown for critical errors
- Ticker and title never both visible simultaneously
- Consider adding CSS: `#title-element { display: none; }` as default

## Notes
- Ticker initialization is non-critical; app can run without it
- DOM timing is crucial; test thoroughly
- Ticker must be disposed to prevent memory leaks (event subscriptions)

## Next Ticket
TURORDTIC-015: Create comprehensive unit tests
