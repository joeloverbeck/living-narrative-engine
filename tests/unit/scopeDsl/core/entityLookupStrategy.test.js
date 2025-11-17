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

  it('allows swapping entity managers via refreshCapabilities()', () => {
    const firstManager = {
      getEntity: jest.fn((entityId) => ({ id: `legacy-${entityId}` })),
    };
    const nextManager = {
      getEntityInstance: jest.fn((entityId) => ({ id: `next-${entityId}` })),
    };

    const strategy = createEntityLookupStrategy({ entityManager: firstManager });

    expect(strategy.resolve('alpha')).toEqual({ id: 'legacy-alpha' });

    const refreshedOrder = strategy.refreshCapabilities(nextManager);
    expect(refreshedOrder).toEqual(['getEntityInstance']);

    expect(strategy.resolve('beta')).toEqual({ id: 'next-beta' });
    expect(firstManager.getEntity).toHaveBeenCalledWith('alpha');
    expect(nextManager.getEntityInstance).toHaveBeenCalledWith('beta');
  });

  it('emits debug trace entries when resolver changes under debug config', () => {
    const entityManager = {
      getEntity: jest.fn(() => null),
    };
    const trace = { addLog: jest.fn() };

    const strategy = createEntityLookupStrategy({
      entityManager,
      trace,
      debugConfig: { enabled: true },
    });

    strategy.resolve('alpha');
    entityManager.getEntity.mockReturnValueOnce({ id: 'beta' });
    strategy.resolve('beta');

    expect(trace.addLog).toHaveBeenCalledWith(
      'debug',
      'ScopeDSL entity lookup resolver switched.',
      'ScopeDSL.EntityLookupStrategy',
      expect.objectContaining({ resolver: 'miss' })
    );
    expect(trace.addLog).toHaveBeenCalledWith(
      'debug',
      'ScopeDSL entity lookup resolver switched.',
      'ScopeDSL.EntityLookupStrategy',
      expect.objectContaining({ resolver: 'getEntity' })
    );
  });
});
