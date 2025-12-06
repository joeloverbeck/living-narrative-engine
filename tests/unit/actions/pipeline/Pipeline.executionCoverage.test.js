import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';

describe('Pipeline execution coverage', () => {
  const createLogger = () => ({
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  });

  const createTrace = (overrides = {}) => ({
    info: jest.fn(),
    step: jest.fn(),
    success: jest.fn(),
    failure: jest.fn(),
    ...overrides,
  });

  const baseContext = () => ({
    actor: { id: 'actor-1' },
    actionContext: { turn: 1 },
    candidateActions: [],
  });

  it('throws when stages are not provided', () => {
    const logger = createLogger();

    expect(() => new Pipeline(undefined, logger)).toThrow(
      'Pipeline requires at least one stage'
    );
    expect(() => new Pipeline([], logger)).toThrow(
      'Pipeline requires at least one stage'
    );
  });

  it('wraps execution in a structured trace span when available', async () => {
    const logger = createLogger();
    const stageResult = PipelineResult.success();
    const stage = {
      name: 'StructuredStage',
      execute: jest.fn().mockResolvedValue(stageResult),
    };

    const trace = createTrace({
      withSpanAsync: jest.fn(async (name, handler, meta) => {
        expect(name).toBe('Pipeline');
        expect(meta).toEqual({ stageCount: 1 });
        return handler();
      }),
    });

    const pipeline = new Pipeline([stage], logger);
    const result = await pipeline.execute({
      ...baseContext(),
      trace,
    });

    expect(stage.execute).toHaveBeenCalledTimes(1);
    expect(trace.withSpanAsync).toHaveBeenCalledTimes(1);
    expect(trace.info).toHaveBeenCalledWith(
      'Starting pipeline execution with 1 stages',
      'Pipeline.execute'
    );
    expect(trace.success).toHaveBeenCalledWith(
      'Stage StructuredStage completed successfully',
      'Pipeline.execute'
    );
    expect(result.success).toBe(true);
    expect(result.actions).toEqual([]);
  });

  it('executes stages sequentially and merges their results', async () => {
    const logger = createLogger();
    const trace = createTrace();

    const stageOneResult = PipelineResult.success({
      data: { fromStageOne: true },
      actions: [{ id: 'a1' }],
      errors: [{ message: 'warning' }],
    });
    const stageTwoResult = PipelineResult.success({
      data: { fromStageTwo: true },
      actions: [{ id: 'a2' }],
    });

    const stageOne = {
      name: 'StageOne',
      execute: jest.fn().mockResolvedValue(stageOneResult),
    };
    const stageTwo = {
      name: 'StageTwo',
      execute: jest.fn().mockResolvedValue(stageTwoResult),
    };

    const pipeline = new Pipeline([stageOne, stageTwo], logger);
    const initialContext = { ...baseContext(), trace };

    const result = await pipeline.execute(initialContext);

    expect(stageOne.execute).toHaveBeenCalledWith(
      expect.objectContaining({ actor: initialContext.actor })
    );
    const stageTwoContext = stageTwo.execute.mock.calls[0][0];
    expect(stageTwoContext.fromStageOne).toBe(true);
    expect(stageTwoContext.actions).toEqual(stageOneResult.actions);
    expect(stageTwoContext.errors).toEqual(stageOneResult.errors);
    expect(logger.debug).toHaveBeenCalledWith(
      'Executing pipeline stage: StageOne'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'Executing pipeline stage: StageTwo'
    );
    expect(trace.success).toHaveBeenLastCalledWith(
      'Stage StageTwo completed successfully',
      'Pipeline.execute'
    );
    expect(trace.info).toHaveBeenCalledWith(
      'Pipeline execution completed. Actions: 2, Errors: 1',
      'Pipeline.execute'
    );
    expect(result.success).toBe(true);
    expect(result.actions).toEqual([
      ...stageOneResult.actions,
      ...stageTwoResult.actions,
    ]);
    expect(result.errors).toEqual(stageOneResult.errors);
  });

  it('halts execution when a stage requests to stop processing', async () => {
    const logger = createLogger();
    const trace = createTrace();

    const haltingResult = PipelineResult.success({
      continueProcessing: false,
      actions: [{ id: 'halt' }],
    });

    const haltingStage = {
      name: 'HaltingStage',
      execute: jest.fn().mockResolvedValue(haltingResult),
    };
    const skippedStage = { name: 'Skipped', execute: jest.fn() };

    const pipeline = new Pipeline([haltingStage, skippedStage], logger);
    const result = await pipeline.execute({ ...baseContext(), trace });

    expect(skippedStage.execute).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      'Stage HaltingStage indicated to stop processing'
    );
    expect(trace.info).toHaveBeenCalledWith(
      'Pipeline halted at stage: HaltingStage',
      'Pipeline.execute'
    );
    expect(result.actions).toEqual([{ id: 'halt' }]);
  });

  it('warns when a stage completes with errors but allows continuation', async () => {
    const logger = createLogger();
    const trace = createTrace();

    const stageOneResult = new PipelineResult({
      success: false,
      continueProcessing: true,
      data: { partial: true },
      errors: [{ message: 'issue' }],
    });
    const stageTwoResult = PipelineResult.success();

    const stageOne = {
      name: 'FlakyStage',
      execute: jest.fn().mockResolvedValue(stageOneResult),
    };
    const stageTwo = {
      name: 'RecoveryStage',
      execute: jest.fn().mockResolvedValue(stageTwoResult),
    };

    const pipeline = new Pipeline([stageOne, stageTwo], logger);
    const result = await pipeline.execute({ ...baseContext(), trace });

    expect(logger.warn).toHaveBeenCalledWith(
      'Stage FlakyStage completed with errors'
    );
    expect(trace.failure).toHaveBeenCalledWith(
      'Stage FlakyStage encountered errors',
      'Pipeline.execute'
    );
    expect(stageTwo.execute).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.errors).toEqual(stageOneResult.errors);
  });

  it('returns a failure result when a stage throws an error', async () => {
    const logger = createLogger();
    const trace = createTrace();

    const successfulStage = {
      name: 'SuccessfulStage',
      execute: jest
        .fn()
        .mockResolvedValue(PipelineResult.success({ actions: ['ok'] })),
    };

    const failingStage = {
      name: 'FailingStage',
      execute: jest.fn().mockRejectedValue(new Error('boom')),
    };

    const pipeline = new Pipeline([successfulStage, failingStage], logger);
    const result = await pipeline.execute({ ...baseContext(), trace });

    expect(logger.error).toHaveBeenCalledWith(
      'Pipeline stage FailingStage threw an error: boom',
      expect.any(Error)
    );
    expect(trace.failure).toHaveBeenCalledWith(
      'Stage FailingStage threw an error: boom',
      'Pipeline.execute'
    );
    expect(result.success).toBe(false);
    expect(result.actions).toEqual(['ok']);
    expect(result.errors[0]).toMatchObject({
      error: 'boom',
      stageName: 'FailingStage',
      phase: 'PIPELINE_EXECUTION',
    });
  });
});
