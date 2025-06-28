import {
  describe,
  test,
  expect,
  beforeEach,
  afterAll,
  jest,
} from '@jest/globals';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

const loadService = async (logger) => {
  const mod = await import('../src/config/appConfig.js');
  return mod.getAppConfigService(logger);
};

describe('AppConfigService additional scenarios', () => {
  test('defaults values when env vars are missing', async () => {
    delete process.env.PROXY_PORT;
    delete process.env.PROXY_ALLOWED_ORIGIN;
    const logger = createLogger();
    const service = await loadService(logger);
    expect(service.getProxyPort()).toBe(3001);
    expect(service.isProxyPortDefaulted()).toBe(true);
    expect(service.getAllowedOriginsArray()).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('PROXY_PORT not found')
    );
  });

  test('logs when allowed origin env var is empty string', async () => {
    process.env.PROXY_ALLOWED_ORIGIN = '';
    const logger = createLogger();
    await loadService(logger);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'PROXY_ALLOWED_ORIGIN found in environment but is empty'
      )
    );
  });

  test('throws if getAppConfigService called without logger initially', async () => {
    const mod = await import('../src/config/appConfig.js');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => mod.getAppConfigService()).toThrow(
      'AppConfigService: Logger must be provided'
    );
    expect(spy).toHaveBeenCalledWith(
      'AppConfigService: Critical - Logger must be provided for the first instantiation of AppConfigService.'
    );
    spy.mockRestore();
  });
});
