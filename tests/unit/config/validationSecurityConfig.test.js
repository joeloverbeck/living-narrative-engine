import { describe, it, expect, afterEach } from '@jest/globals';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

const restoreNodeEnv = () => {
  if (ORIGINAL_NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  }
};

const loadModule = async () => {
  jest.resetModules();
  return await import('../../../src/config/validationSecurityConfig.js');
};

afterEach(() => {
  restoreNodeEnv();
  jest.resetModules();
});

describe('validationSecurityConfig', () => {
  it('provides baseline configuration when no environment override is set', async () => {
    delete process.env.NODE_ENV;
    const module = await loadModule();
    const { validationSecurityConfig, getSecurityConfig, default: defaultExport } = module;

    const config = getSecurityConfig();

    expect(defaultExport).toBe(validationSecurityConfig);
    expect(config.validationPolicies.strictMode).toBe(false);
    expect(config.resources.maxMemoryUsage).toBe(512 * 1024 * 1024);
    expect(config.audit.enabled).toBe(true);
    expect(config.rateLimiting.enabled).toBe(true);
  });

  it('tightens policies in production environments', async () => {
    process.env.NODE_ENV = 'production';
    const { getSecurityConfig } = await loadModule();

    const config = getSecurityConfig();

    expect(config.validationPolicies.strictMode).toBe(true);
    expect(config.validationPolicies.quarantineSuspiciousMods).toBe(true);
    expect(config.resources.maxMemoryUsage).toBe(256 * 1024 * 1024);
    expect(config.circuitBreaker.failureThreshold).toBe(3);
  });

  it('relaxes limits for test environments to speed up suites', async () => {
    process.env.NODE_ENV = 'test';
    const { getSecurityConfig } = await loadModule();

    const config = getSecurityConfig();

    expect(config.resources.maxProcessingTime).toBe(5000);
    expect(config.resources.maxMemoryUsage).toBe(128 * 1024 * 1024);
    expect(config.audit.enabled).toBe(false);
    expect(config.rateLimiting.enabled).toBe(false);
  });
});
