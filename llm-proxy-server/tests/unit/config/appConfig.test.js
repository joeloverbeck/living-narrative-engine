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
import {
  SALVAGE_DEFAULT_TTL,
  SALVAGE_MAX_ENTRIES,
  DEBUG_LOGGING_DEFAULT_WRITE_BUFFER_SIZE,
  DEBUG_LOGGING_DEFAULT_FLUSH_INTERVAL,
  DEBUG_LOGGING_DEFAULT_MAX_CONCURRENT_WRITES,
  HTTP_AGENT_TIMEOUT,
} from '../../../src/config/constants.js';
import { TestEnvironmentManager } from '../../common/testServerUtils.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('AppConfigService - Comprehensive Tests', () => {
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

      expect(service.getHttpAgentTimeout()).toBe(HTTP_AGENT_TIMEOUT); // Default from constants
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

  describe('Salvage Configuration Getters', () => {
    test('getSalvageDefaultTtl returns default value when not set', () => {
      const service = getAppConfigService(logger);

      expect(service.getSalvageDefaultTtl()).toBe(SALVAGE_DEFAULT_TTL);
    });

    test('getSalvageMaxEntries returns default value when not set', () => {
      const service = getAppConfigService(logger);

      expect(service.getSalvageMaxEntries()).toBe(SALVAGE_MAX_ENTRIES);
    });

    test('salvage configuration uses custom environment values when provided', () => {
      process.env.SALVAGE_DEFAULT_TTL = '450000';
      process.env.SALVAGE_MAX_ENTRIES = '2048';

      const service = getAppConfigService(logger);

      expect(service.getSalvageDefaultTtl()).toBe(450000);
      expect(service.getSalvageMaxEntries()).toBe(2048);
    });

    test('getSalvageConfig returns complete salvage configuration object', () => {
      process.env.SALVAGE_DEFAULT_TTL = '900000';
      process.env.SALVAGE_MAX_ENTRIES = '4096';

      const service = getAppConfigService(logger);
      const config = service.getSalvageConfig();

      expect(config).toEqual({ defaultTtl: 900000, maxEntries: 4096 });
    });

    test('salvage TTL invalid values fall back to default and warn', () => {
      process.env.SALVAGE_DEFAULT_TTL = 'not-a-number';

      const service = getAppConfigService(logger);

      expect(service.getSalvageDefaultTtl()).toBe(SALVAGE_DEFAULT_TTL);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('SALVAGE_DEFAULT_TTL invalid')
      );
    });

    test('salvage max entries invalid values fall back to default and warn', () => {
      process.env.SALVAGE_MAX_ENTRIES = '0';

      const service = getAppConfigService(logger);

      expect(service.getSalvageMaxEntries()).toBe(SALVAGE_MAX_ENTRIES);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('SALVAGE_MAX_ENTRIES invalid')
      );
    });
  });

  describe('Array/String Parsing Functions', () => {
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

  describe('Invalid Configuration Values', () => {
    describe('Cache Configuration Invalid Values', () => {
      test('CACHE_DEFAULT_TTL with non-numeric value triggers warning and uses default', () => {
        process.env.CACHE_DEFAULT_TTL = 'invalid_number';

        getAppConfigService(logger);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "CACHE_DEFAULT_TTL invalid: 'invalid_number'. Using default:"
          )
        );
      });

      test('CACHE_DEFAULT_TTL with NaN value triggers warning and uses default', () => {
        process.env.CACHE_DEFAULT_TTL = 'NaN';

        getAppConfigService(logger);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "CACHE_DEFAULT_TTL invalid: 'NaN'. Using default:"
          )
        );
      });

      test('CACHE_MAX_SIZE with non-numeric value triggers warning and uses default', () => {
        process.env.CACHE_MAX_SIZE = 'not_a_number';

        getAppConfigService(logger);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "CACHE_MAX_SIZE invalid: 'not_a_number'. Using default:"
          )
        );
      });

      test('CACHE_MAX_SIZE with zero value triggers warning and uses default', () => {
        process.env.CACHE_MAX_SIZE = '0';

        getAppConfigService(logger);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining("CACHE_MAX_SIZE invalid: '0'. Using default:")
        );
      });

      test('CACHE_MAX_SIZE with negative value triggers warning and uses default', () => {
        process.env.CACHE_MAX_SIZE = '-10';

        getAppConfigService(logger);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "CACHE_MAX_SIZE invalid: '-10'. Using default:"
          )
        );
      });

      test('API_KEY_CACHE_TTL with non-numeric value triggers warning and uses default', () => {
        process.env.API_KEY_CACHE_TTL = 'invalid';

        getAppConfigService(logger);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "API_KEY_CACHE_TTL invalid: 'invalid'. Using default:"
          )
        );
      });
    });

    describe('HTTP Agent Configuration Invalid Values', () => {
      test('HTTP_AGENT_MAX_SOCKETS with non-numeric value triggers warning and uses default', () => {
        process.env.HTTP_AGENT_MAX_SOCKETS = 'invalid';

        getAppConfigService(logger);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "HTTP_AGENT_MAX_SOCKETS invalid: 'invalid'. Using default:"
          )
        );
      });

      test('HTTP_AGENT_MAX_SOCKETS with zero value triggers warning and uses default', () => {
        process.env.HTTP_AGENT_MAX_SOCKETS = '0';

        getAppConfigService(logger);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "HTTP_AGENT_MAX_SOCKETS invalid: '0'. Using default:"
          )
        );
      });

      test('HTTP_AGENT_MAX_SOCKETS with negative value triggers warning and uses default', () => {
        process.env.HTTP_AGENT_MAX_SOCKETS = '-5';

        getAppConfigService(logger);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "HTTP_AGENT_MAX_SOCKETS invalid: '-5'. Using default:"
          )
        );
      });

      test('HTTP_AGENT_MAX_FREE_SOCKETS with non-numeric value triggers warning and uses default', () => {
        process.env.HTTP_AGENT_MAX_FREE_SOCKETS = 'invalid';

        getAppConfigService(logger);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "HTTP_AGENT_MAX_FREE_SOCKETS invalid: 'invalid'. Using default:"
          )
        );
      });

      test('HTTP_AGENT_MAX_FREE_SOCKETS with negative value triggers warning and uses default', () => {
        process.env.HTTP_AGENT_MAX_FREE_SOCKETS = '-1';

        getAppConfigService(logger);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "HTTP_AGENT_MAX_FREE_SOCKETS invalid: '-1'. Using default:"
          )
        );
      });

      test('HTTP_AGENT_TIMEOUT with non-numeric value triggers warning and uses default', () => {
        process.env.HTTP_AGENT_TIMEOUT = 'invalid';

        getAppConfigService(logger);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "HTTP_AGENT_TIMEOUT invalid: 'invalid'. Using default:"
          )
        );
      });

      test('HTTP_AGENT_TIMEOUT with zero value triggers warning and uses default', () => {
        process.env.HTTP_AGENT_TIMEOUT = '0';

        getAppConfigService(logger);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "HTTP_AGENT_TIMEOUT invalid: '0'. Using default:"
          )
        );
      });

      test('HTTP_AGENT_FREE_SOCKET_TIMEOUT with non-numeric value triggers warning and uses default', () => {
        process.env.HTTP_AGENT_FREE_SOCKET_TIMEOUT = 'invalid';

        getAppConfigService(logger);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "HTTP_AGENT_FREE_SOCKET_TIMEOUT invalid: 'invalid'. Using default:"
          )
        );
      });

      test('HTTP_AGENT_FREE_SOCKET_TIMEOUT with zero value triggers warning and uses default', () => {
        process.env.HTTP_AGENT_FREE_SOCKET_TIMEOUT = '0';

        getAppConfigService(logger);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "HTTP_AGENT_FREE_SOCKET_TIMEOUT invalid: '0'. Using default:"
          )
        );
      });

      test('HTTP_AGENT_MAX_TOTAL_SOCKETS with non-numeric value triggers warning and uses default', () => {
        process.env.HTTP_AGENT_MAX_TOTAL_SOCKETS = 'invalid';

        getAppConfigService(logger);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "HTTP_AGENT_MAX_TOTAL_SOCKETS invalid: 'invalid'. Using default:"
          )
        );
      });

      test('HTTP_AGENT_MAX_TOTAL_SOCKETS with zero value triggers warning and uses default', () => {
        process.env.HTTP_AGENT_MAX_TOTAL_SOCKETS = '0';

        getAppConfigService(logger);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "HTTP_AGENT_MAX_TOTAL_SOCKETS invalid: '0'. Using default:"
          )
        );
      });

      test('HTTP_AGENT_MAX_IDLE_TIME with non-numeric value triggers warning and uses default', () => {
        process.env.HTTP_AGENT_MAX_IDLE_TIME = 'invalid';

        getAppConfigService(logger);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "HTTP_AGENT_MAX_IDLE_TIME invalid: 'invalid'. Using default:"
          )
        );
      });

      test('HTTP_AGENT_MAX_IDLE_TIME with zero value triggers warning and uses default', () => {
        process.env.HTTP_AGENT_MAX_IDLE_TIME = '0';

        getAppConfigService(logger);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "HTTP_AGENT_MAX_IDLE_TIME invalid: '0'. Using default:"
          )
        );
      });
    });

    test('multiple invalid environment variables trigger multiple warnings', () => {
      process.env.CACHE_DEFAULT_TTL = 'invalid';
      process.env.CACHE_MAX_SIZE = '0';
      process.env.HTTP_AGENT_MAX_SOCKETS = 'bad';
      process.env.HTTP_AGENT_TIMEOUT = '-1';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('CACHE_DEFAULT_TTL invalid')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('CACHE_MAX_SIZE invalid')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('HTTP_AGENT_MAX_SOCKETS invalid')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('HTTP_AGENT_TIMEOUT invalid')
      );
    });
  });

  describe('Debug Logging Configuration Getters', () => {
    test('isDebugLoggingEnabled returns false - deprecated feature', () => {
      const service = getAppConfigService(logger);

      // @deprecated Debug logging has been removed from the system
      expect(service.isDebugLoggingEnabled()).toBe(false);
    });

    test('isDebugLoggingEnabled returns false when DEBUG_LOGGING_ENABLED is false - deprecated', () => {
      process.env.DEBUG_LOGGING_ENABLED = 'false';
      const service = getAppConfigService(logger);

      // @deprecated Debug logging has been removed from the system
      expect(service.isDebugLoggingEnabled()).toBe(false);
    });

    test('isDebugLoggingEnabled returns false when DEBUG_LOGGING_ENABLED is true - deprecated', () => {
      process.env.DEBUG_LOGGING_ENABLED = 'true';
      const service = getAppConfigService(logger);

      // @deprecated Debug logging has been removed from the system
      expect(service.isDebugLoggingEnabled()).toBe(false);
    });

    test('getDebugLoggingPath returns empty string - deprecated feature', () => {
      const service = getAppConfigService(logger);

      // @deprecated Debug logging has been removed from the system
      expect(service.getDebugLoggingPath()).toBe('');
    });

    test('getDebugLoggingPath returns empty string when DEBUG_LOGGING_PATH is set - deprecated', () => {
      process.env.DEBUG_LOGGING_PATH = '/var/log/debug';
      const service = getAppConfigService(logger);

      // @deprecated Debug logging has been removed from the system
      expect(service.getDebugLoggingPath()).toBe('');
    });

    test('getDebugLoggingRetentionDays returns 0 - deprecated feature', () => {
      const service = getAppConfigService(logger);

      // @deprecated Debug logging has been removed from the system
      expect(service.getDebugLoggingRetentionDays()).toBe(0);
    });

    test('getDebugLoggingRetentionDays returns 0 when DEBUG_LOGGING_RETENTION_DAYS is set - deprecated', () => {
      process.env.DEBUG_LOGGING_RETENTION_DAYS = '30';
      const service = getAppConfigService(logger);

      // @deprecated Debug logging has been removed from the system
      expect(service.getDebugLoggingRetentionDays()).toBe(0);
    });

    test('getDebugLoggingRetentionDays returns 0 when invalid value is set - deprecated', () => {
      process.env.DEBUG_LOGGING_RETENTION_DAYS = '400'; // > 365
      const service = getAppConfigService(logger);

      // @deprecated Debug logging has been removed from the system
      expect(service.getDebugLoggingRetentionDays()).toBe(0);
      // Note: No warning logged since debug logging is deprecated
    });

    test('getDebugLoggingMaxFileSize returns default value when not set', () => {
      const service = getAppConfigService(logger);

      expect(service.getDebugLoggingMaxFileSize()).toBe('10MB');
    });

    test('getDebugLoggingMaxFileSize returns custom value when DEBUG_LOGGING_MAX_FILE_SIZE is set', () => {
      process.env.DEBUG_LOGGING_MAX_FILE_SIZE = '50MB';
      const service = getAppConfigService(logger);

      expect(service.getDebugLoggingMaxFileSize()).toBe('50MB');
    });

    test('getDebugLoggingWriteBufferSize returns default value when not set', () => {
      const service = getAppConfigService(logger);

      expect(service.getDebugLoggingWriteBufferSize()).toBe(100);
    });

    test('getDebugLoggingWriteBufferSize returns custom value when DEBUG_LOGGING_WRITE_BUFFER_SIZE is set', () => {
      process.env.DEBUG_LOGGING_WRITE_BUFFER_SIZE = '200';
      const service = getAppConfigService(logger);

      expect(service.getDebugLoggingWriteBufferSize()).toBe(200);
    });

    test('getDebugLoggingWriteBufferSize resets invalid values to default and warns', () => {
      process.env.DEBUG_LOGGING_WRITE_BUFFER_SIZE = '0';

      const service = getAppConfigService(logger);

      expect(service.getDebugLoggingWriteBufferSize()).toBe(
        DEBUG_LOGGING_DEFAULT_WRITE_BUFFER_SIZE
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG_LOGGING_WRITE_BUFFER_SIZE invalid')
      );
    });

    test('getDebugLoggingFlushInterval returns default value when not set', () => {
      const service = getAppConfigService(logger);

      expect(service.getDebugLoggingFlushInterval()).toBe(1000);
    });

    test('getDebugLoggingFlushInterval returns custom value when DEBUG_LOGGING_FLUSH_INTERVAL is set', () => {
      process.env.DEBUG_LOGGING_FLUSH_INTERVAL = '5000';
      const service = getAppConfigService(logger);

      expect(service.getDebugLoggingFlushInterval()).toBe(5000);
    });

    test('getDebugLoggingFlushInterval resets invalid values to default and warns', () => {
      process.env.DEBUG_LOGGING_FLUSH_INTERVAL = '50';

      const service = getAppConfigService(logger);

      expect(service.getDebugLoggingFlushInterval()).toBe(
        DEBUG_LOGGING_DEFAULT_FLUSH_INTERVAL
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG_LOGGING_FLUSH_INTERVAL invalid')
      );
    });

    test('getDebugLoggingMaxConcurrentWrites returns default value when not set', () => {
      const service = getAppConfigService(logger);

      expect(service.getDebugLoggingMaxConcurrentWrites()).toBe(5);
    });

    test('getDebugLoggingMaxConcurrentWrites returns custom value when DEBUG_LOGGING_MAX_CONCURRENT_WRITES is set', () => {
      process.env.DEBUG_LOGGING_MAX_CONCURRENT_WRITES = '10';
      const service = getAppConfigService(logger);

      expect(service.getDebugLoggingMaxConcurrentWrites()).toBe(10);
    });

    test('getDebugLoggingMaxConcurrentWrites resets invalid values to default and warns', () => {
      process.env.DEBUG_LOGGING_MAX_CONCURRENT_WRITES = '0';

      const service = getAppConfigService(logger);

      expect(service.getDebugLoggingMaxConcurrentWrites()).toBe(
        DEBUG_LOGGING_DEFAULT_MAX_CONCURRENT_WRITES
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG_LOGGING_MAX_CONCURRENT_WRITES invalid')
      );
    });

    test('getDebugLoggingCleanupSchedule returns default value when not set', () => {
      const service = getAppConfigService(logger);

      expect(service.getDebugLoggingCleanupSchedule()).toBe('0 2 * * *');
    });

    test('getDebugLoggingCleanupSchedule returns custom value when DEBUG_LOGGING_CLEANUP_SCHEDULE is set', () => {
      process.env.DEBUG_LOGGING_CLEANUP_SCHEDULE = '0 0 * * *';
      const service = getAppConfigService(logger);

      expect(service.getDebugLoggingCleanupSchedule()).toBe('0 0 * * *');
    });

    test('isDebugLoggingCleanupEnabled returns true by default', () => {
      const service = getAppConfigService(logger);

      expect(service.isDebugLoggingCleanupEnabled()).toBe(true);
    });

    test('isDebugLoggingCleanupEnabled returns false when DEBUG_LOGGING_CLEANUP_ENABLED is false', () => {
      process.env.DEBUG_LOGGING_CLEANUP_ENABLED = 'false';
      const service = getAppConfigService(logger);

      expect(service.isDebugLoggingCleanupEnabled()).toBe(false);
    });

    test('isDebugLoggingCompressionEnabled returns false by default', () => {
      const service = getAppConfigService(logger);

      expect(service.isDebugLoggingCompressionEnabled()).toBe(false);
    });

    test('isDebugLoggingCompressionEnabled returns true when DEBUG_LOGGING_COMPRESSION is true', () => {
      process.env.DEBUG_LOGGING_COMPRESSION = 'true';
      const service = getAppConfigService(logger);

      expect(service.isDebugLoggingCompressionEnabled()).toBe(true);
    });

    test('getDebugLoggingConfig returns complete debug logging configuration object', () => {
      process.env.DEBUG_LOGGING_ENABLED = 'false';
      process.env.DEBUG_LOGGING_PATH = '/custom/logs';
      process.env.DEBUG_LOGGING_RETENTION_DAYS = '14';
      process.env.DEBUG_LOGGING_MAX_FILE_SIZE = '20MB';
      process.env.DEBUG_LOGGING_WRITE_BUFFER_SIZE = '200';
      process.env.DEBUG_LOGGING_FLUSH_INTERVAL = '2000';
      process.env.DEBUG_LOGGING_MAX_CONCURRENT_WRITES = '10';
      process.env.DEBUG_LOGGING_CLEANUP_SCHEDULE = '0 3 * * *';
      process.env.DEBUG_LOGGING_CLEANUP_ENABLED = 'false';
      process.env.DEBUG_LOGGING_COMPRESSION = 'true';

      const service = getAppConfigService(logger);
      const config = service.getDebugLoggingConfig();

      expect(config).toEqual({
        enabled: false,
        storage: {
          path: '/custom/logs',
          retentionDays: 14,
          maxFileSize: '20MB',
          compression: true,
        },
        performance: {
          writeBufferSize: 200,
          flushInterval: 2000,
          maxConcurrentWrites: 10,
        },
        cleanup: {
          schedule: '0 3 * * *',
          enabled: false,
        },
      });
    });
  });

  describe('Private Methods', () => {
    test('uses default message when env var undefined and finalValue provided', () => {
      const service = getAppConfigService(logger);

      service._logStringEnvVarStatus('VAR', undefined, 'actual');

      const last = logger.debug.mock.calls.at(-1)[0];
      expect(last).toContain('not set in environment');
      expect(last).toContain('actual');
      expect(last).toContain('LlmConfigService will use its default');
    });

    test('logs null final value when env var is empty string', () => {
      const service = getAppConfigService(logger);

      service._logStringEnvVarStatus('VAR', '', null, 'desc');

      const msg = logger.debug.mock.calls.at(-1)[0];
      expect(msg).toContain('found in environment but is empty');
      expect(msg).toContain('null');
    });
  });
});
