/**
 * @file Integration tests for ReportIntegrityAnalyzer
 * @description Tests full warning collection flow with real service dependencies
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ReportIntegrityAnalyzer from '../../../src/expressionDiagnostics/services/ReportIntegrityAnalyzer.js';
import ReportFormattingService from '../../../src/expressionDiagnostics/services/ReportFormattingService.js';
import StatisticalComputationService from '../../../src/expressionDiagnostics/services/StatisticalComputationService.js';
import BlockerTreeTraversal from '../../../src/expressionDiagnostics/services/BlockerTreeTraversal.js';
import ReportDataExtractor from '../../../src/expressionDiagnostics/services/ReportDataExtractor.js';

const createMockLogger = () => ({
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
});

describe('ReportIntegrityAnalyzer integration', () => {
  let analyzer;
  let formattingService;
  let statisticalService;
  let treeTraversal;
  let dataExtractor;
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    formattingService = new ReportFormattingService();
    statisticalService = new StatisticalComputationService();
    treeTraversal = new BlockerTreeTraversal();
    dataExtractor = new ReportDataExtractor({
      logger,
      prototypeConstraintAnalyzer: null,
    });

    analyzer = new ReportIntegrityAnalyzer({
      formattingService,
      statisticalService,
      treeTraversal,
      dataExtractor,
      logger,
    });
  });

  describe('sweep warning flow', () => {
    it('should detect non-monotonic sweep in sensitivity data', () => {
      const sensitivityData = [
        {
          kind: 'marginalClausePassRateSweep',
          conditionPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.3,
          grid: [
            { threshold: 0.1, passRate: 0.8, sampleCount: 100 },
            { threshold: 0.2, passRate: 0.7, sampleCount: 100 },
            { threshold: 0.3, passRate: 0.9, sampleCount: 100 },
            { threshold: 0.4, passRate: 0.4, sampleCount: 100 },
          ],
        },
      ];

      const warnings = analyzer.collect({
        blockers: [],
        axisConstraints: new Map(),
        storedContexts: [],
        moodConstraints: [],
        storedPopulations: {},
        simulationResult: {},
        sensitivityData,
        globalSensitivityData: [],
      });

      const monotonicWarning = warnings.find(
        (w) => w.code === 'S4_SWEEP_NON_MONOTONIC'
      );
      expect(monotonicWarning).toBeDefined();
      expect(monotonicWarning.signal).toBe('emotions.joy');
      expect(monotonicWarning.details.operator).toBe('>=');
    });

    it('should detect S1 trigger exceeds clause pass when conditions met', () => {
      const blockers = [
        {
          clauseDescription: 'emotions.joy >= 0.5',
          type: 'and',
          children: [],
          hierarchicalBreakdown: {
            nodeType: 'and',
            children: [
              {
                nodeType: 'leaf',
                condition: 'emotions.joy >= 0.5',
              },
            ],
          },
        },
      ];

      const sensitivityData = [
        {
          kind: 'marginalClausePassRateSweep',
          conditionPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.5,
          grid: [
            { threshold: 0.4, passRate: 0.6, sampleCount: 100 },
            { threshold: 0.5, passRate: 0.3, sampleCount: 100 },
            { threshold: 0.6, passRate: 0.2, sampleCount: 100 },
          ],
        },
      ];

      const globalSensitivityData = [
        {
          kind: 'expressionTriggerRateSweep',
          varPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.5,
          grid: [
            { threshold: 0.5, triggerRate: 0.5, sampleCount: 100 },
          ],
        },
      ];

      const warnings = analyzer.collect({
        blockers,
        axisConstraints: new Map(),
        storedContexts: [],
        moodConstraints: [],
        storedPopulations: {},
        simulationResult: {},
        sensitivityData,
        globalSensitivityData,
      });

      const s1Warning = warnings.find(
        (w) => w.code === 'S1_TRIGGER_EXCEEDS_CLAUSE_PASS'
      );
      expect(s1Warning).toBeDefined();
    });
  });

  describe('mood regime hash mismatch', () => {
    it('should detect hash mismatch between report and simulation metadata', () => {
      const storedContexts = [
        { moodAxes: { valence: 50 }, emotions: { joy: 0.3 } },
      ];

      const storedPopulations = {
        storedMoodRegime: { hash: 'report-hash-123', sampleIds: [0] },
      };

      const simulationResult = {
        storedContexts,
        populationMeta: {
          storedMoodRegime: { hash: 'simulation-hash-456' },
        },
      };

      const warnings = analyzer.collect({
        blockers: [],
        axisConstraints: new Map(),
        storedContexts,
        moodConstraints: [],
        storedPopulations,
        simulationResult,
      });

      const hashWarning = warnings.find(
        (w) => w.code === 'I5_MOOD_REGIME_HASH_MISMATCH'
      );
      expect(hashWarning).toBeDefined();
      expect(hashWarning.details.reportHash).toBe('report-hash-123');
      expect(hashWarning.details.simulationHash).toBe('simulation-hash-456');
    });
  });

  describe('warning deduplication', () => {
    it('should not duplicate identical warnings', () => {
      const sensitivityData = [
        {
          conditionPath: 'test.var',
          operator: '>=',
          originalThreshold: 0.5,
          populationHash: 'pop-1',
          grid: [
            { threshold: 0.4, passRate: 0.6 },
            { threshold: 0.5, passRate: 0.7 },
            { threshold: 0.6, passRate: 0.5 },
          ],
        },
        {
          conditionPath: 'test.var',
          operator: '>=',
          originalThreshold: 0.5,
          populationHash: 'pop-1',
          grid: [
            { threshold: 0.4, passRate: 0.6 },
            { threshold: 0.5, passRate: 0.7 },
            { threshold: 0.6, passRate: 0.5 },
          ],
        },
      ];

      const warnings = analyzer.collect({
        blockers: [],
        axisConstraints: new Map(),
        storedContexts: [],
        moodConstraints: [],
        storedPopulations: {},
        simulationResult: {},
        sensitivityData,
      });

      const s4Warnings = warnings.filter(
        (w) => w.code === 'S4_SWEEP_NON_MONOTONIC' && w.signal === 'test.var'
      );
      expect(s4Warnings.length).toBe(1);
    });

    it('should keep warnings with different population hashes', () => {
      const sensitivityData = [
        {
          conditionPath: 'test.var',
          operator: '>=',
          populationHash: 'pop-1',
          grid: [
            { threshold: 0.4, passRate: 0.6 },
            { threshold: 0.5, passRate: 0.7 },
          ],
        },
        {
          conditionPath: 'test.var',
          operator: '>=',
          populationHash: 'pop-2',
          grid: [
            { threshold: 0.4, passRate: 0.6 },
            { threshold: 0.5, passRate: 0.7 },
          ],
        },
      ];

      const warnings = analyzer.collect({
        blockers: [],
        axisConstraints: new Map(),
        storedContexts: [],
        moodConstraints: [],
        storedPopulations: {},
        simulationResult: {},
        sensitivityData,
      });

      const s4Warnings = warnings.filter(
        (w) => w.code === 'S4_SWEEP_NON_MONOTONIC'
      );
      expect(s4Warnings.length).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty inputs gracefully', () => {
      const warnings = analyzer.collect({
        blockers: [],
        axisConstraints: new Map(),
        storedContexts: [],
        moodConstraints: [],
        storedPopulations: {},
        simulationResult: {},
      });

      expect(warnings).toEqual([]);
    });

    it('should handle null sensitivityData', () => {
      const warnings = analyzer.collect({
        blockers: [],
        axisConstraints: new Map(),
        storedContexts: [],
        moodConstraints: [],
        storedPopulations: {},
        simulationResult: {},
        sensitivityData: null,
        globalSensitivityData: null,
      });

      expect(warnings).toEqual([]);
    });

    it('should handle malformed sensitivity results', () => {
      const sensitivityData = [
        null,
        undefined,
        {},
        { grid: null },
        { grid: [] },
      ];

      const warnings = analyzer.collect({
        blockers: [],
        axisConstraints: new Map(),
        storedContexts: [],
        moodConstraints: [],
        storedPopulations: {},
        simulationResult: {},
        sensitivityData,
      });

      expect(warnings).toEqual([]);
    });
  });
});
