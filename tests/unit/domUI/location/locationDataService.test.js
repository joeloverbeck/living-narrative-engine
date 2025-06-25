import { describe, it, expect, jest } from '@jest/globals';
import { LocationDataService } from '../../../../src/domUI/location/locationDataService.js';

const makeDeps = () => {
  const logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const entityManager = {
    getEntitiesInLocation: jest.fn(() => ['a', 'b']),
    getEntityInstance: jest.fn(() => ({ hasComponent: () => true })),
  };
  const provider = {
    getEntityLocationId: jest.fn(() => 'loc1'),
    getCharacterDisplayInfo: jest.fn((id) => ({ id, name: id })),
  };
  const dispatcher = { dispatch: jest.fn() };
  return { logger, entityManager, provider, dispatcher };
};

describe('LocationDataService', () => {
  it('resolves location id and gathers characters', () => {
    const { logger, entityManager, provider, dispatcher } = makeDeps();
    const svc = new LocationDataService({
      logger,
      entityManager,
      entityDisplayDataProvider: provider,
      safeEventDispatcher: dispatcher,
    });
    const loc = svc.resolveLocationInstanceId('actor');
    expect(loc).toBe('loc1');
    const chars = svc.gatherLocationCharacters('loc1', 'actor');
    expect(chars.length).toBe(2);
    expect(provider.getCharacterDisplayInfo).toHaveBeenCalled();
  });

  it('returns null and dispatches error when location missing', () => {
    const { logger, entityManager, provider, dispatcher } = makeDeps();
    provider.getEntityLocationId.mockReturnValue(null);
    const svc = new LocationDataService({
      logger,
      entityManager,
      entityDisplayDataProvider: provider,
      safeEventDispatcher: dispatcher,
    });
    const loc = svc.resolveLocationInstanceId('actor');
    expect(loc).toBeNull();
    expect(dispatcher.dispatch).toHaveBeenCalled();
  });
});
