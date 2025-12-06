/**
 * @file Integration tests exercising the real Pipeline orchestration.
 * @description Verifies stage coordination, trace wrapping, and error handling
 *              without mocking the pipeline or stage implementations.
 */

import { describe, it, expect } from '@jest/globals';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';

class TestLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message, extra) {
    this.debugMessages.push({ message, extra });
  }

  info(message, extra) {
    this.infoMessages.push({ message, extra });
  }

  warn(message, extra) {
    this.warnMessages.push({ message, extra });
  }

  error(message, extra) {
    this.errorMessages.push({ message, extra });
  }
}

class RecordingStage extends PipelineStage {
  constructor(name, handler) {
    super(name);
    this._handler = handler;
  }

  async executeInternal(context) {
    return this._handler(context);
  }
}

describe('Pipeline integration', () => {
  const baseContext = {
    actor: { id: 'actor-1' },
    actionContext: { mood: 'focused' },
    candidateActions: [{ id: 'alpha' }],
  };

  it('executes stages sequentially and merges their outputs', async () => {
    const logger = new TestLogger();
    const stageOrder = [];

    const stageA = new RecordingStage('StageA', (context) => {
      stageOrder.push({ name: 'StageA', context });
      expect(context.actions).toBeUndefined();
      return PipelineResult.success({
        actions: [{ id: 'A1' }],
        data: { stageData: ['stageA'] },
      });
    });

    const stageB = new RecordingStage('StageB', (context) => {
      stageOrder.push({ name: 'StageB', context });
      expect(context.actions).toHaveLength(1);
      return PipelineResult.success({
        actions: [{ id: 'B1' }],
        errors: [{ message: 'warning', stageName: 'StageB' }],
        data: { stageData: [...context.stageData, 'stageB'] },
      });
    });

    const stageC = new RecordingStage('StageC', (context) => {
      stageOrder.push({ name: 'StageC', context });
      expect(context.actions).toHaveLength(2);
      return PipelineResult.success({
        data: { stageData: [...context.stageData, 'stageC'] },
      });
    });

    const pipeline = new Pipeline([stageA, stageB, stageC], logger);

    const result = await pipeline.execute({ ...baseContext });

    expect(result.success).toBe(true);
    expect(result.actions).toEqual([{ id: 'A1' }, { id: 'B1' }]);
    expect(result.errors).toEqual([
      { message: 'warning', stageName: 'StageB' },
    ]);
    expect(result.data).toEqual({ stageData: ['stageA', 'stageB', 'stageC'] });
    expect(stageOrder.map((entry) => entry.name)).toEqual([
      'StageA',
      'StageB',
      'StageC',
    ]);

    // Logger should record each stage execution
    expect(logger.debugMessages.some((log) => /StageA/.test(log.message))).toBe(
      true
    );
    expect(logger.debugMessages.some((log) => /StageB/.test(log.message))).toBe(
      true
    );
    expect(logger.debugMessages.some((log) => /StageC/.test(log.message))).toBe(
      true
    );
  });

  it('stops processing when a stage returns continueProcessing=false', async () => {
    const logger = new TestLogger();
    const visitedStages = [];

    const stageA = new RecordingStage('StageA', (context) => {
      visitedStages.push('StageA');
      return PipelineResult.success({
        data: { visited: ['A'] },
      });
    });

    const stageB = new RecordingStage('StageB', (context) => {
      visitedStages.push('StageB');
      return PipelineResult.success({
        data: { visited: [...context.visited, 'B'] },
        continueProcessing: false,
      });
    });

    const stageC = new RecordingStage('StageC', () => {
      visitedStages.push('StageC');
      return PipelineResult.success();
    });

    const pipeline = new Pipeline([stageA, stageB, stageC], logger);
    const result = await pipeline.execute({ ...baseContext });

    expect(result.success).toBe(true);
    expect(visitedStages).toEqual(['StageA', 'StageB']);
    expect(result.data).toEqual({ visited: ['A', 'B'] });
  });

  it('returns failure result when a stage throws', async () => {
    const logger = new TestLogger();

    const stageA = new RecordingStage('StageA', () => PipelineResult.success());
    const failingStage = new RecordingStage('FailingStage', () => {
      throw new Error('boom');
    });

    const pipeline = new Pipeline([stageA, failingStage], logger);
    const result = await pipeline.execute({ ...baseContext });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      error: 'boom',
      stageName: 'FailingStage',
      phase: 'PIPELINE_EXECUTION',
    });
    expect(logger.errorMessages[0].message).toMatch(/FailingStage/);
  });

  it('wraps execution in a trace span when provided', async () => {
    const logger = new TestLogger();
    const calls = [];
    const traceEvents = [];

    const trace = {
      withSpanAsync: async (name, executor, metadata) => {
        calls.push({ name, metadata });
        return executor();
      },
      info(message, source, extra) {
        traceEvents.push({ type: 'info', message, source, extra });
      },
      step(message, source, extra) {
        traceEvents.push({ type: 'step', message, source, extra });
      },
      success(message, source, extra) {
        traceEvents.push({ type: 'success', message, source, extra });
      },
      failure(message, source, extra) {
        traceEvents.push({ type: 'failure', message, source, extra });
      },
    };

    const stage = new RecordingStage('StageA', (context) => {
      expect(context.trace).toBe(trace);
      return PipelineResult.success({ data: { traced: true } });
    });

    const pipeline = new Pipeline([stage], logger);
    const result = await pipeline.execute({ ...baseContext, trace });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ traced: true });
    expect(calls).toEqual([
      {
        name: 'Pipeline',
        metadata: { stageCount: 1 },
      },
    ]);
    expect(traceEvents.some((event) => event.type === 'info')).toBe(true);
  });
});
