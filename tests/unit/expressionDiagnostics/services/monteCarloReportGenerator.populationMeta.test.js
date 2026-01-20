/**
 * @file Unit tests for MonteCarloReportGenerator population metadata headers.
 */

import { describe, it, expect, jest } from '@jest/globals';
import MonteCarloReportGenerator from '../../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';
import {
  buildPopulationHash,
  buildPopulationPredicate,
} from '../../../../src/expressionDiagnostics/utils/populationHashUtils.js';

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createStoredContexts = (count) =>
  Array.from({ length: count }, () => ({
    moodAxes: {
      valence: 10,
    },
    emotions: {
      joy: 0.7,
    },
    sexualStates: {},
  }));

describe('MonteCarloReportGenerator population metadata', () => {
  it('prints stored-mood-regime headers with predicate and hash', () => {
    const logger = createMockLogger();
    const generator = new MonteCarloReportGenerator({ logger });
    const storedContexts = createStoredContexts(10);

    const prerequisites = [
      {
        logic: {
          and: [
            { '>=': [{ var: 'moodAxes.valence' }, 0] },
            { '>=': [{ var: 'emotions.joy' }, 0.5] },
          ],
        },
      },
    ];

    const report = generator.generate({
      expressionName: 'test-expression',
      simulationResult: {
        sampleCount: 10,
        triggerRate: 0.2,
        confidenceInterval: { low: 0.1, high: 0.3 },
        distribution: 'uniform',
        samplingMode: 'static',
        samplingMetadata: {},
        storedContexts,
      },
      blockers: [],
      summary: 'Summary text',
      prerequisites,
    });

    const predicate = buildPopulationPredicate([
      { varPath: 'moodAxes.valence', operator: '>=', threshold: 0 },
    ]);
    const sampleIds = Array.from({ length: 10 }, (_, index) => index);
    const expectedHash = buildPopulationHash(sampleIds, predicate);

    expect(report).toContain(
      `**Population**: stored-mood-regime (N=10; predicate: ${predicate}; hash: ${expectedHash}).`
    );
  });
});
