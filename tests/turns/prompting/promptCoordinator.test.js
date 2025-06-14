/**
 * @file Integration tests for PromptCoordinator (index-based flow).
 * @see tests/turns/prompting/promptCoordinator.test.js
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// ─── SUT & real collaborators ────────────────────────────────────
import PromptCoordinator from '../../../src/turns/prompting/promptCoordinator.js';
import ActionContextBuilder from '../../../src/turns/prompting/actionContextBuilder.js';
import { PromptError } from '../../../src/errors/promptError.js';
import { PLAYER_TURN_SUBMITTED_ID } from '../../../src/constants/eventIds.js';

// ─── Mock helpers ────────────────────────────────────────────────
const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const mockActionDiscoveryService = () => ({ getValidActions: jest.fn() });
const mockPromptOutputPort = () => ({ prompt: jest.fn() });
const mockWorldContext = () => ({ getLocationOfEntity: jest.fn() });

/** A minimal in-memory stub for ActionIndexingService. */
function createIndexerStub() {
  /** @type {import('../../../src/turns/services/actionIndexingService.js').ActionComposite[]} */
  let lastComposites = [];
  return {
    indexActions: jest.fn((_actorId, raw) => {
      lastComposites = raw.map((a, i) => ({
        index: i + 1,
        actionId: a.id,
        commandString: a.command,
        description: a.name ?? a.command,
        params: a.params ?? {},
      }));
      return lastComposites;
    }),
    resolve: jest.fn((_actorId, idx) =>
      lastComposites.find((c) => c.index === idx)
    ),
  };
}

// ─── Test suite ──────────────────────────────────────────────────
describe('PromptCoordinator Integration Test', () => {
  jest.useRealTimers(); // Coordinator uses async/await, no fake-timer shenanigans

  // Real & mock deps
  let coordinator;
  let actionContextBuilder;
  let logger;
  let actionDiscoveryService;
  let promptOutputPort;
  let playerTurnEvents;
  let worldContext;
  let entityManager;
  let gameDataRepository;
  let indexerStub;

  // Utilities for capturing the subscribe handler
  let capturedEventHandler = null;
  const mockUnsubscribeFn = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    capturedEventHandler = null;
    mockUnsubscribeFn.mockClear();

    // ─── mocks
    logger = mockLogger();
    actionDiscoveryService = mockActionDiscoveryService();
    promptOutputPort = mockPromptOutputPort();
    worldContext = mockWorldContext();
    indexerStub = createIndexerStub();
    entityManager = {}; // not exercised here
    gameDataRepository = {};

    playerTurnEvents = {
      subscribe: jest.fn((evtId, handler) => {
        if (evtId === PLAYER_TURN_SUBMITTED_ID) capturedEventHandler = handler;
        return mockUnsubscribeFn;
      }),
    };

    // ─── real builder
    actionContextBuilder = new ActionContextBuilder({
      worldContext,
      entityManager,
      gameDataRepository,
      logger,
    });

    // ─── SUT
    coordinator = new PromptCoordinator({
      logger,
      actionDiscoveryService,
      promptOutputPort,
      actionContextBuilder,
      actionIndexingService: indexerStub,
      playerTurnEvents,
    });
  });

  // ──────────────────────────────────────────────────────────────
  it('✅ Happy path: discover ➜ index ➜ prompt ➜ await ➜ resolve', async () => {
    // Arrange
    const actor = { id: 'player-1', name: 'Hero' };
    const mockLocation = { id: 'loc-1', name: 'Tavern' };
    const discoveredActions = [
      { id: 'core:wait', command: 'Wait', name: 'Wait', description: 'Wait' },
      {
        id: 'core:speak',
        command: 'Speak',
        name: 'Speak',
        description: 'Speak',
      },
    ];
    const chosenIndex = 1;
    const chosenSpeech = 'I shall wait.';

    worldContext.getLocationOfEntity.mockResolvedValue(mockLocation);
    actionDiscoveryService.getValidActions.mockResolvedValue(discoveredActions);

    // Act
    const promptPromise = coordinator.prompt(actor);

    // Flush micro-tasks so the discovery takes place
    await new Promise(process.nextTick);

    // ── Assertions before player input ──
    expect(worldContext.getLocationOfEntity).toHaveBeenCalledWith(actor.id);
    expect(actionDiscoveryService.getValidActions).toHaveBeenCalledWith(
      actor,
      expect.any(Object)
    );
    // Indexer usage
    expect(indexerStub.indexActions).toHaveBeenCalledWith(
      actor.id,
      discoveredActions
    );

    // ************************** FIXED TEST LOGIC **************************
    // The test now correctly reflects that PromptCoordinator transforms the
    // indexed composites back into a UI-friendly format before prompting.
    const indexedComposites = indexerStub.indexActions.mock.results[0].value;
    const expectedActionsForPrompt = indexedComposites.map((comp) => ({
      index: comp.index,
      id: comp.actionId,
      name: comp.description,
      command: comp.commandString,
      description: comp.description,
      params: comp.params,
    }));

    expect(promptOutputPort.prompt).toHaveBeenCalledWith(
      actor.id,
      expectedActionsForPrompt
    );
    // ********************************************************************

    expect(playerTurnEvents.subscribe).toHaveBeenCalledWith(
      PLAYER_TURN_SUBMITTED_ID,
      expect.any(Function)
    );
    expect(capturedEventHandler).toBeInstanceOf(Function);

    // Simulate player choice
    capturedEventHandler({
      payload: {
        submittedByActorId: actor.id,
        chosenIndex: chosenIndex,
        speech: chosenSpeech,
      },
    });

    // Final resolution
    const chosenComposite = indexedComposites.find(
      (c) => c.index === chosenIndex
    );
    const expectedAction = {
      id: chosenComposite.actionId,
      name: chosenComposite.description,
      command: chosenComposite.commandString,
      description: chosenComposite.description,
      params: chosenComposite.params,
    };

    // FIX: Updated expectation to include the new fields, which default to null.
    await expect(promptPromise).resolves.toEqual({
      action: expectedAction,
      chosenIndex: 1,
      speech: chosenSpeech,
      thoughts: null,
      notes: null,
    });
    expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1);
  });

  // ──────────────────────────────────────────────────────────────
  it('✅ Discovery error surfaces through UI and rejects', async () => {
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
    const p = coordinator.prompt(actor);

    // Assert
    await expect(p).rejects.toBe(discoveryError);
    expect(promptOutputPort.prompt).toHaveBeenCalledWith(
      actor.id,
      [],
      discoveryError
    );
    expect(playerTurnEvents.subscribe).not.toHaveBeenCalled();
    expect(indexerStub.indexActions).not.toHaveBeenCalled();
  });
});
