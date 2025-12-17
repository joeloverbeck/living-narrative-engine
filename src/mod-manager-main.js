/* eslint-disable no-console */

/**
 * @file Entry point for Mod Manager page
 * @see ModManagerBootstrap.js
 */

import { ModManagerBootstrap } from './modManager/ModManagerBootstrap.js';
import { shouldAutoInitializeDom } from './utils/environmentUtils.js';

/**
 * Mod Manager Application class
 */
class ModManagerApp {
  /**
   * Initialize the Mod Manager application
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      const bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();
      console.log('Mod Manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Mod Manager:', error);
      showFatalError(error);
    }
  }
}

/**
 * Escape HTML to prevent XSS
 *
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Display fatal initialization error to user
 *
 * @param {Error} error - The error that occurred
 */
function showFatalError(error) {
  const root = document.getElementById('mod-manager-root');
  if (root) {
    root.innerHTML = `
      <div class="fatal-error">
        <h1>Initialization Error</h1>
        <p>Failed to load Mod Manager. Please refresh the page.</p>
        <details>
          <summary>Technical Details</summary>
          <pre>${escapeHtml(error.message)}\n${escapeHtml(error.stack || '')}</pre>
        </details>
      </div>
    `;
  }
}

/**
 * Initialize the Mod Manager when DOM is ready
 */
function initializeWhenReady() {
  if (!shouldAutoInitializeDom()) {
    return;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
}

/**
 * Initialize the application
 */
async function initialize() {
  try {
    const app = new ModManagerApp();
    await app.initialize();
  } catch (error) {
    console.error('Failed to initialize Mod Manager:', error);
  }
}

// Start the application
initializeWhenReady();

export { ModManagerApp };
