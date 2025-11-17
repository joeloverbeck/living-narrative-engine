/**
 * @file Entry point for Character Concepts Manager application
 * Handles browser initialization and DOM setup
 */

import { initializeApp } from './character-concepts-manager-main.js';

/**
 * Wait for DOM to be ready
 *
 * @returns {Promise<void>}
 */
function waitForDOM() {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve();
      return;
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', resolve);
    } else {
      resolve();
    }
  });
}

if (typeof document !== 'undefined') {
  // Start initialization when DOM is ready
  waitForDOM().then(() => {
    initializeApp().catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Failed to initialize application:', error);
    });
  });
}
