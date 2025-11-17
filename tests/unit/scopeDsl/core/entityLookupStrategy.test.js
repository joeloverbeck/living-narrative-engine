import { describe, expect, it, jest } from '@jest/globals';
import { createEntityLookupStrategy } from '../../../../src/scopeDsl/core/entityLookupStrategy.js';

describe('createEntityLookupStrategy', () => {
  it('always calls the latest getEntityInstance implementation', () => {
    const entityManager = {
      getEntityInstance(entityId) {
        return { id: `initial-${entityId}` };
      },
    };

    const strategy = createEntityLookupStrategy({ entityManager });

    expect(strategy.resolve('alpha')).toEqual({ id: 'initial-alpha' });

    const spy = jest
      .spyOn(entityManager, 'getEntityInstance')
      .mockImplementation((entityId) => ({ id: `patched-${entityId}` }));

    const nextResult = strategy.resolve('beta');

    expect(spy).toHaveBeenCalledWith('beta');
    expect(nextResult).toEqual({ id: 'patched-beta' });
  });

  it('falls back to getEntity when getEntityInstance is unavailable', () => {
    const entityManager = {
      getEntity: jest.fn((entityId) => ({ id: `legacy-${entityId}` })),
    };

    const strategy = createEntityLookupStrategy({ entityManager });
    const result = strategy.resolve('gamma');

    expect(entityManager.getEntity).toHaveBeenCalledWith('gamma');
    expect(result).toEqual({ id: 'legacy-gamma' });
    expect(strategy.describeOrder()).toEqual(['getEntity']);
  });

  it('reports which lookup paths are available', () => {
    const entityManager = {
      getEntityInstance: jest.fn(() => null),
      getEntity: jest.fn(() => ({ id: 'entity' })),
    };

    const strategy = createEntityLookupStrategy({ entityManager });

    expect(strategy.describeOrder()).toEqual([
      'getEntityInstance',
      'getEntity',
    ]);
  });
});
