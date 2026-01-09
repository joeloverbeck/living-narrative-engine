/**
 * @file Unit tests for FailureExplainer service
 * @description Tests human-readable failure explanation generation.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import FailureExplainer from '../../../../src/expressionDiagnostics/services/FailureExplainer.js';

describe('FailureExplainer', () => {
  let mockLogger;
  let mockDataRegistry;

  // Mock emotion prototypes matching real data structure
  const mockEmotionPrototypes = {
    entries: {
      joy: {
        weights: { valence: 1.0, arousal: 0.5 },
        gates: ['valence >= 0.35'],
      },
      fear: {
        weights: { threat: 1.0, arousal: 0.8 },
        gates: ['threat >= 0.30'],
      },
      confidence: {
        weights: { threat: -0.8, agency_control: 0.8 },
        gates: ['threat <= 0.20', 'agency_control >= 0.10'],
      },
      curiosity: {
        weights: { engagement: 0.8, future_expectancy: 0.5 },
        gates: [],
      },
    },
  };

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn((category, lookupId) => {
        if (category === 'lookups') {
          if (lookupId === 'core:emotion_prototypes') {
            return mockEmotionPrototypes;
          }
        }
        return null;
      }),
    };
  });

  describe('Constructor', () => {
    it('should create instance with valid dependencies', () => {
      const explainer = new FailureExplainer({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
      expect(explainer).toBeInstanceOf(FailureExplainer);
    });

    it('should throw if dataRegistry is missing', () => {
      expect(
        () =>
          new FailureExplainer({
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw if logger is missing', () => {
      expect(
        () =>
          new FailureExplainer({
            dataRegistry: mockDataRegistry,
          })
      ).toThrow();
    });

    it('should throw if dataRegistry lacks get method', () => {
      expect(
        () =>
          new FailureExplainer({
            dataRegistry: {},
            logger: mockLogger,
          })
      ).toThrow();
    });
  });

  describe('analyzeBlockers()', () => {
    let explainer;

    beforeEach(() => {
      explainer = new FailureExplainer({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
    });

    it('should return empty array for empty input', () => {
      expect(explainer.analyzeBlockers([])).toEqual([]);
    });

    it('should return empty array for null input', () => {
      expect(explainer.analyzeBlockers(null)).toEqual([]);
    });

    it('should return empty array for undefined input', () => {
      expect(explainer.analyzeBlockers(undefined)).toEqual([]);
    });

    it('should sort by failure rate descending', () => {
      const clauseFailures = [
        {
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.3,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
        {
          clauseDescription: 'emotions.fear >= 0.8',
          failureRate: 0.9,
          averageViolation: 0.2,
          clauseIndex: 1,
        },
        {
          clauseDescription: 'emotions.curiosity >= 0.6',
          failureRate: 0.5,
          averageViolation: 0.15,
          clauseIndex: 2,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].failureRate).toBe(0.9);
      expect(result[1].failureRate).toBe(0.5);
      expect(result[2].failureRate).toBe(0.3);
    });

    it('should assign correct ranks (1 = worst blocker)', () => {
      const clauseFailures = [
        {
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.3,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
        {
          clauseDescription: 'emotions.fear >= 0.8',
          failureRate: 0.9,
          averageViolation: 0.2,
          clauseIndex: 1,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
    });

    it('should generate explanations for each clause', () => {
      const clauseFailures = [
        {
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.7,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation).toBeDefined();
      expect(result[0].explanation.summary).toBeDefined();
      expect(result[0].explanation.detail).toBeDefined();
      expect(result[0].explanation.severity).toBeDefined();
      expect(result[0].explanation.suggestions).toBeInstanceOf(Array);
    });

    it('should preserve clauseDescription and failureRate', () => {
      const clauseFailures = [
        {
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.7,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].clauseDescription).toBe('emotions.joy >= 0.5');
      expect(result[0].failureRate).toBe(0.7);
      expect(result[0].averageViolation).toBe(0.1);
    });

    it('should not mutate input array', () => {
      const clauseFailures = [
        {
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.3,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
        {
          clauseDescription: 'emotions.fear >= 0.8',
          failureRate: 0.9,
          averageViolation: 0.2,
          clauseIndex: 1,
        },
      ];
      const originalOrder = [...clauseFailures];

      explainer.analyzeBlockers(clauseFailures);

      expect(clauseFailures[0]).toEqual(originalOrder[0]);
      expect(clauseFailures[1]).toEqual(originalOrder[1]);
    });
  });

  describe('getTopBlockers()', () => {
    let explainer;

    beforeEach(() => {
      explainer = new FailureExplainer({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
    });

    it('should return specified number of blockers', () => {
      const clauseFailures = [
        {
          clauseDescription: 'clause1',
          failureRate: 0.9,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
        {
          clauseDescription: 'clause2',
          failureRate: 0.8,
          averageViolation: 0.1,
          clauseIndex: 1,
        },
        {
          clauseDescription: 'clause3',
          failureRate: 0.7,
          averageViolation: 0.1,
          clauseIndex: 2,
        },
        {
          clauseDescription: 'clause4',
          failureRate: 0.6,
          averageViolation: 0.1,
          clauseIndex: 3,
        },
      ];

      const result = explainer.getTopBlockers(clauseFailures, 2);

      expect(result).toHaveLength(2);
      expect(result[0].clauseDescription).toBe('clause1');
      expect(result[1].clauseDescription).toBe('clause2');
    });

    it('should default to 3 blockers', () => {
      const clauseFailures = [
        {
          clauseDescription: 'clause1',
          failureRate: 0.9,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
        {
          clauseDescription: 'clause2',
          failureRate: 0.8,
          averageViolation: 0.1,
          clauseIndex: 1,
        },
        {
          clauseDescription: 'clause3',
          failureRate: 0.7,
          averageViolation: 0.1,
          clauseIndex: 2,
        },
        {
          clauseDescription: 'clause4',
          failureRate: 0.6,
          averageViolation: 0.1,
          clauseIndex: 3,
        },
      ];

      const result = explainer.getTopBlockers(clauseFailures);

      expect(result).toHaveLength(3);
    });

    it('should return all blockers if fewer than N exist', () => {
      const clauseFailures = [
        {
          clauseDescription: 'clause1',
          failureRate: 0.9,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
      ];

      const result = explainer.getTopBlockers(clauseFailures, 5);

      expect(result).toHaveLength(1);
    });
  });

  describe('generateSummary()', () => {
    let explainer;

    beforeEach(() => {
      explainer = new FailureExplainer({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
    });

    it('should handle zero trigger rate', () => {
      const blockers = [
        {
          clauseDescription: 'emotions.fear >= 0.9',
          failureRate: 1.0,
          averageViolation: 0.5,
          explanation: {},
          rank: 1,
        },
      ];

      const result = explainer.generateSummary(0, blockers);

      expect(result).toContain('never triggers');
      expect(result).toContain('Primary blocker');
    });

    it('should handle zero trigger rate with no blockers', () => {
      const result = explainer.generateSummary(0, []);

      expect(result).toContain('never triggers');
      expect(result).toContain('No specific blocker identified');
    });

    it('should handle extremely rare trigger rate (<0.001%)', () => {
      const blockers = [
        {
          clauseDescription: 'emotions.fear >= 0.9',
          failureRate: 0.99,
          averageViolation: 0.5,
          explanation: {},
          rank: 1,
        },
      ];

      // 0.000005 = 0.0005% which is < 0.001% (EXTREMELY_RARE threshold)
      const result = explainer.generateSummary(0.000005, blockers);

      expect(result).toContain('extremely rare');
      expect(result).toContain('Top blocker');
    });

    it('should handle rare trigger rate (<0.05%)', () => {
      const blockers = [
        {
          clauseDescription: 'clause1',
          failureRate: 0.8,
          averageViolation: 0.1,
          explanation: {},
          rank: 1,
        },
        {
          clauseDescription: 'clause2',
          failureRate: 0.7,
          averageViolation: 0.1,
          explanation: {},
          rank: 2,
        },
      ];

      // 0.0003 = 0.03% which is >= 0.001% but < 0.05% (RARE threshold)
      const result = explainer.generateSummary(0.0003, blockers);

      expect(result).toContain('rarely');
      expect(result).toContain('2 clause(s) frequently fail');
    });

    it('should handle occasional trigger rate (<2%)', () => {
      const blockers = [];

      // 0.015 = 1.5% which is >= 0.05% but < 2% (NORMAL threshold)
      const result = explainer.generateSummary(0.015, blockers);

      expect(result).toContain('occasionally');
      expect(result).toContain('adjusting thresholds');
    });

    it('should handle healthy trigger rate (>=2%)', () => {
      const blockers = [];

      // 0.02 = 2% which is exactly the NORMAL threshold (FREQUENT)
      const result = explainer.generateSummary(0.02, blockers);

      expect(result).toContain('healthy rate');
    });

    it('should format percentage correctly', () => {
      const blockers = [];

      // 0.015 = 1.5% - still under 2% threshold, so "occasionally"
      const result = explainer.generateSummary(0.015, blockers);

      expect(result).toContain('1.500%');
    });
  });

  describe('Severity categorization', () => {
    let explainer;

    beforeEach(() => {
      explainer = new FailureExplainer({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
    });

    it('should categorize >= 99% failure rate as critical', () => {
      const clauseFailures = [
        {
          clauseDescription: 'test',
          failureRate: 0.99,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.severity).toBe('critical');
    });

    it('should categorize 90-98% failure rate as high', () => {
      const clauseFailures = [
        {
          clauseDescription: 'test',
          failureRate: 0.95,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.severity).toBe('high');
    });

    it('should categorize 70-89% failure rate as medium', () => {
      const clauseFailures = [
        {
          clauseDescription: 'test',
          failureRate: 0.75,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.severity).toBe('medium');
    });

    it('should categorize < 70% failure rate as low', () => {
      const clauseFailures = [
        {
          clauseDescription: 'test',
          failureRate: 0.5,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.severity).toBe('low');
    });
  });

  describe('Clause parsing', () => {
    let explainer;

    beforeEach(() => {
      explainer = new FailureExplainer({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
    });

    it('should parse threshold clauses correctly', () => {
      const clauseFailures = [
        {
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.7,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.summary).toContain('emotions.joy');
      expect(result[0].explanation.summary).toContain('rarely reaches');
      expect(result[0].explanation.summary).toContain('0.5');
    });

    it('should parse compound AND clauses correctly', () => {
      const clauseFailures = [
        {
          clauseDescription: 'AND of 3 conditions',
          failureRate: 0.8,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.summary).toContain('Compound condition');
      expect(result[0].explanation.detail).toContain('AND');
      expect(result[0].explanation.detail).toContain('3');
    });

    it('should parse compound OR clauses correctly', () => {
      const clauseFailures = [
        {
          clauseDescription: 'OR of 2 conditions',
          failureRate: 0.6,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.detail).toContain('OR');
      expect(result[0].explanation.detail).toContain('2');
    });

    it('should handle unknown clause patterns gracefully', () => {
      const clauseFailures = [
        {
          clauseDescription: 'some complex logic',
          failureRate: 0.5,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.summary).toContain('Clause fails');
      expect(result[0].explanation.detail).toBe('some complex logic');
    });
  });

  describe('Threshold suggestions', () => {
    let explainer;

    beforeEach(() => {
      explainer = new FailureExplainer({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
    });

    it('should suggest lowering high thresholds (> 0.8)', () => {
      const clauseFailures = [
        {
          clauseDescription: 'emotions.fear >= 0.9',
          failureRate: 0.95,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.suggestions).toContainEqual(
        expect.stringContaining('Consider lowering threshold')
      );
    });

    it('should suggest threshold based on average violation', () => {
      const clauseFailures = [
        {
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.8,
          averageViolation: 0.25,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.suggestions).toContainEqual(
        expect.stringContaining('Based on violations')
      );
    });

    it('should suggest rarity may be intentional for appropriate thresholds', () => {
      const clauseFailures = [
        {
          clauseDescription: 'emotions.joy >= 0.3',
          failureRate: 0.5,
          averageViolation: 0.05,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.suggestions).toContainEqual(
        expect.stringContaining('may be appropriate')
      );
    });
  });

  describe('Emotion prototype integration', () => {
    let explainer;

    beforeEach(() => {
      explainer = new FailureExplainer({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
    });

    it('should describe emotion prototype weights', () => {
      const clauseFailures = [
        {
          clauseDescription: 'emotions.joy >= 0.8',
          failureRate: 0.9,
          averageViolation: 0.2,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.detail).toContain('Emotion "joy"');
      expect(result[0].explanation.detail).toContain('weighted toward');
      expect(result[0].explanation.detail).toContain('valence');
    });

    it('should handle missing emotion prototypes gracefully', () => {
      const clauseFailures = [
        {
          clauseDescription: 'emotions.nonexistent >= 0.5',
          failureRate: 0.7,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.detail).toContain('must be >=');
    });

    it('should handle sexual state clauses', () => {
      const clauseFailures = [
        {
          clauseDescription: 'sexualStates.aroused >= 0.6',
          failureRate: 0.8,
          averageViolation: 0.15,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.detail).toContain('Sexual state');
      expect(result[0].explanation.detail).toContain('aroused');
    });

    it('should include average shortfall in detail', () => {
      const clauseFailures = [
        {
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.7,
          averageViolation: 0.15,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.detail).toContain('Average shortfall');
      expect(result[0].explanation.detail).toContain('0.150');
    });

    it('should handle empty weights gracefully', () => {
      // Override mock to return prototype with no significant weights
      mockDataRegistry.get = jest.fn(() => ({
        entries: {
          emptiness: {
            weights: { valence: 0.01 },
            gates: [],
          },
        },
      }));

      const clauseFailures = [
        {
          clauseDescription: 'emotions.emptiness >= 0.5',
          failureRate: 0.7,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.detail).toContain('no significant weights');
    });
  });

  describe('Edge cases', () => {
    let explainer;

    beforeEach(() => {
      explainer = new FailureExplainer({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
    });

    it('should handle clause with zero average violation', () => {
      const clauseFailures = [
        {
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.5,
          averageViolation: 0,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.detail).not.toContain('Average shortfall');
    });

    it('should handle multiple operators in clause description', () => {
      const clauseFailures = [
        {
          clauseDescription: 'emotions.confidence <= 0.3',
          failureRate: 0.6,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.summary).toContain('emotions.confidence');
    });

    it('should handle exactly 99% failure rate as critical', () => {
      const clauseFailures = [
        {
          clauseDescription: 'test',
          failureRate: 0.99,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.severity).toBe('critical');
    });

    it('should handle exactly 90% failure rate as high', () => {
      const clauseFailures = [
        {
          clauseDescription: 'test',
          failureRate: 0.9,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.severity).toBe('high');
    });

    it('should handle exactly 70% failure rate as medium', () => {
      const clauseFailures = [
        {
          clauseDescription: 'test',
          failureRate: 0.7,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeBlockers(clauseFailures);

      expect(result[0].explanation.severity).toBe('medium');
    });
  });

  describe('flattenHierarchy()', () => {
    let explainer;

    beforeEach(() => {
      explainer = new FailureExplainer({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
    });

    it('should return empty array for null tree', () => {
      expect(explainer.flattenHierarchy(null)).toEqual([]);
    });

    it('should return empty array for undefined tree', () => {
      expect(explainer.flattenHierarchy(undefined)).toEqual([]);
    });

    it('should flatten a simple leaf node', () => {
      const tree = {
        id: '0',
        nodeType: 'leaf',
        description: 'emotions.joy >= 0.5',
        failureRate: 0.7,
        averageViolation: 0.15,
        isCompound: false,
        children: [],
      };

      const result = explainer.flattenHierarchy(tree);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('0');
      expect(result[0].description).toBe('emotions.joy >= 0.5');
      expect(result[0].failureRate).toBe(0.7);
      expect(result[0].severity).toBe('medium');
      expect(result[0].depth).toBe(0);
    });

    it('should flatten nested tree with AND node', () => {
      const tree = {
        id: '0',
        nodeType: 'and',
        description: 'AND of 2 conditions',
        failureRate: 0.9,
        averageViolation: 0.1,
        isCompound: true,
        children: [
          {
            id: '0.0',
            nodeType: 'leaf',
            description: 'emotions.joy >= 0.5',
            failureRate: 0.7,
            averageViolation: 0.15,
            isCompound: false,
            children: [],
          },
          {
            id: '0.1',
            nodeType: 'leaf',
            description: 'emotions.fear <= 0.3',
            failureRate: 0.5,
            averageViolation: 0.1,
            isCompound: false,
            children: [],
          },
        ],
      };

      const result = explainer.flattenHierarchy(tree);

      expect(result).toHaveLength(2);
      // Should be sorted by failure rate descending
      expect(result[0].failureRate).toBe(0.7);
      expect(result[1].failureRate).toBe(0.5);
    });

    it('should include depth information', () => {
      const tree = {
        id: '0',
        nodeType: 'and',
        description: 'AND of 1 condition',
        failureRate: 0.9,
        averageViolation: 0.1,
        isCompound: true,
        children: [
          {
            id: '0.0',
            nodeType: 'or',
            description: 'OR of 1 condition',
            failureRate: 0.8,
            averageViolation: 0.1,
            isCompound: true,
            children: [
              {
                id: '0.0.0',
                nodeType: 'leaf',
                description: 'emotions.joy >= 0.5',
                failureRate: 0.7,
                averageViolation: 0.1,
                isCompound: false,
                children: [],
              },
            ],
          },
        ],
      };

      const result = explainer.flattenHierarchy(tree);

      expect(result).toHaveLength(1);
      expect(result[0].depth).toBe(2);
    });

    it('should filter by minFailureRate threshold', () => {
      const tree = {
        id: '0',
        nodeType: 'and',
        description: 'AND of 3 conditions',
        failureRate: 0.9,
        averageViolation: 0.1,
        isCompound: true,
        children: [
          {
            id: '0.0',
            nodeType: 'leaf',
            description: 'emotions.joy >= 0.7',
            failureRate: 0.9,
            averageViolation: 0.2,
            isCompound: false,
            children: [],
          },
          {
            id: '0.1',
            nodeType: 'leaf',
            description: 'emotions.fear <= 0.3',
            failureRate: 0.4,
            averageViolation: 0.1,
            isCompound: false,
            children: [],
          },
          {
            id: '0.2',
            nodeType: 'leaf',
            description: 'emotions.calm >= 0.5',
            failureRate: 0.6,
            averageViolation: 0.1,
            isCompound: false,
            children: [],
          },
        ],
      };

      const result = explainer.flattenHierarchy(tree, 0.5);

      expect(result).toHaveLength(2);
      expect(result[0].failureRate).toBe(0.9);
      expect(result[1].failureRate).toBe(0.6);
    });

    it('should assign correct severity levels', () => {
      const tree = {
        id: '0',
        nodeType: 'and',
        description: 'AND of 4 conditions',
        failureRate: 1.0,
        averageViolation: 0.1,
        isCompound: true,
        children: [
          {
            id: '0.0',
            nodeType: 'leaf',
            description: 'critical',
            failureRate: 0.99,
            averageViolation: 0.1,
            isCompound: false,
            children: [],
          },
          {
            id: '0.1',
            nodeType: 'leaf',
            description: 'high',
            failureRate: 0.92,
            averageViolation: 0.1,
            isCompound: false,
            children: [],
          },
          {
            id: '0.2',
            nodeType: 'leaf',
            description: 'medium',
            failureRate: 0.75,
            averageViolation: 0.1,
            isCompound: false,
            children: [],
          },
          {
            id: '0.3',
            nodeType: 'leaf',
            description: 'low',
            failureRate: 0.5,
            averageViolation: 0.1,
            isCompound: false,
            children: [],
          },
        ],
      };

      const result = explainer.flattenHierarchy(tree);

      expect(result[0].severity).toBe('critical');
      expect(result[1].severity).toBe('high');
      expect(result[2].severity).toBe('medium');
      expect(result[3].severity).toBe('low');
    });
  });

  describe('analyzeHierarchicalBlockers()', () => {
    let explainer;

    beforeEach(() => {
      explainer = new FailureExplainer({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
    });

    it('should return empty array for empty input', () => {
      expect(explainer.analyzeHierarchicalBlockers([])).toEqual([]);
    });

    it('should return empty array for null input', () => {
      expect(explainer.analyzeHierarchicalBlockers(null)).toEqual([]);
    });

    it('should return empty array for undefined input', () => {
      expect(explainer.analyzeHierarchicalBlockers(undefined)).toEqual([]);
    });

    it('should include hasHierarchy flag when hierarchicalBreakdown is present', () => {
      const clauseFailures = [
        {
          clauseDescription: 'AND of 2 conditions',
          failureRate: 0.9,
          averageViolation: 0.1,
          clauseIndex: 0,
          hierarchicalBreakdown: {
            id: '0',
            nodeType: 'and',
            description: 'AND of 2 conditions',
            failureRate: 0.9,
            averageViolation: 0.1,
            isCompound: true,
            children: [
              {
                id: '0.0',
                nodeType: 'leaf',
                description: 'emotions.joy >= 0.5',
                failureRate: 0.7,
                averageViolation: 0.15,
                isCompound: false,
                children: [],
              },
            ],
          },
        },
      ];

      const result = explainer.analyzeHierarchicalBlockers(clauseFailures);

      expect(result[0].hasHierarchy).toBe(true);
      expect(result[0].hierarchicalBreakdown).toBeDefined();
    });

    it('should set hasHierarchy to false when hierarchicalBreakdown is null', () => {
      const clauseFailures = [
        {
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.7,
          averageViolation: 0.1,
          clauseIndex: 0,
          hierarchicalBreakdown: null,
        },
      ];

      const result = explainer.analyzeHierarchicalBlockers(clauseFailures);

      expect(result[0].hasHierarchy).toBe(false);
      expect(result[0].hierarchicalBreakdown).toBeNull();
      expect(result[0].worstOffenders).toEqual([]);
    });

    it('should set hasHierarchy to false when hierarchicalBreakdown is undefined', () => {
      const clauseFailures = [
        {
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.7,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeHierarchicalBlockers(clauseFailures);

      expect(result[0].hasHierarchy).toBe(false);
      expect(result[0].worstOffenders).toEqual([]);
    });

    it('should include worstOffenders with top 5 leaf nodes above 50% failure rate', () => {
      const clauseFailures = [
        {
          clauseDescription: 'AND of 6 conditions',
          failureRate: 0.99,
          averageViolation: 0.1,
          clauseIndex: 0,
          hierarchicalBreakdown: {
            id: '0',
            nodeType: 'and',
            description: 'AND of 6 conditions',
            failureRate: 0.99,
            averageViolation: 0.1,
            isCompound: true,
            children: [
              {
                id: '0.0',
                nodeType: 'leaf',
                description: 'cond1',
                failureRate: 0.95,
                averageViolation: 0.1,
                isCompound: false,
                children: [],
              },
              {
                id: '0.1',
                nodeType: 'leaf',
                description: 'cond2',
                failureRate: 0.85,
                averageViolation: 0.1,
                isCompound: false,
                children: [],
              },
              {
                id: '0.2',
                nodeType: 'leaf',
                description: 'cond3',
                failureRate: 0.75,
                averageViolation: 0.1,
                isCompound: false,
                children: [],
              },
              {
                id: '0.3',
                nodeType: 'leaf',
                description: 'cond4',
                failureRate: 0.65,
                averageViolation: 0.1,
                isCompound: false,
                children: [],
              },
              {
                id: '0.4',
                nodeType: 'leaf',
                description: 'cond5',
                failureRate: 0.55,
                averageViolation: 0.1,
                isCompound: false,
                children: [],
              },
              {
                id: '0.5',
                nodeType: 'leaf',
                description: 'cond6',
                failureRate: 0.45,
                averageViolation: 0.1,
                isCompound: false,
                children: [],
              },
            ],
          },
        },
      ];

      const result = explainer.analyzeHierarchicalBlockers(clauseFailures);

      // Only 5 are above 50%, so we get 5 worst offenders
      expect(result[0].worstOffenders).toHaveLength(5);
      expect(result[0].worstOffenders[0].failureRate).toBe(0.95);
      expect(result[0].worstOffenders[4].failureRate).toBe(0.55);
    });

    it('should sort blockers by failure rate descending', () => {
      const clauseFailures = [
        {
          clauseDescription: 'clause1',
          failureRate: 0.5,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
        {
          clauseDescription: 'clause2',
          failureRate: 0.9,
          averageViolation: 0.1,
          clauseIndex: 1,
        },
        {
          clauseDescription: 'clause3',
          failureRate: 0.7,
          averageViolation: 0.1,
          clauseIndex: 2,
        },
      ];

      const result = explainer.analyzeHierarchicalBlockers(clauseFailures);

      expect(result[0].failureRate).toBe(0.9);
      expect(result[1].failureRate).toBe(0.7);
      expect(result[2].failureRate).toBe(0.5);
    });

    it('should assign correct ranks', () => {
      const clauseFailures = [
        {
          clauseDescription: 'clause1',
          failureRate: 0.5,
          averageViolation: 0.1,
          clauseIndex: 0,
        },
        {
          clauseDescription: 'clause2',
          failureRate: 0.9,
          averageViolation: 0.1,
          clauseIndex: 1,
        },
      ];

      const result = explainer.analyzeHierarchicalBlockers(clauseFailures);

      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
    });

    it('should preserve standard blocker fields', () => {
      const clauseFailures = [
        {
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.7,
          averageViolation: 0.15,
          clauseIndex: 0,
        },
      ];

      const result = explainer.analyzeHierarchicalBlockers(clauseFailures);

      expect(result[0].clauseDescription).toBe('emotions.joy >= 0.5');
      expect(result[0].failureRate).toBe(0.7);
      expect(result[0].averageViolation).toBe(0.15);
      expect(result[0].explanation).toBeDefined();
    });
  });
});
