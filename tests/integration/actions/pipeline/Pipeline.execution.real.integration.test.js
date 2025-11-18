/**
 * @file Integration tests for the Pipeline executor using real stage implementations.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';

/**
 * Helper factory for creating a logger compatible with the pipeline.
 *
 * @returns {{debug: jest.Mock, warn: jest.Mock, error: jest.Mock}}
 */
function createLogger() {
  return {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Utility stage that records every invocation and delegates to the supplied handler.
 */
class RecordingStage extends PipelineStage {
  /**
   * @param {string} name - Stage name for diagnostics.
   * @param {(context: any) => Promise<PipelineResult>|PipelineResult} handler - Execution handler.
   * @param {Array<{name: string, context: any}>} calls - Shared collection of invocations.
   */
  constructor(name, handler, calls) {
    super(name);
    this.handler = handler;
    this.calls = calls;
  }

  /** @inheritdoc */
  async executeInternal(context) {
    this.calls.push({ name: this.name, context });
    return this.handler(context);
  }
}

describe('Pipeline integration', () => {
  it('requires at least one stage', () => {
    const logger = createLogger();
    expect(() => new Pipeline([], logger)).toThrow('Pipeline requires at least one stage');
  });

  it('executes through all stages and merges results under structured tracing', async () => {
    const logger = createLogger();
    const calls = [];

    const firstStageResult = PipelineResult.success({
      actions: [{ id: 'alpha' }],
      errors: [{ message: 'soft-warning' }],
      data: { fromFirst: 'payload' },
    });

    const secondStageResult = new PipelineResult({
      success: true,
      actions: [{ id: 'beta' }],
      errors: [],
      data: { fromSecond: 'finalized' },
      continueProcessing: true,
    });

    const firstStage = new RecordingStage('ComponentFiltering', async (context) => {
      expect(context.actor.id).toBe('actor-1');
      expect(context.actionContext.intent).toBe('investigate');
      expect(context.candidateActions).toEqual([]);
      return firstStageResult;
    }, calls);

    const secondStage = new RecordingStage('Formatting', async (context) => {
      expect(context.fromFirst).toBe('payload');
      expect(context.actions).toEqual(firstStageResult.actions);
      expect(context.errors).toEqual(firstStageResult.errors);
      return secondStageResult;
    }, calls);

    const pipeline = new Pipeline([firstStage, secondStage], logger);

    const trace = {
      withSpanAsync: jest.fn(async (label, executor, metadata) => {
        expect(label).toBe('Pipeline');
        expect(metadata).toEqual({ stageCount: 2 });
        return executor();
      }),
      step: jest.fn(),
      info: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
    };

    const result = await pipeline.execute({
      actor: { id: 'actor-1' },
      actionContext: { intent: 'investigate' },
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.actions).toEqual([
      ...firstStageResult.actions,
      ...secondStageResult.actions,
    ]);
    expect(result.errors).toEqual(firstStageResult.errors);
    expect(result.data).toMatchObject({
      fromFirst: 'payload',
      fromSecond: 'finalized',
    });
    expect(calls.map((call) => call.name)).toEqual([
      'ComponentFiltering',
      'Formatting',
    ]);

    expect(trace.withSpanAsync).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(
      'Executing pipeline stage: ComponentFiltering'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'Executing pipeline stage: Formatting'
    );
    expect(trace.success).toHaveBeenCalledWith(
      'Stage ComponentFiltering completed successfully',
      'Pipeline.execute'
    );
    expect(trace.success).toHaveBeenCalledWith(
      'Stage Formatting completed successfully',
      'Pipeline.execute'
    );
    expect(trace.info).toHaveBeenLastCalledWith(
      'Pipeline execution completed. Actions: 2, Errors: 1',
      'Pipeline.execute'
    );
  });

  it('halts processing when a stage indicates to stop', async () => {
    const logger = createLogger();
    const calls = [];

    const haltStage = new RecordingStage('TargetValidation', async () => {
      return PipelineResult.success({
        data: { validated: true },
        continueProcessing: false,
      });
    }, calls);

    const skippedStage = new RecordingStage('Formatting', async () => {
      throw new Error('Should not be executed');
    }, calls);

    const pipeline = new Pipeline([haltStage, skippedStage], logger);

    const trace = {
      step: jest.fn(),
      info: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
    };

    const result = await pipeline.execute({
      actor: { id: 'actor-7' },
      actionContext: { intent: 'halt' },
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.continueProcessing).toBe(false);
    expect(result.data).toMatchObject({ validated: true });
    expect(calls.map((call) => call.name)).toEqual(['TargetValidation']);
    expect(trace.info).toHaveBeenCalledWith(
      'Pipeline halted at stage: TargetValidation',
      'Pipeline.execute'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'Executing pipeline stage: TargetValidation'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'Stage TargetValidation indicated to stop processing'
    );
  });

  it('logs warnings for stages that return errors but continue processing', async () => {
    const logger = createLogger();
    const calls = [];

    const problematicStage = new RecordingStage('MultiTarget', async () => {
      return new PipelineResult({
        success: false,
        errors: [{ message: 'target missing' }],
        data: { attempted: true },
        continueProcessing: true,
      });
    }, calls);

    const recoveryStage = new RecordingStage('Formatting', async () => {
      return PipelineResult.success({
        data: { formatted: true },
      });
    }, calls);

    const pipeline = new Pipeline([problematicStage, recoveryStage], logger);

    const trace = {
      step: jest.fn(),
      info: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
    };

    const result = await pipeline.execute({
      actor: { id: 'actor-9' },
      actionContext: { intent: 'recover' },
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual([{ message: 'target missing' }]);
    expect(result.data).toMatchObject({ attempted: true, formatted: true });
    expect(calls.map((call) => call.name)).toEqual(['MultiTarget', 'Formatting']);
    expect(logger.warn).toHaveBeenCalledWith(
      'Stage MultiTarget completed with errors'
    );
    expect(trace.failure).toHaveBeenCalledWith(
      'Stage MultiTarget encountered errors',
      'Pipeline.execute'
    );
  });

  it('converts thrown stage errors into pipeline failure results', async () => {
    const logger = createLogger();
    const calls = [];

    const failingStage = new RecordingStage('Prerequisites', async () => {
      throw new Error('stage exploded');
    }, calls);

    const pipeline = new Pipeline([failingStage], logger);

    const trace = {
      step: jest.fn(),
      info: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
    };

    const result = await pipeline.execute({
      actor: { id: 'actor-11' },
      actionContext: { intent: 'explode' },
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      error: 'stage exploded',
      phase: 'PIPELINE_EXECUTION',
      stageName: 'Prerequisites',
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Pipeline stage Prerequisites threw an error: stage exploded',
      expect.any(Error)
    );
    expect(trace.failure).toHaveBeenCalledWith(
      'Stage Prerequisites threw an error: stage exploded',
      'Pipeline.execute'
    );
  });
});
