/**
 * @file Unit tests for PrototypeEvaluator.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PrototypeEvaluator from '../../../../../src/expressionDiagnostics/services/simulatorCore/PrototypeEvaluator.js';

const buildDataRegistry = (emotionEntries, sexualEntries) => ({
  get: jest.fn((category, lookupId) => {
    if (category !== 'lookups') {
      return null;
    }
    if (lookupId === 'core:emotion_prototypes') {
      return emotionEntries ? { entries: emotionEntries } : null;
    }
    if (lookupId === 'core:sexual_prototypes') {
      return sexualEntries ? { entries: sexualEntries } : null;
    }
    return null;
  }),
});

describe('PrototypeEvaluator', () => {
  let mockLogger;
  let mockDataRegistry;
  let evaluator;

  const defaultEmotionPrototypes = {
    joy: { weights: { valence: 1.0 }, gates: ['valence >= 0.25'] },
    trust: { weights: { valence: 0.5, agency_control: 0.5 }, gates: [] },
    serenity: { weights: { valence: 1.0 }, gates: ['valence >= 0.6'] },
  };

  const defaultSexualPrototypes = {
    aroused: {
      weights: { sex_excitation: 1.0 },
      gates: ['sex_excitation >= 0.5'],
    },
  };

  beforeEach(() => {
    mockLogger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    mockDataRegistry = buildDataRegistry(
      defaultEmotionPrototypes,
      defaultSexualPrototypes
    );

    evaluator = new PrototypeEvaluator({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
    });
  });

  describe('constructor', () => {
    it('should validate required dependencies', () => {
      expect(() => new PrototypeEvaluator({})).toThrow();
    });

    it('should throw when logger is missing required methods', () => {
      expect(
        () =>
          new PrototypeEvaluator({
            logger: { debug: jest.fn() },
            dataRegistry: mockDataRegistry,
          })
      ).toThrow();
    });

    it('should throw when dataRegistry is missing required methods', () => {
      expect(
        () =>
          new PrototypeEvaluator({
            logger: mockLogger,
            dataRegistry: {},
          })
      ).toThrow();
    });

    it('should accept valid dependencies', () => {
      expect(
        () =>
          new PrototypeEvaluator({
            logger: mockLogger,
            dataRegistry: mockDataRegistry,
          })
      ).not.toThrow();
    });
  });

  describe('getPrototype', () => {
    it('should retrieve emotion prototypes from data registry', () => {
      const result = evaluator.getPrototype('joy', 'emotion');
      expect(result).toEqual(defaultEmotionPrototypes.joy);
      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'lookups',
        'core:emotion_prototypes'
      );
    });

    it('should retrieve sexual prototypes from data registry', () => {
      const result = evaluator.getPrototype('aroused', 'sexual');
      expect(result).toEqual(defaultSexualPrototypes.aroused);
      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'lookups',
        'core:sexual_prototypes'
      );
    });

    it('should return null for missing prototype', () => {
      const result = evaluator.getPrototype('nonexistent', 'emotion');
      expect(result).toBeNull();
    });

    it('should return null when lookup is missing', () => {
      const emptyRegistry = buildDataRegistry(null, null);
      const emptyEvaluator = new PrototypeEvaluator({
        logger: mockLogger,
        dataRegistry: emptyRegistry,
      });
      const result = emptyEvaluator.getPrototype('joy', 'emotion');
      expect(result).toBeNull();
    });
  });

  describe('extractPrototypeReferences', () => {
    it('should extract emotion prototype references from prerequisites', () => {
      const prerequisites = [
        { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
        { logic: { '>=': [{ var: 'emotions.trust' }, 0.3] } },
      ];
      const result = evaluator.extractPrototypeReferences(prerequisites);
      expect(result.emotions).toContain('joy');
      expect(result.emotions).toContain('trust');
      expect(result.sexualStates).toHaveLength(0);
    });

    it('should extract sexual prototype references from prerequisites', () => {
      const prerequisites = [
        { logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.5] } },
      ];
      const result = evaluator.extractPrototypeReferences(prerequisites);
      expect(result.sexualStates).toContain('aroused');
      expect(result.emotions).toHaveLength(0);
    });

    it('should deduplicate prototype references', () => {
      const prerequisites = [
        { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
        { logic: { '>=': [{ var: 'emotions.joy' }, 0.3] } },
      ];
      const result = evaluator.extractPrototypeReferences(prerequisites);
      expect(result.emotions).toHaveLength(1);
      expect(result.emotions[0]).toBe('joy');
    });

    it('should return empty arrays for non-array prerequisites', () => {
      const result = evaluator.extractPrototypeReferences(null);
      expect(result.emotions).toHaveLength(0);
      expect(result.sexualStates).toHaveLength(0);
    });

    it('should return empty arrays for empty prerequisites', () => {
      const result = evaluator.extractPrototypeReferences([]);
      expect(result.emotions).toHaveLength(0);
      expect(result.sexualStates).toHaveLength(0);
    });
  });

  describe('collectPrototypeReferencesFromLogic', () => {
    it('should extract prototype IDs from comparison logic', () => {
      const emotions = new Set();
      const sexualStates = new Set();
      const logic = { '>=': [{ var: 'emotions.joy' }, 0.5] };

      evaluator.collectPrototypeReferencesFromLogic(
        logic,
        emotions,
        sexualStates
      );

      expect([...emotions]).toContain('joy');
    });

    it('should recurse into and clauses', () => {
      const emotions = new Set();
      const sexualStates = new Set();
      const logic = {
        and: [
          { '>=': [{ var: 'emotions.joy' }, 0.5] },
          { '>=': [{ var: 'emotions.trust' }, 0.3] },
        ],
      };

      evaluator.collectPrototypeReferencesFromLogic(
        logic,
        emotions,
        sexualStates
      );

      expect([...emotions]).toContain('joy');
      expect([...emotions]).toContain('trust');
    });

    it('should recurse into or clauses', () => {
      const emotions = new Set();
      const sexualStates = new Set();
      const logic = {
        or: [
          { '>=': [{ var: 'emotions.joy' }, 0.5] },
          { '>=': [{ var: 'sexualStates.aroused' }, 0.3] },
        ],
      };

      evaluator.collectPrototypeReferencesFromLogic(
        logic,
        emotions,
        sexualStates
      );

      expect([...emotions]).toContain('joy');
      expect([...sexualStates]).toContain('aroused');
    });

    it('should handle all comparison operators', () => {
      const operators = ['>=', '<=', '>', '<', '=='];
      for (const op of operators) {
        const emotions = new Set();
        const sexualStates = new Set();
        const logic = { [op]: [{ var: 'emotions.test' }, 0.5] };

        evaluator.collectPrototypeReferencesFromLogic(
          logic,
          emotions,
          sexualStates
        );

        expect([...emotions]).toContain('test');
      }
    });

    it('should handle null or invalid logic gracefully', () => {
      const emotions = new Set();
      const sexualStates = new Set();

      expect(() =>
        evaluator.collectPrototypeReferencesFromLogic(null, emotions, sexualStates)
      ).not.toThrow();
      expect(() =>
        evaluator.collectPrototypeReferencesFromLogic(
          undefined,
          emotions,
          sexualStates
        )
      ).not.toThrow();
      expect(() =>
        evaluator.collectPrototypeReferencesFromLogic(
          'not an object',
          emotions,
          sexualStates
        )
      ).not.toThrow();
    });
  });

  describe('preparePrototypeEvaluationTargets', () => {
    it('should resolve prototypes and build targets array', () => {
      const prerequisites = [
        { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
      ];
      const result = evaluator.preparePrototypeEvaluationTargets(prerequisites);

      expect(result.emotions).toHaveLength(1);
      expect(result.emotions[0].prototypeId).toBe('joy');
      expect(result.emotions[0].weights).toEqual({ valence: 1.0 });
      expect(result.emotions[0].gates).toEqual(['valence >= 0.25']);
    });

    it('should log warning and skip missing prototypes', () => {
      const prerequisites = [
        { logic: { '>=': [{ var: 'emotions.nonexistent' }, 0.5] } },
      ];
      const result = evaluator.preparePrototypeEvaluationTargets(prerequisites);

      expect(result.emotions).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle prototypes without gates', () => {
      const prerequisites = [
        { logic: { '>=': [{ var: 'emotions.trust' }, 0.5] } },
      ];
      const result = evaluator.preparePrototypeEvaluationTargets(prerequisites);

      expect(result.emotions[0].gates).toEqual([]);
    });

    it('should handle sexual prototype targets', () => {
      const prerequisites = [
        { logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.5] } },
      ];
      const result = evaluator.preparePrototypeEvaluationTargets(prerequisites);

      expect(result.sexualStates).toHaveLength(1);
      expect(result.sexualStates[0].prototypeId).toBe('aroused');
    });
  });

  describe('initializePrototypeEvaluationSummary', () => {
    it('should return null for null targets', () => {
      const result = evaluator.initializePrototypeEvaluationSummary(null);
      expect(result).toBeNull();
    });

    it('should return null for empty targets', () => {
      const result = evaluator.initializePrototypeEvaluationSummary({
        emotions: [],
        sexualStates: [],
      });
      expect(result).toBeNull();
    });

    it('should create summary with emotion entries', () => {
      const targets = {
        emotions: [{ prototypeId: 'joy' }, { prototypeId: 'trust' }],
        sexualStates: [],
      };
      const result = evaluator.initializePrototypeEvaluationSummary(targets);

      expect(result.emotions.joy).toBeDefined();
      expect(result.emotions.trust).toBeDefined();
      expect(result.emotions.joy.moodSampleCount).toBe(0);
    });

    it('should create summary with sexual entries', () => {
      const targets = {
        emotions: [],
        sexualStates: [{ prototypeId: 'aroused' }],
      };
      const result = evaluator.initializePrototypeEvaluationSummary(targets);

      expect(result.sexualStates.aroused).toBeDefined();
      expect(result.sexualStates.aroused.moodSampleCount).toBe(0);
    });
  });

  describe('createPrototypeEvaluationStats', () => {
    it('should create stats object with all required fields', () => {
      const stats = evaluator.createPrototypeEvaluationStats();

      expect(stats).toHaveProperty('moodSampleCount', 0);
      expect(stats).toHaveProperty('gatePassCount', 0);
      expect(stats).toHaveProperty('gateFailCount', 0);
      expect(stats).toHaveProperty('failedGateCounts');
      expect(stats.failedGateCounts).toEqual({});
      expect(stats).toHaveProperty('rawScoreSum', 0);
      expect(stats).toHaveProperty('valueSum', 0);
      expect(stats).toHaveProperty('valueSumGivenGate', 0);
    });
  });

  describe('evaluatePrototypeSample', () => {
    it('should compute fit score from weights and axes', () => {
      const target = {
        prototypeId: 'joy',
        weights: { valence: 1.0 },
        gates: [],
      };
      const normalizedMood = { valence: 0.8 };

      const result = evaluator.evaluatePrototypeSample(
        target,
        normalizedMood,
        {},
        {}
      );

      expect(result.rawScore).toBeCloseTo(0.8, 5);
      expect(result.rawValue).toBeCloseTo(0.8, 5);
      expect(result.gatePass).toBe(true);
      expect(result.value).toBeCloseTo(0.8, 5);
    });

    it('should evaluate gates and return failedGates array', () => {
      const target = {
        prototypeId: 'joy',
        weights: { valence: 1.0 },
        gates: ['valence >= 0.5'],
      };
      const normalizedMood = { valence: 0.3 };

      const result = evaluator.evaluatePrototypeSample(
        target,
        normalizedMood,
        {},
        {}
      );

      expect(result.gatePass).toBe(false);
      expect(result.failedGates).toContain('valence >= 0.5');
      expect(result.value).toBe(0);
    });

    it('should clamp raw score to [0,1]', () => {
      const target = {
        prototypeId: 'test',
        weights: { valence: 1.0 },
        gates: [],
      };
      const normalizedMood = { valence: 1.5 };

      const result = evaluator.evaluatePrototypeSample(
        target,
        normalizedMood,
        {},
        {}
      );

      expect(result.rawValue).toBe(1);
    });

    it('should handle negative raw scores', () => {
      const target = {
        prototypeId: 'test',
        weights: { valence: 1.0 },
        gates: [],
      };
      const normalizedMood = { valence: -0.5 };

      const result = evaluator.evaluatePrototypeSample(
        target,
        normalizedMood,
        {},
        {}
      );

      expect(result.rawValue).toBe(0);
    });

    it('should handle missing weights', () => {
      const target = {
        prototypeId: 'test',
        weights: null,
        gates: [],
      };

      const result = evaluator.evaluatePrototypeSample(target, {}, {}, {});

      expect(result.rawScore).toBe(0);
      expect(result.value).toBe(0);
    });

    it('should handle sexual axes', () => {
      const target = {
        prototypeId: 'aroused',
        weights: { sex_excitation: 1.0 },
        gates: [],
      };
      const normalizedSexual = { sex_excitation: 0.7 };

      const result = evaluator.evaluatePrototypeSample(
        target,
        {},
        normalizedSexual,
        {}
      );

      expect(result.rawScore).toBeCloseTo(0.7, 5);
    });

    it('should handle trait axes', () => {
      const target = {
        prototypeId: 'test',
        weights: { affective_empathy: 1.0 },
        gates: [],
      };
      const normalizedTraits = { affective_empathy: 0.6 };

      const result = evaluator.evaluatePrototypeSample(
        target,
        {},
        {},
        normalizedTraits
      );

      expect(result.rawScore).toBeCloseTo(0.6, 5);
    });

    it('should skip invalid gate strings', () => {
      const target = {
        prototypeId: 'test',
        weights: { valence: 1.0 },
        gates: ['invalid gate format', 'valence >= 0.5'],
      };
      const normalizedMood = { valence: 0.7 };

      const result = evaluator.evaluatePrototypeSample(
        target,
        normalizedMood,
        {},
        {}
      );

      // Should only evaluate valid gates
      expect(result.gatePass).toBe(true);
      expect(result.failedGates).toHaveLength(0);
    });
  });

  describe('recordPrototypeEvaluation', () => {
    it('should accumulate stats correctly for gate pass', () => {
      const stats = evaluator.createPrototypeEvaluationStats();
      const evaluation = {
        gatePass: true,
        failedGates: [],
        rawScore: 0.8,
        rawValue: 0.8,
        value: 0.8,
      };

      evaluator.recordPrototypeEvaluation(stats, evaluation);

      expect(stats.moodSampleCount).toBe(1);
      expect(stats.gatePassCount).toBe(1);
      expect(stats.gateFailCount).toBe(0);
      expect(stats.rawScoreSum).toBe(0.8);
      expect(stats.valueSum).toBe(0.8);
      expect(stats.valueSumGivenGate).toBe(0.8);
    });

    it('should accumulate stats correctly for gate fail', () => {
      const stats = evaluator.createPrototypeEvaluationStats();
      const evaluation = {
        gatePass: false,
        failedGates: ['valence >= 0.5'],
        rawScore: 0.3,
        rawValue: 0.3,
        value: 0,
      };

      evaluator.recordPrototypeEvaluation(stats, evaluation);

      expect(stats.moodSampleCount).toBe(1);
      expect(stats.gatePassCount).toBe(0);
      expect(stats.gateFailCount).toBe(1);
      expect(stats.rawScoreSum).toBe(0.3);
      expect(stats.valueSum).toBe(0);
      expect(stats.valueSumGivenGate).toBe(0);
    });

    it('should track failed gates by name', () => {
      const stats = evaluator.createPrototypeEvaluationStats();
      const evaluation1 = {
        gatePass: false,
        failedGates: ['valence >= 0.5'],
        rawScore: 0.3,
        rawValue: 0.3,
        value: 0,
      };
      const evaluation2 = {
        gatePass: false,
        failedGates: ['valence >= 0.5', 'threat <= 0.2'],
        rawScore: 0.2,
        rawValue: 0.2,
        value: 0,
      };

      evaluator.recordPrototypeEvaluation(stats, evaluation1);
      evaluator.recordPrototypeEvaluation(stats, evaluation2);

      expect(stats.failedGateCounts['valence >= 0.5']).toBe(2);
      expect(stats.failedGateCounts['threat <= 0.2']).toBe(1);
    });

    it('should handle null stats gracefully', () => {
      const evaluation = { gatePass: true, failedGates: [], value: 0.5 };
      expect(() =>
        evaluator.recordPrototypeEvaluation(null, evaluation)
      ).not.toThrow();
    });

    it('should handle null evaluation gracefully', () => {
      const stats = evaluator.createPrototypeEvaluationStats();
      expect(() =>
        evaluator.recordPrototypeEvaluation(stats, null)
      ).not.toThrow();
      expect(stats.moodSampleCount).toBe(0);
    });
  });

  describe('updatePrototypeEvaluationSummary', () => {
    it('should update summary for all emotion targets', () => {
      const targets = {
        emotions: [
          { prototypeId: 'joy', weights: { valence: 1.0 }, gates: [] },
        ],
        sexualStates: [],
      };
      const summary = evaluator.initializePrototypeEvaluationSummary(targets);
      const normalizedMood = { valence: 0.7 };

      evaluator.updatePrototypeEvaluationSummary(
        summary,
        targets,
        normalizedMood,
        {},
        {}
      );

      expect(summary.emotions.joy.moodSampleCount).toBe(1);
      expect(summary.emotions.joy.valueSum).toBeCloseTo(0.7, 5);
    });

    it('should update summary for all sexual targets', () => {
      const targets = {
        emotions: [],
        sexualStates: [
          { prototypeId: 'aroused', weights: { sex_excitation: 1.0 }, gates: [] },
        ],
      };
      const summary = evaluator.initializePrototypeEvaluationSummary(targets);
      const normalizedSexual = { sex_excitation: 0.6 };

      evaluator.updatePrototypeEvaluationSummary(
        summary,
        targets,
        {},
        normalizedSexual,
        {}
      );

      expect(summary.sexualStates.aroused.moodSampleCount).toBe(1);
      expect(summary.sexualStates.aroused.valueSum).toBeCloseTo(0.6, 5);
    });

    it('should skip if summary is null', () => {
      const targets = {
        emotions: [{ prototypeId: 'joy' }],
        sexualStates: [],
      };

      expect(() =>
        evaluator.updatePrototypeEvaluationSummary(null, targets, {}, {}, {})
      ).not.toThrow();
    });

    it('should skip if targets is null', () => {
      const summary = { emotions: {}, sexualStates: {} };

      expect(() =>
        evaluator.updatePrototypeEvaluationSummary(summary, null, {}, {}, {})
      ).not.toThrow();
    });

    it('should skip missing prototype stats in summary', () => {
      const targets = {
        emotions: [
          { prototypeId: 'joy', weights: { valence: 1.0 }, gates: [] },
        ],
        sexualStates: [],
      };
      const summary = { emotions: {}, sexualStates: {} }; // Missing joy stats

      expect(() =>
        evaluator.updatePrototypeEvaluationSummary(
          summary,
          targets,
          { valence: 0.7 },
          {},
          {}
        )
      ).not.toThrow();
    });
  });
});
