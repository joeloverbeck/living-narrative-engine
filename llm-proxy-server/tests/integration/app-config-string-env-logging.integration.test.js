/**
 * @file app-config-string-env-logging.integration.test.js
 * @description Integration tests ensuring AppConfigService logs string environment variable states accurately.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ConsoleLogger } from '../../src/consoleLogger.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';

function createCapturingLogger() {
  const entries = [];
  const record = (level) => (message, ...args) => {
    entries.push({ level, message, args });
  };

  return {
    entries,
    debug: jest.fn(record('debug')),
    info: jest.fn(record('info')),
    warn: jest.fn(record('warn')),
    error: jest.fn(record('error')),
  };
}

function restoreEnvironment(originalEnv) {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value;
  }
}

describe('AppConfigService string environment logging integration', () => {
  const originalEnv = { ...process.env };
  let logger;

  beforeEach(() => {
    resetAppConfigServiceInstance();
    logger = createCapturingLogger();
  });

  afterEach(() => {
    resetAppConfigServiceInstance();
    restoreEnvironment(originalEnv);
  });

  it('records explicit string values when environment variables are present', () => {
    process.env.LLM_CONFIG_PATH = '/opt/llm/config.json';
    process.env.PROXY_ALLOWED_ORIGIN = 'https://alpha.example,https://beta.example';
    process.env.PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES = '/srv/app';

    const service = getAppConfigService(logger);

    expect(service.getLlmConfigPath()).toBe('/opt/llm/config.json');
    expect(service.getProxyProjectRootPathForApiKeyFiles()).toBe('/srv/app');

    const debugMessages = logger.debug.mock.calls.map(([message]) => message);

    expect(debugMessages).toEqual(
      expect.arrayContaining([
        "AppConfigService: LLM_CONFIG_PATH found in environment: '/opt/llm/config.json'. Effective value: '/opt/llm/config.json'.",
        "AppConfigService: PROXY_ALLOWED_ORIGIN found in environment: 'https://alpha.example,https://beta.example'. Effective value: 'https://alpha.example,https://beta.example'.",
        "AppConfigService: PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES found in environment: '/srv/app'. Effective value: '/srv/app'.",
      ])
    );
  });

  it('logs explicit notice when string environment variables are empty', () => {
    process.env.LLM_CONFIG_PATH = '';
    process.env.PROXY_ALLOWED_ORIGIN = '';
    process.env.PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES = '';

    const service = getAppConfigService(logger);

    expect(service.getLlmConfigPath()).toBe('');
    expect(service.getProxyProjectRootPathForApiKeyFiles()).toBe('');

    const debugMessages = logger.debug.mock.calls.map(([message]) => message);

    expect(debugMessages).toEqual(
      expect.arrayContaining([
        "AppConfigService: LLM_CONFIG_PATH found in environment but is empty. Current effective value: ''.",
        "AppConfigService: PROXY_ALLOWED_ORIGIN found in environment but is empty. Current effective value: ''.",
        "AppConfigService: PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES found in environment but is empty. Current effective value: ''.",
      ])
    );
  });

  it('logs defaults when optional string environment variables are missing', () => {
    delete process.env.LLM_CONFIG_PATH;
    delete process.env.PROXY_ALLOWED_ORIGIN;
    delete process.env.PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES;

    const service = getAppConfigService(logger);

    expect(service.getLlmConfigPath()).toBeNull();
    expect(service.getProxyProjectRootPathForApiKeyFiles()).toBeNull();

    const debugMessages = logger.debug.mock.calls.map(([message]) => message);

    expect(debugMessages).toEqual(
      expect.arrayContaining([
        "AppConfigService: LLM_CONFIG_PATH not set in environment. LlmConfigService will use its default path. Effective value: 'null'.",
        "AppConfigService: PROXY_ALLOWED_ORIGIN not set in environment. CORS will not be specifically configured by the proxy based on this variable. Effective value: 'null'.",
        "AppConfigService: PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES not set in environment. API key file retrieval relative to a project root will not be available unless this is set. Effective value: 'null'.",
      ])
    );
  });

  it('remains compatible with the production console logger instance', () => {
    const consoleLogger = new ConsoleLogger();

    process.env.LLM_CONFIG_PATH = '/var/app/llm-config.json';
    process.env.PROXY_ALLOWED_ORIGIN = 'https://prod.example';
    process.env.PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES = '/var/app';

    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

    try {
      getAppConfigService(consoleLogger);

      const capturedMessages = debugSpy.mock.calls
        .map(([message]) => String(message))
        .join('\n');

      expect(capturedMessages).toContain('AppConfigService: LLM_CONFIG_PATH');
      expect(capturedMessages).toContain('AppConfigService: PROXY_ALLOWED_ORIGIN');
      expect(capturedMessages).toContain('AppConfigService: PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES');
    } finally {
      debugSpy.mockRestore();
    }
  });
});
