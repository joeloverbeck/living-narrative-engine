import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { normalizeEntityLookupDebugConfig } from '../../../src/scopeDsl/core/entityLookupDebug.js';

describe('normalizeEntityLookupDebugConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns null when explicitly disabled with null', () => {
    expect(normalizeEntityLookupDebugConfig(null)).toBeNull();
  });

  it('enables debugging by default when NODE_ENV is not production', () => {
    process.env.NODE_ENV = 'test';
    expect(normalizeEntityLookupDebugConfig(undefined)).toEqual({ enabled: true });
  });

  it('disables debugging by default when NODE_ENV is production and no env override is set', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SCOPE_DSL_LOOKUP_DEBUG;
    delete process.env.SCOPE_DSL_ENTITY_LOOKUP_DEBUG;

    expect(normalizeEntityLookupDebugConfig(undefined)).toBeNull();
  });

  it('treats missing NODE_ENV as production by default', () => {
    delete process.env.NODE_ENV;
    delete process.env.SCOPE_DSL_LOOKUP_DEBUG;
    delete process.env.SCOPE_DSL_ENTITY_LOOKUP_DEBUG;

    expect(normalizeEntityLookupDebugConfig(undefined)).toBeNull();
  });

  it('respects explicit false configurations even when env requests debug', () => {
    process.env.NODE_ENV = 'development';
    process.env.SCOPE_DSL_LOOKUP_DEBUG = 'true';
    expect(normalizeEntityLookupDebugConfig(false)).toBeNull();
  });

  it('honors direct enablement through env shortcut variable', () => {
    process.env.NODE_ENV = 'production';
    process.env.SCOPE_DSL_ENTITY_LOOKUP_DEBUG = 'true';

    expect(normalizeEntityLookupDebugConfig(undefined)).toEqual({ enabled: true });
  });

  it('honors explicit disablement in custom configuration objects', () => {
    const config = normalizeEntityLookupDebugConfig({ enabled: false, cacheEvents: () => {} });
    expect(config).toBeNull();
  });

  it('enables debugging when explicit flag is true', () => {
    expect(normalizeEntityLookupDebugConfig(true)).toEqual({ enabled: true });
  });

  it('honors environment overrides in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SCOPE_DSL_LOOKUP_DEBUG = 'true';
    expect(normalizeEntityLookupDebugConfig(undefined)).toEqual({ enabled: true });

    process.env.SCOPE_DSL_LOOKUP_DEBUG = 'false';
    expect(normalizeEntityLookupDebugConfig(undefined)).toBeNull();
  });

  it('keeps custom configuration objects intact', () => {
    process.env.NODE_ENV = 'production';
    const handler = () => {};
    const strategyFactory = () => {};
    const config = normalizeEntityLookupDebugConfig({ cacheEvents: handler, strategyFactory });
    expect(config).toMatchObject({ enabled: true, cacheEvents: handler, strategyFactory });
  });

  it('falls back to disabled when process is unavailable', () => {
    const originalProcess = global.process;
    // eslint-disable-next-line no-global-assign
    process = undefined;

    expect(normalizeEntityLookupDebugConfig(undefined)).toBeNull();

    // eslint-disable-next-line no-global-assign
    process = originalProcess;
  });
});
