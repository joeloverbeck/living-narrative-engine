/**
 * @file Unit tests for ReportDataExtractor service
 * @description Tests data extraction utilities for Monte Carlo report generation.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ReportDataExtractor from '../../../../src/expressionDiagnostics/services/ReportDataExtractor.js';

describe('ReportDataExtractor', () => {
  let extractor;
  let mockLogger;
  let mockPrototypeConstraintAnalyzer;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockPrototypeConstraintAnalyzer = {
      extractAxisConstraints: jest.fn(),
      analyzeEmotionThreshold: jest.fn(),
    };

    extractor = new ReportDataExtractor({
      logger: mockLogger,
      prototypeConstraintAnalyzer: mockPrototypeConstraintAnalyzer,
    });
  });

  // ==========================================================================
  // extractAxisConstraints
  // ==========================================================================

  describe('extractAxisConstraints', () => {
    it('returns null when prerequisites is null', () => {
      const result = extractor.extractAxisConstraints(null);
      expect(result).toBeNull();
    });

    it('returns null when prerequisites is undefined', () => {
      const result = extractor.extractAxisConstraints(undefined);
      expect(result).toBeNull();
    });

    it('returns null when prototypeConstraintAnalyzer is not provided', () => {
      const extractorWithoutAnalyzer = new ReportDataExtractor({
        logger: mockLogger,
      });
      const result = extractorWithoutAnalyzer.extractAxisConstraints({
        some: 'data',
      });
      expect(result).toBeNull();
    });

    it('delegates to prototypeConstraintAnalyzer and returns result', () => {
      const mockConstraints = new Map([['axis1', { min: 0, max: 1 }]]);
      mockPrototypeConstraintAnalyzer.extractAxisConstraints.mockReturnValue(
        mockConstraints
      );

      const prerequisites = { logic: { and: [] } };
      const result = extractor.extractAxisConstraints(prerequisites);

      expect(
        mockPrototypeConstraintAnalyzer.extractAxisConstraints
      ).toHaveBeenCalledWith(prerequisites);
      expect(result).toBe(mockConstraints);
    });

    it('logs warning and returns null when analyzer throws', () => {
      mockPrototypeConstraintAnalyzer.extractAxisConstraints.mockImplementation(
        () => {
          throw new Error('Analyzer error');
        }
      );

      const result = extractor.extractAxisConstraints({ logic: {} });

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to extract axis constraints:',
        'Analyzer error'
      );
    });

    it('returns null without logging when analyzer throws and no logger', () => {
      const extractorNoLogger = new ReportDataExtractor({
        prototypeConstraintAnalyzer: mockPrototypeConstraintAnalyzer,
      });
      mockPrototypeConstraintAnalyzer.extractAxisConstraints.mockImplementation(
        () => {
          throw new Error('Analyzer error');
        }
      );

      const result = extractorNoLogger.extractAxisConstraints({ logic: {} });

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // extractBaselineTriggerRate
  // ==========================================================================

  describe('extractBaselineTriggerRate', () => {
    it('returns null for non-array input', () => {
      expect(extractor.extractBaselineTriggerRate(null)).toBeNull();
      expect(extractor.extractBaselineTriggerRate(undefined)).toBeNull();
      expect(extractor.extractBaselineTriggerRate('string')).toBeNull();
      expect(extractor.extractBaselineTriggerRate({})).toBeNull();
    });

    it('returns null for empty array', () => {
      const result = extractor.extractBaselineTriggerRate([]);
      expect(result).toBeNull();
    });

    it('returns null when no baseline point found in grid', () => {
      const sensitivityData = [
        {
          grid: [
            { threshold: 0.3, triggerRate: 0.5 },
            { threshold: 0.4, triggerRate: 0.4 },
          ],
          originalThreshold: 0.5, // Not in grid
        },
      ];
      const result = extractor.extractBaselineTriggerRate(sensitivityData);
      expect(result).toBeNull();
    });

    it('returns trigger rate from first matching baseline point', () => {
      const sensitivityData = [
        {
          grid: [
            { threshold: 0.3, triggerRate: 0.6 },
            { threshold: 0.5, triggerRate: 0.25 },
            { threshold: 0.7, triggerRate: 0.1 },
          ],
          originalThreshold: 0.5,
        },
      ];
      const result = extractor.extractBaselineTriggerRate(sensitivityData);
      expect(result).toBe(0.25);
    });

    it('handles result with missing grid gracefully', () => {
      const sensitivityData = [{ originalThreshold: 0.5 }];
      const result = extractor.extractBaselineTriggerRate(sensitivityData);
      expect(result).toBeNull();
    });

    it('handles result with missing originalThreshold gracefully', () => {
      const sensitivityData = [
        {
          grid: [{ threshold: 0.5, triggerRate: 0.25 }],
        },
      ];
      const result = extractor.extractBaselineTriggerRate(sensitivityData);
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // extractEmotionConditions
  // ==========================================================================

  describe('extractEmotionConditions', () => {
    const mockFlattenLeaves = jest.fn();

    beforeEach(() => {
      mockFlattenLeaves.mockReset();
    });

    it('returns empty array for blocker with no emotion conditions', () => {
      const blocker = {
        hierarchicalBreakdown: {
          isCompound: false,
          variablePath: 'some.other.path',
          thresholdValue: 0.5,
        },
      };

      const result = extractor.extractEmotionConditions(
        blocker,
        mockFlattenLeaves
      );
      expect(result).toEqual([]);
    });

    it('extracts emotion conditions from simple leaf', () => {
      const blocker = {
        hierarchicalBreakdown: {
          isCompound: false,
          variablePath: 'emotions.joy',
          thresholdValue: 0.5,
          comparisonOperator: '>=',
          description: 'Joy >= 0.5',
        },
      };

      const result = extractor.extractEmotionConditions(
        blocker,
        mockFlattenLeaves
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        prototypeId: 'joy',
        type: 'emotion',
        threshold: 0.5,
        operator: '>=',
        description: 'Joy >= 0.5',
      });
    });

    it('extracts sexual state conditions', () => {
      const blocker = {
        hierarchicalBreakdown: {
          isCompound: false,
          variablePath: 'sexual.arousal',
          thresholdValue: 0.7,
          operator: '>=',
          description: 'Arousal >= 0.7',
        },
      };

      const result = extractor.extractEmotionConditions(
        blocker,
        mockFlattenLeaves
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        prototypeId: 'arousal',
        type: 'sexual',
        threshold: 0.7,
        operator: '>=',
        description: 'Arousal >= 0.7',
      });
    });

    it('uses flattenLeavesFn for compound breakdowns', () => {
      const leaves = [
        {
          variablePath: 'emotions.anger',
          thresholdValue: 0.6,
          comparisonOperator: '>=',
          description: 'Anger >= 0.6',
        },
        {
          variablePath: 'emotions.fear',
          thresholdValue: 0.4,
          comparisonOperator: '>=',
          description: 'Fear >= 0.4',
        },
      ];
      mockFlattenLeaves.mockReturnValue(leaves);

      const blocker = {
        hierarchicalBreakdown: {
          isCompound: true,
          children: [],
        },
      };

      const result = extractor.extractEmotionConditions(
        blocker,
        mockFlattenLeaves
      );

      expect(mockFlattenLeaves).toHaveBeenCalledWith(blocker.hierarchicalBreakdown);
      expect(result).toHaveLength(2);
      expect(result[0].prototypeId).toBe('anger');
      expect(result[1].prototypeId).toBe('fear');
    });

    it('handles missing hierarchicalBreakdown gracefully', () => {
      const blocker = {};
      const result = extractor.extractEmotionConditions(
        blocker,
        mockFlattenLeaves
      );
      expect(result).toEqual([]);
    });

    it('skips leaves without numeric thresholds', () => {
      const blocker = {
        hierarchicalBreakdown: {
          isCompound: false,
          variablePath: 'emotions.joy',
          thresholdValue: 'not-a-number',
        },
      };

      const result = extractor.extractEmotionConditions(
        blocker,
        mockFlattenLeaves
      );
      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // extractEmotionConditionsFromPrereqs
  // ==========================================================================

  describe('extractEmotionConditionsFromPrereqs', () => {
    it('returns empty array for null input', () => {
      const result = extractor.extractEmotionConditionsFromPrereqs(null);
      expect(result).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
      const result = extractor.extractEmotionConditionsFromPrereqs(undefined);
      expect(result).toEqual([]);
    });

    it('returns empty array for non-array input', () => {
      const result = extractor.extractEmotionConditionsFromPrereqs({});
      expect(result).toEqual([]);
    });

    it('returns empty array for empty prerequisites array', () => {
      const result = extractor.extractEmotionConditionsFromPrereqs([]);
      expect(result).toEqual([]);
    });

    it('extracts emotion conditions from prerequisites logic', () => {
      const prerequisites = [
        {
          logic: {
            '>=': [{ var: 'emotions.joy' }, 0.5],
          },
        },
      ];

      const result = extractor.extractEmotionConditionsFromPrereqs(prerequisites);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        varPath: 'emotions.joy',
        operator: '>=',
        threshold: 0.5,
        display: 'emotions.joy >= 0.5',
      });
    });

    it('extracts sexualStates conditions', () => {
      const prerequisites = [
        {
          logic: {
            '>=': [{ var: 'sexualStates.arousal' }, 0.7],
          },
        },
      ];

      const result = extractor.extractEmotionConditionsFromPrereqs(prerequisites);

      expect(result).toHaveLength(1);
      expect(result[0].varPath).toBe('sexualStates.arousal');
    });

    it('deduplicates conditions with same varPath, operator, threshold', () => {
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
            ],
          },
        },
      ];

      const result = extractor.extractEmotionConditionsFromPrereqs(prerequisites);

      expect(result).toHaveLength(1);
    });

    it('keeps conditions with different thresholds', () => {
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
              { '>=': [{ var: 'emotions.joy' }, 0.7] },
            ],
          },
        },
      ];

      const result = extractor.extractEmotionConditionsFromPrereqs(prerequisites);

      expect(result).toHaveLength(2);
    });
  });

  // ==========================================================================
  // extractEmotionConditionsFromLogic
  // ==========================================================================

  describe('extractEmotionConditionsFromLogic', () => {
    it('handles null logic gracefully', () => {
      const conditions = [];
      extractor.extractEmotionConditionsFromLogic(null, conditions);
      expect(conditions).toEqual([]);
    });

    it('handles undefined logic gracefully', () => {
      const conditions = [];
      extractor.extractEmotionConditionsFromLogic(undefined, conditions);
      expect(conditions).toEqual([]);
    });

    it('handles non-object logic gracefully', () => {
      const conditions = [];
      extractor.extractEmotionConditionsFromLogic('string', conditions);
      expect(conditions).toEqual([]);
    });

    it('extracts >= comparison', () => {
      const conditions = [];
      const logic = { '>=': [{ var: 'emotions.anger' }, 0.6] };

      extractor.extractEmotionConditionsFromLogic(logic, conditions);

      expect(conditions).toHaveLength(1);
      expect(conditions[0].operator).toBe('>=');
    });

    it('extracts <= comparison', () => {
      const conditions = [];
      const logic = { '<=': [{ var: 'emotions.fear' }, 0.3] };

      extractor.extractEmotionConditionsFromLogic(logic, conditions);

      expect(conditions).toHaveLength(1);
      expect(conditions[0].operator).toBe('<=');
    });

    it('extracts > comparison', () => {
      const conditions = [];
      const logic = { '>': [{ var: 'emotions.joy' }, 0.8] };

      extractor.extractEmotionConditionsFromLogic(logic, conditions);

      expect(conditions).toHaveLength(1);
      expect(conditions[0].operator).toBe('>');
    });

    it('extracts < comparison', () => {
      const conditions = [];
      const logic = { '<': [{ var: 'sexualStates.arousal' }, 0.2] };

      extractor.extractEmotionConditionsFromLogic(logic, conditions);

      expect(conditions).toHaveLength(1);
      expect(conditions[0].operator).toBe('<');
    });

    it('ignores non-emotion/sexual variable paths', () => {
      const conditions = [];
      const logic = { '>=': [{ var: 'health.stamina' }, 0.5] };

      extractor.extractEmotionConditionsFromLogic(logic, conditions);

      expect(conditions).toEqual([]);
    });

    it('ignores comparisons with non-numeric right operand', () => {
      const conditions = [];
      const logic = { '>=': [{ var: 'emotions.joy' }, 'high'] };

      extractor.extractEmotionConditionsFromLogic(logic, conditions);

      expect(conditions).toEqual([]);
    });

    it('ignores comparisons with non-var left operand', () => {
      const conditions = [];
      const logic = { '>=': [0.5, 0.3] };

      extractor.extractEmotionConditionsFromLogic(logic, conditions);

      expect(conditions).toEqual([]);
    });

    it('recurses into AND blocks', () => {
      const conditions = [];
      const logic = {
        and: [
          { '>=': [{ var: 'emotions.joy' }, 0.5] },
          { '>=': [{ var: 'emotions.anger' }, 0.3] },
        ],
      };

      extractor.extractEmotionConditionsFromLogic(logic, conditions);

      expect(conditions).toHaveLength(2);
    });

    it('recurses into OR blocks', () => {
      const conditions = [];
      const logic = {
        or: [
          { '>=': [{ var: 'emotions.joy' }, 0.5] },
          { '>=': [{ var: 'emotions.fear' }, 0.4] },
        ],
      };

      extractor.extractEmotionConditionsFromLogic(logic, conditions);

      expect(conditions).toHaveLength(2);
    });

    it('recurses into nested AND/OR blocks', () => {
      const conditions = [];
      const logic = {
        and: [
          {
            or: [
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
              { '>=': [{ var: 'emotions.fear' }, 0.4] },
            ],
          },
          { '>=': [{ var: 'emotions.anger' }, 0.3] },
        ],
      };

      extractor.extractEmotionConditionsFromLogic(logic, conditions);

      expect(conditions).toHaveLength(3);
    });
  });

  // ==========================================================================
  // extractWorstCeilingFromLeaves
  // ==========================================================================

  describe('extractWorstCeilingFromLeaves', () => {
    const mockFlattenLeaves = jest.fn();

    beforeEach(() => {
      mockFlattenLeaves.mockReset();
    });

    it('returns null when flattenLeaves returns empty array', () => {
      mockFlattenLeaves.mockReturnValue([]);

      const result = extractor.extractWorstCeilingFromLeaves({}, mockFlattenLeaves);

      expect(result).toBeNull();
    });

    it('returns null when no leaves have positive ceiling gaps', () => {
      mockFlattenLeaves.mockReturnValue([
        { ceilingGap: 0, thresholdValue: 0.5, maxObservedValue: 0.5 },
        { ceilingGap: -0.1, thresholdValue: 0.5, maxObservedValue: 0.6 },
      ]);

      const result = extractor.extractWorstCeilingFromLeaves({}, mockFlattenLeaves);

      expect(result).toBeNull();
    });

    it('returns worst ceiling from leaves with positive gaps', () => {
      mockFlattenLeaves.mockReturnValue([
        {
          ceilingGap: 0.1,
          thresholdValue: 0.6,
          maxObservedValue: 0.5,
          description: 'Condition A',
        },
        {
          ceilingGap: 0.3,
          thresholdValue: 0.8,
          maxObservedValue: 0.5,
          description: 'Condition B',
        },
        {
          ceilingGap: 0.2,
          thresholdValue: 0.7,
          maxObservedValue: 0.5,
          description: 'Condition C',
        },
      ]);

      const result = extractor.extractWorstCeilingFromLeaves({}, mockFlattenLeaves);

      expect(result).not.toBeNull();
      expect(result.gap).toBe(0.3);
      expect(result.description).toBe('Condition B');
      expect(result.threshold).toBe(0.8);
      expect(result.maxObserved).toBe(0.5);
      expect(result.totalLeaves).toBe(3);
      expect(result.insight).toContain('0.50');
      expect(result.insight).toContain('0.80');
    });

    it('uses "Unknown condition" for missing description', () => {
      mockFlattenLeaves.mockReturnValue([
        {
          ceilingGap: 0.2,
          thresholdValue: 0.7,
          maxObservedValue: 0.5,
        },
      ]);

      const result = extractor.extractWorstCeilingFromLeaves({}, mockFlattenLeaves);

      expect(result.description).toBe('Unknown condition');
    });

    it('skips leaves missing required numeric fields', () => {
      mockFlattenLeaves.mockReturnValue([
        { ceilingGap: 0.2, thresholdValue: 0.7 }, // missing maxObservedValue
        { ceilingGap: 0.2, maxObservedValue: 0.5 }, // missing thresholdValue
        { thresholdValue: 0.7, maxObservedValue: 0.5 }, // missing ceilingGap
        {
          ceilingGap: 0.1,
          thresholdValue: 0.6,
          maxObservedValue: 0.5,
          description: 'Valid',
        },
      ]);

      const result = extractor.extractWorstCeilingFromLeaves({}, mockFlattenLeaves);

      expect(result).not.toBeNull();
      expect(result.gap).toBe(0.1);
      expect(result.description).toBe('Valid');
    });
  });

  // ==========================================================================
  // getPrototypeContextPath
  // ==========================================================================

  describe('getPrototypeContextPath', () => {
    it('returns emotions path for emotion type', () => {
      const result = extractor.getPrototypeContextPath('emotion', 'joy');
      expect(result).toBe('emotions.joy');
    });

    it('returns sexualStates path for sexual type', () => {
      const result = extractor.getPrototypeContextPath('sexual', 'arousal');
      expect(result).toBe('sexualStates.arousal');
    });

    it('returns null for unknown type', () => {
      const result = extractor.getPrototypeContextPath('unknown', 'test');
      expect(result).toBeNull();
    });

    it('returns null for undefined type', () => {
      const result = extractor.getPrototypeContextPath(undefined, 'test');
      expect(result).toBeNull();
    });

    it('returns null for null type', () => {
      const result = extractor.getPrototypeContextPath(null, 'test');
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // getPrototypeWeights
  // ==========================================================================

  describe('getPrototypeWeights', () => {
    it('returns null when prototypeConstraintAnalyzer not provided', () => {
      const extractorNoAnalyzer = new ReportDataExtractor({
        logger: mockLogger,
      });

      const result = extractorNoAnalyzer.getPrototypeWeights('joy');

      expect(result).toBeNull();
    });

    it('calls analyzeEmotionThreshold with correct parameters', () => {
      mockPrototypeConstraintAnalyzer.analyzeEmotionThreshold.mockReturnValue({
        weights: { valence: 1.0, arousal: 0.6 },
      });

      extractor.getPrototypeWeights('joy', 'emotion');

      expect(
        mockPrototypeConstraintAnalyzer.analyzeEmotionThreshold
      ).toHaveBeenCalledWith('joy', 'emotion', 0.5, null);
    });

    it('returns weights from analysis result', () => {
      const expectedWeights = { valence: 1.0, arousal: 0.6 };
      mockPrototypeConstraintAnalyzer.analyzeEmotionThreshold.mockReturnValue({
        weights: expectedWeights,
      });

      const result = extractor.getPrototypeWeights('joy');

      expect(result).toEqual(expectedWeights);
    });

    it('returns null when analysis has no weights', () => {
      mockPrototypeConstraintAnalyzer.analyzeEmotionThreshold.mockReturnValue({});

      const result = extractor.getPrototypeWeights('joy');

      expect(result).toBeNull();
    });

    it('returns null when analysis returns null', () => {
      mockPrototypeConstraintAnalyzer.analyzeEmotionThreshold.mockReturnValue(
        null
      );

      const result = extractor.getPrototypeWeights('joy');

      expect(result).toBeNull();
    });

    it('returns null when analyzer throws', () => {
      mockPrototypeConstraintAnalyzer.analyzeEmotionThreshold.mockImplementation(
        () => {
          throw new Error('Analysis error');
        }
      );

      const result = extractor.getPrototypeWeights('joy');

      expect(result).toBeNull();
    });

    it('defaults type to emotion', () => {
      mockPrototypeConstraintAnalyzer.analyzeEmotionThreshold.mockReturnValue({
        weights: {},
      });

      extractor.getPrototypeWeights('joy');

      expect(
        mockPrototypeConstraintAnalyzer.analyzeEmotionThreshold
      ).toHaveBeenCalledWith('joy', 'emotion', 0.5, null);
    });
  });

  // ==========================================================================
  // getGateTraceSignals
  // ==========================================================================

  describe('getGateTraceSignals', () => {
    it('returns null when context is null', () => {
      const result = extractor.getGateTraceSignals(null, 'emotion', 'joy');
      expect(result).toBeNull();
    });

    it('returns null when context is undefined', () => {
      const result = extractor.getGateTraceSignals(undefined, 'emotion', 'joy');
      expect(result).toBeNull();
    });

    it('returns null when context has no gateTrace', () => {
      const result = extractor.getGateTraceSignals({}, 'emotion', 'joy');
      expect(result).toBeNull();
    });

    it('returns null when prototypeId is null', () => {
      const context = { gateTrace: { emotions: { joy: { signal: 0.5 } } } };
      const result = extractor.getGateTraceSignals(context, 'emotion', null);
      expect(result).toBeNull();
    });

    it('returns null when prototypeId is undefined', () => {
      const context = { gateTrace: { emotions: { joy: { signal: 0.5 } } } };
      const result = extractor.getGateTraceSignals(context, 'emotion', undefined);
      expect(result).toBeNull();
    });

    it('returns emotion signals for emotion type', () => {
      const signals = { valence: 0.8, arousal: 0.6 };
      const context = { gateTrace: { emotions: { joy: signals } } };

      const result = extractor.getGateTraceSignals(context, 'emotion', 'joy');

      expect(result).toEqual(signals);
    });

    it('returns sexual signals for sexual type', () => {
      const signals = { arousal: 0.7 };
      const context = { gateTrace: { sexualStates: { arousal: signals } } };

      const result = extractor.getGateTraceSignals(context, 'sexual', 'arousal');

      expect(result).toEqual(signals);
    });

    it('returns null for unknown type', () => {
      const context = { gateTrace: { emotions: { joy: { signal: 0.5 } } } };
      const result = extractor.getGateTraceSignals(context, 'unknown', 'joy');
      expect(result).toBeNull();
    });

    it('returns null when prototype not in gateTrace', () => {
      const context = { gateTrace: { emotions: { anger: { signal: 0.5 } } } };
      const result = extractor.getGateTraceSignals(context, 'emotion', 'joy');
      expect(result).toBeNull();
    });

    it('returns null when emotions/sexualStates not in gateTrace', () => {
      const context = { gateTrace: {} };
      const result = extractor.getGateTraceSignals(context, 'emotion', 'joy');
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // getLowestCoverageVariables
  // ==========================================================================

  describe('getLowestCoverageVariables', () => {
    it('returns empty array for null input', () => {
      const result = extractor.getLowestCoverageVariables(null, 5);
      expect(result).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
      const result = extractor.getLowestCoverageVariables(undefined, 5);
      expect(result).toEqual([]);
    });

    it('returns empty array for non-array input', () => {
      const result = extractor.getLowestCoverageVariables({}, 5);
      expect(result).toEqual([]);
    });

    it('returns empty array for empty array', () => {
      const result = extractor.getLowestCoverageVariables([], 5);
      expect(result).toEqual([]);
    });

    it('filters out variables with unknown rating', () => {
      const variables = [
        { variablePath: 'a', rating: 'unknown' },
        { variablePath: 'b', rating: 'poor' },
      ];

      const result = extractor.getLowestCoverageVariables(variables, 5);

      expect(result).toHaveLength(1);
      expect(result[0].variablePath).toBe('b');
    });

    it('filters out variables with missing rating', () => {
      const variables = [
        { variablePath: 'a' },
        { variablePath: 'b', rating: 'poor' },
      ];

      const result = extractor.getLowestCoverageVariables(variables, 5);

      expect(result).toHaveLength(1);
      expect(result[0].variablePath).toBe('b');
    });

    it('filters out null/undefined variables', () => {
      const variables = [null, undefined, { variablePath: 'b', rating: 'poor' }];

      const result = extractor.getLowestCoverageVariables(variables, 5);

      expect(result).toHaveLength(1);
    });

    it('sorts by rating severity (poor < partial < good)', () => {
      const variables = [
        { variablePath: 'good', rating: 'good' },
        { variablePath: 'poor', rating: 'poor' },
        { variablePath: 'partial', rating: 'partial' },
      ];

      const result = extractor.getLowestCoverageVariables(variables, 5);

      expect(result[0].variablePath).toBe('poor');
      expect(result[1].variablePath).toBe('partial');
      expect(result[2].variablePath).toBe('good');
    });

    it('sorts by rangeCoverage when ratings are equal', () => {
      const variables = [
        { variablePath: 'a', rating: 'partial', rangeCoverage: 0.8 },
        { variablePath: 'b', rating: 'partial', rangeCoverage: 0.3 },
        { variablePath: 'c', rating: 'partial', rangeCoverage: 0.5 },
      ];

      const result = extractor.getLowestCoverageVariables(variables, 5);

      expect(result[0].variablePath).toBe('b');
      expect(result[1].variablePath).toBe('c');
      expect(result[2].variablePath).toBe('a');
    });

    it('sorts by binCoverage when rating and rangeCoverage are equal', () => {
      const variables = [
        {
          variablePath: 'a',
          rating: 'partial',
          rangeCoverage: 0.5,
          binCoverage: 0.8,
        },
        {
          variablePath: 'b',
          rating: 'partial',
          rangeCoverage: 0.5,
          binCoverage: 0.2,
        },
        {
          variablePath: 'c',
          rating: 'partial',
          rangeCoverage: 0.5,
          binCoverage: 0.5,
        },
      ];

      const result = extractor.getLowestCoverageVariables(variables, 5);

      expect(result[0].variablePath).toBe('b');
      expect(result[1].variablePath).toBe('c');
      expect(result[2].variablePath).toBe('a');
    });

    it('sorts by variablePath when all else equal', () => {
      const variables = [
        {
          variablePath: 'zebra',
          rating: 'partial',
          rangeCoverage: 0.5,
          binCoverage: 0.5,
        },
        {
          variablePath: 'apple',
          rating: 'partial',
          rangeCoverage: 0.5,
          binCoverage: 0.5,
        },
        {
          variablePath: 'mango',
          rating: 'partial',
          rangeCoverage: 0.5,
          binCoverage: 0.5,
        },
      ];

      const result = extractor.getLowestCoverageVariables(variables, 5);

      expect(result[0].variablePath).toBe('apple');
      expect(result[1].variablePath).toBe('mango');
      expect(result[2].variablePath).toBe('zebra');
    });

    it('limits results to specified count', () => {
      const variables = [
        { variablePath: 'a', rating: 'poor' },
        { variablePath: 'b', rating: 'poor' },
        { variablePath: 'c', rating: 'poor' },
        { variablePath: 'd', rating: 'poor' },
        { variablePath: 'e', rating: 'poor' },
      ];

      const result = extractor.getLowestCoverageVariables(variables, 3);

      expect(result).toHaveLength(3);
    });

    it('returns all when limit exceeds array length', () => {
      const variables = [
        { variablePath: 'a', rating: 'poor' },
        { variablePath: 'b', rating: 'partial' },
      ];

      const result = extractor.getLowestCoverageVariables(variables, 10);

      expect(result).toHaveLength(2);
    });

    it('handles missing coverage values by treating as 1', () => {
      const variables = [
        { variablePath: 'a', rating: 'partial' }, // no rangeCoverage or binCoverage
        { variablePath: 'b', rating: 'partial', rangeCoverage: 0.5, binCoverage: 0.5 },
      ];

      const result = extractor.getLowestCoverageVariables(variables, 5);

      // b should come first because 0.5 < 1 (default)
      expect(result[0].variablePath).toBe('b');
      expect(result[1].variablePath).toBe('a');
    });
  });

  // ==========================================================================
  // Constructor edge cases
  // ==========================================================================

  describe('constructor', () => {
    it('works with no options', () => {
      const extractor = new ReportDataExtractor();
      expect(extractor).toBeInstanceOf(ReportDataExtractor);
    });

    it('works with empty options object', () => {
      const extractor = new ReportDataExtractor({});
      expect(extractor).toBeInstanceOf(ReportDataExtractor);
    });

    it('works with only logger', () => {
      const extractor = new ReportDataExtractor({ logger: mockLogger });
      expect(extractor).toBeInstanceOf(ReportDataExtractor);
    });

    it('works with only prototypeConstraintAnalyzer', () => {
      const extractor = new ReportDataExtractor({
        prototypeConstraintAnalyzer: mockPrototypeConstraintAnalyzer,
      });
      expect(extractor).toBeInstanceOf(ReportDataExtractor);
    });
  });
});
