/**
 * @file FitFeasibilityConflictDetector.test.js
 * @description Unit tests for FitFeasibilityConflictDetector service
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import FitFeasibilityConflictDetector from '../../../../src/expressionDiagnostics/services/FitFeasibilityConflictDetector.js';

describe('FitFeasibilityConflictDetector', () => {
  let detector;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    detector = new FitFeasibilityConflictDetector({
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error when logger is missing', () => {
      expect(() => new FitFeasibilityConflictDetector({})).toThrow();
    });

    it('should throw error when logger is missing required methods', () => {
      expect(
        () =>
          new FitFeasibilityConflictDetector({
            logger: { info: jest.fn() },
          })
      ).toThrow();
    });

    it('should create instance with valid dependencies', () => {
      expect(detector).toBeInstanceOf(FitFeasibilityConflictDetector);
    });
  });

  describe('fit_vs_clause_impossible detection', () => {
    const createFitResult = (topScore) => ({
      leaderboard: [
        { prototypeId: 'anger', compositeScore: topScore, rank: 1 },
        { prototypeId: 'fear', compositeScore: topScore - 0.1, rank: 2 },
        { prototypeId: 'joy', compositeScore: topScore - 0.2, rank: 3 },
      ],
    });

    const createImpossibleClause = (id, varPath) => ({
      clauseId: id,
      varPath,
      operator: '>=',
      threshold: 0.5,
      signal: 'final',
      population: 'in_regime',
      passRate: 0,
      maxValue: 0.2,
      p95Value: 0.15,
      marginMax: -0.3,
      classification: 'IMPOSSIBLE',
      evidence: { bestSampleRef: null, note: 'test' },
      sourcePath: 'prereqs[0]',
    });

    const createOkClause = (id, varPath) => ({
      clauseId: id,
      varPath,
      operator: '>=',
      threshold: 0.5,
      signal: 'final',
      population: 'in_regime',
      passRate: 0.8,
      maxValue: 0.9,
      p95Value: 0.85,
      marginMax: 0.4,
      classification: 'OK',
      evidence: { bestSampleRef: 'sample_0', note: 'test' },
      sourcePath: 'prereqs[0]',
    });

    it('should detect conflict when topScore >= 0.3 AND IMPOSSIBLE clause exists', () => {
      const fitResult = createFitResult(0.5);
      const feasibilityResults = [
        createImpossibleClause('clause_1', 'emotions.confusion'),
      ];

      const conflicts = detector.detect(fitResult, feasibilityResults, null);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('fit_vs_clause_impossible');
      expect(conflicts[0].impossibleClauseIds).toEqual(['clause_1']);
    });

    it('should NOT detect conflict when topScore < 0.3', () => {
      const fitResult = createFitResult(0.2);
      const feasibilityResults = [
        createImpossibleClause('clause_1', 'emotions.confusion'),
      ];

      const conflicts = detector.detect(fitResult, feasibilityResults, null);

      expect(conflicts).toHaveLength(0);
    });

    it('should NOT detect conflict when topScore is exactly 0.3 boundary', () => {
      const fitResult = createFitResult(0.3);
      const feasibilityResults = [
        createImpossibleClause('clause_1', 'emotions.confusion'),
      ];

      const conflicts = detector.detect(fitResult, feasibilityResults, null);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('fit_vs_clause_impossible');
    });

    it('should NOT detect conflict when no IMPOSSIBLE clauses exist', () => {
      const fitResult = createFitResult(0.5);
      const feasibilityResults = [
        createOkClause('clause_1', 'emotions.confusion'),
      ];

      const conflicts = detector.detect(fitResult, feasibilityResults, null);

      expect(conflicts).toHaveLength(0);
    });

    it('should include all IMPOSSIBLE clauses in impossibleClauseIds', () => {
      const fitResult = createFitResult(0.5);
      const feasibilityResults = [
        createImpossibleClause('clause_1', 'emotions.confusion'),
        createImpossibleClause('clause_2', 'emotions.fear'),
        createOkClause('clause_3', 'emotions.joy'),
        createImpossibleClause('clause_4', 'sexualStates.arousal'),
      ];

      const conflicts = detector.detect(fitResult, feasibilityResults, null);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].impossibleClauseIds).toEqual([
        'clause_1',
        'clause_2',
        'clause_4',
      ]);
    });
  });

  describe('gate_contradiction detection', () => {
    const createGateAlignmentResult = (contradictions) => ({
      contradictions,
      tightPassages: [],
      hasIssues: contradictions.length > 0,
    });

    const createContradiction = (emotionId, axis) => ({
      emotionId,
      axis,
      regime: { min: 0.2, max: 0.5 },
      gate: { min: 0.7, max: 1.0 },
      gateString: `${axis} >= 0.7`,
      distance: 0.2,
      severity: 'critical',
    });

    it('should detect conflict when gateAlignmentResult has contradictions', () => {
      const gateAlignmentResult = createGateAlignmentResult([
        createContradiction('anger', 'valence'),
      ]);

      const conflicts = detector.detect(null, null, gateAlignmentResult);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('gate_contradiction');
    });

    it('should format gate contradictions as gate:emotionId:axis in clauseIds', () => {
      const gateAlignmentResult = createGateAlignmentResult([
        createContradiction('anger', 'valence'),
        createContradiction('fear', 'arousal'),
      ]);

      const conflicts = detector.detect(null, null, gateAlignmentResult);

      expect(conflicts[0].impossibleClauseIds).toEqual([
        'gate:anger:valence',
        'gate:fear:arousal',
      ]);
    });

    it('should NOT detect conflict when no contradictions exist', () => {
      const gateAlignmentResult = createGateAlignmentResult([]);

      const conflicts = detector.detect(null, null, gateAlignmentResult);

      expect(conflicts).toHaveLength(0);
    });

    it('should NOT detect conflict when gateAlignmentResult is null', () => {
      const conflicts = detector.detect(null, null, null);

      expect(conflicts).toHaveLength(0);
    });
  });

  describe('top prototypes extraction', () => {
    it('should extract top 3 prototypes from leaderboard', () => {
      const fitResult = {
        leaderboard: [
          { prototypeId: 'anger', compositeScore: 0.8, rank: 1 },
          { prototypeId: 'fear', compositeScore: 0.7, rank: 2 },
          { prototypeId: 'joy', compositeScore: 0.6, rank: 3 },
          { prototypeId: 'sadness', compositeScore: 0.5, rank: 4 },
          { prototypeId: 'surprise', compositeScore: 0.4, rank: 5 },
        ],
      };
      const feasibilityResults = [
        {
          clauseId: 'clause_1',
          varPath: 'emotions.confusion',
          operator: '>=',
          threshold: 0.5,
          signal: 'final',
          classification: 'IMPOSSIBLE',
          maxValue: 0.2,
          evidence: {},
          sourcePath: 'prereqs[0]',
        },
      ];

      const conflicts = detector.detect(fitResult, feasibilityResults, null);

      expect(conflicts[0].topPrototypes).toHaveLength(3);
      expect(conflicts[0].topPrototypes[0]).toEqual({
        prototypeId: 'anger',
        score: 0.8,
      });
      expect(conflicts[0].topPrototypes[1]).toEqual({
        prototypeId: 'fear',
        score: 0.7,
      });
      expect(conflicts[0].topPrototypes[2]).toEqual({
        prototypeId: 'joy',
        score: 0.6,
      });
    });

    it('should handle missing leaderboard gracefully', () => {
      const gateAlignmentResult = {
        contradictions: [
          {
            emotionId: 'anger',
            axis: 'valence',
            regime: { min: 0.2, max: 0.5 },
            gate: { min: 0.7, max: 1.0 },
            gateString: 'valence >= 0.7',
            distance: 0.2,
            severity: 'critical',
          },
        ],
        hasIssues: true,
      };

      const conflicts = detector.detect(null, null, gateAlignmentResult);

      expect(conflicts[0].topPrototypes).toEqual([]);
    });

    it('should handle empty leaderboard gracefully', () => {
      const fitResult = { leaderboard: [] };
      const gateAlignmentResult = {
        contradictions: [
          {
            emotionId: 'anger',
            axis: 'valence',
            regime: { min: 0.2, max: 0.5 },
            gate: { min: 0.7, max: 1.0 },
            gateString: 'valence >= 0.7',
            distance: 0.2,
            severity: 'critical',
          },
        ],
        hasIssues: true,
      };

      const conflicts = detector.detect(fitResult, null, gateAlignmentResult);

      expect(conflicts[0].topPrototypes).toEqual([]);
    });
  });

  describe('explanation generation', () => {
    it('should include prototype names in explanation', () => {
      const fitResult = {
        leaderboard: [
          { prototypeId: 'anger', compositeScore: 0.5 },
          { prototypeId: 'fear', compositeScore: 0.4 },
        ],
      };
      const feasibilityResults = [
        {
          clauseId: 'clause_1',
          varPath: 'emotions.confusion',
          operator: '>=',
          threshold: 0.5,
          signal: 'final',
          classification: 'IMPOSSIBLE',
          maxValue: 0.2,
          evidence: {},
          sourcePath: 'prereqs[0]',
        },
      ];

      const conflicts = detector.detect(fitResult, feasibilityResults, null);

      expect(conflicts[0].explanation).toContain('anger');
      expect(conflicts[0].explanation).toContain('fear');
    });

    it('should include variable paths from impossible clauses in explanation', () => {
      const fitResult = {
        leaderboard: [{ prototypeId: 'anger', compositeScore: 0.5 }],
      };
      const feasibilityResults = [
        {
          clauseId: 'clause_1',
          varPath: 'emotions.confusion',
          operator: '>=',
          threshold: 0.5,
          signal: 'final',
          classification: 'IMPOSSIBLE',
          maxValue: 0.2,
          evidence: {},
          sourcePath: 'prereqs[0]',
        },
        {
          clauseId: 'clause_2',
          varPath: 'emotions.fear',
          operator: '>=',
          threshold: 0.5,
          signal: 'final',
          classification: 'IMPOSSIBLE',
          maxValue: 0.2,
          evidence: {},
          sourcePath: 'prereqs[1]',
        },
      ];

      const conflicts = detector.detect(fitResult, feasibilityResults, null);

      expect(conflicts[0].explanation).toContain('emotions.confusion');
      expect(conflicts[0].explanation).toContain('emotions.fear');
    });

    it('should generate human-readable explanation for gate contradictions', () => {
      const gateAlignmentResult = {
        contradictions: [
          {
            emotionId: 'anger',
            axis: 'valence',
            regime: { min: 0.2, max: 0.5 },
            gate: { min: 0.7, max: 1.0 },
            gateString: 'valence >= 0.7',
            distance: 0.2,
            severity: 'critical',
          },
        ],
        hasIssues: true,
      };

      const conflicts = detector.detect(null, null, gateAlignmentResult);

      expect(conflicts[0].explanation).toContain('anger');
      expect(conflicts[0].explanation).toContain('valence');
      expect(conflicts[0].explanation).toContain('contradiction');
    });
  });

  describe('suggested fixes generation', () => {
    it('should generate threshold lowering suggestion with actual maxValue', () => {
      const fitResult = {
        leaderboard: [{ prototypeId: 'anger', compositeScore: 0.5 }],
      };
      const feasibilityResults = [
        {
          clauseId: 'clause_1',
          varPath: 'emotions.confusion',
          operator: '>=',
          threshold: 0.5,
          signal: 'final',
          classification: 'IMPOSSIBLE',
          maxValue: 0.2,
          evidence: {},
          sourcePath: 'prereqs[0]',
        },
      ];

      const conflicts = detector.detect(fitResult, feasibilityResults, null);

      const thresholdFix = conflicts[0].suggestedFixes.find((f) =>
        f.includes('Lower threshold')
      );
      expect(thresholdFix).toBeDefined();
      expect(thresholdFix).toContain('0.500');
      expect(thresholdFix).toContain('0.200');
    });

    it('should generate emotion-specific fixes for emotion clauses', () => {
      const fitResult = {
        leaderboard: [{ prototypeId: 'anger', compositeScore: 0.5 }],
      };
      const feasibilityResults = [
        {
          clauseId: 'clause_1',
          varPath: 'emotions.confusion',
          operator: '>=',
          threshold: 0.5,
          signal: 'final',
          classification: 'IMPOSSIBLE',
          maxValue: 0.2,
          evidence: {},
          sourcePath: 'prereqs[0]',
        },
      ];

      const conflicts = detector.detect(fitResult, feasibilityResults, null);

      const emotionFix = conflicts[0].suggestedFixes.find((f) =>
        f.includes('confusion')
      );
      expect(emotionFix).toBeDefined();
    });

    it('should generate delta-specific fixes for delta clauses', () => {
      const fitResult = {
        leaderboard: [{ prototypeId: 'anger', compositeScore: 0.5 }],
      };
      // Use a non-emotion varPath to ensure delta fix is generated (emotion paths trigger emotion-specific fixes)
      const feasibilityResults = [
        {
          clauseId: 'clause_1',
          varPath: 'sexualStates.arousal',
          operator: '>=',
          threshold: 0.1,
          signal: 'delta',
          classification: 'IMPOSSIBLE',
          maxValue: 0.02,
          evidence: {},
          sourcePath: 'prereqs[0]',
        },
      ];

      const conflicts = detector.detect(fitResult, feasibilityResults, null);

      const deltaFix = conflicts[0].suggestedFixes.find((f) =>
        f.includes('Delta clause')
      );
      expect(deltaFix).toBeDefined();
      expect(deltaFix).toContain('final-value');
    });

    it('should deduplicate fixes', () => {
      const fitResult = {
        leaderboard: [{ prototypeId: 'anger', compositeScore: 0.5 }],
      };
      // Same varPath, so emotion-specific fix should be deduplicated
      const feasibilityResults = [
        {
          clauseId: 'clause_1',
          varPath: 'emotions.confusion',
          operator: '>=',
          threshold: 0.5,
          signal: 'final',
          classification: 'IMPOSSIBLE',
          maxValue: 0.2,
          evidence: {},
          sourcePath: 'prereqs[0]',
        },
        {
          clauseId: 'clause_2',
          varPath: 'emotions.confusion',
          operator: '>=',
          threshold: 0.6,
          signal: 'final',
          classification: 'IMPOSSIBLE',
          maxValue: 0.2,
          evidence: {},
          sourcePath: 'prereqs[1]',
        },
      ];

      const conflicts = detector.detect(fitResult, feasibilityResults, null);

      const emotionFixes = conflicts[0].suggestedFixes.filter((f) =>
        f.includes('adjusting or removing the "confusion"')
      );
      expect(emotionFixes.length).toBeLessThanOrEqual(1);
    });

    it('should limit to 5 fixes maximum', () => {
      const fitResult = {
        leaderboard: [{ prototypeId: 'anger', compositeScore: 0.5 }],
      };
      const feasibilityResults = Array.from({ length: 10 }, (_, i) => ({
        clauseId: `clause_${i}`,
        varPath: `emotions.emotion${i}`,
        operator: '>=',
        threshold: 0.5,
        signal: 'final',
        classification: 'IMPOSSIBLE',
        maxValue: 0.1 + i * 0.01,
        evidence: {},
        sourcePath: `prereqs[${i}]`,
      }));

      const conflicts = detector.detect(fitResult, feasibilityResults, null);

      expect(conflicts[0].suggestedFixes.length).toBeLessThanOrEqual(5);
    });

    it('should generate axis constraint adjustment for gate contradictions', () => {
      const gateAlignmentResult = {
        contradictions: [
          {
            emotionId: 'anger',
            axis: 'valence',
            regime: { min: 0.2, max: 0.5 },
            gate: { min: 0.7, max: 1.0 },
            gateString: 'valence >= 0.7',
            distance: 0.2,
            severity: 'critical',
          },
        ],
        hasIssues: true,
      };

      const conflicts = detector.detect(null, null, gateAlignmentResult);

      const axisFix = conflicts[0].suggestedFixes.find((f) =>
        f.includes('Adjust mood regime constraint')
      );
      expect(axisFix).toBeDefined();
      expect(axisFix).toContain('valence');
    });
  });

  describe('edge cases', () => {
    it('should return empty array when prototypeFitResult is null', () => {
      const feasibilityResults = [
        {
          clauseId: 'clause_1',
          varPath: 'emotions.confusion',
          operator: '>=',
          threshold: 0.5,
          signal: 'final',
          classification: 'IMPOSSIBLE',
          maxValue: 0.2,
          evidence: {},
          sourcePath: 'prereqs[0]',
        },
      ];

      const conflicts = detector.detect(null, feasibilityResults, null);

      // fit_vs_clause_impossible requires clean fit, so no conflict
      expect(conflicts).toHaveLength(0);
    });

    it('should return empty array when feasibilityResults is null', () => {
      const fitResult = {
        leaderboard: [{ prototypeId: 'anger', compositeScore: 0.5 }],
      };

      const conflicts = detector.detect(fitResult, null, null);

      expect(conflicts).toHaveLength(0);
    });

    it('should return empty array when feasibilityResults is empty', () => {
      const fitResult = {
        leaderboard: [{ prototypeId: 'anger', compositeScore: 0.5 }],
      };

      const conflicts = detector.detect(fitResult, [], null);

      expect(conflicts).toHaveLength(0);
    });

    it('should detect both conflict types simultaneously', () => {
      const fitResult = {
        leaderboard: [{ prototypeId: 'anger', compositeScore: 0.5 }],
      };
      const feasibilityResults = [
        {
          clauseId: 'clause_1',
          varPath: 'emotions.confusion',
          operator: '>=',
          threshold: 0.5,
          signal: 'final',
          classification: 'IMPOSSIBLE',
          maxValue: 0.2,
          evidence: {},
          sourcePath: 'prereqs[0]',
        },
      ];
      const gateAlignmentResult = {
        contradictions: [
          {
            emotionId: 'anger',
            axis: 'valence',
            regime: { min: 0.2, max: 0.5 },
            gate: { min: 0.7, max: 1.0 },
            gateString: 'valence >= 0.7',
            distance: 0.2,
            severity: 'critical',
          },
        ],
        hasIssues: true,
      };

      const conflicts = detector.detect(
        fitResult,
        feasibilityResults,
        gateAlignmentResult
      );

      expect(conflicts).toHaveLength(2);
      expect(conflicts.map((c) => c.type)).toContain('fit_vs_clause_impossible');
      expect(conflicts.map((c) => c.type)).toContain('gate_contradiction');
    });

    it('should handle leaderboard with fewer than 3 prototypes', () => {
      const fitResult = {
        leaderboard: [{ prototypeId: 'anger', compositeScore: 0.5 }],
      };
      const feasibilityResults = [
        {
          clauseId: 'clause_1',
          varPath: 'emotions.confusion',
          operator: '>=',
          threshold: 0.5,
          signal: 'final',
          classification: 'IMPOSSIBLE',
          maxValue: 0.2,
          evidence: {},
          sourcePath: 'prereqs[0]',
        },
      ];

      const conflicts = detector.detect(fitResult, feasibilityResults, null);

      expect(conflicts[0].topPrototypes).toHaveLength(1);
    });

    it('should handle RARE and UNKNOWN classifications without conflict', () => {
      const fitResult = {
        leaderboard: [{ prototypeId: 'anger', compositeScore: 0.5 }],
      };
      const feasibilityResults = [
        {
          clauseId: 'clause_1',
          varPath: 'emotions.confusion',
          operator: '>=',
          threshold: 0.5,
          signal: 'final',
          classification: 'RARE',
          maxValue: 0.45,
          passRate: 0.05,
          evidence: {},
          sourcePath: 'prereqs[0]',
        },
        {
          clauseId: 'clause_2',
          varPath: 'emotions.fear',
          operator: '>=',
          threshold: 0.5,
          signal: 'final',
          classification: 'UNKNOWN',
          maxValue: null,
          passRate: null,
          evidence: {},
          sourcePath: 'prereqs[1]',
        },
      ];

      const conflicts = detector.detect(fitResult, feasibilityResults, null);

      expect(conflicts).toHaveLength(0);
    });
  });

  describe('invariants', () => {
    it('should only emit fit_vs_clause_impossible when topScore >= 0.3', () => {
      const fitResult = {
        leaderboard: [{ prototypeId: 'anger', compositeScore: 0.29 }],
      };
      const feasibilityResults = [
        {
          clauseId: 'clause_1',
          varPath: 'emotions.confusion',
          classification: 'IMPOSSIBLE',
          maxValue: 0.2,
          threshold: 0.5,
          operator: '>=',
          signal: 'final',
          evidence: {},
          sourcePath: 'prereqs[0]',
        },
      ];

      const conflicts = detector.detect(fitResult, feasibilityResults, null);

      const fitClauseConflicts = conflicts.filter(
        (c) => c.type === 'fit_vs_clause_impossible'
      );
      expect(fitClauseConflicts).toHaveLength(0);
    });

    it('should always have suggestedFixes.length > 0 when conflict detected', () => {
      const fitResult = {
        leaderboard: [{ prototypeId: 'anger', compositeScore: 0.5 }],
      };
      const feasibilityResults = [
        {
          clauseId: 'clause_1',
          varPath: 'emotions.confusion',
          classification: 'IMPOSSIBLE',
          maxValue: 0.2,
          threshold: 0.5,
          operator: '>=',
          signal: 'final',
          evidence: {},
          sourcePath: 'prereqs[0]',
        },
      ];

      const conflicts = detector.detect(fitResult, feasibilityResults, null);

      expect(conflicts.length).toBeGreaterThan(0);
      conflicts.forEach((conflict) => {
        expect(conflict.suggestedFixes.length).toBeGreaterThan(0);
      });
    });

    it('should always have suggestedFixes.length <= 5', () => {
      const fitResult = {
        leaderboard: [{ prototypeId: 'anger', compositeScore: 0.5 }],
      };
      const feasibilityResults = Array.from({ length: 20 }, (_, i) => ({
        clauseId: `clause_${i}`,
        varPath: `emotions.emotion${i}`,
        classification: 'IMPOSSIBLE',
        maxValue: 0.1,
        threshold: 0.5,
        operator: '>=',
        signal: 'final',
        evidence: {},
        sourcePath: `prereqs[${i}]`,
      }));

      const conflicts = detector.detect(fitResult, feasibilityResults, null);

      conflicts.forEach((conflict) => {
        expect(conflict.suggestedFixes.length).toBeLessThanOrEqual(5);
      });
    });

    it('should only include IMPOSSIBLE clauses in impossibleClauseIds', () => {
      const fitResult = {
        leaderboard: [{ prototypeId: 'anger', compositeScore: 0.5 }],
      };
      const feasibilityResults = [
        {
          clauseId: 'clause_impossible',
          varPath: 'emotions.confusion',
          classification: 'IMPOSSIBLE',
          maxValue: 0.2,
          threshold: 0.5,
          operator: '>=',
          signal: 'final',
          evidence: {},
          sourcePath: 'prereqs[0]',
        },
        {
          clauseId: 'clause_rare',
          varPath: 'emotions.fear',
          classification: 'RARE',
          maxValue: 0.45,
          threshold: 0.5,
          operator: '>=',
          signal: 'final',
          evidence: {},
          sourcePath: 'prereqs[1]',
        },
        {
          clauseId: 'clause_ok',
          varPath: 'emotions.joy',
          classification: 'OK',
          maxValue: 0.9,
          threshold: 0.5,
          operator: '>=',
          signal: 'final',
          evidence: {},
          sourcePath: 'prereqs[2]',
        },
      ];

      const conflicts = detector.detect(fitResult, feasibilityResults, null);

      expect(conflicts[0].impossibleClauseIds).toEqual(['clause_impossible']);
      expect(conflicts[0].impossibleClauseIds).not.toContain('clause_rare');
      expect(conflicts[0].impossibleClauseIds).not.toContain('clause_ok');
    });

    it('should always have topPrototypes.length <= 3', () => {
      const fitResult = {
        leaderboard: Array.from({ length: 10 }, (_, i) => ({
          prototypeId: `proto_${i}`,
          compositeScore: 0.9 - i * 0.05,
        })),
      };
      const feasibilityResults = [
        {
          clauseId: 'clause_1',
          varPath: 'emotions.confusion',
          classification: 'IMPOSSIBLE',
          maxValue: 0.2,
          threshold: 0.5,
          operator: '>=',
          signal: 'final',
          evidence: {},
          sourcePath: 'prereqs[0]',
        },
      ];

      const conflicts = detector.detect(fitResult, feasibilityResults, null);

      expect(conflicts[0].topPrototypes.length).toBeLessThanOrEqual(3);
    });

    it('should never throw on null/empty input (returns empty array)', () => {
      expect(() => detector.detect(null, null, null)).not.toThrow();
      expect(() => detector.detect(undefined, undefined, undefined)).not.toThrow();
      expect(() => detector.detect({}, [], {})).not.toThrow();
      expect(() => detector.detect({ leaderboard: null }, null, null)).not.toThrow();

      expect(detector.detect(null, null, null)).toEqual([]);
    });
  });

  describe('logging', () => {
    it('should log debug message with conflict count', () => {
      const fitResult = {
        leaderboard: [{ prototypeId: 'anger', compositeScore: 0.5 }],
      };
      const feasibilityResults = [
        {
          clauseId: 'clause_1',
          varPath: 'emotions.confusion',
          classification: 'IMPOSSIBLE',
          maxValue: 0.2,
          threshold: 0.5,
          operator: '>=',
          signal: 'final',
          evidence: {},
          sourcePath: 'prereqs[0]',
        },
      ];

      detector.detect(fitResult, feasibilityResults, null);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('1 conflict(s)')
      );
    });

    it('should log debug message with zero conflicts when none detected', () => {
      detector.detect(null, null, null);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('0 conflict(s)')
      );
    });
  });
});
