// --- FILE START ---
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';

// ▸ Tiny stubs ───────────────────────────────────────────────────────────────
const mkLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const mkActor = (id = 'actor1') => ({ id });

// Dummy strategy that is never actually invoked here
const dummyStrategy = { decideAction: jest.fn() };

// Common no-op providers
const noop = () => {};
const alwaysFalse = () => false;

describe('TurnContext.endTurn', () => {
  let logger;
  let onEndTurnCb;
  let handler; // mocked handler instance
  let tc; // TurnContext under test

  /**
   *
   * @param isHandlerDestroyed
   */
  function createContext(isHandlerDestroyed) {
    logger = mkLogger();
    onEndTurnCb = jest.fn();
    handler = { _isDestroyed: isHandlerDestroyed };

    tc = new TurnContext({
      actor: mkActor(),
      logger,
      services: {}, // nothing accessed in this test
      strategy: dummyStrategy,
      onEndTurnCallback: onEndTurnCb,
      isAwaitingExternalEventProvider: alwaysFalse,
      onSetAwaitingExternalEventCallback: noop,
      handlerInstance: handler,
    });
  }

  it('calls onEndTurnCallback when the handler is still alive', () => {
    createContext(false); // handler NOT destroyed
    const initialSignal = tc.getPromptSignal();
    expect(initialSignal.aborted).toBe(false);

    tc.endTurn(); // act

    expect(onEndTurnCb).toHaveBeenCalledTimes(1);
    expect(initialSignal.aborted).toBe(true); // prompt was cancelled
    expect(tc.getPromptSignal().aborted).toBe(false); // subsequent calls reuse a fresh controller
  });

  it('suppresses the callback when the handler is already destroyed', () => {
    createContext(true); // handler destroyed
    const initialSignal = tc.getPromptSignal();
    expect(initialSignal.aborted).toBe(false);
    tc.endTurn(); // act

    expect(onEndTurnCb).not.toHaveBeenCalled();
    expect(initialSignal.aborted).toBe(true); // still aborts the original prompt
    expect(tc.getPromptSignal().aborted).toBe(false); // future prompts can proceed
  });
});
