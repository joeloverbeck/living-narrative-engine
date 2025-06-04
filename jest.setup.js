// jest.setup.js

// --- Polyfills for Jest Node environment ---

// 1. TextEncoder/TextDecoder (needed by jsdom/whatwg-url)
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Import the fetch polyfill. This will automatically add fetch, Headers, Request, Response
// to the global scope (window in jsdom) if they don't exist.
import 'whatwg-fetch';

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
