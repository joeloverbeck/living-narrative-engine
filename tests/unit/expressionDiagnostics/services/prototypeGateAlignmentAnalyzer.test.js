/**
 * @file prototypeGateAlignmentAnalyzer.test.js
 * @description Unit tests for PrototypeGateAlignmentAnalyzer service
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import PrototypeGateAlignmentAnalyzer from '../../../../src/expressionDiagnostics/services/PrototypeGateAlignmentAnalyzer.js';

describe('PrototypeGateAlignmentAnalyzer', () => {
  let analyzer;
  let mockDataRegistry;
  let mockLogger;

  // Sample prototypes for testing
  const testPrototypes = {
    anger: {
      weights: {
        valence: -0.8,
        arousal: 0.8,
      },
      gates: ['valence <= -0.15', 'arousal >= 0.10'],
    },
    joy: {
      weights: {
        valence: 1.0,
        arousal: 0.5,
      },
      gates: ['valence >= 0.35'],
    },
    calm: {
      weights: {
        valence: 0.2,
        arousal: -1.0,
      },
      gates: ['arousal <= 0.20'],
    },
    multiGate: {
      weights: { valence: 0.5 },
      gates: ['valence >= 0.3', 'valence <= 0.8'],
    },
    strictInequality: {
      weights: { valence: 0.5 },
      gates: ['valence > 0.5', 'arousal < -0.2'],
    },
    sexual_arousal_emotion: {
      weights: { sex_excitation: 0.8 },
      gates: ['sex_excitation >= 0.3'],
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
      get: jest.fn(),
      getLookupData: jest.fn((lookupKey) => {
        if (lookupKey === 'core:emotion_prototypes') {
          return { entries: testPrototypes };
        }
        return null;
      }),
    };

    analyzer = new PrototypeGateAlignmentAnalyzer({
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(analyzer).toBeInstanceOf(PrototypeGateAlignmentAnalyzer);
    });

    it('should throw when dataRegistry is missing required methods', () => {
      expect(
        () =>
          new PrototypeGateAlignmentAnalyzer({
            dataRegistry: {},
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw when logger is missing required methods', () => {
      expect(
        () =>
          new PrototypeGateAlignmentAnalyzer({
            dataRegistry: mockDataRegistry,
            logger: {},
          })
      ).toThrow();
    });

    it('should throw when dataRegistry is null', () => {
      expect(
        () =>
          new PrototypeGateAlignmentAnalyzer({
            dataRegistry: null,
            logger: mockLogger,
          })
      ).toThrow();
    });
  });

  describe('analyze - Invariant #1: Empty prerequisites', () => {
    it('should return empty contradictions for empty prerequisites array', () => {
      const result = analyzer.analyze([], [{ type: 'emotion', id: 'anger' }]);

      expect(result.contradictions).toEqual([]);
      expect(result.hasIssues).toBe(false);
    });

    it('should return empty contradictions for null prerequisites', () => {
      const result = analyzer.analyze(null, [{ type: 'emotion', id: 'anger' }]);

      expect(result.contradictions).toEqual([]);
      expect(result.hasIssues).toBe(false);
    });

    it('should return empty contradictions for undefined prerequisites', () => {
      const result = analyzer.analyze(undefined, [
        { type: 'emotion', id: 'anger' },
      ]);

      expect(result.contradictions).toEqual([]);
      expect(result.hasIssues).toBe(false);
    });
  });

  describe('analyze - Invariant #2: Empty emotionConditions', () => {
    it('should return empty contradictions for empty emotionConditions array', () => {
      const result = analyzer.analyze(
        [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 0.5] } }],
        []
      );

      expect(result.contradictions).toEqual([]);
      expect(result.hasIssues).toBe(false);
    });

    it('should return empty contradictions for null emotionConditions', () => {
      const result = analyzer.analyze(
        [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 0.5] } }],
        null
      );

      expect(result.contradictions).toEqual([]);
      expect(result.hasIssues).toBe(false);
    });

    it('should return empty contradictions for undefined emotionConditions', () => {
      const result = analyzer.analyze(
        [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 0.5] } }],
        undefined
      );

      expect(result.contradictions).toEqual([]);
      expect(result.hasIssues).toBe(false);
    });
  });

  describe('analyze - Invariant #3: Intervals overlap (no contradiction)', () => {
    it('should return no contradiction when regime allows gate', () => {
      // Regime: valence >= 0.5, Gate: valence >= 0.35
      // Overlap: [0.5, 1] ∩ [0.35, 1] = [0.5, 1]
      const prerequisites = [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 0.5] } },
      ];
      const emotionConditions = [{ type: 'emotion', id: 'joy', threshold: 0.5 }];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      expect(result.contradictions).toEqual([]);
      expect(result.hasIssues).toBe(false);
    });

    it('should return no contradiction when regime is subset of gate', () => {
      // Regime: arousal <= 0.1, Gate: arousal <= 0.20
      // Overlap exists
      const prerequisites = [
        { logic: { '<=': [{ var: 'moodAxes.arousal' }, 0.1] } },
      ];
      const emotionConditions = [
        { type: 'emotion', id: 'calm', threshold: 0.5 },
      ];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      expect(result.contradictions).toEqual([]);
      expect(result.hasIssues).toBe(false);
    });
  });

  describe('analyze - Invariant #4: Detects contradictions', () => {
    it('should detect contradiction when regime.max < gate.min', () => {
      // Regime: valence <= -0.5, Gate: valence >= 0.35
      // Regime interval: [-1, -0.5], Gate interval: [0.35, 1]
      // No overlap - contradiction
      const prerequisites = [
        { logic: { '<=': [{ var: 'moodAxes.valence' }, -0.5] } },
      ];
      const emotionConditions = [{ type: 'emotion', id: 'joy', threshold: 0.5 }];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      expect(result.contradictions.length).toBeGreaterThan(0);
      expect(result.hasIssues).toBe(true);
      expect(result.contradictions[0]).toMatchObject({
        emotionId: 'joy',
        axis: 'valence',
      });
    });

    it('should detect contradiction when regime.min > gate.max', () => {
      // Regime: valence >= 0.5, Gate: valence <= -0.15
      // Regime interval: [0.5, 1], Gate interval: [-1, -0.15]
      // No overlap - contradiction
      const prerequisites = [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 0.5] } },
      ];
      const emotionConditions = [
        { type: 'emotion', id: 'anger', threshold: 0.5 },
      ];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      expect(result.contradictions.length).toBeGreaterThan(0);
      expect(result.hasIssues).toBe(true);
      const contradiction = result.contradictions.find(
        (c) => c.axis === 'valence'
      );
      expect(contradiction).toBeDefined();
    });
  });

  describe('analyze - Invariant #5: Distance is non-negative', () => {
    it('should return non-negative distance for contradictions', () => {
      const prerequisites = [
        { logic: { '<=': [{ var: 'moodAxes.valence' }, -0.5] } },
      ];
      const emotionConditions = [{ type: 'emotion', id: 'joy', threshold: 0.5 }];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      for (const contradiction of result.contradictions) {
        expect(contradiction.distance).toBeGreaterThanOrEqual(0);
      }
    });

    it('should calculate correct distance between non-overlapping intervals', () => {
      // Regime: valence <= 0.0, Gate: valence >= 0.35
      // Gap: 0.35 - 0.0 = 0.35
      const prerequisites = [
        { logic: { '<=': [{ var: 'moodAxes.valence' }, 0.0] } },
      ];
      const emotionConditions = [{ type: 'emotion', id: 'joy', threshold: 0.5 }];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      expect(result.contradictions.length).toBeGreaterThan(0);
      const valenceContradiction = result.contradictions.find(
        (c) => c.axis === 'valence'
      );
      expect(valenceContradiction).toBeDefined();
      expect(valenceContradiction.distance).toBeCloseTo(0.35, 5);
    });
  });

  describe('analyze - Invariant #6: Severity levels', () => {
    it('should set severity to critical for positive distance', () => {
      const prerequisites = [
        { logic: { '<=': [{ var: 'moodAxes.valence' }, -0.5] } },
      ];
      const emotionConditions = [{ type: 'emotion', id: 'joy', threshold: 0.5 }];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      expect(result.contradictions.length).toBeGreaterThan(0);
      const positiveDistanceContradictions = result.contradictions.filter(
        (c) => c.distance > 0
      );
      expect(positiveDistanceContradictions.length).toBeGreaterThan(0);
      positiveDistanceContradictions.forEach((contradiction) => {
        expect(contradiction.severity).toBe('critical');
      });
    });

    it('should set severity to info for zero distance edge case', () => {
      // Edge case where intervals just touch but don't overlap
      // This is a theoretical case, as exact touching would usually be overlap
      // But the logic should handle it
      const prerequisites = [
        { logic: { '<': [{ var: 'moodAxes.valence' }, 0.35] } },
      ];
      const emotionConditions = [{ type: 'emotion', id: 'joy', threshold: 0.5 }];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      // Check that severity assignment follows the rules
      const zeroDistanceContradictions = result.contradictions.filter(
        (c) => c.distance === 0
      );
      const positiveDistanceContradictions = result.contradictions.filter(
        (c) => c.distance > 0
      );

      zeroDistanceContradictions.forEach((contradiction) => {
        expect(contradiction.severity).toBe('info');
      });
      positiveDistanceContradictions.forEach((contradiction) => {
        expect(contradiction.severity).toBe('critical');
      });
    });
  });

  describe('analyze - Invariant #7: Correct axis normalization', () => {
    it('should use [-1, 1] range for mood axes', () => {
      // No constraints means default [-1, 1] for mood axes
      const prerequisites = [];
      const emotionConditions = [{ type: 'emotion', id: 'joy', threshold: 0.5 }];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      // With no constraints, all gates should be satisfiable (no contradictions)
      expect(result.contradictions).toEqual([]);
    });

    it('should use [0, 1] range for sexual axes', () => {
      // Test with sexual axis emotion
      const prerequisites = [];
      const emotionConditions = [
        { type: 'emotion', id: 'sexual_arousal_emotion', threshold: 0.5 },
      ];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      // With no constraints, gate sex_excitation >= 0.3 should be satisfiable
      expect(result.contradictions).toEqual([]);
    });

    it('should detect contradiction on sexual axis with correct bounds', () => {
      // Constrain sex_excitation to [0, 0.2], gate requires >= 0.3
      const prerequisites = [
        { logic: { '<=': [{ var: 'moodAxes.sex_excitation' }, 0.2] } },
      ];
      const emotionConditions = [
        { type: 'emotion', id: 'sexual_arousal_emotion', threshold: 0.5 },
      ];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      expect(result.contradictions.length).toBeGreaterThan(0);
      const contradiction = result.contradictions.find(
        (c) => c.axis === 'sex_excitation'
      );
      expect(contradiction).toBeDefined();
      // Regime: [0, 0.2], Gate: [0.3, 1], distance = 0.3 - 0.2 = 0.1
      expect(contradiction.distance).toBeCloseTo(0.1, 5);
    });
  });

  describe('analyze - Invariant #8: Does not modify inputs', () => {
    it('should not modify prerequisites array', () => {
      const prerequisites = [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 0.5] } },
      ];
      const originalPrerequisites = JSON.parse(JSON.stringify(prerequisites));

      analyzer.analyze(prerequisites, [{ type: 'emotion', id: 'joy' }]);

      expect(prerequisites).toEqual(originalPrerequisites);
    });

    it('should not modify emotionConditions array', () => {
      const emotionConditions = [
        { type: 'emotion', id: 'joy', threshold: 0.5 },
      ];
      const originalConditions = JSON.parse(JSON.stringify(emotionConditions));

      analyzer.analyze(
        [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 0.5] } }],
        emotionConditions
      );

      expect(emotionConditions).toEqual(originalConditions);
    });
  });

  describe('analyze - Invariant #9: Tolerates missing prototype', () => {
    it('should gracefully handle non-existent prototype', () => {
      const prerequisites = [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 0.5] } },
      ];
      const emotionConditions = [
        { type: 'emotion', id: 'nonexistent_emotion', threshold: 0.5 },
      ];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      // Should not throw, should return empty contradictions for this emotion
      expect(result).toBeDefined();
      expect(Array.isArray(result.contradictions)).toBe(true);
    });

    it('should log debug message for missing prototype', () => {
      const prerequisites = [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 0.5] } },
      ];
      const emotionConditions = [
        { type: 'emotion', id: 'nonexistent_emotion', threshold: 0.5 },
      ];

      analyzer.analyze(prerequisites, emotionConditions);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Prototype not found: nonexistent_emotion')
      );
    });

    it('should process other emotions even when one is missing', () => {
      const prerequisites = [
        { logic: { '<=': [{ var: 'moodAxes.valence' }, -0.5] } },
      ];
      const emotionConditions = [
        { type: 'emotion', id: 'nonexistent_emotion', threshold: 0.5 },
        { type: 'emotion', id: 'joy', threshold: 0.5 }, // This has a contradiction
      ];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      // Should find contradiction for joy even though nonexistent is missing
      expect(result.contradictions.length).toBeGreaterThan(0);
      expect(result.contradictions[0].emotionId).toBe('joy');
    });
  });

  describe('analyze - Multiple gates per prototype', () => {
    it('should check all gates for a prototype', () => {
      // multiGate has gates: valence >= 0.3 AND valence <= 0.8
      // Constrain valence to [0.9, 1.0] - violates valence <= 0.8
      const prerequisites = [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 0.9] } },
      ];
      const emotionConditions = [
        { type: 'emotion', id: 'multiGate', threshold: 0.5 },
      ];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      // Should detect contradiction with valence <= 0.8 gate
      expect(result.contradictions.length).toBeGreaterThan(0);
      expect(result.hasIssues).toBe(true);
    });

    it('should report multiple contradictions if multiple gates fail', () => {
      // Constrain valence to [0, 0.2] - violates both valence >= 0.3 gate
      const prerequisites = [
        { logic: { '<=': [{ var: 'moodAxes.valence' }, 0.2] } },
      ];
      const emotionConditions = [
        { type: 'emotion', id: 'multiGate', threshold: 0.5 },
      ];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      expect(result.contradictions.length).toBeGreaterThan(0);
    });
  });

  describe('analyze - Strict inequality operators', () => {
    it('should handle strict greater-than gate correctly', () => {
      // strictInequality has gate: valence > 0.5
      // Constrain valence to [-1, 0.5] - exactly at boundary
      const prerequisites = [
        { logic: { '<=': [{ var: 'moodAxes.valence' }, 0.5] } },
      ];
      const emotionConditions = [
        { type: 'emotion', id: 'strictInequality', threshold: 0.5 },
      ];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      // valence > 0.5 requires (0.5, 1], regime is [-1, 0.5]
      // These don't overlap (strict inequality)
      expect(result.contradictions.length).toBeGreaterThan(0);
      const contradiction = result.contradictions.find(
        (c) => c.axis === 'valence'
      );
      expect(contradiction).toBeDefined();
    });

    it('should handle strict less-than gate correctly', () => {
      // strictInequality has gate: arousal < -0.2
      // Constrain arousal to [-0.2, 1] - exactly at boundary
      const prerequisites = [
        { logic: { '>=': [{ var: 'moodAxes.arousal' }, -0.2] } },
      ];
      const emotionConditions = [
        { type: 'emotion', id: 'strictInequality', threshold: 0.5 },
      ];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      // arousal < -0.2 requires [-1, -0.2), regime is [-0.2, 1]
      // These don't overlap (strict inequality)
      expect(result.contradictions.length).toBeGreaterThan(0);
      const contradiction = result.contradictions.find(
        (c) => c.axis === 'arousal'
      );
      expect(contradiction).toBeDefined();
    });
  });

  describe('analyze - Filter non-emotion conditions', () => {
    it('should ignore non-emotion type conditions', () => {
      const prerequisites = [
        { logic: { '<=': [{ var: 'moodAxes.valence' }, -0.5] } },
      ];
      const emotionConditions = [
        { type: 'sexual', id: 'some_sexual_state', threshold: 0.5 },
        { type: 'other', id: 'some_other', threshold: 0.5 },
      ];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      // Should not analyze non-emotion types
      expect(result.contradictions).toEqual([]);
    });

    it('should only analyze emotion type conditions', () => {
      const prerequisites = [
        { logic: { '<=': [{ var: 'moodAxes.valence' }, -0.5] } },
      ];
      const emotionConditions = [
        { type: 'sexual', id: 'some_sexual_state', threshold: 0.5 },
        { type: 'emotion', id: 'joy', threshold: 0.5 }, // This has contradiction
      ];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      // Should only find contradiction for joy (emotion type)
      expect(result.contradictions.length).toBeGreaterThan(0);
      expect(result.contradictions[0].emotionId).toBe('joy');
    });
  });

  describe('analyze - Output structure', () => {
    it('should return correct structure for contradictions', () => {
      const prerequisites = [
        { logic: { '<=': [{ var: 'moodAxes.valence' }, -0.5] } },
      ];
      const emotionConditions = [{ type: 'emotion', id: 'joy', threshold: 0.5 }];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      expect(result).toHaveProperty('contradictions');
      expect(result).toHaveProperty('tightPassages');
      expect(result).toHaveProperty('hasIssues');
      expect(Array.isArray(result.contradictions)).toBe(true);
      expect(Array.isArray(result.tightPassages)).toBe(true);
      expect(typeof result.hasIssues).toBe('boolean');
    });

    it('should include all required fields in contradiction objects', () => {
      const prerequisites = [
        { logic: { '<=': [{ var: 'moodAxes.valence' }, -0.5] } },
      ];
      const emotionConditions = [{ type: 'emotion', id: 'joy', threshold: 0.5 }];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      expect(result.contradictions.length).toBeGreaterThan(0);
      const contradiction = result.contradictions[0];

      expect(contradiction).toHaveProperty('emotionId');
      expect(contradiction).toHaveProperty('axis');
      expect(contradiction).toHaveProperty('regime');
      expect(contradiction.regime).toHaveProperty('min');
      expect(contradiction.regime).toHaveProperty('max');
      expect(contradiction).toHaveProperty('gate');
      expect(contradiction.gate).toHaveProperty('min');
      expect(contradiction.gate).toHaveProperty('max');
      expect(contradiction).toHaveProperty('gateString');
      expect(contradiction).toHaveProperty('distance');
      expect(contradiction).toHaveProperty('severity');
    });

    it('should return empty tightPassages (placeholder)', () => {
      const prerequisites = [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 0.5] } },
      ];
      const emotionConditions = [{ type: 'emotion', id: 'joy', threshold: 0.5 }];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      expect(result.tightPassages).toEqual([]);
    });
  });

  describe('analyze - Raw value normalization', () => {
    it('should normalize raw values (> 1) to [-1, 1] range', () => {
      // Raw value 50 should be normalized to 0.5
      const prerequisites = [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 50] } },
      ];
      const emotionConditions = [{ type: 'emotion', id: 'joy', threshold: 0.5 }];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      // Regime: valence >= 0.5 (normalized from 50)
      // Gate: valence >= 0.35
      // Should not be a contradiction
      expect(result.contradictions).toEqual([]);
    });

    it('should handle negative raw values correctly', () => {
      // Raw value -50 should be normalized to -0.5
      const prerequisites = [
        { logic: { '<=': [{ var: 'moodAxes.valence' }, -50] } },
      ];
      const emotionConditions = [{ type: 'emotion', id: 'joy', threshold: 0.5 }];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      // Regime: valence <= -0.5 (normalized from -50)
      // Gate: valence >= 0.35
      // Should be a contradiction
      expect(result.contradictions.length).toBeGreaterThan(0);
    });
  });

  describe('analyze - Multiple axes', () => {
    it('should check gates on different axes independently', () => {
      // anger has gates on both valence and arousal
      // Violate only the valence gate
      const prerequisites = [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 0.5] } }, // Violates valence <= -0.15
      ];
      const emotionConditions = [
        { type: 'emotion', id: 'anger', threshold: 0.5 },
      ];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      // Should detect contradiction on valence axis
      expect(result.contradictions.length).toBeGreaterThan(0);
      const valenceContradiction = result.contradictions.find(
        (c) => c.axis === 'valence'
      );
      expect(valenceContradiction).toBeDefined();
    });

    it('should detect contradictions on multiple axes', () => {
      // Violate both gates of anger
      const prerequisites = [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 0.5] } }, // Violates valence <= -0.15
        { logic: { '<=': [{ var: 'moodAxes.arousal' }, -0.5] } }, // Violates arousal >= 0.10
      ];
      const emotionConditions = [
        { type: 'emotion', id: 'anger', threshold: 0.5 },
      ];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      // Should detect contradictions on both axes
      expect(result.contradictions.length).toBe(2);
      const axes = result.contradictions.map((c) => c.axis);
      expect(axes).toContain('valence');
      expect(axes).toContain('arousal');
    });
  });

  describe('analyze - Edge cases', () => {
    it('should handle prototype with no gates', () => {
      const noGatePrototype = {
        weights: { valence: 0.5 },
        gates: [],
      };

      mockDataRegistry.getLookupData.mockReturnValue({
        entries: { noGateEmotion: noGatePrototype },
      });

      const prerequisites = [
        { logic: { '<=': [{ var: 'moodAxes.valence' }, -0.5] } },
      ];
      const emotionConditions = [
        { type: 'emotion', id: 'noGateEmotion', threshold: 0.5 },
      ];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      expect(result.contradictions).toEqual([]);
    });

    it('should handle malformed gate string gracefully', () => {
      const badGatePrototype = {
        weights: { valence: 0.5 },
        gates: ['invalid gate string'],
      };

      mockDataRegistry.getLookupData.mockReturnValue({
        entries: { badGateEmotion: badGatePrototype },
      });

      const prerequisites = [
        { logic: { '<=': [{ var: 'moodAxes.valence' }, -0.5] } },
      ];
      const emotionConditions = [
        { type: 'emotion', id: 'badGateEmotion', threshold: 0.5 },
      ];

      // Should not throw
      expect(() =>
        analyzer.analyze(prerequisites, emotionConditions)
      ).not.toThrow();

      const result = analyzer.analyze(prerequisites, emotionConditions);
      expect(result).toBeDefined();
    });

    it('should handle prototype with undefined gates property', () => {
      const noGatesProperty = {
        weights: { valence: 0.5 },
        // gates property missing
      };

      mockDataRegistry.getLookupData.mockReturnValue({
        entries: { noGatesEmotion: noGatesProperty },
      });

      const prerequisites = [
        { logic: { '<=': [{ var: 'moodAxes.valence' }, -0.5] } },
      ];
      const emotionConditions = [
        { type: 'emotion', id: 'noGatesEmotion', threshold: 0.5 },
      ];

      const result = analyzer.analyze(prerequisites, emotionConditions);

      expect(result.contradictions).toEqual([]);
    });
  });
});
