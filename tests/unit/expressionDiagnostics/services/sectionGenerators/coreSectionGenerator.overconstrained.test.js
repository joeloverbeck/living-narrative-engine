/**
 * @file Unit tests for CoreSectionGenerator - Overconstrained Conjunction Detection
 */

import { describe, it, expect } from '@jest/globals';
import CoreSectionGenerator from '../../../../../src/expressionDiagnostics/services/sectionGenerators/CoreSectionGenerator.js';
import ReportFormattingService from '../../../../../src/expressionDiagnostics/services/ReportFormattingService.js';
import StatisticalComputationService from '../../../../../src/expressionDiagnostics/services/StatisticalComputationService.js';

const createGenerator = (overrides = {}) => {
  const formattingService = new ReportFormattingService();
  const witnessFormatter = overrides.witnessFormatter ?? {
    formatWitness: () => 'WITNESS',
  };
  const statisticalService = new StatisticalComputationService();
  const dataExtractor = overrides.dataExtractor ?? {
    getLowestCoverageVariables: (variables) => variables,
  };

  return new CoreSectionGenerator({
    formattingService,
    witnessFormatter,
    statisticalService,
    dataExtractor,
    ...overrides,
  });
};

describe('CoreSectionGenerator - Overconstrained Conjunction Detection', () => {
  describe('detectOverconstrainedConjunctions', () => {
    it('should detect AND with 3+ low-pass emotion children', () => {
      const generator = createGenerator();
      const blockers = [
        {
          hierarchicalBreakdown: {
            nodeType: 'and',
            clauseId: 'root_and',
            children: [
              {
                nodeType: 'leaf',
                variablePath: 'emotions.guilt',
                inRegimePassRate: 0.08,
                thresholdValue: 0.45,
                comparisonOperator: '>=',
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.shame',
                inRegimePassRate: 0.07,
                thresholdValue: 0.40,
                comparisonOperator: '>=',
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.remorse',
                inRegimePassRate: 0.09,
                thresholdValue: 0.35,
                comparisonOperator: '>=',
              },
            ],
          },
        },
      ];

      const results = generator.detectOverconstrainedConjunctions(blockers);

      expect(results).toHaveLength(1);
      expect(results[0].lowPassChildren).toHaveLength(3);
      expect(results[0].lowPassChildren.map((c) => c.emotionName)).toEqual([
        'guilt',
        'shame',
        'remorse',
      ]);
    });

    it('should not flag AND with only 2 low-pass children', () => {
      const generator = createGenerator();
      const blockers = [
        {
          hierarchicalBreakdown: {
            nodeType: 'and',
            clauseId: 'root_and',
            children: [
              {
                nodeType: 'leaf',
                variablePath: 'emotions.guilt',
                inRegimePassRate: 0.08,
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.shame',
                inRegimePassRate: 0.07,
              },
            ],
          },
        },
      ];

      const results = generator.detectOverconstrainedConjunctions(blockers);

      expect(results).toHaveLength(0);
    });

    it('should not flag children with pass rate >= 10%', () => {
      const generator = createGenerator();
      const blockers = [
        {
          hierarchicalBreakdown: {
            nodeType: 'and',
            clauseId: 'root_and',
            children: [
              {
                nodeType: 'leaf',
                variablePath: 'emotions.guilt',
                inRegimePassRate: 0.12,
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.shame',
                inRegimePassRate: 0.15,
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.remorse',
                inRegimePassRate: 0.20,
              },
            ],
          },
        },
      ];

      const results = generator.detectOverconstrainedConjunctions(blockers);

      expect(results).toHaveLength(0);
    });

    it('should calculate correct naive joint probability', () => {
      const generator = createGenerator();
      const blockers = [
        {
          hierarchicalBreakdown: {
            nodeType: 'and',
            children: [
              {
                nodeType: 'leaf',
                variablePath: 'emotions.guilt',
                inRegimePassRate: 0.08,
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.shame',
                inRegimePassRate: 0.08,
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.remorse',
                inRegimePassRate: 0.08,
              },
            ],
          },
        },
      ];

      const results = generator.detectOverconstrainedConjunctions(blockers);

      // 0.08 * 0.08 * 0.08 = 0.000512
      expect(results[0].naiveJointProbability).toBeCloseTo(0.000512, 6);
    });

    it('should handle nested AND structures', () => {
      const generator = createGenerator();
      const blockers = [
        {
          hierarchicalBreakdown: {
            nodeType: 'and',
            clauseId: 'outer_and',
            children: [
              {
                nodeType: 'and',
                clauseId: 'inner_and',
                children: [
                  {
                    nodeType: 'leaf',
                    variablePath: 'emotions.guilt',
                    inRegimePassRate: 0.05,
                  },
                  {
                    nodeType: 'leaf',
                    variablePath: 'emotions.shame',
                    inRegimePassRate: 0.06,
                  },
                  {
                    nodeType: 'leaf',
                    variablePath: 'emotions.remorse',
                    inRegimePassRate: 0.07,
                  },
                ],
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.fear',
                inRegimePassRate: 0.08,
              },
            ],
          },
        },
      ];

      const results = generator.detectOverconstrainedConjunctions(blockers);

      // Should find the inner AND with 3 low-pass children
      expect(results).toHaveLength(1);
      expect(results[0].andNodeId).toBe('inner_and');
      expect(results[0].lowPassChildren).toHaveLength(3);
    });

    it('should ignore non-emotion threshold leaves', () => {
      const generator = createGenerator();
      const blockers = [
        {
          hierarchicalBreakdown: {
            nodeType: 'and',
            children: [
              {
                nodeType: 'leaf',
                variablePath: 'emotions.guilt',
                inRegimePassRate: 0.08,
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.shame',
                inRegimePassRate: 0.07,
              },
              {
                nodeType: 'leaf',
                variablePath: 'moodAxes.valence',
                inRegimePassRate: 0.05,
              },
              {
                nodeType: 'leaf',
                variablePath: 'someOtherVariable',
                inRegimePassRate: 0.03,
              },
            ],
          },
        },
      ];

      const results = generator.detectOverconstrainedConjunctions(blockers);

      // Only 2 emotion variables, so should not flag
      expect(results).toHaveLength(0);
    });

    it('should handle empty blockers array', () => {
      const generator = createGenerator();

      const results = generator.detectOverconstrainedConjunctions([]);

      expect(results).toEqual([]);
    });

    it('should handle null blockers', () => {
      const generator = createGenerator();

      const results = generator.detectOverconstrainedConjunctions(null);

      expect(results).toEqual([]);
    });

    it('should handle single blocker (not array)', () => {
      const generator = createGenerator();
      const blocker = {
        hierarchicalBreakdown: {
          nodeType: 'and',
          children: [
            {
              nodeType: 'leaf',
              variablePath: 'emotions.guilt',
              inRegimePassRate: 0.08,
            },
            {
              nodeType: 'leaf',
              variablePath: 'emotions.shame',
              inRegimePassRate: 0.07,
            },
            {
              nodeType: 'leaf',
              variablePath: 'emotions.remorse',
              inRegimePassRate: 0.06,
            },
          ],
        },
      };

      const results = generator.detectOverconstrainedConjunctions(blocker);

      expect(results).toHaveLength(1);
    });

    it('should use passRate when inRegimePassRate is not available', () => {
      const generator = createGenerator();
      const blockers = [
        {
          hierarchicalBreakdown: {
            nodeType: 'and',
            children: [
              { nodeType: 'leaf', variablePath: 'emotions.guilt', passRate: 0.08 },
              { nodeType: 'leaf', variablePath: 'emotions.shame', passRate: 0.07 },
              { nodeType: 'leaf', variablePath: 'emotions.remorse', passRate: 0.06 },
            ],
          },
        },
      ];

      const results = generator.detectOverconstrainedConjunctions(blockers);

      expect(results).toHaveLength(1);
    });

    it('should calculate passRate from failureRate when neither passRate is available', () => {
      const generator = createGenerator();
      const blockers = [
        {
          hierarchicalBreakdown: {
            nodeType: 'and',
            children: [
              {
                nodeType: 'leaf',
                variablePath: 'emotions.guilt',
                failureRate: 0.92,
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.shame',
                failureRate: 0.93,
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.remorse',
                failureRate: 0.94,
              },
            ],
          },
        },
      ];

      const results = generator.detectOverconstrainedConjunctions(blockers);

      expect(results).toHaveLength(1);
      expect(results[0].lowPassChildren[0].passRate).toBeCloseTo(0.08, 5);
    });

    it('should extract threshold and operator values', () => {
      const generator = createGenerator();
      const blockers = [
        {
          hierarchicalBreakdown: {
            nodeType: 'and',
            children: [
              {
                nodeType: 'leaf',
                variablePath: 'emotions.guilt',
                inRegimePassRate: 0.08,
                thresholdValue: 0.45,
                comparisonOperator: '>=',
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.shame',
                inRegimePassRate: 0.07,
                thresholdValue: 0.50,
                operator: '>',
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.remorse',
                inRegimePassRate: 0.06,
              },
            ],
          },
        },
      ];

      const results = generator.detectOverconstrainedConjunctions(blockers);

      expect(results[0].lowPassChildren[0].threshold).toBe(0.45);
      expect(results[0].lowPassChildren[0].operator).toBe('>=');
      expect(results[0].lowPassChildren[1].threshold).toBe(0.50);
      expect(results[0].lowPassChildren[1].operator).toBe('>');
      expect(results[0].lowPassChildren[2].threshold).toBeNull();
      expect(results[0].lowPassChildren[2].operator).toBe('>=');
    });

    it('should use clauseId or description as fallback for clauseId', () => {
      const generator = createGenerator();
      const blockers = [
        {
          hierarchicalBreakdown: {
            nodeType: 'and',
            children: [
              {
                nodeType: 'leaf',
                variablePath: 'emotions.guilt',
                clauseId: 'clause_guilt',
                inRegimePassRate: 0.08,
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.shame',
                description: 'shame >= 0.4',
                inRegimePassRate: 0.07,
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.remorse',
                inRegimePassRate: 0.06,
              },
            ],
          },
        },
      ];

      const results = generator.detectOverconstrainedConjunctions(blockers);

      expect(results[0].lowPassChildren[0].clauseId).toBe('clause_guilt');
      expect(results[0].lowPassChildren[1].clauseId).toBe('shame >= 0.4');
      expect(results[0].lowPassChildren[2].clauseId).toBe('unknown');
    });

    it('should handle OR nodes without flagging them', () => {
      const generator = createGenerator();
      const blockers = [
        {
          hierarchicalBreakdown: {
            nodeType: 'or',
            children: [
              {
                nodeType: 'leaf',
                variablePath: 'emotions.guilt',
                inRegimePassRate: 0.08,
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.shame',
                inRegimePassRate: 0.07,
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.remorse',
                inRegimePassRate: 0.06,
              },
            ],
          },
        },
      ];

      const results = generator.detectOverconstrainedConjunctions(blockers);

      expect(results).toHaveLength(0);
    });

    it('should traverse children of OR nodes to find nested ANDs', () => {
      const generator = createGenerator();
      const blockers = [
        {
          hierarchicalBreakdown: {
            nodeType: 'or',
            children: [
              {
                nodeType: 'and',
                clauseId: 'nested_and',
                children: [
                  {
                    nodeType: 'leaf',
                    variablePath: 'emotions.guilt',
                    inRegimePassRate: 0.05,
                  },
                  {
                    nodeType: 'leaf',
                    variablePath: 'emotions.shame',
                    inRegimePassRate: 0.06,
                  },
                  {
                    nodeType: 'leaf',
                    variablePath: 'emotions.remorse',
                    inRegimePassRate: 0.07,
                  },
                ],
              },
            ],
          },
        },
      ];

      const results = generator.detectOverconstrainedConjunctions(blockers);

      expect(results).toHaveLength(1);
      expect(results[0].andNodeId).toBe('nested_and');
    });

    it('should handle nodes without hierarchicalBreakdown wrapper', () => {
      const generator = createGenerator();
      const blockers = [
        {
          nodeType: 'and',
          children: [
            {
              nodeType: 'leaf',
              variablePath: 'emotions.guilt',
              inRegimePassRate: 0.08,
            },
            {
              nodeType: 'leaf',
              variablePath: 'emotions.shame',
              inRegimePassRate: 0.07,
            },
            {
              nodeType: 'leaf',
              variablePath: 'emotions.remorse',
              inRegimePassRate: 0.06,
            },
          ],
        },
      ];

      const results = generator.detectOverconstrainedConjunctions(blockers);

      expect(results).toHaveLength(1);
    });

    it('should initialize suggestions as empty array', () => {
      const generator = createGenerator();
      const blockers = [
        {
          hierarchicalBreakdown: {
            nodeType: 'and',
            children: [
              {
                nodeType: 'leaf',
                variablePath: 'emotions.guilt',
                inRegimePassRate: 0.08,
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.shame',
                inRegimePassRate: 0.07,
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.remorse',
                inRegimePassRate: 0.06,
              },
            ],
          },
        },
      ];

      const results = generator.detectOverconstrainedConjunctions(blockers);

      expect(results[0].suggestions).toEqual([]);
    });

    it('should detect multiple overconstrained ANDs in different blockers', () => {
      const generator = createGenerator();
      const blockers = [
        {
          hierarchicalBreakdown: {
            nodeType: 'and',
            clauseId: 'and_1',
            children: [
              {
                nodeType: 'leaf',
                variablePath: 'emotions.guilt',
                inRegimePassRate: 0.05,
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.shame',
                inRegimePassRate: 0.06,
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.remorse',
                inRegimePassRate: 0.07,
              },
            ],
          },
        },
        {
          hierarchicalBreakdown: {
            nodeType: 'and',
            clauseId: 'and_2',
            children: [
              {
                nodeType: 'leaf',
                variablePath: 'emotions.fear',
                inRegimePassRate: 0.04,
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.terror',
                inRegimePassRate: 0.03,
              },
              {
                nodeType: 'leaf',
                variablePath: 'emotions.dread',
                inRegimePassRate: 0.02,
              },
            ],
          },
        },
      ];

      const results = generator.detectOverconstrainedConjunctions(blockers);

      expect(results).toHaveLength(2);
      expect(results[0].andNodeId).toBe('and_1');
      expect(results[1].andNodeId).toBe('and_2');
    });

    it('should handle var: prefix in variablePath', () => {
      const generator = createGenerator();
      const blockers = [
        {
          hierarchicalBreakdown: {
            nodeType: 'and',
            children: [
              {
                nodeType: 'leaf',
                variablePath: 'var:emotions.guilt',
                inRegimePassRate: 0.08,
              },
              {
                nodeType: 'leaf',
                variablePath: 'var:emotions.shame',
                inRegimePassRate: 0.07,
              },
              {
                nodeType: 'leaf',
                variablePath: 'var:emotions.remorse',
                inRegimePassRate: 0.06,
              },
            ],
          },
        },
      ];

      const results = generator.detectOverconstrainedConjunctions(blockers);

      expect(results).toHaveLength(1);
      expect(results[0].lowPassChildren.map((c) => c.emotionName)).toEqual([
        'guilt',
        'shame',
        'remorse',
      ]);
    });

    it('should use clauseId when variablePath is not available', () => {
      const generator = createGenerator();
      const blockers = [
        {
          hierarchicalBreakdown: {
            nodeType: 'and',
            children: [
              {
                nodeType: 'leaf',
                clauseId: 'emotions.guilt >= 0.5',
                inRegimePassRate: 0.08,
              },
              {
                nodeType: 'leaf',
                clauseId: 'emotions.shame >= 0.4',
                inRegimePassRate: 0.07,
              },
              {
                nodeType: 'leaf',
                clauseId: 'emotions.remorse >= 0.3',
                inRegimePassRate: 0.06,
              },
            ],
          },
        },
      ];

      const results = generator.detectOverconstrainedConjunctions(blockers);

      expect(results).toHaveLength(1);
      expect(results[0].lowPassChildren.map((c) => c.emotionName)).toEqual([
        'guilt',
        'shame',
        'remorse',
      ]);
    });
  });
});
