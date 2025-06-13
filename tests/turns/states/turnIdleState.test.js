// tests/turns/states/turnIdleState.test.js
/**
 * Test suite for TurnIdleState — exercises the success path plus
 * every defensive-error branch (invalid actor, missing context,
 * context/actor mismatch) and verifies the “idle” passthrough
 * handlers log & delegate correctly.
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { TurnIdleState } from '../../../src/turns/states/turnIdleState.js';

/* ------------------------------------------------------------------ */
/* Test helpers                                                       */
/* ------------------------------------------------------------------ */

// Minimal Entity stub – TurnIdleState only cares about the id field.
const makeActor = (id = 'actor-1') => ({ id });

// Shared mock logger
let logger;
const resetLogger = () => {
  logger = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
};

// Build a handler that satisfies the methods TurnIdleState touches.
const buildHandler = (ctx = null) => {
  const handler = {
    getTurnContext: jest.fn().mockReturnValue(ctx),
    getLogger: jest.fn(() => logger),
    _resetTurnStateAndResources: jest.fn(),
    _transitionToState: jest.fn().mockResolvedValue(undefined),
    // createIdleState just returns another TurnIdleState instance
    _turnStateFactory: {
      createIdleState: jest.fn((h) => new TurnIdleState(h)),
    },
  };
  return handler;
};

// Convenience: mock ITurnContext with only what TurnIdleState reads.
const buildCtx = (actor) => ({
  getLogger: jest.fn(() => logger),
  getActor: jest.fn(() => actor),
  requestAwaitingInputStateTransition: jest.fn().mockResolvedValue(undefined),
});

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

describe('TurnIdleState.startTurn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetLogger();
  });

  it('transitions to AwaitingPlayerInputState when actor & context are valid', async () => {
    const actor = makeActor();
    const ctx = buildCtx(actor);
    const handler = buildHandler(ctx);
    const idle = new TurnIdleState(handler);

    await expect(idle.startTurn(handler, actor)).resolves.not.toThrow();

    // Ensures AwaitingPlayerInputState transition was requested
    expect(ctx.requestAwaitingInputStateTransition).toHaveBeenCalledTimes(1);

    // No error handling paths should fire
    expect(handler._resetTurnStateAndResources).not.toHaveBeenCalled();
    expect(handler._transitionToState).not.toHaveBeenCalled();
  });

  it('throws & resets when actorEntity is null/invalid', async () => {
    const handler = buildHandler(buildCtx(null));
    const idle = new TurnIdleState(handler);

    await expect(idle.startTurn(handler, null)).rejects.toThrow(
      /invalid actorEntity/i
    );

    expect(handler._resetTurnStateAndResources).toHaveBeenCalledTimes(1);
    expect(handler._transitionToState).toHaveBeenCalledTimes(1);
  });

  it('throws & recovers when ITurnContext is missing', async () => {
    const actor = makeActor();
    const handler = buildHandler(null); // getTurnContext → null
    const idle = new TurnIdleState(handler);

    await expect(idle.startTurn(handler, actor)).rejects.toThrow(
      /ITurnContext is missing or invalid/i
    );

    expect(handler._resetTurnStateAndResources).toHaveBeenCalledTimes(1);
    expect(handler._transitionToState).toHaveBeenCalledTimes(1);
  });

  it('throws & recovers on actor/context mismatch', async () => {
    const actor = makeActor('actor-A');
    const ctxActor = makeActor('actor-B');
    const handler = buildHandler(buildCtx(ctxActor));
    const idle = new TurnIdleState(handler);

    await expect(idle.startTurn(handler, actor)).rejects.toThrow(
      /Actor in ITurnContext.*does not match/i
    );

    expect(handler._resetTurnStateAndResources).toHaveBeenCalledTimes(1);
    expect(handler._transitionToState).toHaveBeenCalledTimes(1);
  });
});

describe('TurnIdleState “idle passthrough” methods', () => {
  let handler;
  let idle;
  let actor;

  beforeEach(() => {
    jest.clearAllMocks();
    resetLogger();
    actor = makeActor();
    handler = buildHandler(null); // no context – these paths expect null
    idle = new TurnIdleState(handler);
  });

  const expectWarnAndThrow = async (fn, msgRegex) => {
    await expect(fn).rejects.toThrow(); // AbstractTurnState throws
    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(msgRegex));
  };

  it('handleSubmittedCommand warns & delegates', async () => {
    await expectWarnAndThrow(
      () => idle.handleSubmittedCommand(handler, 'look', actor),
      /no turn is active/i
    );
  });

  it('handleTurnEndedEvent warns & delegates (no throw)', async () => {
    const payload = { entityId: actor.id };
    await idle.handleTurnEndedEvent(handler, payload);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/no turn is active/i)
    );
  });

  it('processCommandResult warns & delegates', async () => {
    await expectWarnAndThrow(
      () =>
        idle.processCommandResult(handler, actor, { success: true }, 'look'),
      /no turn is active/i
    );
  });

  it('handleDirective warns & delegates', async () => {
    await expectWarnAndThrow(
      () => idle.handleDirective(handler, actor, 'ANY_DIRECTIVE', {}),
      /no turn is active/i
    );
  });
});
