import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

const MODULE_PATH = '../../../src/config/endpointConfig.js';

describe('EndpointConfig additional coverage', () => {
  let originalFetch;
  let originalProxyHost;
  let originalProxyPort;
  let originalProxyHttps;
  let originalProcessEnv;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalProxyHost = global.__PROXY_HOST__;
    originalProxyPort = global.__PROXY_PORT__;
    originalProxyHttps = global.__PROXY_USE_HTTPS__;
    originalProcessEnv = { ...process.env };
    global.__PROXY_HOST__ = undefined;
    global.__PROXY_PORT__ = undefined;
    global.__PROXY_USE_HTTPS__ = undefined;
  });

  afterEach(async () => {
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete global.fetch;
    }

    global.__PROXY_HOST__ = originalProxyHost;
    global.__PROXY_PORT__ = originalProxyPort;
    global.__PROXY_USE_HTTPS__ = originalProxyHttps;

    // Restore process.env keys
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    for (const [key, value] of Object.entries(originalProcessEnv)) {
      process.env[key] = value;
    }

    const { resetEndpointConfig } = await import(MODULE_PATH);
    resetEndpointConfig();
    jest.resetModules();
  });

  it('returns true when health endpoint responds successfully', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    const { getEndpointConfig, resetEndpointConfig } = await import(
      MODULE_PATH
    );
    resetEndpointConfig();
    const config = getEndpointConfig();

    const result = await config.testConnectivity();

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/health', {
      method: 'GET',
      timeout: 5000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to debug endpoint when health check fails', async () => {
    const fallbackResponse = { status: 204 };
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('primary failed'))
      .mockResolvedValueOnce(fallbackResponse);
    global.fetch = fetchMock;

    const { getEndpointConfig, resetEndpointConfig } = await import(
      MODULE_PATH
    );
    resetEndpointConfig();
    const config = getEndpointConfig();

    const result = await config.testConnectivity();

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3001/health',
      {
        method: 'GET',
        timeout: 5000,
      }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3001/api/debug-log',
      {
        method: 'OPTIONS',
        timeout: 5000,
      }
    );
  });

  it('returns false when both connectivity attempts fail', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('health error'))
      .mockRejectedValueOnce(new Error('debug error'));
    global.fetch = fetchMock;

    const { getEndpointConfig, resetEndpointConfig } = await import(
      MODULE_PATH
    );
    resetEndpointConfig();
    const config = getEndpointConfig();

    const result = await config.testConnectivity();

    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('configures production defaults when environment variables are missing', async () => {
    delete process.env.PROXY_HOST;
    delete process.env.PROXY_PORT;
    delete process.env.PROXY_USE_HTTPS;

    const { default: EndpointConfig, resetEndpointConfig } = await import(
      MODULE_PATH
    );
    resetEndpointConfig();

    const config = EndpointConfig.forEnvironment('production');

    expect(config.getBaseUrl()).toBe('http://localhost:3001');
    expect(process.env.PROXY_USE_HTTPS).toBe('false');
  });

  it('reuses existing port when configuring test environment', async () => {
    process.env.PROXY_PORT = '4555';

    const { default: EndpointConfig, resetEndpointConfig } = await import(
      MODULE_PATH
    );
    resetEndpointConfig();

    const config = EndpointConfig.forEnvironment('test');

    expect(config.getBaseUrl()).toBe('http://localhost:4555');
    expect(process.env.PROXY_PORT).toBe('4555');
  });

  it('throws when configuring an unknown environment', async () => {
    const { default: EndpointConfig, resetEndpointConfig } = await import(
      MODULE_PATH
    );
    resetEndpointConfig();

    expect(() => EndpointConfig.forEnvironment('staging')).toThrow(
      'Unknown environment: staging'
    );
  });
});
