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
  process.env = { ...ORIGINAL_ENV }; // reset env for each test
});

afterAll(() => {
  process.env = ORIGINAL_ENV; // restore
});

// Helper to load module fresh each time
const loadService = async (logger) => {
  const mod = await import('../src/config/appConfig.js');
  return mod.getAppConfigService(logger);
};

describe('AppConfigService', () => {
  test('reads explicit environment variables', async () => {
    process.env.PROXY_PORT = '8080';
    process.env.LLM_CONFIG_PATH = '/tmp/llm.json';
    process.env.PROXY_ALLOWED_ORIGIN = 'http://a.com';
    process.env.PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES = '/keys';

    const logger = createLogger();
    const service = await loadService(logger);

    expect(service.getProxyPort()).toBe(8080);
    expect(service.isProxyPortDefaulted()).toBe(false);
    expect(service.getLlmConfigPath()).toBe('/tmp/llm.json');
    expect(service.getProxyAllowedOrigin()).toBe('http://a.com');
    expect(service.getAllowedOriginsArray()).toEqual(['http://a.com']);
    expect(service.getProxyProjectRootPathForApiKeyFiles()).toBe('/keys');
  });

  test('falls back to default port when invalid', async () => {
    process.env.PROXY_PORT = 'abc';
    const logger = createLogger();
    const service = await loadService(logger);

    expect(service.getProxyPort()).toBe(3001);
    expect(service.isProxyPortDefaulted()).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });

  test('parses allowed origins list', async () => {
    process.env.PROXY_ALLOWED_ORIGIN = 'https://one.com , http://two.com';
    const service = await loadService(createLogger());

    expect(service.getAllowedOriginsArray()).toEqual([
      'https://one.com',
      'http://two.com',
    ]);
  });
});
