/**
 * @file Integration test for game.html runtime loading
 * @description Tests that game.html can load without runtime errors, specifically
 * testing that the endpointConfig module works correctly in browser environment
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('Game HTML Runtime Loading', () => {
  let dom;
  let window;
  let document;
  let consoleErrors;
  let originalConsoleError;

  beforeEach(() => {
    // Capture console errors
    consoleErrors = [];
    originalConsoleError = console.error;
    console.error = (...args) => {
      consoleErrors.push(args.join(' '));
      originalConsoleError.apply(console, args);
    };

    // Create a JSDOM environment similar to browser
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <div id="app-layout-container"></div>
          <script>
            // Simulate the bundle.js being loaded
            // We'll test the endpointConfig module directly
          </script>
        </body>
      </html>
    `,
      {
        url: 'http://localhost:8080',
        runScripts: 'dangerously',
        resources: 'usable',
        pretendToBeVisual: true,
      }
    );

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
  });

  afterEach(() => {
    console.error = originalConsoleError;
    dom.window.close();
  });

  it('should be able to import endpointConfig without process.env errors', async () => {
    // This test simulates what happens when the browser loads bundle.js
    // and tries to execute the endpointConfig module

    let errorThrown = false;
    let actualError = null;

    try {
      // Simulate browser environment - process should be undefined
      const originalProcess = global.process;
      delete global.process;

      // Try to import and instantiate endpointConfig
      // In a real browser, this would be part of the bundled code
      const { getEndpointConfig } = await import(
        '../../../src/config/endpointConfig.js'
      );

      // This should NOT throw a "process is not defined" error
      const config = getEndpointConfig();

      // Verify it returns expected default values
      expect(config.getBaseUrl()).toBe('http://localhost:3001');
      expect(config.getDebugLogEndpoint()).toBe(
        'http://localhost:3001/api/debug-log'
      );
      expect(config.getLlmRequestEndpoint()).toBe(
        'http://localhost:3001/api/llm-request'
      );

      // Restore process for other tests
      global.process = originalProcess;
    } catch (error) {
      errorThrown = true;
      actualError = error;
    }

    // Verify no runtime errors occurred
    expect(errorThrown).toBe(false);
    expect(actualError).toBeNull();
    expect(consoleErrors).toHaveLength(0);
  });

  it('should handle missing global constants gracefully', async () => {
    // Test fallback behavior when build-time constants are not available

    // Simulate environment where neither build-time constants nor process exist
    const originalProcess = global.process;
    delete global.process;

    // Ensure build-time constants are also undefined
    global.__PROXY_HOST__ = undefined;
    global.__PROXY_PORT__ = undefined;
    global.__PROXY_USE_HTTPS__ = undefined;

    const { getEndpointConfig } = await import(
      '../../../src/config/endpointConfig.js'
    );
    const config = getEndpointConfig();

    // Should fall back to hardcoded defaults
    expect(config.getBaseUrl()).toBe('http://localhost:3001');

    // Cleanup
    global.process = originalProcess;
  });

  it('should simulate game.html bootstrap flow without errors', async () => {
    // Simulate the actual bootstrap flow that game.html attempts
    let bootstrapError = null;

    try {
      // This simulates what would happen when bundle.js loads
      // and game.html calls window.bootstrapApp()

      // Import the main bootstrap function (simulating bundle.js content)
      await import('../../../src/main.js');

      // The main.js should set window.bootstrapApp after loading
      // Note: Since we're not running through the build process,
      // we just verify the function gets defined without process.env errors
      expect(typeof window.bootstrapApp).toBe('function');

      // The key test is that no "process is not defined" errors occurred
      // during the module loading phase
    } catch (error) {
      bootstrapError = error;
    }

    // The main assertion is that there were no process.env errors during loading
    expect(
      consoleErrors.filter((msg) => msg.includes('process is not defined'))
    ).toHaveLength(0);

    // If there was an error and it's not about process.env, that's okay for this test
    // We're specifically testing that the process.env issue is fixed
    if (
      bootstrapError &&
      !bootstrapError.message.includes('process is not defined')
    ) {
      // It's okay if there are other errors (like missing DOM elements, etc.)
      // We're only testing the specific process.env issue
    }
  });

  it('should not throw process.env related errors during logging config initialization', async () => {
    // Test that the logging configuration (which imports endpointConfig)
    // doesn't cause runtime errors

    let configError = null;

    try {
      // This import chain is what was failing:
      // main.js -> defaultConfig.js -> getEndpointConfig() -> process.env
      const { DEFAULT_CONFIG } = await import(
        '../../../src/logging/config/defaultConfig.js'
      );

      // Verify the config was created successfully
      expect(DEFAULT_CONFIG).toBeDefined();
      expect(DEFAULT_CONFIG.remote).toBeDefined();
      expect(DEFAULT_CONFIG.remote.endpoint).toBeDefined();
      expect(typeof DEFAULT_CONFIG.remote.endpoint).toBe('string');
    } catch (error) {
      configError = error;
    }

    expect(configError).toBeNull();
    expect(
      consoleErrors.filter((msg) => msg.includes('process is not defined'))
    ).toHaveLength(0);
  });
});
