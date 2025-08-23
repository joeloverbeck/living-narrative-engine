/**
 * @file Tests for PipelineStage abstract base class
 * @see ../../../../src/actions/pipeline/PipelineStage.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';

// Test concrete implementation for testing the abstract base class
class TestPipelineStage extends PipelineStage {
  constructor(name = 'TestStage') {
    super(name);
    this.executeInternalFn = jest.fn();
  }

  async executeInternal(context) {
    return this.executeInternalFn(context);
  }
}

// Another test implementation that doesn't implement executeInternal
class IncompleteStage extends PipelineStage {
  constructor(name = 'IncompleteStage') {
    super(name);
  }
  // Intentionally doesn't implement executeInternal
}

describe('PipelineStage', () => {
  let mockContext;
  let mockTrace;
  let mockSpan;

  beforeEach(() => {
    mockSpan = {
      setError: jest.fn(),
      setStatus: jest.fn(),
    };

    mockTrace = {
      startSpan: jest.fn().mockReturnValue(mockSpan),
      endSpan: jest.fn(),
      info: jest.fn(),
      step: jest.fn(),
    };

    mockContext = {
      actor: { id: 'test-actor' },
      actionContext: { currentTurn: 1 },
      candidateActions: [],
      trace: mockTrace,
    };
  });

  describe('constructor', () => {
    it('should throw error when instantiated directly', () => {
      expect(() => new PipelineStage('TestStage')).toThrow(
        'PipelineStage is an abstract class and cannot be instantiated directly'
      );
    });

    it('should allow concrete subclasses to be instantiated', () => {
      const stage = new TestPipelineStage('ConcreteStage');
      expect(stage).toBeInstanceOf(PipelineStage);
      expect(stage.name).toBe('ConcreteStage');
    });

    it('should set the name property correctly', () => {
      const stage = new TestPipelineStage('CustomName');
      expect(stage.name).toBe('CustomName');
    });

    it('should use default name when provided', () => {
      const stage = new TestPipelineStage();
      expect(stage.name).toBe('TestStage');
    });
  });

  describe('execute method', () => {
    describe('without trace context', () => {
      it('should call executeInternal directly when no trace provided', async () => {
        const stage = new TestPipelineStage();
        const contextWithoutTrace = { ...mockContext, trace: undefined };
        const expectedResult = PipelineResult.success();

        stage.executeInternalFn.mockResolvedValue(expectedResult);

        const result = await stage.execute(contextWithoutTrace);

        expect(stage.executeInternalFn).toHaveBeenCalledWith(
          contextWithoutTrace
        );
        expect(result).toBe(expectedResult);
        expect(mockTrace.startSpan).not.toHaveBeenCalled();
        expect(mockTrace.endSpan).not.toHaveBeenCalled();
      });

      it('should call executeInternal directly when trace is null', async () => {
        const stage = new TestPipelineStage();
        const contextWithNullTrace = { ...mockContext, trace: null };
        const expectedResult = PipelineResult.success();

        stage.executeInternalFn.mockResolvedValue(expectedResult);

        const result = await stage.execute(contextWithNullTrace);

        expect(stage.executeInternalFn).toHaveBeenCalledWith(
          contextWithNullTrace
        );
        expect(result).toBe(expectedResult);
      });
    });

    describe('with non-structured trace context', () => {
      it('should call executeInternal directly when trace lacks startSpan/endSpan', async () => {
        const stage = new TestPipelineStage();
        const simpleTrace = { info: jest.fn(), step: jest.fn() };
        const contextWithSimpleTrace = { ...mockContext, trace: simpleTrace };
        const expectedResult = PipelineResult.success();

        stage.executeInternalFn.mockResolvedValue(expectedResult);

        const result = await stage.execute(contextWithSimpleTrace);

        expect(stage.executeInternalFn).toHaveBeenCalledWith(
          contextWithSimpleTrace
        );
        expect(result).toBe(expectedResult);
        expect(mockTrace.startSpan).not.toHaveBeenCalled();
        expect(mockTrace.endSpan).not.toHaveBeenCalled();
      });
    });

    describe('with structured trace context', () => {
      it('should wrap execution with span when trace supports startSpan/endSpan', async () => {
        const stage = new TestPipelineStage('MyStage');
        const expectedResult = PipelineResult.success();

        stage.executeInternalFn.mockResolvedValue(expectedResult);

        const result = await stage.execute(mockContext);

        expect(mockTrace.startSpan).toHaveBeenCalledWith('MyStageStage', {
          stage: 'MyStage',
          actor: 'test-actor',
          candidateCount: 0
        });
        expect(stage.executeInternalFn).toHaveBeenCalledWith(mockContext);
        expect(mockSpan.setStatus).toHaveBeenCalledWith('success');
        expect(mockTrace.endSpan).toHaveBeenCalledWith(mockSpan);
        expect(result).toBe(expectedResult);
      });

      it('should set error status on span when result indicates failure', async () => {
        const stage = new TestPipelineStage('FailingStage');
        const failureResult = new PipelineResult({
          success: false,
          errors: [{ error: 'Test error', phase: 'TEST_PHASE' }],
        });

        stage.executeInternalFn.mockResolvedValue(failureResult);

        const result = await stage.execute(mockContext);

        expect(mockTrace.startSpan).toHaveBeenCalledWith('FailingStageStage', {
          stage: 'FailingStage',
          actor: 'test-actor',
          candidateCount: 0
        });
        expect(mockSpan.setError).toHaveBeenCalledWith(expect.any(Error));
        expect(mockTrace.endSpan).toHaveBeenCalledWith(mockSpan);
        expect(result).toBe(failureResult);

        // Verify the error passed to setError has correct message
        const errorArg = mockSpan.setError.mock.calls[0][0];
        expect(errorArg.message).toBe('Test error');
      });

      it('should set error status on span when result has multiple errors', async () => {
        const stage = new TestPipelineStage('MultiErrorStage');
        const failureResult = new PipelineResult({
          success: false,
          errors: [
            { error: 'First error', phase: 'PHASE1' },
            { error: 'Second error', phase: 'PHASE2' },
          ],
        });

        stage.executeInternalFn.mockResolvedValue(failureResult);

        await stage.execute(mockContext);

        expect(mockSpan.setError).toHaveBeenCalledWith(expect.any(Error));
        const errorArg = mockSpan.setError.mock.calls[0][0];
        expect(errorArg.message).toBe('First error'); // Should use first error
      });

      it('should handle error with no error message in result', async () => {
        const stage = new TestPipelineStage('NoMessageStage');
        const failureResult = new PipelineResult({
          success: false,
          errors: [{ phase: 'TEST_PHASE' }], // No error field
        });

        stage.executeInternalFn.mockResolvedValue(failureResult);

        await stage.execute(mockContext);

        expect(mockSpan.setError).toHaveBeenCalledWith(expect.any(Error));
        const errorArg = mockSpan.setError.mock.calls[0][0];
        expect(errorArg.message).toBe('Stage execution failed');
      });

      it('should catch and handle exceptions thrown by executeInternal', async () => {
        const stage = new TestPipelineStage('ThrowingStage');
        const thrownError = new Error('Internal execution failed');

        stage.executeInternalFn.mockRejectedValue(thrownError);

        await expect(stage.execute(mockContext)).rejects.toThrow(
          'Internal execution failed'
        );

        expect(mockTrace.startSpan).toHaveBeenCalledWith('ThrowingStageStage', {
          stage: 'ThrowingStage',
          actor: 'test-actor',
          candidateCount: 0
        });
        expect(mockSpan.setError).toHaveBeenCalledWith(thrownError);
        expect(mockTrace.endSpan).toHaveBeenCalledWith(mockSpan);
      });

      it('should ensure endSpan is called even when executeInternal throws', async () => {
        const stage = new TestPipelineStage('ThrowingStage');
        const thrownError = new Error('Test error');

        stage.executeInternalFn.mockRejectedValue(thrownError);

        try {
          await stage.execute(mockContext);
        } catch (error) {
          // Expected to throw
        }

        expect(mockTrace.endSpan).toHaveBeenCalledWith(mockSpan);
      });

      it('should handle successful execution with success status', async () => {
        const stage = new TestPipelineStage('SuccessStage');
        const successResult = PipelineResult.success({ data: 'test' });

        stage.executeInternalFn.mockResolvedValue(successResult);

        const result = await stage.execute(mockContext);

        expect(mockSpan.setStatus).toHaveBeenCalledWith('success');
        expect(mockSpan.setError).not.toHaveBeenCalled();
        expect(result).toBe(successResult);
      });
    });

    describe('edge cases', () => {
      it('should handle trace with only startSpan but no endSpan', async () => {
        const stage = new TestPipelineStage();
        const partialTrace = { startSpan: jest.fn().mockReturnValue(mockSpan) };
        const contextWithPartialTrace = { ...mockContext, trace: partialTrace };
        const expectedResult = PipelineResult.success();

        stage.executeInternalFn.mockResolvedValue(expectedResult);

        const result = await stage.execute(contextWithPartialTrace);

        // Should fall back to direct execution since endSpan is missing
        expect(stage.executeInternalFn).toHaveBeenCalledWith(
          contextWithPartialTrace
        );
        expect(result).toBe(expectedResult);
        expect(partialTrace.startSpan).not.toHaveBeenCalled();
      });

      it('should handle trace with only endSpan but no startSpan', async () => {
        const stage = new TestPipelineStage();
        const partialTrace = { endSpan: jest.fn() };
        const contextWithPartialTrace = { ...mockContext, trace: partialTrace };
        const expectedResult = PipelineResult.success();

        stage.executeInternalFn.mockResolvedValue(expectedResult);

        const result = await stage.execute(contextWithPartialTrace);

        // Should fall back to direct execution since startSpan is missing
        expect(stage.executeInternalFn).toHaveBeenCalledWith(
          contextWithPartialTrace
        );
        expect(result).toBe(expectedResult);
        expect(partialTrace.endSpan).not.toHaveBeenCalled();
      });

      it('should throw error when trace has non-function startSpan/endSpan', async () => {
        const stage = new TestPipelineStage();
        const malformedTrace = {
          startSpan: 'not-a-function',
          endSpan: 'not-a-function',
        };
        const contextWithMalformedTrace = {
          ...mockContext,
          trace: malformedTrace,
        };

        stage.executeInternalFn.mockResolvedValue(PipelineResult.success());

        // This should throw because startSpan is not a function
        await expect(stage.execute(contextWithMalformedTrace)).rejects.toThrow(
          'trace.startSpan is not a function'
        );
      });
    });
  });

  describe('executeInternal abstract method', () => {
    it('should throw error when executeInternal is not implemented', async () => {
      const incompleteStage = new IncompleteStage('TestIncomplete');

      await expect(incompleteStage.execute(mockContext)).rejects.toThrow(
        'Stage TestIncomplete must implement executeInternal() method'
      );
    });

    it('should include stage name in error message', async () => {
      const incompleteStage = new IncompleteStage('CustomStageName');

      await expect(incompleteStage.execute(mockContext)).rejects.toThrow(
        'Stage CustomStageName must implement executeInternal() method'
      );
    });

    it('should throw error even with structured trace when executeInternal not implemented', async () => {
      const incompleteStage = new IncompleteStage('TracedIncomplete');

      await expect(incompleteStage.execute(mockContext)).rejects.toThrow(
        'Stage TracedIncomplete must implement executeInternal() method'
      );

      // Should still properly manage span lifecycle
      expect(mockTrace.startSpan).toHaveBeenCalledWith(
        'TracedIncompleteStage',
        { 
          stage: 'TracedIncomplete',
          actor: 'test-actor',
          candidateCount: 0
        }
      );
      expect(mockSpan.setError).toHaveBeenCalledWith(expect.any(Error));
      expect(mockTrace.endSpan).toHaveBeenCalledWith(mockSpan);
    });
  });

  describe('name property access', () => {
    it('should allow access to name property after construction', () => {
      const stage = new TestPipelineStage('AccessibleName');
      expect(stage.name).toBe('AccessibleName');
    });

    it('should maintain name consistency across method calls', () => {
      const stage = new TestPipelineStage('ConsistentName');
      expect(stage.name).toBe('ConsistentName');

      // Name should remain the same
      expect(stage.name).toBe('ConsistentName');
    });
  });
});
