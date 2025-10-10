import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DefinitionCache from '../../../../src/entities/services/definitionCache.js';
import {
  createSimpleMockDataRegistry,
  createMockLogger,
} from '../../../common/mockFactories/index.js';

jest.mock('../../../../src/entities/utils/definitionLookup.js', () => ({
  getDefinition: jest.fn(),
}));

const { getDefinition: mockLookupDefinition } = jest.requireMock(
  '../../../../src/entities/utils/definitionLookup.js'
);

describe('DefinitionCache additional coverage', () => {
  let registry;
  let logger;
  let cache;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = createSimpleMockDataRegistry();
    logger = createMockLogger();
    cache = new DefinitionCache({ registry, logger });
  });

  it('warns and skips caching when set receives an invalid identifier', () => {
    cache.set('', { id: 'noop' });

    expect(logger.warn).toHaveBeenCalledWith(
      'Invalid definition ID provided to set()'
    );
    expect(cache.has('')).toBe(false);
  });

  it('warns and skips caching when set receives a falsy definition', () => {
    cache.set('example', null);

    expect(logger.warn).toHaveBeenCalledWith(
      'Invalid definition provided to set()'
    );
    expect(cache.has('example')).toBe(false);
  });

  it('caches valid definitions via set, supports has/clear, and avoids lookups', () => {
    const definition = { id: 'agent:test' };
    mockLookupDefinition.mockImplementation(() => {
      throw new Error('lookup should not run when value is cached');
    });

    cache.set('agent:test', definition);

    expect(cache.has('agent:test')).toBe(true);
    expect(cache.get('agent:test')).toBe(definition);
    expect(logger.debug).toHaveBeenCalledWith('Definition cached: agent:test');

    cache.clear();
    expect(cache.has('agent:test')).toBe(false);
  });

  it('logs and returns null when lookupDefinition throws an error', () => {
    mockLookupDefinition.mockImplementation(() => {
      throw new Error('lookup exploded');
    });

    const result = cache.get('missing:definition');

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith('lookup exploded');
  });
});
