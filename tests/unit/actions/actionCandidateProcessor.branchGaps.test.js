import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ActionCandidateProcessor } from '../../../src/actions/actionCandidateProcessor.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';

/**
 * Creates a lightweight ActionCandidateProcessor with minimal mocks so tests can
 * target specific control-flow gaps that aren't exercised by the comprehensive
 * suite.
 *
 * @returns {{ processor: ActionCandidateProcessor, mocks: Record<string, any> }}
 */
function createProcessorHarness() {
  const prerequisiteEvaluationService = {
    evaluate: jest.fn().mockReturnValue(true),
  };
  const targetResolutionService = {
    resolveTargets: jest.fn().mockReturnValue(ActionResult.success([])),
  };
  const actionCommandFormatter = {
    format: jest.fn().mockReturnValue({ ok: true, value: 'formatted-command' }),
  };
  const actionErrorContextBuilder = {
    buildErrorContext: jest.fn().mockReturnValue({}),
  };
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const processor = new ActionCandidateProcessor({
    prerequisiteEvaluationService,
    targetResolutionService,
    entityManager: {},
    actionCommandFormatter,
    safeEventDispatcher: {},
    getEntityDisplayNameFn: jest.fn(() => 'Actor'),
    logger,
    actionErrorContextBuilder,
  });

  return {
    processor,
    mocks: {
      prerequisiteEvaluationService,
      targetResolutionService,
      actionCommandFormatter,
      actionErrorContextBuilder,
      logger,
    },
  };
}

describe('ActionCandidateProcessor branch coverage gaps', () => {
  let harness;

  beforeEach(() => {
    harness = createProcessorHarness();
  });

  it('skips trace orchestration when no trace context is provided', () => {
    const { processor, mocks } = harness;
    const actionDef = { id: 'missing-trace', scope: 'none' };
    const actorEntity = { id: 'actor-1' };
    const context = { turn: 7 };

    const result = processor.process(actionDef, actorEntity, context);

    expect(result.success).toBe(true);
    expect(result.value).toEqual({ actions: [], errors: [], cause: 'no-targets' });
    expect(mocks.prerequisiteEvaluationService.evaluate).not.toHaveBeenCalled();
    expect(mocks.targetResolutionService.resolveTargets).toHaveBeenCalledWith(
      'none',
      actorEntity,
      context,
      null,
      'missing-trace'
    );
  });

  it('formats actions without evaluating prerequisites when they are omitted', () => {
    const { processor, mocks } = harness;
    const actionDef = {
      id: 'no-prereq',
      name: 'No Prereq',
      commandVerb: 'perform',
      scope: 'target',
    };
    const actorEntity = { id: 'actor-2' };
    const context = { phase: 'test' };
    const trace = {
      step: jest.fn(),
      info: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
    };

    mocks.targetResolutionService.resolveTargets.mockReturnValue(
      ActionResult.success([{ entityId: 'target-42' }])
    );
    mocks.actionCommandFormatter.format.mockReturnValue({
      ok: true,
      value: 'perform target-42',
    });

    const result = processor.process(actionDef, actorEntity, context, trace);

    expect(trace.step).toHaveBeenCalledWith(
      "Processing candidate action: 'no-prereq'",
      'ActionCandidateProcessor.process'
    );
    expect(mocks.prerequisiteEvaluationService.evaluate).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.value).toEqual({
      actions: [
        {
          id: 'no-prereq',
          name: 'No Prereq',
          command: 'perform target-42',
          description: '',
          params: { targetId: 'target-42' },
          visual: null,
        },
      ],
      errors: [],
      cause: undefined,
    });
  });
});
