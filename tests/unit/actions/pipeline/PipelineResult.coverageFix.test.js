import { describe, it, expect, jest } from '@jest/globals';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';

describe('PipelineResult - targeted coverage', () => {
  it('constructs with defaults when only success provided', () => {
    const result = new PipelineResult({ success: true });

    expect(result.success).toBe(true);
    expect(result.actions).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.data).toEqual({});
    expect(result.continueProcessing).toBe(true);
  });

  it('creates a successful result with default arguments', () => {
    const result = PipelineResult.success();

    expect(result.success).toBe(true);
    expect(result.actions).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.data).toEqual({});
    expect(result.continueProcessing).toBe(true);
  });

  it('creates a successful result with provided collections', () => {
    const actions = [{ id: 'alpha' }, { id: 'beta' }];
    const errors = [{ phase: 'WARN', detail: 'non-blocking' }];
    const data = { stage: 'format', count: 3 };

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

  it('wraps single errors and stops processing on failure', () => {
    const result = PipelineResult.failure(
      { message: 'fatal' },
      { retry: false }
    );

    expect(result.success).toBe(false);
    expect(result.errors).toEqual([{ message: 'fatal' }]);
    expect(result.data).toEqual({ retry: false });
    expect(result.continueProcessing).toBe(false);
  });

  it('retains provided error arrays when failing', () => {
    const errors = [{ message: 'first' }, { message: 'second' }];

    const result = PipelineResult.failure(errors);

    expect(result.errors).toBe(errors);
  });

  it('merges results while combining arrays and metadata', () => {
    const base = PipelineResult.success({
      actions: [{ id: 'base' }],
      errors: [{ message: 'warning' }],
      data: { fromBase: true },
    });
    const next = PipelineResult.failure([{ message: 'stop' }], {
      fromNext: true,
    });

    const merged = base.merge(next);

    expect(merged.success).toBe(false);
    expect(merged.actions).toEqual([{ id: 'base' }]);
    expect(merged.errors).toEqual([
      { message: 'warning' },
      { message: 'stop' },
    ]);
    expect(merged.data).toEqual({ fromBase: true, fromNext: true });
    expect(merged.continueProcessing).toBe(false);
  });

  it('merges consecutive successes and respects continueProcessing flags', () => {
    const first = PipelineResult.success({
      actions: [{ id: 'a1' }],
      data: { stage: 'first' },
    });
    const second = PipelineResult.success({
      actions: [{ id: 'a2' }],
      data: { stage: 'second' },
    });

    const mergedSuccess = first.merge(second);

    expect(mergedSuccess.success).toBe(true);
    expect(mergedSuccess.actions).toEqual([{ id: 'a1' }, { id: 'a2' }]);
    expect(mergedSuccess.errors).toEqual([]);
    expect(mergedSuccess.data).toEqual({ stage: 'second' });
    expect(mergedSuccess.continueProcessing).toBe(true);

    const halted = PipelineResult.success({ continueProcessing: false });
    const mergedHalted = halted.merge(second);
    expect(mergedHalted.continueProcessing).toBe(false);
  });

  it('converts successful ActionResult payloads into pipeline data', () => {
    const actionResult = ActionResult.success({ payload: 42 });

    const result = PipelineResult.fromActionResult(actionResult, {
      stage: 'discovery',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ stage: 'discovery', payload: 42 });
    expect(result.errors).toEqual([]);
    expect(result.continueProcessing).toBe(true);
  });

  it('converts successful ActionResult using default additional data', () => {
    const actionResult = ActionResult.success({ payload: 7 });

    const result = PipelineResult.fromActionResult(actionResult);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ payload: 7 });
  });

  it('converts failing ActionResult into a halted pipeline result', () => {
    const error = new Error('resolution failed');
    const failure = ActionResult.failure(error);

    const result = PipelineResult.fromActionResult(failure, {
      stage: 'resolution',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(failure.errors);
    expect(result.data).toEqual({ stage: 'resolution' });
    expect(result.continueProcessing).toBe(false);
  });

  it('chains follow-up ActionResult values when successful', () => {
    const base = PipelineResult.success({
      data: { stage: 'initial' },
      errors: [{ message: 'previous warning' }],
    });
    const followUp = jest.fn(() =>
      ActionResult.success({ nextStage: 'final' })
    );

    const chained = base.chainActionResult(followUp);

    expect(followUp).toHaveBeenCalledWith({ stage: 'initial' });
    expect(chained.success).toBe(true);
    expect(chained.errors).toEqual([{ message: 'previous warning' }]);
    expect(chained.data).toEqual({ stage: 'initial', nextStage: 'final' });
    expect(chained.continueProcessing).toBe(true);
  });

  it('aggregates errors and stops when chained ActionResult fails', () => {
    const base = PipelineResult.success({
      data: { stage: 'initial' },
      errors: [{ message: 'previous warning' }],
    });
    const failure = ActionResult.failure({ message: 'follow-up failed' });

    const chained = base.chainActionResult(() => failure);

    expect(chained.success).toBe(false);
    expect(chained.errors).toEqual([
      { message: 'previous warning' },
      failure.errors[0],
    ]);
    expect(chained.data).toEqual({ stage: 'initial' });
    expect(chained.continueProcessing).toBe(false);
  });

  it('appends warnings returned from successful chained operations', () => {
    const base = PipelineResult.success({
      data: { stage: 'initial' },
      errors: [{ message: 'existing warning' }],
    });

    const chained = base.chainActionResult(() => ({
      success: true,
      value: { stage: 'processed' },
      errors: [{ message: 'new warning' }],
    }));

    expect(chained.success).toBe(true);
    expect(chained.errors).toEqual([
      { message: 'existing warning' },
      { message: 'new warning' },
    ]);
    expect(chained.data).toEqual({ stage: 'processed' });
    expect(chained.continueProcessing).toBe(true);
  });

  it('treats missing chained error collections as empty arrays', () => {
    const base = PipelineResult.success({
      data: { stage: 'initial' },
      errors: [{ message: 'existing warning' }],
    });

    const chained = base.chainActionResult(() => ({
      success: true,
      value: { stage: 'processed' },
    }));

    expect(chained.errors).toEqual([{ message: 'existing warning' }]);
  });

  it('keeps continueProcessing halted when chaining after a soft stop', () => {
    const halted = PipelineResult.success({
      data: { stage: 'initial' },
      continueProcessing: false,
    });

    const chained = halted.chainActionResult(() =>
      ActionResult.success({ stage: 'next' })
    );

    expect(chained.success).toBe(true);
    expect(chained.data).toEqual({ stage: 'next' });
    expect(chained.continueProcessing).toBe(false);
  });

  it('skips chaining function when the pipeline already failed', () => {
    const failure = PipelineResult.failure({ message: 'initial failure' });
    const callback = jest.fn();

    const chained = failure.chainActionResult(callback);

    expect(chained).toBe(failure);
    expect(callback).not.toHaveBeenCalled();
  });
});
