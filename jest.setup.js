/* eslint-env node */
/* eslint-disable no-console */
/* global jest */

// jest.setup.js
require('jest-extended/all');

// Ensure test mode is detected
process.env.NODE_ENV = 'test';
process.env.DEBUG_LOG_MODE = 'test';
process.env.DEBUG_LOG_SILENT = 'true';
if (typeof process.env.VALIDATION_PIPELINE_GUARDS === 'undefined') {
  process.env.VALIDATION_PIPELINE_GUARDS = '1';
}

// Allow browser entrypoint modules to auto-initialize inside Jest unless overridden per test.
globalThis.__LNE_FORCE_AUTO_INIT__ = true;

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

// 3. IndexedDB polyfill for jsdom environment using fake-indexeddb
if (typeof window !== 'undefined' && typeof window.indexedDB === 'undefined') {
  // Use the proper fake-indexeddb library for better compatibility
  require('fake-indexeddb/auto');
  console.log('jest.setup.js: fake-indexeddb polyfill loaded for jsdom');
}

// 4. structuredClone polyfill for Node.js versions that don't have it
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => {
    return JSON.parse(JSON.stringify(obj));
  };
}

// Note: Jest test timeout is now configured per-config file:
// - jest.config.unit.js: 15000ms (unit tests should be fast)
// - jest.config.integration.js: 30000ms (integration tests need more time)
// - jest.config.e2e.js: 60000ms (e2e tests need most time)
// Removed global jest.setTimeout() override to respect per-config testTimeout settings

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
    this.size = Array.isArray(content)
      ? content.join('').length
      : content?.length || 0;
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

// 8. Performance User Timing API polyfill for jsdom
// jsdom doesn't implement performance.mark/measure/getEntriesByName
if (typeof performance !== 'undefined') {
  // Store for performance marks and measures
  const performanceEntries = [];
  const performanceMarks = new Map();

  if (!performance.mark) {
    performance.mark = function (markName) {
      const entry = {
        name: markName,
        entryType: 'mark',
        startTime: performance.now(),
        duration: 0,
      };
      performanceMarks.set(markName, entry);
      performanceEntries.push(entry);
      return entry;
    };
  }

  if (!performance.measure) {
    performance.measure = function (measureName, startMarkName, endMarkName) {
      const startMark = performanceMarks.get(startMarkName);
      const endMark = performanceMarks.get(endMarkName);

      if (!startMark) {
        throw new Error(
          `Failed to execute 'measure': The mark '${startMarkName}' does not exist.`
        );
      }
      if (!endMark) {
        throw new Error(
          `Failed to execute 'measure': The mark '${endMarkName}' does not exist.`
        );
      }

      const entry = {
        name: measureName,
        entryType: 'measure',
        startTime: startMark.startTime,
        duration: endMark.startTime - startMark.startTime,
      };
      performanceEntries.push(entry);
      return entry;
    };
  }

  if (!performance.getEntriesByName) {
    performance.getEntriesByName = function (name) {
      return performanceEntries.filter((entry) => entry.name === name);
    };
  }

  if (!performance.clearMarks) {
    performance.clearMarks = function (markName) {
      if (markName) {
        performanceMarks.delete(markName);
        const index = performanceEntries.findIndex(
          (e) => e.name === markName && e.entryType === 'mark'
        );
        if (index !== -1) performanceEntries.splice(index, 1);
      } else {
        // Clear all marks
        for (const [name] of performanceMarks) {
          performanceMarks.delete(name);
        }
        // Remove all marks from entries
        for (let i = performanceEntries.length - 1; i >= 0; i--) {
          if (performanceEntries[i].entryType === 'mark') {
            performanceEntries.splice(i, 1);
          }
        }
      }
    };
  }

  if (!performance.clearMeasures) {
    performance.clearMeasures = function (measureName) {
      if (measureName) {
        const index = performanceEntries.findIndex(
          (e) => e.name === measureName && e.entryType === 'measure'
        );
        if (index !== -1) performanceEntries.splice(index, 1);
      } else {
        // Remove all measures from entries
        for (let i = performanceEntries.length - 1; i >= 0; i--) {
          if (performanceEntries[i].entryType === 'measure') {
            performanceEntries.splice(i, 1);
          }
        }
      }
    };
  }
}

console.log('jest.setup.js: DOM API mocks initialized');

// --- Domain-Specific Test Matchers ---
// Register custom matchers for mod testing
(async () => {
  try {
    const { registerDomainMatchers } = await import(
      './tests/common/mods/domainMatchers.js'
    );
    registerDomainMatchers();
    console.log('jest.setup.js: Domain matchers registered successfully');
  } catch (error) {
    console.error('jest.setup.js: Failed to register domain matchers:', error);
  }
})();

// Note: Removed default jest.useRealTimers() to avoid conflicts with tests that use fake timers
// Individual test files should manage their own timer setup as needed
