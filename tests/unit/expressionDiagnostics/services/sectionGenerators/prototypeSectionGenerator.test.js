/**
 * @file Unit tests for PrototypeSectionGenerator
 */

import { describe, it, expect, jest } from '@jest/globals';
import PrototypeSectionGenerator from '../../../../../src/expressionDiagnostics/services/sectionGenerators/PrototypeSectionGenerator.js';
import ReportFormattingService from '../../../../../src/expressionDiagnostics/services/ReportFormattingService.js';

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
});
