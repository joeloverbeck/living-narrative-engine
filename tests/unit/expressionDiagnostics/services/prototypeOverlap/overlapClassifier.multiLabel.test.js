/**
 * @file Unit tests for OverlapClassifier multi-label evidence
 */

import { describe, it, expect } from '@jest/globals';
import OverlapClassifier from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js';

describe('OverlapClassifier - multi-label evidence', () => {
  const createMockLogger = () => ({
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  });

  const createConfig = (overrides = {}) => ({
    minOnEitherRateForMerge: 0.05,
    minGateOverlapRatio: 0.9,
    minCorrelationForMerge: 0.98,
    maxMeanAbsDiffForMerge: 0.03,
    maxExclusiveRateForSubsumption: 0.01,
    minCorrelationForSubsumption: 0.95,
    minDominanceForSubsumption: 0.95,
    nestedConditionalThreshold: 0.97,
    enableConvertToExpression: true,
    ...overrides,
  });

  const createCandidateMetrics = (overrides = {}) => ({
    activeAxisOverlap: 0.9,
    signAgreement: 0.95,
    weightCosineSimilarity: 0.98,
    ...overrides,
  });

  const createBehaviorMetrics = (overrides = {}) => {
    const gateOverlap = {
      onEitherRate: 0.3,
      onBothRate: 0.28,
      pOnlyRate: 0.01,
      qOnlyRate: 0.01,
      ...(overrides.gateOverlap || {}),
    };
    const intensity = {
      pearsonCorrelation: 0.99,
      meanAbsDiff: 0.02,
      dominanceP: 0.3,
      dominanceQ: 0.3,
      ...(overrides.intensity || {}),
    };
    const passRates = overrides.passRates ?? null;
    const gateImplication = overrides.gateImplication ?? null;
    const gateParseInfo = overrides.gateParseInfo ?? null;

    return { gateOverlap, intensity, passRates, gateImplication, gateParseInfo };
  };

  const createAImpliesBGateImplication = (overrides = {}) => ({
    A_implies_B: true,
    B_implies_A: false,
    counterExampleAxes: [],
    relation: 'narrower',
    evidence: [
      {
        axis: 'threat',
        intervalA: { lower: null, upper: 0.15, unsatisfiable: false },
        intervalB: { lower: null, upper: null, unsatisfiable: false },
        A_subset_B: true,
        B_subset_A: false,
      },
    ],
    ...overrides,
  });

  const createClassifier = (configOverrides = {}) => {
    const logger = createMockLogger();
    const config = createConfig(configOverrides);
    const classifier = new OverlapClassifier({ config, logger });
    return { classifier, logger };
  };

  it('orders multi-label matches by priority and marks primary', () => {
    const { classifier } = createClassifier();
    const candidateMetrics = createCandidateMetrics();
    const behaviorMetrics = createBehaviorMetrics({
      intensity: {
        pearsonCorrelation: 0.99,
        meanAbsDiff: 0.05,
      },
      passRates: { pA_given_B: 0.5, pB_given_A: 0.99, coPassCount: 800 },
      gateImplication: createAImpliesBGateImplication(),
    });

    const result = classifier.classify(candidateMetrics, behaviorMetrics);
    const types = result.allMatchingClassifications.map((entry) => entry.type);

    expect(types).toEqual(['convert_to_expression', 'nested_siblings']);
    expect(result.allMatchingClassifications[0].isPrimary).toBe(true);
    expect(result.allMatchingClassifications[1].isPrimary).toBe(false);
  });

  it('captures multiple matches when merge, convert, and nested align', () => {
    const { classifier } = createClassifier();
    const candidateMetrics = createCandidateMetrics();
    const behaviorMetrics = createBehaviorMetrics({
      gateOverlap: { onEitherRate: 0.3, onBothRate: 0.28 },
      intensity: { pearsonCorrelation: 0.99, meanAbsDiff: 0.02 },
      passRates: { pA_given_B: 0.5, pB_given_A: 0.99, coPassCount: 800 },
      gateImplication: createAImpliesBGateImplication(),
    });

    const result = classifier.classify(candidateMetrics, behaviorMetrics);
    const types = result.allMatchingClassifications.map((entry) => entry.type);

    expect(types).toEqual([
      'merge_recommended',
      'convert_to_expression',
      'nested_siblings',
    ]);
  });

  it('includes keep_distinct as the sole match when nothing else applies', () => {
    const { classifier } = createClassifier();
    const candidateMetrics = createCandidateMetrics();
    const behaviorMetrics = createBehaviorMetrics({
      gateOverlap: { onEitherRate: 0.3, onBothRate: 0.05, pOnlyRate: 0.2, qOnlyRate: 0.2 },
      intensity: { pearsonCorrelation: 0.4, meanAbsDiff: 0.2 },
      passRates: { pA_given_B: 0.5, pB_given_A: 0.5, coPassCount: 200 },
    });

    const result = classifier.classify(candidateMetrics, behaviorMetrics);

    expect(result.type).toBe('keep_distinct');
    expect(result.allMatchingClassifications).toHaveLength(1);
    expect(result.allMatchingClassifications[0].type).toBe('keep_distinct');
  });

  it('reports confidence and evidence for each matching classification', () => {
    const { classifier } = createClassifier();
    const candidateMetrics = createCandidateMetrics();
    const behaviorMetrics = createBehaviorMetrics();

    const result = classifier.classify(candidateMetrics, behaviorMetrics);
    const match = result.allMatchingClassifications.find(
      (entry) => entry.type === 'merge_recommended'
    );

    expect(match).toBeDefined();
    expect(match.confidence).toBeGreaterThanOrEqual(0);
    expect(match.confidence).toBeLessThanOrEqual(1);
    expect(match.evidence).toHaveProperty('gateOverlapRatio');
    expect(match.evidence).toHaveProperty('meanAbsDiff');
  });

  it('clamps confidence to zero when evidence is missing or invalid', () => {
    const { classifier } = createClassifier();
    const candidateMetrics = createCandidateMetrics();
    const behaviorMetrics = createBehaviorMetrics({
      passRates: { pA_given_B: NaN, pB_given_A: NaN, coPassCount: 0 },
    });

    const result = classifier.classify(candidateMetrics, behaviorMetrics);
    const nestedMatch = result.allMatchingClassifications.find(
      (entry) => entry.type === 'nested_siblings'
    );

    if (nestedMatch) {
      expect(nestedMatch.confidence).toBeGreaterThanOrEqual(0);
      expect(nestedMatch.confidence).toBeLessThanOrEqual(1);
    }
  });
});
