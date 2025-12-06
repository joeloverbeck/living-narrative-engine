import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { normalizePlanningPreconditions } from '../../../../src/goap/utils/planningPreconditionUtils.js';

const createLogger = () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('normalizePlanningPreconditions', () => {
  let logger;

  beforeEach(() => {
    logger = createLogger();
    delete process.env.GOAP_STATE_ASSERT;
  });

  afterEach(() => {
    delete process.env.GOAP_STATE_ASSERT;
  });

  it('returns an empty array when task is not an object', () => {
    const result = normalizePlanningPreconditions(null, logger);

    expect(result).toEqual([]);
  });

  it('returns canonical entries for modern planningPreconditions', () => {
    const task = {
      id: 'task:modern',
      planningPreconditions: [
        {
          description: 'Must know hunger',
          condition: { has_component: ['actor-1', 'core:hunger'] },
        },
        {
          condition: {
            '==': [{ var: 'state.actor.components.core_needs.hunger' }, 50],
          },
        },
      ],
    };

    const normalized = normalizePlanningPreconditions(task, logger);

    expect(normalized).toHaveLength(2);
    expect(normalized[0].description).toBe('Must know hunger');
    expect(normalized[1].description).toBe('Precondition 2 for task:modern');
    expect(normalized[0].condition).not.toBe(
      task.planningPreconditions[0].condition
    );
    expect(normalized[0].condition).toEqual(
      task.planningPreconditions[0].condition
    );
  });

  it('initializes diagnostics tracking for planningPreconditions without mutating entries', () => {
    const diagnostics = {};
    const task = {
      id: 'task:primitive',
      planningPreconditions: ['{ var: "actor.health" }'],
    };

    const normalized = normalizePlanningPreconditions(task, logger, {
      diagnostics,
    });

    expect(Array.isArray(diagnostics.preconditionNormalizations)).toBe(true);
    expect(diagnostics.preconditionNormalizations).toHaveLength(0);
    expect(normalized).toEqual([
      {
        description: 'Precondition 1 for task:primitive',
        condition: '{ var: "actor.health" }',
      },
    ]);
  });

  it('falls back to legacy preconditions, records diagnostics, and preserves descriptions', () => {
    const task = {
      id: 'task:legacy',
      preconditions: [
        { description: 'legacy gate', '==': [{ var: 'actor.hunger' }, 100] },
      ],
    };
    const diagnostics = { preconditionNormalizations: [] };

    const normalized = normalizePlanningPreconditions(task, logger, {
      diagnostics,
      actorId: 'actor-42',
      goalId: 'goal:stay-fed',
      origin: 'unit-test',
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('legacy "preconditions"'),
      expect.objectContaining({ taskId: 'task:legacy', origin: 'unit-test' })
    );
    expect(normalized).toHaveLength(1);
    expect(normalized[0].description).toBe('legacy gate');
    expect(diagnostics.preconditionNormalizations).toHaveLength(1);
    const entry = diagnostics.preconditionNormalizations[0];
    expect(entry).toEqual(
      expect.objectContaining({
        taskId: 'task:legacy',
        sourceField: 'preconditions',
        normalizedCount: 1,
        actorId: 'actor-42',
        goalId: 'goal:stay-fed',
        origin: 'unit-test',
      })
    );
    expect(entry.timestamp).toEqual(expect.any(Number));
    expect(entry.normalizedPreconditions[0].condition).toEqual({
      '==': [{ var: 'actor.hunger' }, 100],
    });
  });

  it('throws when GOAP_STATE_ASSERT=1 and legacy preconditions are used', () => {
    process.env.GOAP_STATE_ASSERT = '1';
    const task = {
      id: 'task:legacy-assert',
      preconditions: [{ '>': [{ var: 'actor.health' }, 50] }],
    };

    expect(() => normalizePlanningPreconditions(task, logger)).toThrow(
      /Legacy "preconditions" detected/
    );
  });

  it('supplies tautological conditions for entries with only descriptions', () => {
    const task = {
      id: 'task:partial',
      preconditions: [{ description: 'Only description' }],
    };

    const diagnostics = { preconditionNormalizations: [] };
    const normalized = normalizePlanningPreconditions(task, logger, {
      diagnostics,
    });

    expect(normalized[0].condition).toEqual({ '==': [true, true] });
    expect(
      diagnostics.preconditionNormalizations[0].normalizedPreconditions[0]
        .condition
    ).toEqual({
      '==': [true, true],
    });
  });

  it('supplies tautologies when a precondition entry is falsy', () => {
    const task = {
      id: 'task:null-entry',
      planningPreconditions: [null],
    };

    const normalized = normalizePlanningPreconditions(task, logger);

    expect(normalized).toEqual([
      {
        description: 'Precondition 1 for task:null-entry',
        condition: { '==': [true, true] },
      },
    ]);
  });

  it('normalizes requires entries, rewrites actor paths, and records diagnostics', () => {
    const diagnostics = {};
    const task = {
      id: 'task:requires',
      requires: ['actor.health', null, { condition: { '==': [1, 1] } }],
    };

    const normalized = normalizePlanningPreconditions(task, logger, {
      diagnostics,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('uses shorthand "requires"'),
      expect.objectContaining({ taskId: 'task:requires' })
    );
    expect(normalized).toHaveLength(2);
    expect(normalized[0]).toEqual({
      description: 'Precondition 1 for task:requires',
      condition: { '!!': [{ var: 'state.actor.components.health' }] },
    });
    expect(normalized[1]).toEqual({
      description: 'Precondition 2 for task:requires',
      condition: { '==': [1, 1] },
    });

    expect(diagnostics.preconditionNormalizations).toHaveLength(1);
    expect(diagnostics.preconditionNormalizations[0]).toEqual(
      expect.objectContaining({
        taskId: 'task:requires',
        sourceField: 'requires',
        normalizedCount: 2,
      })
    );
  });
});
