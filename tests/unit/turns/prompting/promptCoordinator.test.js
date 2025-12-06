import { jest, describe, beforeEach, it, expect } from '@jest/globals';

// Mock PromptSession before importing PromptCoordinator
jest.mock('../../../../src/turns/prompting/promptSession.js');

import { PromptSession } from '../../../../src/turns/prompting/promptSession.js';
import PromptCoordinator from '../../../../src/turns/prompting/promptCoordinator.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

const mockPromptReturn = { result: 'ok' };

const createDeferred = () => {
  /** @type {(value: unknown) => void} */
  let resolve = () => {};
  const promise = new Promise((res) => {
    resolve = res;
  });
  return {
    promise,
    resolve,
  };
};

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
  visual: { icon: 'fire' },
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
    await expect(coordinator.prompt(actor)).rejects.toThrow(
      'PromptCoordinator.prompt: indexedComposites array is required and cannot be empty.'
    );
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
        visual: composite.visual,
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

  it('passes suggestedAction through to the prompt output port when provided', async () => {
    const suggestion = { index: 2, descriptor: 'LLM suggests: wait' };

    await coordinator.prompt(actor, {
      indexedComposites: [composite],
      suggestedAction: suggestion,
    });

    expect(promptOutputPort.prompt).toHaveBeenCalledWith(
      actor.id,
      [
        {
          index: composite.index,
          actionId: composite.actionId,
          commandString: composite.commandString,
          params: composite.params,
          description: composite.description,
          visual: composite.visual,
        },
      ],
      {
        suggestedAction: suggestion,
      }
    );
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

  it('retains a newer session when an earlier prompt resolves later', async () => {
    const firstDeferred = createDeferred();
    let firstSession;
    PromptSession.mockImplementationOnce((args) => {
      firstSession = {
        args,
        run: jest.fn(() => firstDeferred.promise),
        cancel: jest.fn(),
      };
      return firstSession;
    });

    const firstPromptPromise = coordinator.prompt(actor, {
      indexedComposites: [composite],
    });

    await Promise.resolve();

    const secondDeferred = createDeferred();
    let secondSession;
    PromptSession.mockImplementationOnce((args) => {
      secondSession = {
        args,
        run: jest.fn(() => secondDeferred.promise),
        cancel: jest.fn(),
      };
      return secondSession;
    });

    const secondPromptPromise = coordinator.prompt(actor, {
      indexedComposites: [composite],
    });
    await Promise.resolve();

    firstDeferred.resolve({ value: 'first-complete' });
    await firstPromptPromise;

    coordinator.cancelCurrentPrompt();
    expect(firstSession.cancel).not.toHaveBeenCalled();
    expect(secondSession.cancel).toHaveBeenCalledTimes(1);

    secondDeferred.resolve({ value: 'second-complete' });
    await secondPromptPromise;
  });
});
