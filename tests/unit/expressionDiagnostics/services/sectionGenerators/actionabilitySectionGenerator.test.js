/**
 * @file Unit tests for ActionabilitySectionGenerator
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActionabilitySectionGenerator from '../../../../../src/expressionDiagnostics/services/sectionGenerators/ActionabilitySectionGenerator.js';

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createMockOrBlockAnalyzer = () => ({
  analyze: jest.fn().mockReturnValue({
    blockId: 'or-1',
    blockDescription: 'Test OR Block',
    alternatives: [],
    deadWeightCount: 0,
    recommendations: [],
    impactSummary: '',
  }),
  analyzeAll: jest.fn().mockReturnValue([]),
});

const createMockWitnessSearcher = () => ({
  search: jest.fn().mockReturnValue({
    found: false,
    bestCandidateState: null,
    andBlockScore: 0,
    blockingClauses: [],
    minimalAdjustments: [],
    searchStats: { samplesEvaluated: 100, timeMs: 50 },
  }),
});

const createMockEditSetGenerator = () => ({
  generate: jest.fn().mockReturnValue({
    targetBand: [0.01, 0.05],
    primaryRecommendation: null,
    alternativeEdits: [],
    notRecommended: [],
  }),
});

const createValidDependencies = () => ({
  logger: createMockLogger(),
  orBlockAnalyzer: createMockOrBlockAnalyzer(),
  witnessSearcher: createMockWitnessSearcher(),
  editSetGenerator: createMockEditSetGenerator(),
});

describe('ActionabilitySectionGenerator', () => {
  describe('constructor validation', () => {
    it('throws when logger is missing', () => {
      const deps = createValidDependencies();
      delete deps.logger;

      expect(() => new ActionabilitySectionGenerator(deps)).toThrow();
    });

    it('throws when orBlockAnalyzer is missing', () => {
      const deps = createValidDependencies();
      delete deps.orBlockAnalyzer;

      expect(() => new ActionabilitySectionGenerator(deps)).toThrow();
    });

    it('throws when witnessSearcher is missing', () => {
      const deps = createValidDependencies();
      delete deps.witnessSearcher;

      expect(() => new ActionabilitySectionGenerator(deps)).toThrow();
    });

    it('throws when editSetGenerator is missing', () => {
      const deps = createValidDependencies();
      delete deps.editSetGenerator;

      expect(() => new ActionabilitySectionGenerator(deps)).toThrow();
    });

    it('constructs successfully with all valid dependencies', () => {
      const deps = createValidDependencies();

      expect(() => new ActionabilitySectionGenerator(deps)).not.toThrow();
    });
  });

  describe('generate()', () => {
    let generator;
    let deps;

    beforeEach(() => {
      deps = createValidDependencies();
      generator = new ActionabilitySectionGenerator(deps);
    });

    it('returns empty section when simulationResult is null', () => {
      const result = generator.generate(null);

      expect(result.sectionTitle).toBe('Actionability Analysis');
      expect(result.orBlockAnalyses).toEqual([]);
      expect(result.witnessResult.found).toBe(false);
      expect(result.editSet.primaryRecommendation).toBeNull();
      expect(result.formatted).toContain('# Actionability Analysis');
      expect(result.formatted).toContain('_No data available._');
    });

    it('returns empty section when simulationResult is undefined', () => {
      const result = generator.generate(undefined);

      expect(result.sectionTitle).toBe('Actionability Analysis');
      expect(result.formatted).toContain('_No data available._');
    });

    it('generates section for zero trigger rate', () => {
      const simulationResult = {
        triggerRate: 0,
        orBlocks: [],
      };

      const result = generator.generate(simulationResult);

      expect(result.sectionTitle).toBe('Actionability Analysis');
      expect(result.formatted.join('\n')).toContain('Zero Trigger Rate');
    });

    it('generates section for very low trigger rate', () => {
      const simulationResult = {
        triggerRate: 0.005,
        orBlocks: [],
      };

      const result = generator.generate(simulationResult);

      expect(result.formatted.join('\n')).toContain('Very Low Trigger Rate');
      expect(result.formatted.join('\n')).toContain('0.50%');
    });

    it('generates section for normal trigger rate', () => {
      const simulationResult = {
        triggerRate: 0.15,
        orBlocks: [],
      };

      const result = generator.generate(simulationResult);

      expect(result.formatted.join('\n')).toContain('Current Trigger Rate');
      expect(result.formatted.join('\n')).toContain('15.00%');
    });

    it('runs witness search for near-zero trigger rate', () => {
      const simulationResult = {
        triggerRate: 0.0005,
        orBlocks: [],
      };

      generator.generate(simulationResult);

      expect(deps.witnessSearcher.search).toHaveBeenCalledWith(simulationResult);
    });

    it('skips witness search for normal trigger rate', () => {
      const simulationResult = {
        triggerRate: 0.1,
        orBlocks: [],
      };

      generator.generate(simulationResult);

      expect(deps.witnessSearcher.search).not.toHaveBeenCalled();
    });

    it('includes OR block analyses in result', () => {
      const mockAnalysis = {
        blockId: 'or-1',
        blockDescription: 'Test OR',
        alternatives: [],
        deadWeightCount: 2,
        recommendations: [
          {
            action: 'delete',
            targetAlternative: 1,
            rationale: 'Dead weight',
          },
        ],
        impactSummary: 'Will improve clarity',
      };
      deps.orBlockAnalyzer.analyzeAll.mockReturnValue([mockAnalysis]);

      const simulationResult = {
        triggerRate: 0.1,
        orBlocks: [{ id: 'or-1' }],
      };

      const result = generator.generate(simulationResult);

      expect(result.orBlockAnalyses).toEqual([mockAnalysis]);
      expect(result.formatted.join('\n')).toContain('OR Block Restructuring');
      expect(result.formatted.join('\n')).toContain('Test OR');
      expect(result.formatted.join('\n')).toContain('Dead-weight alternatives: 2');
    });

    it('includes edit set in result', () => {
      const mockEditSet = {
        targetBand: [0.01, 0.05],
        primaryRecommendation: {
          edits: [
            {
              clauseId: 'clause-1',
              editType: 'threshold',
              before: 0.5,
              after: 0.3,
            },
          ],
          predictedTriggerRate: 0.02,
          confidenceInterval: [0.015, 0.025],
          confidence: 'high',
          validationMethod: 'importance-sampling',
        },
        alternativeEdits: [],
        notRecommended: [],
      };
      deps.editSetGenerator.generate.mockReturnValue(mockEditSet);

      const simulationResult = {
        triggerRate: 0.005,
        orBlocks: [],
      };

      const result = generator.generate(simulationResult);

      expect(result.editSet).toEqual(mockEditSet);
      expect(result.formatted.join('\n')).toContain('Recommended Edits');
      expect(result.formatted.join('\n')).toContain('Primary Recommendation');
      expect(result.formatted.join('\n')).toContain('clause-1');
    });

    it('includes witness result in output when found', () => {
      const mockWitnessResult = {
        found: true,
        bestCandidateState: { emotions: { joy: 0.8 } },
        andBlockScore: 0.85,
        blockingClauses: [
          {
            clauseId: 'clause-1',
            clauseDescription: 'emotions.anger >= 0.5',
            observedValue: 0.4,
            threshold: 0.5,
            gap: 0.1,
          },
        ],
        minimalAdjustments: [
          {
            clauseId: 'clause-1',
            currentThreshold: 0.5,
            suggestedThreshold: 0.4,
            delta: -0.1,
            confidence: 'high',
          },
        ],
        searchStats: { samplesEvaluated: 500, timeMs: 100 },
      };
      deps.witnessSearcher.search.mockReturnValue(mockWitnessResult);

      const simulationResult = {
        triggerRate: 0,
        orBlocks: [],
      };

      const result = generator.generate(simulationResult);

      expect(result.witnessResult).toEqual(mockWitnessResult);
      expect(result.formatted.join('\n')).toContain('Nearest Feasible State');
      expect(result.formatted.join('\n')).toContain('Witness Found');
    });

    it('shows no perfect witness message when not found', () => {
      const mockWitnessResult = {
        found: false,
        bestCandidateState: { emotions: { joy: 0.4 } },
        andBlockScore: 0.6,
        blockingClauses: [],
        minimalAdjustments: [],
        searchStats: { samplesEvaluated: 500, timeMs: 100 },
      };
      deps.witnessSearcher.search.mockReturnValue(mockWitnessResult);

      const simulationResult = {
        triggerRate: 0,
        orBlocks: [],
      };

      const result = generator.generate(simulationResult);

      expect(result.formatted.join('\n')).toContain('No Perfect Witness');
      expect(result.formatted.join('\n')).toContain('60%');
    });

    it('shows no issues message when no problems found', () => {
      const simulationResult = {
        triggerRate: 0.25,
        orBlocks: [],
      };

      const result = generator.generate(simulationResult);

      expect(result.formatted.join('\n')).toContain(
        'No critical actionability issues identified'
      );
    });

    it('handles errors gracefully and returns empty section', () => {
      deps.orBlockAnalyzer.analyzeAll.mockImplementation(() => {
        throw new Error('Analysis failed');
      });

      const simulationResult = {
        triggerRate: 0.1,
        orBlocks: [{ id: 'or-1' }],
      };

      const result = generator.generate(simulationResult);

      expect(result.sectionTitle).toBe('Actionability Analysis');
      expect(result.formatted).toContain('_No data available._');
      expect(deps.logger.error).toHaveBeenCalled();
    });

    it('logs debug message on successful generation', () => {
      const simulationResult = {
        triggerRate: 0.1,
        orBlocks: [],
      };

      generator.generate(simulationResult);

      expect(deps.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('ActionabilitySectionGenerator: Generated section')
      );
    });
  });

  describe('formatting', () => {
    let generator;
    let deps;

    beforeEach(() => {
      deps = createValidDependencies();
      generator = new ActionabilitySectionGenerator(deps);
    });

    it('formats alternative edits section', () => {
      const mockEditSet = {
        targetBand: [0.01, 0.05],
        primaryRecommendation: null,
        alternativeEdits: [
          {
            edits: [
              {
                clauseId: 'clause-2',
                editType: 'structure',
                before: 'AND',
                after: 'OR',
              },
            ],
            predictedTriggerRate: 0.03,
            confidenceInterval: [0.02, 0.04],
            confidence: 'medium',
            validationMethod: 'extrapolation',
          },
        ],
        notRecommended: ['Remove clause-3 (too risky)'],
      };
      deps.editSetGenerator.generate.mockReturnValue(mockEditSet);

      const simulationResult = {
        triggerRate: 0.005,
        orBlocks: [],
      };

      const result = generator.generate(simulationResult);

      expect(result.formatted.join('\n')).toContain('Alternative Approaches');
      expect(result.formatted.join('\n')).toContain('structure');
      expect(result.formatted.join('\n')).toContain('[medium]');
      expect(result.formatted.join('\n')).toContain('Edits Not Recommended');
      expect(result.formatted.join('\n')).toContain('Remove clause-3');
    });

    it('formats blocking clauses from witness search', () => {
      const mockWitnessResult = {
        found: false,
        bestCandidateState: { test: true },
        andBlockScore: 0.7,
        blockingClauses: [
          {
            clauseId: 'blocker-1',
            clauseDescription: 'emotions.fear >= 0.6',
            observedValue: 0.45,
            threshold: 0.6,
            gap: 0.15,
          },
          {
            clauseId: 'blocker-2',
            observedValue: 0.3,
            threshold: 0.5,
            gap: 0.2,
          },
        ],
        minimalAdjustments: [],
        searchStats: { samplesEvaluated: 1000, timeMs: 200 },
      };
      deps.witnessSearcher.search.mockReturnValue(mockWitnessResult);

      const simulationResult = {
        triggerRate: 0,
        orBlocks: [],
      };

      const result = generator.generate(simulationResult);

      expect(result.formatted.join('\n')).toContain('Remaining Blockers');
      expect(result.formatted.join('\n')).toContain('emotions.fear >= 0.6');
      expect(result.formatted.join('\n')).toContain('Observed: 0.45');
      expect(result.formatted.join('\n')).toContain('Gap: 0.15');
    });

    it('formats OR block recommendations', () => {
      const mockAnalysis = {
        blockId: 'or-1',
        blockDescription: 'Emotion alternatives',
        alternatives: [],
        deadWeightCount: 1,
        recommendations: [
          {
            action: 'lower-threshold',
            targetAlternative: 2,
            suggestedValue: 0.3,
            rationale: 'Currently unreachable',
          },
        ],
        impactSummary: 'May improve trigger rate by 5%',
      };
      deps.orBlockAnalyzer.analyzeAll.mockReturnValue([mockAnalysis]);

      const simulationResult = {
        triggerRate: 0.1,
        orBlocks: [{ id: 'or-1' }],
      };

      const result = generator.generate(simulationResult);

      expect(result.formatted.join('\n')).toContain('lower-threshold');
      expect(result.formatted.join('\n')).toContain('alternative 2');
      expect(result.formatted.join('\n')).toContain('Currently unreachable');
      expect(result.formatted.join('\n')).toContain('Suggested value: 0.3');
    });

    it('limits blocking clauses shown to 5', () => {
      const blockingClauses = [];
      for (let i = 0; i < 10; i++) {
        blockingClauses.push({
          clauseId: `blocker-${i}`,
          clauseDescription: `Clause ${i}`,
          observedValue: 0.1 * i,
          threshold: 0.5,
          gap: 0.5 - 0.1 * i,
        });
      }

      const mockWitnessResult = {
        found: false,
        bestCandidateState: { test: true },
        andBlockScore: 0.5,
        blockingClauses,
        minimalAdjustments: [],
        searchStats: { samplesEvaluated: 100, timeMs: 50 },
      };
      deps.witnessSearcher.search.mockReturnValue(mockWitnessResult);

      const simulationResult = {
        triggerRate: 0,
        orBlocks: [],
      };

      const result = generator.generate(simulationResult);
      const formattedText = result.formatted.join('\n');

      // Should show first 5 blockers
      expect(formattedText).toContain('Clause 0');
      expect(formattedText).toContain('Clause 4');
      // Should not show blockers beyond 5
      expect(formattedText).not.toContain('Clause 5');
      expect(formattedText).not.toContain('Clause 9');
    });
  });

  describe('config integration', () => {
    it('respects disabled orBlockAnalysis in config', () => {
      const deps = createValidDependencies();
      const customConfig = {
        orBlockAnalysis: { enabled: false },
        witnessSearch: { enabled: true },
        editSetGeneration: { enabled: true },
      };

      const generator = new ActionabilitySectionGenerator({
        ...deps,
        config: customConfig,
      });

      const simulationResult = {
        triggerRate: 0.1,
        orBlocks: [{ id: 'or-1' }],
      };

      generator.generate(simulationResult);

      expect(deps.orBlockAnalyzer.analyzeAll).not.toHaveBeenCalled();
    });

    it('respects disabled witnessSearch in config', () => {
      const deps = createValidDependencies();
      const customConfig = {
        orBlockAnalysis: { enabled: true },
        witnessSearch: { enabled: false },
        editSetGeneration: { enabled: true },
      };

      const generator = new ActionabilitySectionGenerator({
        ...deps,
        config: customConfig,
      });

      const simulationResult = {
        triggerRate: 0,
        orBlocks: [],
      };

      generator.generate(simulationResult);

      expect(deps.witnessSearcher.search).not.toHaveBeenCalled();
    });

    it('respects disabled editSetGeneration in config', () => {
      const deps = createValidDependencies();
      const customConfig = {
        orBlockAnalysis: { enabled: true },
        witnessSearch: { enabled: true },
        editSetGeneration: { enabled: false },
      };

      const generator = new ActionabilitySectionGenerator({
        ...deps,
        config: customConfig,
      });

      const simulationResult = {
        triggerRate: 0.1,
        orBlocks: [],
      };

      generator.generate(simulationResult);

      expect(deps.editSetGenerator.generate).not.toHaveBeenCalled();
    });
  });
});
