/**
 * @file Tests for prototype overlap configuration
 * @see src/expressionDiagnostics/config/prototypeOverlapConfig.js
 * @see specs/prototype-redundancy-analyzer-v2.md
 */

import { describe, it, expect } from '@jest/globals';
import { PROTOTYPE_OVERLAP_CONFIG } from '../../../../src/expressionDiagnostics/config/prototypeOverlapConfig.js';

describe('prototypeOverlapConfig', () => {
  describe('config object structure', () => {
    it('should be frozen (immutable)', () => {
      expect(Object.isFrozen(PROTOTYPE_OVERLAP_CONFIG)).toBe(true);
    });

    it('should be importable without side effects', () => {
      // If we can get here without errors, import was side-effect free
      expect(PROTOTYPE_OVERLAP_CONFIG).toBeDefined();
      expect(typeof PROTOTYPE_OVERLAP_CONFIG).toBe('object');
    });
  });

  describe('existing properties (backward compatibility)', () => {
    // Stage A: Candidate filtering thresholds
    it('should have activeAxisEpsilon unchanged', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.activeAxisEpsilon).toBe(0.08);
    });

    it('should have candidateMinActiveAxisOverlap unchanged', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.candidateMinActiveAxisOverlap).toBe(0.6);
    });

    it('should have candidateMinSignAgreement unchanged', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.candidateMinSignAgreement).toBe(0.8);
    });

    it('should have candidateMinCosineSimilarity unchanged', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.candidateMinCosineSimilarity).toBe(0.85);
    });

    // Stage B: Behavioral sampling configuration
    it('should have sampleCountPerPair unchanged', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.sampleCountPerPair).toBe(8000);
    });

    it('should have divergenceExamplesK unchanged', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.divergenceExamplesK).toBe(5);
    });

    it('should have dominanceDelta unchanged', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.dominanceDelta).toBe(0.05);
    });

    // Classification thresholds for MERGE
    it('should have minOnEitherRateForMerge unchanged', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.minOnEitherRateForMerge).toBe(0.05);
    });

    it('should have minGateOverlapRatio unchanged', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.minGateOverlapRatio).toBe(0.9);
    });

    it('should have minCorrelationForMerge unchanged', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.minCorrelationForMerge).toBe(0.98);
    });

    it('should have maxMeanAbsDiffForMerge unchanged', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.maxMeanAbsDiffForMerge).toBe(0.03);
    });

    // Classification thresholds for SUBSUMED
    it('should have maxExclusiveRateForSubsumption unchanged', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.maxExclusiveRateForSubsumption).toBe(0.01);
    });

    it('should have minCorrelationForSubsumption unchanged', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.minCorrelationForSubsumption).toBe(0.95);
    });

    it('should have minDominanceForSubsumption unchanged', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.minDominanceForSubsumption).toBe(0.95);
    });

    // Global correlation thresholds
    it('should have minGlobalCorrelationForMerge', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.minGlobalCorrelationForMerge).toBe(0.9);
    });

    it('should have minGlobalCorrelationForSubsumption', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.minGlobalCorrelationForSubsumption).toBe(
        0.85
      );
    });

    it('should have coPassSampleConfidenceThreshold', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.coPassSampleConfidenceThreshold).toBe(500);
    });

    it('should have minCoPassRatioForReliable', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.minCoPassRatioForReliable).toBe(0.1);
    });

    it('should have coPassCorrelationWeight', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.coPassCorrelationWeight).toBe(0.6);
    });

    it('should have globalCorrelationWeight', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.globalCorrelationWeight).toBe(0.4);
    });

    it('should have maxGlobalMeanAbsDiffForMerge', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.maxGlobalMeanAbsDiffForMerge).toBe(0.15);
    });

    it('should have nearMissGlobalCorrelationThreshold', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.nearMissGlobalCorrelationThreshold).toBe(
        0.8
      );
    });

    describe('composite score weights', () => {
      it('should have compositeScoreGateOverlapWeight', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.compositeScoreGateOverlapWeight).toBe(
          0.3
        );
      });

      it('should have compositeScoreCorrelationWeight', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.compositeScoreCorrelationWeight).toBe(
          0.2
        );
      });

      it('should have compositeScoreGlobalDiffWeight', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.compositeScoreGlobalDiffWeight).toBe(
          0.5
        );
      });

      it('should have composite score weights that sum to 1.0', () => {
        const sum =
          PROTOTYPE_OVERLAP_CONFIG.compositeScoreGateOverlapWeight +
          PROTOTYPE_OVERLAP_CONFIG.compositeScoreCorrelationWeight +
          PROTOTYPE_OVERLAP_CONFIG.compositeScoreGlobalDiffWeight;
        expect(sum).toBeCloseTo(1.0, 10);
      });
    });

    // Safety limits
    it('should have maxCandidatePairs unchanged', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.maxCandidatePairs).toBe(5000);
    });

    it('should have maxSamplesTotal unchanged', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.maxSamplesTotal).toBe(1000000);
    });

    // Near-miss detection thresholds
    it('should have nearMissCorrelationThreshold unchanged', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.nearMissCorrelationThreshold).toBe(0.9);
    });

    it('should have nearMissGateOverlapRatio unchanged', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.nearMissGateOverlapRatio).toBe(0.75);
    });

    it('should have maxNearMissPairsToReport unchanged', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.maxNearMissPairsToReport).toBe(10);
    });
  });

  describe('v2 properties - Part A: Metrics config', () => {
    describe('minCoPassSamples', () => {
      it('should exist and have correct value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.minCoPassSamples).toBe(200);
      });

      it('should be a positive integer', () => {
        expect(typeof PROTOTYPE_OVERLAP_CONFIG.minCoPassSamples).toBe('number');
        expect(PROTOTYPE_OVERLAP_CONFIG.minCoPassSamples).toBeGreaterThan(0);
        expect(Number.isInteger(PROTOTYPE_OVERLAP_CONFIG.minCoPassSamples)).toBe(
          true
        );
      });
    });

    describe('intensityEps', () => {
      it('should exist and have correct value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.intensityEps).toBe(0.05);
      });

      it('should be in range (0, 1)', () => {
        expect(typeof PROTOTYPE_OVERLAP_CONFIG.intensityEps).toBe('number');
        expect(PROTOTYPE_OVERLAP_CONFIG.intensityEps).toBeGreaterThan(0);
        expect(PROTOTYPE_OVERLAP_CONFIG.intensityEps).toBeLessThan(1);
      });
    });

    describe('minPctWithinEpsForMerge', () => {
      it('should exist and have correct value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.minPctWithinEpsForMerge).toBe(0.85);
      });

      it('should be in range (0, 1]', () => {
        expect(typeof PROTOTYPE_OVERLAP_CONFIG.minPctWithinEpsForMerge).toBe(
          'number'
        );
        expect(PROTOTYPE_OVERLAP_CONFIG.minPctWithinEpsForMerge).toBeGreaterThan(
          0
        );
        expect(
          PROTOTYPE_OVERLAP_CONFIG.minPctWithinEpsForMerge
        ).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('v2 properties - Part B: Gate analysis config', () => {
    describe('strictEpsilon', () => {
      it('should exist and have correct value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.strictEpsilon).toBe(1e-6);
      });

      it('should be a small positive number', () => {
        expect(typeof PROTOTYPE_OVERLAP_CONFIG.strictEpsilon).toBe('number');
        expect(PROTOTYPE_OVERLAP_CONFIG.strictEpsilon).toBeGreaterThan(0);
        expect(PROTOTYPE_OVERLAP_CONFIG.strictEpsilon).toBeLessThan(0.001);
      });
    });
  });

  describe('v2 properties - Part C: Classification thresholds', () => {
    describe('nestedConditionalThreshold', () => {
      it('should exist and have correct value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.nestedConditionalThreshold).toBe(0.97);
      });

      it('should be in range (0, 1]', () => {
        expect(typeof PROTOTYPE_OVERLAP_CONFIG.nestedConditionalThreshold).toBe(
          'number'
        );
        expect(
          PROTOTYPE_OVERLAP_CONFIG.nestedConditionalThreshold
        ).toBeGreaterThan(0);
        expect(
          PROTOTYPE_OVERLAP_CONFIG.nestedConditionalThreshold
        ).toBeLessThanOrEqual(1);
      });
    });

    describe('strongGateOverlapRatio', () => {
      it('should exist and have correct value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.strongGateOverlapRatio).toBe(0.8);
      });

      it('should be in range (0, 1]', () => {
        expect(typeof PROTOTYPE_OVERLAP_CONFIG.strongGateOverlapRatio).toBe(
          'number'
        );
        expect(PROTOTYPE_OVERLAP_CONFIG.strongGateOverlapRatio).toBeGreaterThan(
          0
        );
        expect(
          PROTOTYPE_OVERLAP_CONFIG.strongGateOverlapRatio
        ).toBeLessThanOrEqual(1);
      });

      it('should be less than minGateOverlapRatio (intentionally lowered)', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.strongGateOverlapRatio).toBeLessThan(
          PROTOTYPE_OVERLAP_CONFIG.minGateOverlapRatio
        );
      });
    });

    describe('strongCorrelationForMerge', () => {
      it('should exist and have correct value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.strongCorrelationForMerge).toBe(0.97);
      });

      it('should be in range (0, 1]', () => {
        expect(typeof PROTOTYPE_OVERLAP_CONFIG.strongCorrelationForMerge).toBe(
          'number'
        );
        expect(
          PROTOTYPE_OVERLAP_CONFIG.strongCorrelationForMerge
        ).toBeGreaterThan(0);
        expect(
          PROTOTYPE_OVERLAP_CONFIG.strongCorrelationForMerge
        ).toBeLessThanOrEqual(1);
      });

      it('should be less than minCorrelationForMerge (intentionally lowered)', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.strongCorrelationForMerge).toBeLessThan(
          PROTOTYPE_OVERLAP_CONFIG.minCorrelationForMerge
        );
      });
    });

    describe('minExclusiveForBroader', () => {
      it('should exist and have correct value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.minExclusiveForBroader).toBe(0.01);
      });

      it('should be in range (0, 1)', () => {
        expect(typeof PROTOTYPE_OVERLAP_CONFIG.minExclusiveForBroader).toBe(
          'number'
        );
        expect(PROTOTYPE_OVERLAP_CONFIG.minExclusiveForBroader).toBeGreaterThan(
          0
        );
        expect(PROTOTYPE_OVERLAP_CONFIG.minExclusiveForBroader).toBeLessThan(1);
      });
    });

    describe('highThresholds', () => {
      it('should exist and have correct value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.highThresholds).toEqual([
          0.4, 0.6, 0.75,
        ]);
      });

      it('should be an array of numbers', () => {
        expect(Array.isArray(PROTOTYPE_OVERLAP_CONFIG.highThresholds)).toBe(
          true
        );
        for (const threshold of PROTOTYPE_OVERLAP_CONFIG.highThresholds) {
          expect(typeof threshold).toBe('number');
        }
      });

      it('should have all thresholds in range [0, 1]', () => {
        for (const threshold of PROTOTYPE_OVERLAP_CONFIG.highThresholds) {
          expect(threshold).toBeGreaterThanOrEqual(0);
          expect(threshold).toBeLessThanOrEqual(1);
        }
      });

      it('should be sorted in ascending order', () => {
        const sorted = [...PROTOTYPE_OVERLAP_CONFIG.highThresholds].sort(
          (a, b) => a - b
        );
        expect(PROTOTYPE_OVERLAP_CONFIG.highThresholds).toEqual(sorted);
      });
    });

    describe('minHighJaccardForMergeAtT', () => {
      it('should exist and have correct value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.minHighJaccardForMergeAtT).toEqual({
          '0.6': 0.75,
        });
      });

      it('should be an object with string keys and number values', () => {
        expect(
          typeof PROTOTYPE_OVERLAP_CONFIG.minHighJaccardForMergeAtT
        ).toBe('object');
        expect(PROTOTYPE_OVERLAP_CONFIG.minHighJaccardForMergeAtT).not.toBeNull();

        for (const [key, value] of Object.entries(
          PROTOTYPE_OVERLAP_CONFIG.minHighJaccardForMergeAtT
        )) {
          expect(typeof key).toBe('string');
          expect(typeof value).toBe('number');
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      });

      it('should have keys that correspond to highThresholds', () => {
        const thresholdStrings =
          PROTOTYPE_OVERLAP_CONFIG.highThresholds.map(String);
        for (const key of Object.keys(
          PROTOTYPE_OVERLAP_CONFIG.minHighJaccardForMergeAtT
        )) {
          expect(thresholdStrings).toContain(key);
        }
      });
    });
  });

  describe('v2 properties - Part D: Feature config', () => {
    describe('changeEmotionNameHints', () => {
      it('should exist and have correct value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.changeEmotionNameHints).toEqual([
          'relief',
          'surprise_startle',
          'release',
        ]);
      });

      it('should be an array of strings', () => {
        expect(
          Array.isArray(PROTOTYPE_OVERLAP_CONFIG.changeEmotionNameHints)
        ).toBe(true);
        for (const hint of PROTOTYPE_OVERLAP_CONFIG.changeEmotionNameHints) {
          expect(typeof hint).toBe('string');
          expect(hint.length).toBeGreaterThan(0);
        }
      });
    });

    describe('enableConvertToExpression', () => {
      it('should exist and have correct value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.enableConvertToExpression).toBe(true);
      });

      it('should be a boolean', () => {
        expect(
          typeof PROTOTYPE_OVERLAP_CONFIG.enableConvertToExpression
        ).toBe('boolean');
      });
    });

    describe('bandMargin', () => {
      it('should exist and have correct value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.bandMargin).toBe(0.05);
      });

      it('should be a positive number', () => {
        expect(typeof PROTOTYPE_OVERLAP_CONFIG.bandMargin).toBe('number');
        expect(PROTOTYPE_OVERLAP_CONFIG.bandMargin).toBeGreaterThan(0);
      });
    });
  });

  describe('v2 properties completeness', () => {
    const V2_PROPERTY_NAMES = [
      'minCoPassSamples',
      'intensityEps',
      'minPctWithinEpsForMerge',
      'strictEpsilon',
      'nestedConditionalThreshold',
      'strongGateOverlapRatio',
      'strongCorrelationForMerge',
      'minExclusiveForBroader',
      'highThresholds',
      'minHighJaccardForMergeAtT',
      'changeEmotionNameHints',
      'enableConvertToExpression',
      'bandMargin',
    ];

    it('should have all 13 v2 properties', () => {
      for (const propName of V2_PROPERTY_NAMES) {
        expect(PROTOTYPE_OVERLAP_CONFIG).toHaveProperty(propName);
      }
      expect(V2_PROPERTY_NAMES.length).toBe(13);
    });

    it('should not have undefined v2 properties', () => {
      for (const propName of V2_PROPERTY_NAMES) {
        expect(PROTOTYPE_OVERLAP_CONFIG[propName]).not.toBeUndefined();
      }
    });
  });

  describe('v2.1 properties - multi-route filtering', () => {
    describe('enableMultiRouteFiltering', () => {
      it('should exist and have correct value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.enableMultiRouteFiltering).toBe(true);
      });

      it('should be a boolean', () => {
        expect(typeof PROTOTYPE_OVERLAP_CONFIG.enableMultiRouteFiltering).toBe(
          'boolean'
        );
      });
    });

    describe('gateBasedMinIntervalOverlap', () => {
      it('should exist and have correct value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.gateBasedMinIntervalOverlap).toBe(0.6);
      });
    });

    describe('prescanSampleCount', () => {
      it('should exist and have correct value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.prescanSampleCount).toBe(500);
      });
    });

    describe('prescanMinGateOverlap', () => {
      it('should exist and have correct value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.prescanMinGateOverlap).toBe(0.5);
      });
    });

    describe('maxPrescanPairs', () => {
      it('should exist and have correct value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.maxPrescanPairs).toBe(1000);
      });
    });
  });

  describe('v3 properties - Shared Context Pool (ticket 001)', () => {
    describe('sharedPoolSize', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.sharedPoolSize).toBe(50000);
      });

      it('should be a positive integer', () => {
        expect(typeof PROTOTYPE_OVERLAP_CONFIG.sharedPoolSize).toBe('number');
        expect(PROTOTYPE_OVERLAP_CONFIG.sharedPoolSize).toBeGreaterThan(0);
        expect(
          Number.isInteger(PROTOTYPE_OVERLAP_CONFIG.sharedPoolSize)
        ).toBe(true);
      });
    });

    describe('enableStratifiedSampling', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.enableStratifiedSampling).toBe(false);
      });

      it('should be a boolean', () => {
        expect(typeof PROTOTYPE_OVERLAP_CONFIG.enableStratifiedSampling).toBe(
          'boolean'
        );
      });
    });

    describe('stratumCount', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.stratumCount).toBe(5);
      });

      it('should be a positive integer', () => {
        expect(typeof PROTOTYPE_OVERLAP_CONFIG.stratumCount).toBe('number');
        expect(PROTOTYPE_OVERLAP_CONFIG.stratumCount).toBeGreaterThan(0);
        expect(Number.isInteger(PROTOTYPE_OVERLAP_CONFIG.stratumCount)).toBe(
          true
        );
      });
    });

    describe('stratificationStrategy', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.stratificationStrategy).toBe('uniform');
      });

      it('should be a valid strategy string', () => {
        const validStrategies = ['uniform', 'mood-regime', 'extremes-enhanced'];
        expect(validStrategies).toContain(
          PROTOTYPE_OVERLAP_CONFIG.stratificationStrategy
        );
      });
    });

    describe('poolRandomSeed', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.poolRandomSeed).toBe(null);
      });

      it('should be null or a number', () => {
        const seed = PROTOTYPE_OVERLAP_CONFIG.poolRandomSeed;
        expect(seed === null || typeof seed === 'number').toBe(true);
      });
    });
  });

  describe('v3 properties - Agreement Metrics (ticket 004)', () => {
    describe('confidenceLevel', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.confidenceLevel).toBe(0.95);
      });

      it('should be a valid confidence level', () => {
        const validLevels = [0.9, 0.95, 0.99];
        expect(validLevels).toContain(PROTOTYPE_OVERLAP_CONFIG.confidenceLevel);
      });
    });

    describe('minSamplesForReliableCorrelation', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.minSamplesForReliableCorrelation).toBe(
          500
        );
      });

      it('should be a positive integer', () => {
        expect(
          typeof PROTOTYPE_OVERLAP_CONFIG.minSamplesForReliableCorrelation
        ).toBe('number');
        expect(
          PROTOTYPE_OVERLAP_CONFIG.minSamplesForReliableCorrelation
        ).toBeGreaterThan(0);
        expect(
          Number.isInteger(
            PROTOTYPE_OVERLAP_CONFIG.minSamplesForReliableCorrelation
          )
        ).toBe(true);
      });
    });
  });

  describe('v3 properties - Classification Thresholds (ticket 010)', () => {
    describe('maxMaeCoPassForMerge', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.maxMaeCoPassForMerge).toBe(0.03);
      });

      it('should be in range (0, 1)', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.maxMaeCoPassForMerge).toBeGreaterThan(0);
        expect(PROTOTYPE_OVERLAP_CONFIG.maxMaeCoPassForMerge).toBeLessThan(1);
      });
    });

    describe('maxRmseCoPassForMerge', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.maxRmseCoPassForMerge).toBe(0.05);
      });

      it('should be greater than maxMaeCoPassForMerge', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.maxRmseCoPassForMerge).toBeGreaterThan(
          PROTOTYPE_OVERLAP_CONFIG.maxMaeCoPassForMerge
        );
      });
    });

    describe('maxMaeGlobalForMerge', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.maxMaeGlobalForMerge).toBe(0.08);
      });

      it('should be greater than maxMaeCoPassForMerge', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.maxMaeGlobalForMerge).toBeGreaterThan(
          PROTOTYPE_OVERLAP_CONFIG.maxMaeCoPassForMerge
        );
      });
    });

    describe('minActivationJaccardForMerge', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.minActivationJaccardForMerge).toBe(0.85);
      });

      it('should be in range (0, 1]', () => {
        expect(
          PROTOTYPE_OVERLAP_CONFIG.minActivationJaccardForMerge
        ).toBeGreaterThan(0);
        expect(
          PROTOTYPE_OVERLAP_CONFIG.minActivationJaccardForMerge
        ).toBeLessThanOrEqual(1);
      });
    });

    describe('minConditionalProbForNesting', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.minConditionalProbForNesting).toBe(0.95);
      });

      it('should be a high threshold (>0.9)', () => {
        expect(
          PROTOTYPE_OVERLAP_CONFIG.minConditionalProbForNesting
        ).toBeGreaterThan(0.9);
      });
    });

    describe('minConditionalProbCILowerForNesting', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.minConditionalProbCILowerForNesting).toBe(
          0.9
        );
      });

      it('should be less than or equal to minConditionalProbForNesting', () => {
        expect(
          PROTOTYPE_OVERLAP_CONFIG.minConditionalProbCILowerForNesting
        ).toBeLessThanOrEqual(
          PROTOTYPE_OVERLAP_CONFIG.minConditionalProbForNesting
        );
      });
    });

    describe('symmetryTolerance', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.symmetryTolerance).toBe(0.05);
      });

      it('should be a small positive number', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.symmetryTolerance).toBeGreaterThan(0);
        expect(PROTOTYPE_OVERLAP_CONFIG.symmetryTolerance).toBeLessThan(0.2);
      });
    });

    describe('asymmetryRequired', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.asymmetryRequired).toBe(0.1);
      });

      it('should be greater than symmetryTolerance', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.asymmetryRequired).toBeGreaterThan(
          PROTOTYPE_OVERLAP_CONFIG.symmetryTolerance
        );
      });
    });

    describe('maxMaeDeltaForExpression', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.maxMaeDeltaForExpression).toBe(0.05);
      });

      it('should be in range (0, 1)', () => {
        expect(
          PROTOTYPE_OVERLAP_CONFIG.maxMaeDeltaForExpression
        ).toBeGreaterThan(0);
        expect(PROTOTYPE_OVERLAP_CONFIG.maxMaeDeltaForExpression).toBeLessThan(
          1
        );
      });
    });

    describe('maxExclusiveForSubsumption', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.maxExclusiveForSubsumption).toBe(0.05);
      });

      it('should be in range (0, 1)', () => {
        expect(
          PROTOTYPE_OVERLAP_CONFIG.maxExclusiveForSubsumption
        ).toBeGreaterThan(0);
        expect(
          PROTOTYPE_OVERLAP_CONFIG.maxExclusiveForSubsumption
        ).toBeLessThan(1);
      });
    });
  });

  describe('v3 properties - Prototype Profile (ticket 005)', () => {
    describe('lowVolumeThreshold', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.lowVolumeThreshold).toBe(0.05);
      });

      it('should be in range (0, 1)', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.lowVolumeThreshold).toBeGreaterThan(0);
        expect(PROTOTYPE_OVERLAP_CONFIG.lowVolumeThreshold).toBeLessThan(1);
      });
    });

    describe('lowNoveltyThreshold', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.lowNoveltyThreshold).toBe(0.15);
      });

      it('should be a positive number', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.lowNoveltyThreshold).toBeGreaterThan(0);
      });
    });

    describe('singleAxisFocusThreshold', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.singleAxisFocusThreshold).toBe(0.6);
      });

      it('should be in range (0.5, 1) indicating majority concentration', () => {
        expect(
          PROTOTYPE_OVERLAP_CONFIG.singleAxisFocusThreshold
        ).toBeGreaterThan(0.5);
        expect(PROTOTYPE_OVERLAP_CONFIG.singleAxisFocusThreshold).toBeLessThan(
          1
        );
      });
    });

    describe('clusteringMethod', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.clusteringMethod).toBe('k-means');
      });

      it('should be a valid clustering method', () => {
        const validMethods = ['k-means', 'hierarchical'];
        expect(validMethods).toContain(
          PROTOTYPE_OVERLAP_CONFIG.clusteringMethod
        );
      });
    });

    describe('clusterCount', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.clusterCount).toBe(10);
      });

      it('should be a positive integer', () => {
        expect(typeof PROTOTYPE_OVERLAP_CONFIG.clusterCount).toBe('number');
        expect(PROTOTYPE_OVERLAP_CONFIG.clusterCount).toBeGreaterThan(0);
        expect(Number.isInteger(PROTOTYPE_OVERLAP_CONFIG.clusterCount)).toBe(
          true
        );
      });
    });
  });

  describe('v3 properties - Actionable Suggestions (ticket 007)', () => {
    describe('minSamplesForStump', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.minSamplesForStump).toBe(100);
      });

      it('should be a positive integer', () => {
        expect(typeof PROTOTYPE_OVERLAP_CONFIG.minSamplesForStump).toBe(
          'number'
        );
        expect(PROTOTYPE_OVERLAP_CONFIG.minSamplesForStump).toBeGreaterThan(0);
        expect(
          Number.isInteger(PROTOTYPE_OVERLAP_CONFIG.minSamplesForStump)
        ).toBe(true);
      });
    });

    describe('minInfoGainForSuggestion', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.minInfoGainForSuggestion).toBe(0.05);
      });

      it('should be a small positive number', () => {
        expect(
          PROTOTYPE_OVERLAP_CONFIG.minInfoGainForSuggestion
        ).toBeGreaterThan(0);
        expect(PROTOTYPE_OVERLAP_CONFIG.minInfoGainForSuggestion).toBeLessThan(
          1
        );
      });
    });

    describe('divergenceThreshold', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.divergenceThreshold).toBe(0.1);
      });

      it('should be a positive number', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.divergenceThreshold).toBeGreaterThan(0);
      });
    });

    describe('maxSuggestionsPerPair', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.maxSuggestionsPerPair).toBe(3);
      });

      it('should be a positive integer', () => {
        expect(typeof PROTOTYPE_OVERLAP_CONFIG.maxSuggestionsPerPair).toBe(
          'number'
        );
        expect(PROTOTYPE_OVERLAP_CONFIG.maxSuggestionsPerPair).toBeGreaterThan(
          0
        );
        expect(
          Number.isInteger(PROTOTYPE_OVERLAP_CONFIG.maxSuggestionsPerPair)
        ).toBe(true);
      });
    });

    describe('minOverlapReductionForSuggestion', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.minOverlapReductionForSuggestion).toBe(
          0.1
        );
      });

      it('should be in range (0, 1)', () => {
        expect(
          PROTOTYPE_OVERLAP_CONFIG.minOverlapReductionForSuggestion
        ).toBeGreaterThan(0);
        expect(
          PROTOTYPE_OVERLAP_CONFIG.minOverlapReductionForSuggestion
        ).toBeLessThan(1);
      });
    });

    describe('minActivationRateAfterSuggestion', () => {
      it('should exist and have correct default value', () => {
        expect(PROTOTYPE_OVERLAP_CONFIG.minActivationRateAfterSuggestion).toBe(
          0.01
        );
      });

      it('should be a small positive number', () => {
        expect(
          PROTOTYPE_OVERLAP_CONFIG.minActivationRateAfterSuggestion
        ).toBeGreaterThan(0);
        expect(
          PROTOTYPE_OVERLAP_CONFIG.minActivationRateAfterSuggestion
        ).toBeLessThan(PROTOTYPE_OVERLAP_CONFIG.lowVolumeThreshold);
      });
    });
  });

  describe('axis gap detection properties (AXIGAPDETSPE-001)', () => {
    it('should have enableAxisGapDetection enabled by default', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.enableAxisGapDetection).toBe(true);
    });

    it('should have PCA thresholds set to expected defaults', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.pcaResidualVarianceThreshold).toBe(0.15);
      expect(PROTOTYPE_OVERLAP_CONFIG.pcaKaiserThreshold).toBe(1.0);
    });

    it('should have hub detection thresholds set to expected defaults', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.hubMinDegree).toBe(4);
      expect(PROTOTYPE_OVERLAP_CONFIG.hubMaxEdgeWeight).toBe(0.9);
      expect(PROTOTYPE_OVERLAP_CONFIG.hubMinNeighborhoodDiversity).toBe(2);
    });

    it('should have coverage gap thresholds set to expected defaults', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.coverageGapAxisDistanceThreshold).toBe(
        0.6
      );
      expect(PROTOTYPE_OVERLAP_CONFIG.coverageGapMinClusterSize).toBe(3);
    });

    it('should have multi-axis conflict thresholds set to expected defaults', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.multiAxisUsageThreshold).toBe(1.5);
      expect(PROTOTYPE_OVERLAP_CONFIG.multiAxisSignBalanceThreshold).toBe(0.4);
    });

    it('should include all axis gap detection properties', () => {
      const AXIS_GAP_PROPERTY_NAMES = [
        'enableAxisGapDetection',
        'pcaResidualVarianceThreshold',
        'pcaKaiserThreshold',
        'hubMinDegree',
        'hubMaxEdgeWeight',
        'hubMinNeighborhoodDiversity',
        'coverageGapAxisDistanceThreshold',
        'coverageGapMinClusterSize',
        'multiAxisUsageThreshold',
        'multiAxisSignBalanceThreshold',
      ];

      for (const propName of AXIS_GAP_PROPERTY_NAMES) {
        expect(PROTOTYPE_OVERLAP_CONFIG).toHaveProperty(propName);
        expect(PROTOTYPE_OVERLAP_CONFIG[propName]).not.toBeUndefined();
      }
      expect(AXIS_GAP_PROPERTY_NAMES.length).toBe(10);
    });
  });

  describe('v3 properties completeness', () => {
    const V3_PROPERTY_NAMES = [
      // Shared Context Pool
      'sharedPoolSize',
      'enableStratifiedSampling',
      'stratumCount',
      'stratificationStrategy',
      'poolRandomSeed',
      // Agreement Metrics
      'confidenceLevel',
      'minSamplesForReliableCorrelation',
      // Classification Thresholds
      'maxMaeCoPassForMerge',
      'maxRmseCoPassForMerge',
      'maxMaeGlobalForMerge',
      'minActivationJaccardForMerge',
      'minConditionalProbForNesting',
      'minConditionalProbCILowerForNesting',
      'symmetryTolerance',
      'asymmetryRequired',
      'maxMaeDeltaForExpression',
      'maxExclusiveForSubsumption',
      // Prototype Profile
      'lowVolumeThreshold',
      'lowNoveltyThreshold',
      'singleAxisFocusThreshold',
      'clusteringMethod',
      'clusterCount',
      // Actionable Suggestions
      'minSamplesForStump',
      'minInfoGainForSuggestion',
      'divergenceThreshold',
      'maxSuggestionsPerPair',
      'minOverlapReductionForSuggestion',
      'minActivationRateAfterSuggestion',
    ];

    it('should have all 28 v3 properties', () => {
      for (const propName of V3_PROPERTY_NAMES) {
        expect(PROTOTYPE_OVERLAP_CONFIG).toHaveProperty(propName);
      }
      expect(V3_PROPERTY_NAMES.length).toBe(28);
    });

    it('should have poolRandomSeed set to null by default', () => {
      expect(PROTOTYPE_OVERLAP_CONFIG.poolRandomSeed).toBe(null);
    });

    it('should not have undefined v3 properties (excluding poolRandomSeed which is null)', () => {
      const propsExcludingPoolSeed = V3_PROPERTY_NAMES.filter(
        (name) => name !== 'poolRandomSeed'
      );
      for (const propName of propsExcludingPoolSeed) {
        expect(PROTOTYPE_OVERLAP_CONFIG[propName]).not.toBeUndefined();
      }
    });
  });

  describe('config relationships and invariants', () => {
    it('should have strongCorrelationForMerge between minCorrelationForSubsumption and minCorrelationForMerge', () => {
      // strongCorrelationForMerge should be easier to achieve than strict merge
      // but still harder than subsumption
      expect(PROTOTYPE_OVERLAP_CONFIG.strongCorrelationForMerge).toBeLessThan(
        PROTOTYPE_OVERLAP_CONFIG.minCorrelationForMerge
      );
      expect(
        PROTOTYPE_OVERLAP_CONFIG.strongCorrelationForMerge
      ).toBeGreaterThanOrEqual(
        PROTOTYPE_OVERLAP_CONFIG.minCorrelationForSubsumption
      );
    });

    it('should have nestedConditionalThreshold as high threshold for behavioral nesting', () => {
      // Should be high enough to indicate strong behavioral implication
      expect(PROTOTYPE_OVERLAP_CONFIG.nestedConditionalThreshold).toBeGreaterThan(
        0.9
      );
    });

    it('should have minCoPassSamples sufficient for statistical validity', () => {
      // At least 30 samples for central limit theorem, but we want more for correlation
      expect(PROTOTYPE_OVERLAP_CONFIG.minCoPassSamples).toBeGreaterThan(30);
    });

    it('should have intensityEps and minPctWithinEpsForMerge work together meaningfully', () => {
      // If eps is 0.05 (5% of [0,1] range) and we require 85% within eps,
      // that means 85% of samples must have intensity difference <= 0.05
      expect(PROTOTYPE_OVERLAP_CONFIG.intensityEps).toBeLessThan(0.1);
      expect(PROTOTYPE_OVERLAP_CONFIG.minPctWithinEpsForMerge).toBeGreaterThan(
        0.7
      );
    });
  });
});
