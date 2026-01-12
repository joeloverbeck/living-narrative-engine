/**
 * @file prototypeConstraintAnalyzer.test.js
 * @description Unit tests for PrototypeConstraintAnalyzer service
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import PrototypeConstraintAnalyzer from '../../../../src/expressionDiagnostics/services/PrototypeConstraintAnalyzer.js';

describe('PrototypeConstraintAnalyzer', () => {
  let analyzer;
  let mockDataRegistry;
  let mockLogger;

  // Sample prototypes for testing
  const testPrototypes = {
    anger: {
      weights: {
        valence: -0.8,
        arousal: 0.8,
        affiliation: -0.3,
      },
      gates: ['valence <= -0.15', 'arousal >= 0.10'],
    },
    joy: {
      weights: {
        valence: 1.0,
        arousal: 0.5,
        future_expectancy: 0.3,
      },
      gates: ['valence >= 0.35'],
    },
    calm: {
      weights: {
        valence: 0.2,
        arousal: -1.0,
        threat: -1.0,
      },
      gates: ['threat <= 0.20'],
    },
    lonely_yearning: {
      weights: {
        valence: -0.3,
        arousal: -0.2,
        affiliation: -0.9,
      },
      gates: ['affiliation <= -0.30'],
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

    analyzer = new PrototypeConstraintAnalyzer({
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(analyzer).toBeInstanceOf(PrototypeConstraintAnalyzer);
    });

    it('should throw when dataRegistry is missing required methods', () => {
      expect(
        () =>
          new PrototypeConstraintAnalyzer({
            dataRegistry: {},
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw when logger is missing required methods', () => {
      expect(
        () =>
          new PrototypeConstraintAnalyzer({
            dataRegistry: mockDataRegistry,
            logger: {},
          })
      ).toThrow();
    });
  });

  describe('analyzeEmotionThreshold', () => {
    it('should analyze emotion threshold with no axis constraints', () => {
      const result = analyzer.analyzeEmotionThreshold(
        'anger',
        'emotion',
        0.4,
        new Map()
      );

      expect(result.prototypeId).toBe('anger');
      expect(result.type).toBe('emotion');
      expect(result.threshold).toBe(0.4);
      expect(result.maxAchievable).toBeGreaterThan(0);
      expect(result.weights).toEqual(testPrototypes.anger.weights);
      expect(result.gates).toEqual(testPrototypes.anger.gates);
    });

    it('should detect unreachable threshold when affiliation constraint conflicts', () => {
      // hurt_anger scenario: requires affiliation >= 20 (0.2 normalized)
      // but anger has negative affiliation weight (-0.3)
      const axisConstraints = new Map([
        ['affiliation', { min: 0.2, max: 1 }], // affiliation >= 20
      ]);

      const result = analyzer.analyzeEmotionThreshold(
        'anger',
        'emotion',
        0.4,
        axisConstraints
      );

      // With high affiliation constraint and negative weight, max achievable is reduced
      expect(result.maxAchievable).toBeLessThan(1);
      // Check for binding axes
      expect(result.bindingAxes.length).toBeGreaterThan(0);
      const affiliationBinding = result.bindingAxes.find(
        (a) => a.axis === 'affiliation'
      );
      expect(affiliationBinding).toBeDefined();
      expect(affiliationBinding.isBinding).toBe(true);
    });

    it('should report gate feasibility conflicts', () => {
      // angry_yearning requires low affiliation for lonely_yearning gate
      // but expression requires high affiliation
      const axisConstraints = new Map([
        ['affiliation', { min: 0.5, max: 1 }], // high affiliation
      ]);

      const result = analyzer.analyzeEmotionThreshold(
        'lonely_yearning',
        'emotion',
        0.25,
        axisConstraints
      );

      // lonely_yearning has gate: 'affiliation <= -0.30'
      // With constraint min: 0.5, gate cannot be satisfied
      expect(result.gateStatus.allSatisfiable).toBe(false);
      expect(result.gateStatus.blockingGates.length).toBeGreaterThan(0);
      expect(result.isReachable).toBe(false);
    });

    it('should return not found result for unknown prototype', () => {
      const result = analyzer.analyzeEmotionThreshold(
        'unknown_emotion',
        'emotion',
        0.5,
        new Map()
      );

      expect(result.prototypeId).toBe('unknown_emotion');
      expect(result.isReachable).toBe(false);
      expect(result.explanation).toContain('not found');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should calculate correct max achievable with multiple constraints', () => {
      const axisConstraints = new Map([
        ['valence', { min: -1, max: -0.1 }], // valence <= -10
        ['arousal', { min: -0.05, max: 0.55 }], // -5 <= arousal <= 55
      ]);

      const result = analyzer.analyzeEmotionThreshold(
        'anger',
        'emotion',
        0.4,
        axisConstraints
      );

      expect(result.maxAchievable).toBeGreaterThan(0);
      expect(result.axisAnalysis).toBeDefined();
      expect(result.axisAnalysis.length).toBe(3); // valence, arousal, affiliation
    });

    it('should identify positive weight with low max constraint as conflict', () => {
      // arousal has positive weight, but constrain it to low max
      const axisConstraints = new Map([['arousal', { min: -1, max: -0.5 }]]);

      const result = analyzer.analyzeEmotionThreshold(
        'anger',
        'emotion',
        0.4,
        axisConstraints
      );

      const arousalAnalysis = result.axisAnalysis.find(
        (a) => a.axis === 'arousal'
      );
      expect(arousalAnalysis.isBinding).toBe(true);
      expect(arousalAnalysis.conflictType).toBe('positive_weight_low_max');
    });

    it('should identify negative weight with high min constraint as conflict', () => {
      // valence has negative weight for anger, but constrain it to high min
      const axisConstraints = new Map([['valence', { min: 0.5, max: 1 }]]);

      const result = analyzer.analyzeEmotionThreshold(
        'anger',
        'emotion',
        0.4,
        axisConstraints
      );

      const valenceAnalysis = result.axisAnalysis.find(
        (a) => a.axis === 'valence'
      );
      expect(valenceAnalysis.isBinding).toBe(true);
      expect(valenceAnalysis.conflictType).toBe('negative_weight_high_min');
    });

    it('should include sumAbsWeights and requiredRawSum in result', () => {
      const result = analyzer.analyzeEmotionThreshold(
        'anger',
        'emotion',
        0.4,
        new Map()
      );

      // anger weights: -0.8, 0.8, -0.3 -> sum = 1.9
      expect(result.sumAbsWeights).toBeCloseTo(1.9, 5);
      expect(result.requiredRawSum).toBeCloseTo(0.4 * 1.9, 5);
    });

    describe('operator handling', () => {
      it('should return REACHABLE when maxAchievable >= threshold for >=', () => {
        const result = analyzer.analyzeEmotionThreshold(
          'anger',
          'emotion',
          0.4,
          new Map(),
          '>='
        );

        expect(result.isReachable).toBe(true);
        expect(result.gap).toBeLessThanOrEqual(0);
      });

      it('should return UNREACHABLE when maxAchievable < threshold for >=', () => {
        const axisConstraints = new Map([
          ['arousal', { min: -1, max: -0.5 }],
        ]);

        const result = analyzer.analyzeEmotionThreshold(
          'anger',
          'emotion',
          0.9,
          axisConstraints,
          '>='
        );

        expect(result.isReachable).toBe(false);
        expect(result.gap).toBeGreaterThan(0);
      });

      it('should return REACHABLE when threshold exceeds maxAchievable for <=', () => {
        const axisConstraints = new Map([
          ['affiliation', { min: -0.3, max: 1 }],
        ]);

        const result = analyzer.analyzeEmotionThreshold(
          'lonely_yearning',
          'emotion',
          0.65,
          axisConstraints,
          '<='
        );

        expect(result.isReachable).toBe(true);
        expect(result.gap).toBeLessThan(0);
        expect(result.explanation).toContain('always satisfied');
      });

      it('should return REACHABLE when threshold > 0 for <=', () => {
        const result = analyzer.analyzeEmotionThreshold(
          'anger',
          'emotion',
          0.55,
          new Map(),
          '<='
        );

        expect(result.isReachable).toBe(true);
      });

      it('should return REACHABLE when threshold > 0 for <', () => {
        const result = analyzer.analyzeEmotionThreshold(
          'joy',
          'emotion',
          0.4,
          new Map(),
          '<'
        );

        expect(result.isReachable).toBe(true);
      });

      it('should return UNREACHABLE when maxAchievable <= threshold for >', () => {
        const axisConstraints = new Map([
          ['arousal', { min: -1, max: -0.5 }],
        ]);

        const result = analyzer.analyzeEmotionThreshold(
          'anger',
          'emotion',
          0.75,
          axisConstraints,
          '>'
        );

        expect(result.isReachable).toBe(false);
      });
    });
  });

  describe('extractAxisConstraints', () => {
    it('should extract >= constraints from prerequisites', () => {
      const prerequisites = [
        {
          logic: {
            '>=': [{ var: 'moodAxes.affiliation' }, 20],
          },
        },
      ];

      const constraints = analyzer.extractAxisConstraints(prerequisites);

      expect(constraints.has('affiliation')).toBe(true);
      // 20 normalized to 0.2
      expect(constraints.get('affiliation').min).toBeCloseTo(0.2, 5);
    });

    it('should extract <= constraints from prerequisites', () => {
      const prerequisites = [
        {
          logic: {
            '<=': [{ var: 'moodAxes.valence' }, -10],
          },
        },
      ];

      const constraints = analyzer.extractAxisConstraints(prerequisites);

      expect(constraints.has('valence')).toBe(true);
      // -10 normalized to -0.1
      expect(constraints.get('valence').max).toBeCloseTo(-0.1, 5);
    });

    it('should handle nested AND logic', () => {
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.affiliation' }, 20] },
              { '<=': [{ var: 'moodAxes.valence' }, -10] },
            ],
          },
        },
      ];

      const constraints = analyzer.extractAxisConstraints(prerequisites);

      expect(constraints.has('affiliation')).toBe(true);
      expect(constraints.has('valence')).toBe(true);
    });

    it('should handle nested OR logic', () => {
      const prerequisites = [
        {
          logic: {
            or: [
              { '>=': [{ var: 'moodAxes.threat' }, 10] },
              { '>=': [{ var: 'moodAxes.arousal' }, 15] },
            ],
          },
        },
      ];

      const constraints = analyzer.extractAxisConstraints(prerequisites);

      // Both constraints are extracted (conservative approach)
      expect(constraints.has('threat')).toBe(true);
      expect(constraints.has('arousal')).toBe(true);
    });

    it('should return empty map for empty prerequisites', () => {
      const constraints = analyzer.extractAxisConstraints([]);
      expect(constraints.size).toBe(0);
    });

    it('should return empty map for null prerequisites', () => {
      const constraints = analyzer.extractAxisConstraints(null);
      expect(constraints.size).toBe(0);
    });

    it('should handle multiple constraints on same axis', () => {
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.arousal' }, -5] },
              { '<=': [{ var: 'moodAxes.arousal' }, 55] },
            ],
          },
        },
      ];

      const constraints = analyzer.extractAxisConstraints(prerequisites);

      expect(constraints.has('arousal')).toBe(true);
      const arousal = constraints.get('arousal');
      expect(arousal.min).toBeCloseTo(-0.05, 5);
      expect(arousal.max).toBeCloseTo(0.55, 5);
    });
  });

  describe('gate feasibility checking', () => {
    it('should detect satisfiable gate with compatible constraint', () => {
      // anger gate: valence <= -0.15
      // constraint: valence max = -0.1 (allows values <= -0.1)
      const axisConstraints = new Map([['valence', { min: -1, max: -0.1 }]]);

      const result = analyzer.analyzeEmotionThreshold(
        'anger',
        'emotion',
        0.4,
        axisConstraints
      );

      // valence <= -0.15 is satisfiable when max = -0.1? No, -0.1 > -0.15
      // Actually -0.15 is more negative than -0.1, so constraint allows -0.15
      // Wait, the gate is valence <= -0.15, and constraint max is -0.1
      // If max is -0.1, we can have values from -1 to -0.1
      // -0.15 is within [-1, -0.1], so gate is satisfiable
      const valenceGate = result.gateStatus.gates.find(
        (g) => g.axis === 'valence'
      );
      expect(valenceGate.satisfiable).toBe(true);
    });

    it('should detect unsatisfiable gate when constraint conflicts', () => {
      // anger gate: valence <= -0.15
      // constraint: valence min = 0.5 (only allows positive values)
      const axisConstraints = new Map([['valence', { min: 0.5, max: 1 }]]);

      const result = analyzer.analyzeEmotionThreshold(
        'anger',
        'emotion',
        0.4,
        axisConstraints
      );

      const valenceGate = result.gateStatus.gates.find(
        (g) => g.axis === 'valence'
      );
      expect(valenceGate.satisfiable).toBe(false);
      expect(result.gateStatus.allSatisfiable).toBe(false);
    });

    it('should detect unsatisfiable >= gate', () => {
      // anger gate: arousal >= 0.10
      // constraint: arousal max = -0.5 (only allows low arousal)
      const axisConstraints = new Map([['arousal', { min: -1, max: -0.5 }]]);

      const result = analyzer.analyzeEmotionThreshold(
        'anger',
        'emotion',
        0.4,
        axisConstraints
      );

      const arousalGate = result.gateStatus.gates.find(
        (g) => g.axis === 'arousal'
      );
      expect(arousalGate.satisfiable).toBe(false);
    });

    it('should ignore malformed gate strings without throwing', () => {
      const malformedPrototypes = {
        strange: {
          weights: { valence: 0.4 },
          gates: ['valence <> 0.2'],
        },
      };
      const localRegistry = {
        get: jest.fn(),
        getLookupData: jest.fn((lookupKey) => {
          if (lookupKey === 'core:emotion_prototypes') {
            return { entries: malformedPrototypes };
          }
          return null;
        }),
      };
      const localAnalyzer = new PrototypeConstraintAnalyzer({
        dataRegistry: localRegistry,
        logger: mockLogger,
      });

      const result = localAnalyzer.analyzeEmotionThreshold(
        'strange',
        'emotion',
        0.2,
        new Map()
      );

      expect(result.gateStatus.gates).toHaveLength(1);
      expect(result.gateStatus.gates[0].reason).toBe('Could not parse gate');
      expect(result.gateStatus.gates[0].satisfiable).toBe(true);
    });
  });

  describe('explanation generation', () => {
    it('should generate explanation for achievable threshold', () => {
      const result = analyzer.analyzeEmotionThreshold(
        'anger',
        'emotion',
        0.1,
        new Map()
      );

      expect(result.explanation).toContain('achievable');
    });

    it('should generate explanation for unachievable threshold', () => {
      // Constrain valence to high positive values (anger needs negative valence)
      const axisConstraints = new Map([['valence', { min: 0.9, max: 1 }]]);

      const result = analyzer.analyzeEmotionThreshold(
        'anger',
        'emotion',
        0.4,
        axisConstraints
      );

      expect(result.explanation).toContain('NOT achievable');
    });

    it('should mention binding conflicts in explanation', () => {
      const axisConstraints = new Map([['affiliation', { min: 0.5, max: 1 }]]);

      const result = analyzer.analyzeEmotionThreshold(
        'anger',
        'emotion',
        0.4,
        axisConstraints
      );

      expect(result.explanation).toContain('Binding');
    });

    it('should mention blocked gates in explanation', () => {
      const axisConstraints = new Map([['valence', { min: 0.5, max: 1 }]]);

      const result = analyzer.analyzeEmotionThreshold(
        'anger',
        'emotion',
        0.4,
        axisConstraints
      );

      expect(result.explanation).toContain('Blocked gates');
    });
  });
});
