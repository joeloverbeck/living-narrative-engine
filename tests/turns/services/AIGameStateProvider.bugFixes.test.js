/**
 * @file This test suite ensures a really nasty bug is fixed: it prevented AIs from getting valid action discovery results.
 * @see tests/turns/services/AIGameStateProvider.bugFixes.test.js
 */

import {
  jest,
  describe,
  beforeEach,
  test,
  expect,
  afterEach,
} from '@jest/globals';
import { AIGameStateProvider } from '../../../src/turns/services/AIGameStateProvider.js';
import {
  NAME_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  EXITS_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import {
  DEFAULT_FALLBACK_LOCATION_NAME,
  DEFAULT_FALLBACK_EXIT_DIRECTION,
} from '../../../src/constants/textDefaults.js';

// --- Import real providers for integration testing ---
import { ActorStateProvider } from '../../../src/data/providers/actorStateProvider.js';
import { ActorDataExtractor } from '../../../src/turns/services/actorDataExtractor.js';
import { LocationSummaryProvider } from '../../../src/data/providers/locationSummaryProvider.js';
import { PerceptionLogProvider } from '../../../src/data/providers/perceptionLogProvider.js';
import { EntitySummaryProvider } from '../../../src/data/providers/entitySummaryProvider.js';

// --- Mocks ---

const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

class MockEntity {
  constructor(
    id = `mock-entity-${Math.random().toString(36).substring(2, 9)}`,
    componentsData = {}
  ) {
    this.id = id;
    this._componentsData = { ...componentsData };
    this.getComponentData = jest.fn((compId) =>
      this._componentsData[compId] !== undefined
        ? this._componentsData[compId]
        : undefined
    );
    this.hasComponent = jest.fn(
      (compId) => this._componentsData[compId] !== undefined
    );
  }

  get componentEntries() {
    return Object.entries(this._componentsData);
  }

  setComponentData(componentId, data) {
    this._componentsData[componentId] = data;
  }
}

const mockEntityManager = () => ({
  getEntityInstance: jest.fn(),
  getEntitiesInLocation: jest.fn(),
});

const mockTurnContext = () => {
  const loggerInstance = mockLogger();
  const entityManagerInstance = mockEntityManager();

  return {
    game: {},
    mockLoggerInstance: loggerInstance,
    mockEntityManagerInstance: entityManagerInstance,
  };
};

// --- Test Suite ---

describe('AIGameStateProvider', () => {
  let provider;
  let logger;
  let turnContext;
  let entityManager;
  let mockActor;

  beforeEach(() => {
    turnContext = mockTurnContext();
    logger = turnContext.mockLoggerInstance;
    entityManager = turnContext.mockEntityManagerInstance;

    mockActor = new MockEntity('actor1', {
      [POSITION_COMPONENT_ID]: { locationId: 'loc1' },
    });

    turnContext.game = { worldId: 'test-world', someOtherData: 'data' };

    const actorStateProvider = new ActorStateProvider();
    const actorDataExtractor = new ActorDataExtractor();
    const perceptionLogProvider = new PerceptionLogProvider();
    const entitySummaryProvider = new EntitySummaryProvider();
    const locationSummaryProvider = new LocationSummaryProvider({
      entityManager,
      summaryProvider: entitySummaryProvider,
    });
    const safeEventDispatcher = { dispatch: jest.fn() };

    provider = new AIGameStateProvider({
      actorStateProvider,
      actorDataExtractor,
      locationSummaryProvider,
      perceptionLogProvider,
      safeEventDispatcher,
    });

    const minimalLocationEntity = new MockEntity('loc1', {
      [NAME_COMPONENT_ID]: { text: 'A Room' },
      [DESCRIPTION_COMPONENT_ID]: { text: 'Just a room.' },
    });

    entityManager.getEntityInstance.mockImplementation(async (id) => {
      if (id === 'loc1') return minimalLocationEntity;
      return null;
    });
    entityManager.getEntitiesInLocation.mockResolvedValue(new Set());

    jest.spyOn(Date, 'now').mockReturnValue(1678886400000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('buildGameState', () => {
    describe('Input Validation', () => {
      test('should throw error if actor is null or has no ID', async () => {
        const expectedErrorMsg =
          'AIGameStateProvider: Actor is invalid or missing ID.';
        await expect(
          provider.buildGameState(null, turnContext, logger)
        ).rejects.toThrow(expectedErrorMsg);
        await expect(
          provider.buildGameState({ name: 'no-id' }, turnContext, logger)
        ).rejects.toThrow(expectedErrorMsg);
      });

      test('should throw error if turnContext is null', async () => {
        const actor = new MockEntity('actor1');
        const expectedErrorMsg = `AIGameStateProvider: TurnContext is invalid for actor ${actor.id}.`;
        await expect(
          provider.buildGameState(actor, null, logger)
        ).rejects.toThrow(expectedErrorMsg);
      });
    });

    // The entire `_getAvailableActions` describe block was removed as it is
    // no longer relevant to AIGameStateProvider.

    describe('_buildLocationSummary (via buildGameState)', () => {
      let locationEntity;
      beforeEach(() => {
        locationEntity = new MockEntity('loc1', {
          [NAME_COMPONENT_ID]: { text: 'The Grand Hall' },
          [DESCRIPTION_COMPONENT_ID]: { text: 'A vast chamber.' },
          [EXITS_COMPONENT_ID]: [],
        });
        entityManager.getEntityInstance.mockImplementation(async (id) =>
          id === 'loc1' ? locationEntity : null
        );
      });

      describe('Exits Handling', () => {
        test('[CORRECTED] Malformed exit entries are filtered out or handled with defaults', async () => {
          locationEntity.setComponentData(EXITS_COMPONENT_ID, [
            { direction: 'north', target: 'locN' },
            { target: 'locE_no_dir' },
            { direction: 'south' },
            { direction: 'west', target: 'locW' },
          ]);

          const westExitLoc = new MockEntity('locW');
          entityManager.getEntityInstance.mockImplementation(async (id) => {
            if (id === 'loc1') return locationEntity;
            if (id === 'locN') return null;
            if (id === 'locE_no_dir') return null;
            if (id === 'locW') return westExitLoc;
            return null;
          });

          const gameState = await provider.buildGameState(
            mockActor,
            turnContext,
            logger
          );

          expect(gameState.currentLocation.exits).toEqual([
            {
              direction: 'north',
              targetLocationId: 'locN',
              targetLocationName: DEFAULT_FALLBACK_LOCATION_NAME,
            },
            {
              direction: DEFAULT_FALLBACK_EXIT_DIRECTION,
              targetLocationId: 'locE_no_dir',
              targetLocationName: DEFAULT_FALLBACK_LOCATION_NAME,
            },
            {
              direction: 'west',
              targetLocationId: 'locW',
              targetLocationName: DEFAULT_FALLBACK_LOCATION_NAME,
            },
          ]);
        });
      });
    });
  });
});
