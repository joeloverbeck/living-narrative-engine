import { describe, it, expect, jest } from '@jest/globals';
import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { Registrar } from '../../src/dependencyInjection/registrarHelpers.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import { TurnActionChoicePipeline } from '../../src/turns/pipeline/turnActionChoicePipeline.js';
import { HumanDecisionProvider } from '../../src/turns/providers/humanDecisionProvider.js';
import { TurnActionFactory } from '../../src/turns/factories/turnActionFactory.js';
import { GenericTurnStrategy } from '../../src/turns/strategies/genericTurnStrategy.js';

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
    const discoverySvc = {
      getValidActions: jest
        .fn()
        .mockResolvedValue([{ id: 'core:wait', command: 'Wait', params: {} }]),
    };
    const composite = {
      index: 1,
      actionId: 'core:wait',
      commandString: 'Wait',
      params: {},
      description: 'Wait',
    };
    const indexer = { index: jest.fn().mockReturnValue([composite]) };
    const promptCoordinator = {
      prompt: jest.fn().mockResolvedValue({ index: 1 }),
    };
    const actionIndexingService = { resolve: jest.fn() };

    r.instance(tokens.ILogger, logger);
    r.instance(tokens.IActionDiscoveryService, discoverySvc);
    r.instance(tokens.IActionIndexer, indexer);
    r.instance(tokens.IPromptCoordinator, promptCoordinator);
    r.instance(tokens.ActionIndexingService, actionIndexingService);
    r.singletonFactory(
      tokens.TurnActionChoicePipeline,
      (c) =>
        new TurnActionChoicePipeline({
          discoverySvc: c.resolve(tokens.IActionDiscoveryService),
          indexer: c.resolve(tokens.IActionIndexer),
          logger: c.resolve(tokens.ILogger),
        })
    );
    r.transientFactory(
      tokens.IHumanDecisionProvider,
      (c) =>
        new HumanDecisionProvider({
          promptCoordinator: c.resolve(tokens.IPromptCoordinator),
          actionIndexingService: c.resolve(tokens.ActionIndexingService),
          logger: c.resolve(tokens.ILogger),
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

    expect(discoverySvc.getValidActions).toHaveBeenCalledWith(actor, context);
    expect(indexer.index).toHaveBeenCalledWith(
      [{ id: 'core:wait', command: 'Wait', params: {} }],
      actor.id
    );
    expect(promptCoordinator.prompt).toHaveBeenCalledWith(actor, {
      cancellationSignal: null,
    });
    expect(result).toEqual({
      kind: 'success',
      action: {
        actionDefinitionId: 'core:wait',
        resolvedParameters: {},
        commandString: 'Wait',
      },
      extractedData: { speech: null, thoughts: null, notes: null },
    });
  });
});
