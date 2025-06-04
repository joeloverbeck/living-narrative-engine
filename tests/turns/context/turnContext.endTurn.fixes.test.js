// --- FILE START ---
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { TurnContext } from '../../../src/turns/context/turnContext.js';

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
    expect(tc.getPromptSignal().aborted).toBe(false);

    tc.endTurn(); // act

    expect(onEndTurnCb).toHaveBeenCalledTimes(1);
    expect(tc.getPromptSignal().aborted).toBe(true); // prompt was cancelled
  });

  it('suppresses the callback when the handler is already destroyed', () => {
    createContext(true); // handler destroyed
    tc.endTurn(); // act

    expect(onEndTurnCb).not.toHaveBeenCalled();
    expect(tc.getPromptSignal().aborted).toBe(true); // still aborts the prompt
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Handler already destroyed')
    );
  });
});
