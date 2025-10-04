/**
 * @file Integration tests for the Pipeline module to ensure stage coordination and error handling.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';

class RecordingStage extends PipelineStage {
  constructor(name, handler) {
    super(name);
    this.handler = handler;
    this.calls = [];
  }

  async executeInternal(context) {
    this.calls.push(context);
    return this.handler(context);
  }
}

describe('Pipeline integration', () => {
  let logger;
  let trace;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    trace = {
      recordedSpans: [],
      steps: [],
      infos: [],
      successes: [],
      failures: [],
      withSpanAsync: jest.fn(async (name, executor, metadata) => {
        trace.recordedSpans.push({ name, metadata });
        return executor();
      }),
      step: jest.fn((message) => trace.steps.push(message)),
      info: jest.fn((message) => trace.infos.push(message)),
      success: jest.fn((message) => trace.successes.push(message)),
      failure: jest.fn((message) => trace.failures.push(message)),
    };
  });

  it('validates that at least one stage is provided', () => {
    expect(() => new Pipeline([], logger)).toThrow(
      'Pipeline requires at least one stage'
    );
  });

  it('executes stages sequentially, merges their results, and reports via structured tracing', async () => {
    const stageOne = new RecordingStage('ComponentFiltering', () =>
      PipelineResult.success({
        actions: [{ id: 'alpha' }],
        data: { stageOne: true },
      })
    );

    const stageTwo = new RecordingStage('Formatting', (context) => {
      expect(context.stageOne).toBe(true);
      expect(context.actions).toHaveLength(1);

      return PipelineResult.success({
        actions: [{ id: 'beta' }],
        errors: [{ message: 'minor' }],
        data: { stageTwo: true },
      });
    });

    const pipeline = new Pipeline([stageOne, stageTwo], logger);

    const result = await pipeline.execute({
      actor: { id: 'actor-1' },
      actionContext: { mood: 'curious' },
      candidateActions: [],
      trace,
    });

    expect(trace.withSpanAsync).toHaveBeenCalledTimes(1);
    expect(trace.recordedSpans[0]).toEqual({
      name: 'Pipeline',
      metadata: { stageCount: 2 },
    });

    expect(stageOne.calls).toHaveLength(1);
    expect(stageTwo.calls).toHaveLength(1);

    expect(result.success).toBe(true);
    expect(result.actions).toEqual([
      { id: 'alpha' },
      { id: 'beta' },
    ]);
    expect(result.errors).toEqual([{ message: 'minor' }]);
    expect(result.data).toMatchObject({ stageOne: true, stageTwo: true });

    expect(trace.success).toHaveBeenCalled();
    expect(trace.info).toHaveBeenCalledWith(
      expect.stringContaining('Pipeline execution completed.'),
      'Pipeline.execute'
    );
  });

  it('stops processing when a stage requests termination and logs the halt', async () => {
    const stageOne = new RecordingStage('ComponentFiltering', () =>
      PipelineResult.success({
        data: { ready: true },
        continueProcessing: false,
      })
    );

    const stageTwo = new RecordingStage('Formatting', () =>
      PipelineResult.success({
        actions: [{ id: 'gamma' }],
      })
    );

    const pipeline = new Pipeline([stageOne, stageTwo], logger);

    const result = await pipeline.execute({
      actor: { id: 'actor-2' },
      actionContext: {},
      candidateActions: [],
    });

    expect(stageTwo.calls).toHaveLength(0);
    expect(logger.debug).toHaveBeenCalledWith(
      'Stage ComponentFiltering indicated to stop processing'
    );
    expect(result.success).toBe(true);
    expect(result.actions).toEqual([]);
    expect(result.data).toEqual({ ready: true });
  });

  it('logs warnings and continues when a stage reports errors but allows further processing', async () => {
    const failingStage = new RecordingStage('PrerequisiteEvaluation', () =>
      new PipelineResult({
        success: false,
        errors: [{ message: 'prerequisite failed' }],
        continueProcessing: true,
      })
    );

    const recoveryStage = new RecordingStage('Formatting', () =>
      PipelineResult.success({ actions: [{ id: 'recovered' }] })
    );

    const pipeline = new Pipeline([failingStage, recoveryStage], logger);

    const result = await pipeline.execute({
      actor: { id: 'actor-4' },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'Stage PrerequisiteEvaluation completed with errors'
    );
    expect(trace.failure).toHaveBeenCalledWith(
      'Stage PrerequisiteEvaluation encountered errors',
      'Pipeline.execute'
    );
    expect(recoveryStage.calls).toHaveLength(1);
    expect(result.success).toBe(false);
    expect(result.errors).toEqual([{ message: 'prerequisite failed' }]);
    expect(result.actions).toEqual([{ id: 'recovered' }]);
  });

  it('captures thrown stage errors, logs them, and returns a failure PipelineResult', async () => {
    const stageOne = new RecordingStage('ComponentFiltering', () =>
      PipelineResult.success({
        actions: [{ id: 'delta' }],
      })
    );

    const stageTwo = new RecordingStage('Formatting', () => {
      throw new Error('formatting exploded');
    });

    const pipeline = new Pipeline([stageOne, stageTwo], logger);

    const result = await pipeline.execute({
      actor: { id: 'actor-3' },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Pipeline stage Formatting threw an error: formatting exploded'),
      expect.any(Error)
    );

    expect(trace.failure).toHaveBeenCalledWith(
      expect.stringContaining('Formatting'),
      'Pipeline.execute'
    );

    expect(result.success).toBe(false);
    expect(result.actions).toEqual([{ id: 'delta' }]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      error: 'formatting exploded',
      phase: 'PIPELINE_EXECUTION',
      stageName: 'Formatting',
    });
  });
});
