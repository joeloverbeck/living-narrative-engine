import { jest, describe, beforeEach, it, expect } from '@jest/globals';

// Mock PromptSession before importing PromptCoordinator
jest.mock('../../../../src/turns/prompting/promptSession.js');

import { PromptSession } from '../../../../src/turns/prompting/promptSession.js';
import PromptCoordinator from '../../../../src/turns/prompting/promptCoordinator.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

const mockPromptReturn = { result: 'ok' };

// Helper to create a fake PromptSession instance
let promptSessionInstance;
class FakePromptSession {
  constructor(args) {
    this.args = args;
    this.run = jest.fn().mockResolvedValue(mockPromptReturn);
    this.cancel = jest.fn();
    promptSessionInstance = this;
  }
}

PromptSession.mockImplementation((args) => new FakePromptSession(args));

const actor = { id: 'actor1' };
const composite = {
  index: 1,
  actionId: 'a1',
  commandString: 'do',
  description: 'desc',
  params: {},
};

let logger, promptOutputPort, actionIndexer, playerTurnEvents, coordinator;

beforeEach(() => {
  jest.clearAllMocks();
  logger = createMockLogger();
  promptOutputPort = { prompt: jest.fn() };
  actionIndexer = { index: jest.fn(), resolve: jest.fn() };
  playerTurnEvents = {};
  coordinator = new PromptCoordinator({
    logger,
    promptOutputPort,
    actionIndexingService: actionIndexer,
    playerTurnEvents,
  });
});

describe('PromptCoordinator.prompt', () => {
  it('throws if indexedComposites is missing or empty', async () => {
    await expect(coordinator.prompt(actor, {})).rejects.toThrow(
      'PromptCoordinator.prompt: indexedComposites array is required and cannot be empty.'
    );
    await expect(
      coordinator.prompt(actor, { indexedComposites: [] })
    ).rejects.toThrow(
      'PromptCoordinator.prompt: indexedComposites array is required and cannot be empty.'
    );
  });

  it('throws if cancellationSignal already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      coordinator.prompt(actor, {
        indexedComposites: [composite],
        cancellationSignal: ac.signal,
      })
    ).rejects.toThrow(DOMException);
  });

  it('creates a prompt session and returns its resolution', async () => {
    const res = await coordinator.prompt(actor, {
      indexedComposites: [composite],
    });
    expect(promptOutputPort.prompt).toHaveBeenCalledWith(actor.id, [
      {
        index: composite.index,
        actionId: composite.actionId,
        commandString: composite.commandString,
        params: composite.params,
        description: composite.description,
      },
    ]);
    expect(PromptSession).toHaveBeenCalledWith({
      actorId: actor.id,
      eventBus: playerTurnEvents,
      logger,
      abortSignal: undefined,
      actionIndexingService: actionIndexer,
    });
    expect(res).toBe(mockPromptReturn);

    // After the promise resolves, cancelCurrentPrompt should not cancel anything
    coordinator.cancelCurrentPrompt();
    expect(promptSessionInstance.cancel).not.toHaveBeenCalled();
  });

  it('cancelCurrentPrompt invokes session.cancel when active', async () => {
    const p = coordinator.prompt(actor, { indexedComposites: [composite] });
    await Promise.resolve();
    coordinator.cancelCurrentPrompt();
    expect(promptSessionInstance.cancel).toHaveBeenCalledTimes(1);
    await p;
  });

  it('cancelCurrentPrompt is a no-op with no active session', () => {
    coordinator.cancelCurrentPrompt();
    expect(logger.debug).toHaveBeenCalledWith(
      'cancelCurrentPrompt called, but no active prompt to cancel.'
    );
  });
});
