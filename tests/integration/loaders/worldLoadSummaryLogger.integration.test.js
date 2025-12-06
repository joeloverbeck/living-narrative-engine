import WorldLoadSummaryLogger, {
  computeTotalsSummary,
} from '../../../src/loaders/WorldLoadSummaryLogger.js';
import { LoadResultAggregator } from '../../../src/loaders/LoadResultAggregator.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

describe('WorldLoadSummaryLogger integration', () => {
  let infoSpy;
  let warnSpy;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs a detailed summary with sorted totals and incompatibility warnings', () => {
    const aggregator = new LoadResultAggregator({});
    aggregator.aggregate({ count: 5, overrides: 2, errors: 1 }, 'actions');
    aggregator.aggregate({ count: 3, overrides: 0, errors: 0 }, 'entities');
    aggregator.recordFailure('macros');

    const totals = aggregator.getTotalCounts();
    expect(computeTotalsSummary(totals)).toEqual({
      count: 8,
      overrides: 2,
      errors: 2,
    });

    const logger = new ConsoleLogger(LogLevel.DEBUG);
    const summaryLogger = new WorldLoadSummaryLogger();

    summaryLogger.logSummary(
      logger,
      'isekai-world',
      ['core-mod', 'isekai-expansion'],
      ['core-mod', 'isekai-expansion', 'bonus-pack'],
      2,
      totals
    );

    const infoMessages = infoSpy.mock.calls
      .map(([message]) => message)
      .filter((message) => !message.startsWith('[ConsoleLogger]'));
    const summaryLines = infoMessages.filter((msg) =>
      msg.startsWith('     - ')
    );

    expect(infoMessages[0]).toBe(
      "— ModsLoader Load Summary (World: 'isekai-world') —"
    );
    expect(infoMessages).toContain(
      '  • Requested Mods (raw): [core-mod, isekai-expansion]'
    );
    expect(infoMessages).toContain(
      '  • Final Load Order     : [core-mod, isekai-expansion, bonus-pack]'
    );
    expect(infoMessages).toContain('  • Content Loading Summary (Totals):');

    expect(summaryLines).toHaveLength(5);
    expect(summaryLines[0]).toMatch(
      /actions\s+: 5 loaded, 2 overrides, 1 errors/
    );
    expect(summaryLines[1]).toMatch(
      /entities\s+: 3 loaded, 0 overrides, 0 errors/
    );
    expect(summaryLines[2]).toMatch(
      /macros\s+: 0 loaded, 0 overrides, 1 errors/
    );
    expect(summaryLines[3]).toBe(
      '     - ----------------------------------------------'
    );
    expect(summaryLines[4]).toMatch(/TOTAL\s+: C:8, O:2, E:2/);
    expect(infoMessages.at(-1)).toBe(
      '———————————————————————————————————————————'
    );

    expect(warnSpy).toHaveBeenCalledWith(
      '  • Engine-version incompatibilities detected: 2'
    );
  });

  it('reports an empty summary without warnings when no totals exist', () => {
    const logger = new ConsoleLogger(LogLevel.INFO);
    const summaryLogger = new WorldLoadSummaryLogger();

    summaryLogger.logSummary(logger, 'sandbox', [], ['sandbox'], 0, {});

    const infoMessages = infoSpy.mock.calls
      .map(([message]) => message)
      .filter((message) => !message.startsWith('[ConsoleLogger]'));

    expect(infoMessages[0]).toBe(
      "— ModsLoader Load Summary (World: 'sandbox') —"
    );
    expect(infoMessages).toContain('  • Requested Mods (raw): []');
    expect(infoMessages).toContain('  • Final Load Order     : [sandbox]');
    expect(infoMessages).toContain('  • Content Loading Summary (Totals):');
    expect(infoMessages).toContain(
      '     - No specific content items were processed by loaders in this run.'
    );
    expect(infoMessages.at(-1)).toBe(
      '———————————————————————————————————————————'
    );

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
