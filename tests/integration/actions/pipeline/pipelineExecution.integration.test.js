import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';

function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

class RecordingTrace {
  constructor() {
    this.events = [];
  }

  withSpanAsync(name, fn, metadata) {
    this.events.push({ type: 'withSpan', name, metadata });
    return Promise.resolve().then(() => fn());
  }

  startSpan(name, attributes = {}) {
    const record = { name, attributes, status: null };
    this.events.push({ type: 'spanStart', name, attributes });
    return {
      name,
      setAttribute: (key, value) => {
        record.attributes[key] = value;
        this.events.push({ type: 'spanAttribute', name, key, value });
      },
      setError: (error) => {
        record.error = error;
        this.events.push({ type: 'spanError', name, message: error.message });
      },
      setStatus: (status) => {
        record.status = status;
        this.events.push({ type: 'spanStatus', name, status });
      },
    };
  }

  endSpan(span) {
    this.events.push({ type: 'spanEnd', name: span.name });
  }

  step(message, source) {
    this.events.push({ type: 'step', message, source });
  }

  info(message, source, data) {
    this.events.push({ type: 'info', message, source, data });
  }

  success(message, source, data) {
    this.events.push({ type: 'success', message, source, data });
  }

  failure(message, source, data) {
    this.events.push({ type: 'failure', message, source, data });
  }

  data(message, source, data) {
    this.events.push({ type: 'data', message, source, data });
  }
}

class TestStage extends PipelineStage {
  constructor(name, executeImpl) {
    super(name);
    this.executeImpl = executeImpl;
    this.calls = [];
  }

  async executeInternal(context) {
    this.calls.push(context);
    return this.executeImpl(context);
  }
}

describe('Integration – Pipeline execution', () => {
  let actor;
  let baseContext;

  beforeEach(() => {
    actor = { id: 'actor-1' };
    baseContext = { scene: 'test-scene' };
  });

  it('executes stages sequentially with structured trace and respects continueProcessing flag', async () => {
    const logger = createLogger();
    const trace = new RecordingTrace();

    const stageOne = new TestStage('StageOne', () =>
      PipelineResult.success({
        actions: [{ id: 'action-one' }],
        data: { fromStageOne: true },
      })
    );

    const stageTwo = new TestStage('StageTwo', () =>
      PipelineResult.success({
        data: { fromStageTwo: true },
        continueProcessing: false,
      })
    );

    const stageThree = new TestStage('StageThree', () =>
      PipelineResult.success({ data: { unreachable: true } })
    );

    const pipeline = new Pipeline([stageOne, stageTwo, stageThree], logger);

    const result = await pipeline.execute({
      actor,
      actionContext: baseContext,
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.actions).toEqual([{ id: 'action-one' }]);
    expect(result.errors).toEqual([]);
    expect(result.data).toMatchObject({
      fromStageOne: true,
      fromStageTwo: true,
    });
    expect(stageOne.calls).toHaveLength(1);
    expect(stageTwo.calls).toHaveLength(1);
    expect(stageThree.calls).toHaveLength(0);

    const spanEvents = trace.events.filter((event) => event.type === 'spanStatus');
    expect(spanEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'spanStatus', status: 'success' }),
      ])
    );
  });

  it('merges failure results from stages without structured trace wrapper', async () => {
    const logger = createLogger();
    const trace = { step: jest.fn(), info: jest.fn(), success: jest.fn(), failure: jest.fn() };

    const stageOne = new TestStage('ComponentFilter', () =>
      PipelineResult.success({ data: { candidates: 2 } })
    );

    const stageTwo = new TestStage('Validation', () =>
      PipelineResult.failure(
        [
          {
            error: 'Target validation failed',
            stageName: 'Validation',
          },
        ],
        { failed: true }
      )
    );

    const stageThree = new TestStage('Formatting', () =>
      PipelineResult.success({ data: { formatted: true } })
    );

    const pipeline = new Pipeline([stageOne, stageTwo, stageThree], logger);

    const result = await pipeline.execute({
      actor,
      actionContext: baseContext,
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      error: 'Target validation failed',
      stageName: 'Validation',
    });
    expect(result.data).toMatchObject({ candidates: 2, failed: true });
    expect(stageThree.calls).toHaveLength(0);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('captures stage exceptions as pipeline execution errors', async () => {
    const logger = createLogger();
    const trace = { step: jest.fn(), info: jest.fn(), success: jest.fn(), failure: jest.fn() };

    const stageOne = new TestStage('StageOne', () => PipelineResult.success({}));
    const failingStage = new TestStage('ExplosiveStage', () => {
      throw new Error('Exploded during execution');
    });

    const pipeline = new Pipeline([stageOne, failingStage], logger);

    const result = await pipeline.execute({
      actor,
      actionContext: baseContext,
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      error: 'Exploded during execution',
      stageName: 'ExplosiveStage',
      phase: 'PIPELINE_EXECUTION',
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Pipeline stage ExplosiveStage threw an error'),
      expect.any(Error)
    );
  });
});
