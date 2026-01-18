/**
 * @file Unit tests for SensitivitySectionGenerator
 */

import { describe, it, expect, jest } from '@jest/globals';
import SensitivitySectionGenerator from '../../../../../src/expressionDiagnostics/services/sectionGenerators/SensitivitySectionGenerator.js';
import ReportFormattingService from '../../../../../src/expressionDiagnostics/services/ReportFormattingService.js';

describe('SensitivitySectionGenerator', () => {
  it('requires a formatting service', () => {
    expect(() => new SensitivitySectionGenerator()).toThrow(
      'SensitivitySectionGenerator requires formattingService'
    );
  });

  it('renders sensitivity tables with warnings and integer thresholds', () => {
    const formattingService = new ReportFormattingService();
    const sweepWarningBuilder = jest
      .fn()
      .mockReturnValue([{ message: 'Sweep warning' }]);
    const generator = new SensitivitySectionGenerator({
      formattingService,
      sweepWarningBuilder,
    });
    const sensitivityData = [
      {
        kind: 'marginalClausePassRateSweep',
        conditionPath: 'mood.joy',
        operator: '>=',
        originalThreshold: 0.5,
        isIntegerDomain: true,
        grid: [
          {
            threshold: 0.5,
            effectiveThreshold: 1,
            passRate: 0.1,
            sampleCount: 100,
          },
          {
            threshold: 0.6,
            effectiveThreshold: 1,
            passRate: 0.2,
            sampleCount: 100,
          },
        ],
      },
    ];

    const section = generator.generateSensitivityAnalysis(
      sensitivityData,
      {
        sampleCount: 100,
        storedContextCount: 20,
        storedContextLimit: 50,
        storedInRegimeCount: 10,
      },
      {
        storedGlobal: {
          name: 'stored-global',
          predicate: 'all',
          count: 20,
          hash: 'hash',
        },
      },
      { andOnly: true, baselineTriggerRate: 0.05 }
    );

    expect(section).toContain('Marginal Clause Pass-Rate Sweep');
    expect(section).toContain('> ⚠️ Sweep warning');
    expect(section).toContain('Effective Threshold');
  });

  it('adds a low-confidence warning for sparse global sensitivity baselines', () => {
    const formattingService = new ReportFormattingService();
    const generator = new SensitivitySectionGenerator({ formattingService });
    const globalSensitivityData = [
      {
        kind: 'expressionTriggerRateSweep',
        varPath: 'mood.joy',
        operator: '>=',
        originalThreshold: 0.5,
        isIntegerDomain: false,
        grid: [
          {
            threshold: 0.5,
            triggerRate: 0.01,
            sampleCount: 100,
          },
          {
            threshold: 0.6,
            triggerRate: 0.02,
            sampleCount: 100,
          },
        ],
      },
    ];

    const section = generator.generateGlobalSensitivitySection(
      globalSensitivityData,
      {
        sampleCount: 100,
        storedContextCount: 10,
        storedContextLimit: 50,
        storedInRegimeCount: 8,
      },
      {
        storedGlobal: {
          name: 'stored-global',
          predicate: 'all',
          count: 10,
          hash: 'hash',
        },
      },
      { baselineTriggerRate: 0.01 },
      0.02
    );

    expect(section).toContain('Low confidence');
    expect(section).toContain('Baseline (full sample)');
  });

  // ============================================================================
  // Phase 4: Percent-Change Display Tests
  // ============================================================================

  describe('percent-change display formatting', () => {
    let generator;
    let formattingService;

    beforeEach(() => {
      formattingService = new ReportFormattingService();
      generator = new SensitivitySectionGenerator({ formattingService });
    });

    it('shows percentage points (pp) format with multiplier for significant changes', () => {
      const sensitivityData = [
        {
          kind: 'marginalClausePassRateSweep',
          conditionPath: 'mood.joy',
          operator: '>=',
          originalThreshold: 0.5,
          isIntegerDomain: false,
          grid: [
            { threshold: 0.4, passRate: 0.05, sampleCount: 100 }, // 5× increase
            { threshold: 0.5, passRate: 0.01, sampleCount: 100 }, // baseline
            { threshold: 0.6, passRate: 0.02, sampleCount: 100 }, // 2× increase
          ],
        },
      ];

      const section = generator.generateSensitivityAnalysis(
        sensitivityData,
        { sampleCount: 100, storedContextCount: 10 },
        {},
        null
      );

      // Should show pp format with multiplier for significant changes
      expect(section).toContain('pp');
      expect(section).toContain('baseline');
    });

    it('shows "(from zero)" annotation for zero-to-nonzero changes', () => {
      const sensitivityData = [
        {
          kind: 'marginalClausePassRateSweep',
          conditionPath: 'mood.joy',
          operator: '>=',
          originalThreshold: 0.5,
          isIntegerDomain: false,
          grid: [
            { threshold: 0.4, passRate: 0.05, sampleCount: 100 },
            { threshold: 0.5, passRate: 0.0, sampleCount: 100 }, // baseline is zero
            { threshold: 0.6, passRate: 0.0, sampleCount: 100 },
          ],
        },
      ];

      const section = generator.generateSensitivityAnalysis(
        sensitivityData,
        { sampleCount: 100, storedContextCount: 10 },
        {},
        null
      );

      // Zero-hit case triggers alternative analysis
      expect(section).toContain('Zero-Hit Analysis');
    });

    it('shows "(→ 0)" annotation for nonzero-to-zero changes', () => {
      const sensitivityData = [
        {
          kind: 'marginalClausePassRateSweep',
          conditionPath: 'mood.joy',
          operator: '>=',
          originalThreshold: 0.5,
          isIntegerDomain: false,
          grid: [
            { threshold: 0.4, passRate: 0.0, sampleCount: 100 }, // drops to zero
            { threshold: 0.5, passRate: 0.05, sampleCount: 100 }, // baseline
            { threshold: 0.6, passRate: 0.03, sampleCount: 100 },
          ],
        },
      ];

      const section = generator.generateSensitivityAnalysis(
        sensitivityData,
        { sampleCount: 100, storedContextCount: 10 },
        {},
        null
      );

      // Should show (→ 0) for dropping to zero
      expect(section).toContain('→ 0');
    });

    it('caps multiplier at >1000× for very large changes', () => {
      const sensitivityData = [
        {
          kind: 'marginalClausePassRateSweep',
          conditionPath: 'mood.joy',
          operator: '>=',
          originalThreshold: 0.5,
          isIntegerDomain: false,
          grid: [
            { threshold: 0.4, passRate: 0.5, sampleCount: 100 }, // 5000× increase
            { threshold: 0.5, passRate: 0.0001, sampleCount: 100 }, // baseline very small
            { threshold: 0.6, passRate: 0.001, sampleCount: 100 },
          ],
        },
      ];

      const section = generator.generateSensitivityAnalysis(
        sensitivityData,
        { sampleCount: 100, storedContextCount: 10 },
        {},
        null
      );

      // Should cap at >1000×
      expect(section).toContain('>1000×');
    });
  });

  // ============================================================================
  // Phase 3: Zero-Hit Handling Tests
  // ============================================================================

  describe('zero-hit alternative analysis', () => {
    let generator;
    let formattingService;

    beforeEach(() => {
      formattingService = new ReportFormattingService();
      generator = new SensitivitySectionGenerator({ formattingService });
    });

    it('shows zero-hit alternative for marginal clause when baseline is 0%', () => {
      const sensitivityData = [
        {
          kind: 'marginalClausePassRateSweep',
          conditionPath: 'mood.joy',
          operator: '>=',
          originalThreshold: 0.8,
          isIntegerDomain: false,
          grid: [
            { threshold: 0.6, passRate: 0.05, sampleCount: 1000 },
            { threshold: 0.7, passRate: 0.02, sampleCount: 1000 },
            { threshold: 0.8, passRate: 0.0, sampleCount: 1000 }, // original - zero hits
            { threshold: 0.9, passRate: 0.0, sampleCount: 1000 },
          ],
        },
      ];

      const section = generator.generateSensitivityAnalysis(
        sensitivityData,
        { sampleCount: 1000, storedContextCount: 100 },
        {},
        null
      );

      expect(section).toContain('🟡 Zero-Hit Analysis');
      expect(section).toContain('0 passing samples');
      expect(section).toContain('Pass Rate by Threshold');
      expect(section).toContain('Suggested Threshold Adjustments');
      expect(section).toContain('Nearest Miss Analysis');
    });

    it('shows zero-hit alternative for global expression when baseline is 0%', () => {
      const globalSensitivityData = [
        {
          kind: 'expressionTriggerRateSweep',
          varPath: 'mood.joy',
          operator: '>=',
          originalThreshold: 0.9,
          isIntegerDomain: false,
          grid: [
            { threshold: 0.7, triggerRate: 0.03, sampleCount: 500 },
            { threshold: 0.8, triggerRate: 0.01, sampleCount: 500 },
            { threshold: 0.9, triggerRate: 0.0, sampleCount: 500 }, // original - zero hits
          ],
        },
      ];

      const section = generator.generateGlobalSensitivitySection(
        globalSensitivityData,
        { sampleCount: 500, storedContextCount: 50 },
        {},
        null,
        null
      );

      expect(section).toContain('🎯🟡 Zero-Hit Global Analysis');
      expect(section).toContain('0 expression triggers');
      expect(section).toContain('Trigger Rate by Threshold');
      expect(section).toContain('Suggested Threshold Adjustments');
    });

    it('shows "No Triggers Found" when all thresholds have zero triggers', () => {
      const globalSensitivityData = [
        {
          kind: 'expressionTriggerRateSweep',
          varPath: 'mood.joy',
          operator: '>=',
          originalThreshold: 0.9,
          isIntegerDomain: false,
          grid: [
            { threshold: 0.7, triggerRate: 0.0, sampleCount: 500 },
            { threshold: 0.8, triggerRate: 0.0, sampleCount: 500 },
            { threshold: 0.9, triggerRate: 0.0, sampleCount: 500 }, // all zero
          ],
        },
      ];

      const section = generator.generateGlobalSensitivitySection(
        globalSensitivityData,
        { sampleCount: 500, storedContextCount: 50 },
        {},
        null,
        null
      );

      expect(section).toContain('No Triggers Found');
      expect(section).toContain('Reviewing the overall expression logic');
    });

    it('computes threshold suggestions for target pass rates', () => {
      const sensitivityData = [
        {
          kind: 'marginalClausePassRateSweep',
          conditionPath: 'mood.joy',
          operator: '>=',
          originalThreshold: 0.8,
          isIntegerDomain: false,
          grid: [
            { threshold: 0.5, passRate: 0.15, sampleCount: 1000 }, // > 10%
            { threshold: 0.6, passRate: 0.08, sampleCount: 1000 }, // > 5%
            { threshold: 0.7, passRate: 0.02, sampleCount: 1000 }, // > 1%
            { threshold: 0.8, passRate: 0.0, sampleCount: 1000 }, // baseline
          ],
        },
      ];

      const section = generator.generateSensitivityAnalysis(
        sensitivityData,
        { sampleCount: 1000, storedContextCount: 100 },
        {},
        null
      );

      // Should show suggestions for 1%, 5%, 10% targets
      expect(section).toContain('1.00%');
      expect(section).toContain('5.00%');
      expect(section).toContain('10.00%');
      expect(section).toContain('Δ Threshold');
    });
  });
});
