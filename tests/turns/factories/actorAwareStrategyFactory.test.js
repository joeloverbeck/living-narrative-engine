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
  let providers;

  beforeEach(() => {
    humanProvider = { name: 'human' };
    aiProvider = { name: 'ai' };
    logger = { debug: jest.fn() };
    choicePipeline = {};
    actionFactory = {};
    actors = {
      human1: { id: 'human1' },
      ai1: { id: 'ai1', isAi: true },
      npc1: { id: 'npc1', type: 'npc' },
    };
    lookup = jest.fn((id) => actors[id]);
    providers = { human: humanProvider, ai: aiProvider };
  });

  it('returns strategy using human provider for non-AI actor', () => {
    const factory = new ActorAwareStrategyFactory({
      providers,
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
      providers,
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

  it('uses a custom provider when resolver returns its key', () => {
    const npcProvider = { name: 'npc' };
    providers.npc = npcProvider;
    const resolver = (actor) =>
      actor.type || (actor.isAi === true ? 'ai' : 'human');
    const factory = new ActorAwareStrategyFactory({
      providers,
      providerResolver: resolver,
      logger,
      choicePipeline,
      turnActionFactory: actionFactory,
      actorLookup: lookup,
    });

    const strategy = factory.create('npc1');
    expect(strategy).toBeInstanceOf(GenericTurnStrategy);
    expect(strategy.decisionProvider).toBe(npcProvider);
    expect(lookup).toHaveBeenCalledWith('npc1');
  });
});
