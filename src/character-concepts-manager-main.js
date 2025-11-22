/**
 * @file Main entry point for Character Concepts Manager
 * Entry point for the character concepts management interface
 */

import { CharacterBuilderBootstrap } from './characterBuilder/CharacterBuilderBootstrap.js';
import { CharacterConceptsManagerController } from './domUI/characterConceptsManagerController.js';

/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */

// Constants
const PAGE_NAME = 'Character Concepts Manager';

/**
 * Post-initialization hook for the Character Concepts Manager application
 *
 * @param {CharacterConceptsManagerController} controller - The controller instance
 * @param {typeof globalThis} env - Optional environment (primarily for testing)
 */
async function postInit(controller, env = globalThis) {
  const hasBrowserEnv =
    typeof env.window !== 'undefined' && typeof env.document !== 'undefined';

  if (!hasBrowserEnv) {
    return;
  }

  // Store controller reference for debugging
  env.window.__characterConceptsManagerController = controller;

  // Set up page visibility handling
  setupPageVisibilityHandling(controller, controller.logger, env);

  // Set up error handling
  setupGlobalErrorHandling(controller.logger, env);
}

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
        postInit: (controller) => postInit(controller),
      },
    };

    // Bootstrap the application
    const { bootstrapTime } = await bootstrap.bootstrap(config);

    // eslint-disable-next-line no-console
    console.log(
      `${PAGE_NAME} initialized successfully in ${
        bootstrapTime !== undefined ? bootstrapTime.toFixed(2) : 'unknown'
      }ms`
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to initialize ${PAGE_NAME}:`, error);
    // Error display is handled by bootstrap
  }
}

/**
 * Set up page visibility handling
 *
 * @param {CharacterConceptsManagerController} controller - The controller instance
 * @param {ILogger} logger - The logger instance
 * @param {typeof globalThis} env - Optional environment (primarily for testing)
 */
function setupPageVisibilityHandling(controller, logger, env = globalThis) {
  const { document: envDocument, window: envWindow } = env;

  if (typeof envDocument === 'undefined' || typeof envWindow === 'undefined') {
    return;
  }

  // Handle page visibility changes
  envDocument.addEventListener('visibilitychange', () => {
    if (envDocument.hidden) {
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
  envWindow.addEventListener('online', () => {
    logger.info('Connection restored');
    controller.handleOnline?.();
  });

  envWindow.addEventListener('offline', () => {
    logger.warn('Connection lost');
    controller.handleOffline?.();
  });
}

/**
 * Set up global error handling
 *
 * @param {ILogger} logger - The logger instance
 * @param {typeof globalThis} env - Optional environment (primarily for testing)
 */
function setupGlobalErrorHandling(logger, env = globalThis) {
  const { window: envWindow } = env;

  if (typeof envWindow === 'undefined') {
    return;
  }

  // Handle unhandled errors
  envWindow.addEventListener('error', (event) => {
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
  envWindow.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', {
      reason: event.reason,
      promise: event.promise,
    });

    // Prevent default handling to show user-friendly errors
    event.preventDefault();
  });
}

// Export for testing and entry point
export {
  initializeApp,
  PAGE_NAME,
  // Exported for targeted unit testing and potential reuse
  postInit,
  setupPageVisibilityHandling,
  setupGlobalErrorHandling,
};
