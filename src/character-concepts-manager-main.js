/**
 * @file Main entry point for Character Concepts Manager
 * Entry point for the character concepts management interface
 */

import { CommonBootstrapper } from './bootstrapper/CommonBootstrapper.js';
import { tokens } from './dependencyInjection/tokens.js';
import { ensureValidLogger } from './utils/loggerUtils.js';
import { CharacterConceptsManagerController } from './domUI/characterConceptsManagerController.js';

// Constants
const PAGE_NAME = 'CharacterConceptsManager';
const INIT_TIMEOUT = 10000; // 10 seconds

// Bootstrapper instance
let bootstrapper;

/**
 * Initialize the Character Concepts Manager application
 */
async function initializeApp() {
  let logger;
  let container;

  try {
    // Create bootstrapper
    bootstrapper = new CommonBootstrapper();

    // Set initialization timeout
    const timeoutId = setTimeout(() => {
      throw new Error(
        `${PAGE_NAME} initialization timed out after ${INIT_TIMEOUT}ms`
      );
    }, INIT_TIMEOUT);

    // Bootstrap with minimal configuration
    const bootstrapResult = await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      skipModLoading: true, // We'll load mods manually
      includeAnatomyFormatting: false,
      postInitHook: null,
    });

    if (!bootstrapResult.success) {
      throw new Error(
        `Bootstrap failed: ${bootstrapResult.error?.message || 'Unknown error'}`
      );
    }

    // Extract services from bootstrap result
    container = bootstrapResult.container;
    logger = bootstrapResult.logger;
    logger = ensureValidLogger(logger);

    logger.info(`Initializing ${PAGE_NAME}...`);

    // Load only the core mod to get event definitions
    const modsLoader = container.resolve(tokens.ModsLoader);
    if (modsLoader) {
      logger.info('Loading core mod for event definitions...');
      try {
        await modsLoader.loadMods('default', ['core']);
        logger.info('Core mod loaded successfully');
      } catch (modError) {
        logger.warn('Failed to load core mod, continuing without event validation', modError);
      }
    }

    // Resolve dependencies
    const characterBuilderService = container.resolve(
      tokens.CharacterBuilderService
    );
    const eventBus = container.resolve(tokens.ISafeEventDispatcher);

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
      // eslint-disable-next-line no-console
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
 *
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
 *
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
    // Note: In browser environment, we can't easily check NODE_ENV
    // so we prevent default in all cases to show user-friendly errors
    event.preventDefault();
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', {
      reason: event.reason,
      promise: event.promise,
    });

    // Prevent default handling to show user-friendly errors
    event.preventDefault();
  });
}

/**
 * Show initialization error to user
 *
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
 *
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
 *
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
    // eslint-disable-next-line no-console
    console.error('Failed to initialize application:', error);
  });
});

// Export for testing
export { initializeApp, PAGE_NAME };
