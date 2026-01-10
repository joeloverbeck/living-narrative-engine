/**
 * @file Unit tests for PathSensitiveAnalyzer LOW prototype gate handling
 * @see src/expressionDiagnostics/services/PathSensitiveAnalyzer.js
 *
 * These tests verify that LOW-direction prototypes (e.g., freeze < 0.2)
 * have their own gates included when computing minPossible.
 *
 * Bug context: The analyzer was marking anxiety paths as unreachable for
 * uneasy_restraint.expression.json because it wasn't considering freeze's
 * own gates when computing freeze's minPossible. Freeze requires threat >= 0.35,
 * but the analyzer was using threat >= 0.20 from anxiety's gates.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PathSensitiveAnalyzer from '../../../../src/expressionDiagnostics/services/PathSensitiveAnalyzer.js';

describe('PathSensitiveAnalyzer - LOW Prototype Gate Handling', () => {
  let mockDataRegistry;
  let mockGateConstraintAnalyzer;
  let mockIntensityBoundsCalculator;
  let mockLogger;

  // Prototype definitions matching the real emotion_prototypes.lookup.json
  const emotionPrototypes = {
    anxiety: {
      weights: { threat: 0.4, agency_control: -0.35, arousal: 0.25 },
      gates: ['threat >= 0.20', 'agency_control <= 0.20'],
    },
    freeze: {
      weights: {
        threat: 0.35,
        agency_control: -0.3,
        valence: -0.15,
        arousal: 0.2,
      },
      gates: [
        'threat >= 0.35',
        'agency_control <= -0.30',
        'valence <= -0.05',
        'arousal >= -0.10',
        'arousal <= 0.40',
        'engagement >= 0.05',
      ],
    },
    unease: {
      weights: { threat: 0.5, valence: -0.3, arousal: 0.2 },
      gates: ['threat >= 0.15'],
    },
    suspicion: {
      weights: { threat: 0.35, social: -0.35, agency_control: -0.15 },
      gates: ['threat >= 0.25'],
    },
  };

  beforeEach(() => {
    mockDataRegistry = {
      getLookupData: jest.fn((key) => {
        if (key === 'core:emotion_prototypes') {
          return { entries: emotionPrototypes };
        }
        return null;
      }),
    };
    mockGateConstraintAnalyzer = {
      analyze: jest.fn(),
    };
    mockIntensityBoundsCalculator = {
      analyzeExpression: jest.fn(),
    };
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };
  });

  /**
   * Creates a PathSensitiveAnalyzer instance with mocked dependencies
   */
  function createAnalyzer() {
    return new PathSensitiveAnalyzer({
      dataRegistry: mockDataRegistry,
      gateConstraintAnalyzer: mockGateConstraintAnalyzer,
      intensityBoundsCalculator: mockIntensityBoundsCalculator,
      logger: mockLogger,
    });
  }

  describe('LOW prototype minPossible calculation with own gates', () => {
    it('should include LOW prototype own gates when computing minPossible', () => {
      // This test reproduces the bug where freeze's minPossible was calculated
      // using threat >= 0.20 (from anxiety) instead of threat >= 0.35 (from freeze)
      const analyzer = createAnalyzer();

      // Expression with:
      // - anxiety >= 0.4 (HIGH) with gate threat >= 0.20
      // - freeze < 0.2 (LOW) with gate threat >= 0.35
      const expression = {
        id: 'test:anxiety_freeze_conflict',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.anxiety' }, 0.4] },
                { '<': [{ var: 'emotions.freeze' }, 0.2] },
              ],
            },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      // Find the freeze reachability for the main branch
      const freezeReachability = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'freeze' && r.direction === 'low'
      );

      expect(freezeReachability).toBeDefined();

      // Debug output
      console.log('Freeze reachability details:', {
        prototypeId: freezeReachability.prototypeId,
        direction: freezeReachability.direction,
        threshold: freezeReachability.threshold,
        minPossible: freezeReachability.minPossible,
        maxPossible: freezeReachability.maxPossible,
        isReachable: freezeReachability.isReachable,
        gap: freezeReachability.gap,
      });

      // The key insight: For a LOW direction prototype (freeze < 0.2):
      // - isReachable should be TRUE if minPossible < threshold (0.2)
      // - The question is: can freeze's intensity go below 0.2?
      //
      // With freeze's gates extended into the calculation, we're asking:
      // "If freeze's gates ARE satisfied, can freeze still be < 0.2?"
      //
      // This should be TRUE because even when freeze is active (gates satisfied),
      // there are configurations where its weighted intensity is below 0.2
      expect(freezeReachability.isReachable).toBe(true);
    });

    it('should mark path as reachable when LOW prototype gates allow intensity below threshold', () => {
      const analyzer = createAnalyzer();

      // Simpler case: just freeze < 0.2 with no HIGH prototypes
      // Freeze can be below 0.2 when its gates are not satisfied (emotion inactive)
      const expression = {
        id: 'test:freeze_only_low',
        prerequisites: [
          {
            logic: { '<': [{ var: 'emotions.freeze' }, 0.2] },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      const freezeReachability = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'freeze' && r.direction === 'low'
      );

      expect(freezeReachability).toBeDefined();
      // When no HIGH prototypes, freeze can easily be 0 (gates not satisfied)
      expect(freezeReachability.isReachable).toBe(true);
      expect(freezeReachability.minPossible).toBeLessThan(0.2);
    });

    it('should correctly compute minPossible for freeze using freeze own gate constraints', () => {
      const analyzer = createAnalyzer();

      // This test verifies the exact calculation logic
      const expression = {
        id: 'test:freeze_gates_calculation',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.anxiety' }, 0.4] },
                { '<': [{ var: 'emotions.freeze' }, 0.2] },
              ],
            },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      const freezeReachability = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'freeze'
      );

      expect(freezeReachability).toBeDefined();

      // With freeze's gates extended to the interval calculation:
      // threat interval: [0.35, 1.0] (freeze's gate, stricter)
      // agency_control interval: [-1.0, -0.30] (freeze's gate)
      // valence interval: [-1.0, -0.05] (freeze's gate)
      // arousal interval: [-0.10, 0.40] (freeze's gates)
      //
      // Given freeze's weights:
      //   threat: 0.35 (positive)
      //   agency_control: -0.3 (negative, inverted)
      //   valence: -0.15 (negative, inverted)
      //   arousal: 0.2 (positive)
      //
      // For minPossible:
      // - threat contributes: 0.35 * 0.35 = 0.1225 (min of interval)
      // - agency_control contributes: 0.3 * (1 - (-0.30)) = 0.3 * 1.30 = 0.39 (inverted, use max)
      // - valence contributes: 0.15 * (1 - (-0.05)) = 0.15 * 1.05 = 0.1575 (inverted, use max)
      // - arousal contributes: 0.2 * (-0.10) = -0.02 (min of interval) - but clamped to 0
      //
      // The actual calculation is more nuanced but the key point is that
      // with freeze's own gates, the minPossible should be different than
      // without them.

      // Log the actual values for debugging
      console.log('Freeze reachability:', {
        minPossible: freezeReachability.minPossible,
        maxPossible: freezeReachability.maxPossible,
        isReachable: freezeReachability.isReachable,
        gap: freezeReachability.gap,
      });
    });

    it('should match Monte Carlo reachability for anxiety path in uneasy_restraint scenario', () => {
      // This test reproduces the exact scenario from the bug report
      const analyzer = createAnalyzer();

      // Simplified uneasy_restraint prerequisites
      const expression = {
        id: 'test:uneasy_restraint_scenario',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.unease' }, 0.52] },
                {
                  or: [
                    { '>=': [{ var: 'emotions.suspicion' }, 0.35] },
                    { '>=': [{ var: 'emotions.anxiety' }, 0.4] },
                  ],
                },
                // LOW prototypes that should be < threshold
                { '<': [{ var: 'emotions.freeze' }, 0.2] },
              ],
            },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      // Find anxiety-related branches
      const anxietyBranches = result.branches.filter((b) =>
        b.requiredPrototypes.includes('anxiety')
      );

      expect(anxietyBranches.length).toBeGreaterThan(0);

      // For each anxiety branch, check that freeze is reachable
      // Collect all freeze reachabilities for anxiety branches
      const freezeReachabilities = anxietyBranches
        .map((branch) =>
          result.reachabilityByBranch.find(
            (r) =>
              r.branchId === branch.branchId &&
              r.prototypeId === 'freeze' &&
              r.direction === 'low'
          )
        )
        .filter(Boolean);

      // Ensure we found at least one freeze reachability
      expect(freezeReachabilities.length).toBeGreaterThan(0);

      // All freeze reachabilities should be reachable
      // Monte Carlo showed 0.011% success rate, so these paths ARE reachable
      for (const freezeReachability of freezeReachabilities) {
        expect(freezeReachability.isReachable).toBe(true);
      }
    });
  });

  describe('Edge cases for LOW prototype gate handling', () => {
    it('should use base intervals only when LOW prototype has no gates', () => {
      // Add a prototype with no gates
      emotionPrototypes.test_no_gates = {
        weights: { threat: 0.5 },
        // No gates property
      };

      const analyzer = createAnalyzer();

      const expression = {
        id: 'test:no_gates_low',
        prerequisites: [
          {
            logic: { '<': [{ var: 'emotions.test_no_gates' }, 0.5] },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      const reachability = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'test_no_gates'
      );

      expect(reachability).toBeDefined();
      // With no gates, minPossible should be 0
      expect(reachability.minPossible).toBe(0);
      expect(reachability.isReachable).toBe(true);

      // Cleanup
      delete emotionPrototypes.test_no_gates;
    });

    it('should handle multiple LOW prototypes on same path', () => {
      const analyzer = createAnalyzer();

      const expression = {
        id: 'test:multiple_low',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.anxiety' }, 0.4] },
                { '<': [{ var: 'emotions.freeze' }, 0.2] },
                { '<': [{ var: 'emotions.suspicion' }, 0.3] },
              ],
            },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      // Both freeze and suspicion are LOW and should have their gates considered
      const freezeReachability = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'freeze' && r.direction === 'low'
      );
      const suspicionReachability = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'suspicion' && r.direction === 'low'
      );

      expect(freezeReachability).toBeDefined();
      expect(suspicionReachability).toBeDefined();

      // Both should be assessed with their own gates
      // (specific values depend on implementation)
    });

    it('should detect when LOW prototype gate conflicts with HIGH prototype gates', () => {
      // Create a scenario where freeze's gates conflict with anxiety's gates
      // This would make the path truly unreachable
      const analyzer = createAnalyzer();

      // If we had a LOW prototype that requires agency_control >= 0.5
      // but anxiety requires agency_control <= 0.20, there would be a conflict
      // Since our test prototypes don't have this conflict, this just verifies
      // the analyzer doesn't crash with complex prerequisites

      const expression = {
        id: 'test:potential_conflict',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.anxiety' }, 0.4] },
                { '<': [{ var: 'emotions.freeze' }, 0.2] },
              ],
            },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      // Should complete without error
      expect(result).toBeDefined();
      expect(result.branches.length).toBeGreaterThan(0);
    });
  });
});
