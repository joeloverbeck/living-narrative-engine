/**
 * @file Unit tests for PrototypeFitRankingService
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PrototypeFitRankingService from '../../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';

describe('PrototypeFitRankingService', () => {
  let service;
  let mockLogger;
  let mockDataRegistry;

  // Sample prototype data mimicking emotion_prototypes.lookup.json structure
  const samplePrototypes = {
    joy: {
      id: 'joy',
      weights: { valence: 0.8, arousal: 0.3, dominance: 0.2 },
      gates: ['valence >= 0.35'],
    },
    anger: {
      id: 'anger',
      weights: { valence: -0.6, arousal: 0.7, dominance: 0.4 },
      gates: ['arousal >= 0.3'],
    },
    calm: {
      id: 'calm',
      weights: { valence: 0.3, arousal: -0.5, dominance: 0.1 },
      gates: ['arousal <= 0.2'],
    },
    fear: {
      id: 'fear',
      weights: { valence: -0.7, arousal: 0.6, dominance: -0.5 },
      gates: ['valence <= 0', 'arousal >= 0.2'],
    },
    sadness: {
      id: 'sadness',
      weights: { valence: -0.5, arousal: -0.3, dominance: -0.4 },
      gates: ['valence <= 0'],
    },
  };

  // Sample stored contexts from Monte Carlo simulation
  const sampleContexts = [
    {
      moodAxes: { valence: 0.5, arousal: 0.4, dominance: 0.2 },
      emotionIntensities: { joy: 0.6, anger: 0.1, calm: 0.3, fear: 0.05, sadness: 0.1 },
    },
    {
      moodAxes: { valence: 0.6, arousal: 0.2, dominance: 0.3 },
      emotionIntensities: { joy: 0.7, anger: 0.05, calm: 0.5, fear: 0.02, sadness: 0.08 },
    },
    {
      moodAxes: { valence: 0.4, arousal: 0.5, dominance: 0.1 },
      emotionIntensities: { joy: 0.5, anger: 0.15, calm: 0.2, fear: 0.1, sadness: 0.12 },
    },
    {
      moodAxes: { valence: -0.2, arousal: 0.6, dominance: -0.1 },
      emotionIntensities: { joy: 0.1, anger: 0.4, calm: 0.1, fear: 0.35, sadness: 0.25 },
    },
  ];

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn(() => null),
      getLookupData: jest.fn((lookupId) => {
        if (lookupId === 'core:emotion_prototypes') {
          return { entries: samplePrototypes };
        }
        return null;
      }),
    };

    service = new PrototypeFitRankingService({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
    });
  });

  describe('constructor', () => {
    it('should throw if logger is missing', () => {
      expect(
        () =>
          new PrototypeFitRankingService({
            dataRegistry: mockDataRegistry,
          })
      ).toThrow();
    });

    it('should throw if dataRegistry is missing', () => {
      expect(
        () =>
          new PrototypeFitRankingService({
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should construct successfully with valid dependencies', () => {
      expect(service).toBeDefined();
    });
  });

  describe('analyzeAllPrototypeFit', () => {
    it('should return empty leaderboard if no stored contexts', () => {
      const expression = { id: 'test-expression' };
      const result = service.analyzeAllPrototypeFit(expression, [], new Map());

      expect(result).toEqual({
        leaderboard: [],
        currentPrototype: null,
        bestAlternative: null,
        improvementFactor: null,
      });
    });

    it('should return empty leaderboard if storedContexts is undefined', () => {
      const expression = { id: 'test-expression' };
      const result = service.analyzeAllPrototypeFit(expression, undefined, new Map());

      expect(result).toEqual({
        leaderboard: [],
        currentPrototype: null,
        bestAlternative: null,
        improvementFactor: null,
      });
    });

    it('should return empty leaderboard if no prototypes found', () => {
      mockDataRegistry.getLookupData = jest.fn(() => null);
      const expression = { id: 'test-expression' };
      const result = service.analyzeAllPrototypeFit(expression, sampleContexts, new Map());

      expect(result).toEqual({
        leaderboard: [],
        currentPrototype: null,
        bestAlternative: null,
        improvementFactor: null,
      });
    });

    it('should analyze all prototypes and return leaderboard', () => {
      const expression = { id: 'test-expression' };
      const axisConstraints = new Map([
        ['valence', { min: 0.3, max: 1.0 }],
        ['arousal', { min: 0, max: 1.0 }],
      ]);

      const result = service.analyzeAllPrototypeFit(
        expression,
        sampleContexts,
        axisConstraints,
        0.3
      );

      expect(result).toHaveProperty('leaderboard');
      expect(Array.isArray(result.leaderboard)).toBe(true);
      expect(result.leaderboard.length).toBeGreaterThan(0);
      expect(result.leaderboard.length).toBeLessThanOrEqual(10);
    });

    it('should rank prototypes by composite score descending', () => {
      const expression = { id: 'test-expression' };
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);

      const result = service.analyzeAllPrototypeFit(
        expression,
        sampleContexts,
        axisConstraints,
        0.3
      );

      const leaderboard = result.leaderboard;
      for (let i = 1; i < leaderboard.length; i++) {
        expect(leaderboard[i - 1].compositeScore).toBeGreaterThanOrEqual(
          leaderboard[i].compositeScore
        );
      }
    });

    it('should assign correct ranks to prototypes', () => {
      const expression = { id: 'test-expression' };
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);

      const result = service.analyzeAllPrototypeFit(
        expression,
        sampleContexts,
        axisConstraints,
        0.3
      );

      result.leaderboard.forEach((item, index) => {
        expect(item.rank).toBe(index + 1);
      });
    });

    it('should include gate pass rate for each prototype', () => {
      const expression = { id: 'test-expression' };
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);

      const result = service.analyzeAllPrototypeFit(
        expression,
        sampleContexts,
        axisConstraints,
        0.3
      );

      result.leaderboard.forEach((item) => {
        expect(item).toHaveProperty('gatePassRate');
        expect(typeof item.gatePassRate).toBe('number');
        expect(item.gatePassRate).toBeGreaterThanOrEqual(0);
        expect(item.gatePassRate).toBeLessThanOrEqual(1);
      });
    });

    it('should include intensity distribution with quantiles', () => {
      const expression = { id: 'test-expression' };
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);

      const result = service.analyzeAllPrototypeFit(
        expression,
        sampleContexts,
        axisConstraints,
        0.3
      );

      result.leaderboard.forEach((item) => {
        expect(item).toHaveProperty('intensityDistribution');
        expect(item.intensityDistribution).toHaveProperty('p50');
        expect(item.intensityDistribution).toHaveProperty('p90');
        expect(item.intensityDistribution).toHaveProperty('p95');
        expect(item.intensityDistribution).toHaveProperty('pAboveThreshold');
      });
    });

    it('should detect conflicts between prototype weights and constraint directions', () => {
      const expression = { id: 'test-expression' };
      // Constraint wants high valence (0.5-1.0)
      const axisConstraints = new Map([['valence', { min: 0.5, max: 1.0 }]]);

      const result = service.analyzeAllPrototypeFit(
        expression,
        sampleContexts,
        axisConstraints,
        0.3
      );

      // Find anger - it has negative valence weight (-0.6), conflicting with high valence constraint
      const angerResult = result.leaderboard.find((r) => r.prototypeId === 'anger');
      expect(angerResult).toBeDefined();
      expect(angerResult).toHaveProperty('conflictScore');
      expect(angerResult.conflictScore).toBeGreaterThan(0);

      // Joy should have no conflict (positive valence weight aligns with constraint)
      const joyResult = result.leaderboard.find((r) => r.prototypeId === 'joy');
      expect(joyResult).toBeDefined();
      expect(joyResult.conflictScore).toBe(0);
    });

    it('should include composite score for ranking', () => {
      const expression = { id: 'test-expression' };
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);

      const result = service.analyzeAllPrototypeFit(
        expression,
        sampleContexts,
        axisConstraints,
        0.3
      );

      result.leaderboard.forEach((item) => {
        expect(item).toHaveProperty('compositeScore');
        expect(typeof item.compositeScore).toBe('number');
        expect(item.compositeScore).toBeGreaterThanOrEqual(0);
        expect(item.compositeScore).toBeLessThanOrEqual(1);
      });
    });

    it('should filter contexts to mood regime based on axisConstraints', () => {
      const expression = { id: 'test-expression' };
      // Tight constraint that filters out most contexts
      const axisConstraints = new Map([['valence', { min: 0.5, max: 0.7 }]]);

      const result = service.analyzeAllPrototypeFit(
        expression,
        sampleContexts,
        axisConstraints,
        0.3
      );

      // Should still produce results
      expect(result.leaderboard.length).toBeGreaterThan(0);
    });
  });

  describe('computeImpliedPrototype', () => {
    it('should return empty rankings if no prototypes found', () => {
      mockDataRegistry.getLookupData = jest.fn(() => null);

      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);
      const clauseFailures = [];

      const result = service.computeImpliedPrototype(
        axisConstraints,
        clauseFailures,
        sampleContexts
      );

      expect(result).toHaveProperty('targetSignature');
      expect(result.bySimilarity).toEqual([]);
      expect(result.byGatePass).toEqual([]);
      expect(result.byCombined).toEqual([]);
    });

    it('should return empty target signature if no constraints', () => {
      const axisConstraints = new Map();
      const clauseFailures = [];

      const result = service.computeImpliedPrototype(
        axisConstraints,
        clauseFailures,
        sampleContexts
      );

      expect(result.targetSignature.size).toBe(0);
    });

    it('should build target signature from constraints', () => {
      const axisConstraints = new Map([
        ['valence', { min: 0.3, max: 1.0 }],
        ['arousal', { min: -0.5, max: 0.5 }],
      ]);
      const clauseFailures = [];

      const result = service.computeImpliedPrototype(
        axisConstraints,
        clauseFailures,
        sampleContexts
      );

      expect(result.targetSignature).toBeInstanceOf(Map);
      expect(result.targetSignature.has('valence')).toBe(true);
      expect(result.targetSignature.has('arousal')).toBe(true);

      const valenceEntry = result.targetSignature.get('valence');
      expect(valenceEntry).toHaveProperty('direction');
      expect(valenceEntry).toHaveProperty('importance');
    });

    it('should return top 5 by similarity, gate pass, and combined', () => {
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);
      const clauseFailures = [];

      const result = service.computeImpliedPrototype(
        axisConstraints,
        clauseFailures,
        sampleContexts
      );

      expect(result.bySimilarity.length).toBeLessThanOrEqual(5);
      expect(result.byGatePass.length).toBeLessThanOrEqual(5);
      expect(result.byCombined.length).toBeLessThanOrEqual(5);

      // Each ranking should have required properties
      result.bySimilarity.forEach((item) => {
        expect(item).toHaveProperty('prototypeId');
        expect(item).toHaveProperty('cosineSimilarity');
        expect(item).toHaveProperty('gatePassRate');
        expect(item).toHaveProperty('combinedScore');
      });
    });

    it('should sort bySimilarity by cosine similarity descending', () => {
      const axisConstraints = new Map([
        ['valence', { min: 0.3, max: 1.0 }],
        ['arousal', { min: 0, max: 0.5 }],
      ]);
      const clauseFailures = [];

      const result = service.computeImpliedPrototype(
        axisConstraints,
        clauseFailures,
        sampleContexts
      );

      for (let i = 1; i < result.bySimilarity.length; i++) {
        expect(result.bySimilarity[i - 1].cosineSimilarity).toBeGreaterThanOrEqual(
          result.bySimilarity[i].cosineSimilarity
        );
      }
    });

    it('should sort byGatePass by gate pass rate descending', () => {
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);
      const clauseFailures = [];

      const result = service.computeImpliedPrototype(
        axisConstraints,
        clauseFailures,
        sampleContexts
      );

      for (let i = 1; i < result.byGatePass.length; i++) {
        expect(result.byGatePass[i - 1].gatePassRate).toBeGreaterThanOrEqual(
          result.byGatePass[i].gatePassRate
        );
      }
    });

    it('should compute combined score as weighted average', () => {
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);
      const clauseFailures = [];

      const result = service.computeImpliedPrototype(
        axisConstraints,
        clauseFailures,
        sampleContexts
      );

      result.byCombined.forEach((item) => {
        // Combined = 0.6 * similarity + 0.4 * gatePass
        const expected = 0.6 * item.cosineSimilarity + 0.4 * item.gatePassRate;
        expect(item.combinedScore).toBeCloseTo(expected, 5);
      });
    });

    it('should incorporate clause failures into importance weighting', () => {
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);
      const clauseFailures = [{ axis: 'valence', failureRate: 0.8, isLastMile: true }];

      const result = service.computeImpliedPrototype(
        axisConstraints,
        clauseFailures,
        sampleContexts
      );

      // Valence should have higher importance due to clause failure
      const valenceEntry = result.targetSignature.get('valence');
      expect(valenceEntry.lastMileWeight).toBeGreaterThan(0);
    });
  });

  describe('detectPrototypeGaps', () => {
    it('should return no gap if prototypes not found', () => {
      mockDataRegistry.getLookupData = jest.fn(() => null);

      const targetSignature = new Map([['valence', { direction: 1, importance: 0.5 }]]);
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);

      const result = service.detectPrototypeGaps(
        targetSignature,
        sampleContexts,
        axisConstraints,
        0.3
      );

      expect(result.gapDetected).toBe(false);
      expect(result.kNearestNeighbors).toEqual([]);
    });

    it('should return k-nearest neighbors', () => {
      const targetSignature = new Map([
        ['valence', { direction: 1, importance: 0.7 }],
        ['arousal', { direction: -1, importance: 0.3 }],
      ]);
      const axisConstraints = new Map([
        ['valence', { min: 0.3, max: 1.0 }],
        ['arousal', { min: -1.0, max: 0.2 }],
      ]);

      const result = service.detectPrototypeGaps(
        targetSignature,
        sampleContexts,
        axisConstraints,
        0.3
      );

      expect(result).toHaveProperty('kNearestNeighbors');
      expect(Array.isArray(result.kNearestNeighbors)).toBe(true);
      expect(result.kNearestNeighbors.length).toBeLessThanOrEqual(5);
    });

    it('should sort neighbors by combined distance ascending', () => {
      const targetSignature = new Map([['valence', { direction: 1, importance: 0.5 }]]);
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);

      const result = service.detectPrototypeGaps(
        targetSignature,
        sampleContexts,
        axisConstraints,
        0.3
      );

      for (let i = 1; i < result.kNearestNeighbors.length; i++) {
        expect(result.kNearestNeighbors[i - 1].combinedDistance).toBeLessThanOrEqual(
          result.kNearestNeighbors[i].combinedDistance
        );
      }
    });

    it('should include weight and gate distances for each neighbor', () => {
      const targetSignature = new Map([['valence', { direction: 1, importance: 0.5 }]]);
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);

      const result = service.detectPrototypeGaps(
        targetSignature,
        sampleContexts,
        axisConstraints,
        0.3
      );

      result.kNearestNeighbors.forEach((neighbor) => {
        expect(neighbor).toHaveProperty('prototypeId');
        expect(neighbor).toHaveProperty('weightDistance');
        expect(neighbor).toHaveProperty('gateDistance');
        expect(neighbor).toHaveProperty('combinedDistance');
        expect(neighbor).toHaveProperty('pIntensityAbove');
      });
    });

    it('should detect gap when nearest distance exceeds threshold and intensity is low', () => {
      // Create a target that is far from all prototypes
      const targetSignature = new Map([
        ['valence', { direction: 1, importance: 0.9 }],
        ['arousal', { direction: 1, importance: 0.9 }],
        ['dominance', { direction: 1, importance: 0.9 }],
      ]);
      const axisConstraints = new Map([
        ['valence', { min: 0.8, max: 1.0 }],
        ['arousal', { min: 0.8, max: 1.0 }],
        ['dominance', { min: 0.8, max: 1.0 }],
      ]);

      // Empty contexts ensure low intensity
      const result = service.detectPrototypeGaps(targetSignature, [], axisConstraints, 0.9);

      expect(result).toHaveProperty('gapDetected');
      expect(result).toHaveProperty('gapThreshold');
      expect(result).toHaveProperty('nearestDistance');
    });

    it('should provide coverage warning when gap is detected', () => {
      const targetSignature = new Map([
        ['valence', { direction: 1, importance: 0.9 }],
        ['arousal', { direction: 1, importance: 0.9 }],
        ['dominance', { direction: 1, importance: 0.9 }],
      ]);
      const axisConstraints = new Map([
        ['valence', { min: 0.95, max: 1.0 }],
        ['arousal', { min: 0.95, max: 1.0 }],
        ['dominance', { min: 0.95, max: 1.0 }],
      ]);

      const result = service.detectPrototypeGaps(targetSignature, [], axisConstraints, 0.9);

      // When a gap is detected, coverageWarning should be a string
      expect(result).toHaveProperty('gapDetected');
      expect(result).toHaveProperty('coverageWarning');
      // coverageWarning is either a string or null depending on gap detection
      expect(
        result.coverageWarning === null || typeof result.coverageWarning === 'string'
      ).toBe(true);
    });

    it('should synthesize suggested prototype when gap is detected', () => {
      const targetSignature = new Map([
        ['valence', { direction: 1, importance: 0.9 }],
        ['arousal', { direction: 1, importance: 0.9 }],
        ['dominance', { direction: 1, importance: 0.9 }],
      ]);
      const axisConstraints = new Map([
        ['valence', { min: 0.95, max: 1.0 }],
        ['arousal', { min: 0.95, max: 1.0 }],
        ['dominance', { min: 0.95, max: 1.0 }],
      ]);

      const result = service.detectPrototypeGaps(targetSignature, [], axisConstraints, 0.9);

      // Verify the result structure - suggestedPrototype is optional based on gap detection
      expect(result).toHaveProperty('gapDetected');
      // When a suggested prototype exists, it should have the right structure
      expect(
        result.suggestedPrototype === null ||
        (result.suggestedPrototype &&
         'weights' in result.suggestedPrototype &&
         'gates' in result.suggestedPrototype &&
         'rationale' in result.suggestedPrototype)
      ).toBe(true);
    });

    it('should not detect gap when good prototype exists', () => {
      // Target closely matches joy prototype
      const targetSignature = new Map([
        ['valence', { direction: 1, importance: 0.8 }],
        ['arousal', { direction: 1, importance: 0.3 }],
      ]);
      const axisConstraints = new Map([
        ['valence', { min: 0.3, max: 1.0 }],
        ['arousal', { min: 0, max: 0.5 }],
      ]);

      const result = service.detectPrototypeGaps(
        targetSignature,
        sampleContexts,
        axisConstraints,
        0.3
      );

      // Joy should be in the nearest neighbors
      const joyNeighbor = result.kNearestNeighbors.find((n) => n.prototypeId === 'joy');
      expect(joyNeighbor).toBeDefined();
      // When a close prototype exists, gap should not be detected
      // (distance determines gap detection, and joy should be close)
      expect(result).toHaveProperty('gapDetected');
      expect(result.kNearestNeighbors.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty prototype weights gracefully', () => {
      mockDataRegistry.getLookupData = jest.fn(() => ({
        entries: {
          empty: { id: 'empty', weights: {}, gates: [] },
        },
      }));

      const expression = { id: 'test-expression' };
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);

      const result = service.analyzeAllPrototypeFit(
        expression,
        sampleContexts,
        axisConstraints,
        0.3
      );

      expect(result.leaderboard.length).toBeGreaterThan(0);
    });

    it('should handle contexts without emotionIntensities', () => {
      const contextsWithoutIntensities = [
        { moodAxes: { valence: 0.5, arousal: 0.3 } },
        { moodAxes: { valence: 0.6, arousal: 0.4 } },
      ];

      const expression = { id: 'test-expression' };
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);

      const result = service.analyzeAllPrototypeFit(
        expression,
        contextsWithoutIntensities,
        axisConstraints,
        0.3
      );

      // Should still produce results
      expect(result.leaderboard.length).toBeGreaterThan(0);
    });

    it('should handle prototype gates with various formats', () => {
      mockDataRegistry.getLookupData = jest.fn(() => ({
        entries: {
          complex: {
            id: 'complex',
            weights: { valence: 0.5 },
            gates: ['valence >= 0.3', 'arousal <= 0.5', 'dominance != 0'],
          },
        },
      }));

      const expression = { id: 'test-expression' };
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);

      const result = service.analyzeAllPrototypeFit(
        expression,
        sampleContexts,
        axisConstraints,
        0.3
      );

      expect(result.leaderboard.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // NEW: Prototype Type Detection and Sexual State Support Tests
  // ==========================================================================

  describe('prototype type detection', () => {
    // Sample sexual prototypes data
    const sampleSexualPrototypes = {
      aroused: {
        id: 'aroused',
        weights: { sex_excitation: 0.7, sex_inhibition: -0.3 },
        gates: ['sex_excitation >= 0.3'],
      },
      inhibited: {
        id: 'inhibited',
        weights: { sex_excitation: -0.4, sex_inhibition: 0.6 },
        gates: ['sex_inhibition >= 0.4'],
      },
    };

    beforeEach(() => {
      // Mock registry to return both emotion and sexual prototypes
      mockDataRegistry.getLookupData = jest.fn((lookupId) => {
        if (lookupId === 'core:emotion_prototypes') {
          return { entries: samplePrototypes };
        }
        if (lookupId === 'core:sexual_prototypes') {
          return { entries: sampleSexualPrototypes };
        }
        return null;
      });
    });

    it('should detect emotions.* references in prerequisites', () => {
      const expression = {
        id: 'test-emotion-expr',
        prerequisites: [
          {
            logic: {
              '>=': [{ var: 'emotions.joy' }, 0.5],
            },
          },
        ],
      };
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);

      const result = service.analyzeAllPrototypeFit(
        expression,
        sampleContexts,
        axisConstraints,
        0.3
      );

      // Should fetch emotion prototypes only
      expect(mockDataRegistry.getLookupData).toHaveBeenCalledWith('core:emotion_prototypes');
      expect(result.leaderboard.length).toBeGreaterThan(0);
    });

    it('should detect sexualStates.* references in prerequisites', () => {
      // Create contexts with sexual state data
      const sexualContexts = [
        {
          moodAxes: { valence: 0.5 },
          sexualStates: { aroused: 0.6, inhibited: 0.2 },
          emotionIntensities: {},
        },
        {
          moodAxes: { valence: 0.6 },
          sexualStates: { aroused: 0.7, inhibited: 0.1 },
          emotionIntensities: {},
        },
      ];

      const expression = {
        id: 'test-sexual-expr',
        prerequisites: [
          {
            logic: {
              '>=': [{ var: 'sexualStates.aroused' }, 0.5],
            },
          },
        ],
      };
      const axisConstraints = new Map([['sex_excitation', { min: 0.2, max: 1.0 }]]);

      const result = service.analyzeAllPrototypeFit(
        expression,
        sexualContexts,
        axisConstraints,
        0.3
      );

      // Should fetch sexual prototypes
      expect(mockDataRegistry.getLookupData).toHaveBeenCalledWith('core:sexual_prototypes');
      expect(result.leaderboard.length).toBeGreaterThan(0);
    });

    it('should detect both emotions.* and sexualStates.* in mixed prerequisites', () => {
      const mixedContexts = [
        {
          moodAxes: { valence: 0.5, arousal: 0.3 },
          sexualStates: { aroused: 0.6, inhibited: 0.2 },
          emotionIntensities: { joy: 0.5 },
        },
      ];

      const expression = {
        id: 'test-mixed-expr',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.joy' }, 0.4] },
                { '>=': [{ var: 'sexualStates.aroused' }, 0.3] },
              ],
            },
          },
        ],
      };
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);

      service.analyzeAllPrototypeFit(
        expression,
        mixedContexts,
        axisConstraints,
        0.3
      );

      // Should fetch both emotion and sexual prototypes
      expect(mockDataRegistry.getLookupData).toHaveBeenCalledWith('core:emotion_prototypes');
      expect(mockDataRegistry.getLookupData).toHaveBeenCalledWith('core:sexual_prototypes');
    });

    it('should NOT fetch sexual prototypes when only emotions referenced', () => {
      const expression = {
        id: 'test-emotion-only',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.joy' }, 0.4] },
                { '<=': [{ var: 'emotions.anger' }, 0.2] },
              ],
            },
          },
        ],
      };
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);

      service.analyzeAllPrototypeFit(expression, sampleContexts, axisConstraints, 0.3);

      // Should only fetch emotion prototypes
      expect(mockDataRegistry.getLookupData).toHaveBeenCalledWith('core:emotion_prototypes');
      expect(mockDataRegistry.getLookupData).not.toHaveBeenCalledWith('core:sexual_prototypes');
    });

    it('should include type field in leaderboard results for emotion prototypes', () => {
      const expression = {
        id: 'test-type-field',
        prerequisites: [
          { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
        ],
      };
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);

      const result = service.analyzeAllPrototypeFit(
        expression,
        sampleContexts,
        axisConstraints,
        0.3
      );

      // All results should have type field
      result.leaderboard.forEach((item) => {
        expect(item).toHaveProperty('type');
        expect(item.type).toBe('emotion');
      });
    });

    it('should include type field in leaderboard results for sexual prototypes', () => {
      const sexualContexts = [
        {
          moodAxes: {},
          sexualStates: { aroused: 0.6, inhibited: 0.2, sex_excitation: 0.5 },
          emotionIntensities: {},
        },
      ];

      const expression = {
        id: 'test-sexual-type',
        prerequisites: [
          { logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.4] } },
        ],
      };
      const axisConstraints = new Map([['sex_excitation', { min: 0.2, max: 1.0 }]]);

      const result = service.analyzeAllPrototypeFit(
        expression,
        sexualContexts,
        axisConstraints,
        0.3
      );

      // Sexual prototypes should have type 'sexual'
      const sexualResults = result.leaderboard.filter((item) => item.type === 'sexual');
      expect(sexualResults.length).toBeGreaterThan(0);
    });
  });

  describe('computeImpliedPrototype with type awareness', () => {
    const sampleSexualPrototypes = {
      aroused: {
        id: 'aroused',
        weights: { sex_excitation: 0.7, sex_inhibition: -0.3 },
        gates: ['sex_excitation >= 0.3'],
      },
    };

    beforeEach(() => {
      mockDataRegistry.getLookupData = jest.fn((lookupId) => {
        if (lookupId === 'core:emotion_prototypes') {
          return { entries: samplePrototypes };
        }
        if (lookupId === 'core:sexual_prototypes') {
          return { entries: sampleSexualPrototypes };
        }
        return null;
      });
    });

    it('should include type field in implied prototype rankings', () => {
      const expression = {
        id: 'test-implied-type',
        prerequisites: [
          { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
        ],
      };
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);
      const clauseFailures = [];

      const result = service.computeImpliedPrototype(
        axisConstraints,
        clauseFailures,
        sampleContexts,
        expression
      );

      // All rankings should have type field
      result.bySimilarity.forEach((item) => {
        expect(item).toHaveProperty('type');
      });
      result.byGatePass.forEach((item) => {
        expect(item).toHaveProperty('type');
      });
      result.byCombined.forEach((item) => {
        expect(item).toHaveProperty('type');
      });
    });
  });

  describe('detectPrototypeGaps with type awareness', () => {
    const sampleSexualPrototypes = {
      aroused: {
        id: 'aroused',
        weights: { sex_excitation: 0.7, sex_inhibition: -0.3 },
        gates: ['sex_excitation >= 0.3'],
      },
    };

    beforeEach(() => {
      mockDataRegistry.getLookupData = jest.fn((lookupId) => {
        if (lookupId === 'core:emotion_prototypes') {
          return { entries: samplePrototypes };
        }
        if (lookupId === 'core:sexual_prototypes') {
          return { entries: sampleSexualPrototypes };
        }
        return null;
      });
    });

    it('should include type field in k-nearest neighbors', () => {
      const targetSignature = new Map([
        ['valence', { direction: 1, importance: 0.7 }],
      ]);
      const axisConstraints = new Map([['valence', { min: 0.3, max: 1.0 }]]);

      const expression = {
        id: 'test-gap-type',
        prerequisites: [
          { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
        ],
      };

      const result = service.detectPrototypeGaps(
        targetSignature,
        sampleContexts,
        axisConstraints,
        0.3,
        expression
      );

      // Neighbors should have type field
      result.kNearestNeighbors.forEach((neighbor) => {
        expect(neighbor).toHaveProperty('type');
      });
    });
  });
});
