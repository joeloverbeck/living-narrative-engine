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
import LogStorageService from '../../../src/services/logStorageService.js';
import DebugLogController from '../../../src/handlers/debugLogController.js';
import { TestEnvironmentManager } from '../../common/testServerUtils.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('Debug Logging Configuration Integration Tests', () => {
  let logger;
  let envManager;
  let logStorageServices;

  beforeEach(() => {
    jest.resetModules();
    resetAppConfigServiceInstance();

    // Set up environment manager for safe environment manipulation
    envManager = new TestEnvironmentManager();
    envManager.backupEnvironment();
    // Preserve Jest's test defaults while cleaning other env vars
    envManager.cleanEnvironment(['NODE_ENV', 'DEBUG_LOGGING_ENABLED']);

    logger = createLogger();
    logStorageServices = []; // Track all LogStorageService instances for cleanup
  });

  afterEach(async () => {
    // Clean up all LogStorageService instances
    for (const service of logStorageServices) {
      if (service && typeof service.shutdown === 'function') {
        await service.shutdown();
      }
    }
    logStorageServices = [];

    // Restore original environment variables
    if (envManager) {
      envManager.restoreEnvironment();
    }
  });

  describe('AppConfigService with LogStorageService integration', () => {
    test('LogStorageService uses default configuration when AppConfigService has no env vars', () => {
      // No environment variables set
      const appConfigService = getAppConfigService(logger);
      const logStorageService = new LogStorageService(logger, appConfigService);
      logStorageServices.push(logStorageService); // Track for cleanup

      // Verify defaults are used
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'LogStorageService: Initialized with AppConfigService'
        ),
        expect.objectContaining({
          config: {
            baseLogPath: './logs',
            retentionDays: 7,
            maxFileSizeMB: 10,
            writeBufferSize: 100,
            flushIntervalMs: 1000,
          },
          debugLoggingEnabled: true,
        })
      );
    });

    test('LogStorageService uses custom configuration from environment variables', () => {
      // Set custom environment variables
      process.env.DEBUG_LOGGING_ENABLED = 'true';
      process.env.DEBUG_LOGGING_PATH = '/custom/logs';
      process.env.DEBUG_LOGGING_RETENTION_DAYS = '14';
      process.env.DEBUG_LOGGING_MAX_FILE_SIZE = '20MB';
      process.env.DEBUG_LOGGING_WRITE_BUFFER_SIZE = '200';
      process.env.DEBUG_LOGGING_FLUSH_INTERVAL = '5000';

      const appConfigService = getAppConfigService(logger);
      const logStorageService = new LogStorageService(logger, appConfigService);
      logStorageServices.push(logStorageService); // Track for cleanup

      // Verify custom configuration is used
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'LogStorageService: Initialized with AppConfigService'
        ),
        expect.objectContaining({
          config: {
            baseLogPath: '/custom/logs',
            retentionDays: 14,
            maxFileSizeMB: 20,
            writeBufferSize: 200,
            flushIntervalMs: 5000,
          },
          debugLoggingEnabled: true,
        })
      );
    });

    test('LogStorageService handles invalid file size format gracefully', () => {
      process.env.DEBUG_LOGGING_MAX_FILE_SIZE = 'invalid';

      const appConfigService = getAppConfigService(logger);
      const logStorageService = new LogStorageService(logger, appConfigService);
      logStorageServices.push(logStorageService); // Track for cleanup

      // Should use default when invalid
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'LogStorageService: Initialized with AppConfigService'
        ),
        expect.objectContaining({
          config: expect.objectContaining({
            maxFileSizeMB: 10, // Default value
          }),
        })
      );
    });

    test('LogStorageService can still accept legacy configuration', () => {
      const legacyConfig = {
        baseLogPath: '/legacy/logs',
        retentionDays: 30,
        maxFileSizeMB: 50,
        writeBufferSize: 500,
        flushIntervalMs: 10000,
      };

      const logStorageService = new LogStorageService(logger, legacyConfig);
      logStorageServices.push(logStorageService); // Track for cleanup

      // Verify legacy configuration is still supported
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'LogStorageService: Initialized with legacy config'
        ),
        expect.objectContaining({
          config: legacyConfig,
        })
      );
    });
  });

  describe('Debug logging flow with environment configuration', () => {
    test('Debug logging disabled prevents LogStorageService initialization', async () => {
      process.env.DEBUG_LOGGING_ENABLED = 'false';

      const appConfigService = getAppConfigService(logger);

      // Simulate what happens in debugRoutes.js
      let logStorageService = null;
      if (appConfigService.isDebugLoggingEnabled()) {
        logStorageService = new LogStorageService(logger, appConfigService);
        logStorageServices.push(logStorageService); // Track for cleanup
      }

      expect(logStorageService).toBeNull();
      expect(appConfigService.isDebugLoggingEnabled()).toBe(false);
    });

    test('Debug logging enabled creates LogStorageService with proper config', async () => {
      process.env.DEBUG_LOGGING_ENABLED = 'true';
      process.env.DEBUG_LOGGING_PATH = '/test/logs';
      process.env.DEBUG_LOGGING_RETENTION_DAYS = '7';

      const appConfigService = getAppConfigService(logger);

      // Simulate what happens in debugRoutes.js
      let logStorageService = null;
      if (appConfigService.isDebugLoggingEnabled()) {
        logStorageService = new LogStorageService(logger, appConfigService);
        logStorageServices.push(logStorageService); // Track for cleanup
      }

      expect(logStorageService).not.toBeNull();
      expect(appConfigService.isDebugLoggingEnabled()).toBe(true);
      expect(appConfigService.getDebugLoggingPath()).toBe('/test/logs');
    });

    test('DebugLogController works with LogStorageService from AppConfigService', () => {
      process.env.DEBUG_LOGGING_ENABLED = 'true';

      const appConfigService = getAppConfigService(logger);
      const logStorageService = new LogStorageService(logger, appConfigService);
      logStorageServices.push(logStorageService); // Track for cleanup
      const debugLogController = new DebugLogController(
        logger,
        logStorageService
      );

      expect(logger.info).toHaveBeenCalledWith(
        'DebugLogController: Initialized with log storage service'
      );
    });

    test('DebugLogController works without LogStorageService when disabled', () => {
      process.env.DEBUG_LOGGING_ENABLED = 'false';

      const appConfigService = getAppConfigService(logger);

      let logStorageService = null;
      if (appConfigService.isDebugLoggingEnabled()) {
        logStorageService = new LogStorageService(logger, appConfigService);
      }

      const debugLogController = new DebugLogController(
        logger,
        logStorageService
      );

      expect(logger.info).toHaveBeenCalledWith(
        'DebugLogController: Initialized with console-only logging'
      );
    });
  });

  describe('Configuration validation integration', () => {
    test('AppConfigService handles invalid retention days with default fallback', () => {
      process.env.DEBUG_LOGGING_RETENTION_DAYS = '400'; // > 365

      const appConfigService = getAppConfigService(logger);

      expect(appConfigService.getDebugLoggingRetentionDays()).toBe(7); // Default
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG_LOGGING_RETENTION_DAYS invalid')
      );
    });

    test('AppConfigService handles invalid write buffer size with default fallback', () => {
      process.env.DEBUG_LOGGING_WRITE_BUFFER_SIZE = '-5';

      const appConfigService = getAppConfigService(logger);

      expect(appConfigService.getDebugLoggingWriteBufferSize()).toBe(100); // Default
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG_LOGGING_WRITE_BUFFER_SIZE invalid')
      );
    });

    test('AppConfigService handles invalid flush interval with default fallback', () => {
      process.env.DEBUG_LOGGING_FLUSH_INTERVAL = '50'; // < 100

      const appConfigService = getAppConfigService(logger);

      expect(appConfigService.getDebugLoggingFlushInterval()).toBe(1000); // Default
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG_LOGGING_FLUSH_INTERVAL invalid')
      );
    });

    test('AppConfigService handles invalid max concurrent writes with default fallback', () => {
      process.env.DEBUG_LOGGING_MAX_CONCURRENT_WRITES = '0';

      const appConfigService = getAppConfigService(logger);

      expect(appConfigService.getDebugLoggingMaxConcurrentWrites()).toBe(5); // Default
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG_LOGGING_MAX_CONCURRENT_WRITES invalid')
      );
    });
  });

  describe('Complete configuration object integration', () => {
    test('getDebugLoggingConfig returns properly structured configuration', () => {
      process.env.DEBUG_LOGGING_ENABLED = 'true';
      process.env.DEBUG_LOGGING_PATH = '/var/log/debug';
      process.env.DEBUG_LOGGING_RETENTION_DAYS = '30';
      process.env.DEBUG_LOGGING_MAX_FILE_SIZE = '100MB';
      process.env.DEBUG_LOGGING_WRITE_BUFFER_SIZE = '500';
      process.env.DEBUG_LOGGING_FLUSH_INTERVAL = '10000';
      process.env.DEBUG_LOGGING_MAX_CONCURRENT_WRITES = '20';
      process.env.DEBUG_LOGGING_CLEANUP_SCHEDULE = '0 1 * * *';
      process.env.DEBUG_LOGGING_CLEANUP_ENABLED = 'true';
      process.env.DEBUG_LOGGING_COMPRESSION = 'false';

      const appConfigService = getAppConfigService(logger);
      const config = appConfigService.getDebugLoggingConfig();

      expect(config).toEqual({
        enabled: true,
        storage: {
          path: '/var/log/debug',
          retentionDays: 30,
          maxFileSize: '100MB',
          compression: false,
        },
        performance: {
          writeBufferSize: 500,
          flushInterval: 10000,
          maxConcurrentWrites: 20,
        },
        cleanup: {
          schedule: '0 1 * * *',
          enabled: true,
        },
      });

      // Verify LogStorageService can use this configuration
      const logStorageService = new LogStorageService(logger, appConfigService);
      logStorageServices.push(logStorageService); // Track for cleanup

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'LogStorageService: Initialized with AppConfigService'
        ),
        expect.objectContaining({
          config: {
            baseLogPath: '/var/log/debug',
            retentionDays: 30,
            maxFileSizeMB: 100,
            writeBufferSize: 500,
            flushIntervalMs: 10000,
          },
        })
      );
    });

    test('Configuration changes are reflected in services', () => {
      // First configuration
      process.env.DEBUG_LOGGING_ENABLED = 'true';
      process.env.DEBUG_LOGGING_PATH = '/first/path';

      const appConfigService1 = getAppConfigService(logger);
      expect(appConfigService1.getDebugLoggingPath()).toBe('/first/path');

      // Reset and change configuration
      resetAppConfigServiceInstance();
      process.env.DEBUG_LOGGING_PATH = '/second/path';

      const appConfigService2 = getAppConfigService(logger);
      expect(appConfigService2.getDebugLoggingPath()).toBe('/second/path');

      // Services use updated configuration
      const logStorageService = new LogStorageService(
        logger,
        appConfigService2
      );
      logStorageServices.push(logStorageService); // Track for cleanup
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'LogStorageService: Initialized with AppConfigService'
        ),
        expect.objectContaining({
          config: expect.objectContaining({
            baseLogPath: '/second/path',
          }),
        })
      );
    });
  });

  describe('Boolean configuration handling', () => {
    test('Compression setting is properly handled as boolean', () => {
      process.env.DEBUG_LOGGING_COMPRESSION = 'true';

      const appConfigService = getAppConfigService(logger);
      expect(appConfigService.isDebugLoggingCompressionEnabled()).toBe(true);

      const config = appConfigService.getDebugLoggingConfig();
      expect(config.storage.compression).toBe(true);
    });

    test('Cleanup enabled setting is properly handled as boolean', () => {
      process.env.DEBUG_LOGGING_CLEANUP_ENABLED = 'false';

      const appConfigService = getAppConfigService(logger);
      expect(appConfigService.isDebugLoggingCleanupEnabled()).toBe(false);

      const config = appConfigService.getDebugLoggingConfig();
      expect(config.cleanup.enabled).toBe(false);
    });

    test('Debug logging enabled setting is properly handled as boolean', () => {
      process.env.DEBUG_LOGGING_ENABLED = 'false';

      const appConfigService = getAppConfigService(logger);
      expect(appConfigService.isDebugLoggingEnabled()).toBe(false);

      const config = appConfigService.getDebugLoggingConfig();
      expect(config.enabled).toBe(false);
    });
  });
});
