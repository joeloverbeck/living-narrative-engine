import { describe, it, expect } from '@jest/globals';
import { TestEnvironmentProvider } from '../../../src/configuration/TestEnvironmentProvider.js';

describe('TestEnvironmentProvider', () => {
  it('provides test defaults when no configuration is supplied', () => {
    const provider = new TestEnvironmentProvider();

    expect(provider.getEnvironment()).toEqual({
      NODE_ENV: 'test',
      IS_PRODUCTION: false,
      IS_DEVELOPMENT: false,
      IS_TEST: true,
    });
    expect(provider.isProduction()).toBe(false);
    expect(provider.isDevelopment()).toBe(false);
    expect(provider.isTest()).toBe(true);
  });

  it('uses the supplied configuration for environment flags', () => {
    const provider = new TestEnvironmentProvider({
      NODE_ENV: 'production',
      IS_PRODUCTION: true,
      IS_DEVELOPMENT: false,
      IS_TEST: false,
    });

    expect(provider.getEnvironment()).toEqual({
      NODE_ENV: 'production',
      IS_PRODUCTION: true,
      IS_DEVELOPMENT: false,
      IS_TEST: false,
    });
    expect(provider.isProduction()).toBe(true);
    expect(provider.isDevelopment()).toBe(false);
    expect(provider.isTest()).toBe(false);
  });

  it('returns a defensive copy of the environment object', () => {
    const provider = new TestEnvironmentProvider();
    const environment = provider.getEnvironment();

    environment.IS_TEST = false;
    environment.NODE_ENV = 'mutation';

    expect(provider.isTest()).toBe(true);
    expect(provider.getEnvironment()).toEqual({
      NODE_ENV: 'test',
      IS_PRODUCTION: false,
      IS_DEVELOPMENT: false,
      IS_TEST: true,
    });
  });

  it('merges updates while preserving unspecified values', () => {
    const provider = new TestEnvironmentProvider({
      NODE_ENV: 'development',
      IS_PRODUCTION: false,
      IS_DEVELOPMENT: true,
      IS_TEST: false,
    });

    provider.updateEnvironment({
      NODE_ENV: 'production',
      IS_PRODUCTION: true,
    });

    expect(provider.getEnvironment()).toEqual({
      NODE_ENV: 'production',
      IS_PRODUCTION: true,
      IS_DEVELOPMENT: true,
      IS_TEST: false,
    });
    expect(provider.isProduction()).toBe(true);
    expect(provider.isDevelopment()).toBe(true);
    expect(provider.isTest()).toBe(false);

    provider.updateEnvironment({
      IS_DEVELOPMENT: false,
      IS_TEST: true,
    });

    expect(provider.getEnvironment()).toEqual({
      NODE_ENV: 'production',
      IS_PRODUCTION: true,
      IS_DEVELOPMENT: false,
      IS_TEST: true,
    });
    expect(provider.isDevelopment()).toBe(false);
    expect(provider.isTest()).toBe(true);
  });
});
