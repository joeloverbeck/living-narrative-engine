/**
 * @file Integration tests for the Pipeline using real stage implementations.
 * @description Validates end-to-end execution semantics of the Pipeline with PipelineResult
 * combinations, logger interactions, and optional tracing behaviour.
 */

import { describe, it, expect } from '@jest/globals';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';

class CollectingLogger {
  constructor() {
    this.debugMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message) {
    this.debugMessages.push(message);
  }

  warn(message) {
    this.warnMessages.push(message);
  }

  error(message, error) {
    this.errorMessages.push({ message, error });
  }
}

class TraceRecorder {
  constructor({ withSpan = false } = {}) {
    this.infoEvents = [];
    this.successEvents = [];
    this.failureEvents = [];
    this.stepEvents = [];
    this.dataEvents = [];
    this.spanCalls = [];
    this.withSpan = withSpan;
    if (!this.withSpan) {
      this.withSpanAsync = undefined;
    }
  }

  info(message, source, data) {
    this.infoEvents.push({ message, source, data });
  }

  success(message, source, data) {
    this.successEvents.push({ message, source, data });
  }

  failure(message, source, data) {
    this.failureEvents.push({ message, source, data });
  }

  step(message, source, data) {
    this.stepEvents.push({ message, source, data });
  }

  data(message, source, data) {
    this.dataEvents.push({ message, source, data });
  }

  withSpanAsync(operation, fn, attributes = {}) {
    if (!this.withSpan) {
      throw new Error(
        'withSpanAsync should not be called when span support disabled'
      );
    }
    this.spanCalls.push({ operation, attributes });
    return fn();
  }
}

describe('Pipeline integration with real stages', () => {
  class Stage {
    constructor(name, executeImpl) {
      this.name = name;
      this.execute = executeImpl;
    }
  }

  it('executes sequential stages, merging context and emitting trace information', async () => {
    const logger = new CollectingLogger();
    const trace = new TraceRecorder();
    const contexts = [];

    const stage1 = new Stage('StageOne', async (context) => {
      contexts.push({ stage: 'one', context });
      return PipelineResult.success({
        actions: [{ id: 'alpha' }],
        data: { fromStageOne: true },
      });
    });

    const stage2 = new Stage('StageTwo', async (context) => {
      contexts.push({ stage: 'two', context });
      expect(context.actions).toHaveLength(1);
      expect(context.fromStageOne).toBe(true);
      return PipelineResult.success({
        actions: [{ id: 'beta' }],
        errors: [{ code: 'WARN', message: 'minor issue' }],
        data: { fromStageTwo: true },
      });
    });

    const stage3 = new Stage('StageThree', async (context) => {
      contexts.push({ stage: 'three', context });
      expect(context.actions).toHaveLength(2);
      expect(context.errors).toHaveLength(1);
      expect(context.fromStageTwo).toBe(true);
      return PipelineResult.success({
        data: { finalised: true },
      });
    });

    const pipeline = new Pipeline([stage1, stage2, stage3], logger);
    const initialContext = {
      actor: { id: 'actor-1' },
      actionContext: { intent: 'test' },
      candidateActions: [],
      trace,
    };

    const result = await pipeline.execute(initialContext);

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.data.finalised).toBe(true);
    expect(logger.debugMessages).toContain(
      'Executing pipeline stage: StageOne'
    );
    expect(logger.debugMessages).toContain(
      'Executing pipeline stage: StageThree'
    );
    expect(trace.infoEvents[0].message).toContain(
      'Starting pipeline execution'
    );
    expect(
      trace.successEvents.some((event) =>
        event.message.includes('Stage StageThree completed successfully')
      )
    ).toBe(true);
    expect(trace.infoEvents.at(-1).message).toContain(
      'Pipeline execution completed. Actions: 2, Errors: 1'
    );
    expect(contexts.map((entry) => entry.stage)).toEqual([
      'one',
      'two',
      'three',
    ]);
  });

  it('wraps execution in a span when trace.withSpanAsync is available', async () => {
    const logger = new CollectingLogger();
    const trace = new TraceRecorder({ withSpan: true });

    const stage = new Stage('SpanAwareStage', async () =>
      PipelineResult.success()
    );
    const pipeline = new Pipeline([stage], logger);

    await pipeline.execute({
      actor: { id: 'actor-2' },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(trace.spanCalls).toHaveLength(1);
    expect(trace.spanCalls[0].operation).toBe('Pipeline');
    expect(trace.spanCalls[0].attributes.stageCount).toBe(1);
  });

  it('halts processing when a stage requests to stop continuation', async () => {
    const logger = new CollectingLogger();
    const trace = new TraceRecorder();
    const executedStages = [];

    const haltingStage = new Stage('HaltingStage', async () => {
      executedStages.push('halt');
      return PipelineResult.success({ continueProcessing: false });
    });

    const skippedStage = new Stage('SkippedStage', async () => {
      executedStages.push('skip');
      return PipelineResult.success();
    });

    const pipeline = new Pipeline([haltingStage, skippedStage], logger);
    const result = await pipeline.execute({
      actor: { id: 'actor-3' },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(true);
    expect(executedStages).toEqual(['halt']);
    expect(logger.debugMessages).toContain(
      'Executing pipeline stage: HaltingStage'
    );
    expect(logger.debugMessages).toContain(
      'Stage HaltingStage indicated to stop processing'
    );
    expect(
      trace.infoEvents.some((event) =>
        event.message.includes('Pipeline halted at stage: HaltingStage')
      )
    ).toBe(true);
  });

  it('records warnings for stages that report failure but allow continuation', async () => {
    const logger = new CollectingLogger();
    const trace = new TraceRecorder();

    const warningStage = new Stage(
      'WarningStage',
      async () =>
        new PipelineResult({
          success: false,
          errors: [{ code: 'FAIL', message: 'Stage incomplete' }],
          continueProcessing: true,
        })
    );

    const finalStage = new Stage('FinalStage', async (context) => {
      expect(context.errors).toHaveLength(1);
      return PipelineResult.success();
    });

    const pipeline = new Pipeline([warningStage, finalStage], logger);
    const result = await pipeline.execute({
      actor: { id: 'actor-4' },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(logger.warnMessages).toContain(
      'Stage WarningStage completed with errors'
    );
    expect(
      trace.failureEvents.some((event) =>
        event.message.includes('Stage WarningStage encountered errors')
      )
    ).toBe(true);
  });

  it('merges prior results when a stage throws an error', async () => {
    const logger = new CollectingLogger();
    const trace = new TraceRecorder();

    const initialStage = new Stage('InitialStage', async () =>
      PipelineResult.success({ actions: [{ id: 'prepared' }] })
    );

    const failingStage = new Stage('FailingStage', async () => {
      throw new Error('Stage failure');
    });

    const pipeline = new Pipeline([initialStage, failingStage], logger);
    const result = await pipeline.execute({
      actor: { id: 'actor-5' },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.actions).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].stageName).toBe('FailingStage');
    expect(logger.errorMessages[0].message).toContain(
      'Pipeline stage FailingStage threw an error: Stage failure'
    );
    expect(
      trace.failureEvents.some((event) =>
        event.message.includes(
          'Stage FailingStage threw an error: Stage failure'
        )
      )
    ).toBe(true);
  });

  it('throws if constructed without a valid stages array', () => {
    const logger = new CollectingLogger();

    expect(() => new Pipeline([], logger)).toThrow(
      'Pipeline requires at least one stage'
    );
    expect(() => new Pipeline('not-an-array', logger)).toThrow(
      'Pipeline requires at least one stage'
    );
  });
});
