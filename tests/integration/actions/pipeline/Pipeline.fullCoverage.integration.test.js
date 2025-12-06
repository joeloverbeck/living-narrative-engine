/**
 * @file Comprehensive integration tests for the Pipeline executor.
 * @description Exercises Pipeline orchestration paths to maximize integration coverage, including
 * constructor validation, structured tracing behaviour, stage error handling, and cumulative result merging.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';

/**
 * @description Creates a mock pipeline stage for testing.
 * @param {string} name - Name used for logging and tracing output.
 * @param {(context: object) => Promise<PipelineResult>} implementation - Async execution implementation.
 * @returns {{ name: string, execute: jest.Mock<Promise<PipelineResult>, [object]> }} Stage double.
 */
function createStage(name, implementation) {
  return {
    name,
    execute: jest.fn(implementation),
  };
}

describe('Pipeline full integration coverage', () => {
  /** @type {{ debug: jest.Mock, warn: jest.Mock, error: jest.Mock }} */
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  it('validates that at least one stage is supplied to the constructor', () => {
    expect(() => new Pipeline([], mockLogger)).toThrow(
      'Pipeline requires at least one stage'
    );
    expect(() => new Pipeline({}, mockLogger)).toThrow(
      'Pipeline requires at least one stage'
    );
  });

  it('wraps execution in a structured trace span and aggregates stage output', async () => {
    const structuredTrace = {
      withSpanAsync: jest.fn(async (_name, executor, metadata) => {
        expect(metadata).toEqual({ stageCount: 3 });
        return executor();
      }),
      info: jest.fn(),
      step: jest.fn(),
      failure: jest.fn(),
      success: jest.fn(),
    };

    const stageOne = createStage('StageOne', async (context) => {
      expect(context.actor.id).toBe('actor-99');
      return PipelineResult.success({
        actions: [{ id: 'act-1' }],
        data: { stageOne: true },
      });
    });

    const stageTwo = createStage('StageTwo', async (context) => {
      expect(context.stageOne).toBe(true);
      return new PipelineResult({
        success: false,
        errors: [{ error: 'stage failure', phase: 'PIPELINE' }],
        data: { stageTwo: true },
        continueProcessing: true,
      });
    });

    const stageThree = createStage('StageThree', async (context) => {
      expect(context.stageTwo).toBe(true);
      return PipelineResult.success({
        actions: [{ id: 'act-3' }],
        data: { stageThree: true },
        continueProcessing: false,
      });
    });

    const pipeline = new Pipeline([stageOne, stageTwo, stageThree], mockLogger);

    const result = await pipeline.execute({
      actor: { id: 'actor-99' },
      actionContext: { scope: 'structured' },
      candidateActions: [{ id: 'candidate' }],
      trace: structuredTrace,
    });

    expect(structuredTrace.withSpanAsync).toHaveBeenCalledWith(
      'Pipeline',
      expect.any(Function),
      { stageCount: 3 }
    );
    expect(structuredTrace.info).toHaveBeenNthCalledWith(
      1,
      'Starting pipeline execution with 3 stages',
      'Pipeline.execute'
    );
    expect(structuredTrace.step).toHaveBeenCalledTimes(3);
    expect(structuredTrace.success).toHaveBeenCalledWith(
      'Stage StageOne completed successfully',
      'Pipeline.execute'
    );
    expect(structuredTrace.failure).toHaveBeenCalledWith(
      'Stage StageTwo encountered errors',
      'Pipeline.execute'
    );
    expect(structuredTrace.info).toHaveBeenNthCalledWith(
      2,
      'Pipeline halted at stage: StageThree',
      'Pipeline.execute'
    );
    expect(structuredTrace.info).toHaveBeenNthCalledWith(
      3,
      'Pipeline execution completed. Actions: 2, Errors: 1',
      'Pipeline.execute'
    );

    expect(mockLogger.debug).toHaveBeenCalledTimes(4);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Stage StageTwo completed with errors'
    );
    expect(mockLogger.error).not.toHaveBeenCalled();

    expect(result.success).toBe(false);
    expect(result.actions).toEqual([{ id: 'act-1' }, { id: 'act-3' }]);
    expect(result.errors).toEqual([
      { error: 'stage failure', phase: 'PIPELINE' },
    ]);
    expect(result.data).toEqual({
      stageOne: true,
      stageTwo: true,
      stageThree: true,
    });
    expect(result.continueProcessing).toBe(false);

    expect(stageOne.execute).toHaveBeenCalledTimes(1);
    expect(stageTwo.execute).toHaveBeenCalledTimes(1);
    expect(stageThree.execute).toHaveBeenCalledTimes(1);
  });

  it('merges failure results when a stage throws and tracing falls back to direct execution', async () => {
    const trace = {
      info: jest.fn(),
      step: jest.fn(),
      failure: jest.fn(),
      success: jest.fn(),
    };

    const stageOne = createStage('SetupStage', async () =>
      PipelineResult.success({
        actions: [{ id: 'base' }],
        data: { stageOne: true },
      })
    );

    const stageTwoError = new Error('kaboom');
    const stageTwo = createStage('ExplosiveStage', async () => {
      throw stageTwoError;
    });

    const stageThree = createStage('SkippedStage', async () =>
      PipelineResult.success()
    );

    const pipeline = new Pipeline([stageOne, stageTwo, stageThree], mockLogger);

    const result = await pipeline.execute({
      actor: { id: 'actor-22' },
      actionContext: { scope: 'direct' },
      candidateActions: [{ id: 'candidate-2' }],
      trace,
    });

    expect(trace.info).toHaveBeenCalledWith(
      'Starting pipeline execution with 3 stages',
      'Pipeline.execute'
    );
    expect(trace.failure).toHaveBeenCalledWith(
      'Stage ExplosiveStage threw an error: kaboom',
      'Pipeline.execute'
    );
    expect(trace.step).toHaveBeenCalledTimes(2);
    expect(trace.success).toHaveBeenCalledWith(
      'Stage SetupStage completed successfully',
      'Pipeline.execute'
    );

    expect(mockLogger.debug).toHaveBeenCalledTimes(2);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Pipeline stage ExplosiveStage threw an error: kaboom',
      stageTwoError
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();

    expect(result.success).toBe(false);
    expect(result.actions).toEqual([{ id: 'base' }]);
    expect(result.errors).toEqual([
      {
        error: 'kaboom',
        phase: 'PIPELINE_EXECUTION',
        stageName: 'ExplosiveStage',
        context: { error: stageTwoError.stack },
      },
    ]);
    expect(result.data).toEqual({ stageOne: true });
    expect(result.continueProcessing).toBe(false);

    expect(stageOne.execute).toHaveBeenCalledTimes(1);
    expect(stageTwo.execute).toHaveBeenCalledTimes(1);
    expect(stageThree.execute).not.toHaveBeenCalled();
  });
});
