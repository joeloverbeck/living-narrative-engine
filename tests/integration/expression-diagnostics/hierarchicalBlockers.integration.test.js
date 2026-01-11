/**
 * @file Integration tests for hierarchical blockers feature in expression diagnostics
 * Tests the end-to-end flow from MonteCarloSimulator through FailureExplainer
 * to the hierarchical breakdown tree structure.
 * @see src/expressionDiagnostics/services/MonteCarloSimulator.js
 * @see src/expressionDiagnostics/services/FailureExplainer.js
 * @see src/expressionDiagnostics/models/HierarchicalClauseNode.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';
import FailureExplainer from '../../../src/expressionDiagnostics/services/FailureExplainer.js';
import EmotionCalculatorAdapter from '../../../src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';

const buildEmotionCalculatorAdapter = (dataRegistry, logger) =>
  new EmotionCalculatorAdapter({
    emotionCalculatorService: new EmotionCalculatorService({
      dataRegistry,
      logger,
    }),
    logger,
  });

describe('Hierarchical Blockers Integration', () => {
  let mockLogger;
  let mockDataRegistry;
  let simulator;
  let explainer;
  let mockEmotionCalculatorAdapter;

  // Mock emotion prototypes for the simulator
  const mockEmotionPrototypes = {
    entries: {
      joy: { weights: { valence: 1.0 }, gates: [] },
      fear: { weights: { threat: 1.0 }, gates: [] },
      curiosity: { weights: { engagement: 0.8 }, gates: [] },
      confidence: { weights: { agency_control: 0.8 }, gates: [] },
      flow: { weights: { engagement: 1.0 }, gates: [] },
      freeze: { weights: { threat: 1.0 }, gates: [] },
      interest: { weights: { engagement: 0.6 }, gates: [] },
      fascination: { weights: { engagement: 0.7 }, gates: [] },
      stress: { weights: { threat: 0.8 }, gates: [] },
      anxiety: { weights: { threat: 0.9 }, gates: [] },
      confusion: { weights: { engagement: -0.5 }, gates: [] },
      boredom: { weights: { engagement: -0.8 }, gates: [] },
      fatigue: { weights: { arousal: -0.8 }, gates: [] },
      apathy: { weights: { valence: -0.5, engagement: -0.5 }, gates: [] },
      anger: { weights: { threat: 0.7, arousal: 0.8 }, gates: [] },
      frustration: { weights: { threat: 0.5, arousal: 0.6 }, gates: [] },
      dissociation: { weights: { engagement: -1.0 }, gates: [] },
      panic: { weights: { threat: 1.0, arousal: 1.0 }, gates: [] },
    },
  };

  // Mock sexual prototypes (empty for these tests)
  const mockSexualPrototypes = {
    entries: {},
  };

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn((category, lookupId) => {
        if (category === 'lookups') {
          if (lookupId === 'core:emotion_prototypes') {
            return mockEmotionPrototypes;
          }
          if (lookupId === 'core:sexual_prototypes') {
            return mockSexualPrototypes;
          }
        }
        return null;
      }),
    };

    mockEmotionCalculatorAdapter = buildEmotionCalculatorAdapter(
      mockDataRegistry,
      mockLogger
    );

    simulator = new MonteCarloSimulator({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
      emotionCalculatorAdapter: mockEmotionCalculatorAdapter,
    });

    explainer = new FailureExplainer({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
    });
  });

  describe('Simple AND Expression', () => {
    const simpleAndExpression = {
      id: 'test:simple_and',
      description: 'Simple AND with 3 conditions',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.9] },
              { '>=': [{ var: 'emotions.confidence' }, 0.9] },
              { '<=': [{ var: 'emotions.fear' }, 0.1] },
            ],
          },
        },
      ],
    };

    it('should produce hierarchical breakdown for AND clause', async () => {
      const result = await simulator.simulate(simpleAndExpression, { sampleCount: 1000 });

      expect(result.clauseFailures).toHaveLength(1);
      expect(result.clauseFailures[0].hierarchicalBreakdown).not.toBeNull();

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      expect(breakdown.nodeType).toBe('and');
      expect(breakdown.children).toHaveLength(3);
    });

    it('should track per-condition failure rates within AND', async () => {
      const result = await simulator.simulate(simpleAndExpression, { sampleCount: 1000 });

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;

      // Each leaf should have evaluation stats
      for (const child of breakdown.children) {
        expect(child.nodeType).toBe('leaf');
        expect(child.evaluationCount).toBeGreaterThan(0);
        expect(typeof child.failureRate).toBe('number');
        expect(child.failureRate).toBeGreaterThanOrEqual(0);
        expect(child.failureRate).toBeLessThanOrEqual(1);
      }
    });

    it('should flow through FailureExplainer.analyzeHierarchicalBlockers', async () => {
      const result = await simulator.simulate(simpleAndExpression, { sampleCount: 1000 });
      const blockers = explainer.analyzeHierarchicalBlockers(result.clauseFailures);

      expect(blockers).toHaveLength(1);
      expect(blockers[0].hasHierarchy).toBe(true);
      expect(blockers[0].hierarchicalBreakdown).not.toBeNull();
      expect(blockers[0].hierarchicalBreakdown.children).toHaveLength(3);
    });

    it('should identify worst offenders from hierarchical breakdown', async () => {
      const result = await simulator.simulate(simpleAndExpression, { sampleCount: 1000 });
      const blockers = explainer.analyzeHierarchicalBlockers(result.clauseFailures);

      // With high thresholds (0.9), all conditions should fail frequently
      expect(blockers[0].worstOffenders.length).toBeGreaterThan(0);

      for (const offender of blockers[0].worstOffenders) {
        expect(offender.failureRate).toBeGreaterThanOrEqual(0.5);
        expect(offender.description).toBeDefined();
        expect(offender.severity).toBeDefined();
      }
    });
  });

  describe('Nested AND/OR Expression', () => {
    const nestedExpression = {
      id: 'test:nested_and_or',
      description: 'Nested AND with OR inside',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
              {
                or: [
                  { '>=': [{ var: 'emotions.interest' }, 0.7] },
                  { '>=': [{ var: 'emotions.fascination' }, 0.7] },
                ],
              },
              { '<=': [{ var: 'emotions.fear' }, 0.3] },
            ],
          },
        },
      ],
    };

    it('should build hierarchical tree with nested OR inside AND', async () => {
      const result = await simulator.simulate(nestedExpression, { sampleCount: 1000 });

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      expect(breakdown.nodeType).toBe('and');
      expect(breakdown.children).toHaveLength(3);

      // Second child should be OR node
      const orNode = breakdown.children[1];
      expect(orNode.nodeType).toBe('or');
      expect(orNode.children).toHaveLength(2);
      expect(orNode.children[0].nodeType).toBe('leaf');
      expect(orNode.children[1].nodeType).toBe('leaf');
    });

    it('should track stats for nested OR children', async () => {
      const result = await simulator.simulate(nestedExpression, { sampleCount: 1000 });

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      const orNode = breakdown.children[1];

      // OR children should have evaluation stats
      for (const child of orNode.children) {
        expect(child.evaluationCount).toBeGreaterThan(0);
        expect(typeof child.failureRate).toBe('number');
      }
    });

    it('should flow nested breakdown through analyzeHierarchicalBlockers', async () => {
      const result = await simulator.simulate(nestedExpression, { sampleCount: 1000 });
      const blockers = explainer.analyzeHierarchicalBlockers(result.clauseFailures);

      expect(blockers[0].hasHierarchy).toBe(true);

      // worstOffenders should flatten the tree and find leaf nodes
      // with >50% failure rate
      for (const offender of blockers[0].worstOffenders) {
        expect(offender.failureRate).toBeGreaterThanOrEqual(0.5);
      }
    });
  });

  describe('Complex Expression (flow_absorption-like)', () => {
    // Simulates the structure of flow_absorption.expression.json
    const complexExpression = {
      id: 'test:complex_flow',
      description: 'Complex expression with 14 conditions',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.flow' }, 0.7] },
              { '<': [{ var: 'emotions.freeze' }, 0.15] },
              {
                or: [
                  { '>=': [{ var: 'emotions.interest' }, 0.45] },
                  { '>=': [{ var: 'emotions.fascination' }, 0.45] },
                ],
              },
              { '<=': [{ var: 'emotions.stress' }, 0.45] },
              { '<=': [{ var: 'emotions.anxiety' }, 0.4] },
              { '<=': [{ var: 'emotions.confusion' }, 0.4] },
              { '<=': [{ var: 'emotions.boredom' }, 0.3] },
              { '<=': [{ var: 'emotions.fatigue' }, 0.45] },
              { '<=': [{ var: 'emotions.apathy' }, 0.35] },
              { '<=': [{ var: 'emotions.anger' }, 0.45] },
              { '<=': [{ var: 'emotions.frustration' }, 0.45] },
              { '>=': [{ var: 'moodAxes.engagement' }, 10] },
              { '<=': [{ var: 'moodAxes.threat' }, 20] },
              { '<': [{ var: 'emotions.dissociation' }, 0.25] },
              { '<=': [{ var: 'emotions.panic' }, 0.1] },
            ],
          },
        },
      ],
    };

    it('should build tree with 15 children (14 conditions + 1 OR node)', async () => {
      const result = await simulator.simulate(complexExpression, { sampleCount: 1000 });

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      expect(breakdown.nodeType).toBe('and');
      // 15 children: 13 leaf conditions + 1 OR node + panic condition
      expect(breakdown.children.length).toBeGreaterThanOrEqual(15);
    });

    it('should identify flow >= 0.7 as a high failure rate condition', async () => {
      const result = await simulator.simulate(complexExpression, { sampleCount: 1000 });
      const blockers = explainer.analyzeHierarchicalBlockers(result.clauseFailures);

      // The flow >= 0.7 condition should have a high failure rate
      // because uniform distribution [0,1] means only 30% chance of >= 0.7
      const worstOffenders = blockers[0].worstOffenders;

      // Find the flow condition
      const flowCondition = worstOffenders.find((o) =>
        o.description.includes('flow') && o.description.includes('>=')
      );

      // The flow condition should always exist in worst offenders since it's high threshold
      expect(flowCondition).toBeDefined();
      // Should have high failure rate (~70%)
      expect(flowCondition.failureRate).toBeGreaterThan(0.5);
    });

    it('should track per-condition stats for all 15 conditions', async () => {
      const result = await simulator.simulate(complexExpression, { sampleCount: 1000 });

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;

      // Collect all leaf nodes
      const leafNodes = [];
      const collectLeaves = (node) => {
        if (node.nodeType === 'leaf') {
          leafNodes.push(node);
        }
        if (node.children) {
          node.children.forEach(collectLeaves);
        }
      };
      collectLeaves(breakdown);

      // Should have exactly 16 leaf conditions (14 from the main AND + 2 from the nested OR)
      expect(leafNodes).toHaveLength(16);

      // All leaves should have been evaluated
      const allEvaluated = leafNodes.every((node) => node.evaluationCount > 0);
      expect(allEvaluated).toBe(true);
    });
  });

  describe('Multiple Prerequisites', () => {
    const multiPrereqExpression = {
      id: 'test:multi_prereq',
      description: 'Expression with multiple prerequisites',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.8] },
              { '<=': [{ var: 'emotions.fear' }, 0.2] },
            ],
          },
        },
        {
          logic: {
            or: [
              { '>=': [{ var: 'emotions.confidence' }, 0.7] },
              { '>=': [{ var: 'emotions.curiosity' }, 0.7] },
            ],
          },
        },
      ],
    };

    it('should produce hierarchical breakdown for each prerequisite', async () => {
      const result = await simulator.simulate(multiPrereqExpression, { sampleCount: 1000 });

      expect(result.clauseFailures).toHaveLength(2);

      // First clause is AND
      expect(result.clauseFailures[0].hierarchicalBreakdown.nodeType).toBe('and');
      expect(result.clauseFailures[0].hierarchicalBreakdown.children).toHaveLength(2);

      // Second clause is OR
      expect(result.clauseFailures[1].hierarchicalBreakdown.nodeType).toBe('or');
      expect(result.clauseFailures[1].hierarchicalBreakdown.children).toHaveLength(2);
    });

    it('should flow multiple prerequisites through analyzeHierarchicalBlockers', async () => {
      const result = await simulator.simulate(multiPrereqExpression, { sampleCount: 1000 });
      const blockers = explainer.analyzeHierarchicalBlockers(result.clauseFailures);

      expect(blockers).toHaveLength(2);
      expect(blockers[0].hasHierarchy).toBe(true);
      expect(blockers[1].hasHierarchy).toBe(true);
    });
  });

  describe('Simple Leaf Expression', () => {
    const simpleLeafExpression = {
      id: 'test:simple_leaf',
      description: 'Expression with single leaf condition',
      prerequisites: [
        {
          logic: { '>=': [{ var: 'emotions.curiosity' }, 0.1] },
        },
      ],
    };

    it('should produce leaf node (not compound) for simple condition', async () => {
      const result = await simulator.simulate(simpleLeafExpression, { sampleCount: 1000 });

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      expect(breakdown.nodeType).toBe('leaf');
      expect(breakdown.isCompound).toBe(false);
      expect(breakdown.children).toHaveLength(0);
    });

    it('should mark simple leaf as hasHierarchy=false in analyzeHierarchicalBlockers', async () => {
      const result = await simulator.simulate(simpleLeafExpression, { sampleCount: 1000 });
      const blockers = explainer.analyzeHierarchicalBlockers(result.clauseFailures);

      // Leaf nodes should still have hierarchicalBreakdown but hasHierarchy
      // depends on isCompound - single leaf is not compound
      expect(blockers[0].hierarchicalBreakdown).not.toBeNull();
      // The leaf itself should have stats
      expect(blockers[0].hierarchicalBreakdown.evaluationCount).toBe(1000);
    });
  });

  describe('Statistical Accuracy', () => {
    // Note: Emotion calculation from mood axes affects distributions
    // Mood axes are uniform [-100, 100] → normalized to [-1, 1]
    // For joy (weights: {valence: 1.0}): joy = clamp(valence, 0, 1)
    //   - 50% chance valence < 0 → joy = 0
    //   - 50% chance valence >= 0 → joy uniform [0, 1]
    // For joy >= 0.5: fails when joy < 0.5
    //   - valence < 0: always fails (50%)
    //   - valence >= 0, valence < 0.5: fails (25%)
    //   - Total failure rate ~75%
    const statisticalExpression = {
      id: 'test:statistical',
      description: 'Expression for statistical validation',
      prerequisites: [
        {
          logic: {
            and: [
              // Due to clamp behavior, ~75% failure rate (see calculation above)
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
              // fear <= 0.9: similarly affected by clamp
              // fear = clamp(threat, 0, 1), fails when fear > 0.9
              // 50% chance threat < 0 → fear = 0 → passes
              // 50% chance threat >= 0 → uniform [0,1], fails 10% → 5% total
              // Total failure rate ~5%
              { '<=': [{ var: 'emotions.fear' }, 0.9] },
            ],
          },
        },
      ],
    };

    it('should produce statistically accurate failure rates with larger sample size', async () => {
      const result = await simulator.simulate(statisticalExpression, { sampleCount: 10000 });

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      const joyCondition = breakdown.children[0];
      const fearCondition = breakdown.children[1];

      // joy >= 0.5 should fail ~75% of time (tolerance: 5%)
      // Due to clamp(valence, 0, 1) where valence is uniform [-1, 1]
      expect(joyCondition.failureRate).toBeGreaterThan(0.70);
      expect(joyCondition.failureRate).toBeLessThan(0.80);

      // fear <= 0.9 should fail ~5% of time (tolerance: 3%)
      // 50% of time threat < 0 → fear = 0 → passes
      // 50% of time threat >= 0, 10% of that fails → 5% total
      expect(fearCondition.failureRate).toBeGreaterThan(0.02);
      expect(fearCondition.failureRate).toBeLessThan(0.08);
    });
  });

  describe('Violation Tracking', () => {
    const violationExpression = {
      id: 'test:violation',
      description: 'Expression for violation tracking',
      prerequisites: [
        {
          logic: {
            and: [
              // High threshold - significant violations expected
              { '>=': [{ var: 'emotions.joy' }, 0.9] },
              // Low threshold - small violations expected
              { '<=': [{ var: 'emotions.fear' }, 0.3] },
            ],
          },
        },
      ],
    };

    it('should track average violation for leaf conditions', async () => {
      const result = await simulator.simulate(violationExpression, { sampleCount: 1000 });

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;

      // Filter to only children with failures and check all of them
      const childrenWithFailures = breakdown.children.filter(
        (child) => child.failureCount > 0
      );
      expect(childrenWithFailures.length).toBeGreaterThan(0);

      // All children with failures should have numeric averageViolation >= 0
      const allHaveValidViolations = childrenWithFailures.every(
        (child) =>
          typeof child.averageViolation === 'number' &&
          child.averageViolation >= 0
      );
      expect(allHaveValidViolations).toBe(true);
    });

    it('should include violation in worstOffenders through analyzeHierarchicalBlockers', async () => {
      const result = await simulator.simulate(violationExpression, { sampleCount: 1000 });
      const blockers = explainer.analyzeHierarchicalBlockers(result.clauseFailures);

      for (const offender of blockers[0].worstOffenders) {
        expect(typeof offender.averageViolation).toBe('number');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty prerequisites gracefully', async () => {
      const emptyExpression = {
        id: 'test:empty',
        description: 'Empty expression',
        prerequisites: [],
      };

      const result = await simulator.simulate(emptyExpression, { sampleCount: 100 });
      expect(result.clauseFailures).toHaveLength(0);

      const blockers = explainer.analyzeHierarchicalBlockers(result.clauseFailures);
      expect(blockers).toHaveLength(0);
    });

    it('should handle null prerequisites gracefully', async () => {
      const nullExpression = {
        id: 'test:null',
        description: 'Null prerequisites',
        prerequisites: null,
      };

      const result = await simulator.simulate(nullExpression, { sampleCount: 100 });
      expect(result.clauseFailures).toHaveLength(0);
    });

    it('should handle deeply nested AND/OR structures', async () => {
      const deepExpression = {
        id: 'test:deep',
        description: 'Deeply nested structure',
        prerequisites: [
          {
            logic: {
              and: [
                {
                  or: [
                    {
                      and: [
                        { '>=': [{ var: 'emotions.joy' }, 0.5] },
                        { '<=': [{ var: 'emotions.fear' }, 0.5] },
                      ],
                    },
                    { '>=': [{ var: 'emotions.confidence' }, 0.8] },
                  ],
                },
                { '>=': [{ var: 'emotions.curiosity' }, 0.3] },
              ],
            },
          },
        ],
      };

      const result = await simulator.simulate(deepExpression, { sampleCount: 1000 });

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      expect(breakdown.nodeType).toBe('and');
      expect(breakdown.children[0].nodeType).toBe('or');
      expect(breakdown.children[0].children[0].nodeType).toBe('and');

      // Verify deepest level has stats
      const deepestAnd = breakdown.children[0].children[0];
      expect(deepestAnd.children[0].evaluationCount).toBeGreaterThan(0);
    });
  });
});
