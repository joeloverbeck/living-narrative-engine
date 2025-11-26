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

describe('LocationSummaryProvider', () => {
  it('throws if dispatcher lacks dispatch', () => {
    const entityManager = {
      getEntityInstance: jest.fn(),
      getEntitiesInLocation: jest.fn(),
    };
    const summaryProvider = { getSummary: jest.fn() };
    expect(
      () =>
        new LocationSummaryProvider({
          entityManager,
          summaryProvider,
          safeEventDispatcher: {},
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
    const provider = new LocationSummaryProvider({
      entityManager,
      summaryProvider,
      safeEventDispatcher,
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
    const provider = new LocationSummaryProvider({
      entityManager,
      summaryProvider,
      safeEventDispatcher,
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
});
