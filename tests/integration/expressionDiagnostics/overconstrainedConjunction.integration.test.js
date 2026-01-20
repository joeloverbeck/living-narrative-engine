/**
 * @file Integration tests for overconstrained conjunction detection feature.
 * Tests the full flow from MonteCarloReportGenerator through to recommendations.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloReportGenerator from '../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';
import EmotionSimilarityService from '../../../src/expressionDiagnostics/services/EmotionSimilarityService.js';
import CoreSectionGenerator from '../../../src/expressionDiagnostics/services/sectionGenerators/CoreSectionGenerator.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

/**
 * Creates mock services for CoreSectionGenerator.
 */
const createCoreSectionGeneratorMocks = () => ({
  formattingService: {
    formatPercentage: jest.fn((v) => `${(v * 100).toFixed(1)}%`),
    formatDecimal: jest.fn((v) => v.toFixed(4)),
  },
  witnessFormatter: {
    format: jest.fn(() => ''),
  },
  statisticalService: {
    computeStats: jest.fn(() => ({})),
  },
  dataExtractor: {
    extractClauseData: jest.fn(() => []),
  },
});

/**
 * Creates a mock prototype registry with emotion prototypes that have weight vectors.
 * This simulates realistic emotion prototype data for similarity calculations.
 */
const createMockPrototypeRegistry = (emotionWeights = {}) => {
  const defaultWeights = {
    guilt: { valence: -0.6, arousal: 0.3, dominance: -0.4 },
    remorse: { valence: -0.5, arousal: 0.2, dominance: -0.3 },
    shame: { valence: -0.55, arousal: 0.25, dominance: -0.35 },
    joy: { valence: 0.8, arousal: 0.5, dominance: 0.3 },
    terror: { valence: -0.9, arousal: 0.9, dominance: -0.7 },
    disgust: { valence: -0.7, arousal: 0.4, dominance: 0.0 },
    contempt: { valence: -0.6, arousal: 0.2, dominance: 0.4 },
    ...emotionWeights,
  };

  const prototypes = Object.entries(defaultWeights).map(([id, weights]) => ({
    id,
    type: 'emotion',
    weights,
  }));

  return {
    getPrototypesByType: jest.fn((type) =>
      prototypes.filter((p) => p.type === type)
    ),
  };
};

/**
 * Creates a simulation result with overconstrained AND conjunction.
 * This simulates the blocker hierarchy with low-pass emotion threshold children.
 */
const createOverconstrainedSimulationResult = () => ({
  successRate: 0.001,
  failureRate: 0.999,
  sampleCount: 1000,
  storedContexts: [],
  hierarchicalBreakdown: {
    nodeType: 'and',
    clauseId: 'root_and',
    children: [
      {
        nodeType: 'leaf',
        clauseId: 'var:emotions.guilt:>=:0.45',
        variablePath: 'emotions.guilt',
        inRegimePassRate: 0.08,
        thresholdValue: 0.45,
        comparisonOperator: '>=',
      },
      {
        nodeType: 'leaf',
        clauseId: 'var:emotions.shame:>=:0.50',
        variablePath: 'emotions.shame',
        inRegimePassRate: 0.06,
        thresholdValue: 0.50,
        comparisonOperator: '>=',
      },
      {
        nodeType: 'leaf',
        clauseId: 'var:emotions.disgust:>=:0.40',
        variablePath: 'emotions.disgust',
        inRegimePassRate: 0.09,
        thresholdValue: 0.40,
        comparisonOperator: '>=',
      },
    ],
  },
});

/**
 * Creates a normal simulation result without overconstrained patterns.
 */
const createNormalSimulationResult = () => ({
  successRate: 0.45,
  failureRate: 0.55,
  sampleCount: 1000,
  storedContexts: [],
  hierarchicalBreakdown: {
    nodeType: 'and',
    clauseId: 'root_and',
    children: [
      {
        nodeType: 'leaf',
        clauseId: 'var:emotions.joy:>=:0.20',
        variablePath: 'emotions.joy',
        inRegimePassRate: 0.60,
        thresholdValue: 0.20,
        comparisonOperator: '>=',
      },
      {
        nodeType: 'leaf',
        clauseId: 'var:mood.valence:>=:0.30',
        variablePath: 'mood.valence',
        inRegimePassRate: 0.75,
        thresholdValue: 0.30,
        comparisonOperator: '>=',
      },
    ],
  },
});

describe('Overconstrained Conjunction Detection - Integration', () => {
  let logger;

  beforeEach(() => {
    logger = createLogger();
  });

  describe('Full simulation flow with detection', () => {
    it('should detect and report overconstrained expression in full flow', () => {
      const prototypeRegistry = createMockPrototypeRegistry();
      const emotionSimilarityService = new EmotionSimilarityService({
        prototypeRegistryService: prototypeRegistry,
        logger,
      });

      const reportGenerator = new MonteCarloReportGenerator({
        logger,
        emotionSimilarityService,
      });

      const simulationResult = createOverconstrainedSimulationResult();
      const expressionName = 'test:overconstrained-expression';
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.guilt' }, 0.45] },
              { '>=': [{ var: 'emotions.shame' }, 0.50] },
              { '>=': [{ var: 'emotions.disgust' }, 0.40] },
            ],
          },
        },
      ];

      const report = reportGenerator.generate({
        expressionName,
        simulationResult,
        blockers: [simulationResult.hierarchicalBreakdown],
        summary: '',
        prerequisites,
      });

      // Verify report contains overconstrained warning
      expect(report).toContain('Recommendations');
      expect(report).toContain('Overconstrained');
    });

    it('should not produce false positives for normal expressions', () => {
      const prototypeRegistry = createMockPrototypeRegistry();
      const emotionSimilarityService = new EmotionSimilarityService({
        prototypeRegistryService: prototypeRegistry,
        logger,
      });

      const reportGenerator = new MonteCarloReportGenerator({
        logger,
        emotionSimilarityService,
      });

      const simulationResult = createNormalSimulationResult();
      const expressionName = 'test:normal-expression';
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.20] },
              { '>=': [{ var: 'mood.valence' }, 0.30] },
            ],
          },
        },
      ];

      const report = reportGenerator.generate({
        expressionName,
        simulationResult,
        blockers: [simulationResult.hierarchicalBreakdown],
        summary: '',
        prerequisites,
      });

      // Normal expressions should not contain overconstrained warnings
      expect(report).not.toContain('Overconstrained Conjunction');
    });
  });

  describe('EmotionSimilarityService integration', () => {
    it('should find similar emotions from prototype weight vectors', () => {
      const prototypeRegistry = createMockPrototypeRegistry();
      const emotionSimilarityService = new EmotionSimilarityService({
        prototypeRegistryService: prototypeRegistry,
        logger,
      });

      // guilt and remorse should be similar (both negative self-evaluation emotions)
      const similarToGuilt = emotionSimilarityService.findSimilarEmotions(
        'guilt',
        0.7,
        3
      );

      expect(similarToGuilt.length).toBeGreaterThan(0);
      // shame is most similar to guilt based on weight vectors (closer values)
      expect(similarToGuilt[0].emotionName).toBe('shame');
      expect(similarToGuilt[0].similarity).toBeGreaterThan(0.7);
    });

    it('should verify group similarity for related emotions', () => {
      const prototypeRegistry = createMockPrototypeRegistry();
      const emotionSimilarityService = new EmotionSimilarityService({
        prototypeRegistryService: prototypeRegistry,
        logger,
      });

      // guilt, remorse, shame form a functionally similar group
      const groupCheck = emotionSimilarityService.checkGroupSimilarity(
        ['guilt', 'remorse', 'shame'],
        0.5
      );

      expect(groupCheck.isSimilar).toBe(true);
      expect(groupCheck.avgSimilarity).toBeGreaterThan(0.5);
    });

    it('should identify dissimilar emotions correctly', () => {
      const prototypeRegistry = createMockPrototypeRegistry();
      const emotionSimilarityService = new EmotionSimilarityService({
        prototypeRegistryService: prototypeRegistry,
        logger,
      });

      // joy and terror are very different emotions
      const groupCheck = emotionSimilarityService.checkGroupSimilarity(
        ['joy', 'terror'],
        0.5
      );

      expect(groupCheck.isSimilar).toBe(false);
    });
  });

  describe('CoreSectionGenerator detection', () => {
    it('should detect overconstrained conjunctions directly', () => {
      const coreSectionGenerator = new CoreSectionGenerator(createCoreSectionGeneratorMocks());

      const blockers = createOverconstrainedSimulationResult();

      const detected =
        coreSectionGenerator.detectOverconstrainedConjunctions(blockers);

      expect(detected).toHaveLength(1);
      expect(detected[0].lowPassChildren).toHaveLength(3);
      expect(detected[0].naiveJointProbability).toBeCloseTo(
        0.08 * 0.06 * 0.09,
        6
      );
    });

    it('should return empty for normal expressions', () => {
      const coreSectionGenerator = new CoreSectionGenerator(createCoreSectionGeneratorMocks());

      const blockers = createNormalSimulationResult();

      const detected =
        coreSectionGenerator.detectOverconstrainedConjunctions(blockers);

      expect(detected).toHaveLength(0);
    });

    it('should extract emotion names correctly', () => {
      const coreSectionGenerator = new CoreSectionGenerator(createCoreSectionGeneratorMocks());

      const blockers = createOverconstrainedSimulationResult();

      const detected =
        coreSectionGenerator.detectOverconstrainedConjunctions(blockers);

      const emotionNames = detected[0].lowPassChildren.map((c) => c.emotionName);
      expect(emotionNames).toContain('guilt');
      expect(emotionNames).toContain('shame');
      expect(emotionNames).toContain('disgust');
    });
  });

  describe('Recommendation generation integration', () => {
    it('should generate OR-softening suggestions with similar emotions', () => {
      const prototypeRegistry = createMockPrototypeRegistry();
      const emotionSimilarityService = new EmotionSimilarityService({
        prototypeRegistryService: prototypeRegistry,
        logger,
      });

      const reportGenerator = new MonteCarloReportGenerator({
        logger,
        emotionSimilarityService,
      });

      const simulationResult = createOverconstrainedSimulationResult();
      const expressionName = 'test:overconstrained-expression';
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.guilt' }, 0.45] },
              { '>=': [{ var: 'emotions.shame' }, 0.50] },
              { '>=': [{ var: 'emotions.disgust' }, 0.40] },
            ],
          },
        },
      ];

      const report = reportGenerator.generate({
        expressionName,
        simulationResult,
        blockers: [simulationResult.hierarchicalBreakdown],
        summary: '',
        prerequisites,
      });

      // Check that suggestions are generated
      // Report should mention either 2-of-N or OR-softening
      const hasActionableSuggestion =
        report.includes('2-of-') || report.includes('OR');
      expect(hasActionableSuggestion).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty blockers gracefully', () => {
      const coreSectionGenerator = new CoreSectionGenerator(createCoreSectionGeneratorMocks());

      expect(
        coreSectionGenerator.detectOverconstrainedConjunctions(null)
      ).toEqual([]);
      expect(
        coreSectionGenerator.detectOverconstrainedConjunctions([])
      ).toEqual([]);
      expect(
        coreSectionGenerator.detectOverconstrainedConjunctions({})
      ).toEqual([]);
    });

    it('should handle OR nodes correctly (not flag as overconstrained)', () => {
      const coreSectionGenerator = new CoreSectionGenerator(createCoreSectionGeneratorMocks());

      const orBlockers = {
        nodeType: 'or',
        clauseId: 'root_or',
        children: [
          {
            nodeType: 'leaf',
            clauseId: 'var:emotions.guilt:>=:0.45',
            variablePath: 'emotions.guilt',
            inRegimePassRate: 0.08,
          },
          {
            nodeType: 'leaf',
            clauseId: 'var:emotions.shame:>=:0.50',
            variablePath: 'emotions.shame',
            inRegimePassRate: 0.06,
          },
          {
            nodeType: 'leaf',
            clauseId: 'var:emotions.disgust:>=:0.40',
            variablePath: 'emotions.disgust',
            inRegimePassRate: 0.09,
          },
        ],
      };

      const detected =
        coreSectionGenerator.detectOverconstrainedConjunctions(orBlockers);

      // OR nodes should not be flagged as overconstrained
      expect(detected).toHaveLength(0);
    });

    it('should handle nested structures with mixed node types', () => {
      const coreSectionGenerator = new CoreSectionGenerator(createCoreSectionGeneratorMocks());

      const nestedBlockers = {
        nodeType: 'and',
        clauseId: 'outer_and',
        children: [
          {
            nodeType: 'or',
            clauseId: 'inner_or',
            children: [
              {
                nodeType: 'leaf',
                clauseId: 'var:emotions.guilt:>=:0.45',
                variablePath: 'emotions.guilt',
                inRegimePassRate: 0.08,
              },
              {
                nodeType: 'leaf',
                clauseId: 'var:emotions.joy:>=:0.20',
                variablePath: 'emotions.joy',
                inRegimePassRate: 0.60,
              },
            ],
          },
          {
            nodeType: 'and',
            clauseId: 'inner_and',
            children: [
              {
                nodeType: 'leaf',
                clauseId: 'var:emotions.shame:>=:0.50',
                variablePath: 'emotions.shame',
                inRegimePassRate: 0.06,
              },
              {
                nodeType: 'leaf',
                clauseId: 'var:emotions.disgust:>=:0.40',
                variablePath: 'emotions.disgust',
                inRegimePassRate: 0.09,
              },
              {
                nodeType: 'leaf',
                clauseId: 'var:emotions.contempt:>=:0.35',
                variablePath: 'emotions.contempt',
                inRegimePassRate: 0.07,
              },
            ],
          },
        ],
      };

      const detected =
        coreSectionGenerator.detectOverconstrainedConjunctions(nestedBlockers);

      // Should detect the inner AND with 3 low-pass children
      expect(detected).toHaveLength(1);
      expect(detected[0].andNodeId).toBe('inner_and');
      expect(detected[0].lowPassChildren).toHaveLength(3);
    });

    it('should not flag emotions with pass rate at threshold (10%)', () => {
      const coreSectionGenerator = new CoreSectionGenerator(createCoreSectionGeneratorMocks());

      const atThresholdBlockers = {
        nodeType: 'and',
        clauseId: 'root_and',
        children: [
          {
            nodeType: 'leaf',
            clauseId: 'var:emotions.guilt:>=:0.45',
            variablePath: 'emotions.guilt',
            inRegimePassRate: 0.1, // Exactly at threshold
          },
          {
            nodeType: 'leaf',
            clauseId: 'var:emotions.shame:>=:0.50',
            variablePath: 'emotions.shame',
            inRegimePassRate: 0.1, // Exactly at threshold
          },
          {
            nodeType: 'leaf',
            clauseId: 'var:emotions.disgust:>=:0.40',
            variablePath: 'emotions.disgust',
            inRegimePassRate: 0.1, // Exactly at threshold
          },
        ],
      };

      const detected =
        coreSectionGenerator.detectOverconstrainedConjunctions(
          atThresholdBlockers
        );

      // Pass rate must be < 0.10, not <= 0.10
      expect(detected).toHaveLength(0);
    });
  });
});
