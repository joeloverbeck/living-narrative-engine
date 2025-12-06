/**
 * @file Comprehensive integration tests for PipelineResult
 * @description Covers all execution paths for PipelineResult when used alongside ActionResult-based helpers.
 */

import { describe, it, expect } from '@jest/globals';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';

describe('PipelineResult - behavior coverage', () => {
  describe('constructor defaults', () => {
    it('should default optional collections and flags', () => {
      const result = new PipelineResult({ success: true });

      expect(result.success).toBe(true);
      expect(result.actions).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.data).toEqual({});
      expect(result.continueProcessing).toBe(true);
    });
  });

  describe('static helpers', () => {
    it('should create a successful result with provided data', () => {
      const actions = [{ id: 'demo', name: 'Demo' }];
      const errors = [{ phase: 'validation' }];
      const data = { foo: 'bar' };
      const result = PipelineResult.success({
        actions,
        errors,
        data,
        continueProcessing: false,
      });

      expect(result.success).toBe(true);
      expect(result.actions).toBe(actions);
      expect(result.errors).toBe(errors);
      expect(result.data).toBe(data);
      expect(result.continueProcessing).toBe(false);
    });

    it('should normalize errors when creating failure results', () => {
      const error = { message: 'failed', phase: 'validation' };
      const result = PipelineResult.failure(error, { retry: false });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual([error]);
      expect(result.data).toEqual({ retry: false });
      expect(result.continueProcessing).toBe(false);

      const errorArray = [error, { message: 'another' }];
      const arrayResult = PipelineResult.failure(errorArray);
      expect(arrayResult.errors).toEqual(errorArray);
    });

    it('should convert ActionResult instances', () => {
      const successActionResult = ActionResult.success({ payload: 42 });
      const successPipelineResult = PipelineResult.fromActionResult(
        successActionResult,
        {
          stage: 'formatting',
        }
      );

      expect(successPipelineResult.success).toBe(true);
      expect(successPipelineResult.data).toEqual({
        stage: 'formatting',
        payload: 42,
      });
      expect(successPipelineResult.errors).toEqual([]);
      expect(successPipelineResult.continueProcessing).toBe(true);

      const failureActionResult = ActionResult.failure(new Error('nope'));
      const failurePipelineResult = PipelineResult.fromActionResult(
        failureActionResult,
        {
          stage: 'resolution',
        }
      );

      expect(failurePipelineResult.success).toBe(false);
      expect(failurePipelineResult.errors).toEqual(failureActionResult.errors);
      expect(failurePipelineResult.data).toEqual({ stage: 'resolution' });
      expect(failurePipelineResult.continueProcessing).toBe(false);
    });
  });

  describe('merge', () => {
    it('should merge data, actions, errors and flags', () => {
      const first = PipelineResult.success({
        actions: [{ id: 'a' }],
        errors: [{ phase: 'warn' }],
        data: { trace: ['first'] },
      });
      const second = PipelineResult.failure([{ phase: 'error' }], {
        trace: ['second'],
      });

      const merged = first.merge(second);

      expect(merged.success).toBe(false);
      expect(merged.actions).toEqual([{ id: 'a' }]);
      expect(merged.errors).toEqual([{ phase: 'warn' }, { phase: 'error' }]);
      expect(merged.data).toEqual({ trace: ['second'] });
      expect(merged.continueProcessing).toBe(false);
    });
  });

  describe('chainActionResult', () => {
    it('should short-circuit when the current result is already a failure', () => {
      const initialFailure = PipelineResult.failure({ message: 'stop' });
      const chained = initialFailure.chainActionResult(() => {
        throw new Error('should not run');
      });

      expect(chained).toBe(initialFailure);
    });

    it('should merge in successful ActionResult data', () => {
      const base = PipelineResult.success({
        data: { step: 1, previous: true },
        errors: [{ phase: 'initial' }],
      });

      const chained = base.chainActionResult(() =>
        ActionResult.success({ step: 2, status: 'ok' })
      );

      expect(chained.success).toBe(true);
      expect(chained.data).toEqual({ step: 2, previous: true, status: 'ok' });
      expect(chained.errors).toEqual([{ phase: 'initial' }]);
      expect(chained.continueProcessing).toBe(true);
    });

    it('should accumulate errors from failing ActionResult instances', () => {
      const base = PipelineResult.success({ errors: [{ phase: 'initial' }] });

      const chained = base.chainActionResult(() =>
        ActionResult.failure([new Error('boom')])
      );

      expect(chained.success).toBe(false);
      expect(chained.errors).toHaveLength(2);
      expect(chained.continueProcessing).toBe(false);
      expect(chained.data).toEqual({});
    });
  });
});
