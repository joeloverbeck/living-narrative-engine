import { describe, it, expect, beforeEach } from '@jest/globals';

import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import { StructuredTrace } from '../../../../src/actions/tracing/structuredTrace.js';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';

class MemoryLogger {
  constructor() {
    this.logs = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  debug(message, ...args) {
    this.logs.debug.push({ message, args });
  }

  info(message, ...args) {
    this.logs.info.push({ message, args });
  }

  warn(message, ...args) {
    this.logs.warn.push({ message, args });
  }

  error(message, ...args) {
    this.logs.error.push({ message, args });
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

describe('Pipeline integration', () => {
  /** @type {MemoryLogger} */
  let logger;

  beforeEach(() => {
    logger = new MemoryLogger();
  });

  it('executes stages with structured trace and merges results', async () => {
    const stageContexts = [];

    const stageOne = new TestStage('StageOne', async (context) => {
      stageContexts.push({
        stage: 'StageOne',
        sawTrace: Boolean(context.trace),
      });

      return PipelineResult.success({
        actions: [{ id: 'stage-one-action' }],
        data: { stageOne: true, processedBy: ['stage1'] },
      });
    });

    const stageTwo = new TestStage('StageTwo', async (context) => {
      stageContexts.push({
        stage: 'StageTwo',
        stageOne: context.stageOne,
        inheritedActions: context.actions?.map((action) => action.id),
        processedBy: context.processedBy,
      });

      return new PipelineResult({
        success: false,
        continueProcessing: true,
        actions: [{ id: 'stage-two-action' }],
        errors: [
          {
            error: 'StageTwo warning',
            stageName: 'StageTwo',
            phase: 'component-analysis',
          },
        ],
        data: {
          stageTwo: true,
          processedBy: [...(context.processedBy || []), 'stage2'],
        },
      });
    });

    const stageThree = new TestStage('StageThree', async (context) => {
      stageContexts.push({
        stage: 'StageThree',
        stageTwo: context.stageTwo,
        receivedErrors: context.errors.length,
        processedBy: context.processedBy,
      });

      return new PipelineResult({
        success: true,
        continueProcessing: false,
        actions: [{ id: 'stage-three-action' }],
        data: {
          stageThree: true,
          processedBy: [...(context.processedBy || []), 'stage3'],
        },
      });
    });

    const pipeline = new Pipeline([stageOne, stageTwo, stageThree], logger);
    const trace = new StructuredTrace(new TraceContext());

    const result = await pipeline.execute({
      actor: { id: 'actor-123' },
      actionContext: { scope: 'integration' },
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.actions.map((action) => action.id)).toEqual([
      'stage-one-action',
      'stage-two-action',
      'stage-three-action',
    ]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      stageName: 'StageTwo',
      error: 'StageTwo warning',
    });

    expect(stageContexts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: 'StageOne', sawTrace: true }),
        expect.objectContaining({
          stage: 'StageTwo',
          stageOne: true,
          inheritedActions: ['stage-one-action'],
        }),
        expect.objectContaining({
          stage: 'StageThree',
          stageTwo: true,
          receivedErrors: 1,
        }),
      ])
    );

    expect(
      logger.logs.warn.some((entry) =>
        entry.message.includes('Stage StageTwo completed with errors')
      )
    ).toBe(true);
    expect(
      logger.logs.debug.some((entry) =>
        entry.message.includes('Stage StageThree indicated to stop processing')
      )
    ).toBe(true);

    const traceMessages = trace.logs.map((entry) => entry.message);
    expect(traceMessages).toEqual(
      expect.arrayContaining([
        'Starting pipeline execution with 3 stages',
        'Executing stage: StageOne',
        'Executing stage: StageTwo',
        'Executing stage: StageThree',
        'Stage StageTwo encountered errors',
        'Pipeline halted at stage: StageThree',
        'Pipeline execution completed. Actions: 3, Errors: 1',
      ])
    );
  });

  it('returns failure result when a stage throws an error', async () => {
    const stageOne = new TestStage('StageOne', async () =>
      PipelineResult.success({
        actions: [{ id: 'safe-action' }],
        data: { stageOne: true },
      })
    );

    const stageTwo = new TestStage('StageTwo', async () => {
      throw new Error('boom');
    });

    const pipeline = new Pipeline([stageOne, stageTwo], logger);
    const trace = new StructuredTrace(new TraceContext());

    const result = await pipeline.execute({
      actor: { id: 'actor-999' },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.actions.map((action) => action.id)).toEqual(['safe-action']);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      phase: 'PIPELINE_EXECUTION',
      stageName: 'StageTwo',
      error: 'boom',
    });

    expect(
      logger.logs.error.some((entry) =>
        entry.message.includes('Pipeline stage StageTwo threw an error: boom')
      )
    ).toBe(true);
    expect(
      trace.logs.some((entry) =>
        entry.message.includes('Stage StageTwo threw an error: boom')
      )
    ).toBe(true);
  });

  it('requires at least one stage', () => {
    expect(() => new Pipeline([], logger)).toThrow(
      'Pipeline requires at least one stage'
    );
    expect(() => new Pipeline(null, logger)).toThrow(
      'Pipeline requires at least one stage'
    );
  });
});
