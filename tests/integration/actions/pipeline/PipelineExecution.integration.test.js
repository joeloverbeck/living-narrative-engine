import { describe, it, expect } from '@jest/globals';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import { StructuredTrace } from '../../../../src/actions/tracing/structuredTrace.js';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';

class RecordingLogger {
  constructor() {
    this.debugMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message, details) {
    this.debugMessages.push({ message, details });
  }

  info(message, details) {
    this.debugMessages.push({ message, details, level: 'info' });
  }

  warn(message, details) {
    this.warnMessages.push({ message, details });
  }

  error(message, error) {
    this.errorMessages.push({ message, error });
  }
}

class TestStage extends PipelineStage {
  constructor(name, impl) {
    super(name);
    this.impl = impl;
    this.executions = 0;
  }

  async executeInternal(context) {
    this.executions += 1;
    return this.impl(context);
  }
}

describe('Pipeline integration execution', () => {
  const baseContext = {
    actor: { id: 'actor-001' },
    actionContext: { location: 'test-location' },
    candidateActions: [{ id: 'candidate:1' }],
  };

  it('executes all stages with structured tracing and merges results', async () => {
    const logger = new RecordingLogger();
    const trace = new StructuredTrace();

    const filteringStage = new TestStage('ComponentFiltering', async (context) => {
      expect(context.candidateActions).toHaveLength(1);
      const result = PipelineResult.success({
        actions: [{ id: 'candidate:1', name: 'Filtered Action' }],
        data: { filtered: ['candidate:1'] },
      });
      result.processedCount = 1;
      return result;
    });

    const formattingStage = new TestStage('ActionFormatting', async (context) => {
      expect(context.filtered).toEqual(['candidate:1']);
      expect(context.actions).toHaveLength(1);
      const result = PipelineResult.success({
        actions: [{ id: 'candidate:1:formatted', name: 'Formatted Action' }],
        errors: [
          {
            error: 'non-critical formatting issue',
            phase: 'FORMAT',
            stageName: 'ActionFormatting',
          },
        ],
        data: { formatted: true },
      });
      result.processedCount = context.actions.length + 1;
      return result;
    });

    const finalizeStage = new TestStage('Finalize', async (context) => {
      expect(context.actions).toHaveLength(2);
      return PipelineResult.success({
        data: { finalized: true },
      });
    });

    const pipeline = new Pipeline(
      [filteringStage, formattingStage, finalizeStage],
      logger
    );

    const result = await pipeline.execute({ ...baseContext, trace });

    expect(result.success).toBe(true);
    expect(result.actions.map((action) => action.id)).toEqual([
      'candidate:1',
      'candidate:1:formatted',
    ]);
    expect(result.errors).toHaveLength(1);
    expect(result.data.filtered).toEqual(['candidate:1']);
    expect(result.data.formatted).toBe(true);
    expect(result.data.finalized).toBe(true);

    expect(filteringStage.executions).toBe(1);
    expect(formattingStage.executions).toBe(1);
    expect(finalizeStage.executions).toBe(1);

    expect(logger.debugMessages.some(({ message }) =>
      message.includes('Executing pipeline stage: ComponentFiltering')
    )).toBe(true);
    expect(logger.debugMessages.some(({ message }) =>
      message.includes('Executing pipeline stage: ActionFormatting')
    )).toBe(true);

    const rootSpan = trace.getHierarchicalView();
    expect(rootSpan?.operation).toBe('Pipeline');
    expect(rootSpan?.children.map((child) => child.operation)).toEqual([
      'ComponentFilteringStage',
      'ActionFormattingStage',
      'FinalizeStage',
    ]);

    const infoLogs = trace.logs.filter((entry) => entry.type === 'info');
    expect(infoLogs.some((entry) =>
      entry.message.includes('Starting pipeline execution with 3 stages')
    )).toBe(true);
    expect(infoLogs.some((entry) =>
      entry.message.includes('Pipeline execution completed')
    )).toBe(true);
  });

  it('stops executing when a stage disables further processing', async () => {
    const logger = new RecordingLogger();
    const trace = new TraceContext();

    const haltingStage = new TestStage('Halting', async () => {
      return PipelineResult.success({
        actions: [{ id: 'only-action' }],
        data: { halted: true },
        continueProcessing: false,
      });
    });

    const skippedStage = new TestStage('Skipped', async () => {
      throw new Error('This stage should not run');
    });

    const pipeline = new Pipeline([haltingStage, skippedStage], logger);
    const result = await pipeline.execute({ ...baseContext, trace });

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.data.halted).toBe(true);
    expect(haltingStage.executions).toBe(1);
    expect(skippedStage.executions).toBe(0);

    expect(logger.debugMessages.some(({ message }) =>
      message.includes('Stage Halting indicated to stop processing')
    )).toBe(true);
    expect(trace.logs.some((entry) =>
      entry.type === 'info' && entry.message.includes('Pipeline execution completed')
    )).toBe(true);
  });

  it('merges failure results and marks structured spans as errors', async () => {
    const logger = new RecordingLogger();
    const trace = new StructuredTrace();

    const failingStage = new TestStage('Validation', async () => {
      const failure = new PipelineResult({
        success: false,
        errors: [
          {
            error: 'validation failed',
            phase: 'VALIDATION',
            stageName: 'Validation',
          },
        ],
        continueProcessing: true,
      });
      failure.processedCount = 0;
      return failure;
    });

    const pipeline = new Pipeline([failingStage], logger);
    const result = await pipeline.execute({ ...baseContext, trace });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(logger.warnMessages.some(({ message }) =>
      message.includes('Stage Validation completed with errors')
    )).toBe(true);

    const rootSpan = trace.getHierarchicalView();
    expect(rootSpan?.children?.[0]?.status).toBe('error');
    expect(trace.logs.some((entry) => entry.type === 'failure')).toBe(true);
  });

  it('converts thrown errors into pipeline failure results', async () => {
    const logger = new RecordingLogger();
    const trace = new StructuredTrace();

    const safeStage = new TestStage('SafeStage', async () => {
      return PipelineResult.success({
        actions: [{ id: 'safe-action' }],
        data: { safe: true },
      });
    });

    const explodingStage = new TestStage('ExplodingStage', async () => {
      throw new Error('stage explosion');
    });

    const pipeline = new Pipeline([safeStage, explodingStage], logger);
    const result = await pipeline.execute({ ...baseContext, trace });

    expect(result.success).toBe(false);
    expect(result.actions).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].phase).toBe('PIPELINE_EXECUTION');
    expect(result.errors[0].stageName).toBe('ExplodingStage');
    expect(result.errors[0].context.error).toContain('stage explosion');

    expect(logger.errorMessages[0].message).toContain('stage explosion');
    expect(trace.logs.some((entry) =>
      entry.type === 'failure' && entry.message.includes('Stage ExplodingStage threw an error')
    )).toBe(true);
  });

  it('supports chaining ActionResult helpers within pipeline stages', async () => {
    const logger = new RecordingLogger();
    const trace = new TraceContext();

    const fromActionResultStage = new TestStage('FromActionResult', async () => {
      const actionResult = ActionResult.success({ derived: ['candidate:1'] });
      return PipelineResult.fromActionResult(actionResult, { origin: 'dsl' });
    });

    const chainSuccessStage = new TestStage('ChainSuccess', async (context) => {
      expect(context.origin).toBe('dsl');
      const base = PipelineResult.success({ data: { chainBase: true } });
      return base.chainActionResult(() =>
        ActionResult.success({ chainExtra: context.origin })
      );
    });

    const chainFailureStage = new TestStage('ChainFailure', async () => {
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

    expect(fromActionResultStage.executions).toBe(1);
    expect(chainSuccessStage.executions).toBe(1);
    expect(chainFailureStage.executions).toBe(1);

    expect(logger.debugMessages.some(({ message }) =>
      message.includes('Stage ChainFailure indicated to stop processing')
    )).toBe(true);
    expect(trace.logs.some((entry) =>
      entry.type === 'info' && entry.message.includes('Pipeline execution completed')
    )).toBe(true);
    expect(trace.logs.some((entry) =>
      entry.type === 'failure' && entry.message.includes('Pipeline execution completed')
    )).toBe(false);
  });

  it('throws when constructed without stages', () => {
    const logger = new RecordingLogger();
    expect(() => new Pipeline([], logger)).toThrow(
      'Pipeline requires at least one stage'
    );
  });
});
