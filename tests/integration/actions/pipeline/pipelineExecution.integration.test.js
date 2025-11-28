import { describe, test, expect } from '@jest/globals';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import ConsoleLogger, {
  LogLevel,
} from '../../../../src/logging/consoleLogger.js';
import { StructuredTrace } from '../../../../src/actions/tracing/structuredTrace.js';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';

class RecordingStage extends PipelineStage {
  #handler;
  #receivedStates = [];

  constructor(name, handler) {
    super(name);
    this.#handler = handler;
  }

  get receivedStates() {
    return this.#receivedStates.map((state) => ({ ...state }));
  }

  async executeInternal(context) {
    const snapshot = {
      actions: context.actions ? context.actions.map((a) => a.id) : [],
      errors: context.errors ? context.errors.length : 0,
      dataKeys: Object.keys(context.data || {}),
      continueProcessing: context.continueProcessing,
    };
    this.#receivedStates.push(snapshot);
    return this.#handler(context);
  }
}

describe('Pipeline integration', () => {
  const actor = { id: 'actor-1' };
  const baseContext = {
    actor,
    actionContext: { tick: 1 },
    candidateActions: [],
  };

  const createLogger = () => new ConsoleLogger(LogLevel.NONE);

  test('executes all stages with structured trace and merges results', async () => {
    const logger = createLogger();
    const trace = new StructuredTrace();
    const stageOrder = [];

    const discoveryStage = new RecordingStage('Discovery', () => {
      stageOrder.push('discovery');
      return PipelineResult.success({
        actions: [{ id: 'discover-action' }],
        data: { discovered: true },
      }).chainActionResult(() =>
        ActionResult.success({ discoveredChain: true })
      );
    });

    const enrichmentStage = new RecordingStage('Enrichment', (context) => {
      stageOrder.push('enrichment');
      const enrichmentResult = ActionResult.success({
        enriched: context.actions.length,
      });
      return PipelineResult.fromActionResult(enrichmentResult, {
        enrichmentNoted: true,
      });
    });

    const finalizerStage = new RecordingStage('Finalizer', (context) => {
      stageOrder.push('finalizer');
      return PipelineResult.success({
        actions: [{ id: `final-${context.actions.length}` }],
        data: { finalStamp: true },
      });
    });

    const pipeline = new Pipeline(
      [discoveryStage, enrichmentStage, finalizerStage],
      logger
    );

    const result = await pipeline.execute({ ...baseContext, trace });

    expect(result.success).toBe(true);
    expect(result.actions.map((a) => a.id)).toEqual([
      'discover-action',
      'final-1',
    ]);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toEqual({
      discovered: true,
      discoveredChain: true,
      enrichmentNoted: true,
      enriched: 1,
      finalStamp: true,
    });
    expect(stageOrder).toEqual(['discovery', 'enrichment', 'finalizer']);

    const hierarchy = trace.getHierarchicalView();
    expect(hierarchy.operation).toBe('Pipeline');
    expect(hierarchy.children.map((child) => child.operation)).toEqual([
      'DiscoveryStage',
      'EnrichmentStage',
      'FinalizerStage',
    ]);
    expect(hierarchy.children.every((child) => child.status === 'success')).toBe(
      true
    );
  });

  test('halts when a stage marks continueProcessing false', async () => {
    const logger = createLogger();
    const trace = new TraceContext();
    const executed = [];
    let skippedStageRan = false;

    const firstStage = new RecordingStage('First', () => {
      executed.push('first');
      return PipelineResult.success({
        data: { firstPass: true },
      });
    });

    const haltingStage = new RecordingStage('Halting', () => {
      executed.push('halting');
      return PipelineResult.success({
        data: { halted: true },
        continueProcessing: false,
      });
    });

    const skippedStage = new RecordingStage('Skipped', () => {
      skippedStageRan = true;
      return PipelineResult.success({
        data: { shouldNotRun: true },
      });
    });

    const pipeline = new Pipeline(
      [firstStage, haltingStage, skippedStage],
      logger
    );

    const result = await pipeline.execute({ ...baseContext, trace });

    expect(executed).toEqual(['first', 'halting']);
    expect(skippedStageRan).toBe(false);
    expect(result.success).toBe(true);
    expect(result.continueProcessing).toBe(false);
    expect(result.data).toEqual({ firstPass: true, halted: true });
  });

  test('merges failures from stages into the cumulative result', async () => {
    const logger = createLogger();
    const trace = new StructuredTrace();
    let skipped = false;

    const starter = new RecordingStage('Starter', () =>
      PipelineResult.success({ data: { starter: true } })
    );

    const failingContext = { error: 'validation failed', stageName: 'Validator' };
    const validator = new RecordingStage('Validator', () =>
      PipelineResult.failure([failingContext], { validator: true })
    );

    const skippedStage = new RecordingStage('AfterFailure', () => {
      skipped = true;
      return PipelineResult.success({ data: { after: true } });
    });

    const pipeline = new Pipeline([starter, validator, skippedStage], logger);

    const result = await pipeline.execute({ ...baseContext, trace });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual([failingContext]);
    expect(result.data).toEqual({ starter: true, validator: true });
    expect(skipped).toBe(false);

    const hierarchy = trace.getHierarchicalView();
    expect(hierarchy.children[1].operation).toBe('ValidatorStage');
    expect(hierarchy.children[1].status).toBe('error');
  });

  test('converts thrown stage errors into pipeline failures', async () => {
    const logger = createLogger();
    const trace = new StructuredTrace();

    const goodStage = new RecordingStage('Good', () =>
      PipelineResult.success({
        actions: [{ id: 'good' }],
        data: { good: true },
      })
    );

    const crashStage = new RecordingStage('Crash', () => {
      throw new Error('boom');
    });

    const notRunStage = new RecordingStage('NotRun', () =>
      PipelineResult.success({ data: { shouldNotRun: true } })
    );

    const pipeline = new Pipeline([goodStage, crashStage, notRunStage], logger);

    const result = await pipeline.execute({ ...baseContext, trace });

    expect(result.success).toBe(false);
    expect(result.actions.map((a) => a.id)).toEqual(['good']);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      error: 'boom',
      stageName: 'Crash',
      phase: 'PIPELINE_EXECUTION',
    });

    const crashSpan = trace.getHierarchicalView().children.find(
      (child) => child.operation === 'CrashStage'
    );
    expect(crashSpan.status).toBe('error');
    expect(crashSpan.error).toBe('boom');
  });

  test('respects failures generated through chainActionResult', async () => {
    const logger = createLogger();
    const trace = new TraceContext();
    let skipped = false;

    const chainStage = new RecordingStage('Chain', () => {
      const initial = PipelineResult.success({ data: { before: true } });
      return initial.chainActionResult(() =>
        ActionResult.failure([{ message: 'chain failure', code: 'CHAIN' }])
      );
    });

    const skippedStage = new RecordingStage('SkippedAfterChain', () => {
      skipped = true;
      return PipelineResult.success({ data: { unexpected: true } });
    });

    const pipeline = new Pipeline([chainStage, skippedStage], logger);
    const result = await pipeline.execute({ ...baseContext, trace });

    expect(result.success).toBe(false);
    expect(result.data).toEqual({ before: true });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBeInstanceOf(Error);
    expect(result.errors[0].message).toBe('chain failure');
    expect(skipped).toBe(false);
  });

  test('throws when instantiated without stages', () => {
    const logger = createLogger();
    expect(() => new Pipeline([], logger)).toThrow(
      'Pipeline requires at least one stage'
    );
    expect(() => new Pipeline(null, logger)).toThrow(
      'Pipeline requires at least one stage'
    );
  });

  test('chains ActionResult helpers through multiple pipeline stages with mixed outcomes', async () => {
    const logger = createLogger();
    const trace = new TraceContext();

    const fromActionResultStage = new RecordingStage('FromActionResult', () => {
      const actionResult = ActionResult.success({ derived: ['candidate:1'] });
      return PipelineResult.fromActionResult(actionResult, { origin: 'dsl' });
    });

    const chainSuccessStage = new RecordingStage('ChainSuccess', (context) => {
      expect(context.origin).toBe('dsl');
      const base = PipelineResult.success({ data: { chainBase: true } });
      return base.chainActionResult(() =>
        ActionResult.success({ chainExtra: context.origin })
      );
    });

    const chainFailureStage = new RecordingStage('ChainFailure', () => {
      const base = PipelineResult.success({ data: { shouldPersist: true } });
      return base.chainActionResult(() =>
        ActionResult.failure(new Error('chain explosion'))
      );
    });

    const pipeline = new Pipeline(
      [fromActionResultStage, chainSuccessStage, chainFailureStage],
      logger
    );

    const result = await pipeline.execute({ ...baseContext, trace });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('chain explosion');

    expect(result.data.origin).toBe('dsl');
    expect(result.data.chainBase).toBe(true);
    expect(result.data.chainExtra).toBe('dsl');
    expect(result.data.shouldPersist).toBe(true);

    expect(trace.logs.some((entry) =>
      entry.type === 'info' && entry.message.includes('Pipeline execution completed')
    )).toBe(true);
  });
});
