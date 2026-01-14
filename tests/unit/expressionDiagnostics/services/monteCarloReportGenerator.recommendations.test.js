/**
 * @file Recommendation rendering tests for MonteCarloReportGenerator
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockBuild = jest.fn();
const mockGenerate = jest.fn();

jest.mock(
  '../../../../src/expressionDiagnostics/services/RecommendationFactsBuilder.js',
  () => ({
    __esModule: true,
    default: class RecommendationFactsBuilderMock {
      build(...args) {
        return mockBuild(...args);
      }
    },
  })
);

jest.mock(
  '../../../../src/expressionDiagnostics/services/RecommendationEngine.js',
  () => ({
    __esModule: true,
    default: class RecommendationEngineMock {
      generate(...args) {
        return mockGenerate(...args);
      }
    },
  })
);

import MonteCarloReportGenerator from '../../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';

const createMockSimulationResult = (overrides = {}) => ({
  triggerRate: 0.15,
  triggerCount: 1500,
  sampleCount: 10000,
  confidenceInterval: { low: 0.14, high: 0.16 },
  distribution: 'uniform',
  clauseFailures: [],
  storedContexts: [],
  ...overrides,
});

describe('MonteCarloReportGenerator recommendation rendering', () => {
  let generator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockBuild.mockReset();
    mockGenerate.mockReset();

    generator = new MonteCarloReportGenerator({ logger: mockLogger });
  });

  it('renders gate-clamp recommendation evidence with denominators and confidence', () => {
    mockBuild.mockReturnValue({
      invariants: [{ id: 'inv:ok', ok: true, message: '' }],
      clauses: [{ clauseId: 'clause-1', impact: 0.12 }],
    });

    mockGenerate.mockReturnValue([
      {
        title: 'Mood regime allows gate-clamped states',
        type: 'gate_clamp_regime_permissive',
        severity: 'medium',
        confidence: 'low',
        evidence: [
          {
            label: 'Gate clamp rate (mood regime)',
            numerator: 36,
            denominator: 120,
            value: 0.3,
            population: { name: 'mood-regime', count: 120 },
          },
          {
            label: 'Keep ratio for proposed constraint',
            numerator: 84,
            denominator: 120,
            value: 0.7,
            population: { name: 'mood-regime', count: 120 },
          },
          {
            label: 'Axis below gate (valence >= 20)',
            numerator: 36,
            denominator: 120,
            value: 0.3,
            population: { name: 'mood-regime', count: 120 },
          },
        ],
        actions: ['Add regime bounds aligned with gate predicates: valence >= 20.'],
        predictedEffect:
          'Reduce gate clamp frequency while preserving regime coverage.',
        relatedClauseIds: ['clause-1'],
      },
    ]);

    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: createMockSimulationResult(),
      blockers: [],
      summary: '',
    });

    expect(report).toContain('## Recommendations');
    expect(report).toContain(
      '### Recommendation 1: Mood regime allows gate-clamped states'
    );
    expect(report).toContain('**Type**: gate_clamp_regime_permissive');
    expect(report).toContain('**Confidence**: low');
    expect(report).toContain('**Impact (full sample)**: +12.00 pp');
    expect(report).toContain(
      'Gate clamp rate (mood regime): 36/120 (30.00%) | Population: mood-regime (N=120)'
    );
    expect(report).toContain(
      'Keep ratio for proposed constraint: 84/120 (70.00%) | Population: mood-regime (N=120)'
    );
    expect(report).toContain(
      'Axis below gate (valence >= 20): 36/120 (30.00%) | Population: mood-regime (N=120)'
    );
    expect(report).toContain(
      'Add regime bounds aligned with gate predicates: valence >= 20.'
    );
  });
});
