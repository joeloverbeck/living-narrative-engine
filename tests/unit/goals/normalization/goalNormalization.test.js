import { describe, it, expect, afterEach, jest } from '@jest/globals';
import {
  normalizeGoalData,
  registerGoalNormalizationExtension,
  clearGoalNormalizationExtensions,
  alwaysTrueCondition,
  simpleStateMatcher,
} from '../../../../src/goals/normalization/index.js';
import { ModValidationError } from '../../../../src/errors/modValidationError.js';

afterEach(() => {
  clearGoalNormalizationExtensions();
  jest.clearAllMocks();
});

function createBaseGoal() {
  return {
    priority: 10,
    relevance: alwaysTrueCondition(),
    goalState: simpleStateMatcher('state.actor.ready', true),
  };
}

describe('normalizeGoalData', () => {
  it('coerces string priority values and records warnings', () => {
    const logger = { warn: jest.fn() };
    const data = createBaseGoal();
    data.priority = '42';

    const result = normalizeGoalData(data, { logger });

    expect(result.data.priority).toBe(42);
    expect(result.warnings.some((warning) => warning.message.includes('Coerced string priority'))).toBe(
      true
    );
    expect(logger.warn).toHaveBeenCalled();
  });

  it('fills relevance and goalState scaffolding when missing during permissive mode', () => {
    const data = { id: 'test.goal', priority: 7 };

    const result = normalizeGoalData(data, { allowDefaults: true });

    expect(result.data.relevance).toEqual(alwaysTrueCondition());
    expect(result.data.goalState).toEqual(
      simpleStateMatcher('state.goal.placeholder', true)
    );
  });

  it('throws when a required condition is missing in strict mode', () => {
    const data = { priority: 5, relevance: alwaysTrueCondition() };

    expect(() => normalizeGoalData(data, { allowDefaults: false })).toThrow(
      ModValidationError
    );
  });

  it('runs registered extensions and merges their metadata output', () => {
    const hook = jest.fn(({ data }) => {
      data._custom = true; // demonstrate mutation access
      return {
        warnings: [{ message: 'custom warning', details: { reason: 'extension' } }],
        mutations: [{ field: '_custom', type: 'extension' }],
      };
    });
    registerGoalNormalizationExtension(hook);

    const logger = { warn: jest.fn() };
    const result = normalizeGoalData(createBaseGoal(), { allowDefaults: false, logger });

    expect(hook).toHaveBeenCalled();
    expect(result.data._custom).toBe(true);
    expect(
      result.warnings.some((warning) => warning.message === 'custom warning')
    ).toBe(true);
    expect(result.mutations.some((mutation) => mutation.field === '_custom')).toBe(true);
  });

  it('propagates extension failures when permissive mode is disabled', () => {
    registerGoalNormalizationExtension(() => {
      throw new Error('boom');
    });

    expect(() => normalizeGoalData(createBaseGoal(), { allowDefaults: false })).toThrow(
      ModValidationError
    );
  });

  it('downgrades extension failures to warnings when permissive mode is enabled', () => {
    registerGoalNormalizationExtension(() => {
      throw new Error('extension failed');
    });

    const logger = { warn: jest.fn() };
    const result = normalizeGoalData(createBaseGoal(), {
      allowDefaults: true,
      logger,
    });

    expect(
      result.warnings.some((warning) =>
        warning.message.includes('Goal normalization extension failed')
      )
    ).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });
});
