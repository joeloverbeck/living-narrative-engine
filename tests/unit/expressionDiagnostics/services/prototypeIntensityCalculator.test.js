/**
 * @file Unit tests for intensity/scoring behavior via PrototypeFitRankingService.
 */
import { describe, it, expect, jest } from '@jest/globals';
import PrototypeFitRankingService from '../../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';

const createService = (prototypes) => {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  const prototypeRegistryService = {
    getPrototypesByType: jest.fn(() => prototypes),
    getAllPrototypes: jest.fn(() => prototypes),
    getPrototypeDefinitions: jest.fn(),
    getPrototype: jest.fn(),
  };
  const prototypeTypeDetector = {
    detectReferencedTypes: jest.fn(() => ({ hasEmotions: true, hasSexualStates: false })),
    extractCurrentPrototype: jest.fn(() => null),
  };
  const dataRegistry = {
    get: jest.fn(),
    getLookupData: jest.fn(),
  };

  const service = new PrototypeFitRankingService({
    dataRegistry,
    logger,
    prototypeRegistryService,
    prototypeTypeDetector,
  });

  return service;
};

const getResult = (results, id) =>
  results.leaderboard.find((entry) => entry.prototypeId === id);

describe('PrototypeIntensityCalculator (via PrototypeFitRankingService)', () => {
  it('computes normalized intensity with missing axes for a single context', () => {
    const prototypes = [
      {
        id: 'mixed-weights',
        type: 'emotion',
        weights: { valence: 1, arousal: 1 },
        gates: [],
      },
    ];
    const service = createService(prototypes);
    const contexts = [{ moodAxes: { valence: 50 } }];

    const results = service.analyzeAllPrototypeFit({ id: 'expr' }, contexts, new Map(), 0.2);
    const entry = getResult(results, 'mixed-weights');

    expect(entry.intensityDistribution.p50).toBeCloseTo(0.25, 6);
    expect(entry.intensityDistribution.p90).toBeCloseTo(0.25, 6);
    expect(entry.intensityDistribution.p95).toBeCloseTo(0.25, 6);
    expect(entry.intensityDistribution.pAboveThreshold).toBe(1);
    expect(entry.intensityDistribution.min).toBeCloseTo(0.25, 6);
    expect(entry.intensityDistribution.max).toBeCloseTo(0.25, 6);
  });

  it('clamps negative intensity to 0 when weights oppose positive axes', () => {
    const prototypes = [
      {
        id: 'negative-clamp',
        type: 'emotion',
        weights: { valence: -1 },
        gates: [],
      },
    ];
    const service = createService(prototypes);
    const contexts = [{ moodAxes: { valence: 50 } }];

    const results = service.analyzeAllPrototypeFit({ id: 'expr' }, contexts, new Map(), 0.1);
    const entry = getResult(results, 'negative-clamp');

    expect(entry.intensityDistribution.p50).toBe(0);
    expect(entry.intensityDistribution.pAboveThreshold).toBe(0);
  });

  it('allows negative weights to produce positive intensity with negative axes', () => {
    const prototypes = [
      {
        id: 'negative-aligns',
        type: 'emotion',
        weights: { valence: -1 },
        gates: [],
      },
    ];
    const service = createService(prototypes);
    const contexts = [{ moodAxes: { valence: -50 } }];

    const results = service.analyzeAllPrototypeFit({ id: 'expr' }, contexts, new Map(), 0.3);
    const entry = getResult(results, 'negative-aligns');

    expect(entry.intensityDistribution.p50).toBeCloseTo(0.5, 6);
    expect(entry.intensityDistribution.pAboveThreshold).toBe(1);
  });

  it('computes percentiles using the floor index', () => {
    const prototypes = [
      {
        id: 'percentile-proto',
        type: 'emotion',
        weights: { valence: 1 },
        gates: [],
      },
    ];
    const service = createService(prototypes);
    const contexts = Array.from({ length: 10 }, (_, idx) => ({
      moodAxes: { valence: idx * 10 },
    }));

    const results = service.analyzeAllPrototypeFit({ id: 'expr' }, contexts, new Map(), 0.1);
    const entry = getResult(results, 'percentile-proto');

    expect(entry.intensityDistribution.p50).toBeCloseTo(0.4, 6);
    expect(entry.intensityDistribution.p90).toBeCloseTo(0.8, 6);
    expect(entry.intensityDistribution.p95).toBeCloseTo(0.8, 6);
  });

  it('returns empty distribution metrics when no gates pass', () => {
    const prototypes = [
      {
        id: 'no-gates-pass',
        type: 'emotion',
        weights: { valence: 1 },
        gates: ['valence >= 0.5'],
      },
    ];
    const service = createService(prototypes);
    const contexts = [{ moodAxes: { valence: 40 } }, { moodAxes: { valence: 30 } }];

    const results = service.analyzeAllPrototypeFit({ id: 'expr' }, contexts, new Map(), 0.2);
    const entry = getResult(results, 'no-gates-pass');

    expect(entry.intensityDistribution.p50).toBe(0);
    expect(entry.intensityDistribution.p90).toBe(0);
    expect(entry.intensityDistribution.p95).toBe(0);
    expect(entry.intensityDistribution.pAboveThreshold).toBe(0);
    expect(entry.intensityDistribution.min).toBeNull();
    expect(entry.intensityDistribution.max).toBeNull();
  });

  it('reports conflicts based on constraint midpoint direction', () => {
    const prototypes = [
      {
        id: 'conflict-proto',
        type: 'emotion',
        weights: { valence: -0.6, arousal: -0.4 },
        gates: [],
      },
    ];
    const service = createService(prototypes);
    const contexts = [{ moodAxes: { valence: 60, arousal: -40 } }];
    const axisConstraints = new Map([
      ['valence', { min: 0.2, max: 0.6 }],
      ['arousal', { min: -0.8, max: -0.4 }],
    ]);

    const results = service.analyzeAllPrototypeFit(
      { id: 'expr' },
      contexts,
      axisConstraints,
      0.2
    );
    const entry = getResult(results, 'conflict-proto');

    expect(entry.conflictScore).toBeCloseTo(0.5, 6);
    expect(entry.conflictMagnitude).toBeCloseTo(0.6, 6);
    expect(entry.conflictingAxes).toEqual([
      { axis: 'valence', weight: -0.6, direction: 'negative' },
    ]);
  });

  it('computes composite score from gate pass rate and intensity rate', () => {
    const prototypes = [
      {
        id: 'composite-proto',
        type: 'emotion',
        weights: { valence: 1 },
        gates: ['valence >= 0.5'],
      },
    ];
    const service = createService(prototypes);
    const contexts = [
      { moodAxes: { valence: 0 } },
      { moodAxes: { valence: 50 } },
      { moodAxes: { valence: 100 } },
      { moodAxes: { valence: 100 } },
    ];
    const results = service.analyzeAllPrototypeFit(
      { id: 'expr' },
      contexts,
      new Map(),
      0.6
    );
    const entry = getResult(results, 'composite-proto');

    const gatePassRate = 3 / 4;
    const pIntensityAbove = 2 / 3;
    const conflictScore = 0;
    const exclusionCompatibility = 1;
    const expectedScore =
      0.3 * gatePassRate +
      0.35 * pIntensityAbove +
      0.2 * (1 - conflictScore) +
      0.15 * exclusionCompatibility;

    expect(entry.compositeScore).toBeCloseTo(expectedScore, 6);
  });

  it('sets intensity rates to 0 for empty context samples', () => {
    const prototypes = [
      {
        id: 'empty-contexts',
        type: 'emotion',
        weights: { valence: 1 },
        gates: [],
      },
    ];
    const service = createService(prototypes);
    const axisConstraints = new Map([['valence', { min: -1, max: 1 }]]);

    const result = service.detectPrototypeGaps({ id: 'expr' }, [], axisConstraints, 0.3);

    expect(result.kNearestNeighbors[0].pIntensityAbove).toBe(0);
  });

  it('computes correct intensity when inhibitory_control axis is provided', () => {
    // Regression test: ensures all 9 mood axes are properly handled.
    // Before fix, inhibitory_control was missing from MOOD_AXES_KEYS,
    // causing weights referencing it to contribute 0 to numerator
    // while still being counted in the denominator, crushing intensity.
    const prototypes = [
      {
        id: 'unease-like',
        type: 'emotion',
        // Simplified weights similar to unease prototype
        weights: { valence: -0.3, threat: 0.5, inhibitory_control: -0.2 },
        gates: [],
      },
    ];
    const service = createService(prototypes);

    // Context where all weights align positively:
    // - valence: -100 (negative weight * negative value = positive)
    // - threat: 100 (positive weight * positive value = positive)
    // - inhibitory_control: -100 (negative weight * negative value = positive)
    const contexts = [
      {
        moodAxes: {
          valence: -100,
          arousal: 0,
          agency_control: 0,
          threat: 100,
          engagement: 0,
          future_expectancy: 0,
          self_evaluation: 0,
          affiliation: 0,
          inhibitory_control: -100,
        },
      },
    ];

    const results = service.analyzeAllPrototypeFit(
      { id: 'expr' },
      contexts,
      new Map(),
      0.3
    );
    const entry = getResult(results, 'unease-like');

    // With all axes aligned:
    // rawSum = (-0.3 * -1) + (0.5 * 1) + (-0.2 * -1) = 0.3 + 0.5 + 0.2 = 1.0
    // sumAbsWeights = 0.3 + 0.5 + 0.2 = 1.0
    // intensity = 1.0 / 1.0 = 1.0 (clamped to [0,1])
    expect(entry.intensityDistribution.p50).toBeCloseTo(1.0, 6);
    expect(entry.intensityDistribution.pAboveThreshold).toBe(1);
  });

  it('handles missing inhibitory_control gracefully with permissive mode', () => {
    // Verifies backward compatibility: contexts without full axis set
    // still work (missing axes default to 0).
    const prototypes = [
      {
        id: 'partial-context',
        type: 'emotion',
        weights: { valence: 1, inhibitory_control: 0.5 },
        gates: [],
      },
    ];
    const service = createService(prototypes);

    // Context missing inhibitory_control - should default to 0
    const contexts = [{ moodAxes: { valence: 60 } }];

    const results = service.analyzeAllPrototypeFit(
      { id: 'expr' },
      contexts,
      new Map(),
      0.2
    );
    const entry = getResult(results, 'partial-context');

    // rawSum = (1 * 0.6) + (0.5 * 0) = 0.6
    // sumAbsWeights = 1 + 0.5 = 1.5
    // intensity = 0.6 / 1.5 = 0.4
    expect(entry.intensityDistribution.p50).toBeCloseTo(0.4, 6);
  });
});
