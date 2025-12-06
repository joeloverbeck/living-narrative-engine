import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';

import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';

const createTestLogger = () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
};

describe('AppConfigService string environment logging integration', () => {
  const originalEnv = { ...process.env };
  let logger;

  const applyEnv = (overrides) => {
    const preservedKeys = Object.keys(process.env);
    for (const key of preservedKeys) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }

    for (const [key, value] of Object.entries(originalEnv)) {
      process.env[key] = value;
    }

    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };

  beforeEach(() => {
    logger = createTestLogger();
    resetAppConfigServiceInstance();
  });

  afterEach(() => {
    applyEnv({});
    resetAppConfigServiceInstance();
  });

  it('records explicit debug output when string env vars are present but empty', () => {
    applyEnv({
      NODE_ENV: 'test',
      PROXY_PORT: '4301',
      LLM_CONFIG_PATH: '',
      PROXY_ALLOWED_ORIGIN: '',
      PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES: '',
    });

    const appConfig = getAppConfigService(logger);

    expect(appConfig.getLlmConfigPath()).toBe('');
    expect(appConfig.getAllowedOriginsArray()).toEqual([]);
    expect(appConfig.getProxyProjectRootPathForApiKeyFiles()).toBe('');

    const debugMessages = logger.debug.mock.calls
      .map(([message]) => message)
      .filter(Boolean);

    expect(
      debugMessages.some((message) =>
        message.includes(
          "AppConfigService: LLM_CONFIG_PATH found in environment but is empty. Current effective value: ''."
        )
      )
    ).toBe(true);

    expect(
      debugMessages.some((message) =>
        message.includes(
          "AppConfigService: PROXY_ALLOWED_ORIGIN found in environment but is empty. Current effective value: ''."
        )
      )
    ).toBe(true);

    expect(
      debugMessages.some((message) =>
        message.includes(
          "AppConfigService: PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES found in environment but is empty. Current effective value: ''."
        )
      )
    ).toBe(true);
  });

  it('announces default handling when optional string env vars are undefined', () => {
    applyEnv({
      NODE_ENV: 'test',
      PROXY_PORT: '4302',
      LLM_CONFIG_PATH: undefined,
      PROXY_ALLOWED_ORIGIN: undefined,
      PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES: undefined,
    });

    const appConfig = getAppConfigService(logger);

    expect(appConfig.getLlmConfigPath()).toBeNull();
    expect(appConfig.getAllowedOriginsArray()).toEqual([]);
    expect(appConfig.getProxyProjectRootPathForApiKeyFiles()).toBeNull();

    const debugMessages = logger.debug.mock.calls
      .map(([message]) => message)
      .filter(Boolean);

    expect(
      debugMessages.some((message) =>
        message.includes(
          "AppConfigService: LLM_CONFIG_PATH not set in environment. LlmConfigService will use its default path. Effective value: 'null'."
        )
      )
    ).toBe(true);

    expect(
      debugMessages.some((message) =>
        message.includes(
          "AppConfigService: PROXY_ALLOWED_ORIGIN not set in environment. CORS will not be specifically configured by the proxy based on this variable. Effective value: 'null'."
        )
      )
    ).toBe(true);

    expect(
      debugMessages.some((message) =>
        message.includes(
          "AppConfigService: PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES not set in environment. API key file retrieval relative to a project root will not be available unless this is set. Effective value: 'null'."
        )
      )
    ).toBe(true);
  });

  it('describes explicit overrides when env vars contain concrete values', () => {
    applyEnv({
      NODE_ENV: 'test',
      PROXY_PORT: '4303',
      LLM_CONFIG_PATH: '/custom/path/llm-configs.json',
      PROXY_ALLOWED_ORIGIN: 'https://alpha.example,https://beta.example',
      PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES: '/project/root',
    });

    const appConfig = getAppConfigService(logger);

    expect(appConfig.getLlmConfigPath()).toBe('/custom/path/llm-configs.json');
    expect(appConfig.getAllowedOriginsArray()).toEqual([
      'https://alpha.example',
      'https://beta.example',
    ]);
    expect(appConfig.getProxyProjectRootPathForApiKeyFiles()).toBe(
      '/project/root'
    );

    const debugMessages = logger.debug.mock.calls
      .map(([message]) => message)
      .filter(Boolean);

    expect(
      debugMessages.some((message) =>
        message?.includes(
          "AppConfigService: LLM_CONFIG_PATH found in environment: '/custom/path/llm-configs.json'. Effective value: '/custom/path/llm-configs.json'."
        )
      )
    ).toBe(true);

    expect(
      debugMessages.some((message) =>
        message?.includes(
          "AppConfigService: PROXY_ALLOWED_ORIGIN found in environment: 'https://alpha.example,https://beta.example'. Effective value: 'https://alpha.example,https://beta.example'."
        )
      )
    ).toBe(true);

    expect(
      debugMessages.some((message) =>
        message?.includes(
          "AppConfigService: PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES found in environment: '/project/root'. Effective value: '/project/root'."
        )
      )
    ).toBe(true);
  });

  it('logs null-effective outcomes when an empty env value is sanitized by downstream services', () => {
    applyEnv({
      NODE_ENV: 'test',
      PROXY_PORT: '4304',
      LLM_CONFIG_PATH: '',
    });

    const appConfig = getAppConfigService(logger);

    // Remove initialization chatter so the new log entry is easy to assert.
    logger.debug.mockClear();

    appConfig._logStringEnvVarStatus(
      'LLM_CONFIG_PATH',
      '',
      null,
      'Downstream sanitization restored default behaviour'
    );

    const recentMessages = logger.debug.mock.calls
      .map(([message]) => message)
      .filter(Boolean);

    expect(
      recentMessages.some((message) =>
        message.includes(
          "AppConfigService: LLM_CONFIG_PATH found in environment but is empty. Current effective value: 'null'."
        )
      )
    ).toBe(true);
  });
});
