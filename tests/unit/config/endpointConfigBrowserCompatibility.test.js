/**
 * @file Unit tests for endpointConfig browser compatibility
 * @description Tests endpointConfig module works in both browser and Node.js environments
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('EndpointConfig Browser Compatibility', () => {
  let originalProcess;
  let originalGlobals;

  beforeEach(() => {
    // Store original values
    originalProcess = global.process;
    originalGlobals = {
      __PROXY_HOST__: global.__PROXY_HOST__,
      __PROXY_PORT__: global.__PROXY_PORT__,
      __PROXY_USE_HTTPS__: global.__PROXY_USE_HTTPS__,
    };
  });

  afterEach(async () => {
    // Restore original values
    global.process = originalProcess;
    global.__PROXY_HOST__ = originalGlobals.__PROXY_HOST__;
    global.__PROXY_PORT__ = originalGlobals.__PROXY_PORT__;
    global.__PROXY_USE_HTTPS__ = originalGlobals.__PROXY_USE_HTTPS__;

    // Reset the singleton instance
    const { resetEndpointConfig } = await import(
      '../../../src/config/endpointConfig.js'
    );
    resetEndpointConfig();
  });

  describe('Browser Environment (process undefined)', () => {
    beforeEach(() => {
      // Simulate browser environment
      delete global.process;
    });

    it('should use build-time injected values when available', async () => {
      // Set up build-time constants
      global.__PROXY_HOST__ = 'example.com';
      global.__PROXY_PORT__ = '8080';
      global.__PROXY_USE_HTTPS__ = 'true';

      const { getEndpointConfig, resetEndpointConfig } = await import(
        '../../../src/config/endpointConfig.js'
      );
      resetEndpointConfig(); // Ensure clean state
      const config = getEndpointConfig();

      expect(config.getBaseUrl()).toBe('https://example.com:8080');
      expect(config.getDebugLogEndpoint()).toBe(
        'https://example.com:8080/api/debug-log'
      );
      expect(config.getLlmRequestEndpoint()).toBe(
        'https://example.com:8080/api/llm-request'
      );
    });

    it('should respect boolean build-time HTTPS flag values', async () => {
      global.__PROXY_HOST__ = 'bool-host';
      global.__PROXY_PORT__ = '8443';
      global.__PROXY_USE_HTTPS__ = true;

      const { getEndpointConfig, resetEndpointConfig } = await import(
        '../../../src/config/endpointConfig.js'
      );
      resetEndpointConfig();
      const config = getEndpointConfig();

      expect(config.getBaseUrl()).toBe('https://bool-host:8443');
    });

    it('should use default values when build-time constants are undefined', async () => {
      // Ensure build-time constants are undefined
      global.__PROXY_HOST__ = undefined;
      global.__PROXY_PORT__ = undefined;
      global.__PROXY_USE_HTTPS__ = undefined;

      const { getEndpointConfig, resetEndpointConfig } = await import(
        '../../../src/config/endpointConfig.js'
      );
      resetEndpointConfig(); // Ensure clean state
      const config = getEndpointConfig();

      // Should use hardcoded defaults
      expect(config.getBaseUrl()).toBe('http://localhost:3001');
      expect(config.getDebugLogEndpoint()).toBe(
        'http://localhost:3001/api/debug-log'
      );
    });

    it('should handle mixed defined/undefined build-time constants', async () => {
      // Mix of defined and undefined constants
      global.__PROXY_HOST__ = 'custom-host';
      global.__PROXY_PORT__ = undefined;
      global.__PROXY_USE_HTTPS__ = 'false';

      const { getEndpointConfig, resetEndpointConfig } = await import(
        '../../../src/config/endpointConfig.js'
      );
      resetEndpointConfig();
      const config = getEndpointConfig();

      // Should use defined values and defaults for undefined
      expect(config.getBaseUrl()).toBe('http://custom-host:3001');
    });

    it('should throw error when trying to use forEnvironment in browser', async () => {
      const { default: EndpointConfig, resetEndpointConfig } = await import(
        '../../../src/config/endpointConfig.js'
      );
      resetEndpointConfig();

      expect(() => {
        EndpointConfig.forEnvironment('development');
      }).toThrow('forEnvironment() is only available in Node.js environments');
    });
  });

  describe('Node.js Environment (process available)', () => {
    beforeEach(() => {
      // Ensure process is available (should be by default in tests)
      if (!global.process) {
        global.process = originalProcess || {
          env: {
            PROXY_HOST: 'localhost',
            PROXY_PORT: '3001',
            PROXY_USE_HTTPS: 'false',
          },
        };
      }
    });

    it('should prefer build-time constants over process.env when available', async () => {
      // Set up conflicting values
      global.process.env.PROXY_HOST = 'from-process-env';
      global.process.env.PROXY_PORT = '9000';

      global.__PROXY_HOST__ = 'from-build-time';
      global.__PROXY_PORT__ = '8000';
      global.__PROXY_USE_HTTPS__ = 'true';

      const { getEndpointConfig, resetEndpointConfig } = await import(
        '../../../src/config/endpointConfig.js'
      );
      resetEndpointConfig();
      const config = getEndpointConfig();

      // Should use build-time values
      expect(config.getBaseUrl()).toBe('https://from-build-time:8000');
    });

    it('should fall back to process.env when build-time constants are undefined', async () => {
      // Clear build-time constants
      global.__PROXY_HOST__ = undefined;
      global.__PROXY_PORT__ = undefined;
      global.__PROXY_USE_HTTPS__ = undefined;

      // Set process.env values
      global.process.env.PROXY_HOST = 'from-env';
      global.process.env.PROXY_PORT = '7000';
      global.process.env.PROXY_USE_HTTPS = 'true';

      const { getEndpointConfig, resetEndpointConfig } = await import(
        '../../../src/config/endpointConfig.js'
      );
      resetEndpointConfig();
      const config = getEndpointConfig();

      expect(config.getBaseUrl()).toBe('https://from-env:7000');
    });

    it('should work with forEnvironment method', async () => {
      const { default: EndpointConfig, resetEndpointConfig } = await import(
        '../../../src/config/endpointConfig.js'
      );
      resetEndpointConfig();

      const config = EndpointConfig.forEnvironment('development');

      expect(config.getBaseUrl()).toBe('http://localhost:3001');
    });

    it('should handle missing process.env values with defaults', async () => {
      // Clear build-time constants
      global.__PROXY_HOST__ = undefined;
      global.__PROXY_PORT__ = undefined;
      global.__PROXY_USE_HTTPS__ = undefined;

      // Clear process.env values
      delete global.process.env.PROXY_HOST;
      delete global.process.env.PROXY_PORT;
      delete global.process.env.PROXY_USE_HTTPS;

      const { getEndpointConfig, resetEndpointConfig } = await import(
        '../../../src/config/endpointConfig.js'
      );
      resetEndpointConfig();
      const config = getEndpointConfig();

      // Should use hardcoded defaults
      expect(config.getBaseUrl()).toBe('http://localhost:3001');
    });
  });

  describe('Endpoint Methods', () => {
    it('should generate correct endpoint URLs', async () => {
      global.process = { env: {} };
      global.__PROXY_HOST__ = 'test-host';
      global.__PROXY_PORT__ = '8080';
      global.__PROXY_USE_HTTPS__ = 'false';

      const { getEndpointConfig, resetEndpointConfig } = await import(
        '../../../src/config/endpointConfig.js'
      );
      resetEndpointConfig();
      const config = getEndpointConfig();

      const endpoints = config.getEndpoints();

      expect(endpoints.baseUrl).toBe('http://test-host:8080');
      expect(endpoints.debugLog).toBe('http://test-host:8080/api/debug-log');
      expect(endpoints.llmRequest).toBe(
        'http://test-host:8080/api/llm-request'
      );
      expect(endpoints.tracesWrite).toBe(
        'http://test-host:8080/api/traces/write'
      );
      expect(endpoints.tracesWriteBatch).toBe(
        'http://test-host:8080/api/traces/write-batch'
      );
      expect(endpoints.health).toBe('http://test-host:8080/health');
    });

    it('should handle HTTPS correctly', async () => {
      global.process = { env: {} };
      global.__PROXY_HOST__ = 'secure-host';
      global.__PROXY_PORT__ = '443';
      global.__PROXY_USE_HTTPS__ = 'true';

      const { getEndpointConfig, resetEndpointConfig } = await import(
        '../../../src/config/endpointConfig.js'
      );
      resetEndpointConfig();
      const config = getEndpointConfig();

      expect(config.getBaseUrl()).toBe('https://secure-host:443');
      expect(config.getHealthEndpoint()).toBe('https://secure-host:443/health');
    });
  });
});
