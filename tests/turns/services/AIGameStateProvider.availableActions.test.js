// tests/turns/aigamestateprovider.availableActions.test.js

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

import { AIGameStateProvider } from '../../../src/turns/services/AIGameStateProvider.js';
import {
  POSITION_COMPONENT_ID,
  NAME_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

// Import the real providers for integration testing
import { ActorStateProvider } from '../../../src/data/providers/actorStateProvider.js';
import { ActorDataExtractor } from '../../../src/turns/services/actorDataExtractor.js';
import { LocationSummaryProvider } from '../../../src/data/providers/locationSummaryProvider.js';
import { AvailableActionsProvider } from '../../../src/data/providers/availableActionsProvider.js';
import { PerceptionLogProvider } from '../../../src/data/providers/perceptionLogProvider.js';
import { EntitySummaryProvider } from '../../../src/data/providers/entitySummaryProvider.js';

describe('AIGameStateProvider - Integration Test for Available Actions', () => {
  const LOCATION_ID = 'loc-123';

  /** Minimal mock actor with a position component */
  const makeMockActor = () => {
    const entries = new Map([
      [POSITION_COMPONENT_ID, { locationId: LOCATION_ID }],
    ]);
    return {
      id: 'actor-1',
      componentEntries: entries,
      getComponentData: (cid) =>
        cid === POSITION_COMPONENT_ID ? { locationId: LOCATION_ID } : undefined,
      hasComponent: () => false,
    };
  };

  /** Reusable no-op logger */
  const mkLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });

  let capturedCtx;
  const mockADS = {
    getValidActions: jest.fn((actor, ctx) => {
      capturedCtx = ctx; // capture the ActionContext
      return Promise.resolve([]); // nothing else matters for this test
    }),
  };

  const mockTurnContext = {
    // The new providers don't use getEntityManager or getActionDiscoveryService from turnContext.
    // They are injected directly. AvailableActionsProvider uses turnContext.game.
    game: {},
  };

  beforeEach(() => {
    mockADS.getValidActions.mockClear();
    capturedCtx = undefined;
  });

  it('passes the full location entity object to ActionDiscoveryService via buildGameState', async () => {
    // Arrange: Provide a mock entity manager and a more complete mock location entity
    const mockLocationEntity = {
      id: LOCATION_ID,
      name: 'Test Room',
      getComponentData: jest.fn((cid) => {
        if (cid === NAME_COMPONENT_ID) return { text: 'Test Room' };
        if (cid === DESCRIPTION_COMPONENT_ID)
          return { text: 'A descriptive room.' };
        return undefined; // Other components are not present
      }),
      hasComponent: (cid) =>
        [NAME_COMPONENT_ID, DESCRIPTION_COMPONENT_ID].includes(cid),
    };

    const mockEntityManager = {
      getEntityInstance: jest.fn(async (id) => {
        if (id === LOCATION_ID) {
          return mockLocationEntity;
        }
        return null;
      }),
      // LocationSummaryProvider also calls getEntitiesInLocation
      getEntitiesInLocation: jest.fn(async (locationId) => new Set()),
    };

    // Arrange: Instantiate real providers with mocked dependencies for an integration-style test.
    const actorStateProvider = new ActorStateProvider();
    const actorDataExtractor = new ActorDataExtractor();
    const perceptionLogProvider = new PerceptionLogProvider();
    const entitySummaryProvider = new EntitySummaryProvider();
    const locationSummaryProvider = new LocationSummaryProvider({
      entityManager: mockEntityManager,
      summaryProvider: entitySummaryProvider,
    });
    const availableActionsProvider = new AvailableActionsProvider({
      actionDiscoveryService: mockADS,
      entityManager: mockEntityManager,
    });

    // Arrange: Instantiate the main provider with its concrete dependencies
    const provider = new AIGameStateProvider({
      actorStateProvider,
      actorDataExtractor,
      locationSummaryProvider,
      availableActionsProvider,
      perceptionLogProvider,
    });

    // Act: Call the public method that orchestrates the state building
    await provider.buildGameState(makeMockActor(), mockTurnContext, mkLogger());

    // Assert: The underlying ActionDiscoveryService received the correct context
    expect(mockADS.getValidActions).toHaveBeenCalledTimes(1);
    expect(capturedCtx).toBeDefined();
    expect(typeof capturedCtx.currentLocation).toBe('object');
    expect(capturedCtx.currentLocation).toBe(mockLocationEntity); // Should be the same object reference
  });
});
