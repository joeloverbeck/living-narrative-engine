import { describe, it, expect } from '@jest/globals';
import WorldLoadSummaryLogger, {
  computeTotalsSummary,
} from '../../../src/loaders/WorldLoadSummaryLogger.js';
import { createMockLogger } from '../../common/mockFactories.js';

describe('computeTotalsSummary', () => {
  it('returns correct totals without mutating input', () => {
    const totals = {
      items: { count: 2, overrides: 1, errors: 0 },
      rules: { count: 1, overrides: 0, errors: 1 },
    };
    const original = JSON.parse(JSON.stringify(totals));

    const result = computeTotalsSummary(totals);

    expect(result).toEqual({ count: 3, overrides: 1, errors: 1 });
    expect(totals).toEqual(original);
  });
});

describe('WorldLoadSummaryLogger.logSummary', () => {
  it('logs summary without mutating totals', () => {
    const logger = createMockLogger();
    const totals = { items: { count: 1, overrides: 0, errors: 0 } };
    const original = JSON.parse(JSON.stringify(totals));

    const summaryLogger = new WorldLoadSummaryLogger();
    summaryLogger.logSummary(logger, 'World', ['modA'], ['modA'], 0, totals);

    expect(logger.info).toHaveBeenCalled();
    expect(totals).toEqual(original);
  });
});
