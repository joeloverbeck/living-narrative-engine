/**
 * @file Integration tests for the Pipeline executor
 * @description Exercises Pipeline behaviour with real PipelineStage implementations and trace contexts
 * @see src/actions/pipeline/Pipeline.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';

class TestStage extends PipelineStage {
  /**
   * @param {string} name
   * @param {(context: any) => Promise<PipelineResult>} executor
   */
  constructor(name, executor) {
    super(name);
    this.executor = executor;
    this.contexts = [];
  }

  async executeInternal(context) {
    this.contexts.push(context);
    return this.executor(context);
  }
}

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createStructuredTrace = () => {
  const trace = {
    info: jest.fn(),
    step: jest.fn(),
    success: jest.fn(),
    failure: jest.fn(),
    withSpanAsync: jest.fn(async (_name, handler) => handler()),
  };
  return trace;
};

describe('Pipeline integration behaviour', () => {
  let logger;

  beforeEach(() => {
    logger = createLogger();
  });

  it('throws when constructed with no stages', () => {
    expect(() => new Pipeline([], logger)).toThrow(
      'Pipeline requires at least one stage'
    );
  });

  it('wraps execution in structured trace spans and aggregates stage results', async () => {
    const trace = createStructuredTrace();

    const gatherStage = new TestStage('Gather', async () =>
      PipelineResult.success({
        actions: [{ id: 'action-1' }],
        data: { gathered: true },
      })
    );

    const validationStage = new TestStage('Validate', async (context) => {
      expect(context.actions).toEqual([{ id: 'action-1' }]);
      return new PipelineResult({
        success: false,
        continueProcessing: true,
        errors: [
          {
            error: 'validation failed',
            phase: 'VALIDATION',
            stageName: 'Validate',
          },
        ],
        data: { validated: true },
      });
    });

    const enrichmentStage = new TestStage('Enrich', async (context) => {
      expect(context.errors).toHaveLength(1);
      return PipelineResult.success({
        data: { enriched: context.gathered && context.validated },
      });
    });

    const pipeline = new Pipeline(
      [gatherStage, validationStage, enrichmentStage],
      logger
    );

    const result = await pipeline.execute({
      actor: { id: 'actor-42' },
      actionContext: { turnId: 'turn-1' },
      candidateActions: [{ id: 'candidate-a' }],
      trace,
    });

    expect(trace.withSpanAsync).toHaveBeenCalledWith(
      'Pipeline',
      expect.any(Function),
      { stageCount: 3 }
    );
    expect(trace.step).toHaveBeenCalledTimes(3);
    expect(trace.success).toHaveBeenCalledWith(
      'Stage Gather completed successfully',
      'Pipeline.execute'
    );
    expect(trace.failure).toHaveBeenCalledWith(
      'Stage Validate encountered errors',
      'Pipeline.execute'
    );
    expect(logger.debug).toHaveBeenCalledWith('Executing pipeline stage: Gather');
    expect(logger.warn).toHaveBeenCalledWith(
      'Stage Validate completed with errors'
    );
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.data).toEqual({ gathered: true, validated: true, enriched: true });
    expect(result.actions).toEqual([{ id: 'action-1' }]);
  });

  it('halts further stages when continueProcessing is false', async () => {
    const trace = createStructuredTrace();

    const haltingStage = new TestStage('ShortCircuit', async () =>
      PipelineResult.success({
        data: { halted: true },
        errors: [],
        actions: [],
        continueProcessing: false,
      })
    );

    const skippedStage = new TestStage('Skipped', async () =>
      PipelineResult.success({ data: { reached: true } })
    );

    const pipeline = new Pipeline([haltingStage, skippedStage], logger);

    const result = await pipeline.execute({
      actor: { id: 'actor-99' },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.continueProcessing).toBe(false);
    expect(skippedStage.contexts).toHaveLength(0);
    expect(trace.info).toHaveBeenCalledWith(
      'Pipeline halted at stage: ShortCircuit',
      'Pipeline.execute'
    );
  });

  it('returns merged failure result when a stage throws', async () => {
    const trace = createStructuredTrace();

    const passingStage = new TestStage('Pass', async () =>
      PipelineResult.success({
        actions: [{ id: 'action-pass' }],
        data: { passed: true },
      })
    );

    const failingStage = new TestStage('Boom', async () => {
      throw new Error('unexpected failure');
    });

    const pipeline = new Pipeline([passingStage, failingStage], logger);

    const result = await pipeline.execute({
      actor: { id: 'actor-7' },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Pipeline stage Boom threw an error: unexpected failure',
      expect.any(Error)
    );
    expect(trace.failure).toHaveBeenCalledWith(
      'Stage Boom threw an error: unexpected failure',
      'Pipeline.execute'
    );
    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      {
        error: 'unexpected failure',
        phase: 'PIPELINE_EXECUTION',
        stageName: 'Boom',
        context: expect.objectContaining({ error: expect.stringContaining('Error: unexpected failure') }),
      },
    ]);
    expect(result.actions).toEqual([{ id: 'action-pass' }]);
  });
});
