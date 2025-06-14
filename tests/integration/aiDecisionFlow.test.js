import { describe, it, expect, jest } from '@jest/globals';
import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { Registrar } from '../../src/dependencyInjection/registrarHelpers.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import { TurnActionChoicePipeline } from '../../src/turns/pipeline/turnActionChoicePipeline.js';
import { LLMDecisionProvider } from '../../src/turns/providers/llmDecisionProvider.js';
import { TurnActionFactory } from '../../src/turns/factories/turnActionFactory.js';
import { GenericTurnStrategy } from '../../src/turns/strategies/genericTurnStrategy.js';

/**
 * Integration test verifying that the AI decision flow
 * shares GenericTurnStrategy with the human path.
 */
describe('Integration – AI decision flow', () => {
  it('uses GenericTurnStrategy.decideAction with LLMChooser', async () => {
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
      actionId: 'core:wait',
      commandString: 'Wait',
      params: {},
      description: 'Wait',
    };
    const provider = { get: jest.fn().mockResolvedValue([composite]) };
    const llmChooser = { choose: jest.fn().mockResolvedValue({ index: 1 }) };

    r.instance(tokens.ILogger, logger);
    r.instance(tokens.IAvailableActionsProvider, provider);
    r.instance(tokens.ILLMChooser, llmChooser);
    r.singletonFactory(
      tokens.TurnActionChoicePipeline,
      (c) =>
        new TurnActionChoicePipeline({
          availableActionsProvider: c.resolve(tokens.IAvailableActionsProvider),
          logger: c.resolve(tokens.ILogger),
        })
    );
    r.transientFactory(
      tokens.ILLMDecisionProvider,
      (c) =>
        new LLMDecisionProvider({
          llmChooser: c.resolve(tokens.ILLMChooser),
          logger: c.resolve(tokens.ILogger),
        })
    );
    r.singletonFactory(
      tokens.ITurnActionFactory,
      () => new TurnActionFactory()
    );

    const strategy = new GenericTurnStrategy({
      choicePipeline: container.resolve(tokens.TurnActionChoicePipeline),
      decisionProvider: container.resolve(tokens.ILLMDecisionProvider),
      turnActionFactory: container.resolve(tokens.ITurnActionFactory),
      logger: container.resolve(tokens.ILogger),
    });

    const actor = { id: 'ai1' };
    const context = { getActor: () => actor, getPromptSignal: () => null };

    const result = await strategy.decideAction(context);

    expect(provider.get).toHaveBeenCalledWith(actor, context, logger);
    expect(llmChooser.choose).toHaveBeenCalledWith({
      actor,
      context,
      actions: [composite],
      abortSignal: null,
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
