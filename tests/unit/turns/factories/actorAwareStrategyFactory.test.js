import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActorAwareStrategyFactory } from '../../../../src/turns/factories/actorAwareStrategyFactory.js';
import { GenericTurnStrategy } from '../../../../src/turns/strategies/genericTurnStrategy.js';

describe('ActorAwareStrategyFactory', () => {
  let humanProvider;
  let llmProvider;
  let goapProvider;
  let logger;
  let choicePipeline;
  let actionFactory;
  let lookup;
  let actors;
  let providers;

  beforeEach(() => {
    humanProvider = { name: 'human' };
    llmProvider = { name: 'llm' };
    goapProvider = { name: 'goap' };
    logger = { debug: jest.fn() };
    choicePipeline = {};
    actionFactory = {};
    actors = {
      human1: { id: 'human1' },
      ai1: { id: 'ai1', isAi: true },
      llm1: { id: 'llm1', aiType: 'llm' },
      goap1: { id: 'goap1', aiType: 'goap' },
      npc1: { id: 'npc1', type: 'npc' },
      humanWithPlayerType: {
        id: 'humanWithPlayerType',
        components: { 'core:player_type': { type: 'human' } },
      },
      llmWithPlayerType: {
        id: 'llmWithPlayerType',
        components: { 'core:player_type': { type: 'llm' } },
      },
      goapWithPlayerType: {
        id: 'goapWithPlayerType',
        components: { 'core:player_type': { type: 'goap' } },
      },
      unknownActor: { id: 'unknownActor' },
    };
    lookup = jest.fn((id) => actors[id]);
    providers = { human: humanProvider, llm: llmProvider, goap: goapProvider };
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
    expect(strategy.decisionProvider).toBe(llmProvider);
    expect(lookup).toHaveBeenCalledWith('ai1');
  });

  it('uses aiType field to select llm provider', () => {
    const factory = new ActorAwareStrategyFactory({
      providers,
      logger,
      choicePipeline,
      turnActionFactory: actionFactory,
      actorLookup: lookup,
    });

    const strategy = factory.create('llm1');
    expect(strategy.decisionProvider).toBe(llmProvider);
    expect(lookup).toHaveBeenCalledWith('llm1');
  });

  it('uses aiType field to select goap provider', () => {
    const factory = new ActorAwareStrategyFactory({
      providers,
      logger,
      choicePipeline,
      turnActionFactory: actionFactory,
      actorLookup: lookup,
    });

    const strategy = factory.create('goap1');
    expect(strategy.decisionProvider).toBe(goapProvider);
    expect(lookup).toHaveBeenCalledWith('goap1');
  });

  it('uses a custom provider when resolver returns its key', () => {
    const npcProvider = { name: 'npc' };
    providers.npc = npcProvider;
    const resolver = (actor) =>
      actor.type || (actor.isAi === true ? 'llm' : 'human');
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

  describe('core:player_type component support', () => {
    it('returns human provider for actor with core:player_type set to human', () => {
      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory: actionFactory,
        actorLookup: lookup,
      });

      const strategy = factory.create('humanWithPlayerType');
      expect(strategy).toBeInstanceOf(GenericTurnStrategy);
      expect(strategy.decisionProvider).toBe(humanProvider);
      expect(lookup).toHaveBeenCalledWith('humanWithPlayerType');
    });

    it('returns llm provider for actor with core:player_type set to llm', () => {
      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory: actionFactory,
        actorLookup: lookup,
      });

      const strategy = factory.create('llmWithPlayerType');
      expect(strategy).toBeInstanceOf(GenericTurnStrategy);
      expect(strategy.decisionProvider).toBe(llmProvider);
      expect(lookup).toHaveBeenCalledWith('llmWithPlayerType');
    });

    it('returns goap provider for actor with core:player_type set to goap', () => {
      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory: actionFactory,
        actorLookup: lookup,
      });

      const strategy = factory.create('goapWithPlayerType');
      expect(strategy).toBeInstanceOf(GenericTurnStrategy);
      expect(strategy.decisionProvider).toBe(goapProvider);
      expect(lookup).toHaveBeenCalledWith('goapWithPlayerType');
    });

    it('defaults to human provider for actor without any type information', () => {
      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory: actionFactory,
        actorLookup: lookup,
      });

      const strategy = factory.create('unknownActor');
      expect(strategy).toBeInstanceOf(GenericTurnStrategy);
      expect(strategy.decisionProvider).toBe(humanProvider);
      expect(lookup).toHaveBeenCalledWith('unknownActor');
    });
  });
});
