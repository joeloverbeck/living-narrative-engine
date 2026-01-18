/**
 * @file Unit tests for ExpressionEvaluator
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ExpressionEvaluator from '../../../../../src/expressionDiagnostics/services/simulatorCore/ExpressionEvaluator.js';

describe('ExpressionEvaluator', () => {
  let evaluator;

  beforeEach(() => {
    evaluator = new ExpressionEvaluator();
  });

  describe('constructor', () => {
    it('works without any dependencies (default fallback)', () => {
      const evaluator = new ExpressionEvaluator();
      expect(evaluator).toBeDefined();
    });

    it('accepts optional jsonLogicService', () => {
      const mockJsonLogicService = { evaluate: jest.fn() };
      const evaluator = new ExpressionEvaluator({
        jsonLogicService: mockJsonLogicService,
      });
      expect(evaluator).toBeDefined();
    });
  });

  describe('jsonLogicService integration', () => {
    it('uses injected jsonLogicService when provided for evaluatePrerequisite', () => {
      const mockJsonLogicService = {
        evaluate: jest.fn().mockReturnValue(true),
      };
      const evaluator = new ExpressionEvaluator({
        jsonLogicService: mockJsonLogicService,
      });

      const prereq = { logic: { '>=': [{ var: 'moodAxes.valence' }, 0.5] } };
      const context = { moodAxes: { valence: 0.6 } };

      const result = evaluator.evaluatePrerequisite(prereq, context);

      expect(result).toBe(true);
      expect(mockJsonLogicService.evaluate).toHaveBeenCalledWith(
        prereq.logic,
        context
      );
    });

    it('uses injected jsonLogicService when provided for evaluateLeafCondition', () => {
      const mockJsonLogicService = {
        evaluate: jest.fn().mockReturnValue(false),
      };
      const evaluator = new ExpressionEvaluator({
        jsonLogicService: mockJsonLogicService,
      });

      const logic = { '>=': [{ var: 'score' }, 100] };
      const context = { score: 50 };

      const result = evaluator.evaluateLeafCondition(logic, context);

      expect(result).toBe(false);
      expect(mockJsonLogicService.evaluate).toHaveBeenCalledWith(logic, context);
    });

    it('falls back to raw jsonLogic.apply when service not provided', () => {
      const evaluator = new ExpressionEvaluator();

      const prereq = { logic: { '>=': [{ var: 'score' }, 50] } };
      const context = { score: 60 };

      const result = evaluator.evaluatePrerequisite(prereq, context);

      expect(result).toBe(true);
    });

    it('falls back gracefully when service evaluation throws', () => {
      const mockJsonLogicService = {
        evaluate: jest.fn().mockImplementation(() => {
          throw new Error('Service error');
        }),
      };
      const evaluator = new ExpressionEvaluator({
        jsonLogicService: mockJsonLogicService,
      });

      const prereq = { logic: { '>=': [{ var: 'score' }, 50] } };
      const context = { score: 60 };

      const result = evaluator.evaluatePrerequisite(prereq, context);

      expect(result).toBe(false);
    });
  });

  it('builds hierarchical trees with ids and threshold metadata', () => {
    const logic = {
      and: [
        { '>=': [{ var: 'moodAxes.valence' }, 0.5] },
        { '<=': [{ var: 'moodAxes.threat' }, 0.2] },
      ],
    };

    const tree = evaluator.buildHierarchicalTree(logic, '0');

    expect(tree.nodeType).toBe('and');
    expect(tree.children).toHaveLength(2);
    expect(tree.children.map((child) => child.id)).toEqual(['0.0', '0.1']);
    expect(tree.children[0].thresholdValue).toBe(0.5);
    expect(tree.children[0].comparisonOperator).toBe('>=');
    expect(tree.children[0].variablePath).toBe('moodAxes.valence');
  });

  it('increments failure counts and invokes gate outcome recorder', () => {
    const expression = {
      prerequisites: [
        {
          logic: { '>=': [{ var: 'moodAxes.valence' }, 0.5] },
        },
      ],
    };
    const context = { moodAxes: { valence: 0.1 } };
    const clauseTracking = evaluator.initClauseTracking(expression);
    const gateOutcomeRecorder = jest.fn();

    const result = evaluator.evaluateWithTracking(
      expression,
      context,
      clauseTracking,
      false,
      null,
      { gateOutcomeRecorder }
    );

    expect(result.triggered).toBe(false);
    expect(clauseTracking[0].failureCount).toBe(1);
    expect(gateOutcomeRecorder).toHaveBeenCalledTimes(1);
    expect(gateOutcomeRecorder).toHaveBeenCalledWith(
      expect.any(Object),
      context,
      false,
      false,
      null
    );
  });

  it('evaluates threshold operators consistently', () => {
    expect(evaluator.evaluateThresholdCondition(5, '>=', 5)).toBe(true);
    expect(evaluator.evaluateThresholdCondition(5, '>', 5)).toBe(false);
    expect(evaluator.evaluateThresholdCondition(5, '<=', 4)).toBe(false);
    expect(evaluator.evaluateThresholdCondition(5, '<', 6)).toBe(true);
    expect(evaluator.evaluateThresholdCondition(5, '==', 5)).toBe(false);
  });
});
