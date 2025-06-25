import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import PromptCoordinator from '../../../../src/turns/prompting/promptCoordinator.js';

global.__constructedOpts = undefined;
global.__runMock = undefined;
global.__cancelMock = undefined;

jest.mock('../../../../src/turns/prompting/promptSession.js', () => ({
  __esModule: true,
  PromptSession: function (opts) {
    global.__constructedOpts = opts;
    return { run: global.__runMock, cancel: global.__cancelMock };
  },
}));

describe('PromptCoordinator', () => {
  let logger;
  let promptOutputPort;
  let actionIndexingService;
  let playerTurnEvents;
  let actor;

  beforeEach(() => {
    global.__runMock = jest.fn();
    global.__cancelMock = jest.fn();
    global.__constructedOpts = undefined;

    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    promptOutputPort = { prompt: jest.fn() };
    actionIndexingService = { index: jest.fn(), resolve: jest.fn() };
    playerTurnEvents = {};
    actor = { id: 'actor-1' };
    jest.clearAllMocks();
  });

  const createCoordinator = () =>
    new PromptCoordinator({
      logger,
      promptOutputPort,
      actionIndexingService,
      playerTurnEvents,
    });

  it('throws if indexedComposites is missing or empty', async () => {
    const c = createCoordinator();
    await expect(c.prompt(actor)).rejects.toThrow(
      'PromptCoordinator.prompt: indexedComposites array is required and cannot be empty.'
    );
    await expect(c.prompt(actor, { indexedComposites: [] })).rejects.toThrow(
      'PromptCoordinator.prompt: indexedComposites array is required and cannot be empty.'
    );
  });

  it('throws if cancellation signal already aborted', async () => {
    const c = createCoordinator();
    const ac = new AbortController();
    ac.abort();
    const composites = [
      { index: 1, actionId: 'a', commandString: 'a', params: {} },
    ];
    await expect(
      c.prompt(actor, {
        indexedComposites: composites,
        cancellationSignal: ac.signal,
      })
    ).rejects.toThrow('Prompt operation was aborted.');
  });

  it('prompts and clears active session after resolution', async () => {
    const c = createCoordinator();
    const composites = [
      {
        index: 1,
        actionId: 'a',
        commandString: 'a',
        params: {},
        description: 'A',
      },
    ];
    global.__runMock.mockResolvedValue('done');
    const p = c.prompt(actor, { indexedComposites: composites });
    await Promise.resolve();
    expect(promptOutputPort.prompt).toHaveBeenCalledWith(actor.id, [
      {
        index: 1,
        actionId: 'a',
        commandString: 'a',
        params: {},
        description: 'A',
      },
    ]);
    expect(global.__constructedOpts).toEqual({
      actorId: actor.id,
      eventBus: playerTurnEvents,
      logger,
      abortSignal: undefined,
      actionIndexingService,
    });
    await p;
    c.cancelCurrentPrompt();
    expect(logger.debug).toHaveBeenCalledWith(
      'cancelCurrentPrompt called, but no active prompt to cancel.'
    );
  });

  it('cancelCurrentPrompt cancels active prompt and logs', async () => {
    const c = createCoordinator();
    global.__runMock.mockResolvedValue('result');
    const composites = [
      {
        index: 1,
        actionId: 'a',
        commandString: 'a',
        params: {},
        description: 'A',
      },
    ];
    const p = c.prompt(actor, { indexedComposites: composites });
    await Promise.resolve();
    c.cancelCurrentPrompt();
    expect(global.__cancelMock).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      'Externally cancelling the current prompt.'
    );
    await p.catch(() => {});
  });

  it('cancelCurrentPrompt logs debug when no active prompt', () => {
    const c = createCoordinator();
    c.cancelCurrentPrompt();
    expect(logger.debug).toHaveBeenCalledWith(
      'cancelCurrentPrompt called, but no active prompt to cancel.'
    );
  });
});
