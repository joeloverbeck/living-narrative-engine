/**
 * @file Unit tests for CoreSectionGenerator
 */

import { describe, it, expect } from '@jest/globals';
import CoreSectionGenerator from '../../../../../src/expressionDiagnostics/services/sectionGenerators/CoreSectionGenerator.js';
import ReportFormattingService from '../../../../../src/expressionDiagnostics/services/ReportFormattingService.js';
import StatisticalComputationService from '../../../../../src/expressionDiagnostics/services/StatisticalComputationService.js';

const createGenerator = (overrides = {}) => {
  const formattingService = new ReportFormattingService();
  const witnessFormatter = overrides.witnessFormatter ?? {
    formatWitness: () => 'WITNESS',
  };
  const statisticalService = new StatisticalComputationService();
  const dataExtractor = overrides.dataExtractor ?? {
    getLowestCoverageVariables: (variables) => variables,
  };

  return new CoreSectionGenerator({
    formattingService,
    witnessFormatter,
    statisticalService,
    dataExtractor,
    ...overrides,
  });
};

describe('CoreSectionGenerator', () => {
  it('requires formatting service', () => {
    expect(() => new CoreSectionGenerator()).toThrow(
      'CoreSectionGenerator requires formattingService'
    );
  });

  it('builds stored populations based on mood constraints', () => {
    const generator = createGenerator();

    const storedContexts = [
      { moodAxes: { joy: 0.4 } },
      { moodAxes: { joy: 0.8 } },
    ];
    const moodConstraints = [
      { varPath: 'moodAxes.joy', operator: '>=', threshold: 0.5 },
    ];

    const populations = generator.buildStoredContextPopulations(
      storedContexts,
      moodConstraints
    );

    expect(populations.storedGlobal.count).toBe(2);
    expect(populations.storedMoodRegime.count).toBe(1);
  });

  it('adds a stored-context cap note to population summary', () => {
    const generator = createGenerator();

    const summary = generator.resolvePopulationSummary({
      sampleCount: 100,
      inRegimeSampleCount: 40,
      storedContexts: new Array(10).fill({}),
      populationSummary: {
        storedContextCount: 10,
        storedContextLimit: 10,
        storedInRegimeCount: 6,
      },
    });

    const section = generator.generatePopulationSummary(summary);

    expect(section).toContain('Stored contexts are capped');
  });

  it('renders witness sections via witness formatter', () => {
    const generator = createGenerator({
      witnessFormatter: {
        formatWitness: () => 'WITNESS SECTION',
      },
    });

    const section = generator.generateWitnessSection({
      witnessAnalysis: {
        witnesses: [{ id: 'w1' }],
      },
    });

    expect(section).toContain('## Ground-Truth Witnesses');
    expect(section).toContain('WITNESS SECTION');
  });

  it('renders static cross-reference sections with confirmations', () => {
    const generator = createGenerator();

    const section = generator.generateStaticCrossReference(
      {
        gateConflicts: [{ axis: 'joy', requiredMin: 0.8, requiredMax: 0.2 }],
        unreachableThresholds: [
          { prototypeId: 'joy', threshold: 0.9, maxPossible: 0.4 },
        ],
      },
      [
        {
          hierarchicalBreakdown: {
            variablePath: 'moodAxes.joy',
            failureRate: 0.2,
            inRegimeFailureRate: 0.1,
          },
        },
        {
          hierarchicalBreakdown: {
            variablePath: 'emotions.joy',
            failureRate: 0.2,
            inRegimeFailureRate: 0.1,
          },
        },
      ]
    );

    expect(section).toContain('## Static Analysis Cross-Reference');
    expect(section).toContain('Gate Conflicts');
    expect(section).toContain('Unreachable Thresholds');
    expect(section).toContain('✅ Fail% global');
  });

  it('renders sampling coverage with lowest coverage variables', () => {
    const generator = createGenerator({
      dataExtractor: {
        getLowestCoverageVariables: () => [
          {
            variablePath: 'moodAxes.joy',
            rangeCoverage: 0.2,
            binCoverage: 0.1,
            tailCoverage: { low: 0.05, high: 0.07 },
            rating: 'poor',
          },
        ],
      },
    });

    const section = generator.generateSamplingCoverageSection(
      {
        summaryByDomain: [
          {
            domain: 'moodAxes',
            variableCount: 1,
            rangeCoverageAvg: 0.2,
            binCoverageAvg: 0.1,
            tailCoverageAvg: { low: 0.05, high: 0.07 },
            zeroRateAvg: 0.0,
            rating: 'poor',
          },
        ],
        variables: [{ variablePath: 'moodAxes.joy' }],
        config: { binCount: 10, tailPercent: 0.1 },
      },
      'static'
    );

    expect(section).toContain('## Sampling Coverage');
    expect(section).toContain('Lowest Coverage Variables');
    expect(section).toContain('moodAxes.joy');
  });
});
