# Ticket 11: Main Entry Point and Bootstrap

## Overview

Create the main entry point JavaScript file for the Character Concepts Manager, set up esbuild configuration, initialize the controller on page load, and handle navigation.

## Dependencies

- Ticket 01: HTML Structure (completed)
- Ticket 03: Controller Setup (completed)
- All other core functionality tickets

## Current State Analysis

### Findings:
1. **Main entry point file**: `src/character-concepts-manager-main.js` does NOT exist
2. **Controller**: `CharacterConceptsManagerController` exists and is properly exported from `src/domUI/characterConceptsManagerController.js`
3. **Dependency Injection**: 
   - `ICharacterBuilderService` token is defined in `tokens-core.js`
   - `CharacterBuilderService` is registered in `characterBuilderRegistrations.js`
   - Uses `ISafeEventDispatcher` instead of `IEventBus` for the eventBus dependency
4. **Build Configuration**: 
   - No `esbuild.config.mjs` file exists
   - Build is done via inline commands in `package.json` scripts
   - Character concepts manager build would need to be added to the build script
5. **HTML**: 
   - `character-concepts-manager.html` exists
   - Currently references `character-concepts-manager.js` (not built file in dist/)

## Implementation Details

### 1. Create Main Entry Point File

Create `src/character-concepts-manager-main.js`:

```javascript
/**
 * @file Main entry point for Character Concepts Manager
 * Entry point for the character concepts management interface
 */

import { appContainer } from './dependencyInjection/appContainer.js';
import { tokens } from './dependencyInjection/tokens.js';
import { ensureValidLogger } from './utils/loggerUtils.js';
import { CharacterConceptsManagerController } from './domUI/characterConceptsManagerController.js';

// Constants
const PAGE_NAME = 'CharacterConceptsManager';
const INIT_TIMEOUT = 10000; // 10 seconds

/**
 * Initialize the Character Concepts Manager application
 */
async function initializeApp() {
  let logger;

  try {
    // Get logger from container
    logger = appContainer.resolve(tokens.ILogger);
    logger = ensureValidLogger(logger);

    logger.info(`Initializing ${PAGE_NAME}...`);

    // Set initialization timeout
    const timeoutId = setTimeout(() => {
      throw new Error(
        `${PAGE_NAME} initialization timed out after ${INIT_TIMEOUT}ms`
      );
    }, INIT_TIMEOUT);

    // Resolve dependencies
    const characterBuilderService = appContainer.resolve(
      tokens.ICharacterBuilderService
    );
    const eventBus = appContainer.resolve(tokens.ISafeEventDispatcher);

    // Validate services
    if (!characterBuilderService) {
      throw new Error('CharacterBuilderService not found in container');
    }

    if (!eventBus) {
      throw new Error('SafeEventDispatcher not found in container');
    }

    // Create controller
    const controller = new CharacterConceptsManagerController({
      logger,
      characterBuilderService,
      eventBus,
    });

    // Initialize controller
    await controller.initialize();

    // Clear timeout on successful init
    clearTimeout(timeoutId);

    // Store controller reference for debugging
    window.__characterConceptsManagerController = controller;

    logger.info(`${PAGE_NAME} initialized successfully`);

    // Set up page visibility handling
    setupPageVisibilityHandling(controller, logger);

    // Set up error handling
    setupGlobalErrorHandling(logger);
  } catch (error) {
    const errorMessage = `Failed to initialize ${PAGE_NAME}`;

    if (logger) {
      logger.error(errorMessage, error);
    } else {
      console.error(errorMessage, error);
    }

    // Show user-friendly error
    showInitializationError(error.message);

    // Re-throw for debugging
    throw error;
  }
}

/**
 * Set up page visibility handling
 * @param {CharacterConceptsManagerController} controller
 * @param {ILogger} logger
 */
function setupPageVisibilityHandling(controller, logger) {
  // Handle page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      logger.info('Page hidden');
      // Could pause animations or reduce activity
    } else {
      logger.info('Page visible');
      // Could refresh data when page becomes visible
      if (controller.refreshOnVisible) {
        controller.refreshData();
      }
    }
  });

  // Handle online/offline
  window.addEventListener('online', () => {
    logger.info('Connection restored');
    controller.handleOnline?.();
  });

  window.addEventListener('offline', () => {
    logger.warn('Connection lost');
    controller.handleOffline?.();
  });
}

/**
 * Set up global error handling
 * @param {ILogger} logger
 */
function setupGlobalErrorHandling(logger) {
  // Handle unhandled errors
  window.addEventListener('error', (event) => {
    logger.error('Unhandled error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });

    // Prevent default error handling in production
    if (process.env.NODE_ENV === 'production') {
      event.preventDefault();
    }
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', {
      reason: event.reason,
      promise: event.promise,
    });

    // Prevent default handling in production
    if (process.env.NODE_ENV === 'production') {
      event.preventDefault();
    }
  });
}

/**
 * Show initialization error to user
 * @param {string} message
 */
function showInitializationError(message) {
  // Remove loading state if present
  const loadingElements = document.querySelectorAll('.loading, .spinner');
  loadingElements.forEach((el) => (el.style.display = 'none'));

  // Find or create error container
  let errorContainer = document.getElementById('init-error-container');
  if (!errorContainer) {
    errorContainer = document.createElement('div');
    errorContainer.id = 'init-error-container';
    errorContainer.className = 'init-error-container';

    // Find main container or body
    const mainContainer =
      document.getElementById('character-concepts-manager-container') ||
      document.body;
    mainContainer.prepend(errorContainer);
  }

  // Create error message
  errorContainer.innerHTML = `
        <div class="init-error">
            <h2>⚠️ Initialization Error</h2>
            <p>Unable to start the Character Concepts Manager.</p>
            <details>
                <summary>Technical Details</summary>
                <pre>${escapeHtml(message)}</pre>
            </details>
            <div class="init-error-actions">
                <button onclick="window.location.reload()">
                    🔄 Reload Page
                </button>
                <button onclick="window.location.href='index.html'">
                    🏠 Return to Menu
                </button>
            </div>
        </div>
    `;
}

/**
 * Escape HTML for safe display
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Wait for DOM to be ready
 * @returns {Promise<void>}
 */
function waitForDOM() {
  return new Promise((resolve) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', resolve);
    } else {
      resolve();
    }
  });
}

// Start initialization when DOM is ready
waitForDOM().then(() => {
  initializeApp().catch((error) => {
    console.error('Failed to initialize application:', error);
  });
});

// Export for testing
export { initializeApp, PAGE_NAME };
```

### 2. Update Build Configuration

Since the project uses inline esbuild commands in package.json, update the build script to include the new entry point:

In `package.json`, update the `build` script to include the character concepts manager:

```json
{
  "scripts": {
    "build": "esbuild src/main.js --bundle --outfile=dist/bundle.js --platform=browser --sourcemap && esbuild src/anatomy-visualizer.js --bundle --outfile=dist/anatomy-visualizer.js --platform=browser --sourcemap && esbuild src/thematic-direction-main.js --bundle --outfile=dist/thematic-direction.js --platform=browser --sourcemap && esbuild src/thematicDirectionsManager/thematicDirectionsManagerMain.js --bundle --outfile=dist/thematic-directions-manager.js --platform=browser --sourcemap && esbuild src/character-concepts-manager-main.js --bundle --outfile=dist/character-concepts-manager.js --platform=browser --sourcemap && cpy \"*.html\" dist && cpy css dist && cpy data dist && cpy config dist && cpy \"*.{ico,png,webmanifest}\" dist"
  }
}
```

### 3. Verify HTML Script Reference

The HTML file already has the correct script reference:

```html
<!-- In character-concepts-manager.html -->
<script src="character-concepts-manager.js"></script>
```

This is correct because during the build process, both the HTML file and the built JavaScript file are copied to the `dist/` folder, so they're at the same level.
### 4. Verify Service Registration

The CharacterBuilderService is already registered in `src/dependencyInjection/registrations/characterBuilderRegistrations.js`. The registration happens automatically when the container is initialized. Note that it uses different token names:

```javascript
```javascript
// Already registered in characterBuilderRegistrations.js:
registrar.singletonFactory(tokens.CharacterBuilderService, (c) => {
  return new CharacterBuilderService({
    logger: c.resolve(tokens.ILogger),
    storageService: c.resolve(tokens.CharacterStorageService),
    directionGenerator: c.resolve(tokens.ThematicDirectionGenerator),
    eventBus: c.resolve(tokens.ISafeEventDispatcher), // Note: uses ISafeEventDispatcher
  });
});
```

### 5. Add Loading State CSS

Add initialization styles to character-concepts-manager.css:

```css
/* Initialization error styles */
.init-error-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.init-error {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.init-error h2 {
  margin: 0 0 1rem 0;
  color: #e74c3c;
  font-size: 1.5rem;
}

.init-error p {
  margin: 0 0 1rem 0;
  color: var(--text-secondary);
}

.init-error details {
  margin: 1rem 0;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.init-error summary {
  cursor: pointer;
  font-weight: 500;
  color: var(--text-primary);
}

.init-error pre {
  margin: 0.5rem 0 0 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.init-error-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.init-error-actions button {
  flex: 1;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.init-error-actions button:first-child {
  background: var(--narrative-purple);
  color: white;
}

.init-error-actions button:first-child:hover {
  background: var(--narrative-purple-dark);
  transform: translateY(-1px);
}

.init-error-actions button:last-child {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.init-error-actions button:last-child:hover {
  background: var(--bg-tertiary);
}

/* Page loading state */
.page-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--bg-primary);
}

.page-loading .spinner {
  width: 50px;
  height: 50px;
  border: 3px solid var(--border-primary);
  border-top-color: var(--narrative-purple);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
```

### 6. Add Navigation Integration

Update the index.html to include navigation to Character Concepts Manager:

```html
<!-- In index.html or main menu -->
<div class="menu-item">
  <a href="character-concepts-manager.html" class="menu-link">
    <span class="menu-icon">📝</span>
    <span class="menu-text">Character Concepts Manager</span>
    <span class="menu-description">
      Create and manage character concepts for thematic directions
    </span>
  </a>
</div>
```

### 7. Add Build Scripts

Add new scripts to package.json:

```json
{
  "scripts": {
    "build:concepts": "esbuild src/character-concepts-manager-main.js --bundle --outfile=dist/character-concepts-manager.js --sourcemap --platform=browser",
    "dev:concepts": "npm run build:concepts -- --watch"
    // Note: The main build script already exists and needs to be updated as shown in step 2
    // Note: serve script already exists as "npm run start"
  }
}
```

### 8. Add Performance Monitoring

Add basic performance monitoring:

```javascript
// Add to initializeApp function
async function initializeApp() {
  // Mark start time
  performance.mark('concepts-manager-init-start');

  try {
    // ... initialization code ...

    // Mark end time and measure
    performance.mark('concepts-manager-init-end');
    performance.measure(
      'concepts-manager-init',
      'concepts-manager-init-start',
      'concepts-manager-init-end'
    );

    // Log performance
    const measure = performance.getEntriesByName('concepts-manager-init')[0];
    logger.info('Initialization performance', {
      duration: `${measure.duration.toFixed(2)}ms`,
    });
  } catch (error) {
    // ... error handling ...
  }
}
```

### 9. Add Debug Mode

Add debug mode support:

```javascript
// Add debug utilities
const DEBUG =
  process.env.NODE_ENV === 'development' ||
  new URLSearchParams(window.location.search).has('debug');

if (DEBUG) {
  // Enable verbose logging
  window.__DEBUG_CHARACTER_CONCEPTS = true;

  // Add debug panel
  addDebugPanel();
}

/**
 * Add debug panel for development
 */
function addDebugPanel() {
  const panel = document.createElement('div');
  panel.id = 'debug-panel';
  panel.className = 'debug-panel';
  panel.innerHTML = `
        <h3>Debug Panel</h3>
        <button onclick="window.__characterConceptsManagerController?.refreshData()">
            Refresh Data
        </button>
        <button onclick="localStorage.clear(); location.reload()">
            Clear Storage
        </button>
        <button onclick="console.log(window.__characterConceptsManagerController)">
            Log Controller
        </button>
    `;

  document.body.appendChild(panel);
}
```

### 10. Add Environment Detection

Add environment-specific configuration:

```javascript
/**
 * Get environment configuration
 * @returns {Object}
 */
function getEnvironmentConfig() {
  const hostname = window.location.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return {
      environment: 'development',
      apiUrl: 'http://localhost:3000',
      enableDebug: true,
      logLevel: 'debug',
    };
  } else if (hostname.includes('staging')) {
    return {
      environment: 'staging',
      apiUrl: 'https://staging-api.example.com',
      enableDebug: false,
      logLevel: 'info',
    };
  } else {
    return {
      environment: 'production',
      apiUrl: 'https://api.example.com',
      enableDebug: false,
      logLevel: 'warn',
    };
  }
}

// Use in initialization
const config = getEnvironmentConfig();
logger.setLevel(config.logLevel);
```

## Acceptance Criteria

1. ✅ Main entry point file created
2. ✅ Controller initializes on page load
3. ✅ Dependencies resolved from container
4. ✅ Error handling shows user-friendly messages
5. ✅ esbuild configuration updated
6. ✅ Page visibility handling implemented
7. ✅ Global error handling configured
8. ✅ Navigation from main menu works
9. ✅ Build scripts added to package.json
10. ✅ Debug mode available in development
11. ✅ Performance monitoring implemented
12. ✅ Environment detection works

## Testing Requirements

1. Test successful initialization
2. Test initialization timeout
3. Test missing dependencies
4. Test error display
5. Test page visibility changes
6. Test online/offline handling
7. Test debug mode features
8. Test build process

## Notes

- Ensure all dependencies are properly registered (CharacterBuilderService is already registered)
- The eventBus uses ISafeEventDispatcher token, not IEventBus
- Build configuration uses inline commands in package.json, not a separate esbuild.config.mjs file
- HTML file correctly references the script path (no dist/ prefix needed since files are copied to dist/)
- Test with different network conditions
- Verify bundle size is reasonable
- Consider implementing lazy loading for large dependencies
- Test cross-browser compatibility
