/**
 * @file Unit tests for RecommendationFactsBuilder.
 */

import { describe, it, expect } from '@jest/globals';
import RecommendationFactsBuilder from '../../../../src/expressionDiagnostics/services/RecommendationFactsBuilder.js';

describe('RecommendationFactsBuilder', () => {
  it('builds diagnostic facts from simulator results', () => {
    const builder = new RecommendationFactsBuilder();

    const expression = {
      id: 'expr:diagnostic-facts',
      prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 20] } }],
    };

    const simulationResult = {
      triggerRate: 0.2,
      sampleCount: 10,
      inRegimeSampleCount: 8,
      clauseFailures: [
        {
          clauseDescription: 'emotions.joy >= 0.4',
          inRegimeFailureRate: 0.3,
          averageViolation: 0.1,
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            clauseId: 'var:emotions.joy:>=:0.4',
            clauseType: 'threshold',
            description: 'emotions.joy >= 0.4',
            variablePath: 'emotions.joy',
            inRegimeFailureRate: 0.3,
            averageViolation: 0.1,
            comparisonOperator: '>=',
            thresholdValue: 0.4,
            siblingConditionedFailRate: 0.4,
            nearMissRate: 0.2,
            gatePassInRegimeCount: 6,
            gatePassAndClausePassInRegimeCount: 3,
            rawPassInRegimeCount: 4,
            lostPassInRegimeCount: 1,
            lostPassRateInRegime: 0.25,
          },
        },
      ],
      ablationImpact: {
        clauseImpacts: [
          { clauseId: 'var:emotions.joy:>=:0.4', impact: 0.15 },
        ],
      },
      prototypeEvaluationSummary: {
        emotions: {
          joy: {
            moodSampleCount: 8,
            gatePassCount: 6,
            gateFailCount: 2,
            failedGateCounts: {
              'valence >= 0.4': 2,
              'valence >= 0.7': 1,
            },
            rawScoreSum: 0,
            valueSum: 0,
            valueSumGivenGate: 3,
          },
        },
        sexualStates: {},
      },
      gateCompatibility: {
        emotions: {
          joy: { compatible: false, reason: 'conflict' },
        },
        sexualStates: {},
      },
    };

    const facts = builder.build({ expression, simulationResult });

    expect(facts.expressionId).toBe('expr:diagnostic-facts');
    expect(facts.sampleCount).toBe(10);
    expect(facts.moodRegime.sampleCount).toBe(8);

    const clause = facts.clauses.find(
      (item) => item.clauseId === 'var:emotions.joy:>=:0.4'
    );
    expect(clause).toBeDefined();
    expect(clause.impact).toBeCloseTo(0.15, 6);
    expect(clause.failRateInMood).toBeCloseTo(0.3, 6);
    expect(clause.conditionalFailRate).toBeCloseTo(0.4, 6);
    expect(clause.nearMissRate).toBeCloseTo(0.2, 6);
    expect(clause.prototypeId).toBe('joy');
    expect(clause.operator).toBe('>=');
    expect(clause.thresholdValue).toBeCloseTo(0.4, 6);
    expect(clause.rawPassInRegimeCount).toBe(4);
    expect(clause.lostPassInRegimeCount).toBe(1);
    expect(clause.lostPassRateInRegime).toBeCloseTo(0.25, 6);

    const prototype = facts.prototypes.find(
      (item) => item.prototypeId === 'joy'
    );
    expect(prototype).toBeDefined();
    expect(prototype.gatePassRate).toBeCloseTo(0.75, 6);
    expect(prototype.pThreshGivenGate).toBeCloseTo(0.5, 6);
    expect(prototype.pThreshEffective).toBeCloseTo(0.375, 6);
    expect(prototype.meanValueGivenGate).toBeCloseTo(0.5, 6);
    expect(prototype.compatibilityScore).toBe(-1);
    expect(prototype.failedGateCounts[0]).toEqual({
      gateId: 'valence >= 0.4',
      count: 2,
    });

    const violations = facts.invariants.filter((inv) => inv.ok === false);
    expect(violations).toHaveLength(0);
  });

  it('keeps clause operator nullable when missing threshold metadata', () => {
    const builder = new RecommendationFactsBuilder();

    const simulationResult = {
      sampleCount: 5,
      clauseFailures: [
        {
          clauseDescription: 'emotions.sadness >= 0.2',
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            clauseId: 'var:emotions.sadness:>=:0.2',
            clauseType: 'threshold',
            description: 'emotions.sadness >= 0.2',
            variablePath: 'emotions.sadness',
          },
        },
      ],
    };

    const facts = builder.build({
      expression: { id: 'expr:nullable-operator' },
      simulationResult,
    });

    const clause = facts.clauses.find(
      (item) => item.clauseId === 'var:emotions.sadness:>=:0.2'
    );
    expect(clause).toBeDefined();
    expect(clause.operator).toBeNull();
    expect(clause.thresholdValue).toBeNull();
  });

  it('adds axis conflict details when prototype constraint analysis is available', () => {
    const prototypeConstraintAnalyzer = {
      extractAxisConstraints: () => new Map([['valence', { min: -1, max: 0.2 }]]),
      analyzeEmotionThreshold: () => ({
        axisAnalysis: [
          {
            axis: 'valence',
            weight: 0.8,
            constraintMin: -1,
            constraintMax: 0.2,
            defaultMin: -1,
            defaultMax: 1,
            optimalValue: 0.2,
            contribution: 0.16,
            isBinding: true,
            conflictType: 'positive_weight_low_max',
            lostRawSum: 0.64,
            lostIntensity: 0.8,
            sources: [
              {
                varPath: 'moodAxes.valence',
                operator: '>=',
                threshold: 20,
              },
            ],
          },
        ],
      }),
    };
    const builder = new RecommendationFactsBuilder({
      prototypeConstraintAnalyzer,
    });

    const expression = {
      id: 'expr:axis-conflict',
      prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 20] } }],
    };

    const simulationResult = {
      sampleCount: 10,
      clauseFailures: [
        {
          clauseDescription: 'emotions.joy >= 0.4',
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            clauseId: 'var:emotions.joy:>=:0.4',
            clauseType: 'threshold',
            description: 'emotions.joy >= 0.4',
            variablePath: 'emotions.joy',
            comparisonOperator: '>=',
            thresholdValue: 0.4,
            gatePassInRegimeCount: 6,
            gatePassAndClausePassInRegimeCount: 3,
          },
        },
      ],
      prototypeEvaluationSummary: {
        emotions: {
          joy: {
            moodSampleCount: 8,
            gatePassCount: 6,
            gateFailCount: 2,
            failedGateCounts: {},
            valueSumGivenGate: 3,
          },
        },
        sexualStates: {},
      },
    };

    const facts = builder.build({ expression, simulationResult });
    const prototype = facts.prototypes.find(
      (item) => item.prototypeId === 'joy'
    );

    expect(prototype).toBeDefined();
    expect(prototype.axisConflicts).toHaveLength(1);
    expect(prototype.axisConflicts[0].conflictType).toBe(
      'positive_weight_low_max'
    );
    expect(prototype.axisConflicts[0].contributionDelta).toBeCloseTo(0.64, 6);
    expect(prototype.axisConflicts[0].lostRawSum).toBeCloseTo(0.64, 6);
    expect(prototype.axisConflicts[0].lostIntensity).toBeCloseTo(0.8, 6);
    expect(prototype.axisConflicts[0].sources).toEqual([
      {
        varPath: 'moodAxes.valence',
        operator: '>=',
        threshold: 20,
      },
    ]);
  });
});
