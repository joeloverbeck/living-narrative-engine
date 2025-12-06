import { describe, it, expect, beforeEach } from '@jest/globals';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import {
  TraceContext,
  TRACE_INFO,
  TRACE_SUCCESS,
  TRACE_FAILURE,
  TRACE_STEP,
  TRACE_ERROR,
  TRACE_DATA,
} from '../../../../src/actions/tracing/traceContext.js';

class RecordingLogger {
  constructor() {
    this.records = [];
  }

  #push(level, message, extra) {
    this.records.push({ level, message, extra });
  }

  debug(message, extra) {
    this.#push('debug', message, extra);
  }

  info(message, extra) {
    this.#push('info', message, extra);
  }

  warn(message, extra) {
    this.#push('warn', message, extra);
  }

  error(message, extra) {
    this.#push('error', message, extra);
  }
}

class TestStage extends PipelineStage {
  constructor(name, handler) {
    super(name);
    this.handler = handler;
  }

  async executeInternal(context) {
    return this.handler(context);
  }
}

describe('Pipeline & TraceContext integration', () => {
  let logger;
  let trace;
  let actor;
  let actionContext;

  beforeEach(() => {
    logger = new RecordingLogger();
    trace = new TraceContext();
    actor = { id: 'actor:test' };
    actionContext = { scene: 'integration-test' };
  });

  const buildInitialContext = (overrides = {}) => ({
    actor,
    actionContext,
    candidateActions: overrides.candidateActions ?? [],
    trace,
    ...overrides,
  });

  it('records comprehensive trace data when a stage halts processing intentionally', async () => {
    const stageOne = new TestStage('component-filtering', (context) => {
      context.trace.data('Component filtering input', 'component-filtering', {
        initialCandidateCount: context.candidateActions.length,
      });

      context.trace.data(
        'Component filtering heartbeat',
        'component-filtering'
      );

      context.trace.info('Filtering with payload', 'component-filtering', {
        actorId: context.actor.id,
      });

      context.trace.captureOperatorEvaluation({
        operator: 'dummy-operator',
        entityId: context.actor.id,
        result: true,
        reason: 'stage simulated successful filter',
      });

      context.trace.success(
        'Component filtering passed',
        'component-filtering',
        { candidateCount: context.candidateActions.length }
      );

      context.trace.step('Advanced filtering details', 'component-filtering', {
        stage: 'component-filtering',
      });

      context.trace.failure(
        'Soft failure for diagnostics',
        'component-filtering',
        {
          recovered: true,
        }
      );

      context.trace.error('Pre-validation warning', 'component-filtering');

      return PipelineResult.success({
        actions: [{ id: 'action:one' }],
        data: { filtered: true },
        continueProcessing: false,
      });
    });

    let stageTwoExecuted = false;
    const stageTwo = new TestStage('prerequisites', () => {
      stageTwoExecuted = true;
      return PipelineResult.success({});
    });

    const pipeline = new Pipeline([stageOne, stageTwo], logger);
    const result = await pipeline.execute(
      buildInitialContext({ candidateActions: [{ id: 'action:one' }] })
    );

    expect(stageTwoExecuted).toBe(false);
    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.errors).toHaveLength(0);

    const types = trace.logs.map((entry) => entry.type);
    expect(types).toEqual(
      expect.arrayContaining([
        TRACE_INFO,
        TRACE_STEP,
        TRACE_SUCCESS,
        TRACE_DATA,
        TRACE_FAILURE,
        TRACE_ERROR,
      ])
    );

    const haltLog = trace.logs.find(
      (entry) =>
        entry.type === TRACE_INFO && entry.message.includes('Pipeline halted')
    );
    expect(haltLog).toBeDefined();

    const evaluations = trace.getOperatorEvaluations();
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0]).toMatchObject({
      operator: 'dummy-operator',
      entityId: actor.id,
      result: true,
      type: 'operator_evaluation',
    });
  });

  it('continues execution while tracking failures when a stage reports recoverable errors', async () => {
    const stageOne = new TestStage('prerequisite-evaluation', () => {
      return new PipelineResult({
        success: false,
        errors: [
          {
            error: 'Missing movement component',
            phase: 'PREREQUISITE',
            stageName: 'prerequisite-evaluation',
          },
        ],
        data: { recoverable: true },
        continueProcessing: true,
      });
    });

    let formattingExecuted = false;
    const stageTwo = new TestStage('formatting', (context) => {
      formattingExecuted = true;
      context.trace.error(
        'Formatting invoked despite upstream warning',
        'formatting',
        {
          recoverable: context.recoverable === true,
        }
      );

      return PipelineResult.success({
        actions: [{ id: 'action:formatted' }],
      });
    });

    const pipeline = new Pipeline([stageOne, stageTwo], logger);
    const result = await pipeline.execute(buildInitialContext());

    expect(formattingExecuted).toBe(true);
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      stageName: 'prerequisite-evaluation',
    });

    const failureLog = trace.logs.find(
      (entry) =>
        entry.type === TRACE_FAILURE &&
        entry.message.includes('prerequisite-evaluation')
    );
    expect(failureLog).toBeDefined();

    const errorLog = trace.logs.find(
      (entry) =>
        entry.type === TRACE_ERROR &&
        entry.message.includes('Formatting invoked')
    );
    expect(errorLog?.data).toMatchObject({ recoverable: true });
  });

  it('captures thrown stage errors and stops further execution', async () => {
    const stageOne = new TestStage('target-resolution', () => {
      throw new Error('resolution explosion');
    });

    let stageTwoExecuted = false;
    const stageTwo = new TestStage('formatting', () => {
      stageTwoExecuted = true;
      return PipelineResult.success({});
    });

    const pipeline = new Pipeline([stageOne, stageTwo], logger);
    const result = await pipeline.execute(buildInitialContext());

    expect(stageTwoExecuted).toBe(false);
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      stageName: 'target-resolution',
      phase: 'PIPELINE_EXECUTION',
    });

    const failureLog = trace.logs.find(
      (entry) =>
        entry.type === TRACE_FAILURE &&
        entry.message.includes('target-resolution threw an error')
    );
    expect(failureLog).toBeDefined();
  });
});
