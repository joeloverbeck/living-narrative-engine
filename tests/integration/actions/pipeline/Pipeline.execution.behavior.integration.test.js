import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';

/**
 * Helper to create a mock logger that exposes the interface expected by the pipeline.
 */
const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('Pipeline integration behavior', () => {
  let logger;

  beforeEach(() => {
    logger = createLogger();
  });

  describe('constructor validation', () => {
    it('throws when provided stages are not a non-empty array', () => {
      expect(() => new Pipeline([], logger)).toThrow(
        'Pipeline requires at least one stage'
      );
      expect(() => new Pipeline(null, logger)).toThrow(
        'Pipeline requires at least one stage'
      );
    });
  });

  describe('execution flow', () => {
    it('wraps execution in a structured trace span when available', async () => {
      const stage = {
        name: 'TestStage',
        execute: jest.fn().mockResolvedValue(PipelineResult.success()),
      };
      const withSpanAsync = jest
        .fn()
        .mockImplementation(async (name, handler) => {
          return handler();
        });
      const trace = {
        withSpanAsync,
        info: jest.fn(),
        step: jest.fn(),
        success: jest.fn(),
        failure: jest.fn(),
      };
      const pipeline = new Pipeline([stage], logger);

      const result = await pipeline.execute({
        actor: { id: 'actor-1' },
        actionContext: { actorId: 'actor-1' },
        candidateActions: [],
        trace,
      });

      expect(withSpanAsync).toHaveBeenCalledTimes(1);
      const [operationName, handler, metadata] = withSpanAsync.mock.calls[0];
      expect(operationName).toBe('Pipeline');
      expect(typeof handler).toBe('function');
      expect(metadata).toEqual({ stageCount: 1 });

      expect(stage.execute).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });

    it('executes stages sequentially, merging results, halting when requested, and reporting via trace', async () => {
      const trace = {
        info: jest.fn(),
        step: jest.fn(),
        success: jest.fn(),
        failure: jest.fn(),
      };

      const stageOne = {
        name: 'StageOne',
        execute: jest.fn().mockResolvedValue(
          PipelineResult.success({
            actions: [{ id: 'action-1' }],
            data: { first: true },
          })
        ),
      };

      const stageTwo = {
        name: 'StageTwo',
        execute: jest.fn().mockResolvedValue(
          new PipelineResult({
            success: true,
            actions: [{ id: 'action-2' }],
            data: { second: true },
            continueProcessing: false,
          })
        ),
      };

      const stageThree = {
        name: 'StageThree',
        execute: jest.fn(),
      };

      const pipeline = new Pipeline([stageOne, stageTwo, stageThree], logger);
      const result = await pipeline.execute({
        actor: { id: 'actor-1' },
        actionContext: { actorId: 'actor-1' },
        candidateActions: [{ id: 'candidate' }],
        trace,
      });

      expect(stageOne.execute).toHaveBeenCalledTimes(1);
      expect(stageTwo.execute).toHaveBeenCalledTimes(1);
      expect(stageThree.execute).not.toHaveBeenCalled();

      expect(result.actions).toEqual([{ id: 'action-1' }, { id: 'action-2' }]);
      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);

      expect(logger.debug).toHaveBeenCalledWith(
        'Executing pipeline stage: StageOne'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Executing pipeline stage: StageTwo'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Stage StageTwo indicated to stop processing'
      );

      expect(trace.info).toHaveBeenCalledWith(
        'Starting pipeline execution with 3 stages',
        'Pipeline.execute'
      );
      expect(trace.step).toHaveBeenCalledWith(
        'Executing stage: StageOne',
        'Pipeline.execute'
      );
      expect(trace.step).toHaveBeenCalledWith(
        'Executing stage: StageTwo',
        'Pipeline.execute'
      );
      expect(trace.success).toHaveBeenCalledWith(
        'Stage StageOne completed successfully',
        'Pipeline.execute'
      );
      expect(trace.info).toHaveBeenCalledWith(
        'Pipeline halted at stage: StageTwo',
        'Pipeline.execute'
      );
      expect(trace.info).toHaveBeenCalledWith(
        'Pipeline execution completed. Actions: 2, Errors: 0',
        'Pipeline.execute'
      );
    });

    it('logs warnings and trace failures when a stage reports success=false but allows continuation', async () => {
      const trace = {
        info: jest.fn(),
        step: jest.fn(),
        success: jest.fn(),
        failure: jest.fn(),
      };

      const failingStage = {
        name: 'UnstableStage',
        execute: jest.fn().mockResolvedValue(
          new PipelineResult({
            success: false,
            errors: [{ error: 'bad', stageName: 'UnstableStage' }],
            data: { unstable: true },
            continueProcessing: true,
          })
        ),
      };

      const succeedingStage = {
        name: 'RecoveryStage',
        execute: jest
          .fn()
          .mockResolvedValue(
            PipelineResult.success({ data: { recovered: true } })
          ),
      };

      const pipeline = new Pipeline([failingStage, succeedingStage], logger);
      const result = await pipeline.execute({
        actor: { id: 'actor-1' },
        actionContext: { actorId: 'actor-1' },
        candidateActions: [],
        trace,
      });

      expect(result.success).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        'Stage UnstableStage completed with errors'
      );
      expect(trace.failure).toHaveBeenCalledWith(
        'Stage UnstableStage encountered errors',
        'Pipeline.execute'
      );
      expect(trace.success).toHaveBeenCalledWith(
        'Stage RecoveryStage completed successfully',
        'Pipeline.execute'
      );
    });

    it('captures errors thrown by stages and merges them into the cumulative result', async () => {
      const trace = {
        info: jest.fn(),
        step: jest.fn(),
        success: jest.fn(),
        failure: jest.fn(),
      };

      const firstStage = {
        name: 'SafeStage',
        execute: jest
          .fn()
          .mockResolvedValue(
            PipelineResult.success({ actions: [{ id: 'good' }] })
          ),
      };

      const explodingStage = {
        name: 'ExplodingStage',
        execute: jest.fn().mockImplementation(() => {
          throw new Error('kaboom');
        }),
      };

      const pipeline = new Pipeline([firstStage, explodingStage], logger);
      const result = await pipeline.execute({
        actor: { id: 'actor-1' },
        actionContext: { actorId: 'actor-1' },
        candidateActions: [],
        trace,
      });

      expect(result.success).toBe(false);
      expect(result.actions).toEqual([{ id: 'good' }]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        error: 'kaboom',
        stageName: 'ExplodingStage',
        phase: 'PIPELINE_EXECUTION',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Pipeline stage ExplodingStage threw an error: kaboom',
        expect.any(Error)
      );
      expect(trace.failure).toHaveBeenCalledWith(
        'Stage ExplodingStage threw an error: kaboom',
        'Pipeline.execute'
      );
    });
  });
});
