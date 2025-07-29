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

// 2. setImmediate polyfill (needed by some test utilities)
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (fn, ...args) => {
    return setTimeout(fn, 0, ...args);
  };
  global.clearImmediate = clearTimeout;
}

// Set reasonable default Jest test timeout - reduced from 30s to prevent hanging
// Individual test files can override this for specific performance tests
jest.setTimeout(15000);

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

// Note: Global cleanup hooks have been removed to prevent race conditions
// with individual test suite cleanup. Each test file should handle its own
// cleanup in afterEach hooks as needed.

// Global cleanup to ensure tests don't hang
afterEach(() => {
  // Clear all timers to prevent hanging (only if fake timers are active)
  try {
    // Only clear timers if fake timers are actually in use
    if (jest.isMockFunction && jest.isMockFunction(setTimeout)) {
      jest.clearAllTimers();
    }
  } catch (error) {
    // Safe to ignore - means fake timers aren't active
  }

  // Restore all mocks
  jest.restoreAllMocks();

  // Clear all mock calls
  jest.clearAllMocks();
});

// Note: Removed default jest.useRealTimers() to avoid conflicts with tests that use fake timers
// Individual test files should manage their own timer setup as needed

// Workaround for Node.js v24 compatibility issue with Jest
// This prevents worker crashes when creating Error objects in tests
if (typeof process !== 'undefined' && process.version && process.version.startsWith('v24')) {
  const originalError = global.Error;
  
  // Create a more robust Error replacement that preserves all functionality
  global.Error = class Error extends originalError {
    constructor(message) {
      // Ensure the error is created in a safe context
      try {
        super(message);
        
        // Preserve the name property
        this.name = this.constructor.name;
        
        // Capture stack trace properly
        if (originalError.captureStackTrace) {
          originalError.captureStackTrace(this, this.constructor);
        }
      } catch (e) {
        // Fallback for any issues - call parent constructor with original message
        super(message || 'Error creation failed');
        this.name = this.constructor.name;
      }
    }
    
    // Static methods should be preserved
    static captureStackTrace = originalError.captureStackTrace;
    static stackTraceLimit = originalError.stackTraceLimit;
  };
  
  // Preserve the original Error's prototype chain
  Object.setPrototypeOf(global.Error, originalError);
  Object.setPrototypeOf(global.Error.prototype, originalError.prototype);
  
  // Try to ensure instanceof checks work correctly (if possible)
  try {
    Object.defineProperty(global.Error, Symbol.hasInstance, {
      value: function(obj) {
        return obj instanceof originalError;
      },
      writable: true,
      configurable: true
    });
  } catch (e) {
    // If we can't modify Symbol.hasInstance, that's okay
    // The prototype chain setup should be sufficient
  }
}
