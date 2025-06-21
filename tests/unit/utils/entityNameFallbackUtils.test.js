import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { resolveEntityNameFallback } from '../../../src/utils/entityNameFallbackUtils.js';
import { getEntityDisplayName } from '../../../src/utils/entityUtils.js';

jest.mock('../../../src/utils/entityUtils.js', () => ({
  getEntityDisplayName: jest.fn(),
}));

const logger = { debug: jest.fn() };

describe('resolveEntityNameFallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns undefined when resolutionRoot is missing', () => {
    expect(resolveEntityNameFallback('actor.name', null)).toBeUndefined();
    expect(resolveEntityNameFallback('actor.name', undefined)).toBeUndefined();
    expect(getEntityDisplayName).not.toHaveBeenCalled();
  });

  it('returns undefined for unknown placeholder path', () => {
    const root = {};
    expect(resolveEntityNameFallback('foo.name', root)).toBeUndefined();
    expect(getEntityDisplayName).not.toHaveBeenCalled();
  });

  it('returns undefined when referenced entity is missing', () => {
    const root = { actor: null };
    expect(resolveEntityNameFallback('actor.name', root)).toBeUndefined();
    expect(getEntityDisplayName).not.toHaveBeenCalled();
  });

  it('passes entity through when it already has getComponentData', () => {
    const entity = { id: 'id1', getComponentData: jest.fn() };
    getEntityDisplayName.mockReturnValue('Hero');
    const result = resolveEntityNameFallback(
      'target.name',
      { target: entity },
      logger
    );
    expect(result).toBe('Hero');
    expect(getEntityDisplayName).toHaveBeenCalledWith(
      entity,
      undefined,
      logger
    );
    expect(logger.debug).toHaveBeenCalled();
  });

  it('adapts entity lacking getComponentData', () => {
    const entity = { id: 'id2', components: { foo: { bar: 'baz' } } };
    getEntityDisplayName.mockReturnValue('Adapted');
    const result = resolveEntityNameFallback(
      'actor.name',
      { actor: entity },
      logger
    );
    expect(result).toBe('Adapted');
    expect(getEntityDisplayName).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'id2',
        components: entity.components,
        getComponentData: expect.any(Function),
      }),
      undefined,
      logger
    );
    // ensure adapter not using same reference when missing method
    expect(getEntityDisplayName.mock.calls[0][0]).not.toBe(entity);
    expect(logger.debug).toHaveBeenCalled();
  });

  it('returns undefined when name cannot be resolved', () => {
    const entity = { id: 'id3', getComponentData: jest.fn() };
    getEntityDisplayName.mockReturnValue(undefined);
    const result = resolveEntityNameFallback(
      'actor.name',
      { actor: entity },
      logger
    );
    expect(result).toBeUndefined();
    expect(logger.debug).not.toHaveBeenCalled();
  });
});
