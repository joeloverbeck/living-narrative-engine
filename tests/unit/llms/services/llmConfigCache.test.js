import { describe, it, expect } from '@jest/globals';
import { LlmConfigCache } from '../../../../src/llms/services/LlmConfigCache.js';

describe('LlmConfigCache', () => {
  const validCfg = {
    configId: 'id1',
    modelIdentifier: 'gpt',
    promptElements: [],
    promptAssemblyOrder: [],
  };

  it('stores and returns copies of valid configs', () => {
    const cache = new LlmConfigCache();
    cache.addOrUpdateConfigs([validCfg]);
    const result = cache.getConfig('id1');
    expect(result).toEqual(validCfg);
    expect(result).not.toBe(validCfg);
  });

  it('ignores invalid configs and invalid ids', () => {
    const cache = new LlmConfigCache();
    cache.addOrUpdateConfigs([
      {
        configId: '',
        modelIdentifier: '',
        promptElements: null,
        promptAssemblyOrder: [],
      },
    ]);
    expect(cache.getConfig('')).toBeUndefined();
  });

  it('handles non-array input gracefully', () => {
    const cache = new LlmConfigCache();
    cache.addOrUpdateConfigs(null);
    expect(cache.getConfig('id1')).toBeUndefined();
  });

  it('can reset the cache', () => {
    const cache = new LlmConfigCache();
    cache.addOrUpdateConfigs([validCfg]);
    cache.resetCache();
    expect(cache.getConfig('id1')).toBeUndefined();
  });
});
