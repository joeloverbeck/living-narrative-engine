/**
 * @file Integration tests for the Pipeline module exercising real stage flows.
 */

import { describe, it, expect } from '@jest/globals';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';

class RecordingLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message) {
    this.debugMessages.push(message);
  }

  info(message) {
    this.infoMessages.push(message);
  }

  warn(message) {
    this.warnMessages.push(message);
  }

  error(message, error) {
    this.errorMessages.push({ message, error });
  }
}

class RecordingSpan {
  constructor(name, attributes = {}) {
    this.name = name;
    this.initialAttributes = attributes;
    this.attributes = [];
    this.error = null;
    this.status = null;
    this.ended = false;
  }

  setAttribute(key, value) {
    this.attributes.push({ key, value });
  }

  setError(error) {
    this.error = error;
  }

  setStatus(status) {
    this.status = status;
  }

  end() {
    this.ended = true;
  }
}

class RecordingTrace {
  constructor({
    enableWithSpanAsync = false,
    enableStructuredSpans = false,
    spanFactory = null,
  } = {}) {
    this.steps = [];
    this.infos = [];
    this.successes = [];
    this.failures = [];
    this.withSpanCalls = [];
    this.startedSpans = [];
    this.endedSpans = [];
    this.spanFactory = spanFactory;

    if (enableWithSpanAsync) {
      this.withSpanAsync = async (name, fn, metadata) => {
        this.withSpanCalls.push({ name, metadata });
        return fn();
      };
    }

    if (enableStructuredSpans) {
      this.startSpan = (name, attributes) => {
        const span =
          (typeof this.spanFactory === 'function' &&
            this.spanFactory(name, attributes)) ||
          new RecordingSpan(name, attributes);
        this.startedSpans.push({ name, attributes, span });
        return span;
      };
      this.endSpan = (span) => {
        if (typeof span.end === 'function') {
          span.end();
        }
        this.endedSpans.push(span);
      };
    }
  }

  step(message, source) {
    this.steps.push({ message, source });
  }

  info(message, source) {
    this.infos.push({ message, source });
  }

  success(message, source) {
    this.successes.push({ message, source });
  }

  failure(message, source) {
    this.failures.push({ message, source });
  }
}

class RecordingStage extends PipelineStage {
  constructor(name, handler) {
    super(name);
    this.handler = handler;
    this.invocations = [];
  }

  async executeInternal(context) {
    this.invocations.push(context);
    return this.handler(context, this);
  }
}

describe('Pipeline integration with real stage implementations', () => {
  it('executes stages sequentially with async trace wrapper and merges results', async () => {
    const logger = new RecordingLogger();
    const trace = new RecordingTrace({ enableWithSpanAsync: true });

    const stageOne = new RecordingStage('StageOne', async (context) => {
      const result = PipelineResult.success({
        actions: [{ id: 'stage-one-action' }],
        errors: [{ message: 'recoverable' }],
        data: { stageOne: context.actor.id },
      });
      result.processedCount = 1;
      return result;
    });

    const stageTwo = new RecordingStage('StageTwo', async (context) => {
      expect(context.stageOne).toBe('actor-1');
      expect(context.actions).toHaveLength(1);
      const result = PipelineResult.success({
        actions: [{ id: 'stage-two-action' }],
        data: { stageTwo: context.actionContext.mood },
      });
      result.processedCount = 2;
      return result;
    });

    const pipeline = new Pipeline([stageOne, stageTwo], logger);

    const result = await pipeline.execute({
      actor: { id: 'actor-1' },
      actionContext: { mood: 'focused' },
      candidateActions: [{ id: 'candidate-1' }],
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.actions).toEqual([
      { id: 'stage-one-action' },
      { id: 'stage-two-action' },
    ]);
    expect(result.errors).toEqual([{ message: 'recoverable' }]);
    expect(result.data).toEqual({ stageOne: 'actor-1', stageTwo: 'focused' });

    expect(trace.withSpanCalls).toEqual([
      { name: 'Pipeline', metadata: { stageCount: 2 } },
    ]);
    expect(trace.steps.map((entry) => entry.message)).toEqual([
      'Executing stage: StageOne',
      'Executing stage: StageTwo',
    ]);
    expect(trace.successes.map((entry) => entry.message)).toEqual([
      'Stage StageOne completed successfully',
      'Stage StageTwo completed successfully',
    ]);
    expect(logger.debugMessages).toEqual([
      'Executing pipeline stage: StageOne',
      'Executing pipeline stage: StageTwo',
    ]);
    expect(
      logger.infoMessages.at(-1)?.message || logger.infoMessages.at(-1)
    ).toBeUndefined();
    expect(trace.infos.at(-1)).toEqual({
      message: 'Pipeline execution completed. Actions: 2, Errors: 1',
      source: 'Pipeline.execute',
    });
  });

  it('halts execution when a stage disables further processing', async () => {
    const logger = new RecordingLogger();
    const trace = new RecordingTrace();

    const haltingStage = new RecordingStage('HaltingStage', async () => {
      return new PipelineResult({
        success: true,
        data: { halted: true },
        continueProcessing: false,
      });
    });

    const skippedStage = new RecordingStage('SkippedStage', async () => {
      throw new Error('This stage should not execute');
    });

    const pipeline = new Pipeline([haltingStage, skippedStage], logger);
    const result = await pipeline.execute({
      actor: { id: 'actor-2' },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.continueProcessing).toBe(false);
    expect(haltingStage.invocations).toHaveLength(1);
    expect(skippedStage.invocations).toHaveLength(0);
    expect(logger.debugMessages).toContain(
      'Stage HaltingStage indicated to stop processing'
    );
    expect(trace.infos).toContainEqual({
      message: 'Pipeline halted at stage: HaltingStage',
      source: 'Pipeline.execute',
    });
  });

  it('logs failures while continuing when a stage returns non-success', async () => {
    const logger = new RecordingLogger();
    const trace = new RecordingTrace();

    const failingStage = new RecordingStage('FailingStage', async () => {
      return new PipelineResult({
        success: false,
        errors: [
          {
            error: 'stage failure',
            stageName: 'FailingStage',
          },
        ],
        data: { attempted: true },
        continueProcessing: true,
      });
    });

    const recoveringStage = new RecordingStage(
      'RecoveringStage',
      async (context) => {
        expect(context.attempted).toBe(true);
        return PipelineResult.success({
          actions: [{ id: 'recovered-action' }],
          data: { recovered: true },
        });
      }
    );

    const pipeline = new Pipeline([failingStage, recoveringStage], logger);
    const result = await pipeline.execute({
      actor: { id: 'actor-3' },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      {
        error: 'stage failure',
        stageName: 'FailingStage',
      },
    ]);
    expect(result.actions).toEqual([{ id: 'recovered-action' }]);
    expect(logger.warnMessages).toContain(
      'Stage FailingStage completed with errors'
    );
    expect(trace.failures).toContainEqual({
      message: 'Stage FailingStage encountered errors',
      source: 'Pipeline.execute',
    });
    expect(trace.successes).toContainEqual({
      message: 'Stage RecoveringStage completed successfully',
      source: 'Pipeline.execute',
    });
  });

  it('returns an aggregated failure when a stage throws an exception', async () => {
    const logger = new RecordingLogger();
    const trace = new RecordingTrace({ enableWithSpanAsync: true });

    const successfulStage = new RecordingStage('SuccessfulStage', async () => {
      return PipelineResult.success({
        actions: [{ id: 'safe-action' }],
      });
    });

    const crashingStage = new RecordingStage('CrashingStage', async () => {
      throw new Error('boom');
    });

    const pipeline = new Pipeline([successfulStage, crashingStage], logger);
    const result = await pipeline.execute({
      actor: { id: 'actor-4' },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.actions).toEqual([{ id: 'safe-action' }]);
    expect(result.errors).toEqual([
      {
        error: 'boom',
        phase: 'PIPELINE_EXECUTION',
        stageName: 'CrashingStage',
        context: expect.objectContaining({ error: expect.any(String) }),
      },
    ]);
    expect(logger.errorMessages[0].message).toBe(
      'Pipeline stage CrashingStage threw an error: boom'
    );
    expect(logger.errorMessages[0].error).toBeInstanceOf(Error);
    expect(trace.failures).toContainEqual({
      message: 'Stage CrashingStage threw an error: boom',
      source: 'Pipeline.execute',
    });
  });

  it('records structured span attributes and integrates PipelineResult helpers', async () => {
    const logger = new RecordingLogger();
    const trace = new RecordingTrace({ enableStructuredSpans: true });

    const structuredStage = new RecordingStage(
      'StructuredStage',
      async (context) => {
        let result = PipelineResult.fromActionResult(
          ActionResult.success({ structured: true })
        );
        result.errors = [{ message: 'minor warning' }];
        const finalResult = result.chainActionResult(() =>
          ActionResult.success({ derived: context.actionContext.flag })
        );
        finalResult.processedCount = 3;
        return finalResult;
      }
    );

    const failingStage = new RecordingStage('TerminalStage', async () => {
      const failure = ActionResult.failure(new Error('structured failure'));
      return PipelineResult.fromActionResult(failure, { stage: 'terminal' });
    });

    const pipeline = new Pipeline([structuredStage, failingStage], logger);
    const result = await pipeline.execute({
      actor: { id: 'actor-5' },
      actionContext: { flag: 'value-from-context' },
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.data).toEqual({
      structured: true,
      derived: 'value-from-context',
      stage: 'terminal',
    });
    expect(result.errors.some((entry) => entry instanceof Error)).toBe(true);

    const [firstSpanEntry, secondSpanEntry] = trace.startedSpans;
    expect(firstSpanEntry.name).toBe('StructuredStageStage');
    expect(firstSpanEntry.span.attributes).toEqual([
      { key: 'success', value: true },
      { key: 'processedCount', value: 3 },
      { key: 'errorCount', value: 1 },
    ]);
    expect(firstSpanEntry.span.status).toBe('success');

    expect(secondSpanEntry.name).toBe('TerminalStageStage');
    expect(secondSpanEntry.span.error).toBeInstanceOf(Error);
    expect(secondSpanEntry.span.error.message).toBe('Stage execution failed');
    expect(trace.endedSpans.every((span) => span.ended)).toBe(true);
  });
  it('enforces that PipelineStage cannot be instantiated directly', () => {
    expect(() => new PipelineStage('InvalidBase')).toThrow(
      'PipelineStage is an abstract class and cannot be instantiated directly'
    );
  });

  it('reports missing executeInternal implementations as pipeline failures', async () => {
    class IncompleteStage extends PipelineStage {
      constructor() {
        super('IncompleteStage');
      }
    }

    const logger = new RecordingLogger();
    const trace = new RecordingTrace();
    const pipeline = new Pipeline([new IncompleteStage()], logger);

    const result = await pipeline.execute({
      actor: { id: 'actor-6' },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.errors[0].error).toBe(
      'Stage IncompleteStage must implement executeInternal() method'
    );
    expect(logger.errorMessages[0].message).toBe(
      'Pipeline stage IncompleteStage threw an error: Stage IncompleteStage must implement executeInternal() method'
    );
  });

  it('captures thrown errors within structured spans', async () => {
    class ThrowingStructuredStage extends PipelineStage {
      constructor() {
        super('ThrowingStructuredStage');
      }

      async executeInternal() {
        throw new Error('structured explosion');
      }
    }

    const logger = new RecordingLogger();
    const trace = new RecordingTrace({ enableStructuredSpans: true });
    const pipeline = new Pipeline([new ThrowingStructuredStage()], logger);

    const result = await pipeline.execute({
      actor: { id: 'actor-7' },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.errors[0].error).toBe('structured explosion');

    const [spanEntry] = trace.startedSpans;
    expect(spanEntry.span.error).toBeInstanceOf(Error);
    expect(spanEntry.span.error.message).toBe('structured explosion');
    expect(trace.endedSpans[0].ended).toBe(true);
  });

  it('gracefully handles structured spans without attribute helpers', async () => {
    const spanFactory = (name, attributes) => ({
      name,
      attributes,
      setError(error) {
        this.error = error;
      },
      setStatus(status) {
        this.status = status;
      },
    });

    const logger = new RecordingLogger();
    const trace = new RecordingTrace({
      enableStructuredSpans: true,
      spanFactory,
    });
    const attributeOptionalStage = new RecordingStage(
      'AttributeOptionalStage',
      async () => {
        return PipelineResult.success({
          data: { finished: true },
          errors: [],
        });
      }
    );

    const pipeline = new Pipeline([attributeOptionalStage], logger);
    const result = await pipeline.execute({
      actor: null,
      actionContext: {},
      candidateActions: undefined,
      trace,
    });

    expect(result.success).toBe(true);
    const [spanEntry] = trace.startedSpans;
    expect(spanEntry.span.setAttribute).toBeUndefined();
    expect(spanEntry.span.status).toBe('success');
  });

  it('normalizes failure inputs and preserves errors when chaining results', async () => {
    const logger = new RecordingLogger();
    const trace = new RecordingTrace();

    const failureStage = new RecordingStage('FailureStage', async () => {
      const baseFailure = PipelineResult.failure('string-error');
      const chainedFailure = baseFailure.chainActionResult(() =>
        ActionResult.failure(new Error('secondary failure'))
      );
      return chainedFailure;
    });

    const pipeline = new Pipeline([failureStage], logger);
    const result = await pipeline.execute({
      actor: { id: 'actor-9' },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['string-error']);
  });

  it('propagates ActionResult failures through chainActionResult', async () => {
    const logger = new RecordingLogger();
    const trace = new RecordingTrace();

    const chainFailureStage = new RecordingStage(
      'ChainFailureStage',
      async () => {
        const initial = PipelineResult.success({ data: { initial: true } });
        const chained = initial.chainActionResult(() =>
          ActionResult.failure(new Error('action failure'))
        );
        return chained;
      }
    );

    const pipeline = new Pipeline([chainFailureStage], logger);
    const result = await pipeline.execute({
      actor: { id: 'actor-10' },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.errors[0]).toBeInstanceOf(Error);
    expect(result.errors[0].message).toBe('action failure');
    expect(result.data).toEqual({ initial: true });
  });

  it('records structured spans for success results without error metadata', async () => {
    const logger = new RecordingLogger();
    const trace = new RecordingTrace({ enableStructuredSpans: true });
    const cleanStage = new RecordingStage('CleanStructuredStage', async () => {
      const result = PipelineResult.success({ data: { clean: true } });
      result.processedCount = 1;
      return result;
    });

    const pipeline = new Pipeline([cleanStage], logger);
    const result = await pipeline.execute({
      actor: { id: 'actor-11' },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(true);
    const [spanEntry] = trace.startedSpans;
    expect(spanEntry.span.attributes).toEqual([
      { key: 'success', value: true },
      { key: 'processedCount', value: 1 },
    ]);
    expect(spanEntry.span.status).toBe('success');
  });
});
