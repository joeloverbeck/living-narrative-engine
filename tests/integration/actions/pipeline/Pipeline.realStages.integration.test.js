/**
 * @file Integration tests for the Pipeline executor using real stage implementations.
 * @description Verifies end-to-end behaviour of Pipeline, PipelineStage, PipelineResult and TraceContext
 *              working together without mocks.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';

class TestStage extends PipelineStage {
  /**
   * @param {string} name
   * @param {(context: any) => Promise<PipelineResult> | PipelineResult} behaviour
   */
  constructor(name, behaviour) {
    super(name);
    this.behaviour = behaviour;
  }

  async executeInternal(context) {
    return this.behaviour(context);
  }
}

describe('Pipeline integration with real stage implementations', () => {
  /** @type {{ debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock }} */
  let logger;
  /** @type {TraceContext} */
  let trace;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    trace = new TraceContext();
  });

  it('merges stage results, updates context, and halts when a stage requests to stop', async () => {
    const executionOrder = [];

    const stageOne = new TestStage('ComponentFiltering', async (context) => {
      executionOrder.push('stageOne');
      expect(context.actionContext).toEqual({ mood: 'curious' });
      return PipelineResult.success({
        actions: [{ id: 'action:alpha' }],
        data: { candidateActions: ['alpha', 'beta'], stageOne: true },
      });
    });

    const stageTwo = new TestStage('PrerequisiteEvaluation', async (context) => {
      executionOrder.push('stageTwo');
      expect(context.stageOne).toBe(true);
      expect(context.candidateActions).toEqual(['alpha', 'beta']);
      return PipelineResult.success({
        data: { evaluatedPrerequisites: true },
        continueProcessing: false,
        errors: [{ error: 'harmless warning', stageName: 'PrerequisiteEvaluation' }],
      });
    });

    const stageThree = new TestStage('TargetResolution', async () => {
      executionOrder.push('stageThree');
      return PipelineResult.success({ data: { unreachable: true } });
    });

    const pipeline = new Pipeline([stageOne, stageTwo, stageThree], logger);

    const initialContext = {
      actor: { id: 'actor:001' },
      actionContext: { mood: 'curious' },
      candidateActions: [],
      trace,
    };

    const result = await pipeline.execute(initialContext);

    expect(result.success).toBe(true);
    expect(result.actions).toEqual([{ id: 'action:alpha' }]);
    expect(result.errors).toEqual([
      { error: 'harmless warning', stageName: 'PrerequisiteEvaluation' },
    ]);
    expect(result.data).toMatchObject({
      candidateActions: ['alpha', 'beta'],
      evaluatedPrerequisites: true,
      stageOne: true,
    });
    expect(result.continueProcessing).toBe(false);

    // Stage three should never execute because stage two halted processing.
    expect(executionOrder).toEqual(['stageOne', 'stageTwo']);

    // Logger receives debug messages for each executed stage and the halt notice.
    expect(logger.debug).toHaveBeenCalledWith(
      'Executing pipeline stage: ComponentFiltering'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'Executing pipeline stage: PrerequisiteEvaluation'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'Stage PrerequisiteEvaluation indicated to stop processing'
    );

    // Trace context captures the pipeline lifecycle.
    const infoMessages = trace.logs
      .filter((entry) => entry.type === 'info')
      .map((entry) => entry.message);
    expect(infoMessages).toContain(
      'Starting pipeline execution with 3 stages'
    );
    expect(infoMessages).toContain('Pipeline halted at stage: PrerequisiteEvaluation');
    expect(infoMessages).toContain(
      'Pipeline execution completed. Actions: 1, Errors: 1'
    );
  });

  it('propagates failure results from a stage while allowing the pipeline to continue', async () => {
    const stageOne = new TestStage('ComponentFiltering', async () => {
      return new PipelineResult({
        success: false,
        errors: [
          {
            error: 'candidate lookup failed',
            phase: 'component_filtering',
            stageName: 'ComponentFiltering',
          },
        ],
        data: { stageOne: 'partial' },
        continueProcessing: true,
      });
    });

    const stageTwoExecution = jest.fn();
    const stageTwo = new TestStage('PrerequisiteEvaluation', async (context) => {
      stageTwoExecution(context.stageOne);
      return PipelineResult.success({
        actions: [{ id: 'action:beta' }],
      });
    });

    const pipeline = new Pipeline([stageOne, stageTwo], logger);

    const result = await pipeline.execute({
      actor: { id: 'actor:002' },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      {
        error: 'candidate lookup failed',
        phase: 'component_filtering',
        stageName: 'ComponentFiltering',
      },
    ]);
    expect(result.actions).toEqual([{ id: 'action:beta' }]);

    expect(stageTwoExecution).toHaveBeenCalledWith('partial');
    expect(logger.warn).toHaveBeenCalledWith(
      'Stage ComponentFiltering completed with errors'
    );

    const failureMessages = trace.logs
      .filter((entry) => entry.type === 'failure')
      .map((entry) => entry.message);
    expect(failureMessages).toContain(
      'Stage ComponentFiltering encountered errors'
    );
  });

  it('wraps thrown errors from stages into pipeline failure responses', async () => {
    const stageOne = new TestStage('ComponentFiltering', async () => {
      throw new Error('unhandled component failure');
    });

    const pipeline = new Pipeline([stageOne], logger);

    const result = await pipeline.execute({
      actor: { id: 'actor:003' },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      error: 'unhandled component failure',
      phase: 'PIPELINE_EXECUTION',
      stageName: 'ComponentFiltering',
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Pipeline stage ComponentFiltering threw an error: unhandled component failure',
      expect.any(Error)
    );

    const failureMessages = trace.logs
      .filter((entry) => entry.type === 'failure')
      .map((entry) => entry.message);
    expect(failureMessages).toContain(
      'Stage ComponentFiltering threw an error: unhandled component failure'
    );
  });

  it('wraps execution in a trace span when structured tracing is provided', async () => {
    const stageExecution = jest.fn(async () =>
      PipelineResult.success({ data: { span: 'completed' } })
    );
    const spanStage = new TestStage('ComponentFiltering', stageExecution);

    const info = jest.fn();
    const step = jest.fn();
    const failure = jest.fn();
    const success = jest.fn();

    const withSpanAsync = jest.fn(async (_label, fn, metadata) => {
      expect(metadata).toEqual({ stageCount: 1 });
      return fn();
    });

    const pipeline = new Pipeline([spanStage], logger);

    const result = await pipeline.execute({
      actor: { id: 'actor:004' },
      actionContext: {},
      candidateActions: [],
      trace: { withSpanAsync, info, step, failure, success },
    });

    expect(result.success).toBe(true);
    expect(stageExecution).toHaveBeenCalled();
    expect(withSpanAsync).toHaveBeenCalledWith(
      'Pipeline',
      expect.any(Function),
      { stageCount: 1 }
    );
    expect(info).toHaveBeenCalledWith(
      'Starting pipeline execution with 1 stages',
      'Pipeline.execute'
    );
  });

  it('records span metadata when stages run with trace span support', async () => {
    const successSpan = {
      setAttribute: jest.fn(),
      setError: jest.fn(),
      setStatus: jest.fn(),
    };
    const failureSpan = {
      setAttribute: jest.fn(),
      setError: jest.fn(),
      setStatus: jest.fn(),
    };
    const startSpan = jest
      .fn()
      .mockImplementation((stageName) =>
        stageName === 'SuccessfulStageStage' ? successSpan : failureSpan
      );
    const endSpan = jest.fn();

    const traceWithSpans = {
      startSpan,
      endSpan,
      info: jest.fn(),
      step: jest.fn(),
      failure: jest.fn(),
      success: jest.fn(),
    };

    const successStage = new TestStage('SuccessfulStage', async () => {
      const result = PipelineResult.success({
        data: { fromSuccessStage: true },
      });
      result.processedCount = 2;
      return result;
    });

    const failingStage = new TestStage('FailingStage', async () => {
      return PipelineResult.failure([
        {
          error: 'stage failure',
          phase: 'structured_span',
          stageName: 'FailingStage',
        },
      ]);
    });

    const pipeline = new Pipeline([successStage, failingStage], logger);

    const result = await pipeline.execute({
      actor: { id: 'actor:span' },
      actionContext: {},
      candidateActions: [{ id: 'candidate:1' }],
      trace: traceWithSpans,
    });

    expect(result.success).toBe(false);

    expect(startSpan).toHaveBeenCalledWith('SuccessfulStageStage', {
      stage: 'SuccessfulStage',
      actor: 'actor:span',
      candidateCount: 1,
    });
    expect(successSpan.setAttribute).toHaveBeenCalledWith('success', true);
    expect(successSpan.setAttribute).toHaveBeenCalledWith('processedCount', 2);
    expect(successSpan.setStatus).toHaveBeenCalledWith('success');
    expect(successSpan.setError).not.toHaveBeenCalled();

    expect(startSpan).toHaveBeenCalledWith('FailingStageStage', {
      stage: 'FailingStage',
      actor: 'actor:span',
      candidateCount: 1,
    });
    expect(failureSpan.setAttribute).toHaveBeenCalledWith('success', false);
    expect(failureSpan.setAttribute).toHaveBeenCalledWith('processedCount', 0);
    expect(failureSpan.setAttribute).toHaveBeenCalledWith('errorCount', 1);
    expect(failureSpan.setError).toHaveBeenCalledWith(expect.any(Error));
    expect(failureSpan.setStatus).not.toHaveBeenCalled();

    expect(endSpan).toHaveBeenCalledWith(successSpan);
    expect(endSpan).toHaveBeenCalledWith(failureSpan);
  });
});
