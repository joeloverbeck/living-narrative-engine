import { describe, it, expect, afterEach, jest } from '@jest/globals';
import {
  normalizeGoalData,
  registerGoalNormalizationExtension,
  clearGoalNormalizationExtensions,
  getGoalNormalizationExtensions,
  alwaysTrueCondition,
  simpleStateMatcher,
} from '../../../../src/goals/normalization/index.js';
import { ModValidationError } from '../../../../src/errors/modValidationError.js';

afterEach(() => {
  clearGoalNormalizationExtensions();
  jest.clearAllMocks();
});

/**
 *
 */
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
    expect(
      result.warnings.some((warning) =>
        warning.message.includes('Coerced string priority')
      )
    ).toBe(true);
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
        warnings: [
          { message: 'custom warning', details: { reason: 'extension' } },
        ],
        mutations: [{ field: '_custom', type: 'extension' }],
      };
    });
    registerGoalNormalizationExtension(hook);

    const logger = { warn: jest.fn() };
    const result = normalizeGoalData(createBaseGoal(), {
      allowDefaults: false,
      logger,
    });

    expect(hook).toHaveBeenCalled();
    expect(result.data._custom).toBe(true);
    expect(
      result.warnings.some((warning) => warning.message === 'custom warning')
    ).toBe(true);
    expect(
      result.mutations.some((mutation) => mutation.field === '_custom')
    ).toBe(true);
  });

  it('propagates extension failures when permissive mode is disabled', () => {
    registerGoalNormalizationExtension(() => {
      throw new Error('boom');
    });

    expect(() =>
      normalizeGoalData(createBaseGoal(), { allowDefaults: false })
    ).toThrow(ModValidationError);
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

  it('defaults invalid priorities when defaults are allowed', () => {
    const logger = { warn: jest.fn() };
    const goal = {
      relevance: { condition_ref: 'valid' },
      goalState: { condition_ref: 'state' },
    };

    const result = normalizeGoalData(goal, { allowDefaults: true, logger });

    expect(result.data.priority).toBe(0);
    expect(
      result.warnings.some((warning) =>
        warning.message.includes('defaulted to 0')
      )
    ).toBe(true);
    expect(
      result.mutations.some(
        (mutation) =>
          mutation.type === 'defaulted' && mutation.field === 'priority'
      )
    ).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('unwraps logic containers when they contain nested condition objects', () => {
    const logger = { warn: jest.fn() };
    const goal = {
      priority: 5,
      relevance: { logic: { condition_ref: 'wrapped.relevance' } },
      goalState: { condition_ref: 'state.valid' },
    };

    const result = normalizeGoalData(goal, { allowDefaults: false, logger });

    expect(result.data.relevance).toEqual({
      condition_ref: 'wrapped.relevance',
    });
    expect(result.mutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'relevance',
          type: 'unwrapped',
          from: { logic: { condition_ref: 'wrapped.relevance' } },
        }),
      ])
    );
    expect(
      result.warnings.some((warning) =>
        warning.message.includes("'logic' has been normalized")
      )
    ).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('treats logic containers with non-object payloads as conditions', () => {
    const goal = {
      priority: 3,
      relevance: { logic: 'string payload' },
      goalState: { condition_ref: 'state.valid' },
    };

    const result = normalizeGoalData(goal, { allowDefaults: false });

    expect(result.data.relevance).toEqual({ logic: 'string payload' });
  });

  it('accepts condition_ref-style conditions', () => {
    const goal = {
      priority: 2,
      relevance: { condition_ref: 'direct.ref' },
      goalState: { condition_ref: 'state.valid' },
    };

    const result = normalizeGoalData(goal, { allowDefaults: false });

    expect(result.data.relevance).toEqual({ condition_ref: 'direct.ref' });
  });

  it('throws when provided data is not a plain object', () => {
    expect(() => normalizeGoalData(null)).toThrow(TypeError);
    expect(() => normalizeGoalData(['not', 'object'])).toThrow(TypeError);
  });

  it('validates extension registration types', () => {
    expect(() => registerGoalNormalizationExtension({})).toThrow(TypeError);
  });

  it('exposes registered extensions', () => {
    const hook = jest.fn();
    registerGoalNormalizationExtension(hook);

    expect(getGoalNormalizationExtensions()).toContain(hook);
  });
});
