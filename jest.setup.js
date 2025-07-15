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
require('whatwg-fetch');

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

// Global cleanup hook to prevent timer leaks and hanging worker processes
global.afterEach(() => {
  // Clear all timers - both mocked and real
  try {
    // If using fake timers, run pending timers and restore
    if (typeof jest.runOnlyPendingTimers === 'function') {
      jest.runOnlyPendingTimers();
    }
    if (typeof jest.useRealTimers === 'function') {
      jest.useRealTimers();
    }
  } catch (e) {
    // Ignore errors - real timers might already be in use
  }

  // Always clear all timers and mocks
  if (typeof jest.clearAllTimers === 'function') {
    jest.clearAllTimers();
  }
  if (typeof jest.clearAllMocks === 'function') {
    jest.clearAllMocks();
  }

  // Force clear any active handles that might be keeping the process alive
  if (typeof global.gc === 'function') {
    global.gc();
  }
});
