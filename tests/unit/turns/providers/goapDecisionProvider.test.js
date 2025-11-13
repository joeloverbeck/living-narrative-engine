import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { GoapDecisionProvider } from '../../../../src/turns/providers/goapDecisionProvider.js';

const createLogger = () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
});

const createDispatcher = () => ({ dispatch: jest.fn() });

const createDependencies = (overrides = {}) => ({
  logger: overrides.logger ?? createLogger(),
  safeEventDispatcher: overrides.safeEventDispatcher ?? createDispatcher(),
});

describe('GoapDecisionProvider', () => {
  let baseDeps;

  beforeEach(() => {
    jest.clearAllMocks();
    baseDeps = createDependencies();
  });

  it('returns the first action index when actions are available', async () => {
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
    expect(baseDeps.logger.debug).toHaveBeenCalled();
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
    expect(baseDeps.logger.debug).toHaveBeenCalledWith('No actions available for GOAP actor');
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
    expect(baseDeps.logger.debug).toHaveBeenCalledWith('No actions available for GOAP actor');
  });
});
