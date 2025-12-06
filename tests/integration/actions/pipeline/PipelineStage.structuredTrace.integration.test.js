/**
 * @file Integration coverage tests for the PipelineStage base class with structured tracing.
 * @description Ensures the abstract stage integrates correctly with tracing spans, error propagation,
 * and direct execution fallbacks which were previously missing coverage in the integration suite.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';

/**
 * Creates a concrete PipelineStage for testing that proxies to the provided implementation.
 *
 * @param {(context: object) => Promise<PipelineResult>} implementation - Stage logic to execute.
 * @returns {PipelineStage}
 */
function createStage(implementation) {
  return new (class extends PipelineStage {
    constructor() {
      super('TestStage');
    }

    async executeInternal(context) {
      return implementation(context);
    }
  })();
}

/**
 * Builds a structured trace mock with span hooks so tests can assert instrumentation behaviour.
 *
 * @param {object} [options] - Optional overrides for the span mock.
 * @param {boolean} [options.includeAttributeFn] - Whether the span exposes setAttribute.
 * @returns {{ trace: object, span: object }}
 */
function createStructuredTraceMock({ includeAttributeFn = true } = {}) {
  const span = {
    setError: jest.fn(),
    setStatus: jest.fn(),
  };

  if (includeAttributeFn) {
    span.setAttribute = jest.fn();
  }

  const trace = {
    startSpan: jest.fn(() => span),
    endSpan: jest.fn(),
  };

  return { trace, span };
}

describe('PipelineStage structured trace integration', () => {
  it('enforces abstract usage by disallowing direct instantiation', () => {
    expect(() => {
      // @ts-expect-error - intentionally violating abstract contract for coverage.
      return new PipelineStage('IllegalStage');
    }).toThrow(
      'PipelineStage is an abstract class and cannot be instantiated directly'
    );
  });

  it('wraps executeInternal with structured trace spans and records metrics', async () => {
    const { trace, span } = createStructuredTraceMock();
    const stage = createStage(async (context) => {
      expect(context.actor.id).toBe('actor-1');
      const result = PipelineResult.success({ data: { fromStage: true } });
      result.processedCount = 4;
      return result;
    });

    const result = await stage.execute({
      actor: { id: 'actor-1' },
      actionContext: { scope: 'test' },
      candidateActions: [{ id: 'A' }, { id: 'B' }],
      trace,
    });

    expect(result.success).toBe(true);
    expect(trace.startSpan).toHaveBeenCalledWith('TestStageStage', {
      stage: 'TestStage',
      actor: 'actor-1',
      candidateCount: 2,
    });
    expect(span.setAttribute).toHaveBeenCalledWith('success', true);
    expect(span.setAttribute).toHaveBeenCalledWith('processedCount', 4);
    expect(span.setStatus).toHaveBeenCalledWith('success');
    expect(trace.endSpan).toHaveBeenCalledWith(span);
  });

  it('marks spans as error when stages return failure results', async () => {
    const { trace, span } = createStructuredTraceMock();
    const failureResult = PipelineResult.failure([
      { error: 'stage failure', phase: 'TEST', stageName: 'TestStage' },
    ]);
    failureResult.processedCount = 2;

    const stage = createStage(async () => failureResult);

    const result = await stage.execute({
      actor: { id: 'actor-2' },
      actionContext: { scope: 'fail' },
      candidateActions: [],
      trace,
    });

    expect(result).toBe(failureResult);
    expect(span.setAttribute).toHaveBeenCalledWith('success', false);
    expect(span.setAttribute).toHaveBeenCalledWith('processedCount', 2);
    expect(span.setAttribute).toHaveBeenCalledWith('errorCount', 1);
    expect(span.setError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'stage failure' })
    );
    expect(trace.endSpan).toHaveBeenCalledWith(span);
  });

  it('propagates thrown errors while flagging the span', async () => {
    const { trace, span } = createStructuredTraceMock({
      includeAttributeFn: false,
    });
    const stageError = new Error('boom');
    const stage = createStage(async () => {
      throw stageError;
    });

    await expect(
      stage.execute({
        actor: { id: 'actor-3' },
        actionContext: { scope: 'explode' },
        candidateActions: [],
        trace,
      })
    ).rejects.toThrow('boom');

    expect(span.setError).toHaveBeenCalledWith(stageError);
    expect(trace.endSpan).toHaveBeenCalledWith(span);
  });

  it('executes directly when no structured trace is present', async () => {
    const stage = createStage(async () =>
      PipelineResult.success({ data: { ok: true } })
    );

    const result = await stage.execute({
      actor: { id: 'actor-4' },
      actionContext: { scope: 'simple' },
      candidateActions: [],
    });

    expect(result.success).toBe(true);
  });
});
