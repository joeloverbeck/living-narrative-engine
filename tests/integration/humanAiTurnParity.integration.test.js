import { describe, it, expect, jest } from '@jest/globals';
import { ACTION_DECIDED_ID } from '../../src/constants/eventIds.js';
import { TurnActionChoicePipeline } from '../../src/turns/pipeline/turnActionChoicePipeline.js';
import { GenericTurnStrategy } from '../../src/turns/strategies/genericTurnStrategy.js';
import { HumanDecisionProvider } from '../../src/turns/providers/humanDecisionProvider.js';
import { LLMDecisionProvider } from '../../src/turns/providers/llmDecisionProvider.js';
import { TurnActionFactory } from '../../src/turns/factories/turnActionFactory.js';
import { AwaitingActorDecisionState } from '../../src/turns/states/awaitingActorDecisionState.js';
import { TurnContext } from '../../src/turns/context/turnContext.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

/**
 *
 * @param logger
 */
function buildHandler(logger) {
  return {
    getLogger: () => logger,
    getTurnContext: () => null,
    _resetTurnStateAndResources: jest.fn(),
    resetStateAndResources: jest.fn(function (reason) {
      this._resetTurnStateAndResources(reason);
    }),
    requestIdleStateTransition: jest.fn(),
    requestProcessingCommandStateTransition: jest.fn(),
  };
}

describe('Integration – Human and AI turn parity', () => {
  it('fires action_decided once and indexes actions once for both actors', async () => {
    const logger = createLogger();

    const discoverySvc = {
      getValidActions: jest.fn().mockResolvedValue({
        actions: [{ id: 'core:wait', command: 'Wait', params: {} }],
        errors: [],
      }),
    };

    const composite = {
      index: 1,
      actionId: 'core:wait',
      commandString: 'Wait',
      params: {},
      description: 'Wait',
    };

    const provider = { get: jest.fn().mockResolvedValue([composite]) };

    const pipeline = new TurnActionChoicePipeline({
      availableActionsProvider: provider,
      logger,
    });

    const actionFactory = new TurnActionFactory();

    const promptCoordinator = {
      prompt: jest.fn().mockResolvedValue({ chosenIndex: 1 }),
    };
    const dispatcher = { dispatch: jest.fn() };
    const humanProvider = new HumanDecisionProvider({
      promptCoordinator,
      logger,
      safeEventDispatcher: dispatcher,
    });

    const llmChooser = { choose: jest.fn().mockResolvedValue({ index: 1 }) };
    const aiProvider = new LLMDecisionProvider({
      llmChooser,
      logger,
      safeEventDispatcher: dispatcher,
    });

    const humanStrategy = new GenericTurnStrategy({
      choicePipeline: pipeline,
      decisionProvider: humanProvider,
      turnActionFactory: actionFactory,
      logger,
    });

    const aiStrategy = new GenericTurnStrategy({
      choicePipeline: pipeline,
      decisionProvider: aiProvider,
      turnActionFactory: actionFactory,
      logger,
    });

    const eventDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };

    const services = {
      commandProcessor: {},
      commandOutcomeInterpreter: {},
      safeEventDispatcher: eventDispatcher,
      turnEndPort: {},
      entityManager: {},
      actionDiscoverySystem: discoverySvc,
    };

    // --- Human Turn Setup ---
    const humanActor = { id: 'human1' };
    const humanHandler = buildHandler(logger);
    const humanContext = new TurnContext({
      actor: humanActor,
      logger,
      services,
      strategy: humanStrategy,
      onEndTurnCallback: jest.fn(),
      handlerInstance: humanHandler,
    });
    humanHandler.getTurnContext = () => humanContext;
    const humanState = new AwaitingActorDecisionState(humanHandler);

    // --- AI Turn Setup ---
    const aiActor = { id: 'ai1', isAi: true };
    const aiHandler = buildHandler(logger);
    const aiContext = new TurnContext({
      actor: aiActor,
      logger,
      services,
      strategy: aiStrategy,
      onEndTurnCallback: jest.fn(),
      handlerInstance: aiHandler,
    });
    aiHandler.getTurnContext = () => aiContext;
    const aiState = new AwaitingActorDecisionState(aiHandler);

    // --- Execute turns ---
    await humanState.enterState(humanHandler, null);
    await aiState.enterState(aiHandler, null);

    // --- Assertions ---
    expect(eventDispatcher.dispatch).toHaveBeenCalledTimes(2);
    expect(eventDispatcher.dispatch).toHaveBeenNthCalledWith(
      1,
      ACTION_DECIDED_ID,
      expect.objectContaining({ actorId: humanActor.id, actorType: 'human' })
    );
    expect(eventDispatcher.dispatch).toHaveBeenNthCalledWith(
      2,
      ACTION_DECIDED_ID,
      expect.objectContaining({ actorId: aiActor.id, actorType: 'ai' })
    );

    expect(provider.get).toHaveBeenCalledTimes(2);
    expect(provider.get).toHaveBeenNthCalledWith(
      1,
      humanActor,
      humanContext,
      logger
    );
    expect(provider.get).toHaveBeenNthCalledWith(2, aiActor, aiContext, logger);

    const humanEndState = {
      action: humanContext.getChosenAction(),
      meta: humanContext.getDecisionMeta(),
    };
    const aiEndState = {
      action: aiContext.getChosenAction(),
      meta: aiContext.getDecisionMeta(),
    };
    expect(aiEndState).toEqual(humanEndState);
  });
});
