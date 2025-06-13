/**
 * @file Integration tests for PromptCoordinator.
 * @description Verifies interaction between PromptCoordinator, PromptSession
 *              and ActionIndexingService (integer-based resolution).
 */

/* eslint-env jest */
import { jest, describe, beforeEach, it, expect } from '@jest/globals';

import PromptCoordinator from '../../src/turns/prompting/promptCoordinator.js';
import { PromptError } from '../../src/errors/promptError.js';
import { PLAYER_TURN_SUBMITTED_ID } from '../../src/constants/eventIds.js';

describe('PromptCoordinator – Indexing integration', () => {
  // ─── Mocks ──────────────────────────────────────────────────────────────
  let mockLogger,
    mockActionDiscoveryService,
    mockPromptOutputPort,
    mockActionContextBuilder,
    mockPlayerTurnEvents,
    mockActionIndexingService,
    mockUnsubscribe,
    promptCoordinator;

  const actor = { id: 'player-123' };
  const context = { world: 'the-world' };

  const rawActions = [
    { id: 'core:wait', command: 'Wait', params: {} },
    { id: 'core:move', command: 'Move North', params: { direction: 'N' } },
  ];

  const indexedComposites = [
    {
      index: 1,
      actionId: 'core:wait',
      commandString: 'Wait',
      params: {},
      description: 'Do nothing.',
    },
    {
      index: 2,
      actionId: 'core:move',
      commandString: 'Move North',
      params: { direction: 'N' },
      description: 'Move to the north.',
    },
  ];

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    };
    mockActionDiscoveryService = {
      getValidActions: jest.fn().mockResolvedValue(rawActions),
    };
    mockPromptOutputPort = { prompt: jest.fn().mockResolvedValue() };
    mockActionContextBuilder = {
      buildContext: jest.fn().mockResolvedValue(context),
    };
    mockUnsubscribe = jest.fn();

    mockPlayerTurnEvents = {
      subscribe: jest.fn().mockReturnValue(mockUnsubscribe),
      emit: jest.fn(),
    };

    mockActionIndexingService = {
      indexActions: jest.fn().mockReturnValue(indexedComposites),
      resolve: jest.fn(),
      getIndexedList: jest.fn(),
    };

    promptCoordinator = new PromptCoordinator({
      logger: mockLogger,
      actionDiscoveryService: mockActionDiscoveryService,
      promptOutputPort: mockPromptOutputPort,
      actionContextBuilder: mockActionContextBuilder,
      actionIndexingService: mockActionIndexingService,
      playerTurnEvents: mockPlayerTurnEvents,
    });
  });

  // ─── Happy-path ─────────────────────────────────────────────────────────
  it('discovers, indexes and resolves an action via the indexer', async () => {
    expect.assertions(8);

    const chosenIndex = 2;
    const chosenComposite = indexedComposites[1];
    mockActionIndexingService.resolve.mockReturnValue(chosenComposite);

    const promptPromise = promptCoordinator.prompt(actor);
    await new Promise(process.nextTick); // let async setup finish

    // sanity checks before emitting the fake event
    expect(mockActionContextBuilder.buildContext).toHaveBeenCalledWith(actor);
    expect(mockActionDiscoveryService.getValidActions).toHaveBeenCalledWith(
      actor,
      context
    );
    expect(mockActionIndexingService.indexActions).toHaveBeenCalledWith(
      actor.id,
      rawActions
    );
    expect(mockPromptOutputPort.prompt).toHaveBeenCalledWith(
      actor.id,
      indexedComposites
    );
    expect(mockPlayerTurnEvents.subscribe).toHaveBeenCalledWith(
      PLAYER_TURN_SUBMITTED_ID,
      expect.any(Function)
    );

    const eventHandler = mockPlayerTurnEvents.subscribe.mock.lastCall[1];

    // 👉 attach the handler FIRST, then emit
    const expectation = expect(promptPromise).resolves.toEqual({
      action: {
        id: chosenComposite.actionId,
        name: chosenComposite.description,
        command: chosenComposite.commandString,
        description: chosenComposite.description,
        params: chosenComposite.params,
      },
      speech: 'Onwards!',
      thoughts: null,
      notes: null,
    });

    eventHandler({
      payload: {
        index: chosenIndex,
        speech: 'Onwards!',
        submittedByActorId: actor.id,
      },
    });

    await expectation;
    expect(mockActionIndexingService.resolve).toHaveBeenCalledWith(
      actor.id,
      chosenIndex
    );
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  // ─── Discovery-error path ──────────────────────────────────────────────
  it('surfaces action-discovery failures via the output port', async () => {
    const discoveryError = new PromptError(
      'Could not find actions.',
      null,
      'ACTION_DISCOVERY_FAILED'
    );
    mockActionDiscoveryService.getValidActions.mockRejectedValue(
      discoveryError
    );

    await expect(promptCoordinator.prompt(actor)).rejects.toBe(discoveryError);
    expect(mockPromptOutputPort.prompt).toHaveBeenCalledWith(
      actor.id,
      [],
      discoveryError
    );
    expect(mockPlayerTurnEvents.subscribe).not.toHaveBeenCalled();
  });
});
