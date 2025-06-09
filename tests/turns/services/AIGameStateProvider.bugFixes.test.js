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
  DEFAULT_FALLBACK_ACTION_NAME,
  DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW,
} from '../../../src/constants/textDefaults.js';

// --- Import real providers for integration testing ---
import { ActorStateProvider } from '../../../src/data/providers/actorStateProvider.js';
import { ActorDataExtractor } from '../../../src/turns/services/actorDataExtractor.js';
import { LocationSummaryProvider } from '../../../src/data/providers/locationSummaryProvider.js';
import { AvailableActionsProvider } from '../../../src/data/providers/availableActionsProvider.js';
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

const mockActionDiscoveryService = () => ({
  getValidActions: jest.fn(),
});

// This mock setup is kept as it provides convenient access to mocked instances.
const mockTurnContext = () => {
  const loggerInstance = mockLogger();
  const entityManagerInstance = mockEntityManager();
  const actionDiscoverySystemInst = mockActionDiscoveryService();

  return {
    game: {}, // The only property directly used from turnContext
    mockLoggerInstance: loggerInstance,
    mockEntityManagerInstance: entityManagerInstance,
    mockActionDiscoveryServiceInstance: actionDiscoverySystemInst,
  };
};

// --- Test Suite ---

describe('AIGameStateProvider', () => {
  let provider;
  let logger;
  let turnContext;
  let entityManager;
  let actionDiscoverySystem;
  let mockActor;

  beforeEach(() => {
    turnContext = mockTurnContext();
    logger = turnContext.mockLoggerInstance;
    entityManager = turnContext.mockEntityManagerInstance;
    actionDiscoverySystem = turnContext.mockActionDiscoveryServiceInstance;

    mockActor = new MockEntity('actor1', {
      [POSITION_COMPONENT_ID]: { locationId: 'loc1' },
    });

    turnContext.game = { worldId: 'test-world', someOtherData: 'data' };

    // --- Instantiate real providers with mocks for integration testing ---
    const actorStateProvider = new ActorStateProvider();
    const actorDataExtractor = new ActorDataExtractor();
    const perceptionLogProvider = new PerceptionLogProvider();
    const entitySummaryProvider = new EntitySummaryProvider();
    const locationSummaryProvider = new LocationSummaryProvider({
      entityManager,
      summaryProvider: entitySummaryProvider,
    });
    const availableActionsProvider = new AvailableActionsProvider({
      actionDiscoveryService: actionDiscoverySystem,
      entityManager,
    });

    provider = new AIGameStateProvider({
      actorStateProvider,
      actorDataExtractor,
      locationSummaryProvider,
      availableActionsProvider,
      perceptionLogProvider,
    });
    // --- End of updated instantiation ---

    const minimalLocationEntity = new MockEntity('loc1', {
      [NAME_COMPONENT_ID]: { text: 'A Room' },
      [DESCRIPTION_COMPONENT_ID]: { text: 'Just a room.' },
    });

    entityManager.getEntityInstance.mockImplementation(async (id) => {
      if (id === 'loc1') return minimalLocationEntity;
      return null;
    });
    entityManager.getEntitiesInLocation.mockResolvedValue(new Set());
    actionDiscoverySystem.getValidActions.mockResolvedValue([]);

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
        // The refactored provider no longer logs on this error, it just throws.
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
        // The refactored provider no longer logs on this error, it just throws.
        await expect(
          provider.buildGameState(actor, null, logger)
        ).rejects.toThrow(expectedErrorMsg);
      });
    });

    describe('_getAvailableActions (via buildGameState)', () => {
      let loc;
      beforeEach(() => {
        loc = new MockEntity('loc1', {
          [NAME_COMPONENT_ID]: { text: 'A Room' },
        });
        entityManager.getEntityInstance.mockResolvedValue(loc);
        entityManager.getEntitiesInLocation.mockResolvedValue(new Set());
      });

      describe('ActionContext Integrity', () => {
        test('should call getValidActions with an ActionContext containing the full location entity', async () => {
          await provider.buildGameState(mockActor, turnContext, logger);

          expect(actionDiscoverySystem.getValidActions).toHaveBeenCalledTimes(
            1
          );
          expect(actionDiscoverySystem.getValidActions).toHaveBeenCalledWith(
            mockActor,
            expect.objectContaining({
              actingEntity: mockActor,
              currentLocation: loc, // CRITICAL: Expect the full location entity object
              entityManager,
              worldContext: turnContext.game,
              logger,
            })
          );
        });
      });

      test('should return empty actions and log error if ActionDiscoveryService is not available', async () => {
        // Arrange: For this specific test, create a provider with a null ActionDiscoveryService
        const availableActionsProviderWithNullADS =
          new AvailableActionsProvider({
            actionDiscoveryService: null,
            entityManager,
          });
        const localProvider = new AIGameStateProvider({
          actorStateProvider: new ActorStateProvider(),
          actorDataExtractor: new ActorDataExtractor(),
          locationSummaryProvider: new LocationSummaryProvider({
            entityManager,
            summaryProvider: new EntitySummaryProvider(),
          }),
          availableActionsProvider: availableActionsProviderWithNullADS,
          perceptionLogProvider: new PerceptionLogProvider(),
        });

        // Act
        const gameState = await localProvider.buildGameState(
          mockActor,
          turnContext,
          logger
        );

        // Assert
        expect(gameState.availableActions).toEqual([]);
        expect(logger.error).toHaveBeenCalled();
      });

      test('should populate actions with defaults for missing optional fields', async () => {
        const rawActions = [
          {
            id: 'action1',
            command: 'cmd1',
            name: 'Action One',
            description: 'Desc One',
          },
          { id: 'action2', command: 'cmd2' }, // missing name & desc
        ];
        actionDiscoverySystem.getValidActions.mockResolvedValue(rawActions);

        const { availableActions } = await provider.buildGameState(
          mockActor,
          turnContext,
          logger
        );

        expect(availableActions).toEqual([
          {
            id: 'action1',
            command: 'cmd1',
            name: 'Action One',
            description: 'Desc One',
          },
          {
            id: 'action2',
            command: 'cmd2',
            name: DEFAULT_FALLBACK_ACTION_NAME, // Use imported constant
            description: DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW, // Use imported constant
          },
        ]);
      });
    });

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
            { direction: 'north', target: 'locN' }, // Valid
            { target: 'locE_no_dir' }, // No direction, will use default
            { direction: 'south' }, // Invalid, no target
            { direction: 'west', target: 'locW' }, // Valid
          ]);

          // Simulate that target entities for these exits don't have a name or can't be found
          const westExitLoc = new MockEntity('locW'); // Entity without a name component
          entityManager.getEntityInstance.mockImplementation(async (id) => {
            if (id === 'loc1') return locationEntity;
            if (id === 'locN') return null; // Not found
            if (id === 'locE_no_dir') return null; // Not found
            if (id === 'locW') return westExitLoc; // Found, but no name
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
