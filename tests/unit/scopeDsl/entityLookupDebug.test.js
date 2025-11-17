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

  it('enables debugging by default when NODE_ENV is not production', () => {
    process.env.NODE_ENV = 'test';
    expect(normalizeEntityLookupDebugConfig(undefined)).toEqual({ enabled: true });
  });

  it('respects explicit false configurations even when env requests debug', () => {
    process.env.NODE_ENV = 'development';
    process.env.SCOPE_DSL_LOOKUP_DEBUG = 'true';
    expect(normalizeEntityLookupDebugConfig(false)).toBeNull();
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
});
