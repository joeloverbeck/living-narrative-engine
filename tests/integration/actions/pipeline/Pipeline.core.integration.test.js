/**
 * @file Integration tests for the core Pipeline executor.
 * @description These tests exercise Pipeline with real stage implementations to
 *              ensure context propagation, error handling, and trace integration
 *              behave as expected when multiple modules collaborate.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';

/**
 * Utility stage that delegates execution to a handler while exposing the stage instance.
 */
class DelegatingStage extends PipelineStage {
  /**
   * @param {string} name - Stage name for logging.
   * @param {(context: object, stage: DelegatingStage) => Promise<PipelineResult>} handler - Execution handler.
   */
  constructor(name, handler) {
    super(name);
    this.handler = handler;
  }

  /** @override */
  async executeInternal(context) {
    return this.handler(context, this);
  }
}

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createTrace = () => ({
  info: jest.fn(),
  step: jest.fn(),
  success: jest.fn(),
  failure: jest.fn(),
});

const createBaseContext = (overrides = {}) => ({
  actor: { id: 'actor-01' },
  actionContext: { mood: 'curious' },
  candidateActions: [{ id: 'initial-action' }],
  ...overrides,
});

describe('Pipeline integration behaviour', () => {
  let logger;
  let trace;

  beforeEach(() => {
    logger = createLogger();
    trace = createTrace();
  });

  it('executes stages sequentially and merges results into the pipeline context', async () => {
    const stageOrder = [];

    const componentFiltering = new DelegatingStage(
      'ComponentFiltering',
      async (context, stage) => {
        stageOrder.push(stage.name);
        expect(context.actor.id).toBe('actor-01');
        expect(context.candidateActions).toHaveLength(1);
        return PipelineResult.success({
          actions: [{ id: 'candidate:wave' }],
          data: { filtered: true, actorSeen: context.actor.id },
        });
      }
    );

    const formattingStage = new DelegatingStage(
      'ActionFormatting',
      async (context, stage) => {
        stageOrder.push(stage.name);
        expect(context.filtered).toBe(true);
        expect(context.actions).toHaveLength(1);
        expect(context.errors).toEqual([]);

        return PipelineResult.success({
          actions: [
            { id: 'formatted:wave', command: `wave:${context.actor.id}` },
          ],
          data: { formatted: true },
        });
      }
    );

    const pipeline = new Pipeline(
      [componentFiltering, formattingStage],
      logger
    );
    const result = await pipeline.execute(createBaseContext({ trace }));

    expect(stageOrder).toEqual(['ComponentFiltering', 'ActionFormatting']);
    expect(result.success).toBe(true);
    expect(result.actions).toEqual([
      { id: 'candidate:wave' },
      { id: 'formatted:wave', command: 'wave:actor-01' },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.data).toEqual({
      filtered: true,
      actorSeen: 'actor-01',
      formatted: true,
    });

    expect(logger.debug).toHaveBeenCalledWith(
      'Executing pipeline stage: ComponentFiltering'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'Executing pipeline stage: ActionFormatting'
    );
    expect(trace.step).toHaveBeenCalledWith(
      'Executing stage: ComponentFiltering',
      'Pipeline.execute'
    );
    expect(trace.success).toHaveBeenCalledWith(
      'Stage ActionFormatting completed successfully',
      'Pipeline.execute'
    );
    expect(trace.info).toHaveBeenCalledWith(
      'Pipeline execution completed. Actions: 2, Errors: 0',
      'Pipeline.execute'
    );
  });

  it('halts execution when a stage marks continueProcessing=false', async () => {
    const haltingStage = new DelegatingStage(
      'PrerequisiteEvaluation',
      async () => {
        return PipelineResult.success({
          data: { reason: 'no candidates' },
          continueProcessing: false,
        });
      }
    );

    const downstreamStage = new DelegatingStage(
      'TargetValidation',
      async () => {
        throw new Error('Should not execute after halting');
      }
    );

    const pipeline = new Pipeline([haltingStage, downstreamStage], logger);
    const result = await pipeline.execute(createBaseContext({ trace }));

    expect(result.success).toBe(true);
    expect(result.actions).toEqual([]);
    expect(result.data).toEqual({ reason: 'no candidates' });
    expect(logger.debug).toHaveBeenCalledWith(
      'Stage PrerequisiteEvaluation indicated to stop processing'
    );
    expect(trace.info).toHaveBeenCalledWith(
      'Pipeline halted at stage: PrerequisiteEvaluation',
      'Pipeline.execute'
    );
    expect(trace.success).not.toHaveBeenCalledWith(
      'Stage TargetValidation completed successfully',
      expect.any(String)
    );
  });

  it('continues when a stage reports errors but allows further processing', async () => {
    const failureStage = new DelegatingStage(
      'TargetComponentValidation',
      async () => {
        return new PipelineResult({
          success: false,
          errors: [
            {
              error: 'validation failed',
              stageName: 'TargetComponentValidation',
            },
          ],
          data: { validation: 'failed' },
          continueProcessing: true,
        });
      }
    );

    const recoveryStage = new DelegatingStage(
      'ActionFormatting',
      async (context) => {
        expect(context.validation).toBe('failed');
        return PipelineResult.success({
          actions: [{ id: 'recovery:action' }],
          data: { formatted: true },
        });
      }
    );

    const pipeline = new Pipeline([failureStage, recoveryStage], logger);
    const result = await pipeline.execute(createBaseContext({ trace }));

    expect(result.success).toBe(false);
    expect(result.actions).toEqual([{ id: 'recovery:action' }]);
    expect(result.errors).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'Stage TargetComponentValidation completed with errors'
    );
    expect(trace.failure).toHaveBeenCalledWith(
      'Stage TargetComponentValidation encountered errors',
      'Pipeline.execute'
    );
    expect(trace.success).toHaveBeenCalledWith(
      'Stage ActionFormatting completed successfully',
      'Pipeline.execute'
    );
  });

  it('captures thrown stage errors and returns a failure result', async () => {
    const errorStage = new DelegatingStage('ComponentFiltering', async () => {
      throw new Error('stage exploded');
    });

    const pipeline = new Pipeline([errorStage], logger);
    const result = await pipeline.execute(createBaseContext({ trace }));

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual(
      expect.objectContaining({
        error: 'stage exploded',
        phase: 'PIPELINE_EXECUTION',
        stageName: 'ComponentFiltering',
      })
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Pipeline stage ComponentFiltering threw an error: stage exploded',
      expect.any(Error)
    );
    expect(trace.failure).toHaveBeenCalledWith(
      'Stage ComponentFiltering threw an error: stage exploded',
      'Pipeline.execute'
    );
  });

  it('wraps execution with a structured trace span when available', async () => {
    const structuredTrace = {
      withSpanAsync: jest
        .fn()
        .mockImplementation(async (_name, executor, metadata) => {
          expect(_name).toBe('Pipeline');
          expect(metadata).toEqual({ stageCount: 2 });
          return executor();
        }),
      info: jest.fn(),
      step: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
    };

    const stageA = new DelegatingStage('ComponentFiltering', async () =>
      PipelineResult.success({ data: { filtered: true } })
    );
    const stageB = new DelegatingStage('ActionFormatting', async () =>
      PipelineResult.success()
    );

    const pipeline = new Pipeline([stageA, stageB], logger);
    const result = await pipeline.execute(
      createBaseContext({ trace: structuredTrace })
    );

    expect(result.success).toBe(true);
    expect(structuredTrace.withSpanAsync).toHaveBeenCalledTimes(1);
  });

  it('enforces that at least one stage is provided at construction', () => {
    expect(() => new Pipeline([], logger)).toThrow(
      'Pipeline requires at least one stage'
    );
  });
});
