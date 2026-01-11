/**
 * @file Unit tests for GateConstraintAnalyzer service
 * @description Tests gate conflict detection in expression prerequisites.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GateConstraintAnalyzer from '../../../../src/expressionDiagnostics/services/GateConstraintAnalyzer.js';

describe('GateConstraintAnalyzer', () => {
  let mockLogger;
  let mockDataRegistry;

  // Mock emotion prototypes matching real data structure
  const mockEmotionPrototypes = {
    entries: {
      fear: {
        weights: { threat: 1.0, arousal: 0.8 },
        gates: ['threat >= 0.30'],
      },
      confidence: {
        weights: { threat: -0.8, agency_control: 0.8 },
        gates: ['threat <= 0.20', 'agency_control >= 0.10'],
      },
      joy: {
        weights: { valence: 1.0, arousal: 0.5 },
        gates: ['valence >= 0.35'],
      },
      calm: {
        weights: { valence: 0.2, arousal: -1.0 },
        gates: ['threat <= 0.20'],
      },
      anxiety: {
        weights: { threat: 0.8, future_expectancy: -0.6 },
        gates: ['threat >= 0.20', 'agency_control <= 0.20'],
      },
      no_gates_emotion: {
        weights: { valence: 0.5 },
        // No gates array - should be handled gracefully
      },
    },
  };

  // Mock sexual prototypes
  const mockSexualPrototypes = {
    entries: {
      aroused: {
        weights: { sexual_arousal: 1.0 },
        gates: ['sexual_arousal >= 0.40'],
      },
      inhibited: {
        weights: { sex_inhibition: 1.0 },
        gates: ['sex_inhibition >= 0.50'],
      },
    },
  };

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn((category, lookupId) => {
        if (category === 'lookups') {
          if (lookupId === 'core:emotion_prototypes') {
            return mockEmotionPrototypes;
          }
          if (lookupId === 'core:sexual_prototypes') {
            return mockSexualPrototypes;
          }
        }
        return null;
      }),
    };
  });

  describe('Constructor', () => {
    it('should create instance with valid dependencies', () => {
      const analyzer = new GateConstraintAnalyzer({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
      expect(analyzer).toBeInstanceOf(GateConstraintAnalyzer);
    });

    it('should throw if dataRegistry is missing', () => {
      expect(
        () =>
          new GateConstraintAnalyzer({
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw if logger is missing', () => {
      expect(
        () =>
          new GateConstraintAnalyzer({
            dataRegistry: mockDataRegistry,
          })
      ).toThrow();
    });

    it('should throw if dataRegistry lacks get method', () => {
      expect(
        () =>
          new GateConstraintAnalyzer({
            dataRegistry: {},
            logger: mockLogger,
          })
      ).toThrow();
    });
  });

  describe('analyze()', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new GateConstraintAnalyzer({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
    });

    describe('Empty/null prerequisites', () => {
      it('should return no conflicts for null expression', () => {
        const result = analyzer.analyze(null);
        expect(result.hasConflict).toBe(false);
        expect(result.conflicts).toHaveLength(0);
        expect(result.axisIntervals.size).toBe(0);
      });

      it('should return no conflicts for undefined expression', () => {
        const result = analyzer.analyze(undefined);
        expect(result.hasConflict).toBe(false);
        expect(result.conflicts).toHaveLength(0);
      });

      it('should return no conflicts for expression with no prerequisites', () => {
        const result = analyzer.analyze({ id: 'test:empty' });
        expect(result.hasConflict).toBe(false);
        expect(result.conflicts).toHaveLength(0);
      });

      it('should return no conflicts for empty prerequisites array', () => {
        const result = analyzer.analyze({
          id: 'test:empty_array',
          prerequisites: [],
        });
        expect(result.hasConflict).toBe(false);
        expect(result.conflicts).toHaveLength(0);
      });

      it('should return no conflicts for prerequisites with no emotion/sexual requirements', () => {
        const result = analyzer.analyze({
          id: 'test:no_emotions',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'moodAxes.valence' }, 0.5] },
            },
          ],
        });
        expect(result.hasConflict).toBe(false);
        expect(result.conflicts).toHaveLength(0);
      });
    });

    describe('Compatible gates', () => {
      it('should return no conflicts for single emotion requirement', () => {
        const result = analyzer.analyze({
          id: 'test:single',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.fear' }, 0.5] },
            },
          ],
        });
        expect(result.hasConflict).toBe(false);
        expect(result.conflicts).toHaveLength(0);
        expect(result.axisIntervals.has('threat')).toBe(true);
      });

      it('should return no conflicts for compatible emotions on same axis', () => {
        // fear and anxiety both require threat >= some value
        const result = analyzer.analyze({
          id: 'test:compatible',
          prerequisites: [
            {
              logic: {
                and: [
                  { '>=': [{ var: 'emotions.fear' }, 0.5] },
                  { '>=': [{ var: 'emotions.anxiety' }, 0.5] },
                ],
              },
            },
          ],
        });
        expect(result.hasConflict).toBe(false);
        // threat interval should be >= 0.30 (fear's gate is stricter than anxiety's 0.20)
        expect(result.axisIntervals.get('threat').min).toBeCloseTo(0.3);
      });

      it('should handle emotions with no gates gracefully', () => {
        const result = analyzer.analyze({
          id: 'test:no_gates',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.no_gates_emotion' }, 0.5] },
            },
          ],
        });
        expect(result.hasConflict).toBe(false);
        expect(result.conflicts).toHaveLength(0);
      });
    });

    describe('Conflicting gates', () => {
      it('should detect conflicting gates on threat axis (fear vs confidence)', () => {
        const result = analyzer.analyze({
          id: 'test:conflict',
          prerequisites: [
            {
              logic: {
                and: [
                  { '>=': [{ var: 'emotions.fear' }, 0.5] },
                  { '>=': [{ var: 'emotions.confidence' }, 0.5] },
                ],
              },
            },
          ],
        });

        expect(result.hasConflict).toBe(true);
        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0].axis).toBe('threat');
        expect(result.conflicts[0].prototypes).toContain('fear');
        expect(result.conflicts[0].prototypes).toContain('confidence');
      });

      it('should identify all conflicting prototypes', () => {
        const result = analyzer.analyze({
          id: 'test:multi_conflict',
          prerequisites: [
            {
              logic: {
                and: [
                  { '>=': [{ var: 'emotions.fear' }, 0.5] },
                  { '>=': [{ var: 'emotions.confidence' }, 0.5] },
                  { '>=': [{ var: 'emotions.calm' }, 0.5] }, // calm also has threat <= 0.20
                ],
              },
            },
          ],
        });

        expect(result.hasConflict).toBe(true);
        const threatConflict = result.conflicts.find((c) => c.axis === 'threat');
        expect(threatConflict).toBeDefined();
        expect(threatConflict.prototypes).toContain('fear');
        expect(threatConflict.prototypes).toContain('confidence');
        expect(threatConflict.prototypes).toContain('calm');
      });

      it('should return impossible interval with min > max', () => {
        const result = analyzer.analyze({
          id: 'test:impossible',
          prerequisites: [
            {
              logic: {
                and: [
                  { '>=': [{ var: 'emotions.fear' }, 0.5] },
                  { '>=': [{ var: 'emotions.confidence' }, 0.5] },
                ],
              },
            },
          ],
        });

        expect(result.hasConflict).toBe(true);
        const conflict = result.conflicts[0];
        // fear requires threat >= 0.30, confidence requires threat <= 0.20
        expect(conflict.required.min).toBeGreaterThan(conflict.required.max);
      });
    });

    describe('Nested logic extraction', () => {
      it('should extract prototypes from AND logic', () => {
        const result = analyzer.analyze({
          id: 'test:and',
          prerequisites: [
            {
              logic: {
                and: [
                  { '>=': [{ var: 'emotions.joy' }, 0.5] },
                  { '>=': [{ var: 'emotions.calm' }, 0.5] },
                ],
              },
            },
          ],
        });

        // joy and calm don't conflict - joy needs valence >= 0.35, calm needs threat <= 0.20
        expect(result.hasConflict).toBe(false);
        expect(result.axisIntervals.has('valence')).toBe(true);
        expect(result.axisIntervals.has('threat')).toBe(true);
      });

      it('should NOT extract prototypes from OR logic (only one alternative needs to pass)', () => {
        const result = analyzer.analyze({
          id: 'test:or',
          prerequisites: [
            {
              logic: {
                or: [
                  { '>=': [{ var: 'emotions.fear' }, 0.5] },
                  { '>=': [{ var: 'emotions.joy' }, 0.5] },
                ],
              },
            },
          ],
        });

        // OR blocks represent alternatives - only one needs to pass
        // We don't extract prototypes from OR blocks because they're not all required
        // This prevents false positive gate conflicts from OR alternatives
        expect(result.axisIntervals.size).toBe(0);
        expect(result.hasConflict).toBe(false);
      });

      it('should NOT detect conflict when OR provides a non-conflicting alternative', () => {
        const result = analyzer.analyze({
          id: 'test:deep_nested',
          prerequisites: [
            {
              logic: {
                and: [
                  {
                    or: [
                      { '>=': [{ var: 'emotions.fear' }, 0.5] }, // conflicts with confidence
                      { '>=': [{ var: 'emotions.joy' }, 0.5] }, // does NOT conflict with confidence
                    ],
                  },
                  { '>=': [{ var: 'emotions.confidence' }, 0.5] },
                ],
              },
            },
          ],
        });

        // OR blocks are skipped - only confidence (from AND) is required
        // Even though fear+confidence would conflict, joy is a valid alternative
        // So no conflict is reported (only confidence gates are analyzed)
        expect(result.hasConflict).toBe(false);
        // Only confidence's gates are in the intervals
        expect(result.axisIntervals.has('threat')).toBe(true);
        expect(result.axisIntervals.has('agency_control')).toBe(true);
      });
    });

    describe('Axis bounds', () => {
      it('should correctly identify mood axis bounds [-1, 1]', () => {
        const result = analyzer.analyze({
          id: 'test:mood_bounds',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.5] },
            },
          ],
        });

        const valenceInterval = result.axisIntervals.get('valence');
        expect(valenceInterval).toBeDefined();
        // valence starts at [-1, 1], then joy's gate tightens to [0.35, 1]
        expect(valenceInterval.min).toBeCloseTo(0.35);
        expect(valenceInterval.max).toBe(1);
      });

      it('should correctly identify sexual axis bounds [0, 1]', () => {
        const result = analyzer.analyze({
          id: 'test:sexual_bounds',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.5] },
            },
          ],
        });

        const arousalInterval = result.axisIntervals.get('sexual_arousal');
        expect(arousalInterval).toBeDefined();
        // sexual_arousal starts at [0, 1], aroused's gate tightens to [0.40, 1]
        expect(arousalInterval.min).toBeCloseTo(0.4);
        expect(arousalInterval.max).toBe(1);
      });
    });

    describe('Mixed emotion and sexual requirements', () => {
      it('should handle mixed emotion and sexual prototype requirements', () => {
        const result = analyzer.analyze({
          id: 'test:mixed',
          prerequisites: [
            {
              logic: {
                and: [
                  { '>=': [{ var: 'emotions.fear' }, 0.5] },
                  { '>=': [{ var: 'sexualStates.aroused' }, 0.5] },
                ],
              },
            },
          ],
        });

        // Different axes, no conflict
        expect(result.hasConflict).toBe(false);
        expect(result.axisIntervals.has('threat')).toBe(true);
        expect(result.axisIntervals.has('sexual_arousal')).toBe(true);
      });
    });

    describe('Error handling', () => {
      it('should handle missing prototype gracefully', () => {
        const result = analyzer.analyze({
          id: 'test:missing',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.nonexistent' }, 0.5] },
            },
          ],
        });

        expect(result.hasConflict).toBe(false);
        expect(result.conflicts).toHaveLength(0);
      });

      it('should handle malformed gate strings gracefully', () => {
        // Override with malformed gates
        mockDataRegistry.get = jest.fn((category, lookupId) => {
          if (category === 'lookups' && lookupId === 'core:emotion_prototypes') {
            return {
              entries: {
                malformed: {
                  weights: { threat: 1.0 },
                  gates: ['invalid gate string!', 'threat >= abc'],
                },
              },
            };
          }
          return null;
        });

        const result = analyzer.analyze({
          id: 'test:malformed',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.malformed' }, 0.5] },
            },
          ],
        });

        expect(result.hasConflict).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalled();
      });

      it('should not throw on any valid input', () => {
        const testCases = [
          null,
          undefined,
          {},
          { prerequisites: null },
          { prerequisites: [] },
          { prerequisites: [{}] },
          { prerequisites: [{ logic: null }] },
          { prerequisites: [{ logic: {} }] },
        ];

        for (const testCase of testCases) {
          expect(() => analyzer.analyze(testCase)).not.toThrow();
        }
      });
    });

    describe('Gate tracking', () => {
      it('should include all gate strings in conflict report', () => {
        const result = analyzer.analyze({
          id: 'test:gates',
          prerequisites: [
            {
              logic: {
                and: [
                  { '>=': [{ var: 'emotions.fear' }, 0.5] },
                  { '>=': [{ var: 'emotions.confidence' }, 0.5] },
                ],
              },
            },
          ],
        });

        const conflict = result.conflicts[0];
        expect(conflict.gates).toContain('threat >= 0.30');
        expect(conflict.gates).toContain('threat <= 0.20');
      });
    });
  });
});
