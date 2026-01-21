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
