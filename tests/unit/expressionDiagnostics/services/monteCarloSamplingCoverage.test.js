/**
 * @file Unit tests for sampling coverage calculator utilities
 */

import { describe, it, expect } from '@jest/globals';
import { createSamplingCoverageCalculator } from '../../../../src/expressionDiagnostics/services/monteCarloSamplingCoverage.js';

describe('monteCarloSamplingCoverage', () => {
  it('computes full coverage with good rating and domain summary', () => {
    const calculator = createSamplingCoverageCalculator({
      variables: [
        {
          variablePath: 'moodAxes.valence',
          domain: 'moodAxes',
          min: 0,
          max: 10,
        },
      ],
      binCount: 5,
      minSamplesPerBin: 1,
      tailPercent: 0.2,
    });

    [0, 2, 4, 6, 8, 10].forEach((value) => {
      calculator.recordObservation('moodAxes.valence', value);
    });

    const result = calculator.finalize();
    const variable = result.variables[0];

    expect(variable.rangeCoverage).toBeCloseTo(1, 5);
    expect(variable.binCoverage).toBeCloseTo(1, 5);
    expect(variable.tailCoverage).toEqual({
      low: 2 / 6,
      high: 2 / 6,
    });
    expect(variable.rating).toBe('good');
    expect(variable.sampleCount).toBe(6);

    expect(result.summaryByDomain).toHaveLength(1);
    const summary = result.summaryByDomain[0];
    expect(summary.domain).toBe('moodAxes');
    expect(summary.rangeCoverageAvg).toBeCloseTo(1, 5);
    expect(summary.binCoverageAvg).toBeCloseTo(1, 5);
    expect(summary.rating).toBe('good');
  });

  it('assigns partial rating when thresholds are met without full coverage', () => {
    const calculator = createSamplingCoverageCalculator({
      variables: [
        {
          variablePath: 'emotions.anger',
          domain: 'emotions',
          min: 0,
          max: 10,
        },
      ],
      binCount: 5,
      minSamplesPerBin: 1,
      tailPercent: 0.1,
    });

    [4, 5, 6, 7, 8].forEach((value) => {
      calculator.recordObservation('emotions.anger', value);
    });

    const result = calculator.finalize();
    const variable = result.variables[0];

    expect(variable.rangeCoverage).toBeCloseTo(0.4, 5);
    expect(variable.binCoverage).toBeCloseTo(0.6, 5);
    expect(variable.rating).toBe('partial');
  });

  it('tracks zero-rate metrics for variables and domain summaries', () => {
    const calculator = createSamplingCoverageCalculator({
      variables: [
        {
          variablePath: 'emotions.joy',
          domain: 'emotions',
          min: 0,
          max: 1,
        },
      ],
      binCount: 4,
      minSamplesPerBin: 1,
      tailPercent: 0.1,
    });

    [0, 0, 0.5, 1].forEach((value) => {
      calculator.recordObservation('emotions.joy', value);
    });

    const result = calculator.finalize();
    const variable = result.variables[0];
    const summary = result.summaryByDomain[0];

    expect(variable.zeroCount).toBe(2);
    expect(variable.zeroRate).toBeCloseTo(0.5, 5);
    expect(summary.zeroRateAvg).toBeCloseTo(0.5, 5);
  });

  it('marks unknown domains and excludes them from summaries', () => {
    const calculator = createSamplingCoverageCalculator({
      variables: [
        {
          variablePath: 'emotions.joy',
          domain: 'emotions',
          min: 0,
          max: 1,
        },
        {
          variablePath: 'unknown.metric',
          domain: 'unknown',
        },
      ],
    });

    calculator.recordObservation('emotions.joy', 0.4);
    calculator.recordObservation('unknown.metric', 12);

    const result = calculator.finalize();
    const unknownVariable = result.variables.find(
      (variable) => variable.variablePath === 'unknown.metric'
    );

    expect(unknownVariable.rating).toBe('unknown');
    expect(unknownVariable.rangeCoverage).toBeNull();
    expect(unknownVariable.binCoverage).toBeNull();
    expect(unknownVariable.tailCoverage).toBeNull();

    expect(result.summaryByDomain).toHaveLength(1);
    expect(result.summaryByDomain[0].domain).toBe('emotions');
  });
});
