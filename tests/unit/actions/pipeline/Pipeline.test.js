/**
 * @file Tests for Pipeline
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import { StructuredTrace } from '../../../../src/actions/tracing/structuredTrace.js';

describe('Pipeline', () => {
  let mockLogger;
  let mockTrace;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockTrace = {
      info: jest.fn(),
      step: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
    };
  });

  describe('constructor', () => {
    it('should create a Pipeline with valid stages array', () => {
      const mockStage = { name: 'TestStage', execute: jest.fn() };
      const pipeline = new Pipeline([mockStage], mockLogger);
      expect(pipeline).toBeDefined();
    });

    it('should throw error when stages is not an array', () => {
      expect(() => new Pipeline('not-an-array', mockLogger)).toThrow(
        'Pipeline requires at least one stage'
      );
    });

    it('should throw error when stages array is empty', () => {
      expect(() => new Pipeline([], mockLogger)).toThrow(
        'Pipeline requires at least one stage'
      );
    });

    it('should throw error when stages is null', () => {
      expect(() => new Pipeline(null, mockLogger)).toThrow(
        'Pipeline requires at least one stage'
      );
    });

    it('should throw error when stages is undefined', () => {
      expect(() => new Pipeline(undefined, mockLogger)).toThrow(
        'Pipeline requires at least one stage'
      );
    });
  });

  describe('execute', () => {
    let mockStage1;
    let mockStage2;
    let initialContext;

    beforeEach(() => {
      mockStage1 = {
        name: 'Stage1',
        execute: jest.fn(),
      };

      mockStage2 = {
        name: 'Stage2',
        execute: jest.fn(),
      };

      initialContext = {
        actor: { id: 'test-actor' },
        actionContext: {},
        candidateActions: [],
        trace: mockTrace,
      };
    });

    it('should execute a single stage successfully', async () => {
      const successResult = PipelineResult.success({
        actions: [{ id: 'action1' }],
        data: { custom: 'data' },
      });
      mockStage1.execute.mockResolvedValue(successResult);

      const pipeline = new Pipeline([mockStage1], mockLogger);
      const result = await pipeline.execute(initialContext);

      expect(mockStage1.execute).toHaveBeenCalledWith(initialContext);
      expect(result.success).toBe(true);
      expect(result.actions).toEqual([{ id: 'action1' }]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Executing pipeline stage: Stage1'
      );
      expect(mockTrace.info).toHaveBeenCalledWith(
        'Starting pipeline execution with 1 stages',
        'Pipeline.execute'
      );
      expect(mockTrace.step).toHaveBeenCalledWith(
        'Executing stage: Stage1',
        'Pipeline.execute'
      );
      expect(mockTrace.success).toHaveBeenCalledWith(
        'Stage Stage1 completed successfully',
        'Pipeline.execute'
      );
    });

    it('should execute multiple stages and merge results', async () => {
      const result1 = PipelineResult.success({
        actions: [{ id: 'action1' }],
        data: { step: 1 },
      });
      const result2 = PipelineResult.success({
        actions: [{ id: 'action2' }],
        data: { step: 2 },
      });

      mockStage1.execute.mockResolvedValue(result1);
      mockStage2.execute.mockResolvedValue(result2);

      const pipeline = new Pipeline([mockStage1, mockStage2], mockLogger);
      const result = await pipeline.execute(initialContext);

      expect(mockStage1.execute).toHaveBeenCalledWith(initialContext);
      expect(mockStage2.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          ...initialContext,
          step: 1,
          actions: [{ id: 'action1' }],
          errors: [],
        })
      );
      expect(result.actions).toEqual([{ id: 'action1' }, { id: 'action2' }]);
    });

    it('should stop processing when continueProcessing is false', async () => {
      const haltResult = PipelineResult.success({
        actions: [{ id: 'action1' }],
        continueProcessing: false,
      });

      mockStage1.execute.mockResolvedValue(haltResult);

      const pipeline = new Pipeline([mockStage1, mockStage2], mockLogger);
      const result = await pipeline.execute(initialContext);

      expect(mockStage1.execute).toHaveBeenCalled();
      expect(mockStage2.execute).not.toHaveBeenCalled();
      expect(result.actions).toEqual([{ id: 'action1' }]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Stage Stage1 indicated to stop processing'
      );
      expect(mockTrace.info).toHaveBeenCalledWith(
        'Pipeline halted at stage: Stage1',
        'Pipeline.execute'
      );
    });

    it('should log warning when stage completes with errors but continues', async () => {
      // Create a result that has errors but still continues processing
      const errorResult = new PipelineResult({
        success: false,
        errors: [{ error: 'Test error', phase: 'TEST_PHASE' }],
        continueProcessing: true,
      });

      mockStage1.execute.mockResolvedValue(errorResult);

      const pipeline = new Pipeline([mockStage1], mockLogger);
      const result = await pipeline.execute(initialContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Stage Stage1 completed with errors'
      );
      expect(mockTrace.failure).toHaveBeenCalledWith(
        'Stage Stage1 encountered errors',
        'Pipeline.execute'
      );
      expect(result.errors).toHaveLength(1);
    });

    it('should handle stage throwing an error', async () => {
      const testError = new Error('Stage execution failed');
      mockStage1.execute.mockRejectedValue(testError);

      const pipeline = new Pipeline([mockStage1], mockLogger);
      const result = await pipeline.execute(initialContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Pipeline stage Stage1 threw an error: Stage execution failed',
        testError
      );
      expect(mockTrace.failure).toHaveBeenCalledWith(
        'Stage Stage1 threw an error: Stage execution failed',
        'Pipeline.execute'
      );
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        error: 'Stage execution failed',
        phase: 'PIPELINE_EXECUTION',
        stageName: 'Stage1',
        context: { error: expect.any(String) },
      });
    });

    it('should handle stage throwing error and merge with previous results', async () => {
      const successResult = PipelineResult.success({
        actions: [{ id: 'action1' }],
        errors: [{ error: 'Warning', phase: 'STAGE1' }],
      });
      const testError = new Error('Stage 2 failed');

      mockStage1.execute.mockResolvedValue(successResult);
      mockStage2.execute.mockRejectedValue(testError);

      const pipeline = new Pipeline([mockStage1, mockStage2], mockLogger);
      const result = await pipeline.execute(initialContext);

      expect(result.actions).toEqual([{ id: 'action1' }]);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toEqual({ error: 'Warning', phase: 'STAGE1' });
      expect(result.errors[1]).toEqual({
        error: 'Stage 2 failed',
        phase: 'PIPELINE_EXECUTION',
        stageName: 'Stage2',
        context: { error: expect.any(String) },
      });
    });

    it('should work without trace context', async () => {
      const contextWithoutTrace = {
        ...initialContext,
        trace: undefined,
      };

      const successResult = PipelineResult.success();
      mockStage1.execute.mockResolvedValue(successResult);

      const pipeline = new Pipeline([mockStage1], mockLogger);
      const result = await pipeline.execute(contextWithoutTrace);

      expect(result.success).toBe(true);
      expect(mockTrace.info).not.toHaveBeenCalled();
      expect(mockTrace.step).not.toHaveBeenCalled();
    });

    it('should pass updated context between stages', async () => {
      const result1 = PipelineResult.success({
        actions: [{ id: 'action1' }],
        errors: [{ error: 'warning1' }],
        data: { customField: 'value1', anotherField: 'test' },
      });
      const result2 = PipelineResult.success({
        actions: [{ id: 'action2' }],
        data: { customField: 'value2' },
      });

      mockStage1.execute.mockResolvedValue(result1);
      mockStage2.execute.mockResolvedValue(result2);

      const pipeline = new Pipeline([mockStage1, mockStage2], mockLogger);
      await pipeline.execute(initialContext);

      expect(mockStage2.execute).toHaveBeenCalledWith({
        ...initialContext,
        customField: 'value1',
        anotherField: 'test',
        actions: [{ id: 'action1' }],
        errors: [{ error: 'warning1' }],
      });
    });

    it('should log final execution summary', async () => {
      const result1 = PipelineResult.success({
        actions: [{ id: 'action1' }, { id: 'action2' }],
        errors: [{ error: 'warning1' }],
      });

      mockStage1.execute.mockResolvedValue(result1);

      const pipeline = new Pipeline([mockStage1], mockLogger);
      await pipeline.execute(initialContext);

      expect(mockTrace.info).toHaveBeenCalledWith(
        'Pipeline execution completed. Actions: 2, Errors: 1',
        'Pipeline.execute'
      );
    });

    it('should handle error with missing stack trace', async () => {
      const errorWithoutStack = new Error('No stack error');
      delete errorWithoutStack.stack;
      mockStage1.execute.mockRejectedValue(errorWithoutStack);

      const pipeline = new Pipeline([mockStage1], mockLogger);
      const result = await pipeline.execute(initialContext);

      expect(result.errors[0].context.error).toBe(undefined);
    });
  });

  describe('execute with StructuredTrace', () => {
    let mockStage1;
    let mockStage2;
    let initialContext;
    let structuredTrace;

    beforeEach(() => {
      // Create mock stages that support executeInternal
      mockStage1 = {
        name: 'Stage1',
        execute: jest.fn(),
        executeInternal: jest.fn(),
      };

      mockStage2 = {
        name: 'Stage2',
        execute: jest.fn(),
        executeInternal: jest.fn(),
      };

      // When execute is called on stages, delegate to executeInternal
      mockStage1.execute.mockImplementation(async (context) => {
        if (context.trace?.withSpanAsync) {
          return context.trace.withSpanAsync(
            `${mockStage1.name}Stage`,
            async () => mockStage1.executeInternal(context),
            { stage: mockStage1.name }
          );
        }
        return mockStage1.executeInternal(context);
      });

      mockStage2.execute.mockImplementation(async (context) => {
        if (context.trace?.withSpanAsync) {
          return context.trace.withSpanAsync(
            `${mockStage2.name}Stage`,
            async () => mockStage2.executeInternal(context),
            { stage: mockStage2.name }
          );
        }
        return mockStage2.executeInternal(context);
      });

      structuredTrace = new StructuredTrace();

      initialContext = {
        actor: { id: 'test-actor' },
        actionContext: {},
        candidateActions: [],
        trace: structuredTrace,
      };
    });

    it('should create a root span for the pipeline', async () => {
      const successResult = PipelineResult.success({
        actions: [{ id: 'action1' }],
      });
      mockStage1.executeInternal.mockResolvedValue(successResult);

      const pipeline = new Pipeline([mockStage1], mockLogger);
      const result = await pipeline.execute(initialContext);

      expect(result.success).toBe(true);
      
      // Check that a root span was created
      const spans = structuredTrace.getSpans();
      expect(spans.length).toBeGreaterThan(0);
      
      const hierarchicalView = structuredTrace.getHierarchicalView();
      expect(hierarchicalView.operation).toBe('Pipeline');
      expect(hierarchicalView.attributes.stageCount).toBe(1);
    });

    it('should create spans for each stage', async () => {
      const result1 = PipelineResult.success({ actions: [{ id: 'action1' }] });
      const result2 = PipelineResult.success({ actions: [{ id: 'action2' }] });
      
      mockStage1.executeInternal.mockResolvedValue(result1);
      mockStage2.executeInternal.mockResolvedValue(result2);

      const pipeline = new Pipeline([mockStage1, mockStage2], mockLogger);
      await pipeline.execute(initialContext);

      const hierarchicalView = structuredTrace.getHierarchicalView();
      expect(hierarchicalView.children.length).toBe(2);
      expect(hierarchicalView.children[0].operation).toBe('Stage1Stage');
      expect(hierarchicalView.children[1].operation).toBe('Stage2Stage');
    });

    it('should capture errors in spans', async () => {
      const testError = new Error('Stage failed');
      mockStage1.executeInternal.mockRejectedValue(testError);

      const pipeline = new Pipeline([mockStage1], mockLogger);
      const result = await pipeline.execute(initialContext);

      expect(result.success).toBe(false);
      
      // Check error was captured in span
      const spans = structuredTrace.getSpans();
      const stageSpan = spans.find(s => s.operation === 'Stage1Stage');
      expect(stageSpan.status).toBe('error');
      expect(stageSpan.error).toBeDefined();
      expect(stageSpan.error.message).toBe('Stage failed');
    });

    it('should still work with regular TraceContext', async () => {
      // Use regular trace instead of structured
      initialContext.trace = mockTrace;

      const successResult = PipelineResult.success({
        actions: [{ id: 'action1' }],
      });
      mockStage1.executeInternal.mockResolvedValue(successResult);

      const pipeline = new Pipeline([mockStage1], mockLogger);
      const result = await pipeline.execute(initialContext);

      expect(result.success).toBe(true);
      expect(mockTrace.info).toHaveBeenCalled();
      expect(mockTrace.step).toHaveBeenCalled();
      expect(mockTrace.success).toHaveBeenCalled();
    });

    it('should work without any trace', async () => {
      // Remove trace entirely
      delete initialContext.trace;

      const successResult = PipelineResult.success({
        actions: [{ id: 'action1' }],
      });
      mockStage1.executeInternal.mockResolvedValue(successResult);

      const pipeline = new Pipeline([mockStage1], mockLogger);
      const result = await pipeline.execute(initialContext);

      expect(result.success).toBe(true);
      // Should work without errors
    });

    it('should provide performance metrics', async () => {
      const result1 = PipelineResult.success({ actions: [{ id: 'action1' }] });
      const result2 = PipelineResult.success({ actions: [{ id: 'action2' }] });
      
      // Add a small delay to ensure measurable duration
      mockStage1.executeInternal.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return result1;
      });
      mockStage2.executeInternal.mockResolvedValue(result2);

      const pipeline = new Pipeline([mockStage1, mockStage2], mockLogger);
      await pipeline.execute(initialContext);

      const perfSummary = structuredTrace.getPerformanceSummary();
      expect(perfSummary.totalDuration).toBeGreaterThan(0);
      expect(perfSummary.operationCount).toBe(3); // Pipeline + 2 stages
      expect(perfSummary.criticalPath.length).toBeGreaterThanOrEqual(2); // At least Pipeline and one stage
      expect(perfSummary.criticalPath[0]).toBe('Pipeline'); // Pipeline should be first
      
      // Check that operation stats include our operations
      expect(perfSummary.operationStats).toHaveProperty('Pipeline');
      expect(perfSummary.operationStats).toHaveProperty('Stage1Stage');
    });
  });
});
