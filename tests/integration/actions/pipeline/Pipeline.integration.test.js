/**
 * @file Integration coverage tests for the Pipeline executor.
 * @description Ensures Pipeline orchestration behaviour is exercised through integration-style scenarios
 * that include structured tracing, error propagation, and result aggregation that were previously untested.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';

/**
 * Creates a lightweight pipeline stage implementation for testing.
 *
 * @param {string} name - Stage identifier used by the pipeline for logging and tracing.
 * @param {(context: object) => Promise<PipelineResult>} implementation - Stage execution logic.
 * @returns {{ name: string, execute: jest.Mock<Promise<PipelineResult>, [object]> }}
 */
function createStage(name, implementation) {
  return {
    name,
    execute: jest.fn(implementation),
  };
}

describe('Pipeline integration coverage', () => {
  /** @type {{ debug: jest.Mock, warn: jest.Mock, error: jest.Mock }} */
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  it('enforces stage presence when constructing a pipeline', () => {
    expect(() => new Pipeline([], mockLogger)).toThrow(
      'Pipeline requires at least one stage'
    );
  });

  it('wraps execution with structured tracing and aggregates stage results', async () => {
    const structuredTrace = {
      withSpanAsync: jest.fn(async (_name, fn) => fn()),
      info: jest.fn(),
      step: jest.fn(),
      failure: jest.fn(),
      success: jest.fn(),
    };

    const stageOne = createStage('EligibilityStage', async (context) => {
      expect(context.actor.id).toBe('actor-77');
      return PipelineResult.success({
        actions: [{ id: 'action-1' }],
        data: { stageOne: true },
      });
    });

    const stageTwo = createStage('EvaluationStage', async (context) => {
      expect(context.stageOne).toBe(true);
      expect(context.actions).toEqual([{ id: 'action-1' }]);
      return new PipelineResult({
        success: false,
        errors: [{ error: 'eligibility failed', phase: 'EVAL' }],
        data: { stageTwo: true },
        continueProcessing: true,
      });
    });

    const stageThree = createStage('ResolutionStage', async (context) => {
      expect(context.stageTwo).toBe(true);
      expect(context.errors).toHaveLength(1);
      return PipelineResult.success({
        actions: [{ id: 'action-3' }],
        data: { stageThree: true },
        continueProcessing: false,
      });
    });

    const pipeline = new Pipeline(
      [stageOne, stageTwo, stageThree],
      mockLogger
    );

    const result = await pipeline.execute({
      actor: { id: 'actor-77' },
      actionContext: { scope: 'structured' },
      candidateActions: [{ id: 'candidate-1' }],
      trace: structuredTrace,
    });

    expect(structuredTrace.withSpanAsync).toHaveBeenCalledWith(
      'Pipeline',
      expect.any(Function),
      { stageCount: 3 }
    );
    expect(mockLogger.debug).toHaveBeenCalledTimes(4);
    expect(structuredTrace.step).toHaveBeenCalledTimes(3);
    expect(structuredTrace.step).toHaveBeenCalledWith(
      'Executing stage: EligibilityStage',
      'Pipeline.execute'
    );
    expect(structuredTrace.success).toHaveBeenCalledWith(
      'Stage EligibilityStage completed successfully',
      'Pipeline.execute'
    );
    expect(structuredTrace.failure).toHaveBeenCalledWith(
      'Stage EvaluationStage encountered errors',
      'Pipeline.execute'
    );
    expect(structuredTrace.info).toHaveBeenNthCalledWith(
      1,
      'Starting pipeline execution with 3 stages',
      'Pipeline.execute'
    );
    expect(structuredTrace.info).toHaveBeenNthCalledWith(
      2,
      'Pipeline halted at stage: ResolutionStage',
      'Pipeline.execute'
    );
    expect(structuredTrace.info).toHaveBeenNthCalledWith(
      3,
      'Pipeline execution completed. Actions: 2, Errors: 1',
      'Pipeline.execute'
    );

    expect(result.success).toBe(false);
    expect(result.actions).toEqual([{ id: 'action-1' }, { id: 'action-3' }]);
    expect(result.errors).toEqual([
      { error: 'eligibility failed', phase: 'EVAL' },
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

  it('handles thrown stage errors and returns merged failure results', async () => {
    const simpleTrace = {
      info: jest.fn(),
      step: jest.fn(),
      failure: jest.fn(),
      success: jest.fn(),
    };

    const stageOne = createStage('SetupStage', async () =>
      PipelineResult.success({
        actions: [{ id: 'base-action' }],
        data: { stageOne: true },
      })
    );

    const stageError = new Error('explosion');
    const stageTwo = createStage('ExplosiveStage', async () => {
      throw stageError;
    });

    const skippedStage = createStage('SkippedStage', async () =>
      PipelineResult.success({ data: { shouldNotRun: true } })
    );

    const pipeline = new Pipeline(
      [stageOne, stageTwo, skippedStage],
      mockLogger
    );

    const result = await pipeline.execute({
      actor: { id: 'actor-error' },
      actionContext: { scope: 'error' },
      candidateActions: [],
      trace: simpleTrace,
    });

    expect(simpleTrace.info).toHaveBeenCalledWith(
      'Starting pipeline execution with 3 stages',
      'Pipeline.execute'
    );
    expect(simpleTrace.step).toHaveBeenCalledWith(
      'Executing stage: SetupStage',
      'Pipeline.execute'
    );
    expect(simpleTrace.success).toHaveBeenCalledWith(
      'Stage SetupStage completed successfully',
      'Pipeline.execute'
    );
    expect(simpleTrace.failure).toHaveBeenCalledWith(
      'Stage ExplosiveStage threw an error: explosion',
      'Pipeline.execute'
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Pipeline stage ExplosiveStage threw an error: explosion',
      stageError
    );
    expect(skippedStage.execute).not.toHaveBeenCalled();

    expect(result.success).toBe(false);
    expect(result.continueProcessing).toBe(false);
    expect(result.actions).toEqual([{ id: 'base-action' }]);
    expect(result.errors).toEqual([
      {
        error: 'explosion',
        phase: 'PIPELINE_EXECUTION',
        stageName: 'ExplosiveStage',
        context: expect.objectContaining({
          error: expect.stringContaining('Error: explosion'),
        }),
      },
    ]);
  });
});
