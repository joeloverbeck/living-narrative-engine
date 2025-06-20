// tests/turns/handlers/baseTurnHandler.handleTurnEnd.fixed.test.js
// --- FILE START ---
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { BaseTurnHandler } from '../../../../src/turns/handlers/baseTurnHandler.js';
// Import state classes for the factory mock & instanceof checks if BaseTurnHandler uses them
import { TurnIdleState } from '../../../../src/turns/states/turnIdleState.js';
import { TurnEndingState } from '../../../../src/turns/states/turnEndingState.js';

// Mock for ITurnStateFactory
const mockTurnStateFactory = {
  createIdleState: jest.fn(),
  createEndingState: jest.fn(),
};

// Minimal concrete subclass
class TestTurnHandler extends BaseTurnHandler {
  constructor({ logger, turnStateFactory }) {
    super({ logger, turnStateFactory });
    // BaseTurnHandler constructor sets this._currentState = null;
    // For _handleTurnEnd tests, if it starts with _currentState = null,
    // it will attempt a transition to TurnEndingState.
    // If it needs to start in a specific state (e.g. Idle), set it here:
    // this._setInitialState(this._turnStateFactory.createIdleState(this));
    // For these specific tests, starting with _currentState = null is fine to test
    // the path that transitions to TurnEndingState.
  }

  async startTurn() {
    /* not needed for these tests */
  }

  // Helper to allow tests to set a specific current state if needed
  _setTestCurrentState(state) {
    this._currentState = state;
  }
}

const mkLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('BaseTurnHandler._handleTurnEnd', () => {
  let handler;
  let logger;

  beforeEach(() => {
    logger = mkLogger();

    // Reset and configure mockTurnStateFactory for each test
    mockTurnStateFactory.createIdleState.mockReset();
    mockTurnStateFactory.createEndingState.mockReset();

    // Configure factory methods to return objects that can be transitioned to/from.
    // They need at least getStateName, enterState, exitState.
    mockTurnStateFactory.createIdleState.mockImplementation((h) => {
      const state = new TurnIdleState(h);
      jest.spyOn(state, 'enterState').mockResolvedValue(undefined);
      jest.spyOn(state, 'exitState').mockResolvedValue(undefined);
      return state;
    });
    mockTurnStateFactory.createEndingState.mockImplementation(
      (h, actorId, error) => {
        // TurnEndingState.enterState internally tries to transition to IdleState.
        // So, createIdleState also needs to be properly mocked.
        const state = new TurnEndingState(h, actorId, error);
        jest.spyOn(state, 'enterState').mockImplementation(async function () {
          // Simplified enterState for mock to prevent deep transitions in THIS test.
          // Original TurnEndingState.enterState calls _resetTurnStateAndResources,
          // notifyTurnEnded, and then _transitionToState(createIdleState).
          // For this unit test of _handleTurnEnd, we mainly care that _handleTurnEnd
          // *tries* to transition to an ending state.
          this._handler = h; // Ensure handler is set for logging in AbstractTurnState
          await AbstractTurnState.prototype.enterState.call(this, h, null); // Call super for logging
          // Do not proceed with full TurnEndingState logic here to keep test focused.
        });
        jest.spyOn(state, 'exitState').mockResolvedValue(undefined);
        return state;
      }
    );

    handler = new TestTurnHandler({
      logger,
      turnStateFactory: mockTurnStateFactory,
    });
  });

  it('returns quietly when called after the handler is destroyed', async () => {
    handler._isDestroyed = true; // simulate prior destroy()

    await expect(
      handler._handleTurnEnd('actor1', null, /* fromDestroy = */ false)
    ).resolves.toBeUndefined(); // no throw / rejection

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `TestTurnHandler._handleTurnEnd ignored for actor actor1 – handler already destroyed.`
      )
    );
    // Ensure no attempt to transition state if destroyed early
    expect(mockTurnStateFactory.createEndingState).not.toHaveBeenCalled();
  });

  it('still runs normally when handler is active and not in Idle/Ending state', async () => {
    handler._isDestroyed = false;
    // Explicitly set current state to something other than Idle or Ending, or leave it null (initial)
    // If handler._currentState is null (as it is by default from TestTurnHandler constructor):
    // The check `!fromDestroy && (this._currentState instanceof ConcreteTurnEndingState || this._currentState instanceof ConcreteTurnIdleState)`
    // will be `true && (false || false)` which is `false`. So the early exit is NOT taken.

    await expect(
      handler._handleTurnEnd('actor1', null, false)
    ).resolves.toBeUndefined();

    // Check that the "already destroyed" warning was NOT called
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining(
        '_handleTurnEnd ignored for actor actor1 – handler already destroyed.'
      )
    );
    // Check that the "already in Idle/Ending state" warning/debug was NOT called
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('but already in')
    );
    expect(logger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('but already in')
    );

    // It should attempt to transition because _currentState is null (not Idle or Ending)
    expect(mockTurnStateFactory.createEndingState).toHaveBeenCalledWith(
      handler,
      'actor1',
      null
    );

    // Check for logs indicating the start of _handleTurnEnd and the transition
    expect(logger.debug).toHaveBeenCalledWith(
      `TestTurnHandler._handleTurnEnd initiated for actor actor1. Error: null. Called from destroy: false`
    );
    // The transition will be from "None (Initial)" to the name of the state returned by createEndingState
    // (which is 'TurnEndingState' if using the real class, or the mocked name).
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `TestTurnHandler: State Transition: None (Initial) → TurnEndingState`
      )
    );

    // If the mocked TurnEndingState.enterState was simplified and doesn't transition to Idle itself,
    // then createIdleState might not be called here. If it does, this check is valid.
    // Given our simplified mock for TurnEndingState.enterState, it won't transition further.
    // If we were testing deeper, we'd expect createIdleState to be called by TurnEndingState.
    // For this specific test of _handleTurnEnd, proving it *tries* to go to EndingState is key.
    // expect(mockTurnStateFactory.createIdleState).toHaveBeenCalled();
  });

  it('returns quietly if handler is active but already in TurnIdleState', async () => {
    handler._isDestroyed = false;
    const idleState = mockTurnStateFactory.createIdleState(handler); // Get a state instance
    handler._setTestCurrentState(idleState); // Put handler in Idle state

    await expect(
      handler._handleTurnEnd('actor1', null, false)
    ).resolves.toBeUndefined();

    expect(logger.debug).toHaveBeenCalledWith(
      `TestTurnHandler._handleTurnEnd called for actor1, but already in TurnIdleState. Ignoring.`
    );
    expect(mockTurnStateFactory.createEndingState).not.toHaveBeenCalled();
  });

  it('returns quietly if handler is active but already in TurnEndingState', async () => {
    handler._isDestroyed = false;
    // Use the actual TurnEndingState for instanceof check to be accurate
    const endingState = new TurnEndingState(handler, 'actor1', null);
    handler._setTestCurrentState(endingState); // Put handler in Ending state

    await expect(
      handler._handleTurnEnd('actor1', null, false)
    ).resolves.toBeUndefined();

    expect(logger.debug).toHaveBeenCalledWith(
      `TestTurnHandler._handleTurnEnd called for actor1, but already in TurnEndingState. Ignoring.`
    );
    expect(mockTurnStateFactory.createEndingState).not.toHaveBeenCalled();
  });
});
// --- FILE END ---
