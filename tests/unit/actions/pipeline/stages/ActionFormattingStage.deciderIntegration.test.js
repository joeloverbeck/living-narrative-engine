import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionFormattingStage } from '../../../../../src/actions/pipeline/stages/ActionFormattingStage.js';

const createStage = () => {
  const commandFormatter = {
    format: jest.fn(() => ({ ok: true, value: 'legacy-command' })),
    formatMultiTarget: jest.fn((actionDef, resolvedTargets) => {
      if (actionDef.id === 'action-per') {
        return { ok: true, value: 'per-command' };
      }
      if (actionDef.id === 'action-batch') {
        return {
          ok: true,
          value: {
            command: 'batch-command',
            targets: resolvedTargets,
          },
        };
      }
      return { ok: false, error: 'unsupported' };
    }),
  };

  const dependencies = {
    commandFormatter,
    entityManager: {},
    safeEventDispatcher: { dispatch: jest.fn() },
    getEntityDisplayNameFn: jest.fn(() => 'Target'),
    errorContextBuilder: {
      buildErrorContext: jest.fn((ctx) => ({ ...ctx, built: true })),
    },
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  };

  return {
    stage: new ActionFormattingStage(dependencies),
    commandFormatter,
    dependencies,
  };
};

describe('ActionFormattingStage - decider integration', () => {
  let stage;
  let commandFormatter;
  let dependencies;

  beforeEach(() => {
    ({ stage, commandFormatter, dependencies } = createStage());
  });

  const buildContext = () => ({
    actor: { id: 'actor-1' },
    actionsWithTargets: [
      {
        actionDef: {
          id: 'action-per',
          name: 'Per Action',
          description: 'per',
          visual: null,
        },
        targetContexts: [{ entityId: 'target-1' }],
        resolvedTargets: { primary: [{ id: 'target-1' }] },
        targetDefinitions: { primary: { placeholder: 'primary' } },
        isMultiTarget: true,
      },
      {
        actionDef: {
          id: 'action-batch',
          name: 'Batch Action',
          description: 'batch',
          visual: null,
        },
        targetContexts: [{ entityId: 'target-2' }],
      },
      {
        actionDef: {
          id: 'action-legacy',
          name: 'Legacy Action',
          description: 'legacy',
          visual: null,
        },
        targetContexts: [{ entityId: 'legacy-target' }],
      },
    ],
    resolvedTargets: {
      primary: [{ id: 'target-2' }],
    },
    targetDefinitions: {
      primary: { placeholder: 'primary' },
    },
  });

  it('formats mixed tasks using the appropriate strategies without tracing', async () => {
    const context = buildContext();

    const result = await stage.executeInternal(context);

    expect(result.success).toBe(true);
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'action-per', command: 'per-command' }),
        expect.objectContaining({
          id: 'action-batch',
          command: 'batch-command',
        }),
        expect.objectContaining({
          id: 'action-legacy',
          command: 'legacy-command',
        }),
      ])
    );
    expect(result.errors).toHaveLength(0);
    expect(
      commandFormatter.formatMultiTarget.mock.calls.length
    ).toBeGreaterThanOrEqual(2);
    expect(commandFormatter.format.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('emits trace-aware instrumentation events for mixed strategies', async () => {
    const context = {
      ...buildContext(),
      trace: {
        captureActionData: jest.fn(),
        step: jest.fn(),
        info: jest.fn(),
      },
    };

    const result = await stage.executeInternal(context);

    expect(result.success).toBe(true);
    const summaryCall = context.trace.captureActionData.mock.calls.find(
      ([category, id]) => category === 'formatting' && id === '__stage_summary'
    );
    expect(summaryCall).toBeDefined();
    expect(summaryCall[2]).toMatchObject({
      statistics: expect.objectContaining({
        total: 3,
        successful: 3,
        failed: 0,
      }),
    });
  });
});
