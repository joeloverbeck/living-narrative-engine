/**
 * @file PipelineResult pipeline flow integration tests.
 * @description Validates PipelineResult behavior when executed by the real Pipeline
 *              implementation across success and failure stages without mocking.
 */

import { describe, it, expect } from '@jest/globals';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';

/**
 * Creates a minimal logger that records debug statements while satisfying the
 * ILogger contract expected by Pipeline.
 *
 * @returns {{debug: Function, info: Function, warn: Function, error: Function, logs: string[]}}
 */
function createTestLogger() {
  const logs = [];
  const log = (prefix) => (message) => {
    logs.push(`${prefix}:${message}`);
  };

  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
    logs,
  };
}

describe('PipelineResult pipeline flow integration', () => {
  it('merges actions, data, and errors across multiple stages', async () => {
    const logger = createTestLogger();
    const actionA = { id: 'action-alpha', label: 'Alpha Action' };
    const actionB = { id: 'action-beta', label: 'Beta Action' };

    class StageOne extends PipelineStage {
      constructor() {
        super('StageOne');
      }

      async executeInternal(context) {
        expect(context.actions).toBeUndefined();
        return PipelineResult.success({
          actions: [actionA],
          errors: [{ phase: 'diagnostic', message: 'non-blocking warning' }],
          data: { stage1: true, shared: 'stage-one' },
        });
      }
    }

    class StageTwo extends PipelineStage {
      constructor() {
        super('StageTwo');
      }

      async executeInternal(context) {
        expect(context.actions).toEqual([actionA]);

        const baseResult = PipelineResult.fromActionResult(
          ActionResult.success({ stage2Value: 'ready' }),
          { stage2: true }
        );

        const chained = baseResult.chainActionResult((data) => {
          expect(data.stage2Value).toBe('ready');
          return ActionResult.success({
            chainedOutcome: data.stage2Value.toUpperCase(),
          });
        });

        return PipelineResult.success({
          actions: [actionB],
          errors: chained.errors,
          data: chained.data,
        });
      }
    }

    class StageThree extends PipelineStage {
      constructor() {
        super('StageThree');
      }

      async executeInternal(context) {
        expect(context.actions).toEqual([actionA, actionB]);
        return PipelineResult.success({
          data: { stage3: 'complete' },
        });
      }
    }

    const pipeline = new Pipeline(
      [new StageOne(), new StageTwo(), new StageThree()],
      logger
    );

    const result = await pipeline.execute({
      actor: { id: 'actor-1' },
      actionContext: { mood: 'curious' },
      candidateActions: [],
    });

    expect(result.success).toBe(true);
    expect(result.actions).toEqual([actionA, actionB]);
    expect(result.errors).toEqual([
      { phase: 'diagnostic', message: 'non-blocking warning' },
    ]);
    expect(result.data).toEqual({
      stage1: true,
      stage2: true,
      stage2Value: 'ready',
      chainedOutcome: 'READY',
      shared: 'stage-one',
      stage3: 'complete',
    });
    expect(result.continueProcessing).toBe(true);
    expect(
      logger.logs.some((entry) =>
        entry.startsWith('debug:Executing pipeline stage')
      )
    ).toBe(true);
  });

  it('halts processing when a stage reports failure and preserves accumulated context', async () => {
    const logger = createTestLogger();
    const executionOrder = [];

    class SuccessStage extends PipelineStage {
      constructor() {
        super('SuccessStage');
      }

      async executeInternal() {
        executionOrder.push('success');
        return PipelineResult.success({
          data: { prepared: true },
        });
      }
    }

    class FailureStage extends PipelineStage {
      constructor() {
        super('FailureStage');
      }

      async executeInternal(context) {
        executionOrder.push('failure');
        expect(context.prepared).toBe(true);

        const initialFailure = PipelineResult.failure(
          { error: 'downstream failure', stage: 'FailureStage' },
          { stage2Attempted: true, preparedFlag: context.prepared }
        );

        const chainedFailure = initialFailure.chainActionResult(() => {
          throw new Error('should not run chaining on failure results');
        });

        const secondaryFailure = PipelineResult.fromActionResult(
          ActionResult.failure(new Error('secondary failure reason')),
          chainedFailure.data
        );

        return chainedFailure.merge(secondaryFailure);
      }
    }

    let stageThreeExecuted = false;
    class SkippedStage extends PipelineStage {
      constructor() {
        super('SkippedStage');
      }

      async executeInternal() {
        stageThreeExecuted = true;
        return PipelineResult.success({ data: { final: true } });
      }
    }

    const pipeline = new Pipeline(
      [new SuccessStage(), new FailureStage(), new SkippedStage()],
      logger
    );

    const result = await pipeline.execute({
      actor: { id: 'actor-2' },
      actionContext: { intent: 'test' },
      candidateActions: [],
    });

    expect(result.success).toBe(false);
    expect(result.actions).toEqual([]);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.map((err) => err.error || err.message)).toEqual([
      'downstream failure',
      'secondary failure reason',
    ]);
    expect(result.data).toEqual({
      stage2Attempted: true,
      preparedFlag: true,
      prepared: true,
    });
    expect(result.continueProcessing).toBe(false);
    expect(stageThreeExecuted).toBe(false);
    expect(executionOrder).toEqual(['success', 'failure']);
  });
});
