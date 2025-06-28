import { describe, it, expect, jest } from '@jest/globals';
import { GenericStrategyFactory } from '../../../../src/turns/factories/genericStrategyFactory.js';
import { GenericTurnStrategy } from '../../../../src/turns/strategies/genericTurnStrategy.js';

const createDeps = () => ({
  choicePipeline: {},
  decisionProvider: { constructor: { name: 'TestProvider' } },
  turnActionFactory: {},
  logger: { debug: jest.fn() },
  fallbackFactory: { name: 'fallback' },
});

describe('GenericStrategyFactory', () => {
  it('throws when choicePipeline is missing', () => {
    const deps = createDeps();
    delete deps.choicePipeline;
    expect(() => new GenericStrategyFactory(deps)).toThrow(
      'GenericStrategyFactory: choicePipeline is required'
    );
  });

  it('throws when decisionProvider is missing', () => {
    const deps = createDeps();
    delete deps.decisionProvider;
    expect(() => new GenericStrategyFactory(deps)).toThrow(
      'GenericStrategyFactory: decisionProvider is required'
    );
  });

  it('throws when turnActionFactory is missing', () => {
    const deps = createDeps();
    delete deps.turnActionFactory;
    expect(() => new GenericStrategyFactory(deps)).toThrow(
      'GenericStrategyFactory: turnActionFactory is required'
    );
  });

  it('throws when logger is missing', () => {
    const deps = createDeps();
    delete deps.logger;
    expect(() => new GenericStrategyFactory(deps)).toThrow(
      'GenericStrategyFactory: logger is required'
    );
  });

  it('creates GenericTurnStrategy and logs creation', () => {
    const deps = createDeps();
    const factory = new GenericStrategyFactory(deps);
    const strategy = factory.create('actor1');
    expect(strategy).toBeInstanceOf(GenericTurnStrategy);
    expect(strategy.choicePipeline).toBe(deps.choicePipeline);
    expect(strategy.decisionProvider).toBe(deps.decisionProvider);
    expect(strategy.turnActionFactory).toBe(deps.turnActionFactory);
    expect(strategy.logger).toBe(deps.logger);
    expect(strategy.fallbackFactory).toBe(deps.fallbackFactory);
    expect(deps.logger.debug).toHaveBeenCalledWith(
      'GenericStrategyFactory: Creating new GenericTurnStrategy for actor actor1 using TestProvider.'
    );
  });
});
