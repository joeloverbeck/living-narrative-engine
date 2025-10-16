import { describe, it, expect } from '@jest/globals';

import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';

describe('PipelineResult edge cases integration', () => {
  it('creates a success result with default parameters when no overrides are provided', () => {
    const result = PipelineResult.success();

    expect(result.success).toBe(true);
    expect(result.actions).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.data).toEqual({});
    expect(result.continueProcessing).toBe(true);
  });

  it('converts successful ActionResult instances while using default additional data', () => {
    const actionResult = ActionResult.success({ payload: 'alpha' });

    const pipelineResult = PipelineResult.fromActionResult(actionResult);

    expect(pipelineResult.success).toBe(true);
    expect(pipelineResult.data).toEqual({ payload: 'alpha' });
    expect(pipelineResult.errors).toEqual([]);
    expect(pipelineResult.continueProcessing).toBe(true);
  });

  it('uses fallback error aggregation when chained ActionResult omits the errors array', () => {
    const base = PipelineResult.success({
      errors: [{ code: 'existing', phase: 'initial' }],
      data: { base: true },
    });

    const manualActionResult = new ActionResult(true, { extra: 'value' }, null);

    const chained = base.chainActionResult(() => manualActionResult);

    expect(chained.success).toBe(true);
    expect(chained.errors).toEqual([{ code: 'existing', phase: 'initial' }]);
    expect(chained.data).toEqual({ base: true, extra: 'value' });
    expect(chained.continueProcessing).toBe(true);
  });
});
