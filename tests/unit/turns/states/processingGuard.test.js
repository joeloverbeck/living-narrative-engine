import { describe, test, expect, jest } from '@jest/globals';
import { ProcessingCommandState } from '../../../../src/turns/states/processingCommandState.js';
import { ProcessingGuard } from '../../../../src/turns/states/helpers/processingGuard.js';
import { ProcessingExceptionHandler } from '../../../../src/turns/states/helpers/processingExceptionHandler.js';
import TurnDirectiveStrategyResolver from '../../../../src/turns/strategies/turnDirectiveStrategyResolver.js';

/** Simple logger mock */
const mockLogger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };

/** Dummy handler used by ProcessingCommandState */
const makeHandler = () => ({
  getLogger: () => mockLogger,
  resetStateAndResources: jest.fn(),
  requestIdleStateTransition: jest.fn(),
  _currentState: null,
});

/** Dummy turn context */
const makeTurnCtx = () => ({
  getLogger: () => mockLogger,
  getActor: () => ({ id: 'actor1' }),
  getSafeEventDispatcher: () => ({
    dispatch: jest.fn().mockResolvedValue(undefined),
  }),
  endTurn: jest.fn().mockResolvedValue(undefined),
});

// Mock TurnDirectiveStrategyResolver for this test suite
jest.mock('../../../../src/turns/strategies/turnDirectiveStrategyResolver.js');

describe('ProcessingGuard', () => {
  // Define mocks needed for ProcessingCommandState constructor
  const mockCommandProcessor = { dispatchAction: jest.fn() };
  const mockCommandOutcomeInterpreter = { interpret: jest.fn() };
  const defaultCommandString = 'processingGuard test command';
  const defaultTurnAction = {
    actionDefinitionId: 'pgTestAction',
    commandString: defaultCommandString,
  };

  test('start and finish toggle flag on owner', () => {
    const owner = {
      _flag: false,
      _setProcessing(val) {
        this._flag = val;
      },
      get isProcessing() {
        return this._flag;
      },
    };
    const guard = new ProcessingGuard(owner);
    guard.start();
    expect(owner.isProcessing).toBe(true);
    guard.finish();
    expect(owner.isProcessing).toBe(false);
  });

  test('finish via handleProcessingException clears flag when processing interrupted', async () => {
    const handler = makeHandler();
    const ctx = makeTurnCtx();
    const state = new ProcessingCommandState({
      handler,
      commandProcessor: mockCommandProcessor,
      commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
      commandString: defaultCommandString,
      turnAction: defaultTurnAction,
      directiveResolver: TurnDirectiveStrategyResolver,
    });
    state.startProcessing();
    const exceptionHandler = new ProcessingExceptionHandler(state);
    await exceptionHandler.handle(ctx, new Error('boom'), 'actor1');
    expect(state.isProcessing).toBe(false);
  });
});
