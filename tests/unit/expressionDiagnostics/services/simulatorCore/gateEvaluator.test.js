/**
 * @file Unit tests for GateEvaluator.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GateEvaluator from '../../../../../src/expressionDiagnostics/services/simulatorCore/GateEvaluator.js';
import AxisInterval from '../../../../../src/expressionDiagnostics/models/AxisInterval.js';

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

const buildContextBuilder = () => ({
  normalizeGateContext: jest.fn((context, usePrevious) => ({
    moodAxes: { valence: usePrevious ? 0.2 : 0.5 },
    sexualAxes: { sex_excitation: 0.3 },
    traitAxes: { affective_empathy: 0.6 },
  })),
});

describe('GateEvaluator', () => {
  let mockLogger;
  let mockDataRegistry;
  let mockContextBuilder;
  let gateEvaluator;

  beforeEach(() => {
    mockLogger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    mockDataRegistry = buildDataRegistry(
      {
        joy: { weights: { valence: 1 }, gates: ['valence >= 0.3'] },
        serenity: { weights: { valence: 1 }, gates: [] },
        panic: { weights: { threat: 1 }, gates: ['threat >= 0.8'] },
      },
      {
        aroused: {
          weights: { sex_excitation: 1 },
          gates: ['sex_excitation >= 0.5'],
        },
      }
    );
    mockContextBuilder = buildContextBuilder();

    gateEvaluator = new GateEvaluator({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
      contextBuilder: mockContextBuilder,
    });
  });

  describe('constructor', () => {
    it('should validate required dependencies', () => {
      expect(() => new GateEvaluator({})).toThrow();
      expect(
        () => new GateEvaluator({ logger: mockLogger, dataRegistry: {} })
      ).toThrow();
    });

    it('should accept valid dependencies', () => {
      expect(
        () =>
          new GateEvaluator({
            logger: mockLogger,
            dataRegistry: mockDataRegistry,
            contextBuilder: mockContextBuilder,
          })
      ).not.toThrow();
    });
  });

  describe('checkGates', () => {
    it('should return true when gates array is empty', () => {
      expect(gateEvaluator.checkGates([], {})).toBe(true);
    });

    it('should return true when gates is null or undefined', () => {
      expect(gateEvaluator.checkGates(null, {})).toBe(true);
      expect(gateEvaluator.checkGates(undefined, {})).toBe(true);
    });

    it('should return true when all gates pass', () => {
      const gates = ['valence >= 0.3'];
      const normalizedAxes = { valence: 0.5 };
      expect(gateEvaluator.checkGates(gates, normalizedAxes)).toBe(true);
    });

    it('should return false when a gate fails', () => {
      const gates = ['valence >= 0.8'];
      const normalizedAxes = { valence: 0.5 };
      expect(gateEvaluator.checkGates(gates, normalizedAxes)).toBe(false);
    });

    it('should skip gates with unparseable constraints', () => {
      const gates = ['invalid gate string', 'valence >= 0.3'];
      const normalizedAxes = { valence: 0.5 };
      expect(gateEvaluator.checkGates(gates, normalizedAxes)).toBe(true);
    });

    it('should skip gates with undefined axis values', () => {
      const gates = ['threat >= 0.3'];
      const normalizedAxes = { valence: 0.5 };
      expect(gateEvaluator.checkGates(gates, normalizedAxes)).toBe(true);
    });
  });

  describe('resolveGateTarget', () => {
    it('should return null for invalid input', () => {
      expect(gateEvaluator.resolveGateTarget(null)).toBeNull();
      expect(gateEvaluator.resolveGateTarget(undefined)).toBeNull();
      expect(gateEvaluator.resolveGateTarget(123)).toBeNull();
      expect(gateEvaluator.resolveGateTarget('')).toBeNull();
    });

    it('should parse emotions path correctly', () => {
      const result = gateEvaluator.resolveGateTarget('emotions.joy');
      expect(result).toEqual({
        prototypeId: 'joy',
        usePrevious: false,
        type: 'emotion',
      });
    });

    it('should parse previousEmotions path correctly', () => {
      const result = gateEvaluator.resolveGateTarget('previousEmotions.joy');
      expect(result).toEqual({
        prototypeId: 'joy',
        usePrevious: true,
        type: 'emotion',
      });
    });

    it('should parse sexualStates path correctly', () => {
      const result = gateEvaluator.resolveGateTarget('sexualStates.aroused');
      expect(result).toEqual({
        prototypeId: 'aroused',
        usePrevious: false,
        type: 'sexual',
      });
    });

    it('should parse previousSexualStates path correctly', () => {
      const result = gateEvaluator.resolveGateTarget(
        'previousSexualStates.aroused'
      );
      expect(result).toEqual({
        prototypeId: 'aroused',
        usePrevious: true,
        type: 'sexual',
      });
    });

    it('should return null for unrecognized paths', () => {
      expect(gateEvaluator.resolveGateTarget('moodAxes.valence')).toBeNull();
      expect(gateEvaluator.resolveGateTarget('unknown.path')).toBeNull();
    });
  });

  describe('resolveGateContext', () => {
    it('should return null when context is null', () => {
      expect(gateEvaluator.resolveGateContext({}, null, false)).toBeNull();
    });

    it('should call contextBuilder.normalizeGateContext when no cache', () => {
      const context = { moodAxes: { valence: 50 } };
      const result = gateEvaluator.resolveGateContext(null, context, false);

      expect(mockContextBuilder.normalizeGateContext).toHaveBeenCalledWith(
        context,
        false
      );
      expect(result).toHaveProperty('moodAxes');
    });

    it('should use cache for current context', () => {
      const context = { moodAxes: { valence: 50 } };
      const cache = {};

      const result1 = gateEvaluator.resolveGateContext(cache, context, false);
      const result2 = gateEvaluator.resolveGateContext(cache, context, false);

      expect(mockContextBuilder.normalizeGateContext).toHaveBeenCalledTimes(1);
      expect(result1).toBe(result2);
      expect(cache.current).toBeDefined();
    });

    it('should use cache for previous context', () => {
      const context = { previousMoodAxes: { valence: 30 } };
      const cache = {};

      const result1 = gateEvaluator.resolveGateContext(cache, context, true);
      const result2 = gateEvaluator.resolveGateContext(cache, context, true);

      expect(mockContextBuilder.normalizeGateContext).toHaveBeenCalledTimes(1);
      expect(mockContextBuilder.normalizeGateContext).toHaveBeenCalledWith(
        context,
        true
      );
      expect(result1).toBe(result2);
      expect(cache.previous).toBeDefined();
    });

    it('should separate current and previous cache entries', () => {
      const context = { moodAxes: { valence: 50 } };
      const cache = {};

      gateEvaluator.resolveGateContext(cache, context, false);
      gateEvaluator.resolveGateContext(cache, context, true);

      expect(mockContextBuilder.normalizeGateContext).toHaveBeenCalledTimes(2);
      expect(cache.current).toBeDefined();
      expect(cache.previous).toBeDefined();
    });
  });

  describe('evaluateGatePass', () => {
    it('should return true when gates array is empty', () => {
      const normalized = { moodAxes: {}, sexualAxes: {}, traitAxes: {} };
      expect(gateEvaluator.evaluateGatePass([], normalized)).toBe(true);
    });

    it('should return true when gates is null or undefined', () => {
      const normalized = { moodAxes: {}, sexualAxes: {}, traitAxes: {} };
      expect(gateEvaluator.evaluateGatePass(null, normalized)).toBe(true);
      expect(gateEvaluator.evaluateGatePass(undefined, normalized)).toBe(true);
    });

    it('should evaluate gate against resolved axis value', () => {
      const gates = ['valence >= 0.3'];
      const normalized = {
        moodAxes: { valence: 0.5 },
        sexualAxes: {},
        traitAxes: {},
      };
      expect(gateEvaluator.evaluateGatePass(gates, normalized)).toBe(true);
    });

    it('should return false when gate fails', () => {
      const gates = ['valence >= 0.8'];
      const normalized = {
        moodAxes: { valence: 0.3 },
        sexualAxes: {},
        traitAxes: {},
      };
      expect(gateEvaluator.evaluateGatePass(gates, normalized)).toBe(false);
    });

    it('should skip unparseable gate constraints', () => {
      const gates = ['invalid gate'];
      const normalized = {
        moodAxes: { valence: 0.5 },
        sexualAxes: {},
        traitAxes: {},
      };
      expect(gateEvaluator.evaluateGatePass(gates, normalized)).toBe(true);
    });
  });

  describe('denormalizeGateThreshold', () => {
    it('should scale mood axis values by 100', () => {
      expect(gateEvaluator.denormalizeGateThreshold('valence', 0.5)).toBe(50);
      expect(gateEvaluator.denormalizeGateThreshold('threat', 0.8)).toBe(80);
    });

    it('should scale affect trait values by 100', () => {
      expect(
        gateEvaluator.denormalizeGateThreshold('affective_empathy', 0.6)
      ).toBe(60);
    });

    it('should scale sexual axis values by 100', () => {
      expect(
        gateEvaluator.denormalizeGateThreshold('sex_excitation', 0.4)
      ).toBe(40);
    });

    it('should scale derived axis (sexual_arousal) by 1', () => {
      expect(gateEvaluator.denormalizeGateThreshold('sexual_arousal', 0.7)).toBe(
        0.7
      );
    });

    it('should return null for unknown axis', () => {
      expect(gateEvaluator.denormalizeGateThreshold('unknown_axis', 0.5)).toBe(
        null
      );
    });
  });

  describe('buildAxisIntervalsFromMoodConstraints', () => {
    it('should return empty map when constraints is null or empty', () => {
      expect(
        gateEvaluator.buildAxisIntervalsFromMoodConstraints(null).size
      ).toBe(0);
      expect(
        gateEvaluator.buildAxisIntervalsFromMoodConstraints([]).size
      ).toBe(0);
    });

    it('should create interval for single constraint', () => {
      const constraints = [
        { varPath: 'moodAxes.valence', operator: '>=', threshold: 50 },
      ];
      const intervals =
        gateEvaluator.buildAxisIntervalsFromMoodConstraints(constraints);

      expect(intervals.has('valence')).toBe(true);
      const interval = intervals.get('valence');
      expect(interval.min).toBe(0.5);
    });

    it('should handle mood. prefix in varPath', () => {
      const constraints = [
        { varPath: 'mood.threat', operator: '<=', threshold: 30 },
      ];
      const intervals =
        gateEvaluator.buildAxisIntervalsFromMoodConstraints(constraints);

      expect(intervals.has('threat')).toBe(true);
    });

    it('should accumulate multiple constraints on same axis', () => {
      const constraints = [
        { varPath: 'moodAxes.valence', operator: '>=', threshold: 20 },
        { varPath: 'moodAxes.valence', operator: '<=', threshold: 80 },
      ];
      const intervals =
        gateEvaluator.buildAxisIntervalsFromMoodConstraints(constraints);

      const interval = intervals.get('valence');
      expect(interval.min).toBe(0.2);
      expect(interval.max).toBe(0.8);
    });
  });

  describe('checkPrototypeCompatibility', () => {
    it('should return incompatible for unknown prototype', () => {
      const result = gateEvaluator.checkPrototypeCompatibility(
        'nonexistent',
        'emotion',
        new Map()
      );
      expect(result.compatible).toBe(false);
      expect(result.reason).toBe('prototype not found');
    });

    it('should return compatible for prototype without gates', () => {
      const result = gateEvaluator.checkPrototypeCompatibility(
        'serenity',
        'emotion',
        new Map()
      );
      expect(result.compatible).toBe(true);
      expect(result.reason).toBeNull();
    });

    it('should return compatible when gates are satisfiable', () => {
      const intervals = new Map();
      // Create a real AxisInterval with range [0.4, 1]
      const valenceInterval = AxisInterval.forMoodAxis().applyConstraint(
        '>=',
        0.4
      );
      intervals.set('valence', valenceInterval);

      // joy has gate 'valence >= 0.3', which is compatible with [0.4, 1]
      const result = gateEvaluator.checkPrototypeCompatibility(
        'joy',
        'emotion',
        intervals
      );
      expect(result.compatible).toBe(true);
    });

    it('should return incompatible when gate conflicts with interval', () => {
      const intervals = new Map();
      // Create a real AxisInterval with max 0.5
      // panic has gate 'threat >= 0.8', but interval max is 0.5
      const threatInterval = AxisInterval.forMoodAxis()
        .applyConstraint('>=', 0)
        .applyConstraint('<=', 0.5);
      intervals.set('threat', threatInterval);

      // The check should fail because gate requires threat >= 0.8 but interval max is 0.5
      const result = gateEvaluator.checkPrototypeCompatibility(
        'panic',
        'emotion',
        intervals
      );
      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('conflicts');
    });
  });

  describe('computeGateCompatibility', () => {
    it('should compute compatibility for all referenced prototypes', () => {
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
          { logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.4] } },
        ],
      };
      const moodConstraints = [];
      const extractRefsFn = jest.fn(() => ({
        emotions: ['joy'],
        sexualStates: ['aroused'],
      }));

      const result = gateEvaluator.computeGateCompatibility(
        expression,
        moodConstraints,
        extractRefsFn
      );

      expect(extractRefsFn).toHaveBeenCalledWith(expression.prerequisites);
      expect(result.emotions).toHaveProperty('joy');
      expect(result.sexualStates).toHaveProperty('aroused');
    });

    it('should handle empty references', () => {
      const extractRefsFn = jest.fn(() => ({
        emotions: [],
        sexualStates: [],
      }));

      const result = gateEvaluator.computeGateCompatibility(
        {},
        [],
        extractRefsFn
      );

      expect(result.emotions).toEqual({});
      expect(result.sexualStates).toEqual({});
    });
  });

  describe('buildGateClampRegimePlan', () => {
    it('should return empty plan for expression without prerequisites', () => {
      const expression = { prerequisites: [] };
      const result = gateEvaluator.buildGateClampRegimePlan(
        expression,
        null,
        jest.fn()
      );

      expect(result.trackedGateAxes).toEqual([]);
      expect(result.clauseGateMap).toEqual({});
    });

    it('should return empty plan for null expression', () => {
      const result = gateEvaluator.buildGateClampRegimePlan(
        null,
        null,
        jest.fn()
      );

      expect(result.trackedGateAxes).toEqual([]);
      expect(result.clauseGateMap).toEqual({});
    });

    it('should use clauseTracking hierarchicalTrees when provided', () => {
      const expression = {
        prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
      };
      const clauseTracking = [
        {
          hierarchicalTree: {
            nodeType: 'leaf',
            clauseId: 'c1',
            variablePath: 'emotions.joy',
          },
        },
      ];
      const buildTreeFn = jest.fn();

      gateEvaluator.buildGateClampRegimePlan(
        expression,
        clauseTracking,
        buildTreeFn
      );

      expect(buildTreeFn).not.toHaveBeenCalled();
    });

    it('should use buildTreeFn when clauseTracking is null', () => {
      const expression = {
        prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
      };
      const buildTreeFn = jest.fn(() => ({
        nodeType: 'leaf',
        clauseId: 'c1',
        variablePath: 'emotions.joy',
      }));

      gateEvaluator.buildGateClampRegimePlan(expression, null, buildTreeFn);

      expect(buildTreeFn).toHaveBeenCalledWith(
        expression.prerequisites[0].logic,
        '0'
      );
    });

    it('should collect gate predicates from leaf nodes', () => {
      const expression = {
        prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
      };
      const clauseTracking = [
        {
          hierarchicalTree: {
            nodeType: 'leaf',
            clauseId: 'c1',
            variablePath: 'emotions.joy',
          },
        },
      ];

      const result = gateEvaluator.buildGateClampRegimePlan(
        expression,
        clauseTracking,
        jest.fn()
      );

      expect(result.trackedGateAxes).toContain('valence');
      expect(result.clauseGateMap).toHaveProperty('c1');
      expect(result.clauseGateMap.c1.prototypeId).toBe('joy');
      expect(result.clauseGateMap.c1.type).toBe('emotion');
    });

    it('should sort tracked gate axes alphabetically', () => {
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
          { logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.4] } },
        ],
      };
      const clauseTracking = [
        {
          hierarchicalTree: {
            nodeType: 'leaf',
            clauseId: 'c1',
            variablePath: 'emotions.joy',
          },
        },
        {
          hierarchicalTree: {
            nodeType: 'leaf',
            clauseId: 'c2',
            variablePath: 'sexualStates.aroused',
          },
        },
      ];

      const result = gateEvaluator.buildGateClampRegimePlan(
        expression,
        clauseTracking,
        jest.fn()
      );

      // joy has gate on 'valence', aroused has gate on 'sex_excitation'
      const sortedAxes = [...result.trackedGateAxes].sort((a, b) =>
        a.localeCompare(b)
      );
      expect(result.trackedGateAxes).toEqual(sortedAxes);
    });
  });

  describe('recordGateOutcomeIfApplicable', () => {
    it('should return early when node is null', () => {
      gateEvaluator.recordGateOutcomeIfApplicable(
        null,
        {},
        true,
        true,
        {},
        jest.fn()
      );
      expect(mockContextBuilder.normalizeGateContext).not.toHaveBeenCalled();
    });

    it('should return early when node is not a leaf', () => {
      const node = { nodeType: 'and' };
      gateEvaluator.recordGateOutcomeIfApplicable(
        node,
        {},
        true,
        true,
        {},
        jest.fn()
      );
      expect(mockContextBuilder.normalizeGateContext).not.toHaveBeenCalled();
    });

    it('should return early when variablePath is not a gate target', () => {
      const node = { nodeType: 'leaf', variablePath: 'moodAxes.valence' };
      gateEvaluator.recordGateOutcomeIfApplicable(
        node,
        {},
        true,
        true,
        {},
        jest.fn()
      );
      expect(mockContextBuilder.normalizeGateContext).not.toHaveBeenCalled();
    });

    it('should return early when prototype not found', () => {
      const node = { nodeType: 'leaf', variablePath: 'emotions.nonexistent' };
      gateEvaluator.recordGateOutcomeIfApplicable(
        node,
        {},
        true,
        true,
        {},
        jest.fn()
      );
      expect(mockContextBuilder.normalizeGateContext).not.toHaveBeenCalled();
    });

    it('should call evalSampleFn and record gate evaluation', () => {
      const node = {
        nodeType: 'leaf',
        variablePath: 'emotions.joy',
        recordGateEvaluation: jest.fn(),
        comparisonOperator: '<',
      };
      const context = { moodAxes: { valence: 50 } };
      const evalSampleFn = jest.fn(() => ({
        gatePass: true,
        rawValue: 0.6,
      }));
      const cache = {};

      gateEvaluator.recordGateOutcomeIfApplicable(
        node,
        context,
        true,
        true,
        cache,
        evalSampleFn
      );

      expect(evalSampleFn).toHaveBeenCalled();
      expect(node.recordGateEvaluation).toHaveBeenCalledWith(true, true, true);
    });

    it('should record lost pass when comparisonOperator is >= and rawValue meets threshold', () => {
      const node = {
        nodeType: 'leaf',
        variablePath: 'emotions.joy',
        recordGateEvaluation: jest.fn(),
        recordLostPassInRegime: jest.fn(),
        comparisonOperator: '>=',
        thresholdValue: 0.5,
      };
      const context = { moodAxes: { valence: 50 } };
      const evalSampleFn = jest.fn(() => ({
        gatePass: false,
        rawValue: 0.6,
      }));

      gateEvaluator.recordGateOutcomeIfApplicable(
        node,
        context,
        false,
        true,
        {},
        evalSampleFn
      );

      expect(node.recordLostPassInRegime).toHaveBeenCalledWith(
        true,
        false,
        true
      );
    });

    it('should return early when context is null', () => {
      const node = { nodeType: 'leaf', variablePath: 'emotions.joy' };
      gateEvaluator.recordGateOutcomeIfApplicable(
        node,
        null,
        true,
        true,
        {},
        jest.fn()
      );
      expect(mockContextBuilder.normalizeGateContext).not.toHaveBeenCalled();
    });
  });
});
