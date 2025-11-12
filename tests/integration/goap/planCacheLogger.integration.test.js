import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import PlanCache from '../../../src/goap/planning/planCache.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

const createPlan = (goalId, actionId) => ({
  goalId,
  steps: [
    {
      actionId,
      targetId: null,
      tertiaryTargetId: null
    }
  ],
  createdAt: Date.now(),
  validUntil: null
});

describe('PlanCache integration with ConsoleLogger', () => {
  let planCache;
  let logger;
  let debugSpy;
  let warnSpy;

  beforeEach(() => {
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    jest.spyOn(console, 'groupEnd').mockImplementation(() => {});
    jest.spyOn(console, 'table').mockImplementation(() => {});

    logger = new ConsoleLogger(LogLevel.DEBUG);
    planCache = new PlanCache({ logger });
    debugSpy.mockClear();
    warnSpy.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs cache miss and returns null when requesting uncached actor', () => {
    const result = planCache.get('unknown-actor');

    expect(result).toBeNull();
    expect(debugSpy).toHaveBeenCalledWith('Cache miss for unknown-actor');
  });

  it('warns and skips caching when plan is nullish', () => {
    planCache.set('actor-null', null);

    expect(planCache.has('actor-null')).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      'Attempted to cache null plan for actor-null'
    );
  });

  it('reports cache statistics and clears all entries with logging', () => {
    const planA = createPlan('goal:a', 'action:a');
    const planB = createPlan('goal:b', 'action:b');

    planCache.set('actor-a', planA);
    planCache.set('actor-b', planB);

    const stats = planCache.getStats();

    expect(stats.size).toBe(2);
    expect(stats.actors).toEqual(expect.arrayContaining(['actor-a', 'actor-b']));

    planCache.clear();

    expect(planCache.has('actor-a')).toBe(false);
    expect(planCache.has('actor-b')).toBe(false);
    expect(planCache.getStats().size).toBe(0);
    expect(debugSpy).toHaveBeenCalledWith('Cleared 2 cached plans');
  });

  it('skips invalidation logging when actor is not cached', () => {
    debugSpy.mockClear();

    planCache.invalidate('missing-actor');

    expect(debugSpy).not.toHaveBeenCalled();
  });

  it('does not emit goal invalidation logs when nothing is removed', () => {
    const plan = createPlan('goal:existing', 'action:existing');

    planCache.set('actor-existing', plan);
    debugSpy.mockClear();

    planCache.invalidateGoal('goal:absent');

    expect(planCache.has('actor-existing')).toBe(true);
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it('clears an empty cache without emitting debug output', () => {
    debugSpy.mockClear();

    planCache.clear();

    expect(debugSpy).not.toHaveBeenCalled();
  });
});
