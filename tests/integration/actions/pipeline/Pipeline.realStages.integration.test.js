/**
 * @file Integration tests exercising the Pipeline with concrete stage implementations.
 * @description Validates orchestration, context propagation, tracing, and error handling
 * without mocking stage behaviour so that interactions between real modules are covered.
 */

import { describe, it, expect } from '@jest/globals';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';

/**
 * @class TestStage
 * @extends PipelineStage
 * @description Concrete stage used in integration tests that delegates to a handler
 * while recording whether it executed.
 */
class TestStage extends PipelineStage {
  /**
   * @param {string} name - Stage name used for logging/tracing.
   * @param {(context: object) => Promise<PipelineResult>} handler - Execution logic.
   */
  constructor(name, handler) {
    super(name);
    this.#handler = handler;
    this.invocationCount = 0;
  }

  /** @type {(context: object) => Promise<PipelineResult>} */
  #handler;

  /** @override */
  async executeInternal(context) {
    this.invocationCount += 1;
    return this.#handler(context);
  }
}

/**
 * Creates a simple logger that records calls without using jest mocks.
 *
 * @returns {{ logger: object, calls: { debug: Array, warn: Array, error: Array } }}
 */
function createRecordingLogger() {
  const calls = { debug: [], warn: [], error: [] };
  return {
    logger: {
      debug: (message, ...args) => {
        calls.debug.push({ message, args });
      },
      warn: (message, ...args) => {
        calls.warn.push({ message, args });
      },
      error: (message, ...args) => {
        calls.error.push({ message, args });
      },
    },
    calls,
  };
}

/**
 * Creates a trace implementation with structured span support that records interactions.
 *
 * @returns {{ trace: object, calls: Record<string, Array> }}
 */
function createStructuredTraceRecorder() {
  const calls = {
    withSpanAsync: [],
    info: [],
    step: [],
    success: [],
    failure: [],
  };
  return {
    trace: {
      async withSpanAsync(name, executor, metadata) {
        calls.withSpanAsync.push({ name, metadata });
        return executor();
      },
      info: (message, source, metadata) => {
        calls.info.push({ message, source, metadata });
      },
      step: (message, source) => {
        calls.step.push({ message, source });
      },
      success: (message, source) => {
        calls.success.push({ message, source });
      },
      failure: (message, source) => {
        calls.failure.push({ message, source });
      },
    },
    calls,
  };
}

/**
 * Creates a trace implementation without structured span helpers to cover the fallback path.
 *
 * @returns {{ trace: object, calls: Record<string, Array> }}
 */
function createSimpleTraceRecorder() {
  const calls = {
    info: [],
    step: [],
    success: [],
    failure: [],
  };
  return {
    trace: {
      info: (message, source) => {
        calls.info.push({ message, source });
      },
      step: (message, source) => {
        calls.step.push({ message, source });
      },
      success: (message, source) => {
        calls.success.push({ message, source });
      },
      failure: (message, source) => {
        calls.failure.push({ message, source });
      },
    },
    calls,
  };
}

describe('Pipeline integration with concrete stages', () => {
  it('executes stages in order, merges results, and halts when instructed', async () => {
    const { logger, calls: loggerCalls } = createRecordingLogger();
    const { trace, calls: traceCalls } = createStructuredTraceRecorder();

    const stageOne = new TestStage('GatherCandidates', async (context) => {
      expect(context.actor.id).toBe('actor-42');
      expect(context.actionContext.scope).toBe('test-scope');

      return PipelineResult.success({
        actions: [{ id: 'cand-1' }],
        data: { gathered: true, candidateActions: [{ id: 'cand-1' }] },
      });
    });

    const stageTwo = new TestStage('EvaluateCandidates', async (context) => {
      expect(context.gathered).toBe(true);
      expect(context.actions).toHaveLength(1);

      return new PipelineResult({
        success: false,
        errors: [
          {
            error: 'Evaluation failed',
            phase: 'TEST_PIPELINE',
          },
        ],
        data: { evaluation: 'needs review' },
        continueProcessing: true,
      });
    });

    const stageThree = new TestStage('Finalize', async (context) => {
      expect(context.evaluation).toBe('needs review');
      expect(context.errors).toHaveLength(1);

      return PipelineResult.success({
        actions: [{ id: 'final-action' }],
        data: { finalized: true },
        continueProcessing: false,
      });
    });

    const stageFour = new TestStage('ShouldNotRun', async () => {
      throw new Error('This stage should not be executed once processing stops');
    });

    const pipeline = new Pipeline(
      [stageOne, stageTwo, stageThree, stageFour],
      logger
    );

    const result = await pipeline.execute({
      actor: { id: 'actor-42' },
      actionContext: { scope: 'test-scope' },
      candidateActions: [],
      trace,
    });

    expect(stageOne.invocationCount).toBe(1);
    expect(stageTwo.invocationCount).toBe(1);
    expect(stageThree.invocationCount).toBe(1);
    expect(stageFour.invocationCount).toBe(0);

    expect(result.success).toBe(false);
    expect(result.continueProcessing).toBe(false);
    expect(result.actions).toEqual([
      { id: 'cand-1' },
      { id: 'final-action' },
    ]);
    expect(result.errors).toEqual([
      {
        error: 'Evaluation failed',
        phase: 'TEST_PIPELINE',
      },
    ]);
    expect(result.data).toEqual({
      gathered: true,
      candidateActions: [{ id: 'cand-1' }],
      evaluation: 'needs review',
      finalized: true,
    });

    expect(loggerCalls.debug.map((entry) => entry.message)).toEqual([
      'Executing pipeline stage: GatherCandidates',
      'Executing pipeline stage: EvaluateCandidates',
      'Executing pipeline stage: Finalize',
      'Stage Finalize indicated to stop processing',
    ]);
    expect(loggerCalls.warn.map((entry) => entry.message)).toEqual([
      'Stage EvaluateCandidates completed with errors',
    ]);
    expect(loggerCalls.error).toHaveLength(0);

    expect(traceCalls.withSpanAsync).toEqual([
      { name: 'Pipeline', metadata: { stageCount: 4 } },
    ]);
    expect(traceCalls.step.map((entry) => entry.message)).toEqual([
      'Executing stage: GatherCandidates',
      'Executing stage: EvaluateCandidates',
      'Executing stage: Finalize',
    ]);
    expect(traceCalls.failure).toEqual([
      {
        message: 'Stage EvaluateCandidates encountered errors',
        source: 'Pipeline.execute',
      },
    ]);
    expect(traceCalls.success).toEqual([
      {
        message: 'Stage GatherCandidates completed successfully',
        source: 'Pipeline.execute',
      },
    ]);

    expect(
      traceCalls.info.map((entry) => ({ message: entry.message, source: entry.source }))
    ).toEqual([
      {
        message: 'Starting pipeline execution with 4 stages',
        source: 'Pipeline.execute',
      },
      {
        message: 'Pipeline halted at stage: Finalize',
        source: 'Pipeline.execute',
      },
      {
        message:
          'Pipeline execution completed. Actions: 2, Errors: 1',
        source: 'Pipeline.execute',
      },
    ]);
  });

  it('propagates errors when a stage throws and returns a merged failure result', async () => {
    const { logger, calls: loggerCalls } = createRecordingLogger();
    const { trace, calls: traceCalls } = createSimpleTraceRecorder();

    const stageOne = new TestStage('Prepare', async () => {
      return PipelineResult.success({
        actions: [{ id: 'prepared' }],
        data: { prepared: true },
      });
    });

    const stageTwoError = new Error('Kaboom');
    const stageTwo = new TestStage('Explode', async () => {
      throw stageTwoError;
    });

    const stageThree = new TestStage('ShouldSkip', async () => {
      throw new Error('Should not reach this stage');
    });

    const pipeline = new Pipeline([stageOne, stageTwo, stageThree], logger);

    const result = await pipeline.execute({
      actor: { id: 'actor-007' },
      actionContext: { scope: 'danger' },
      candidateActions: [],
      trace,
    });

    expect(stageOne.invocationCount).toBe(1);
    expect(stageTwo.invocationCount).toBe(1);
    expect(stageThree.invocationCount).toBe(0);

    expect(result.success).toBe(false);
    expect(result.actions).toEqual([{ id: 'prepared' }]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      error: 'Kaboom',
      phase: 'PIPELINE_EXECUTION',
      stageName: 'Explode',
      context: { error: stageTwoError.stack },
    });
    expect(result.data).toEqual({ prepared: true });
    expect(result.continueProcessing).toBe(false);

    expect(loggerCalls.debug.map((entry) => entry.message)).toEqual([
      'Executing pipeline stage: Prepare',
      'Executing pipeline stage: Explode',
    ]);
    expect(loggerCalls.error).toEqual([
      {
        message: 'Pipeline stage Explode threw an error: Kaboom',
        args: [stageTwoError],
      },
    ]);
    expect(loggerCalls.warn).toHaveLength(0);

    expect(traceCalls.step.map((entry) => entry.message)).toEqual([
      'Executing stage: Prepare',
      'Executing stage: Explode',
    ]);
    expect(traceCalls.success).toEqual([
      {
        message: 'Stage Prepare completed successfully',
        source: 'Pipeline.execute',
      },
    ]);
    expect(traceCalls.failure).toEqual([
      {
        message: 'Stage Explode threw an error: Kaboom',
        source: 'Pipeline.execute',
      },
    ]);
    expect(traceCalls.info.map((entry) => entry.message)).toEqual([
      'Starting pipeline execution with 3 stages',
    ]);
  });
});
