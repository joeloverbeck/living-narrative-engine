/**
 * @file Unit tests for sampling coverage conclusions builder
 */

import { describe, it, expect } from '@jest/globals';
import { buildSamplingCoverageConclusions } from '../../../../src/expressionDiagnostics/services/samplingCoverageConclusions.js';

describe('buildSamplingCoverageConclusions', () => {
  it('orders domain conclusions by severity and suppresses tail asymmetry when tails are near zero', () => {
    const samplingCoverage = {
      summaryByDomain: [
        {
          domain: 'alpha',
          variableCount: 1,
          rangeCoverageAvg: 0.95,
          binCoverageAvg: 0.95,
          tailCoverageAvg: { low: 0.1, high: 0.001 },
          rating: 'poor',
        },
        {
          domain: 'beta',
          variableCount: 1,
          rangeCoverageAvg: 0.7,
          binCoverageAvg: 0.8,
          tailCoverageAvg: { low: 0.1, high: 0.1 },
          rating: 'partial',
        },
        {
          domain: 'gamma',
          variableCount: 1,
          rangeCoverageAvg: 0.92,
          binCoverageAvg: 0.92,
          tailCoverageAvg: { low: 0.09, high: 0.08 },
          rating: 'good',
        },
      ],
      variables: [],
      config: { tailPercent: 0.1 },
    };

    const conclusions = buildSamplingCoverageConclusions(samplingCoverage);

    expect(conclusions.domainConclusions[0].severity).toBe('critical');
    expect(conclusions.domainConclusions[0].text).toContain('alpha');
    expect(conclusions.domainConclusions[1].severity).toBe('warn');
    expect(conclusions.domainConclusions[1].text).toContain('beta');
    expect(conclusions.domainConclusions[2].severity).toBe('info');
    expect(conclusions.domainConclusions[2].text).toContain('gamma');
    expect(
      conclusions.domainConclusions.some((entry) =>
        entry.text.includes('lopsided')
      )
    ).toBe(false);
  });

  it('summarizes variable coverage counts with severity based on proportion', () => {
    const samplingCoverage = {
      summaryByDomain: [],
      variables: [
        {
          variablePath: 'vars.a',
          rangeCoverage: 0.6,
          tailCoverage: { low: 0.1, high: 0.1 },
          rating: 'partial',
        },
        {
          variablePath: 'vars.b',
          rangeCoverage: 0.9,
          tailCoverage: { low: 0.1, high: 0.002 },
          rating: 'good',
        },
        {
          variablePath: 'vars.c',
          rangeCoverage: 0.7,
          tailCoverage: { low: 0.1, high: 0.1 },
          rating: 'good',
        },
        {
          variablePath: 'vars.d',
          rangeCoverage: 0.95,
          tailCoverage: { low: 0.1, high: 0.1 },
          rating: 'good',
        },
        {
          variablePath: 'vars.e',
          rangeCoverage: 0.95,
          tailCoverage: { low: 0.1, high: 0.1 },
          rating: 'good',
        },
      ],
      config: { tailPercent: 0.1 },
    };

    const conclusions = buildSamplingCoverageConclusions(samplingCoverage);

    expect(conclusions.variableSummary).toHaveLength(1);
    expect(conclusions.variableSummary[0].severity).toBe('critical');
    expect(conclusions.variableSummary[0].text).toContain('Across variables');
    expect(conclusions.variableSummary[0].text).toContain('upper-tail');
    expect(conclusions.variableSummary[0].text).toContain('truncated range');
  });

  it('emits global implications and watchlist minima when requested', () => {
    const samplingCoverage = {
      summaryByDomain: [
        {
          domain: 'delta',
          variableCount: 2,
          rangeCoverageAvg: 0.6,
          binCoverageAvg: 0.7,
          tailCoverageAvg: { low: 0.01, high: 0.08 },
          rating: 'poor',
        },
      ],
      variables: [
        {
          variablePath: 'vars.low',
          rangeCoverage: 0.4,
          tailCoverage: { low: 0.02, high: 0.07 },
          rating: 'poor',
        },
        {
          variablePath: 'vars.mid',
          rangeCoverage: 0.6,
          tailCoverage: { low: 0.05, high: 0.04 },
          rating: 'partial',
        },
      ],
      config: { tailPercent: 0.1 },
    };

    const conclusions = buildSamplingCoverageConclusions(samplingCoverage, {
      includeWatchlist: true,
    });

    expect(conclusions.globalImplications.length).toBe(2);
    expect(conclusions.globalImplications[0].text).toContain('lower end');
    expect(conclusions.globalImplications[1].text).toContain('overrepresented regimes');
    expect(conclusions.watchlist.length).toBeGreaterThan(0);
    expect(conclusions.watchlist[0].text).toContain('Worst range coverage');
  });
});
