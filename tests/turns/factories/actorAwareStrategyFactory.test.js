import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActorAwareStrategyFactory } from '../../../src/turns/factories/actorAwareStrategyFactory.js';
import { GenericTurnStrategy } from '../../../src/turns/strategies/genericTurnStrategy.js';

describe('ActorAwareStrategyFactory', () => {
  let humanProvider;
  let aiProvider;
  let logger;
  let choicePipeline;
  let actionFactory;
  let lookup;
  let actors;

  beforeEach(() => {
    humanProvider = { name: 'human' };
    aiProvider = { name: 'ai' };
    logger = { debug: jest.fn() };
    choicePipeline = {};
    actionFactory = {};
    actors = {
      human1: { id: 'human1' },
      ai1: { id: 'ai1', isAi: true },
    };
    lookup = jest.fn((id) => actors[id]);
  });

  it('returns strategy using human provider for non-AI actor', () => {
    const factory = new ActorAwareStrategyFactory({
      humanProvider,
      aiProvider,
      logger,
      choicePipeline,
      turnActionFactory: actionFactory,
      actorLookup: lookup,
    });

    const strategy = factory.create('human1');
    expect(strategy).toBeInstanceOf(GenericTurnStrategy);
    expect(strategy.decisionProvider).toBe(humanProvider);
    expect(lookup).toHaveBeenCalledWith('human1');
  });

  it('returns strategy using AI provider for AI actor', () => {
    const factory = new ActorAwareStrategyFactory({
      humanProvider,
      aiProvider,
      logger,
      choicePipeline,
      turnActionFactory: actionFactory,
      actorLookup: lookup,
    });

    const strategy = factory.create('ai1');
    expect(strategy).toBeInstanceOf(GenericTurnStrategy);
    expect(strategy.decisionProvider).toBe(aiProvider);
    expect(lookup).toHaveBeenCalledWith('ai1');
  });
});
