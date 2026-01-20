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
    // Bug B fix: Label should be "Clause Pass-Rate Impact" not "Impact (full sample)"
    expect(report).toContain('**Clause Pass-Rate Impact**: +12.00 pp');
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

  // ─────────────────────────────────────────────────────────────────────────
  // Bug B fix: Impact label clarity tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('impact label clarity (Bug B fix)', () => {
    it('uses "Clause Pass-Rate Impact" label instead of "Impact (full sample)"', () => {
      mockBuild.mockReturnValue({
        invariants: [{ id: 'inv:ok', ok: true, message: '' }],
        clauses: [{ clauseId: 'test-clause', impact: 0.05 }],
      });

      mockGenerate.mockReturnValue([
        {
          title: 'Test recommendation',
          type: 'test_type',
          severity: 'low',
          confidence: 'medium',
          evidence: [],
          actions: [],
          relatedClauseIds: ['test-clause'],
        },
      ]);

      const report = generator.generate({
        expressionName: 'test:expression',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: '',
      });

      // Should use the clearer, more accurate label
      expect(report).toContain('**Clause Pass-Rate Impact**:');
      // Should NOT use the ambiguous old label
      expect(report).not.toContain('**Impact (full sample)**:');
    });

    it('renders n/a when impact is not available', () => {
      mockBuild.mockReturnValue({
        invariants: [{ id: 'inv:ok', ok: true, message: '' }],
        clauses: [], // No clauses with impact
      });

      mockGenerate.mockReturnValue([
        {
          title: 'No impact recommendation',
          type: 'test_type',
          severity: 'low',
          confidence: 'medium',
          evidence: [],
          actions: [],
          relatedClauseIds: ['unknown-clause'],
        },
      ]);

      const report = generator.generate({
        expressionName: 'test:expression',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: '',
      });

      expect(report).toContain('**Clause Pass-Rate Impact**: n/a');
    });
  });

  describe('sole_blocker_edit recommendation rendering', () => {
    it('renders simple label/value evidence format', () => {
      mockBuild.mockReturnValue({
        invariants: [{ id: 'inv:ok', ok: true, message: '' }],
        clauses: [{ clauseId: 'clause-1', impact: 0.4 }],
      });

      mockGenerate.mockReturnValue([
        {
          id: 'sole_blocker_edit:clause-1',
          type: 'sole_blocker_edit',
          title: 'Best First Edit: Lower threshold for emotions.anger',
          severity: 'high',
          confidence: 'high',
          why: 'This clause is the decisive blocker in 42% of failed samples.',
          evidence: [
            { label: 'Current threshold', value: '0.50' },
            { label: 'Sole-blocker rate', value: '42%' },
            { label: 'Sample count', value: '120' },
            { label: 'P50 (50% pass)', value: '0.32' },
            { label: 'P90 (90% pass)', value: '0.18' },
          ],
          actions: [
            {
              label: 'Lower threshold to 0.32',
              detail: 'Would pass ~50% of sole-blocker samples (P50)',
            },
            {
              label: 'Lower threshold to 0.18',
              detail: 'Would pass ~90% of sole-blocker samples (P90)',
            },
          ],
          predictedEffect:
            'Editing this threshold is the most impactful single change.',
          relatedClauseIds: ['clause-1'],
          thresholdSuggestions: [
            {
              targetPassRate: 0.5,
              suggestedThreshold: 0.32,
              direction: 'lower',
              percentile: 'P50',
            },
            {
              targetPassRate: 0.9,
              suggestedThreshold: 0.18,
              direction: 'lower',
              percentile: 'P90',
            },
          ],
        },
      ]);

      const report = generator.generate({
        expressionName: 'test:expression',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: '',
      });

      // Verify simple evidence format rendering
      expect(report).toContain('Current threshold: 0.50');
      expect(report).toContain('Sole-blocker rate: 42%');
      expect(report).toContain('P50 (50% pass): 0.32');
      expect(report).toContain('P90 (90% pass): 0.18');
    });

    it('renders object action format with label and detail', () => {
      mockBuild.mockReturnValue({
        invariants: [{ id: 'inv:ok', ok: true, message: '' }],
        clauses: [{ clauseId: 'clause-1', impact: 0.4 }],
      });

      mockGenerate.mockReturnValue([
        {
          id: 'sole_blocker_edit:clause-1',
          type: 'sole_blocker_edit',
          title: 'Best First Edit: Lower threshold',
          severity: 'high',
          confidence: 'high',
          evidence: [],
          actions: [
            {
              label: 'Lower threshold to 0.32',
              detail: 'Would pass ~50% of sole-blocker samples',
            },
          ],
          relatedClauseIds: ['clause-1'],
        },
      ]);

      const report = generator.generate({
        expressionName: 'test:expression',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: '',
      });

      // Verify object action format with em dash separator
      expect(report).toContain('Lower threshold to 0.32');
      expect(report).toContain('Would pass ~50% of sole-blocker samples');
    });

    it('handles mixed evidence formats in same recommendation', () => {
      mockBuild.mockReturnValue({
        invariants: [{ id: 'inv:ok', ok: true, message: '' }],
        clauses: [{ clauseId: 'clause-1', impact: 0.3 }],
      });

      mockGenerate.mockReturnValue([
        {
          id: 'test:mixed',
          type: 'mixed_format',
          title: 'Mixed format test',
          severity: 'medium',
          confidence: 'medium',
          evidence: [
            // Simple label/value format
            { label: 'Simple metric', value: '42%' },
            // Complex format with numerator/denominator
            {
              label: 'Complex metric',
              numerator: 50,
              denominator: 100,
              value: 0.5,
              population: null,
            },
          ],
          actions: [
            // Simple string action
            'Simple action string',
            // Object action
            { label: 'Object action', detail: 'with detail' },
          ],
          relatedClauseIds: ['clause-1'],
        },
      ]);

      const report = generator.generate({
        expressionName: 'test:expression',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: '',
      });

      // Both formats should be rendered correctly
      expect(report).toContain('Simple metric: 42%');
      expect(report).toContain('Complex metric: 50/100');
      expect(report).toContain('Simple action string');
      expect(report).toContain('Object action');
    });
  });
});
