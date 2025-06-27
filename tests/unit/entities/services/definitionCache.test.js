import { describe, it, expect, beforeEach } from '@jest/globals';
import DefinitionCache from '../../../../src/entities/services/definitionCache.js';
import {
  createSimpleMockDataRegistry,
  createMockLogger,
} from '../../../common/mockFactories/index.js';

describe('DefinitionCache', () => {
  let registry;
  let logger;
  let cache;

  beforeEach(() => {
    registry = createSimpleMockDataRegistry();
    logger = createMockLogger();
    cache = new DefinitionCache({ registry, logger });
  });

  it('caches definitions after first lookup', () => {
    const def = { id: 'foo' };
    registry.getEntityDefinition.mockReturnValue(def);

    const first = cache.get('foo');
    const second = cache.get('foo');

    expect(first).toBe(def);
    expect(second).toBe(def);
    expect(registry.getEntityDefinition).toHaveBeenCalledTimes(1);
  });

  it('returns null when definition lookup fails', () => {
    registry.getEntityDefinition.mockReturnValue(undefined);

    const result = cache.get('missing');
    expect(result).toBeNull();
  });
});
