/**
 * @file Unit tests for PrototypeSectionGenerator
 */

import { describe, it, expect, jest } from '@jest/globals';
import PrototypeSectionGenerator from '../../../../../src/expressionDiagnostics/services/sectionGenerators/PrototypeSectionGenerator.js';
import ReportFormattingService from '../../../../../src/expressionDiagnostics/services/ReportFormattingService.js';

/**
 * Helper to create minimal fit results for testing.
 * @param {string} prototypeId
 * @param {string} type
 * @returns {object}
 */
function createMinimalFitResult(prototypeId = 'joy', type = 'emotion') {
  return {
    prototypeId,
    type,
    rank: 1,
    gatePassRate: 0.8,
    intensityDistribution: { pAboveThreshold: 0.6 },
    conflictScore: 0.1,
    compositeScore: 0.7,
    conflictingAxes: [],
    conflictMagnitude: 0.0,
  };
}

describe('PrototypeSectionGenerator', () => {
  it('requires a formatting service', () => {
    expect(() => new PrototypeSectionGenerator()).toThrow(
      'PrototypeSectionGenerator requires formattingService'
    );
  });

  it('returns leaderboard results from performPrototypeFitAnalysis', () => {
    const formattingService = new ReportFormattingService();
    const leaderboard = [
      {
        prototypeId: 'joy',
        rank: 1,
        gatePassRate: 0.9,
        intensityDistribution: { pAboveThreshold: 0.7 },
        conflictScore: 0.1,
        compositeScore: 0.95,
        conflictingAxes: [],
        conflictMagnitude: 0.0,
      },
    ];
    const mockService = {
      analyzeAllPrototypeFit: jest.fn().mockReturnValue({ leaderboard }),
      computeImpliedPrototype: jest.fn().mockReturnValue({
        targetSignature: new Map(),
        bySimilarity: [],
        byGatePass: [],
        byCombined: [],
      }),
      detectPrototypeGaps: jest.fn().mockReturnValue({ gapDetected: false }),
    };

    const generator = new PrototypeSectionGenerator({
      formattingService,
      prototypeFitRankingService: mockService,
    });

    const result = generator.performPrototypeFitAnalysis([
      { condition: 'test' },
    ]);

    expect(result.fitResults).toEqual(leaderboard);
    expect(mockService.analyzeAllPrototypeFit).toHaveBeenCalled();
  });

  it('renders type column when sexual prototypes are present', () => {
    const formattingService = new ReportFormattingService();
    const generator = new PrototypeSectionGenerator({ formattingService });

    const section = generator.generatePrototypeFitSection(
      [
        {
          prototypeId: 'sexual_lust',
          type: 'sexual',
          rank: 1,
          gatePassRate: 0.8,
          intensityDistribution: { pAboveThreshold: 0.6 },
          conflictScore: 0.1,
          compositeScore: 0.7,
          conflictingAxes: [],
          conflictMagnitude: 0.0,
        },
      ],
      null,
      null,
      false
    );

    expect(section).toContain('Type');
    expect(section).toContain('sexual_lust');
  });

  describe('scope metadata header', () => {
    it('contains [AXIS-ONLY FIT] badge in prototype fit section', () => {
      const formattingService = new ReportFormattingService();
      const generator = new PrototypeSectionGenerator({ formattingService });

      const section = generator.generatePrototypeFitSection(
        [createMinimalFitResult()],
        null,
        null,
        false
      );

      expect(section).toContain('[AXIS-ONLY FIT]');
    });

    it('contains [IN-REGIME] badge in prototype fit section', () => {
      const formattingService = new ReportFormattingService();
      const generator = new PrototypeSectionGenerator({ formattingService });

      const section = generator.generatePrototypeFitSection(
        [createMinimalFitResult()],
        null,
        null,
        false
      );

      expect(section).toContain('[IN-REGIME]');
    });

    it('contains scope description about axis constraints', () => {
      const formattingService = new ReportFormattingService();
      const generator = new PrototypeSectionGenerator({ formattingService });

      const section = generator.generatePrototypeFitSection(
        [createMinimalFitResult()],
        null,
        null,
        false
      );

      expect(section).toContain(
        'Computed from mood-regime axis constraints only (emotion clauses not enforced).'
      );
    });

    it('positions scope header after section description and before table', () => {
      const formattingService = new ReportFormattingService();
      const generator = new PrototypeSectionGenerator({ formattingService });

      const section = generator.generatePrototypeFitSection(
        [createMinimalFitResult()],
        null,
        null,
        false
      );

      // Find positions in the output
      const descriptionPos = section.indexOf(
        'Ranking of emotion prototypes by how well they fit'
      );
      const scopeBadgePos = section.indexOf('[AXIS-ONLY FIT]');
      const tableHeaderPos = section.indexOf('| Rank | Prototype |');

      // Verify ordering: description < scope header < table
      expect(descriptionPos).toBeLessThan(scopeBadgePos);
      expect(scopeBadgePos).toBeLessThan(tableHeaderPos);
    });
  });
});
