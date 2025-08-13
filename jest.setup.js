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

// 3. IndexedDB polyfill for jsdom environment
if (typeof window !== 'undefined' && typeof window.indexedDB === 'undefined') {
  // Create a minimal IndexedDB mock for jsdom
  const createMockIndexedDB = () => {
    const databases = new Map();

    return {
      open: (name, version) => {
        const request = {
          result: null,
          error: null,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
        };

        setTimeout(() => {
          // Create or get database
          let db = databases.get(name);
          if (!db || (version && db.version < version)) {
            db = {
              name,
              version: version || 1,
              objectStoreNames: {
                contains: () => false,
              },
              createObjectStore: (storeName) => ({
                createIndex: () => {},
              }),
              transaction: () => ({
                objectStore: () => ({
                  put: () => ({ onsuccess: null, onerror: null }),
                  get: () => ({ onsuccess: null, onerror: null, result: null }),
                  getAll: () => ({
                    onsuccess: null,
                    onerror: null,
                    result: [],
                  }),
                  delete: () => ({ onsuccess: null, onerror: null }),
                  index: () => ({
                    getAll: () => ({
                      onsuccess: null,
                      onerror: null,
                      result: [],
                    }),
                    openCursor: () => ({
                      onsuccess: null,
                      onerror: null,
                      result: null,
                    }),
                  }),
                }),
                oncomplete: null,
                onerror: null,
              }),
              close: () => {},
            };
            databases.set(name, db);

            // Call upgrade handler
            if (request.onupgradeneeded) {
              request.onupgradeneeded({ target: { result: db } });
            }
          }

          request.result = db;
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);

        return request;
      },
    };
  };

  window.indexedDB = createMockIndexedDB();
  window.IDBKeyRange = {
    only: (value) => ({ value, type: 'only' }),
  };

  console.log('jest.setup.js: IndexedDB polyfill added for jsdom');
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

// Polyfill for HTMLFormElement.prototype.requestSubmit (jsdom limitation)
if (typeof window !== 'undefined' && window.HTMLFormElement) {
  if (!window.HTMLFormElement.prototype.requestSubmit) {
    window.HTMLFormElement.prototype.requestSubmit = function (submitter) {
      // Dispatch submit event
      const submitEvent = new Event('submit', {
        bubbles: true,
        cancelable: true,
      });

      // Set submitter if provided
      if (submitter) {
        Object.defineProperty(submitEvent, 'submitter', {
          value: submitter,
          configurable: true,
        });
      }

      this.dispatchEvent(submitEvent);
    };
  }
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

// --- DOM API MOCKS ---
// These are needed for browser-based functionality in tests

// 4. URL Web API mocks (needed for blob/file operations)
if (typeof global.URL === 'undefined') {
  global.URL = {};
}

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn((blob) => {
  return `blob:${Math.random().toString(36).substring(2, 15)}`;
});
global.URL.revokeObjectURL = jest.fn();

// 5. Blob constructor mock (needed for file export functionality)
// Use a proper class constructor so instanceof checks work correctly
global.Blob = class MockBlob {
  constructor(content, options) {
    this.content = content;
    this.type = options?.type || 'application/octet-stream';
    this.size = Array.isArray(content) ? content.join('').length : content?.length || 0;
  }
};

// 6. Document createElement helper (needed for specific download functionality)
// Note: We don't override document.createElement globally as it interferes with JSDOM
// Instead, we only provide a backup when needed by individual tests

// 7. File System Access API mocks (initially undefined to simulate unsupported browsers)
if (typeof window !== 'undefined') {
  // These will be undefined by default to simulate browsers without File System Access API
  window.showDirectoryPicker = undefined;
  window.showOpenFilePicker = undefined;
  window.showSaveFilePicker = undefined;
}

console.log('jest.setup.js: DOM API mocks initialized');

// Note: Removed default jest.useRealTimers() to avoid conflicts with tests that use fake timers
// Individual test files should manage their own timer setup as needed
