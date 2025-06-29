// tests/integration/humanDecisionFlow.test.js

import { describe, it, expect, jest } from '@jest/globals';
import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { Registrar } from '../../src/utils/registrarHelpers.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import { TurnActionChoicePipeline } from '../../src/turns/pipeline/turnActionChoicePipeline.js';
import { HumanDecisionProvider } from '../../src/turns/providers/humanDecisionProvider.js';
import { TurnActionFactory } from '../../src/turns/factories/turnActionFactory.js';
import { GenericTurnStrategy } from '../../src/turns/strategies/genericTurnStrategy.js';
// Import the adapter, which is the key to the fix
import { ActionIndexerAdapter } from '../../src/turns/adapters/actionIndexerAdapter.js';

/**
 * Integration test verifying that the human decision flow
 * goes through GenericTurnStrategy and produces the standard
 * decision envelope.
 */
describe('Integration – Human decision flow', () => {
  it('delegates via GenericTurnStrategy.decideAction and returns a DecisionResult', async () => {
    const container = new AppContainer();
    const r = new Registrar(container);

    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const composite = {
      index: 1,
      id: 'core:wait',
      actionId: 'core:wait',
      commandString: 'Wait',
      params: {},
      description: 'Wait',
    };
    const provider = { get: jest.fn().mockResolvedValue([composite]) };
    const promptCoordinator = {
      prompt: jest.fn().mockResolvedValue({ chosenIndex: 1, speech: 'Wait' }),
    };

    // Register all the mock instances
    r.instance(tokens.ILogger, logger);
    r.instance(tokens.IAvailableActionsProvider, provider);
    r.instance(tokens.IPromptCoordinator, promptCoordinator);

    r.singletonFactory(
      tokens.TurnActionChoicePipeline,
      (c) =>
        new TurnActionChoicePipeline({
          availableActionsProvider: c.resolve(tokens.IAvailableActionsProvider),
          logger: c.resolve(tokens.ILogger),
        })
    );

    r.transientFactory(
      tokens.IHumanDecisionProvider,
      (c) =>
        new HumanDecisionProvider({
          promptCoordinator: c.resolve(tokens.IPromptCoordinator),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: { dispatch: jest.fn() },
        })
    );
    r.singletonFactory(
      tokens.ITurnActionFactory,
      () => new TurnActionFactory()
    );

    const strategy = new GenericTurnStrategy({
      choicePipeline: container.resolve(tokens.TurnActionChoicePipeline),
      decisionProvider: container.resolve(tokens.IHumanDecisionProvider),
      turnActionFactory: container.resolve(tokens.ITurnActionFactory),
      logger: container.resolve(tokens.ILogger),
    });

    const actor = { id: 'player1' };
    const context = { getActor: () => actor, getPromptSignal: () => null };

    const result = await strategy.decideAction(context);

    // Assertions
    expect(provider.get).toHaveBeenCalledWith(actor, context, logger);

    // ─── PRIMARY FIX IS HERE ───
    // The HumanDecisionProvider now passes the indexed actions (composites)
    // to the prompt coordinator. The test must expect this new argument.
    expect(promptCoordinator.prompt).toHaveBeenCalledWith(actor, {
      indexedComposites: [composite], // Expect the indexed actions
      cancellationSignal: null,
    });

    // The final result should be correctly formed
    expect(result).toEqual({
      kind: 'success',
      action: {
        actionDefinitionId: 'core:wait',
        resolvedParameters: {},
        commandString: 'Wait',
        speech: 'Wait',
      },
      extractedData: { speech: 'Wait', thoughts: null, notes: null },
    });
  });
});
