/**
 * @file Integration tests for the PromptCoordinator.
 * @see tests/turns/prompting/promptCoordinator.test.js
 */

import { beforeEach, describe, expect, it, jest, fail } from '@jest/globals';

// Class under test
import PromptCoordinator from '../../../src/turns/prompting/promptCoordinator.js';

// Real dependencies for integration
import ActionContextBuilder from '../../../src/turns/prompting/actionContextBuilder.js';
import { PromptError } from '../../../src/errors/promptError.js';
import { PLAYER_TURN_SUBMITTED_ID } from '../../../src/constants/eventIds.js';
// Note: We don't import PromptSession as it's an internal implementation detail of the coordinator.

// --- Mocks ---

const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const mockActionDiscoveryService = () => ({
  getValidActions: jest.fn(),
});

const mockPromptOutputPort = () => ({
  prompt: jest.fn(),
});

const mockWorldContext = () => ({
  getLocationOfEntity: jest.fn(),
});

// --- Test Suite ---
describe('PromptCoordinator Integration Test', () => {
  jest.useRealTimers();

  // Coordinator and its real dependencies
  let coordinator;
  let actionContextBuilder;

  // Mocks
  let logger;
  let actionDiscoveryService;
  let promptOutputPort;
  let playerTurnEvents;
  let worldContext;
  let entityManager;
  let gameDataRepository;

  // Helpers for event simulation
  let capturedEventHandler = null;
  let mockUnsubscribeFn = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    capturedEventHandler = null;
    mockUnsubscribeFn.mockClear();

    // Instantiate Mocks
    logger = mockLogger();
    actionDiscoveryService = mockActionDiscoveryService();
    promptOutputPort = mockPromptOutputPort();
    worldContext = mockWorldContext();
    entityManager = {
      /* Not directly used in this flow, can be an empty object */
    };
    gameDataRepository = {
      /* Not directly used in this flow, can be an empty object */
    };

    // This is the key part of the integration test setup.
    // We mock the event bus to capture the subscription handler.
    playerTurnEvents = {
      subscribe: jest.fn((eventId, handler) => {
        if (eventId === PLAYER_TURN_SUBMITTED_ID) {
          capturedEventHandler = handler;
        }
        return mockUnsubscribeFn;
      }),
    };

    // Instantiate REAL ActionContextBuilder with mocked dependencies
    actionContextBuilder = new ActionContextBuilder({
      worldContext,
      entityManager,
      gameDataRepository,
      logger,
    });

    // Instantiate REAL PromptCoordinator with real and mocked dependencies
    coordinator = new PromptCoordinator({
      logger,
      actionDiscoveryService,
      promptOutputPort,
      actionContextBuilder, // <-- Real instance
      playerTurnEvents,
    });
  });

  it('✅ Happy path: should discover, prompt, await event, and resolve with action', async () => {
    // Arrange
    const actor = { id: 'player-1', name: 'Hero' };
    const mockLocation = { id: 'loc-1', name: 'Tavern' };
    const discoveredActions = [
      { id: 'core:wait', command: 'Wait' },
      { id: 'core:speak', command: 'Speak' },
    ];
    const chosenAction = discoveredActions[0];
    const chosenSpeech = 'I will wait.';

    worldContext.getLocationOfEntity.mockResolvedValue(mockLocation);
    actionDiscoveryService.getValidActions.mockResolvedValue(discoveredActions);

    // Act
    const promptPromise = coordinator.prompt(actor);

    // Assert: Initial calls
    await new Promise(process.nextTick);

    expect(worldContext.getLocationOfEntity).toHaveBeenCalledWith(actor.id);
    expect(actionDiscoveryService.getValidActions).toHaveBeenCalledWith(
      actor,
      expect.any(Object)
    );
    expect(promptOutputPort.prompt).toHaveBeenCalledWith(
      actor.id,
      discoveredActions
    );
    expect(playerTurnEvents.subscribe).toHaveBeenCalledWith(
      PLAYER_TURN_SUBMITTED_ID,
      expect.any(Function)
    );
    expect(capturedEventHandler).not.toBeNull();

    // Act: Simulate player input event
    capturedEventHandler({
      payload: {
        actionId: chosenAction.id,
        speech: chosenSpeech,
        submittedByActorId: actor.id,
      },
    });

    // Assert: Final resolution
    await expect(promptPromise).resolves.toEqual({
      action: chosenAction,
      speech: chosenSpeech,
    });

    // Assert: Cleanup
    expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1);
  });

  it('✅ Discovery error: should surface the message to the UI and propagate the rejection', async () => {
    // Arrange
    const actor = { id: 'player-1' };
    const mockLocation = { id: 'loc-1' };
    const discoveryError = new PromptError(
      'Discovery failed!',
      null,
      'ACTION_DISCOVERY_FAILED'
    );

    worldContext.getLocationOfEntity.mockResolvedValue(mockLocation);
    actionDiscoveryService.getValidActions.mockRejectedValue(discoveryError);

    // Act
    const promptPromise = coordinator.prompt(actor);

    // Assert: This test was already using the robust `rejects` syntax.
    await expect(promptPromise).rejects.toBe(discoveryError);
    expect(promptOutputPort.prompt).toHaveBeenCalledWith(
      actor.id,
      [],
      discoveryError
    );
    expect(playerTurnEvents.subscribe).not.toHaveBeenCalled();
  });
});
