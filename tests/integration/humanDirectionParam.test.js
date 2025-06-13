/**
 * @file This test suite fulfills TKT-005. It verifies that when a human player
 * selects an action with a direction (e.g., "go north"), the `direction`
 * parameter is correctly passed through the state machine and included in the
 * `resolvedParameters` of the `ITurnAction` supplied to the CommandProcessor.
 * @see tests/integration/humanDirectionParam.test.js
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { mock, mockDeep } from 'jest-mock-extended';

// Core classes to be tested or involved
import { HumanPlayerStrategy } from '../../src/turns/strategies/humanPlayerStrategy.js';
import { AwaitingPlayerInputState } from '../../src/turns/states/awaitingPlayerInputState.js';
import { TurnIdleState } from '../../src/turns/states/turnIdleState.js';
import CommandProcessor from '../../src/commands/commandProcessor.js';
import Entity from '../../src/entities/entity.js';

// Base TurnHandler for extension
import { BaseTurnHandler } from '../../src/turns/handlers/baseTurnHandler.js';

// Type Imports
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/interfaces/IPromptCoordinator.js').IPromptCoordinator} IPromptCoordinator */
/** @typedef {import('../../src/turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../src/turns/interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../../src/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../src/turns/factories/turnStateFactory.js').default} TurnStateFactory */

// Helper to create a basic turn handler for testing states. This avoids the
// complexity of the full HumanTurnHandler and gives us direct control.
class TestTurnHandler extends BaseTurnHandler {
  /**
   * @param {ILogger} logger
   * @param {TurnStateFactory} turnStateFactory
   */
  constructor(logger, turnStateFactory) {
    super({ logger, turnStateFactory });
    this._setInitialState(new TurnIdleState(this));
  }

  /**
   * A proper entry point for starting a turn in the test. This mimics
   * how a real handler would work: by establishing the context and then delegating
   * the start action to the current state (which should be TurnIdleState).
   * @param {ITurnContext} turnContext - The pre-configured context for the test turn.
   */
  async startTestTurn(turnContext) {
    this._setCurrentTurnContextInternal(turnContext);
    await this._currentState.startTurn(this, turnContext.getActor());
  }

  /**
   * Expose transition for testing, allowing us to manually drive the state machine
   * @param {Function} state - The state class to transition to.
   * @param {...any} args - Arguments for the state's constructor.
   */
  async transitionTo(state, ...args) {
    await this._transitionToState(new state(this, ...args));
  }
}

describe('TKT-005: Human "go north" supplies direction parameter', () => {
  /** @type {ILogger} */
  let mockLogger;
  /** @type {IPromptCoordinator} */
  let mockPlayerPromptService;
  /** @type {ITurnContext} */
  let mockTurnContext;
  /** @type {ISafeEventDispatcher} */
  let mockEventDispatcher;
  /** @type {CommandProcessor} */
  let commandProcessor;
  /** @type {jest.SpiedFunction<(actor: Entity, turnAction: ITurnAction) => Promise<{success: boolean, errorResult: any | null}>>} */
  let dispatchActionSpy;
  /** @type {Entity} */
  let player;
  /** @type {TestTurnHandler} */
  let turnHandler;
  /** @type {TurnStateFactory} */
  let mockTurnStateFactory;

  beforeEach(() => {
    // 1. ARRANGE
    mockLogger = mockDeep();
    mockEventDispatcher = mockDeep();
    mockPlayerPromptService = mockDeep();

    commandProcessor = new CommandProcessor({
      logger: mockLogger,
      safeEventDispatcher: mockEventDispatcher,
    });
    dispatchActionSpy = jest.spyOn(commandProcessor, 'dispatchAction');
    player = new Entity('player1', 'player');

    mockTurnContext = mockDeep();
    mockTurnContext.getActor.mockReturnValue(player);
    mockTurnContext.getLogger.mockReturnValue(mockLogger);
    mockTurnContext.getSafeEventDispatcher.mockReturnValue(mockEventDispatcher);
    mockTurnContext.getStrategy.mockReturnValue(new HumanPlayerStrategy());
    mockTurnContext.getPlayerPromptService.mockReturnValue(
      mockPlayerPromptService
    );
    mockTurnContext.getCommandProcessor.mockReturnValue(commandProcessor);

    const mockPlayerDecision = {
      action: {
        id: 'core:move',
        command: 'go north',
        params: { direction: 'north' },
      },
      speech: null,
      thoughts: null,
      notes: null,
    };
    mockPlayerPromptService.prompt.mockResolvedValue(mockPlayerDecision);

    mockTurnStateFactory = {
      createIdleState: (handler) => new TurnIdleState(handler),
      // Provide a mock for the ending state to satisfy the factory's contract
      createEndingState: (handler) => new TurnIdleState(handler),
    };

    turnHandler = new TestTurnHandler(mockLogger, mockTurnStateFactory);

    mockTurnContext.requestTransition.mockImplementation(
      async (StateClass, args) => {
        const turnAction = args[1];
        mockTurnContext.getChosenAction.mockReturnValue(turnAction);
        await turnHandler.transitionTo(StateClass, ...args);
      }
    );

    dispatchActionSpy.mockResolvedValue({ success: true, errorResult: null });
  });

  test('should pass the direction parameter to CommandProcessor.dispatchAction', async () => {
    // 2. ACT
    await turnHandler.startTestTurn(mockTurnContext);

    // 3. ASSERT
    expect(dispatchActionSpy).toHaveBeenCalledTimes(1);
    const [actorArg, turnActionArg] = dispatchActionSpy.mock.calls[0];

    expect(actorArg.id).toBe('player1');
    expect(turnActionArg).toBeDefined();
    expect(turnActionArg.actionDefinitionId).toBe('core:move');
    expect(turnActionArg.resolvedParameters).toBeDefined();
    expect(turnActionArg.resolvedParameters).toEqual({ direction: 'north' });
  });

  test('should have empty resolvedParameters if params are omitted (pre-patch failure check)', async () => {
    // ARRANGE (override)
    const mockPlayerDecision = {
      action: {
        id: 'core:move',
        command: 'go north',
        // `params` property is missing
      },
      speech: null,
    };
    mockPlayerPromptService.prompt.mockResolvedValue(mockPlayerDecision);

    // 2. ACT
    await turnHandler.startTestTurn(mockTurnContext);

    // 3. ASSERT
    expect(dispatchActionSpy).toHaveBeenCalledTimes(1);
    const [, turnActionArg] = dispatchActionSpy.mock.calls[0];

    expect(turnActionArg.resolvedParameters).toBeDefined();
    expect(turnActionArg.resolvedParameters).toEqual({});
    expect(turnActionArg.resolvedParameters.direction).toBeUndefined();
  });
});
