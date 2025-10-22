import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };

const CONFIG_ENV_KEYS = [
  'PROXY_PORT',
  'LLM_CONFIG_PATH',
  'PROXY_ALLOWED_ORIGIN',
  'PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES',
  'NODE_ENV',
  'CACHE_ENABLED',
  'CACHE_DEFAULT_TTL',
  'CACHE_MAX_SIZE',
  'API_KEY_CACHE_TTL',
  'HTTP_AGENT_ENABLED',
  'HTTP_AGENT_KEEP_ALIVE',
  'HTTP_AGENT_MAX_SOCKETS',
  'HTTP_AGENT_MAX_FREE_SOCKETS',
  'HTTP_AGENT_TIMEOUT',
  'HTTP_AGENT_FREE_SOCKET_TIMEOUT',
  'HTTP_AGENT_MAX_TOTAL_SOCKETS',
  'HTTP_AGENT_MAX_IDLE_TIME',
  'SALVAGE_DEFAULT_TTL',
  'SALVAGE_MAX_ENTRIES',
  'DEBUG_LOGGING_ENABLED',
  'DEBUG_LOGGING_PATH',
  'DEBUG_LOGGING_RETENTION_DAYS',
  'DEBUG_LOGGING_MAX_FILE_SIZE',
  'DEBUG_LOGGING_WRITE_BUFFER_SIZE',
  'DEBUG_LOGGING_FLUSH_INTERVAL',
  'DEBUG_LOGGING_MAX_CONCURRENT_WRITES',
  'DEBUG_LOGGING_CLEANUP_SCHEDULE',
  'DEBUG_LOGGING_CLEANUP_ENABLED',
  'DEBUG_LOGGING_COMPRESSION',
];

describe('AppConfigService environment edge coverage integration', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
  });

  const setupConsoleSpies = () => {
    const spies = {
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
    };
    return spies;
  };

  const restoreSpies = (spies) => {
    Object.values(spies).forEach((spy) => spy.mockRestore());
  };

  it('uses defaults when environment variables are absent and logs fallback behaviour', async () => {
    for (const key of CONFIG_ENV_KEYS) {
      delete process.env[key];
    }

    delete process.env.LOG_ENHANCED_FORMATTING;

    const spies = setupConsoleSpies();

    const [appConfigModule, consoleLoggerModule, constants] = await Promise.all([
      import('../../src/config/appConfig.js'),
      import('../../src/consoleLogger.js'),
      import('../../src/config/constants.js'),
    ]);

    try {
      appConfigModule.resetAppConfigServiceInstance();
      const logger = consoleLoggerModule.createConsoleLogger();
      const service = appConfigModule.getAppConfigService(logger);

      expect(service.getProxyPort()).toBe(3001);
      expect(service.isProxyPortDefaulted()).toBe(true);
      expect(service.getLlmConfigPath()).toBeNull();
      expect(service.getProxyAllowedOrigin()).toBeNull();
      expect(service.getAllowedOriginsArray()).toEqual([]);
      expect(service.getProxyProjectRootPathForApiKeyFiles()).toBeNull();
      expect(service.getNodeEnv()).toBe('development');
      expect(service.isDevelopment()).toBe(true);
      expect(service.isProduction()).toBe(false);

      expect(service.isCacheEnabled()).toBe(true);
      expect(service.getCacheDefaultTtl()).toBe(constants.CACHE_DEFAULT_TTL);
      expect(service.getCacheMaxSize()).toBe(constants.CACHE_DEFAULT_MAX_SIZE);
      expect(service.getApiKeyCacheTtl()).toBe(constants.API_KEY_CACHE_TTL);

      expect(service.isHttpAgentEnabled()).toBe(true);
      expect(service.getHttpAgentKeepAlive()).toBe(constants.HTTP_AGENT_KEEP_ALIVE);
      expect(service.getHttpAgentMaxSockets()).toBe(constants.HTTP_AGENT_MAX_SOCKETS);
      expect(service.getHttpAgentMaxFreeSockets()).toBe(constants.HTTP_AGENT_MAX_FREE_SOCKETS);
      expect(service.getHttpAgentTimeout()).toBe(constants.HTTP_AGENT_TIMEOUT);
      expect(service.getHttpAgentFreeSocketTimeout()).toBe(constants.HTTP_AGENT_FREE_SOCKET_TIMEOUT);
      expect(service.getHttpAgentMaxTotalSockets()).toBe(constants.HTTP_AGENT_MAX_TOTAL_SOCKETS);
      expect(service.getHttpAgentMaxIdleTime()).toBe(constants.HTTP_AGENT_MAX_IDLE_TIME);

      expect(service.getHttpAgentConfig()).toEqual({
        enabled: true,
        keepAlive: constants.HTTP_AGENT_KEEP_ALIVE,
        maxSockets: constants.HTTP_AGENT_MAX_SOCKETS,
        maxFreeSockets: constants.HTTP_AGENT_MAX_FREE_SOCKETS,
        timeout: constants.HTTP_AGENT_TIMEOUT,
        freeSocketTimeout: constants.HTTP_AGENT_FREE_SOCKET_TIMEOUT,
        maxTotalSockets: constants.HTTP_AGENT_MAX_TOTAL_SOCKETS,
        maxIdleTime: constants.HTTP_AGENT_MAX_IDLE_TIME,
      });

      expect(service.getSalvageDefaultTtl()).toBe(constants.SALVAGE_DEFAULT_TTL);
      expect(service.getSalvageMaxEntries()).toBe(constants.SALVAGE_MAX_ENTRIES);
      expect(service.getSalvageConfig()).toEqual({
        defaultTtl: constants.SALVAGE_DEFAULT_TTL,
        maxEntries: constants.SALVAGE_MAX_ENTRIES,
      });

      expect(service.isDebugLoggingEnabled()).toBe(false);
      expect(service.getDebugLoggingPath()).toBe('');
      expect(service.getDebugLoggingRetentionDays()).toBe(0);
      expect(service.getDebugLoggingMaxFileSize()).toBe(constants.DEBUG_LOGGING_DEFAULT_MAX_FILE_SIZE);
      expect(service.getDebugLoggingWriteBufferSize()).toBe(constants.DEBUG_LOGGING_DEFAULT_WRITE_BUFFER_SIZE);
      expect(service.getDebugLoggingFlushInterval()).toBe(constants.DEBUG_LOGGING_DEFAULT_FLUSH_INTERVAL);
      expect(service.getDebugLoggingMaxConcurrentWrites()).toBe(constants.DEBUG_LOGGING_DEFAULT_MAX_CONCURRENT_WRITES);
      expect(service.getDebugLoggingCleanupSchedule()).toBe(constants.DEBUG_LOGGING_DEFAULT_CLEANUP_SCHEDULE);
      expect(service.isDebugLoggingCleanupEnabled()).toBe(constants.DEBUG_LOGGING_DEFAULT_CLEANUP_ENABLED);
      expect(service.isDebugLoggingCompressionEnabled()).toBe(constants.DEBUG_LOGGING_DEFAULT_COMPRESSION);
      expect(service.getDebugLoggingConfig()).toEqual({
        enabled: constants.DEBUG_LOGGING_ENABLED,
        storage: {
          path: constants.DEBUG_LOGGING_DEFAULT_PATH,
          retentionDays: constants.DEBUG_LOGGING_DEFAULT_RETENTION_DAYS,
          maxFileSize: constants.DEBUG_LOGGING_DEFAULT_MAX_FILE_SIZE,
          compression: constants.DEBUG_LOGGING_DEFAULT_COMPRESSION,
        },
        performance: {
          writeBufferSize: constants.DEBUG_LOGGING_DEFAULT_WRITE_BUFFER_SIZE,
          flushInterval: constants.DEBUG_LOGGING_DEFAULT_FLUSH_INTERVAL,
          maxConcurrentWrites: constants.DEBUG_LOGGING_DEFAULT_MAX_CONCURRENT_WRITES,
        },
        cleanup: {
          schedule: constants.DEBUG_LOGGING_DEFAULT_CLEANUP_SCHEDULE,
          enabled: constants.DEBUG_LOGGING_DEFAULT_CLEANUP_ENABLED,
        },
      });

      const debugOutput = spies.debug.mock.calls.flat().join('\n');
      expect(debugOutput).toContain('PROXY_PORT not found in environment');
      expect(debugOutput).toContain('LLM_CONFIG_PATH not set in environment');
      expect(debugOutput).toContain('NODE_ENV not set in environment');
      expect(debugOutput).toContain('CACHE_ENABLED not set in environment');
      expect(debugOutput).toContain('HTTP_AGENT_ENABLED not set in environment');
      expect(debugOutput).toContain('SALVAGE_DEFAULT_TTL not set in environment');
      expect(debugOutput).toContain('DEBUG_LOGGING_ENABLED not set in environment');
      const defaultWarnMessages = spies.warn.mock.calls.map((call) => call.join(' '));
      expect(defaultWarnMessages.every((message) => message.includes('Chalk not available'))).toBe(true);
    } finally {
      appConfigModule.resetAppConfigServiceInstance();
      restoreSpies(spies);
    }
  });

  it('applies explicit overrides with normalized values and exposes them via getters', async () => {
    process.env.PROXY_PORT = '8080';
    process.env.LLM_CONFIG_PATH = '/opt/proxy/llm-configs.json';
    process.env.PROXY_ALLOWED_ORIGIN = 'https://a.example.com, https://b.example.com';
    process.env.PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES = '/srv/root';
    process.env.NODE_ENV = ' Production ';
    process.env.CACHE_ENABLED = 'false';
    process.env.CACHE_DEFAULT_TTL = '900000';
    process.env.CACHE_MAX_SIZE = '750';
    process.env.API_KEY_CACHE_TTL = '180000';
    process.env.HTTP_AGENT_ENABLED = 'false';
    process.env.HTTP_AGENT_KEEP_ALIVE = 'false';
    process.env.HTTP_AGENT_MAX_SOCKETS = '25';
    process.env.HTTP_AGENT_MAX_FREE_SOCKETS = '15';
    process.env.HTTP_AGENT_TIMEOUT = '45000';
    process.env.HTTP_AGENT_FREE_SOCKET_TIMEOUT = '3500';
    process.env.HTTP_AGENT_MAX_TOTAL_SOCKETS = '120';
    process.env.HTTP_AGENT_MAX_IDLE_TIME = '240000';
    process.env.SALVAGE_DEFAULT_TTL = '150000';
    process.env.SALVAGE_MAX_ENTRIES = '650';
    process.env.DEBUG_LOGGING_ENABLED = 'false';
    process.env.DEBUG_LOGGING_PATH = '/var/log/proxy';
    process.env.DEBUG_LOGGING_RETENTION_DAYS = '60';
    process.env.DEBUG_LOGGING_MAX_FILE_SIZE = '20MB';
    process.env.DEBUG_LOGGING_WRITE_BUFFER_SIZE = '256';
    process.env.DEBUG_LOGGING_FLUSH_INTERVAL = '2500';
    process.env.DEBUG_LOGGING_MAX_CONCURRENT_WRITES = '12';
    process.env.DEBUG_LOGGING_CLEANUP_SCHEDULE = '0 1 * * *';
    process.env.DEBUG_LOGGING_CLEANUP_ENABLED = 'false';
    process.env.DEBUG_LOGGING_COMPRESSION = 'true';
    process.env.LOG_ENHANCED_FORMATTING = 'false';

    const spies = setupConsoleSpies();

    const [appConfigModule, consoleLoggerModule] = await Promise.all([
      import('../../src/config/appConfig.js'),
      import('../../src/consoleLogger.js'),
    ]);

    try {
      appConfigModule.resetAppConfigServiceInstance();
      const logger = consoleLoggerModule.createConsoleLogger();
      const service = appConfigModule.getAppConfigService(logger);

      expect(service.getProxyPort()).toBe(8080);
      expect(service.isProxyPortDefaulted()).toBe(false);
      expect(service.getLlmConfigPath()).toBe('/opt/proxy/llm-configs.json');
      expect(service.getProxyAllowedOrigin()).toBe('https://a.example.com, https://b.example.com');
      expect(service.getAllowedOriginsArray()).toEqual([
        'https://a.example.com',
        'https://b.example.com',
      ]);
      expect(service.getProxyProjectRootPathForApiKeyFiles()).toBe('/srv/root');

      expect(service.getNodeEnv()).toBe('production');
      expect(service.isProduction()).toBe(true);
      expect(service.isDevelopment()).toBe(false);

      expect(service.isCacheEnabled()).toBe(false);
      expect(service.getCacheDefaultTtl()).toBe(900000);
      expect(service.getCacheMaxSize()).toBe(750);
      expect(service.getApiKeyCacheTtl()).toBe(180000);

      expect(service.isHttpAgentEnabled()).toBe(false);
      expect(service.getHttpAgentKeepAlive()).toBe(false);
      expect(service.getHttpAgentMaxSockets()).toBe(25);
      expect(service.getHttpAgentMaxFreeSockets()).toBe(15);
      expect(service.getHttpAgentTimeout()).toBe(45000);
      expect(service.getHttpAgentFreeSocketTimeout()).toBe(3500);
      expect(service.getHttpAgentMaxTotalSockets()).toBe(120);
      expect(service.getHttpAgentMaxIdleTime()).toBe(240000);

      expect(service.getSalvageDefaultTtl()).toBe(150000);
      expect(service.getSalvageMaxEntries()).toBe(650);
      expect(service.getSalvageConfig()).toEqual({ defaultTtl: 150000, maxEntries: 650 });

      expect(service.isDebugLoggingEnabled()).toBe(false);
      expect(service.getDebugLoggingPath()).toBe('');
      expect(service.getDebugLoggingRetentionDays()).toBe(0);
      expect(service.getDebugLoggingMaxFileSize()).toBe('20MB');
      expect(service.getDebugLoggingWriteBufferSize()).toBe(256);
      expect(service.getDebugLoggingFlushInterval()).toBe(2500);
      expect(service.getDebugLoggingMaxConcurrentWrites()).toBe(12);
      expect(service.getDebugLoggingCleanupSchedule()).toBe('0 1 * * *');
      expect(service.isDebugLoggingCleanupEnabled()).toBe(false);
      expect(service.isDebugLoggingCompressionEnabled()).toBe(true);
      expect(service.getDebugLoggingConfig()).toEqual({
        enabled: false,
        storage: {
          path: '/var/log/proxy',
          retentionDays: 60,
          maxFileSize: '20MB',
          compression: true,
        },
        performance: {
          writeBufferSize: 256,
          flushInterval: 2500,
          maxConcurrentWrites: 12,
        },
        cleanup: {
          schedule: '0 1 * * *',
          enabled: false,
        },
      });

      const debugOutput = spies.debug.mock.calls.flat().join('\n');
      expect(debugOutput).toContain("PROXY_PORT found in environment: '8080'");
      expect(debugOutput).toContain("LLM_CONFIG_PATH found in environment: '/opt/proxy/llm-configs.json'");
      expect(debugOutput).toContain("PROXY_ALLOWED_ORIGIN found in environment");
      expect(debugOutput).toContain("NODE_ENV found in environment: ' Production '");
      expect(debugOutput).toContain("SALVAGE_DEFAULT_TTL found in environment: '150000'");
      expect(debugOutput).toContain("DEBUG_LOGGING_MAX_FILE_SIZE found in environment: '20MB'");
      const overrideWarnMessages = spies.warn.mock.calls.map((call) => call.join(' '));
      expect(overrideWarnMessages.every((message) => message.includes('Chalk not available'))).toBe(true);
    } finally {
      appConfigModule.resetAppConfigServiceInstance();
      restoreSpies(spies);
    }
  });

  it('handles invalid overrides with warnings and falls back to safe defaults', async () => {
    process.env.PROXY_PORT = '-20';
    process.env.LLM_CONFIG_PATH = '';
    process.env.PROXY_ALLOWED_ORIGIN = '';
    process.env.PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES = '';
    process.env.NODE_ENV = '';
    process.env.CACHE_ENABLED = 'maybe';
    process.env.CACHE_DEFAULT_TTL = 'invalid';
    process.env.CACHE_MAX_SIZE = '-5';
    process.env.API_KEY_CACHE_TTL = 'NaN';
    process.env.HTTP_AGENT_ENABLED = 'TRUE';
    process.env.HTTP_AGENT_KEEP_ALIVE = 'TRUE';
    process.env.HTTP_AGENT_MAX_SOCKETS = '-1';
    process.env.HTTP_AGENT_MAX_FREE_SOCKETS = '-3';
    process.env.HTTP_AGENT_TIMEOUT = '0';
    process.env.HTTP_AGENT_FREE_SOCKET_TIMEOUT = '-10';
    process.env.HTTP_AGENT_MAX_TOTAL_SOCKETS = '0';
    process.env.HTTP_AGENT_MAX_IDLE_TIME = '-100';
    process.env.SALVAGE_DEFAULT_TTL = 'oops';
    process.env.SALVAGE_MAX_ENTRIES = '-10';
    process.env.DEBUG_LOGGING_ENABLED = 'maybe';
    process.env.DEBUG_LOGGING_PATH = '';
    process.env.DEBUG_LOGGING_RETENTION_DAYS = '500';
    process.env.DEBUG_LOGGING_MAX_FILE_SIZE = '';
    process.env.DEBUG_LOGGING_WRITE_BUFFER_SIZE = '0';
    process.env.DEBUG_LOGGING_FLUSH_INTERVAL = '10';
    process.env.DEBUG_LOGGING_MAX_CONCURRENT_WRITES = '0';
    process.env.DEBUG_LOGGING_CLEANUP_SCHEDULE = '';
    process.env.DEBUG_LOGGING_CLEANUP_ENABLED = 'maybe';
    process.env.DEBUG_LOGGING_COMPRESSION = 'maybe';
    process.env.LOG_ENHANCED_FORMATTING = 'false';

    const spies = setupConsoleSpies();

    const [appConfigModule, consoleLoggerModule, constants] = await Promise.all([
      import('../../src/config/appConfig.js'),
      import('../../src/consoleLogger.js'),
      import('../../src/config/constants.js'),
    ]);

    try {
      appConfigModule.resetAppConfigServiceInstance();
      const logger = consoleLoggerModule.createConsoleLogger();
      const service = appConfigModule.getAppConfigService(logger);

      expect(service.getProxyPort()).toBe(3001);
      expect(service.isProxyPortDefaulted()).toBe(true);
      expect(service.getLlmConfigPath()).toBe('');
      expect(service.getProxyAllowedOrigin()).toBe('');
      expect(service.getAllowedOriginsArray()).toEqual([]);
      expect(service.getProxyProjectRootPathForApiKeyFiles()).toBe('');
      expect(service.getNodeEnv()).toBe('development');
      expect(service.isDevelopment()).toBe(true);

      expect(service.isCacheEnabled()).toBe(false);
      expect(service.getCacheDefaultTtl()).toBe(constants.CACHE_DEFAULT_TTL);
      expect(service.getCacheMaxSize()).toBe(constants.CACHE_DEFAULT_MAX_SIZE);
      expect(service.getApiKeyCacheTtl()).toBe(constants.API_KEY_CACHE_TTL);

      expect(service.getHttpAgentMaxSockets()).toBe(constants.HTTP_AGENT_MAX_SOCKETS);
      expect(service.getHttpAgentMaxFreeSockets()).toBe(constants.HTTP_AGENT_MAX_FREE_SOCKETS);
      expect(service.getHttpAgentTimeout()).toBe(constants.HTTP_AGENT_TIMEOUT);
      expect(service.getHttpAgentFreeSocketTimeout()).toBe(constants.HTTP_AGENT_FREE_SOCKET_TIMEOUT);
      expect(service.getHttpAgentMaxTotalSockets()).toBe(constants.HTTP_AGENT_MAX_TOTAL_SOCKETS);
      expect(service.getHttpAgentMaxIdleTime()).toBe(constants.HTTP_AGENT_MAX_IDLE_TIME);

      expect(service.getSalvageDefaultTtl()).toBe(constants.SALVAGE_DEFAULT_TTL);
      expect(service.getSalvageMaxEntries()).toBe(constants.SALVAGE_MAX_ENTRIES);

      expect(service.getDebugLoggingMaxFileSize()).toBe(constants.DEBUG_LOGGING_DEFAULT_MAX_FILE_SIZE);
      expect(service.getDebugLoggingWriteBufferSize()).toBe(constants.DEBUG_LOGGING_DEFAULT_WRITE_BUFFER_SIZE);
      expect(service.getDebugLoggingFlushInterval()).toBe(constants.DEBUG_LOGGING_DEFAULT_FLUSH_INTERVAL);
      expect(service.getDebugLoggingMaxConcurrentWrites()).toBe(constants.DEBUG_LOGGING_DEFAULT_MAX_CONCURRENT_WRITES);
      expect(service.getDebugLoggingCleanupSchedule()).toBe(constants.DEBUG_LOGGING_DEFAULT_CLEANUP_SCHEDULE);
      expect(service.isDebugLoggingCleanupEnabled()).toBe(false);
      expect(service.isDebugLoggingCompressionEnabled()).toBe(false);

      const debugOutput = spies.debug.mock.calls.flat().join('\n');
      expect(debugOutput).toContain('LLM_CONFIG_PATH found in environment but is empty');
      expect(debugOutput).toContain('PROXY_ALLOWED_ORIGIN found in environment but is empty');
      expect(debugOutput).toContain('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES found in environment but is empty');
      expect(debugOutput).toContain("NODE_ENV found in environment: ''");

      const warnOutput = spies.warn.mock.calls.flat().join('\n');
      expect(warnOutput).toContain('PROXY_PORT found in environment:');
      expect(warnOutput).toContain('CACHE_DEFAULT_TTL invalid');
      expect(warnOutput).toContain('CACHE_MAX_SIZE invalid');
      expect(warnOutput).toContain('API_KEY_CACHE_TTL invalid');
      expect(warnOutput).toContain('HTTP_AGENT_MAX_SOCKETS invalid');
      expect(warnOutput).toContain('HTTP_AGENT_MAX_FREE_SOCKETS invalid');
      expect(warnOutput).toContain('HTTP_AGENT_TIMEOUT invalid');
      expect(warnOutput).toContain('HTTP_AGENT_FREE_SOCKET_TIMEOUT invalid');
      expect(warnOutput).toContain('HTTP_AGENT_MAX_TOTAL_SOCKETS invalid');
      expect(warnOutput).toContain('HTTP_AGENT_MAX_IDLE_TIME invalid');
      expect(warnOutput).toContain('SALVAGE_DEFAULT_TTL invalid');
      expect(warnOutput).toContain('SALVAGE_MAX_ENTRIES invalid');
      expect(warnOutput).toContain('DEBUG_LOGGING_RETENTION_DAYS invalid');
      expect(warnOutput).toContain('DEBUG_LOGGING_WRITE_BUFFER_SIZE invalid');
      expect(warnOutput).toContain('DEBUG_LOGGING_FLUSH_INTERVAL invalid');
      expect(warnOutput).toContain('DEBUG_LOGGING_MAX_CONCURRENT_WRITES invalid');
    } finally {
      appConfigModule.resetAppConfigServiceInstance();
      restoreSpies(spies);
    }
  });

  it('requires a logger on first instantiation and surfaces a clear error', async () => {
    const spies = setupConsoleSpies();
    const appConfigModule = await import('../../src/config/appConfig.js');

    try {
      appConfigModule.resetAppConfigServiceInstance();
      expect(() => appConfigModule.getAppConfigService()).toThrow(
        new Error('AppConfigService: Logger must be provided for the first instantiation.')
      );
      const errorOutput = spies.error.mock.calls.flat().join('\n');
      expect(errorOutput).toContain('Logger must be provided for the first instantiation');
    } finally {
      appConfigModule.resetAppConfigServiceInstance();
      restoreSpies(spies);
    }
  });
});
