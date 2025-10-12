import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  jest,
} from '@jest/globals';
import {
  SALVAGE_DEFAULT_TTL,
  SALVAGE_MAX_ENTRIES,
  DEBUG_LOGGING_DEFAULT_WRITE_BUFFER_SIZE,
  DEBUG_LOGGING_DEFAULT_FLUSH_INTERVAL,
  DEBUG_LOGGING_DEFAULT_MAX_CONCURRENT_WRITES,
} from '../src/config/constants.js';

const ORIGINAL_ENV = { ...process.env };

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const loadService = async (logger) => {
  const mod = await import('../src/config/appConfig.js');
  mod.resetAppConfigServiceInstance();
  return mod.getAppConfigService(logger);
};

beforeEach(() => {
  jest.resetModules();
  process.env = {};
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('AppConfigService salvage and debug logging invalid values', () => {
  test('falls back to default salvage TTL when env value is invalid', async () => {
    process.env.SALVAGE_DEFAULT_TTL = 'not-a-number';
    const logger = createLogger();

    const service = await loadService(logger);

    expect(service.getSalvageDefaultTtl()).toBe(SALVAGE_DEFAULT_TTL);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('SALVAGE_DEFAULT_TTL invalid')
    );
  });

  test('falls back to default salvage max entries when env value is invalid', async () => {
    process.env.SALVAGE_MAX_ENTRIES = '-5';
    const logger = createLogger();

    const service = await loadService(logger);

    expect(service.getSalvageMaxEntries()).toBe(SALVAGE_MAX_ENTRIES);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('SALVAGE_MAX_ENTRIES invalid')
    );
  });

  test('uses default write buffer size when debug logging value is invalid', async () => {
    process.env.DEBUG_LOGGING_WRITE_BUFFER_SIZE = '0';
    const logger = createLogger();

    const service = await loadService(logger);

    expect(service.getDebugLoggingWriteBufferSize()).toBe(
      DEBUG_LOGGING_DEFAULT_WRITE_BUFFER_SIZE
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('DEBUG_LOGGING_WRITE_BUFFER_SIZE invalid')
    );
  });

  test('uses default flush interval when debug logging value is below minimum', async () => {
    process.env.DEBUG_LOGGING_FLUSH_INTERVAL = '50';
    const logger = createLogger();

    const service = await loadService(logger);

    expect(service.getDebugLoggingFlushInterval()).toBe(
      DEBUG_LOGGING_DEFAULT_FLUSH_INTERVAL
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('DEBUG_LOGGING_FLUSH_INTERVAL invalid')
    );
  });

  test('uses default max concurrent writes when debug logging value is invalid', async () => {
    process.env.DEBUG_LOGGING_MAX_CONCURRENT_WRITES = '0';
    const logger = createLogger();

    const service = await loadService(logger);

    expect(service.getDebugLoggingMaxConcurrentWrites()).toBe(
      DEBUG_LOGGING_DEFAULT_MAX_CONCURRENT_WRITES
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('DEBUG_LOGGING_MAX_CONCURRENT_WRITES invalid')
    );
  });
});
