import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { registerActorAwareStrategy } from '../../../../src/dependencyInjection/registrations/registerActorAwareStrategy.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { expectSingleton } from '../../../common/containerAssertions.js';
import { TurnActionChoicePipeline } from '../../../../src/turns/pipeline/turnActionChoicePipeline.js';
import { TurnActionFactory } from '../../../../src/turns/factories/turnActionFactory.js';
import { ActorAwareStrategyFactory } from '../../../../src/turns/factories/actorAwareStrategyFactory.js';

// Helper providers
const makeProvider = (name) => ({ name });

describe('registerActorAwareStrategy', () => {
  /** @type {AppContainer} */
  let container;
  let registerSpy;
  let logger;
  let actors;

  beforeEach(() => {
    container = new AppContainer();
    registerSpy = jest.spyOn(container, 'register');

    actors = {};

    logger = { debug: jest.fn() };
    container.register(tokens.ILogger, () => logger);
    container.register(tokens.IAvailableActionsProvider, () => ({
      get: jest.fn(),
    }));
    container.register(tokens.IHumanDecisionProvider, () =>
      makeProvider('human')
    );
    container.register(tokens.ILLMDecisionProvider, () => makeProvider('llm'));
    container.register(tokens.IGoapDecisionProvider, () =>
      makeProvider('goap')
    );
    container.register(tokens.IEntityManager, () => ({
      getEntityInstance: (id) => actors[id],
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('registers required factories when missing', () => {
    registerActorAwareStrategy(container);

    expect(registerSpy).toHaveBeenCalledWith(
      tokens.TurnActionChoicePipeline,
      expect.any(Function),
      { lifecycle: 'singletonFactory' }
    );
    expect(registerSpy).toHaveBeenCalledWith(
      tokens.ITurnActionFactory,
      expect.any(Function),
      { lifecycle: 'singletonFactory' }
    );
    expect(registerSpy).toHaveBeenCalledWith(
      tokens.TurnStrategyFactory,
      expect.any(Function),
      { lifecycle: 'singletonFactory' }
    );

    // Ensure instances resolve and are singletons
    expectSingleton(
      container,
      tokens.TurnActionChoicePipeline,
      TurnActionChoicePipeline
    );
    expectSingleton(container, tokens.ITurnActionFactory, TurnActionFactory);
    expectSingleton(
      container,
      tokens.TurnStrategyFactory,
      ActorAwareStrategyFactory
    );

    const logs = logger.debug.mock.calls.map((c) => c[0]);
    expect(logs[0]).toBe('[registerActorAwareStrategy] Starting...');
    expect(logs).toContain(
      `[registerActorAwareStrategy] Registered ${tokens.TurnActionChoicePipeline}.`
    );
    expect(logs).toContain(
      `[registerActorAwareStrategy] Registered ${tokens.ITurnActionFactory}.`
    );
    expect(logs).toContain(
      `[registerActorAwareStrategy] Registered ${tokens.TurnStrategyFactory}.`
    );
    expect(logs).toContain('[registerActorAwareStrategy] Completed.');
  });

  it('does not re-register services that already exist', () => {
    container.register(tokens.TurnActionChoicePipeline, () => 'existing');
    container.register(tokens.ITurnActionFactory, () => 'existing');
    container.register(tokens.TurnStrategyFactory, () => 'existing');
    jest
      .spyOn(container, 'isRegistered')
      .mockImplementation((token) =>
        [
          tokens.TurnActionChoicePipeline,
          tokens.ITurnActionFactory,
          tokens.TurnStrategyFactory,
        ].includes(token)
      );

    const callsBefore = registerSpy.mock.calls.length;
    registerActorAwareStrategy(container);

    // No additional registrations beyond the initial ones
    expect(registerSpy).toHaveBeenCalledTimes(callsBefore);

    const counts = registerSpy.mock.calls.reduce((acc, [token]) => {
      acc[token] = (acc[token] || 0) + 1;
      return acc;
    }, {});
    expect(counts[tokens.TurnActionChoicePipeline]).toBe(1);
    expect(counts[tokens.ITurnActionFactory]).toBe(1);
    expect(counts[tokens.TurnStrategyFactory]).toBe(1);
  });

  it('providerResolver selects providers for various actor shapes', () => {
    registerActorAwareStrategy(container);
    const factory = container.resolve(tokens.TurnStrategyFactory);

    actors.human = {
      id: 'human',
      components: { 'core:player_type': { type: 'human' } },
    };
    actors.llm = {
      id: 'llm',
      components: { 'core:player_type': { type: 'llm' } },
    };
    actors.goap = { id: 'goap', aiType: 'GOAP' };
    actors.aiComponent = {
      id: 'aiComponent',
      components: { ai: { type: 'LLM' } },
    };
    actors.isAi = { id: 'isAi', isAi: true };
    actors.player = { id: 'player', components: { 'core:player': {} } };
    actors.unknown = { id: 'unknown' };

    expect(factory.create('human').decisionProvider.name).toBe('human');
    expect(factory.create('llm').decisionProvider.name).toBe('llm');
    expect(factory.create('goap').decisionProvider.name).toBe('goap');
    expect(factory.create('aiComponent').decisionProvider.name).toBe('llm');
    expect(factory.create('isAi').decisionProvider.name).toBe('llm');
    expect(factory.create('player').decisionProvider.name).toBe('human');
    expect(factory.create('unknown').decisionProvider.name).toBe('human');
  });

  it('injects fallbackFactory when available', () => {
    const fallbackFactory = {};
    container.register(tokens.IAIFallbackActionFactory, () => fallbackFactory);
    registerActorAwareStrategy(container);
    const factory = container.resolve(tokens.TurnStrategyFactory);

    actors.x = { id: 'x' };
    const strategy = factory.create('x');
    expect(strategy.fallbackFactory).toBe(fallbackFactory);
  });
});
