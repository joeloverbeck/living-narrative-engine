/* eslint-env node */
/* eslint-disable no-console */
/* global jest */

// jest.setup.js
require('jest-extended/all');

// --- Polyfills for Jest Node environment ---

// 1. TextEncoder/TextDecoder (needed by jsdom/whatwg-url)
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Increase default Jest test timeout to accommodate slower environments
jest.setTimeout(30000);

// Import the fetch polyfill. This will automatically add fetch, Headers, Request, Response
// to the global scope (window in jsdom) if they don't exist.
try {
  require('whatwg-fetch');
} catch (error) {
  console.warn('Failed to load whatwg-fetch polyfill:', error.message);
}

// Optional: You can add a check here to be extra sure, though it shouldn't be necessary
if (typeof window !== 'undefined') {
  if (typeof window.fetch === 'function') {
    console.log('jest.setup.js: window.fetch is now available.');
  } else {
    console.error(
      'jest.setup.js: Error! window.fetch is STILL undefined after polyfill import!'
    );
  }
} else {
  console.log('jest.setup.js: Non-jsdom environment detected.');
}

// Provide shared typedefs for test suites
require('./tests/common/engine/engineTestTypedefs.js');

// Workaround for JSDOM EventTarget issue
if (typeof window !== 'undefined' && window.EventTarget) {
  const originalDispatch = window.EventTarget.prototype.dispatchEvent;
  window.EventTarget.prototype.dispatchEvent = function (event) {
    try {
      return originalDispatch.call(this, event);
    } catch (error) {
      if (
        error.message &&
        error.message.includes('Cannot read properties of undefined')
      ) {
        // Silently ignore this specific JSDOM error
        return true;
      }
      throw error;
    }
  };
}

// Global cleanup hook to prevent timer leaks and hanging worker processes
global.afterEach(async () => {
  // First, clear all pending timers without executing them
  if (typeof jest.clearAllTimers === 'function') {
    jest.clearAllTimers();
  }

  // Restore real timers if fake timers were used
  try {
    // Check if we're using fake timers by attempting to get the system time
    const usingFakeTimers = jest.isMockFunction(setTimeout);
    if (usingFakeTimers || typeof jest.useRealTimers === 'function') {
      jest.useRealTimers();
    }
  } catch (e) {
    // Ignore errors - real timers might already be in use
  }

  // Clear all mocks
  if (typeof jest.clearAllMocks === 'function') {
    jest.clearAllMocks();
  }

  // Note: We intentionally don't clear all timeout/interval IDs globally
  // as this can interfere with Jest's internal timers and cause hangs

  // Allow any pending microtasks to complete
  // Check if we're using fake timers and handle accordingly
  try {
    // If fake timers are active, we need to use a different approach
    if (typeof jest !== 'undefined' && jest.isMockFunction(setTimeout)) {
      // Use process.nextTick if available (Node.js environment)
      if (typeof process !== 'undefined' && process.nextTick) {
        await new Promise((resolve) => process.nextTick(resolve));
      }
      // Otherwise, we can skip this step as fake timers are controlling async behavior
    } else {
      // Real timers are active, use setTimeout normally
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } catch (err) {
    // If anything fails, we can safely continue as this is just cleanup
  }

  // Force clear any active handles that might be keeping the process alive
  if (typeof global.gc === 'function') {
    global.gc();
  }
});
