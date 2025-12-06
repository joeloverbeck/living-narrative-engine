import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { ActorAwareStrategyFactory } from '../../../src/turns/factories/actorAwareStrategyFactory.js';
import { TurnActionChoicePipeline } from '../../../src/turns/pipeline/turnActionChoicePipeline.js';
import { TurnActionFactory } from '../../../src/turns/factories/turnActionFactory.js';
import { createMockLogger } from '../../common/mockFactories.js';

describe('[Integration] ActorAwareStrategyFactory default resolver behaviour', () => {
  let logger;
  let availableActionsProvider;
  let choicePipeline;
  let turnActionFactory;
  let providers;

  beforeEach(() => {
    logger = createMockLogger();
    availableActionsProvider = {
      get: jest.fn().mockResolvedValue([]),
    };
    choicePipeline = new TurnActionChoicePipeline({
      availableActionsProvider,
      logger,
    });
    turnActionFactory = new TurnActionFactory();
    providers = {
      human: { name: 'human', decide: jest.fn() },
      llm: { name: 'llm', decide: jest.fn() },
      goap: { name: 'goap', decide: jest.fn() },
    };
  });

  it('prefers Entity API component data when available and normalises whitespace/casing', () => {
    const actor = {
      getComponentData: jest.fn().mockReturnValue({ type: '  LLM  ' }),
    };

    const factory = new ActorAwareStrategyFactory({
      providers,
      logger,
      choicePipeline,
      turnActionFactory,
      actorLookup: () => actor,
    });

    const strategy = factory.create('entity-api-actor');

    expect(actor.getComponentData).toHaveBeenCalledWith('core:player_type');
    expect(strategy.decisionProvider).toBe(providers.llm);
  });

  it('falls back through legacy detection when component data retrieval fails', () => {
    const actor = {
      getComponentData: jest.fn(() => {
        throw new Error('component lookup failed');
      }),
      components: {
        'core:player_type': { type: 123 },
      },
      aiType: 'GOAP',
    };

    const factory = new ActorAwareStrategyFactory({
      providers,
      logger,
      choicePipeline,
      turnActionFactory,
      actorLookup: () => actor,
    });

    const strategy = factory.create('legacy-fallback-actor');

    expect(actor.getComponentData).toHaveBeenCalledWith('core:player_type');
    expect(strategy.decisionProvider).toBe(providers.goap);
  });

  it('ignores blank player_type values returned via Entity API', () => {
    const actor = {
      getComponentData: jest.fn().mockReturnValue({ type: '   ' }),
      components: {
        'core:player_type': { type: ' GOAP ' },
      },
      aiType: undefined,
    };

    const factory = new ActorAwareStrategyFactory({
      providers,
      logger,
      choicePipeline,
      turnActionFactory,
      actorLookup: () => actor,
    });

    const strategy = factory.create('blank-entity-api-type');

    expect(actor.getComponentData).toHaveBeenCalledWith('core:player_type');
    expect(strategy.decisionProvider).toBe(providers.goap);
  });

  it('uses legacy ai component type when aiType is absent', () => {
    const actor = {
      components: {
        ai: { type: 'LLM' },
      },
    };

    const factory = new ActorAwareStrategyFactory({
      providers,
      logger,
      choicePipeline,
      turnActionFactory,
      actorLookup: () => actor,
    });

    const strategy = factory.create('legacy-ai-component-actor');

    expect(strategy.decisionProvider).toBe(providers.llm);
  });

  it('defaults to llm provider when legacy isAi flag is true', () => {
    const actor = { isAi: true };

    const factory = new ActorAwareStrategyFactory({
      providers,
      logger,
      choicePipeline,
      turnActionFactory,
      actorLookup: () => actor,
    });

    const strategy = factory.create('legacy-is-ai');

    expect(strategy.decisionProvider).toBe(providers.llm);
  });

  it('defaults to human provider when no type information is available', () => {
    const actor = {};

    const factory = new ActorAwareStrategyFactory({
      providers,
      logger,
      choicePipeline,
      turnActionFactory,
      actorLookup: () => actor,
    });

    const strategy = factory.create('default-human');

    expect(strategy.decisionProvider).toBe(providers.human);
  });

  it('throws when resolved provider key is missing from providers map', () => {
    const actor = {
      components: {
        'core:player_type': { type: 'rogue' },
      },
    };

    const factory = new ActorAwareStrategyFactory({
      providers,
      logger,
      choicePipeline,
      turnActionFactory,
      actorLookup: () => actor,
    });

    expect(() => factory.create('missing-provider')).toThrow(
      'ActorAwareStrategyFactory: No decision provider for actor type "rogue"'
    );
  });

  it('derives providers map from legacy human and AI provider parameters', () => {
    const actor = { isAi: true };

    const factory = new ActorAwareStrategyFactory({
      logger,
      choicePipeline,
      turnActionFactory,
      humanProvider: providers.human,
      aiProvider: providers.llm,
      actorLookup: () => actor,
    });

    const strategy = factory.create('auto-provider-map');

    expect(strategy.decisionProvider).toBe(providers.llm);
  });

  it('requires a providers map when legacy provider arguments are absent', () => {
    expect(
      () =>
        new ActorAwareStrategyFactory({
          logger,
          choicePipeline,
          turnActionFactory,
          actorLookup: () => ({}),
        })
    ).toThrow('ActorAwareStrategyFactory: providers map is required');
  });

  it('requires the providerResolver to be a function', () => {
    expect(
      () =>
        new ActorAwareStrategyFactory({
          providers,
          providerResolver: /** @type {any} */ ('not-a-function'),
          logger,
          choicePipeline,
          turnActionFactory,
          actorLookup: () => ({}),
        })
    ).toThrow('ActorAwareStrategyFactory: providerResolver must be a function');
  });

  it('requires a logger implementation', () => {
    expect(
      () =>
        new ActorAwareStrategyFactory({
          providers,
          logger: /** @type {any} */ (null),
          choicePipeline,
          turnActionFactory,
          actorLookup: () => ({}),
        })
    ).toThrow('ActorAwareStrategyFactory: logger is required');
  });

  it('requires a choice pipeline', () => {
    expect(
      () =>
        new ActorAwareStrategyFactory({
          providers,
          logger,
          choicePipeline: /** @type {any} */ (null),
          turnActionFactory,
          actorLookup: () => ({}),
        })
    ).toThrow('ActorAwareStrategyFactory: choicePipeline is required');
  });

  it('requires a turn action factory', () => {
    expect(
      () =>
        new ActorAwareStrategyFactory({
          providers,
          logger,
          choicePipeline,
          turnActionFactory: /** @type {any} */ (null),
          actorLookup: () => ({}),
        })
    ).toThrow('ActorAwareStrategyFactory: turnActionFactory is required');
  });

  it('supports using an entity manager when actorLookup is not provided', () => {
    const actor = { isAi: true };
    const entityManager = {
      getEntityInstance: jest.fn().mockReturnValue(actor),
    };

    const factory = new ActorAwareStrategyFactory({
      providers,
      logger,
      choicePipeline,
      turnActionFactory,
      entityManager,
    });

    const strategy = factory.create('entity-manager-actor');

    expect(entityManager.getEntityInstance).toHaveBeenCalledWith(
      'entity-manager-actor'
    );
    expect(strategy.decisionProvider).toBe(providers.llm);
  });

  it('requires either an actorLookup callback or an entity manager', () => {
    expect(
      () =>
        new ActorAwareStrategyFactory({
          providers,
          logger,
          choicePipeline,
          turnActionFactory,
        })
    ).toThrow(
      'ActorAwareStrategyFactory: actorLookup callback or entityManager is required'
    );
  });
});
