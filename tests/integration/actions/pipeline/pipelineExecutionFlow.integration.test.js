import { describe, it, expect } from '@jest/globals';

import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';

class RecordingLogger {
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

  error(message) {
    this.errorMessages.push(message);
  }
}

class RecordingSpan {
  constructor(name) {
    this.name = name;
    this.attributes = {};
    this.status = 'pending';
    this.error = null;
  }

  setAttribute(key, value) {
    this.attributes[key] = value;
  }

  setError(error) {
    this.error = error;
    this.status = 'error';
  }

  setStatus(status) {
    this.status = status;
  }
}

class RecordingTrace {
  constructor({ includePipelineSpan = true } = {}) {
    this.events = [];

    if (includePipelineSpan) {
      this.withSpanAsync = async (name, fn, attributes) => {
        this.events.push({ type: 'withSpanAsync:start', name, attributes });
        try {
          const result = await fn();
          this.events.push({ type: 'withSpanAsync:success', name });
          return result;
        } catch (error) {
          this.events.push({ type: 'withSpanAsync:error', name, error });
          throw error;
        }
      };
    }
  }

  startSpan(name, attributes) {
    const span = new RecordingSpan(name);
    this.events.push({ type: 'span:start', name, attributes });
    return span;
  }

  endSpan(span) {
    this.events.push({
      type: 'span:end',
      name: span.name,
      status: span.status,
      error: span.error ? span.error.message : null,
      attributes: span.attributes,
    });
  }

  info(message, source, metadata) {
    this.events.push({ type: 'info', source, message, metadata });
  }

  step(message, source) {
    this.events.push({ type: 'step', source, message });
  }

  success(message, source) {
    this.events.push({ type: 'success', source, message });
  }

  failure(message, source) {
    this.events.push({ type: 'failure', source, message });
  }
}

describe('Pipeline integration flow', () => {
  it('requires at least one stage to be provided', () => {
    const logger = new RecordingLogger();

    expect(() => new Pipeline([], logger)).toThrow(
      'Pipeline requires at least one stage'
    );

    expect(() => new Pipeline(null, logger)).toThrow(
      'Pipeline requires at least one stage'
    );
  });

  it('executes stages sequentially, merges results, and halts when instructed', async () => {
    const logger = new RecordingLogger();
    const trace = new RecordingTrace();
    const executionOrder = [];

    class CollectCandidatesStage extends PipelineStage {
      constructor() {
        super('CollectCandidates');
        this.executionCount = 0;
      }

      async executeInternal(context) {
        this.executionCount += 1;
        executionOrder.push(this.name);

        const enrichedCandidates = context.candidateActions.map((action) => ({
          ...action,
          enriched: true,
        }));

        return PipelineResult.success({
          data: { candidateActions: enrichedCandidates, collected: true },
        });
      }
    }

    class FormatActionsStage extends PipelineStage {
      constructor() {
        super('FormatActions');
        this.executionCount = 0;
      }

      async executeInternal(context) {
        this.executionCount += 1;
        executionOrder.push(this.name);

        const formatted = context.candidateActions.map((action) => ({
          id: action.id,
          command: `${action.template} ${context.actor.id}`.trim(),
        }));

        return PipelineResult.success({
          actions: formatted,
          errors: [
            {
              error: 'non-fatal formatting warning',
              stageName: this.name,
            },
          ],
          data: { formatted: true },
        });
      }
    }

    class StopStage extends PipelineStage {
      constructor() {
        super('StopStage');
        this.executionCount = 0;
      }

      async executeInternal(context) {
        this.executionCount += 1;
        executionOrder.push(this.name);

        return PipelineResult.success({
          data: {
            stopReason: `halted after ${context.actions.length} actions`,
          },
          continueProcessing: false,
        });
      }
    }

    class ShouldNotRunStage extends PipelineStage {
      constructor() {
        super('ShouldNotRun');
        this.executionCount = 0;
      }

      async executeInternal() {
        this.executionCount += 1;
        executionOrder.push(this.name);
        throw new Error('This stage should never execute');
      }
    }

    const stages = [
      new CollectCandidatesStage(),
      new FormatActionsStage(),
      new StopStage(),
      new ShouldNotRunStage(),
    ];

    const pipeline = new Pipeline(stages, logger);

    const initialContext = {
      actor: { id: 'actor-1' },
      actionContext: { mood: 'curious' },
      candidateActions: [
        { id: 'core:wave', template: 'wave at' },
        { id: 'core:inspect', template: 'inspect' },
      ],
      trace,
    };

    const result = await pipeline.execute(initialContext);

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(2);
    expect(result.actions[0]).toEqual({
      id: 'core:wave',
      command: 'wave at actor-1',
    });
    expect(result.errors).toHaveLength(1);
    expect(result.data).toMatchObject({
      collected: true,
      formatted: true,
      stopReason: 'halted after 2 actions',
    });

    expect(executionOrder).toEqual([
      'CollectCandidates',
      'FormatActions',
      'StopStage',
    ]);
    expect(stages[3].executionCount).toBe(0);

    expect(logger.debugMessages).toEqual([
      'Executing pipeline stage: CollectCandidates',
      'Executing pipeline stage: FormatActions',
      'Executing pipeline stage: StopStage',
      'Stage StopStage indicated to stop processing',
    ]);

    const infoEvents = trace.events.filter((event) => event.type === 'info');
    expect(infoEvents[0].message).toContain('Starting pipeline execution');
    expect(infoEvents.at(-1).message).toContain('Pipeline execution completed');

    const spanEnds = trace.events.filter((event) => event.type === 'span:end');
    expect(spanEnds.map((span) => span.name)).toEqual([
      'CollectCandidatesStage',
      'FormatActionsStage',
      'StopStageStage',
    ]);
    expect(spanEnds[1].attributes.success).toBe(true);
  });

  it('merges failure results from stages and records warnings', async () => {
    const logger = new RecordingLogger();
    const trace = new RecordingTrace({ includePipelineSpan: false });

    class PassThroughStage extends PipelineStage {
      constructor() {
        super('PassThrough');
      }

      async executeInternal(context) {
        return PipelineResult.success({
          actions: [{ id: 'core:greet', command: `greet ${context.actor.id}` }],
        });
      }
    }

    class FailureStage extends PipelineStage {
      constructor() {
        super('FailureStage');
      }

      async executeInternal() {
        return new PipelineResult({
          success: false,
          errors: [
            {
              error: 'validation failed',
              stageName: this.name,
            },
          ],
          continueProcessing: true,
        });
      }
    }

    const pipeline = new Pipeline(
      [new PassThroughStage(), new FailureStage()],
      logger
    );

    const result = await pipeline.execute({
      actor: { id: 'actor-2' },
      actionContext: { mood: 'focused' },
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.actions).toEqual([
      { id: 'core:greet', command: 'greet actor-2' },
    ]);
    expect(result.errors).toEqual([
      { error: 'validation failed', stageName: 'FailureStage' },
    ]);

    expect(logger.warnMessages).toEqual([
      'Stage FailureStage completed with errors',
    ]);

    const failureEvents = trace.events.filter(
      (event) => event.type === 'failure'
    );
    expect(failureEvents).toEqual([
      {
        type: 'failure',
        source: 'Pipeline.execute',
        message: 'Stage FailureStage encountered errors',
      },
    ]);
  });

  it('captures thrown errors from stages and preserves previous results', async () => {
    const logger = new RecordingLogger();
    const trace = new RecordingTrace({ includePipelineSpan: false });

    class SuccessStage extends PipelineStage {
      constructor() {
        super('SuccessStage');
      }

      async executeInternal() {
        return PipelineResult.success({
          actions: [{ id: 'core:look', command: 'look around' }],
        });
      }
    }

    class ExplodingStage extends PipelineStage {
      constructor() {
        super('ExplodingStage');
      }

      async executeInternal() {
        throw new Error('unhandled explosion');
      }
    }

    const pipeline = new Pipeline(
      [new SuccessStage(), new ExplodingStage()],
      logger
    );

    const result = await pipeline.execute({
      actor: { id: 'actor-3' },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.actions).toEqual([
      { id: 'core:look', command: 'look around' },
    ]);
    expect(result.errors).toEqual([
      {
        error: 'unhandled explosion',
        phase: 'PIPELINE_EXECUTION',
        stageName: 'ExplodingStage',
        context: expect.objectContaining({ error: expect.any(String) }),
      },
    ]);

    expect(logger.errorMessages).toEqual([
      'Pipeline stage ExplodingStage threw an error: unhandled explosion',
    ]);

    const failureEvents = trace.events.filter(
      (event) => event.type === 'failure'
    );
    expect(failureEvents).toEqual([
      {
        type: 'failure',
        source: 'Pipeline.execute',
        message: 'Stage ExplodingStage threw an error: unhandled explosion',
      },
    ]);
  });
});
