import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { summarizeSettledResults } from '../../../../src/loaders/helpers/resultsSummary.js';

describe('summarizeSettledResults', () => {
  let logger;

  beforeEach(() => {
    logger = { info: jest.fn(), debug: jest.fn() };
  });

  it('aggregates successes, overrides and failures correctly', () => {
    const err = new Error('fail');
    const settled = [
      { status: 'fulfilled', value: { didOverride: false } },
      { status: 'fulfilled', value: { didOverride: true } },
      { status: 'rejected', reason: err },
    ];
    const filenames = ['f1.json', 'f2.json', 'f3.json'];
    const summary = summarizeSettledResults(
      logger,
      settled,
      filenames,
      'modA',
      'items',
      3
    );
    expect(summary).toEqual({
      processedCount: 2,
      overrideCount: 1,
      failedCount: 1,
      failures: [{ file: 'f3.json', error: err }],
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Mod [modA] - Processed 2/3 items items. (1 overrides) (1 failed)'
    );
    expect(logger.debug).toHaveBeenCalled();
  });

  it('handles all successes without overrides', () => {
    const settled = [
      { status: 'fulfilled', value: { didOverride: false } },
      { status: 'fulfilled', value: { didOverride: false } },
    ];
    const filenames = ['a.json', 'b.json'];
    const summary = summarizeSettledResults(
      logger,
      settled,
      filenames,
      'modB',
      'components',
      2
    );
    expect(summary).toEqual({
      processedCount: 2,
      overrideCount: 0,
      failedCount: 0,
      failures: [],
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Mod [modB] - Processed 2/2 components items.'
    );
  });
});
