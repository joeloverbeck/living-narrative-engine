import { describe, it, expect } from '@jest/globals';
import { resolveWrapper } from '../../../src/utils/wrapperUtils.js';

class MockResolver {
  resolve(text, ctx) {
    return `[${text}|${ctx.key}]`;
  }
}

describe('resolveWrapper', () => {
  const ctx = { key: 'A' };
  const resolver = new MockResolver();

  it('defaults prefix and suffix when not provided', () => {
    const result = resolveWrapper({}, resolver, ctx);
    expect(result).toEqual({ prefix: '[|A]', suffix: '[|A]' });
  });

  it('resolves custom prefix only', () => {
    const result = resolveWrapper({ prefix: 'P' }, resolver, ctx);
    expect(result).toEqual({ prefix: '[P|A]', suffix: '[|A]' });
  });

  it('resolves custom suffix only', () => {
    const result = resolveWrapper({ suffix: 'S' }, resolver, ctx);
    expect(result).toEqual({ prefix: '[|A]', suffix: '[S|A]' });
  });

  it('resolves both prefix and suffix', () => {
    const result = resolveWrapper({ prefix: 'P', suffix: 'S' }, resolver, ctx);
    expect(result).toEqual({ prefix: '[P|A]', suffix: '[S|A]' });
  });

  it('handles null or undefined wrapper inputs', () => {
    const resNull = resolveWrapper(null, resolver, ctx);
    const resUndefined = resolveWrapper(undefined, resolver, ctx);
    expect(resNull).toEqual({ prefix: '[|A]', suffix: '[|A]' });
    expect(resUndefined).toEqual({ prefix: '[|A]', suffix: '[|A]' });
  });
});
