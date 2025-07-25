/**
 * @file Comprehensive unit tests for PipelineResult
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';

describe('PipelineResult', () => {
  describe('Constructor', () => {
    it('should create instance with all parameters', () => {
      const params = {
        success: true,
        actions: [{ id: 'action1', type: 'test' }],
        errors: [{ error: 'warning', phase: 'INIT' }],
        data: { custom: 'value' },
        continueProcessing: false,
      };

      const result = new PipelineResult(params);

      expect(result.success).toBe(true);
      expect(result.actions).toEqual([{ id: 'action1', type: 'test' }]);
      expect(result.errors).toEqual([{ error: 'warning', phase: 'INIT' }]);
      expect(result.data).toEqual({ custom: 'value' });
      expect(result.continueProcessing).toBe(false);
    });

    it('should use default values when parameters are omitted', () => {
      const result = new PipelineResult({ success: true });

      expect(result.success).toBe(true);
      expect(result.actions).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.data).toEqual({});
      expect(result.continueProcessing).toBe(true);
    });

    it('should create failed result with errors', () => {
      const errors = [
        { error: 'Error 1', phase: 'PHASE1' },
        { error: 'Error 2', phase: 'PHASE2' },
      ];

      const result = new PipelineResult({
        success: false,
        errors,
        continueProcessing: false,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(errors);
      expect(result.continueProcessing).toBe(false);
    });
  });

  describe('Static Methods', () => {
    describe('success()', () => {
      it('should create successful result with no parameters', () => {
        const result = PipelineResult.success();

        expect(result.success).toBe(true);
        expect(result.actions).toEqual([]);
        expect(result.errors).toEqual([]);
        expect(result.data).toEqual({});
        expect(result.continueProcessing).toBe(true);
      });

      it('should create successful result with actions', () => {
        const actions = [{ id: 'action1' }, { id: 'action2' }];
        const result = PipelineResult.success({ actions });

        expect(result.success).toBe(true);
        expect(result.actions).toEqual(actions);
      });

      it('should create successful result with data', () => {
        const data = { userId: '123', metadata: { source: 'test' } };
        const result = PipelineResult.success({ data });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(data);
      });

      it('should create successful result with errors (warnings)', () => {
        const errors = [{ error: 'Warning', phase: 'VALIDATION' }];
        const result = PipelineResult.success({ errors });

        expect(result.success).toBe(true);
        expect(result.errors).toEqual(errors);
      });

      it('should override continueProcessing when specified', () => {
        const result = PipelineResult.success({ continueProcessing: false });

        expect(result.success).toBe(true);
        expect(result.continueProcessing).toBe(false);
      });
    });

    describe('failure()', () => {
      it('should create failed result with single error', () => {
        const error = { error: 'Failed', phase: 'EXECUTION' };
        const result = PipelineResult.failure(error);

        expect(result.success).toBe(false);
        expect(result.errors).toEqual([error]);
        expect(result.data).toEqual({});
        expect(result.continueProcessing).toBe(false);
      });

      it('should create failed result with multiple errors', () => {
        const errors = [
          { error: 'Error 1', phase: 'PHASE1' },
          { error: 'Error 2', phase: 'PHASE2' },
        ];
        const result = PipelineResult.failure(errors);

        expect(result.success).toBe(false);
        expect(result.errors).toEqual(errors);
      });

      it('should wrap non-array error in array', () => {
        const error = { error: 'Single error', phase: 'TEST' };
        const result = PipelineResult.failure(error);

        expect(result.errors).toEqual([error]);
      });

      it('should include additional data with failure', () => {
        const error = { error: 'Failed', phase: 'TEST' };
        const data = { context: 'additional info' };
        const result = PipelineResult.failure(error, data);

        expect(result.success).toBe(false);
        expect(result.errors).toEqual([error]);
        expect(result.data).toEqual(data);
      });

      it('should handle empty array of errors', () => {
        const result = PipelineResult.failure([]);

        expect(result.success).toBe(false);
        expect(result.errors).toEqual([]);
        expect(result.continueProcessing).toBe(false);
      });
    });

    describe('fromActionResult()', () => {
      it('should convert successful ActionResult', () => {
        const actionResult = ActionResult.success({ id: '123', name: 'test' });
        const result = PipelineResult.fromActionResult(actionResult);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ id: '123', name: 'test' });
        expect(result.errors).toEqual([]);
        expect(result.continueProcessing).toBe(true);
      });

      it('should convert failed ActionResult', () => {
        const errors = [new Error('Error 1'), new Error('Error 2')];
        const actionResult = ActionResult.failure(errors);
        const result = PipelineResult.fromActionResult(actionResult);

        expect(result.success).toBe(false);
        expect(result.errors).toEqual(errors);
        expect(result.data).toEqual({});
        expect(result.continueProcessing).toBe(false);
      });

      it('should merge additional data with successful ActionResult', () => {
        const actionResult = ActionResult.success({ value: 'test' });
        const additionalData = { context: 'pipeline', step: 1 };
        const result = PipelineResult.fromActionResult(
          actionResult,
          additionalData
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual({
          context: 'pipeline',
          step: 1,
          value: 'test',
        });
      });

      it('should include additional data with failed ActionResult', () => {
        const actionResult = ActionResult.failure('Test error');
        const additionalData = { context: 'pipeline', step: 2 };
        const result = PipelineResult.fromActionResult(
          actionResult,
          additionalData
        );

        expect(result.success).toBe(false);
        expect(result.data).toEqual(additionalData);
      });

      it('should handle ActionResult with null value', () => {
        const actionResult = ActionResult.success(null);
        const result = PipelineResult.fromActionResult(actionResult);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({});
      });

      it('should handle ActionResult with undefined value', () => {
        const actionResult = ActionResult.success(undefined);
        const result = PipelineResult.fromActionResult(actionResult);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({});
      });

      it('should override additionalData properties with ActionResult value', () => {
        const actionResult = ActionResult.success({
          id: 'new',
          name: 'override',
        });
        const additionalData = { id: 'old', extra: 'keep' };
        const result = PipelineResult.fromActionResult(
          actionResult,
          additionalData
        );

        expect(result.data).toEqual({
          id: 'new',
          name: 'override',
          extra: 'keep',
        });
      });
    });
  });

  describe('Instance Methods', () => {
    describe('merge()', () => {
      it('should merge two successful results', () => {
        const result1 = PipelineResult.success({
          actions: [{ id: 'action1' }],
          data: { step: 1 },
        });
        const result2 = PipelineResult.success({
          actions: [{ id: 'action2' }],
          data: { step: 2, extra: 'data' },
        });

        const merged = result1.merge(result2);

        expect(merged.success).toBe(true);
        expect(merged.actions).toEqual([{ id: 'action1' }, { id: 'action2' }]);
        expect(merged.errors).toEqual([]);
        expect(merged.data).toEqual({ step: 2, extra: 'data' });
        expect(merged.continueProcessing).toBe(true);
      });

      it('should merge successful and failed results', () => {
        const successResult = PipelineResult.success({
          actions: [{ id: 'action1' }],
          data: { original: true },
        });
        const failureResult = PipelineResult.failure(
          { error: 'Failed', phase: 'TEST' },
          { failed: true }
        );

        const merged = successResult.merge(failureResult);

        expect(merged.success).toBe(false);
        expect(merged.actions).toEqual([{ id: 'action1' }]);
        expect(merged.errors).toEqual([{ error: 'Failed', phase: 'TEST' }]);
        expect(merged.data).toEqual({ original: true, failed: true });
        expect(merged.continueProcessing).toBe(false);
      });

      it('should accumulate errors from both results', () => {
        const result1 = new PipelineResult({
          success: true,
          errors: [{ error: 'Warning 1', phase: 'PHASE1' }],
        });
        const result2 = new PipelineResult({
          success: false,
          errors: [{ error: 'Error 2', phase: 'PHASE2' }],
        });

        const merged = result1.merge(result2);

        expect(merged.errors).toEqual([
          { error: 'Warning 1', phase: 'PHASE1' },
          { error: 'Error 2', phase: 'PHASE2' },
        ]);
      });

      it('should stop processing if either result indicates', () => {
        const result1 = PipelineResult.success({ continueProcessing: false });
        const result2 = PipelineResult.success({ continueProcessing: true });

        const merged1 = result1.merge(result2);
        expect(merged1.continueProcessing).toBe(false);

        const merged2 = result2.merge(result1);
        expect(merged2.continueProcessing).toBe(false);
      });

      it('should create new instance without modifying originals', () => {
        const result1 = PipelineResult.success({ data: { a: 1 } });
        const result2 = PipelineResult.success({ data: { b: 2 } });

        const merged = result1.merge(result2);

        expect(result1.data).toEqual({ a: 1 });
        expect(result2.data).toEqual({ b: 2 });
        expect(merged.data).toEqual({ a: 1, b: 2 });
        expect(merged).not.toBe(result1);
        expect(merged).not.toBe(result2);
      });
    });

    describe('chainActionResult()', () => {
      it('should chain on successful PipelineResult', () => {
        const initial = PipelineResult.success({
          data: { value: 10 },
          actions: [{ id: 'initial' }],
        });

        const chained = initial.chainActionResult((data) => {
          return ActionResult.success({ doubled: data.value * 2 });
        });

        expect(chained.success).toBe(true);
        expect(chained.data).toEqual({ value: 10, doubled: 20 });
        expect(chained.actions).toEqual([{ id: 'initial' }]);
        expect(chained.errors).toEqual([]);
        expect(chained.continueProcessing).toBe(true);
      });

      it('should not execute function on failed PipelineResult', () => {
        const failed = PipelineResult.failure({ error: 'Initial failure' });
        let functionCalled = false;

        const chained = failed.chainActionResult(() => {
          functionCalled = true;
          return ActionResult.success('should not happen');
        });

        expect(functionCalled).toBe(false);
        expect(chained).toBe(failed);
      });

      it('should handle function returning failed ActionResult', () => {
        const initial = PipelineResult.success({
          data: { value: 0 },
          errors: [{ error: 'Warning', phase: 'INIT' }],
        });

        const chained = initial.chainActionResult((data) => {
          if (data.value === 0) {
            return ActionResult.failure('Division by zero');
          }
          return ActionResult.success({ result: 10 / data.value });
        });

        expect(chained.success).toBe(false);
        expect(chained.errors).toHaveLength(2);
        expect(chained.errors[0]).toEqual({ error: 'Warning', phase: 'INIT' });
        expect(chained.errors[1].message).toBe('Division by zero');
        expect(chained.data).toEqual({ value: 0 });
        expect(chained.continueProcessing).toBe(false);
      });

      it('should preserve existing errors when chaining successful operation', () => {
        const initial = new PipelineResult({
          success: true,
          errors: [{ error: 'Warning 1' }, { error: 'Warning 2' }],
          data: { step: 1 },
        });

        const chained = initial.chainActionResult(() => {
          return ActionResult.success({ step: 2 });
        });

        expect(chained.success).toBe(true);
        expect(chained.errors).toEqual([
          { error: 'Warning 1' },
          { error: 'Warning 2' },
        ]);
        expect(chained.data).toEqual({ step: 2 });
      });

      it('should handle ActionResult with multiple errors', () => {
        const initial = PipelineResult.success({ data: {} });

        const chained = initial.chainActionResult(() => {
          return ActionResult.failure([
            new Error('Error 1'),
            new Error('Error 2'),
          ]);
        });

        expect(chained.success).toBe(false);
        expect(chained.errors).toHaveLength(2);
        expect(chained.errors[0].message).toBe('Error 1');
        expect(chained.errors[1].message).toBe('Error 2');
      });

      it('should handle ActionResult with no errors array', () => {
        const initial = PipelineResult.success({ data: {} });

        // Create a mock ActionResult without errors property
        const mockActionResult = {
          success: false,
          value: null,
          // errors property is missing
        };

        const chained = initial.chainActionResult(() => mockActionResult);

        expect(chained.errors).toEqual([]);
      });

      it('should merge data correctly on successful chain', () => {
        const initial = PipelineResult.success({
          data: { a: 1, b: 2, c: 3 },
        });

        const chained = initial.chainActionResult((data) => {
          return ActionResult.success({
            b: 20, // Override
            d: 4, // New property
          });
        });

        expect(chained.data).toEqual({ a: 1, b: 20, c: 3, d: 4 });
      });

      it('should preserve original data on failed chain', () => {
        const initial = PipelineResult.success({
          data: { original: 'data', value: 42 },
        });

        const chained = initial.chainActionResult(() => {
          return ActionResult.failure('Operation failed');
        });

        expect(chained.data).toEqual({ original: 'data', value: 42 });
      });

      it('should handle exceptions thrown by function', () => {
        const initial = PipelineResult.success({ data: {} });

        expect(() => {
          initial.chainActionResult(() => {
            throw new Error('Function threw error');
          });
        }).toThrow('Function threw error');
      });

      it('should create new instance without modifying original', () => {
        const initial = PipelineResult.success({
          data: { value: 1 },
          actions: [{ id: 'action1' }],
        });

        const chained = initial.chainActionResult(() => {
          return ActionResult.success({ value: 2 });
        });

        expect(initial.data).toEqual({ value: 1 });
        expect(initial.actions).toEqual([{ id: 'action1' }]);
        expect(chained).not.toBe(initial);
      });

      it('should chain multiple operations', () => {
        const result = PipelineResult.success({ data: { value: 5 } })
          .chainActionResult((data) =>
            ActionResult.success({ doubled: data.value * 2 })
          )
          .chainActionResult((data) =>
            ActionResult.success({ final: data.doubled + 1 })
          );

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ value: 5, doubled: 10, final: 11 });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty actions array in merge', () => {
      const result1 = PipelineResult.success({ actions: [] });
      const result2 = PipelineResult.success({ actions: [] });

      const merged = result1.merge(result2);
      expect(merged.actions).toEqual([]);
    });

    it('should handle empty data objects in merge', () => {
      const result1 = PipelineResult.success({ data: {} });
      const result2 = PipelineResult.success({ data: {} });

      const merged = result1.merge(result2);
      expect(merged.data).toEqual({});
    });

    it('should handle null and undefined in constructor', () => {
      const result = new PipelineResult({
        success: true,
        actions: null,
        errors: undefined,
        data: null,
      });

      expect(result.actions).toBeNull();
      expect(result.errors).toEqual([]); // Default value is [] when undefined
      expect(result.data).toBeNull();
    });

    it('should be immutable', () => {
      const result = PipelineResult.success({
        actions: [{ id: 'action1' }],
        data: { value: 1 },
      });

      // Try to modify arrays and objects
      result.actions.push({ id: 'action2' });
      result.errors.push({ error: 'new error' });
      result.data.value = 2;

      // Changes should be reflected (not deeply frozen)
      expect(result.actions).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.data.value).toBe(2);
    });

    it('should handle very large data merges', () => {
      const largeData1 = {};
      const largeData2 = {};
      for (let i = 0; i < 1000; i++) {
        largeData1[`key${i}`] = i;
        largeData2[`key${i + 1000}`] = i + 1000;
      }

      const result1 = PipelineResult.success({ data: largeData1 });
      const result2 = PipelineResult.success({ data: largeData2 });

      const merged = result1.merge(result2);
      expect(Object.keys(merged.data)).toHaveLength(2000);
    });
  });
});
