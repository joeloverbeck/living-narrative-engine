import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionFormattingDecider } from '../../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingDecider.js';

/** @typedef {import('../../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingTaskFactory.js').ActionFormattingTask} ActionFormattingTask */

const createTask = (overrides = {}) => {
  /** @type {ActionFormattingTask} */
  const task = {
    actor: { id: 'actor-1' },
    actionDef: {
      id: 'action-1',
      name: 'Test Action',
      description: 'desc',
    },
    targetContexts: [],
    resolvedTargets: null,
    targetDefinitions: null,
    isMultiTarget: false,
    formatterOptions: {},
    metadata: {
      source: 'legacy',
      hasPerActionMetadata: false,
    },
    ...overrides,
  };

  task.metadata = {
    source: task.metadata?.source ?? 'legacy',
    hasPerActionMetadata: Boolean(task.metadata?.hasPerActionMetadata),
    ...task.metadata,
  };

  return task;
};

describe('ActionFormattingDecider', () => {
  let errorFactory;

  beforeEach(() => {
    errorFactory = {
      create: jest.fn((context) => ({ ...context })),
    };
  });

  it('selects the highest priority strategy when validation passes', () => {
    const perActionStrategy = {
      canFormat: jest.fn(() => true),
      format: jest.fn(),
      priority: 200,
    };
    const batchStrategy = {
      canFormat: jest.fn(() => true),
      format: jest.fn(),
      priority: 100,
    };

    const decider = new ActionFormattingDecider({
      strategies: [batchStrategy, perActionStrategy],
      errorFactory,
    });

    const task = createTask({
      metadata: { source: 'per-action', hasPerActionMetadata: true },
      resolvedTargets: {},
      targetDefinitions: {},
      isMultiTarget: true,
    });

    const outcome = decider.decide({ task, actorId: 'actor-1' });

    expect(outcome.strategy).toBe(perActionStrategy);
    expect(outcome.validationFailures).toHaveLength(0);
    expect(perActionStrategy.canFormat).toHaveBeenCalledWith(task);
  });

  it('emits validation failures for incomplete per-action metadata and falls back to legacy', () => {
    const perActionStrategy = {
      canFormat: jest.fn(() => true),
      format: jest.fn(),
    };
    const decider = new ActionFormattingDecider({
      strategies: [perActionStrategy],
      errorFactory,
    });

    const task = createTask({
      metadata: { source: 'per-action', hasPerActionMetadata: true },
      resolvedTargets: null,
      targetDefinitions: null,
      isMultiTarget: undefined,
    });

    const outcome = decider.decide({ task, actorId: 'actor-1' });

    expect(outcome.strategy).toBeNull();
    expect(outcome.validationFailures).toHaveLength(1);
    expect(outcome.validationFailures[0].code).toBe('per_action_metadata_missing');
    expect(errorFactory.create).toHaveBeenCalledTimes(1);
  });

  it('selects batch strategy when per-action metadata is absent', () => {
    const perActionStrategy = {
      canFormat: jest.fn(() => false),
      format: jest.fn(),
    };
    const batchStrategy = {
      canFormat: jest.fn(() => true),
      format: jest.fn(),
    };

    const decider = new ActionFormattingDecider({
      strategies: [perActionStrategy, batchStrategy],
      errorFactory,
    });

    const task = createTask({
      metadata: { source: 'batch', hasPerActionMetadata: false },
      resolvedTargets: { primary: [] },
      targetDefinitions: { primary: {} },
      isMultiTarget: true,
    });

    const outcome = decider.decide({ task, actorId: 'actor-1' });

    expect(outcome.strategy).toBe(batchStrategy);
    expect(outcome.validationFailures).toHaveLength(0);
  });

  it('respects custom comparator ordering when provided', () => {
    const firstStrategy = {
      name: 'First',
      canFormat: jest.fn(() => true),
      format: jest.fn(),
    };
    const secondStrategy = {
      name: 'Second',
      canFormat: jest.fn(() => true),
      format: jest.fn(),
    };

    const comparator = jest.fn(() => -1);
    const decider = new ActionFormattingDecider({
      strategies: [firstStrategy, secondStrategy],
      errorFactory,
      comparator,
    });

    const task = createTask({
      metadata: { source: 'batch', hasPerActionMetadata: false },
      resolvedTargets: { primary: [] },
      targetDefinitions: { primary: {} },
      isMultiTarget: true,
    });

    const outcome = decider.decide({ task, actorId: 'actor-1' });

    expect(comparator).toHaveBeenCalled();
    expect(outcome.strategy).toBe(secondStrategy);
  });
});
