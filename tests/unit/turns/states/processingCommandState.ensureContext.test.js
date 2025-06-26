import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { ProcessingCommandState } from '../../../../src/turns/states/processingCommandState.js';
import TurnDirectiveStrategyResolver from '../../../../src/turns/strategies/turnDirectiveStrategyResolver.js';

const makeLogger = () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

jest.mock('../../../../src/turns/strategies/turnDirectiveStrategyResolver.js');

describe('ProcessingCommandState._ensureContext', () => {
  let logger;
  let ctx;
  let handler;
  let commandProcessor;
  let commandOutcomeInterpreter;
  let turnAction;
  const commandString = 'test ensure context';
  let state;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = makeLogger();
    ctx = {
      getLogger: () => logger,
      getActor: jest.fn(() => ({ id: 'a1' })),
      getSafeEventDispatcher: jest.fn(() => ({ dispatch: jest.fn() })),
    };
    handler = {
      getLogger: jest.fn(() => logger),
      getTurnContext: jest.fn(() => ctx),
      resetStateAndResources: jest.fn(),
      requestIdleStateTransition: jest.fn().mockResolvedValue(undefined),
    };
    commandProcessor = {
      dispatchAction: jest.fn(),
    };
    commandOutcomeInterpreter = {
      interpret: jest.fn(),
    };
    turnAction = {
      actionDefinitionId: 'ensureContextAction',
      commandString: commandString,
    };
    state = new ProcessingCommandState({
      handler: handler,
      commandProcessor: commandProcessor,
      commandOutcomeInterpreter: commandOutcomeInterpreter,
      commandString: commandString,
      turnAction: turnAction,
      directiveResolver: TurnDirectiveStrategyResolver,
    });
  });

  test('resets to idle when required methods are missing', async () => {
    const result = await state._ensureContext('missing');
    expect(result).toBeNull();
    const expectedMsg =
      'ProcessingCommandState: ITurnContext missing required methods: getChosenAction';
    expect(logger.error).toHaveBeenCalledWith(expectedMsg);
    expect(handler.resetStateAndResources).toHaveBeenCalledWith(
      'missing-methods-ProcessingCommandState'
    );
    expect(handler.requestIdleStateTransition).toHaveBeenCalled();
  });
});
