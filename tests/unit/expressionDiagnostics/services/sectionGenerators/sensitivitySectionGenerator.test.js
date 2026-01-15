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
});
