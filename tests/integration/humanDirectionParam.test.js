/**
 * @file This test suite fulfills TKT‑005. It verifies that when a human player
 * selects an action with a direction (e.g., "go north"), the `direction`
 * parameter is correctly propagated and ends up in the `resolvedParameters`
 * object passed to `CommandProcessor.dispatchAction`.
 *
 * NOTE (2025‑06 refactor): the generic `context.requestTransition()` helper was
 * removed in favor of *specific* helpers (`requestAwaitingInputStateTransition`,
 * `requestProcessingCommandStateTransition`, etc.).  The harness below now
 * mocks those new helpers directly.
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { mockDeep } from 'jest-mock-extended';

// ─── Core modules ───────────────────────────────────────────────────────────
import { HumanPlayerStrategy } from '../../src/turns/strategies/humanPlayerStrategy.js';
import CommandProcessor from '../../src/commands/commandProcessor.js';
import Entity from '../../src/entities/entity.js';

// Base handler & seed state --------------------------------------------------
import { BaseTurnHandler } from '../../src/turns/handlers/baseTurnHandler.js';
import { TurnIdleState } from '../../src/turns/states/turnIdleState.js';

/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/interfaces/IPromptCoordinator.js').IPromptCoordinator} IPromptCoordinator */
/** @typedef {import('../../../src/turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../../src/turns/interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */

/** @typedef {import('../../../src/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../../src/turns/factories/turnStateFactory.js').default} TurnStateFactory */

// ─── Minimal test handler ---------------------------------------------------
class TestTurnHandler extends BaseTurnHandler {
  /**
   * @param {ILogger} logger @param {TurnStateFactory} factory
   * @param factory
   */
  constructor(logger, factory) {
    super({ logger, turnStateFactory: factory });
    this._setInitialState(new TurnIdleState(this));
  }

  /**
   * Injects the context and kicks off the turn just like real handlers.
   *
   * @param {ITurnContext} ctx
   */
  async startTestTurn(ctx) {
    this._setCurrentTurnContextInternal(ctx);
    await this._currentState.startTurn(this, ctx.getActor());
  }
}

// ─────────────────────────────────────────────────────────────────────────────
describe('TKT‑005 – Human "go north" supplies direction parameter', () => {
  /** @type {ILogger}                */ let log;
  /** @type {IPromptCoordinator}     */ let promptSvc;
  /** @type {ISafeEventDispatcher}   */ let dispatcher;
  /** @type {CommandProcessor}       */ let cp;
  /** @type {ReturnType<jest.spyOn>} */ let dispatchSpy;
  /** @type {ITurnContext}           */ let ctx;
  /** @type {Entity}                 */ let actor;
  /** @type {TestTurnHandler}        */ let handler;

  beforeEach(() => {
    // Base mocks ----------------------------------------------------------------
    log = mockDeep();
    promptSvc = mockDeep();
    dispatcher = mockDeep();

    cp = new CommandProcessor({ logger: log, safeEventDispatcher: dispatcher });
    dispatchSpy = jest
      .spyOn(cp, 'dispatchAction')
      .mockResolvedValue({ success: true, errorResult: null });

    actor = new Entity('player1', 'player');

    // Context mock --------------------------------------------------------------
    ctx = mockDeep();
    ctx.getActor.mockReturnValue(actor);
    ctx.getLogger.mockReturnValue(log);
    ctx.getSafeEventDispatcher.mockReturnValue(dispatcher);
    ctx.getStrategy.mockReturnValue(new HumanPlayerStrategy());
    ctx.getPlayerPromptService.mockReturnValue(promptSvc);
    ctx.getCommandProcessor.mockReturnValue(cp);

    ctx.setChosenAction.mockImplementation((a) =>
      ctx.getChosenAction.mockReturnValue(a)
    );

    // Default prompt (can be overridden in specific tests) ----------------------
    promptSvc.prompt.mockResolvedValue({
      action: {
        id: 'core:move',
        command: 'go north',
        params: { direction: 'north' },
      },
      speech: null,
      thoughts: null,
      notes: null,
    });

    // Fake factory – only Idle needed.
    const fakeFactory = { createIdleState: (h) => new TurnIdleState(h) };
    handler = new TestTurnHandler(log, fakeFactory);

    // Transition helpers reflecting 2025 API -----------------------------------
    ctx.requestAwaitingInputStateTransition.mockImplementation(async () => {
      const decision = await ctx.getStrategy().decideAction(ctx);
      const turnAction = decision.action ?? decision;
      ctx.setChosenAction(turnAction);
      await cp.dispatchAction(actor, turnAction);
    });

    ctx.requestProcessingCommandStateTransition.mockImplementation(
      async (_cmd, action) => {
        ctx.setChosenAction(action);
        await cp.dispatchAction(actor, action);
      }
    );

    ctx.requestIdleStateTransition.mockResolvedValue(undefined); // not used here
  });

  // ─── Tests ──────────────────────────────────────────────────────────────────
  test('direction parameter reaches CommandProcessor.dispatchAction', async () => {
    await handler.startTestTurn(ctx);

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const [actArg, actionArg] = dispatchSpy.mock.calls[0];

    expect(actArg.id).toBe('player1');
    expect(actionArg.actionDefinitionId).toBe('core:move');
    expect(actionArg.resolvedParameters).toEqual({ direction: 'north' });
  });

  test('resolvedParameters is empty when prompt returns none', async () => {
    promptSvc.prompt.mockResolvedValue({
      action: { id: 'core:move', command: 'go north' },
      speech: null,
    });

    await handler.startTestTurn(ctx);

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const [, actionArg] = dispatchSpy.mock.calls[0];

    expect(actionArg.resolvedParameters).toEqual({});
    expect(actionArg.resolvedParameters.direction).toBeUndefined();
  });
});
