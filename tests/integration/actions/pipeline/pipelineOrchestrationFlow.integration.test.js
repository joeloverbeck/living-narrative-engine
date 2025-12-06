/**
 * @file Integration tests exercising the core pipeline execution flow.
 * @description Validates how Pipeline, PipelineStage, PipelineResult, and ActionResult
 *              collaborate when real stage instances are executed in sequence.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';

/**
 * Minimal logger implementation used by the integration scenarios.
 */
const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

/**
 * Test actor used by the pipeline contexts.
 */
const actor = { id: 'actor-1' };

/**
 * Tracking helper reset before every scenario.
 */
let executionOrder;

beforeEach(() => {
  executionOrder = [];
  jest.clearAllMocks();
});

/**
 * Concrete PipelineStage that records execution order and returns a configured result.
 */
class RecordingStage extends PipelineStage {
  constructor(name, behaviour) {
    super(name);
    this.behaviour = behaviour;
  }

  async executeInternal(context) {
    executionOrder.push({ stage: this.name, contextSnapshot: { ...context } });
    return this.behaviour(context);
  }
}

describe('Pipeline orchestration integration flow', () => {
  it('requires at least one stage during construction', () => {
    expect(() => new Pipeline([], logger)).toThrow(
      'Pipeline requires at least one stage'
    );
  });

  it('executes stages sequentially, merges context data, and chains ActionResult payloads', async () => {
    const candidateStage = new RecordingStage('candidate', () => {
      const candidateActions = [
        {
          id: 'core:test',
          name: 'Test',
          command: 'test',
          description: 'Test action',
        },
      ];

      const baseResult = PipelineResult.success({
        actions: candidateActions,
        data: { candidateActions },
      });

      return baseResult.chainActionResult(() =>
        ActionResult.success({
          stage: 'candidate',
          processed: candidateActions.length,
        })
      );
    });

    const formatterStage = new RecordingStage('formatter', (context) => {
      const formattedActions = context.actions.map((action) => ({
        ...action,
        command: `${action.command}-formatted`,
      }));

      const formatResult = PipelineResult.success({
        actions: formattedActions,
        data: { formatted: true },
      });

      return formatResult.chainActionResult(({ formatted }) =>
        ActionResult.success({
          formatted,
          metadata: { formattedCount: formattedActions.length },
        })
      );
    });

    const pipeline = new Pipeline([candidateStage, formatterStage], logger);

    const result = await pipeline.execute({
      actor,
      actionContext: { scope: 'demo' },
      candidateActions: [],
    });

    expect(executionOrder.map((entry) => entry.stage)).toEqual([
      'candidate',
      'formatter',
    ]);
    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(2);
    expect(result.actions[0].command).toBe('test');
    expect(result.actions[1].command).toBe('test-formatted');
    expect(result.data).toMatchObject({
      candidateActions: [{ id: 'core:test' }],
      formatted: true,
      metadata: { formattedCount: 1 },
      stage: 'candidate',
      processed: 1,
    });
  });

  it('wraps stage execution in trace spans when tracing APIs are available', async () => {
    const spans = [];
    const trace = {
      startSpan: jest.fn(() => {
        const span = {
          setAttribute: jest.fn(),
          setStatus: jest.fn(),
          setError: jest.fn(),
        };
        spans.push(span);
        return span;
      }),
      endSpan: jest.fn(),
      info: jest.fn(),
      step: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
    };

    const successStage = new RecordingStage('trace-success', () =>
      PipelineResult.success({ data: { traced: true } })
    );

    const failureStage = new RecordingStage('trace-failure', () =>
      PipelineResult.failure([{ error: 'trace failure' }])
    );

    const pipeline = new Pipeline([successStage, failureStage], logger);

    const result = await pipeline.execute({
      actor,
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(trace.startSpan).toHaveBeenCalledTimes(2);
    expect(trace.endSpan).toHaveBeenCalledTimes(2);
    expect(spans[0].setStatus).toHaveBeenCalledWith('success');
    expect(spans[0].setAttribute).toHaveBeenCalledWith('success', true);
    expect(spans[1].setError).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toBe('trace failure');
  });

  it('wraps full execution when trace exposes withSpanAsync', async () => {
    const trace = {
      withSpanAsync: jest.fn(async (_name, fn, attrs) => {
        const result = await fn();
        trace.attrs = attrs;
        return result;
      }),
      info: jest.fn(),
      step: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
    };

    const stage = new RecordingStage('simple', () =>
      PipelineResult.success({ data: { ran: true } })
    );

    const pipeline = new Pipeline([stage], logger);

    const result = await pipeline.execute({
      actor,
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(trace.withSpanAsync).toHaveBeenCalledTimes(1);
    expect(trace.attrs).toEqual({ stageCount: 1 });
    expect(result.success).toBe(true);
  });

  it('halts the pipeline when a stage requests stop processing', async () => {
    const stopStage = new RecordingStage('stopper', () =>
      PipelineResult.success({
        data: { stop: true },
        continueProcessing: false,
      })
    );

    const shouldNotRunStage = new RecordingStage('unexpected', () => {
      throw new Error(
        'This stage should not execute when continueProcessing is false'
      );
    });

    const pipeline = new Pipeline([stopStage, shouldNotRunStage], logger);

    const result = await pipeline.execute({
      actor,
      actionContext: {},
      candidateActions: [],
    });

    expect(executionOrder.map((entry) => entry.stage)).toEqual(['stopper']);
    expect(result.success).toBe(true);
    expect(result.continueProcessing).toBe(false);
    expect(result.data.stop).toBe(true);
  });

  it('captures thrown errors from stages and returns aggregated failure result', async () => {
    const passingStage = new RecordingStage('passing', () =>
      PipelineResult.success({ data: { stage: 'passing' } })
    );

    const failingStage = new RecordingStage('failing', () => {
      throw new Error('Injected stage failure');
    });

    const pipeline = new Pipeline([passingStage, failingStage], logger);

    const result = await pipeline.execute({
      actor,
      actionContext: {},
      candidateActions: [],
    });

    expect(executionOrder.map((entry) => entry.stage)).toEqual([
      'passing',
      'failing',
    ]);
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].stageName).toBe('failing');
    expect(result.errors[0].phase).toBe('PIPELINE_EXECUTION');
  });

  it('converts ActionResult failures into pipeline failures and aggregates errors', async () => {
    const conversionStage = new RecordingStage('conversion', () => {
      const base = PipelineResult.success({ data: { start: true } });

      const failingAction = ActionResult.failure({
        message: 'downstream check failed',
        code: 'VALIDATION',
      });

      return base.chainActionResult(() => failingAction);
    });

    const pipeline = new Pipeline([conversionStage], logger);

    const result = await pipeline.execute({
      actor,
      actionContext: {},
      candidateActions: [],
    });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('downstream check failed');
    expect(result.errors[0].code).toBe('VALIDATION');
    expect(result.continueProcessing).toBe(false);
  });

  it('converts ActionResult outputs into pipeline results', () => {
    const success = PipelineResult.fromActionResult(
      ActionResult.success({ next: 'value' }),
      { stage: 'merge' }
    );
    expect(success.success).toBe(true);
    expect(success.data).toMatchObject({ next: 'value', stage: 'merge' });

    const failure = PipelineResult.fromActionResult(
      ActionResult.failure(new Error('convert failure')),
      { stage: 'merge' }
    );
    expect(failure.success).toBe(false);
    expect(failure.errors).toHaveLength(1);
    expect(failure.data).toMatchObject({ stage: 'merge' });
  });

  it('logs warnings when a stage completes with errors but continues', async () => {
    const trace = {
      info: jest.fn(),
      step: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
    };

    const errorStage = new RecordingStage('warning-stage', () => {
      const failure = PipelineResult.failure([{ error: 'issue' }], {});
      failure.continueProcessing = true;
      return failure;
    });

    const finalStage = new RecordingStage('final', () =>
      PipelineResult.success({ data: { done: true } })
    );

    const pipeline = new Pipeline([errorStage, finalStage], logger);

    const result = await pipeline.execute({
      actor,
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'Stage warning-stage completed with errors'
    );
    expect(trace.failure).toHaveBeenCalledWith(
      'Stage warning-stage encountered errors',
      'Pipeline.execute'
    );
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it('propagates thrown errors from executeInternal when trace spans are active', async () => {
    const spans = [];
    const trace = {
      startSpan: jest.fn(() => {
        const span = {
          setAttribute: jest.fn(),
          setStatus: jest.fn(),
          setError: jest.fn(),
        };
        spans.push(span);
        return span;
      }),
      endSpan: jest.fn(),
      info: jest.fn(),
      step: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
    };

    const errorStage = new RecordingStage('explode', () => {
      throw new Error('boom');
    });

    const pipeline = new Pipeline([errorStage], logger);

    const result = await pipeline.execute({
      actor,
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toBe('boom');
    expect(spans[0].setError).toHaveBeenCalled();
    expect(trace.endSpan).toHaveBeenCalledTimes(1);
  });
});

describe('PipelineStage base class behaviour', () => {
  it('prevents direct instantiation and enforces executeInternal overrides', async () => {
    expect(() => new PipelineStage('invalid')).toThrow(
      'PipelineStage is an abstract class and cannot be instantiated directly'
    );

    class BadStage extends PipelineStage {
      constructor() {
        super('bad');
      }
    }

    const stage = new BadStage();
    await expect(stage.execute({ trace: null })).rejects.toThrow(
      'Stage bad must implement executeInternal() method'
    );
  });
});

describe('ActionResult behaviors within pipeline integration scenarios', () => {
  it('supports transformation, chaining, and serialization helpers', () => {
    const initial = ActionResult.success({ value: 2 });

    const transformed = initial
      .map(({ value }) => value + 3)
      .flatMap((next) => ActionResult.success(next * 2))
      .ifSuccess((value) => {
        expect(value).toBe(10);
      });

    const combined = ActionResult.combine([
      transformed,
      ActionResult.success(5),
    ]);

    combined.ifFailure(() => {
      throw new Error('Should not fail');
    });

    expect(combined.getOrDefault(null)).toEqual([10, 5]);
    expect(() => combined.getOrThrow()).not.toThrow();

    const firstError = new Error('first');
    firstError.code = 'E1';
    firstError.context = { reason: 'primary' };

    const failure = ActionResult.failure([
      firstError,
      { message: 'second', extra: true },
    ]);

    expect(() => failure.getOrThrow()).toThrow('first; second');
    expect(failure.toJSON()).toMatchObject({
      success: false,
      errors: [{ message: 'first' }, { message: 'second' }],
    });

    const failureCallback = jest.fn();
    failure.ifFailure(failureCallback);
    expect(failureCallback).toHaveBeenCalledWith(failure.errors);

    const restored = ActionResult.fromJSON(failure.toJSON());
    expect(restored.success).toBe(false);
    expect(restored.errors).toHaveLength(2);
  });

  it('propagates early returns and error branches in map/flatMap', () => {
    const failingMap = ActionResult.failure('stop');
    expect(failingMap.map(() => 'ignored')).toBe(failingMap);

    const mapError = ActionResult.success(1).map(() => {
      throw new Error('map failure');
    });
    expect(mapError.success).toBe(false);
    expect(mapError.errors[0]).toBeInstanceOf(Error);

    const failingFlatMap = ActionResult.failure('halt');
    expect(failingFlatMap.flatMap(() => ActionResult.success('nope'))).toBe(
      failingFlatMap
    );

    const nonResult = ActionResult.success('value').flatMap(() => 'invalid');
    expect(nonResult.success).toBe(false);
    expect(nonResult.errors[0].message).toContain(
      'flatMap function must return an ActionResult'
    );

    const combinedFailure = ActionResult.combine([
      ActionResult.failure(new Error('oops')),
      ActionResult.success('ok'),
    ]);
    expect(combinedFailure.success).toBe(false);
    expect(combinedFailure.errors).toHaveLength(1);
  });
});
