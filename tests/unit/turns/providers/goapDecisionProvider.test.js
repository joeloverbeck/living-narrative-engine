import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { GoapDecisionProvider } from '../../../../src/turns/providers/goapDecisionProvider.js';

const createLogger = () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
});

const createDispatcher = () => ({ dispatch: jest.fn() });

const createEntity = () => ({
  getAllComponents: jest.fn().mockReturnValue({}),
});

const createDependencies = (overrides = {}) => ({
  goalManager: {
    selectGoal: jest.fn(),
    isGoalSatisfied: jest.fn(),
    ...(overrides.goalManager ?? {}),
  },
  simplePlanner: {
    plan: jest.fn(),
    validatePlan: jest.fn().mockReturnValue(true),
    createPlan: jest.fn(),
    ...(overrides.simplePlanner ?? {}),
  },
  planCache: {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
    invalidate: jest.fn(),
    ...(overrides.planCache ?? {}),
  },
  entityManager: {
    getEntityInstance: jest.fn().mockReturnValue(createEntity()),
    hasComponent: jest.fn(),
    getComponentData: jest.fn(),
    ...(overrides.entityManager ?? {}),
  },
  logger: overrides.logger ?? createLogger(),
  safeEventDispatcher: overrides.safeEventDispatcher ?? createDispatcher(),
});

describe('GoapDecisionProvider', () => {
  let baseDeps;

  beforeEach(() => {
    jest.clearAllMocks();
    baseDeps = createDependencies();
  });

  it('returns the first planned action index when a valid cached plan exists', async () => {
    const plannedStep = { actionId: 'core:test', targetId: 'target-1' };
    const cachedPlan = { goalId: 'goal-1', steps: [plannedStep] };

    baseDeps.planCache.get.mockReturnValue(cachedPlan);
    const provider = new GoapDecisionProvider(baseDeps);

    const decision = await provider.decide(
      { id: 'actor-1' },
      {},
      [
        {
          index: 2,
          actionId: 'core:test',
          commandString: 'do x',
          params: { targetId: 'target-1' },
          description: 'test',
          visual: null,
        },
        {
          index: 1,
          actionId: 'core:other',
          commandString: 'do y',
          params: { targetId: 'other' },
          description: 'other',
          visual: null,
        },
      ]
    );

    expect(decision).toEqual({
      chosenIndex: 2,
      speech: null,
      thoughts: null,
      notes: null,
    });
    expect(baseDeps.planCache.invalidate).not.toHaveBeenCalled();
    expect(baseDeps.simplePlanner.validatePlan).toHaveBeenCalledWith(
      cachedPlan,
      expect.any(Object)
    );
  });

  it('returns null when no actions are available', async () => {
    const provider = new GoapDecisionProvider(baseDeps);

    const decision = await provider.decide({ id: 'actor-1' }, {}, []);

    expect(decision).toEqual({
      chosenIndex: null,
      speech: null,
      thoughts: null,
      notes: null,
    });
    expect(baseDeps.planCache.get).not.toHaveBeenCalled();
  });

  it('returns null when actions input is not an array', async () => {
    const provider = new GoapDecisionProvider(baseDeps);

    const decision = await provider.decide(
      { id: 'actor-1' },
      {},
      // @ts-expect-error intentionally passing a non-array value
      null
    );

    expect(decision).toEqual({
      chosenIndex: null,
      speech: null,
      thoughts: null,
      notes: null,
    });
    expect(baseDeps.planCache.get).not.toHaveBeenCalled();
  });
});
