import { describe, it, expect, jest } from '@jest/globals';
import { LocationSummaryProvider } from '../../../../src/data/providers/locationSummaryProvider.js';
import {
  POSITION_COMPONENT_ID,
  EXITS_COMPONENT_ID,
  NAME_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { DEFAULT_FALLBACK_LOCATION_NAME } from '../../../../src/constants/textDefaults.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/systemEventIds.js';
import {
  createMockLogger,
  createMockSafeEventDispatcher,
  createTestEntity,
} from '../../../common/mockFactories/index.js';

/**
 * Creates a mock LightingStateService for testing.
 *
 * @param {object} options - Configuration options
 * @param {boolean} [options.isLit] - Whether location is lit
 * @param {string[]} [options.lightSources] - Light source entity IDs
 * @returns {object} Mock lighting state service
 */
function createMockLightingStateService({ isLit = true, lightSources = [] } = {}) {
  return {
    getLocationLightingState: jest.fn().mockReturnValue({ isLit, lightSources }),
    isLocationLit: jest.fn().mockReturnValue(isLit),
  };
}

describe('LocationSummaryProvider', () => {
  it('throws if dispatcher lacks dispatch', () => {
    const entityManager = {
      getEntityInstance: jest.fn(),
      getEntitiesInLocation: jest.fn(),
    };
    const summaryProvider = { getSummary: jest.fn() };
    const lightingStateService = createMockLightingStateService();
    expect(
      () =>
        new LocationSummaryProvider({
          entityManager,
          summaryProvider,
          safeEventDispatcher: {},
          lightingStateService,
        })
    ).toThrow('LocationSummaryProvider requires a valid ISafeEventDispatcher.');
  });

  it('builds summary while handling exit and character retrieval errors', async () => {
    const entityManager = {
      getEntityInstance: jest.fn(),
      getEntitiesInLocation: jest.fn(),
    };
    const summaryProvider = { getSummary: jest.fn() };
    const safeEventDispatcher = createMockSafeEventDispatcher();
    const lightingStateService = createMockLightingStateService();
    const provider = new LocationSummaryProvider({
      entityManager,
      summaryProvider,
      safeEventDispatcher,
      lightingStateService,
    });
    const logger = createMockLogger();

    const actor = createTestEntity('actor1', {
      [POSITION_COMPONENT_ID]: { locationId: 'loc1' },
    });

    const locationEntity = createTestEntity('loc1', {
      [EXITS_COMPONENT_ID]: [
        { direction: 'north', target: 'loc2' },
        { direction: 'east', target: 'badLoc' },
        { direction: 'south' },
      ],
      [NAME_COMPONENT_ID]: { text: 'Room1' },
      [DESCRIPTION_COMPONENT_ID]: { text: 'Desc1' },
    });

    const loc2Entity = createTestEntity('loc2', {
      [NAME_COMPONENT_ID]: { text: 'Room2' },
    });
    const npcEntity = createTestEntity('npc1', {
      [NAME_COMPONENT_ID]: { text: 'Npc' },
      [DESCRIPTION_COMPONENT_ID]: { text: 'npc desc' },
    });
    // Add hasComponent method to simulate an actual character (with core:actor)
    npcEntity.hasComponent = (componentId) => componentId === 'core:actor';

    entityManager.getEntityInstance.mockImplementation(async (id) => {
      if (id === 'loc1') return locationEntity;
      if (id === 'loc2') return loc2Entity;
      if (id === 'npc1') return npcEntity;
      if (id === 'badLoc' || id === 'badEntity') throw new Error('fail');
      return null;
    });
    entityManager.getEntitiesInLocation.mockResolvedValue(
      new Set(['actor1', 'npc1', 'badEntity'])
    );

    summaryProvider.getSummary.mockImplementation((e) => {
      const name =
        e.components?.[NAME_COMPONENT_ID]?.text ||
        DEFAULT_FALLBACK_LOCATION_NAME;
      const description =
        e.components?.[DESCRIPTION_COMPONENT_ID]?.text || 'desc';
      return { id: e.id, name, description };
    });

    const result = await provider.build(actor, logger);

    expect(result).toEqual({
      name: 'Room1',
      description: 'Desc1',
      exits: [
        {
          direction: 'north',
          targetLocationId: 'loc2',
          targetLocationName: 'Room2',
        },
      ],
      characters: [{ id: 'npc1', name: 'Npc', description: 'npc desc' }],
      isLit: true,
      descriptionInDarkness: null,
    });

    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('badLoc'),
      })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "LocationSummaryProvider: Could not retrieve entity 'badEntity' in location 'loc1': fail"
    );
  });

  it('returns null and dispatches error when location lookup fails', async () => {
    const entityManager = {
      getEntityInstance: jest.fn().mockRejectedValue(new Error('boom')),
    };
    const summaryProvider = { getSummary: jest.fn() };
    const safeEventDispatcher = createMockSafeEventDispatcher();
    const lightingStateService = createMockLightingStateService();
    const provider = new LocationSummaryProvider({
      entityManager,
      summaryProvider,
      safeEventDispatcher,
      lightingStateService,
    });
    const logger = createMockLogger();

    const actor = createTestEntity('actor1', {
      [POSITION_COMPONENT_ID]: { locationId: 'loc1' },
    });

    const result = await provider.build(actor, logger);
    expect(result).toBeNull();
    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('Critical error'),
      })
    );
  });

  describe('lighting state integration', () => {
    it('includes isLit=false when location is dark', async () => {
      const entityManager = {
        getEntityInstance: jest.fn(),
        getEntitiesInLocation: jest.fn().mockResolvedValue(new Set()),
      };
      const summaryProvider = { getSummary: jest.fn() };
      const safeEventDispatcher = createMockSafeEventDispatcher();
      const lightingStateService = createMockLightingStateService({ isLit: false });
      const provider = new LocationSummaryProvider({
        entityManager,
        summaryProvider,
        safeEventDispatcher,
        lightingStateService,
      });
      const logger = createMockLogger();

      const actor = createTestEntity('actor1', {
        [POSITION_COMPONENT_ID]: { locationId: 'dark_room' },
      });

      const locationEntity = createTestEntity('dark_room', {
        [NAME_COMPONENT_ID]: { text: 'Dark Room' },
        [DESCRIPTION_COMPONENT_ID]: { text: 'A dark room.' },
        [EXITS_COMPONENT_ID]: [],
        'locations:naturally_dark': {},
        'locations:description_in_darkness': { text: 'You cannot see anything.' },
      });

      entityManager.getEntityInstance.mockResolvedValue(locationEntity);
      summaryProvider.getSummary.mockReturnValue({
        id: 'dark_room',
        name: 'Dark Room',
        description: 'A dark room.',
      });

      const result = await provider.build(actor, logger);

      expect(result.isLit).toBe(false);
      expect(result.descriptionInDarkness).toBe('You cannot see anything.');
      expect(lightingStateService.getLocationLightingState).toHaveBeenCalledWith('dark_room');
    });

    it('includes descriptionInDarkness when component is present', async () => {
      const entityManager = {
        getEntityInstance: jest.fn(),
        getEntitiesInLocation: jest.fn().mockResolvedValue(new Set()),
      };
      const summaryProvider = { getSummary: jest.fn() };
      const safeEventDispatcher = createMockSafeEventDispatcher();
      const lightingStateService = createMockLightingStateService({ isLit: false });
      const provider = new LocationSummaryProvider({
        entityManager,
        summaryProvider,
        safeEventDispatcher,
        lightingStateService,
      });
      const logger = createMockLogger();

      const sensoryDescription = 'The air is cold and musty.';

      const actor = createTestEntity('actor1', {
        [POSITION_COMPONENT_ID]: { locationId: 'cellar' },
      });

      const locationEntity = createTestEntity('cellar', {
        [NAME_COMPONENT_ID]: { text: 'Cellar' },
        [DESCRIPTION_COMPONENT_ID]: { text: 'An old cellar.' },
        [EXITS_COMPONENT_ID]: [],
        'locations:description_in_darkness': { text: sensoryDescription },
      });

      entityManager.getEntityInstance.mockResolvedValue(locationEntity);
      summaryProvider.getSummary.mockReturnValue({
        id: 'cellar',
        name: 'Cellar',
        description: 'An old cellar.',
      });

      const result = await provider.build(actor, logger);

      expect(result.descriptionInDarkness).toBe(sensoryDescription);
    });

    it('sets descriptionInDarkness to null when component is missing', async () => {
      const entityManager = {
        getEntityInstance: jest.fn(),
        getEntitiesInLocation: jest.fn().mockResolvedValue(new Set()),
      };
      const summaryProvider = { getSummary: jest.fn() };
      const safeEventDispatcher = createMockSafeEventDispatcher();
      const lightingStateService = createMockLightingStateService({ isLit: true });
      const provider = new LocationSummaryProvider({
        entityManager,
        summaryProvider,
        safeEventDispatcher,
        lightingStateService,
      });
      const logger = createMockLogger();

      const actor = createTestEntity('actor1', {
        [POSITION_COMPONENT_ID]: { locationId: 'lit_room' },
      });

      const locationEntity = createTestEntity('lit_room', {
        [NAME_COMPONENT_ID]: { text: 'Lit Room' },
        [DESCRIPTION_COMPONENT_ID]: { text: 'A bright room.' },
        [EXITS_COMPONENT_ID]: [],
        // No description_in_darkness component
      });

      entityManager.getEntityInstance.mockResolvedValue(locationEntity);
      summaryProvider.getSummary.mockReturnValue({
        id: 'lit_room',
        name: 'Lit Room',
        description: 'A bright room.',
      });

      const result = await provider.build(actor, logger);

      expect(result.isLit).toBe(true);
      expect(result.descriptionInDarkness).toBeNull();
    });
  });
});
