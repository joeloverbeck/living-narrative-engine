import { describe, it, expect, jest } from '@jest/globals';
import { LocationDataService } from '../../../../src/domUI/location/locationDataService.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';
import { ACTOR_COMPONENT_ID } from '../../../../src/constants/componentIds.js';

const makeDeps = () => {
  const logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const entityManager = {
    getEntitiesInLocation: jest.fn(() => ['a', 'b']),
    getEntityInstance: jest.fn(() => ({ hasComponent: jest.fn(() => true) })),
  };
  const provider = {
    getEntityLocationId: jest.fn(() => 'loc1'),
    getCharacterDisplayInfo: jest.fn((id) => ({ id, name: id })),
  };
  const dispatcher = { dispatch: jest.fn() };
  const dataRegistry = {
    getAll: jest.fn((type) => {
      if (type === 'entityInstances') return ['instance1', 'instance2'];
      if (type === 'entityDefinitions') return ['def1', 'def2'];
      return [];
    }),
  };
  return { logger, entityManager, provider, dispatcher, dataRegistry };
};

describe('LocationDataService', () => {
  describe('resolveLocationInstanceId', () => {
    it('resolves location id when actor has valid location', () => {
      const { logger, entityManager, provider, dispatcher } = makeDeps();
      const svc = new LocationDataService({
        logger,
        entityManager,
        entityDisplayDataProvider: provider,
        safeEventDispatcher: dispatcher,
      });
      const loc = svc.resolveLocationInstanceId('actor');
      expect(loc).toBe('loc1');
      expect(provider.getEntityLocationId).toHaveBeenCalledWith('actor');
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('returns null and dispatches error when location missing without dataRegistry', () => {
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
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: "Entity 'actor' has no valid position or locationId.",
          details: expect.objectContaining({
            raw: expect.stringContaining('actor'),
            stack: expect.any(String),
          }),
        }
      );
    });

    it('returns null and queries dataRegistry when location missing with dataRegistry', () => {
      const { logger, entityManager, provider, dispatcher, dataRegistry } =
        makeDeps();
      provider.getEntityLocationId.mockReturnValue(null);
      const svc = new LocationDataService({
        logger,
        entityManager,
        entityDisplayDataProvider: provider,
        safeEventDispatcher: dispatcher,
        dataRegistry,
      });
      const loc = svc.resolveLocationInstanceId('actor');
      expect(loc).toBeNull();
      expect(dataRegistry.getAll).toHaveBeenCalledWith('entityInstances');
      expect(dataRegistry.getAll).toHaveBeenCalledWith('entityDefinitions');
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: "Entity 'actor' has no valid position or locationId.",
          details: expect.objectContaining({
            raw: expect.stringContaining('actor'),
            stack: expect.any(String),
          }),
        }
      );
    });

    it('handles dataRegistry without getAll method gracefully', () => {
      const { logger, entityManager, provider, dispatcher } = makeDeps();
      provider.getEntityLocationId.mockReturnValue(null);
      const invalidDataRegistry = {}; // No getAll method
      const svc = new LocationDataService({
        logger,
        entityManager,
        entityDisplayDataProvider: provider,
        safeEventDispatcher: dispatcher,
        dataRegistry: invalidDataRegistry,
      });
      const loc = svc.resolveLocationInstanceId('actor');
      expect(loc).toBeNull();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: "Entity 'actor' has no valid position or locationId.",
          details: expect.objectContaining({
            raw: expect.stringContaining('actor'),
            stack: expect.any(String),
          }),
        }
      );
    });

    it('handles dataRegistry returning null or undefined values', () => {
      const { logger, entityManager, provider, dispatcher } = makeDeps();
      provider.getEntityLocationId.mockReturnValue(null);
      const dataRegistryWithNulls = {
        getAll: jest.fn((type) => {
          if (type === 'entityInstances') return null;
          if (type === 'entityDefinitions') return undefined;
          return null;
        }),
      };
      const svc = new LocationDataService({
        logger,
        entityManager,
        entityDisplayDataProvider: provider,
        safeEventDispatcher: dispatcher,
        dataRegistry: dataRegistryWithNulls,
      });
      const loc = svc.resolveLocationInstanceId('actor');
      expect(loc).toBeNull();
      expect(dataRegistryWithNulls.getAll).toHaveBeenCalledWith(
        'entityInstances'
      );
      expect(dataRegistryWithNulls.getAll).toHaveBeenCalledWith(
        'entityDefinitions'
      );
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: "Entity 'actor' has no valid position or locationId.",
          details: expect.objectContaining({
            raw: expect.stringContaining('actor'),
            stack: expect.any(String),
          }),
        }
      );
    });
  });

  describe('gatherLocationCharacters', () => {
    it('gathers characters excluding current actor', () => {
      const { logger, entityManager, provider, dispatcher } = makeDeps();
      const svc = new LocationDataService({
        logger,
        entityManager,
        entityDisplayDataProvider: provider,
        safeEventDispatcher: dispatcher,
      });
      const chars = svc.gatherLocationCharacters('loc1', 'actor');
      expect(chars.length).toBe(2);
      expect(chars).toEqual([
        { id: 'a', name: 'a' },
        { id: 'b', name: 'b' },
      ]);
      expect(provider.getCharacterDisplayInfo).toHaveBeenCalledWith('a');
      expect(provider.getCharacterDisplayInfo).toHaveBeenCalledWith('b');
      expect(logger.debug).toHaveBeenCalledWith(
        '[LocationDataService] Found 2 other characters.'
      );
    });

    it('skips current actor when gathering characters', () => {
      const { logger, entityManager, provider, dispatcher } = makeDeps();
      entityManager.getEntitiesInLocation.mockReturnValue(['actor', 'a', 'b']);
      const svc = new LocationDataService({
        logger,
        entityManager,
        entityDisplayDataProvider: provider,
        safeEventDispatcher: dispatcher,
      });
      const chars = svc.gatherLocationCharacters('loc1', 'actor');
      expect(chars.length).toBe(2);
      expect(provider.getCharacterDisplayInfo).not.toHaveBeenCalledWith(
        'actor'
      );
      expect(provider.getCharacterDisplayInfo).toHaveBeenCalledWith('a');
      expect(provider.getCharacterDisplayInfo).toHaveBeenCalledWith('b');
    });

    it('filters out non-actor entities', () => {
      const { logger, entityManager, provider, dispatcher } = makeDeps();
      const nonActorEntity = { hasComponent: jest.fn(() => false) };
      const actorEntity = { hasComponent: jest.fn(() => true) };
      entityManager.getEntityInstance.mockImplementation((id) => {
        return id === 'a' ? nonActorEntity : actorEntity;
      });
      const svc = new LocationDataService({
        logger,
        entityManager,
        entityDisplayDataProvider: provider,
        safeEventDispatcher: dispatcher,
      });
      const chars = svc.gatherLocationCharacters('loc1', 'current');
      expect(chars.length).toBe(1);
      expect(nonActorEntity.hasComponent).toHaveBeenCalledWith(
        ACTOR_COMPONENT_ID
      );
      expect(provider.getCharacterDisplayInfo).toHaveBeenCalledTimes(1);
      expect(provider.getCharacterDisplayInfo).toHaveBeenCalledWith('b');
    });

    it('handles missing entities gracefully', () => {
      const { logger, entityManager, provider, dispatcher } = makeDeps();
      entityManager.getEntityInstance.mockImplementation((id) => {
        return id === 'a' ? null : { hasComponent: jest.fn(() => true) };
      });
      const svc = new LocationDataService({
        logger,
        entityManager,
        entityDisplayDataProvider: provider,
        safeEventDispatcher: dispatcher,
      });
      const chars = svc.gatherLocationCharacters('loc1', 'current');
      expect(chars.length).toBe(1);
      expect(provider.getCharacterDisplayInfo).toHaveBeenCalledTimes(1);
      expect(provider.getCharacterDisplayInfo).toHaveBeenCalledWith('b');
    });

    it('logs warning when character display info unavailable', () => {
      const { logger, entityManager, provider, dispatcher } = makeDeps();
      provider.getCharacterDisplayInfo.mockImplementation((id) => {
        return id === 'a' ? null : { id, name: id };
      });
      const svc = new LocationDataService({
        logger,
        entityManager,
        entityDisplayDataProvider: provider,
        safeEventDispatcher: dispatcher,
      });
      const chars = svc.gatherLocationCharacters('loc1', 'current');
      expect(chars.length).toBe(1);
      expect(chars).toEqual([{ id: 'b', name: 'b' }]);
      expect(logger.warn).toHaveBeenCalledWith(
        "[LocationDataService] Could not get display info for character 'a'."
      );
    });

    it('returns empty array when no entities in location', () => {
      const { logger, entityManager, provider, dispatcher } = makeDeps();
      entityManager.getEntitiesInLocation.mockReturnValue([]);
      const svc = new LocationDataService({
        logger,
        entityManager,
        entityDisplayDataProvider: provider,
        safeEventDispatcher: dispatcher,
      });
      const chars = svc.gatherLocationCharacters('loc1', 'current');
      expect(chars).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(
        '[LocationDataService] Found 0 other characters.'
      );
    });
  });
});
