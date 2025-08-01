/**
 * @file Main entry point for Character Concepts Manager
 * Entry point for the character concepts management interface
 */

import { CharacterBuilderBootstrap } from './characterBuilder/CharacterBuilderBootstrap.js';
import { CharacterConceptsManagerController } from './domUI/characterConceptsManagerController.js';

// Constants
const PAGE_NAME = 'Character Concepts Manager';

/**
 * Initialize the Character Concepts Manager application
 */
async function initializeApp() {
  try {
    // Create bootstrap instance
    const bootstrap = new CharacterBuilderBootstrap();

    // Configure bootstrap
    const config = {
      pageName: PAGE_NAME,
      controllerClass: CharacterConceptsManagerController,
      includeModLoading: true, // Load core mod for event definitions
      errorDisplay: {
        elementId: 'error-display',
        displayDuration: 5000,
        dismissible: true,
      },
      hooks: {
        postInit: async (controller) => {
          // Store controller reference for debugging
          window.__characterConceptsManagerController = controller;

          // Set up page visibility handling
          setupPageVisibilityHandling(controller, controller.logger);

          // Set up error handling
          setupGlobalErrorHandling(controller.logger);
        },
      },
    };

    // Bootstrap the application
    const { controller, container, bootstrapTime } =
      await bootstrap.bootstrap(config);

    console.log(
      `${PAGE_NAME} initialized successfully in ${bootstrapTime.toFixed(2)}ms`
    );
  } catch (error) {
    console.error(`Failed to initialize ${PAGE_NAME}:`, error);
    // Error display is handled by bootstrap
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
