/**
 * @file Tests for AppConfigService environment variable logging issues
 * @description Reproduces and tests fixes for confusing "undefined" logging
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../../src/config/appConfig.js';
import { TestEnvironmentManager } from '../../common/testServerUtils.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('AppConfigService - Environment Variable Logging Issues', () => {
  let logger;
  let envManager;

  beforeEach(() => {
    jest.resetModules();
    resetAppConfigServiceInstance();

    // Set up environment manager for safe environment manipulation
    envManager = new TestEnvironmentManager();
    envManager.backupEnvironment();
    envManager.cleanEnvironment();

    logger = createLogger();
  });

  afterEach(() => {
    // Restore original environment variables
    if (envManager) {
      envManager.restoreEnvironment();
    }
  });

  describe('Fixed logging behavior for undefined environment variables', () => {
    test('should show clear "not set" messages when environment variables are not set', () => {
      // Ensure environment variables are not set
      delete process.env.NODE_ENV;
      delete process.env.CACHE_ENABLED;
      delete process.env.DEBUG_LOGGING_ENABLED;
      delete process.env.HTTP_AGENT_ENABLED;

      // Create service instance
      const service = getAppConfigService(logger);

      // Verify service works correctly (defaults applied)
      expect(service.getNodeEnv()).toBe('development');
      expect(service.isCacheEnabled()).toBe(true);

      // Check that debug logs contain clear "not set" messages instead of confusing 'undefined' strings
      const debugCalls = logger.debug.mock.calls;

      // Find specific log entries
      const nodeEnvLog = debugCalls.find((call) =>
        call[0].includes('NODE_ENV')
      );
      const cacheEnabledLog = debugCalls.find((call) =>
        call[0].includes('CACHE_ENABLED')
      );

      // The fixed behavior should show clear "not set" messages
      expect(nodeEnvLog[0]).toContain(
        "NODE_ENV not set in environment. Using default: 'development'"
      );
      expect(cacheEnabledLog[0]).toContain(
        'CACHE_ENABLED not set in environment. Using default: true'
      );

      // Should NOT contain the confusing "undefined" messages
      expect(nodeEnvLog[0]).not.toContain('undefined');
      expect(cacheEnabledLog[0]).not.toContain('undefined');
    });

    test('should show proper logging when environment variables are set', () => {
      // Set environment variables
      process.env.NODE_ENV = 'production';
      process.env.CACHE_ENABLED = 'false';

      // Create service instance
      const service = getAppConfigService(logger);

      // Verify service works correctly
      expect(service.getNodeEnv()).toBe('production');
      expect(service.isCacheEnabled()).toBe(false);

      // Check that debug logs are clear when values are set
      const debugCalls = logger.debug.mock.calls;

      const nodeEnvLog = debugCalls.find((call) =>
        call[0].includes('NODE_ENV found in environment:')
      );
      const cacheEnabledLog = debugCalls.find((call) =>
        call[0].includes('CACHE_ENABLED found in environment:')
      );

      // These should be clear and correct
      expect(nodeEnvLog[0]).toContain(
        "NODE_ENV found in environment: 'production'"
      );
      expect(cacheEnabledLog[0]).toContain(
        "CACHE_ENABLED found in environment: 'false'"
      );
    });

    test('should demonstrate the difference between "not set" vs "set to undefined"', () => {
      // This test shows that the fix correctly distinguishes between "not set" and other states

      delete process.env.NODE_ENV;

      const service = getAppConfigService(logger);

      const debugCalls = logger.debug.mock.calls;
      const nodeEnvLog = debugCalls.find((call) =>
        call[0].includes('NODE_ENV')
      );

      // Fixed behavior - should show clear "not set" messages
      expect(nodeEnvLog[0]).toContain('not set in environment');
      expect(nodeEnvLog[0]).not.toContain('undefined');
      expect(nodeEnvLog[0]).toContain("Using default: 'development'");
    });
  });

  describe('Edge cases in environment variable parsing', () => {
    test('should handle empty string environment variables correctly', () => {
      // Set environment variables to empty strings
      process.env.NODE_ENV = '';
      process.env.CACHE_ENABLED = '';

      const service = getAppConfigService(logger);

      // Empty strings behavior: NODE_ENV falls back to default, boolean configs evaluate empty string
      expect(service.getNodeEnv()).toBe('development'); // Empty string falls back to default
      expect(service.isCacheEnabled()).toBe(false); // Empty string evaluates to false for boolean

      const debugCalls = logger.debug.mock.calls;

      // Should log that empty strings were found (this is different from undefined)
      const nodeEnvLog = debugCalls.find((call) =>
        call[0].includes('NODE_ENV found in environment:')
      );
      expect(nodeEnvLog[0]).toContain("NODE_ENV found in environment: ''");
    });

    test('should handle whitespace-only environment variables correctly', () => {
      process.env.NODE_ENV = '  ';
      process.env.CACHE_ENABLED = ' \t ';

      const service = getAppConfigService(logger);

      // Whitespace-only behavior: NODE_ENV trims to default, boolean configs evaluate as false
      expect(service.getNodeEnv()).toBe('development');
      expect(service.isCacheEnabled()).toBe(false); // Whitespace evaluates to false for boolean
    });
  });
});
