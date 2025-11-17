import { describe, expect, it, jest } from '@jest/globals';
import { createEntityLookupStrategy } from '../../../src/scopeDsl/core/entityLookupStrategy.js';

describe('entityLookupStrategy', () => {
  it('prefers getEntityInstance when available', () => {
    const entity = { id: 'alpha' };
    const entityManager = {
      getEntityInstance: jest.fn().mockReturnValue(entity),
      getEntity: jest.fn().mockReturnValue({ id: 'beta' }),
    };

    const strategy = createEntityLookupStrategy({ entityManager });
    const result = strategy.resolve('alpha');

    expect(result).toBe(entity);
    expect(entityManager.getEntityInstance).toHaveBeenCalledWith('alpha');
    expect(entityManager.getEntity).not.toHaveBeenCalled();
    expect(strategy.describeOrder()).toEqual(['getEntityInstance', 'getEntity']);
  });

  it('falls back to getEntity when getEntityInstance returns undefined', () => {
    const fallback = { id: 'beta' };
    const entityManager = {
      getEntityInstance: jest.fn().mockReturnValue(undefined),
      getEntity: jest.fn().mockReturnValue(fallback),
    };

    const strategy = createEntityLookupStrategy({ entityManager });
    const result = strategy.resolve('beta');

    expect(result).toBe(fallback);
    expect(entityManager.getEntityInstance).toHaveBeenCalledWith('beta');
    expect(entityManager.getEntity).toHaveBeenCalledWith('beta');
    expect(strategy.describeOrder()).toEqual(['getEntityInstance', 'getEntity']);
  });

  it('throws a developer assertion when entity manager lacks lookup helpers (non-production)', () => {
    const entityManager = { getEntities: jest.fn() };

    expect(() => createEntityLookupStrategy({ entityManager })).toThrow(
      /expects runtimeCtx\.entityManager to expose/
    );
  });
});
