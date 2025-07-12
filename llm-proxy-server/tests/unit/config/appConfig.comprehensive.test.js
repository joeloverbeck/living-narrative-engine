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

describe('AppConfigService - Comprehensive Getter Functions Coverage', () => {
  let logger;
  let envManager;

  beforeEach(() => {
    jest.resetModules();
    resetAppConfigServiceInstance();

    // Set up environment manager for safe environment manipulation
    envManager = new TestEnvironmentManager();
    envManager.backupEnvironment();
    envManager.cleanEnvironment(); // Safer than process.env = {}

    logger = createLogger();
  });

  afterEach(() => {
    // Restore original environment variables
    if (envManager) {
      envManager.restoreEnvironment();
    }
  });

  describe('Environment Configuration Getters', () => {
    test('getNodeEnv returns default development when NODE_ENV not set', () => {
      const service = getAppConfigService(logger);

      expect(service.getNodeEnv()).toBe('development');
    });

    test('getNodeEnv returns custom value when NODE_ENV is set', () => {
      process.env.NODE_ENV = 'production';
      const service = getAppConfigService(logger);

      expect(service.getNodeEnv()).toBe('production');
    });

    test('isProduction returns true when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      const service = getAppConfigService(logger);

      expect(service.isProduction()).toBe(true);
    });

    test('isProduction returns false when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      const service = getAppConfigService(logger);

      expect(service.isProduction()).toBe(false);
    });

    test('isProduction returns false when NODE_ENV is not set (defaults to development)', () => {
      const service = getAppConfigService(logger);

      expect(service.isProduction()).toBe(false);
    });

    test('isDevelopment returns true when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      const service = getAppConfigService(logger);

      expect(service.isDevelopment()).toBe(true);
    });

    test('isDevelopment returns true when NODE_ENV is not set (defaults to development)', () => {
      const service = getAppConfigService(logger);

      expect(service.isDevelopment()).toBe(true);
    });

    test('isDevelopment returns false when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      const service = getAppConfigService(logger);

      expect(service.isDevelopment()).toBe(false);
    });
  });

  describe('Cache Configuration Getters', () => {
    test('isCacheEnabled returns true by default', () => {
      const service = getAppConfigService(logger);

      expect(service.isCacheEnabled()).toBe(true);
    });

    test('isCacheEnabled returns false when CACHE_ENABLED is false', () => {
      process.env.CACHE_ENABLED = 'false';
      const service = getAppConfigService(logger);

      expect(service.isCacheEnabled()).toBe(false);
    });

    test('isCacheEnabled returns true when CACHE_ENABLED is true', () => {
      process.env.CACHE_ENABLED = 'true';
      const service = getAppConfigService(logger);

      expect(service.isCacheEnabled()).toBe(true);
    });

    test('getCacheDefaultTtl returns default value when not set', () => {
      const service = getAppConfigService(logger);

      expect(service.getCacheDefaultTtl()).toBe(300000); // Default from constants
    });

    test('getCacheDefaultTtl returns custom value when CACHE_DEFAULT_TTL is set', () => {
      process.env.CACHE_DEFAULT_TTL = '600000';
      const service = getAppConfigService(logger);

      expect(service.getCacheDefaultTtl()).toBe(600000);
    });

    test('getCacheMaxSize returns default value when not set', () => {
      const service = getAppConfigService(logger);

      expect(service.getCacheMaxSize()).toBe(1000); // Default from constants
    });

    test('getCacheMaxSize returns custom value when CACHE_MAX_SIZE is set', () => {
      process.env.CACHE_MAX_SIZE = '2000';
      const service = getAppConfigService(logger);

      expect(service.getCacheMaxSize()).toBe(2000);
    });

    test('getApiKeyCacheTtl returns default value when not set', () => {
      const service = getAppConfigService(logger);

      expect(service.getApiKeyCacheTtl()).toBe(300000); // Default from constants
    });

    test('getApiKeyCacheTtl returns custom value when API_KEY_CACHE_TTL is set', () => {
      process.env.API_KEY_CACHE_TTL = '900000';
      const service = getAppConfigService(logger);

      expect(service.getApiKeyCacheTtl()).toBe(900000);
    });

    test('getCacheConfig returns complete cache configuration object', () => {
      process.env.CACHE_ENABLED = 'false';
      process.env.CACHE_DEFAULT_TTL = '600000';
      process.env.CACHE_MAX_SIZE = '2000';
      process.env.API_KEY_CACHE_TTL = '900000';

      const service = getAppConfigService(logger);
      const config = service.getCacheConfig();

      expect(config).toEqual({
        enabled: false,
        defaultTtl: 600000,
        maxSize: 2000,
        apiKeyCacheTtl: 900000,
      });
    });
  });

  describe('HTTP Agent Configuration Getters', () => {
    test('isHttpAgentEnabled returns true by default', () => {
      const service = getAppConfigService(logger);

      expect(service.isHttpAgentEnabled()).toBe(true);
    });

    test('isHttpAgentEnabled returns false when HTTP_AGENT_ENABLED is false', () => {
      process.env.HTTP_AGENT_ENABLED = 'false';
      const service = getAppConfigService(logger);

      expect(service.isHttpAgentEnabled()).toBe(false);
    });

    test('getHttpAgentKeepAlive returns default value', () => {
      const service = getAppConfigService(logger);

      expect(service.getHttpAgentKeepAlive()).toBe(true); // Default from constants
    });

    test('getHttpAgentKeepAlive returns custom value when HTTP_AGENT_KEEP_ALIVE is set', () => {
      process.env.HTTP_AGENT_KEEP_ALIVE = 'false';
      const service = getAppConfigService(logger);

      expect(service.getHttpAgentKeepAlive()).toBe(false);
    });

    test('getHttpAgentMaxSockets returns default value', () => {
      const service = getAppConfigService(logger);

      expect(service.getHttpAgentMaxSockets()).toBe(50); // Default from constants
    });

    test('getHttpAgentMaxSockets returns custom value when HTTP_AGENT_MAX_SOCKETS is set', () => {
      process.env.HTTP_AGENT_MAX_SOCKETS = '100';
      const service = getAppConfigService(logger);

      expect(service.getHttpAgentMaxSockets()).toBe(100);
    });

    test('getHttpAgentMaxFreeSockets returns default value', () => {
      const service = getAppConfigService(logger);

      expect(service.getHttpAgentMaxFreeSockets()).toBe(10); // Default from constants
    });

    test('getHttpAgentMaxFreeSockets returns custom value when HTTP_AGENT_MAX_FREE_SOCKETS is set', () => {
      process.env.HTTP_AGENT_MAX_FREE_SOCKETS = '20';
      const service = getAppConfigService(logger);

      expect(service.getHttpAgentMaxFreeSockets()).toBe(20);
    });

    test('getHttpAgentTimeout returns default value', () => {
      const service = getAppConfigService(logger);

      expect(service.getHttpAgentTimeout()).toBe(60000); // Default from constants
    });

    test('getHttpAgentTimeout returns custom value when HTTP_AGENT_TIMEOUT is set', () => {
      process.env.HTTP_AGENT_TIMEOUT = '120000';
      const service = getAppConfigService(logger);

      expect(service.getHttpAgentTimeout()).toBe(120000);
    });

    test('getHttpAgentFreeSocketTimeout returns default value', () => {
      const service = getAppConfigService(logger);

      expect(service.getHttpAgentFreeSocketTimeout()).toBe(30000); // Default from constants
    });

    test('getHttpAgentFreeSocketTimeout returns custom value when HTTP_AGENT_FREE_SOCKET_TIMEOUT is set', () => {
      process.env.HTTP_AGENT_FREE_SOCKET_TIMEOUT = '60000';
      const service = getAppConfigService(logger);

      expect(service.getHttpAgentFreeSocketTimeout()).toBe(60000);
    });

    test('getHttpAgentMaxTotalSockets returns default value', () => {
      const service = getAppConfigService(logger);

      expect(service.getHttpAgentMaxTotalSockets()).toBe(500); // Default from constants
    });

    test('getHttpAgentMaxTotalSockets returns custom value when HTTP_AGENT_MAX_TOTAL_SOCKETS is set', () => {
      process.env.HTTP_AGENT_MAX_TOTAL_SOCKETS = '1000';
      const service = getAppConfigService(logger);

      expect(service.getHttpAgentMaxTotalSockets()).toBe(1000);
    });

    test('getHttpAgentMaxIdleTime returns default value', () => {
      const service = getAppConfigService(logger);

      expect(service.getHttpAgentMaxIdleTime()).toBe(300000); // Default from constants (5 minutes)
    });

    test('getHttpAgentMaxIdleTime returns custom value when HTTP_AGENT_MAX_IDLE_TIME is set', () => {
      process.env.HTTP_AGENT_MAX_IDLE_TIME = '120000';
      const service = getAppConfigService(logger);

      expect(service.getHttpAgentMaxIdleTime()).toBe(120000);
    });

    test('getHttpAgentConfig returns complete HTTP agent configuration object', () => {
      process.env.HTTP_AGENT_ENABLED = 'false';
      process.env.HTTP_AGENT_KEEP_ALIVE = 'false';
      process.env.HTTP_AGENT_MAX_SOCKETS = '100';
      process.env.HTTP_AGENT_MAX_FREE_SOCKETS = '20';
      process.env.HTTP_AGENT_TIMEOUT = '120000';
      process.env.HTTP_AGENT_FREE_SOCKET_TIMEOUT = '60000';
      process.env.HTTP_AGENT_MAX_TOTAL_SOCKETS = '1000';
      process.env.HTTP_AGENT_MAX_IDLE_TIME = '180000';

      const service = getAppConfigService(logger);
      const config = service.getHttpAgentConfig();

      expect(config).toEqual({
        enabled: false,
        keepAlive: false,
        maxSockets: 100,
        maxFreeSockets: 20,
        timeout: 120000,
        freeSocketTimeout: 60000,
        maxTotalSockets: 1000,
        maxIdleTime: 180000,
      });
    });
  });

  describe('getAllowedOriginsArray Comprehensive Tests', () => {
    test('getAllowedOriginsArray returns empty array when PROXY_ALLOWED_ORIGIN not set', () => {
      const service = getAppConfigService(logger);

      expect(service.getAllowedOriginsArray()).toEqual([]);
    });

    test('getAllowedOriginsArray returns empty array when PROXY_ALLOWED_ORIGIN is empty string', () => {
      process.env.PROXY_ALLOWED_ORIGIN = '';
      const service = getAppConfigService(logger);

      expect(service.getAllowedOriginsArray()).toEqual([]);
    });

    test('getAllowedOriginsArray returns empty array when PROXY_ALLOWED_ORIGIN is only whitespace', () => {
      process.env.PROXY_ALLOWED_ORIGIN = '   ';
      const service = getAppConfigService(logger);

      expect(service.getAllowedOriginsArray()).toEqual([]);
    });

    test('getAllowedOriginsArray returns single origin when one origin is set', () => {
      process.env.PROXY_ALLOWED_ORIGIN = 'http://localhost:3000';
      const service = getAppConfigService(logger);

      expect(service.getAllowedOriginsArray()).toEqual([
        'http://localhost:3000',
      ]);
    });

    test('getAllowedOriginsArray returns multiple origins when comma-separated origins are set', () => {
      process.env.PROXY_ALLOWED_ORIGIN =
        'http://localhost:3000,https://example.com,http://localhost:8080';
      const service = getAppConfigService(logger);

      expect(service.getAllowedOriginsArray()).toEqual([
        'http://localhost:3000',
        'https://example.com',
        'http://localhost:8080',
      ]);
    });

    test('getAllowedOriginsArray trims whitespace from each origin', () => {
      process.env.PROXY_ALLOWED_ORIGIN =
        ' http://localhost:3000 , https://example.com ,  http://localhost:8080  ';
      const service = getAppConfigService(logger);

      expect(service.getAllowedOriginsArray()).toEqual([
        'http://localhost:3000',
        'https://example.com',
        'http://localhost:8080',
      ]);
    });
  });
});
