/**
 * @file Isolated test for HTTP agent disabled status logging
 * @description This test is isolated to avoid AppConfigService singleton pollution
 * @see tests/integration/server-lifecycle.integration.test.js
 */

import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import { createProxyServer } from '../../../src/core/server.js';

describe('Server HTTP Agent Disabled Logging (Isolated)', () => {
  let serverController;
  let originalEnv;
  let mockLogger;

  beforeEach(() => {
    // Backup original environment
    originalEnv = { ...process.env };

    // Clear all mocks and timers
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Create mock logger for testing
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Reset environment to clean state
    delete process.env.PROXY_ALLOWED_ORIGIN;
    delete process.env.PROXY_PORT;
    delete process.env.CACHE_ENABLED;
    delete process.env.HTTP_AGENT_ENABLED;
    delete process.env.METRICS_ENABLED;
    delete process.env.METRICS_COLLECT_DEFAULT;
    delete process.env.RATE_LIMITING_ENABLED;
    delete process.env.PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES;

    // Set test environment
    process.env.NODE_ENV = 'test';
  });

  afterEach(async () => {
    // Clean up server instance
    if (serverController) {
      try {
        await serverController.stop();
      } catch (error) {
        // Ignore errors during cleanup
      }
      serverController = null;
    }

    // Clear any remaining timers
    jest.clearAllTimers();

    // Restore original environment
    process.env = originalEnv;
  });

  it('should log HTTP agent disabled status during startup', async () => {
    process.env.HTTP_AGENT_ENABLED = 'false';

    serverController = createProxyServer({ logger: mockLogger });
    await serverController.start();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        'LLM Proxy Server: HTTP Agent Pooling DISABLED - New connections will be created for each request'
      )
    );
  });
});
