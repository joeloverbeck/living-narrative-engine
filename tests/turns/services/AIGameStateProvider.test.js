// tests/turns/services/AIGameStateProvider.test.js
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
  PERCEPTION_LOG_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import {
  DEFAULT_FALLBACK_LOCATION_NAME,
  DEFAULT_FALLBACK_CHARACTER_NAME,
  DEFAULT_FALLBACK_DESCRIPTION_RAW,
  DEFAULT_FALLBACK_EVENT_DESCRIPTION_RAW,
} from '../../../src/constants/textDefaults.js';

// --- Import real providers for integration testing ---
import { ActorStateProvider } from '../../../src/data/providers/actorStateProvider.js';
import { ActorDataExtractor } from '../../../src/turns/services/actorDataExtractor.js';
import { LocationSummaryProvider } from '../../../src/data/providers/locationSummaryProvider.js';
import { PerceptionLogProvider } from '../../../src/data/providers/perceptionLogProvider.js';
import { EntitySummaryProvider } from '../../../src/data/providers/entitySummaryProvider.js';

// --- Mock implementations ---

const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

class MockEntity {
  constructor(id, componentsData = {}) {
    this.id = id;
    this._componentsData = componentsData;
    this.getComponentData = jest.fn((compId) => this._componentsData[compId]);
    this.hasComponent = jest.fn((compId) => compId in this._componentsData);
    this.componentEntries = Object.entries(this._componentsData);
  }

  setComponentData(id, data) {
    this._componentsData[id] = data;
    this.componentEntries = Object.entries(this._componentsData);
    this.hasComponent = jest.fn((compId) => compId in this._componentsData);
  }

  removeComponent(id) {
    delete this._componentsData[id];
    this.componentEntries = Object.entries(this._componentsData);
    this.hasComponent = jest.fn((compId) => compId in this._componentsData);
  }
}

const mockEntityManager = () => ({
  getEntityInstance: jest.fn(),
  getEntitiesInLocation: jest.fn(),
});

const mockTurnContext = () => ({
  game: {},
});

// --- Test Suite ---

describe('AIGameStateProvider Integration Tests', () => {
  // The SUT
  let provider;

  // Provider dependencies (real instances)
  let actorStateProvider;
  let actorDataExtractor;
  let locationSummaryProvider;
  let perceptionLogProvider;
  let entitySummaryProvider;
  let safeEventDispatcher;

  // Mocks for provider dependencies
  let logger;
  let turnContext;
  let entityManager;
  let mockActor;

  // Helper to create the full provider stack. Allows overriding dependencies for specific tests.
  const setupProviderStack = (overrides = {}) => {
    const deps = {
      entityManager,
      ...overrides,
    };

    actorStateProvider = new ActorStateProvider();
    actorDataExtractor = new ActorDataExtractor();
    perceptionLogProvider = new PerceptionLogProvider();
    entitySummaryProvider = new EntitySummaryProvider();
    safeEventDispatcher = { dispatch: jest.fn() };
    locationSummaryProvider = new LocationSummaryProvider({
      entityManager: deps.entityManager,
      summaryProvider: entitySummaryProvider,
      safeEventDispatcher,
    });

    return new AIGameStateProvider({
      actorStateProvider,
      actorDataExtractor,
      locationSummaryProvider,
      perceptionLogProvider,
      safeEventDispatcher,
    });
  };

  beforeEach(() => {
    logger = mockLogger();
    turnContext = mockTurnContext();
    entityManager = mockEntityManager();
    mockActor = new MockEntity('actor1', {
      [POSITION_COMPONENT_ID]: { locationId: 'loc1' },
    });
    turnContext.game = { worldId: 'test-world' };

    // Create the standard provider stack for most tests
    provider = setupProviderStack();

    // Default mock behaviors
    const minimalLocationEntity = new MockEntity('loc1', {
      [NAME_COMPONENT_ID]: { text: 'A Room' },
    });
    entityManager.getEntityInstance.mockResolvedValue(minimalLocationEntity);
    entityManager.getEntitiesInLocation.mockResolvedValue(new Set());
    jest.spyOn(Date, 'now').mockReturnValue(1678886400000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('should create an instance when all dependencies are provided', () => {
      const p = setupProviderStack();
      expect(p).toBeInstanceOf(AIGameStateProvider);
    });
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
          provider.buildGameState({ no: 'id' }, turnContext, logger)
        ).rejects.toThrow(expectedErrorMsg);
      });

      test('should throw error if turnContext is null', async () => {
        const expectedErrorMsg = `AIGameStateProvider: TurnContext is invalid for actor ${mockActor.id}.`;
        await expect(
          provider.buildGameState(mockActor, null, logger)
        ).rejects.toThrow(expectedErrorMsg);
      });
    });

    describe('Actor State Building', () => {
      test('should populate actorState with all components', async () => {
        const actor = new MockEntity('actorTest', {
          [NAME_COMPONENT_ID]: { text: 'Test Actor Name' },
          [DESCRIPTION_COMPONENT_ID]: { text: 'A brave test actor.' },
        });
        const { actorState } = await provider.buildGameState(
          actor,
          turnContext,
          logger
        );
        expect(actorState.id).toBe('actorTest');
        expect(actorState.components[NAME_COMPONENT_ID].text).toBe(
          'Test Actor Name'
        );
        expect(actorState.components[DESCRIPTION_COMPONENT_ID].text).toBe(
          'A brave test actor.'
        );
      });

      test('should use default name and description if components are missing', async () => {
        const actor = new MockEntity('actorNoName', {});
        const { actorState } = await provider.buildGameState(
          actor,
          turnContext,
          logger
        );
        expect(actorState[NAME_COMPONENT_ID].text).toBe(
          DEFAULT_FALLBACK_CHARACTER_NAME
        );
        expect(actorState[DESCRIPTION_COMPONENT_ID].text).toBe(
          DEFAULT_FALLBACK_DESCRIPTION_RAW
        );
      });
    });

    describe('Location Summary Building', () => {
      test('should return null for location if actor has no position', async () => {
        const actorNoPos = new MockEntity('actorNoPos', {});
        const { currentLocation } = await provider.buildGameState(
          actorNoPos,
          turnContext,
          logger
        );
        expect(currentLocation).toBeNull();
      });

      test('should return null for location if EntityManager is unavailable', async () => {
        provider = setupProviderStack({ entityManager: null }); // Test with null EM
        const { currentLocation } = await provider.buildGameState(
          mockActor,
          turnContext,
          logger
        );
        expect(currentLocation).toBeNull();
        expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
          SYSTEM_ERROR_OCCURRED_ID,
          expect.any(Object)
        );
      });

      test('should return null for location if location entity not found', async () => {
        entityManager.getEntityInstance.mockResolvedValue(null);
        const { currentLocation } = await provider.buildGameState(
          mockActor,
          turnContext,
          logger
        );
        expect(currentLocation).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
          `LocationSummaryProvider: Location entity 'loc1' not found.`
        );
      });

      test('should use defaults for location with missing components', async () => {
        const locEntity = new MockEntity('loc1', {}); // No name/desc components
        entityManager.getEntityInstance.mockResolvedValue(locEntity);
        const { currentLocation } = await provider.buildGameState(
          mockActor,
          turnContext,
          logger
        );
        expect(currentLocation.name).toBe(DEFAULT_FALLBACK_LOCATION_NAME);
        expect(currentLocation.description).toBe(
          DEFAULT_FALLBACK_DESCRIPTION_RAW
        );
      });
    });

    // This entire block is now obsolete and has been removed.
    // describe('Available Actions Building', () => { ... });

    describe('Perception Log Building', () => {
      test('should return empty array if no perception component', async () => {
        const { perceptionLog } = await provider.buildGameState(
          mockActor,
          turnContext,
          logger
        );
        expect(perceptionLog).toEqual([]);
      });

      test('should return populated log with defaults', async () => {
        mockActor.setComponentData(PERCEPTION_LOG_COMPONENT_ID, {
          logEntries: [{ timestamp: 123 }],
        });
        const { perceptionLog } = await provider.buildGameState(
          mockActor,
          turnContext,
          logger
        );
        expect(perceptionLog).toEqual([
          {
            descriptionText: DEFAULT_FALLBACK_EVENT_DESCRIPTION_RAW,
            timestamp: 123,
            perceptionType: 'unknown',
          },
        ]);
      });

      test('should return empty array and log on error', async () => {
        mockActor.hasComponent = jest.fn((id) => {
          if (id === PERCEPTION_LOG_COMPONENT_ID) {
            throw new Error('Test error');
          }
          return false;
        });
        const { perceptionLog } = await provider.buildGameState(
          mockActor,
          turnContext,
          logger
        );
        expect(perceptionLog).toEqual([]);
        expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
          SYSTEM_ERROR_OCCURRED_ID,
          expect.objectContaining({
            message: expect.stringContaining('Test error'),
          })
        );
      });
    });

    describe('Overall Orchestration', () => {
      test('should call all providers and assemble the DTO', async () => {
        const actorSpy = jest.spyOn(actorStateProvider, 'build');
        const locationSpy = jest.spyOn(locationSummaryProvider, 'build');
        const perceptionSpy = jest.spyOn(perceptionLogProvider, 'get');
        const extractorSpy = jest.spyOn(
          actorDataExtractor,
          'extractPromptData'
        );

        const gameState = await provider.buildGameState(
          mockActor,
          turnContext,
          logger
        );

        expect(actorSpy).toHaveBeenCalledWith(mockActor, logger);
        expect(locationSpy).toHaveBeenCalledWith(mockActor, logger);
        expect(perceptionSpy).toHaveBeenCalledWith(
          mockActor,
          logger,
          safeEventDispatcher
        );
        expect(extractorSpy).toHaveBeenCalledWith(
          actorSpy.mock.results[0].value
        );

        expect(gameState).toHaveProperty('actorState');
        expect(gameState).toHaveProperty('actorPromptData');
        expect(gameState).toHaveProperty('currentLocation');
        expect(gameState).toHaveProperty('perceptionLog');
        // Assert the new, correct behavior for availableActions
        expect(gameState.availableActions).toBeNull();
      });

      test('should still build other parts if a provider returns null/empty', async () => {
        jest.spyOn(locationSummaryProvider, 'build').mockResolvedValue(null);

        const gameState = await provider.buildGameState(
          mockActor,
          turnContext,
          logger
        );

        expect(gameState.currentLocation).toBeNull();
        // Assert the new, correct behavior for availableActions
        expect(gameState.availableActions).toBeNull();
        expect(gameState.actorState).not.toBeNull();
        expect(gameState.perceptionLog).not.toBeNull();
      });
    });
  });
});
