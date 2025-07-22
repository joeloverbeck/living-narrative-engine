// tests/unit/actions/validation/prerequisiteEvaluationService.spans.test.js

import { jest, describe, beforeEach, expect, it } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import { StructuredTrace } from '../../../../src/actions/tracing/structuredTrace.js';
import { mock } from 'jest-mock-extended';

// Mock dependencies
const mockLogger = mock();
const mockJsonLogicEvaluationService = mock();
const mockActionValidationContextBuilder = mock();
const mockGameDataRepository = mock();

// Test data
const mockActor = { id: 'actor1', name: 'Player' };
const mockActionDefinition = { id: 'testAction' };
const mockEvaluationContext = {
  actor: { id: 'actor1' },
};

describe('PrerequisiteEvaluationService › Structured Trace Spans', () => {
  let service;
  let structuredTrace;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    mockActionValidationContextBuilder.buildContext.mockReturnValue(
      mockEvaluationContext
    );
    mockGameDataRepository.getConditionDefinition.mockImplementation((id) => {
      if (id === 'is_strong') {
        return {
          id: 'is_strong',
          logic: { '===': [{ var: 'actor.strength' }, 10] },
        };
      }
      return null;
    });

    service = new PrerequisiteEvaluationService({
      logger: mockLogger,
      jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      actionValidationContextBuilder: mockActionValidationContextBuilder,
      gameDataRepository: mockGameDataRepository,
    });

    // Create a StructuredTrace for testing spans
    structuredTrace = new StructuredTrace();
  });

  describe('Span Creation and Hierarchy', () => {
    it('should create prerequisite.evaluate span when using StructuredTrace', () => {
      const prerequisites = [{ logic: { '===': [1, 1] } }];
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      const spans = [];
      const mockWithSpan = jest.fn((operation, fn, attributes) => {
        spans.push({ operation, attributes });
        return fn();
      });
      structuredTrace.withSpan = mockWithSpan;

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor,
        structuredTrace
      );

      expect(result).toBe(true);

      // Should have the main evaluate span
      const evaluateSpan = spans.find(
        (s) => s.operation === 'prerequisite.evaluate'
      );
      expect(evaluateSpan).toBeDefined();
      expect(evaluateSpan.attributes).toEqual({
        actionId: mockActionDefinition.id,
        actorId: mockActor.id,
        ruleCount: 1,
      });
    });

    it('should create prerequisite.evaluateRules span with rule count', () => {
      const prerequisites = [
        { logic: { '===': [1, 1] } },
        { logic: { '===': [2, 2] } },
      ];
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      const spans = [];
      const mockWithSpan = jest.fn((operation, fn, attributes) => {
        spans.push({ operation, attributes });
        return fn();
      });
      structuredTrace.withSpan = mockWithSpan;

      service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor,
        structuredTrace
      );

      // Should have evaluate, evaluateRules, and rule spans
      expect(spans.length).toBeGreaterThanOrEqual(2);

      const evaluateSpan = spans.find(
        (s) => s.operation === 'prerequisite.evaluate'
      );
      expect(evaluateSpan).toBeDefined();
      expect(evaluateSpan.attributes).toEqual({
        actionId: mockActionDefinition.id,
        actorId: mockActor.id,
        ruleCount: 2,
      });

      const rulesSpan = spans.find(
        (s) => s.operation === 'prerequisite.evaluateRules'
      );
      expect(rulesSpan).toBeDefined();
      expect(rulesSpan.attributes).toEqual({
        actionId: mockActionDefinition.id,
        ruleCount: 2,
      });
    });

    it('should create individual rule spans for each prerequisite', () => {
      const prerequisites = [
        { logic: { '===': [1, 1] } },
        { logic: { '===': [2, 2] } },
        { logic: { '===': [3, 3] } },
      ];
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      const spans = [];
      const mockWithSpan = jest.fn((operation, fn, attributes) => {
        spans.push({ operation, attributes });
        return fn();
      });
      structuredTrace.withSpan = mockWithSpan;

      service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor,
        structuredTrace
      );

      // Should have evaluate, evaluateRules, and 3 rule spans (total 5)
      expect(spans.length).toBeGreaterThanOrEqual(5);

      // Check the rule spans
      const ruleSpans = spans.filter((s) =>
        s.operation.startsWith('prerequisite.rule.')
      );
      expect(ruleSpans).toHaveLength(3);

      ruleSpans.forEach((span, index) => {
        expect(span.operation).toBe(`prerequisite.rule.${index + 1}`);
        expect(span.attributes).toEqual({
          actionId: mockActionDefinition.id,
          ruleNumber: index + 1,
          totalRules: 3,
        });
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with regular TraceContext (no withSpan method)', () => {
      const prerequisites = [{ logic: { '===': [1, 1] } }];
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      // Create a mock trace without withSpan method
      const legacyTrace = {
        step: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
        failure: jest.fn(),
        error: jest.fn(),
        data: jest.fn(),
      };

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor,
        legacyTrace
      );

      expect(result).toBe(true);
      // Should still call the legacy trace methods
      expect(legacyTrace.step).toHaveBeenCalled();
      expect(legacyTrace.success).toHaveBeenCalled();
    });

    it('should work with null trace context', () => {
      const prerequisites = [{ logic: { '===': [1, 1] } }];
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor,
        null
      );

      expect(result).toBe(true);
      // Should not throw error
    });
  });

  describe('Error Handling in Spans', () => {
    it('should handle evaluation errors within spans', () => {
      const prerequisites = [{ logic: { invalid_op: 1 } }];
      const evalError = new Error('Invalid operator');
      mockJsonLogicEvaluationService.evaluate.mockImplementation(() => {
        throw evalError;
      });

      const spans = [];
      const mockWithSpan = jest.fn((operation, fn, attributes) => {
        spans.push({ operation, attributes });
        try {
          return fn();
        } catch (error) {
          // Simulate span error handling
          throw error;
        }
      });
      structuredTrace.withSpan = mockWithSpan;

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor,
        structuredTrace
      );

      expect(result).toBe(false);
      // Should have created spans despite the error
      expect(spans.length).toBeGreaterThan(0);
    });

    it('should handle context building errors within spans', () => {
      const prerequisites = [{ logic: { '===': [1, 1] } }];
      mockActionValidationContextBuilder.buildContext.mockImplementation(() => {
        throw new Error('Context build failed');
      });

      const spans = [];
      const mockWithSpan = jest.fn((operation, fn, attributes) => {
        spans.push({ operation, attributes });
        return fn();
      });
      structuredTrace.withSpan = mockWithSpan;

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor,
        structuredTrace
      );

      expect(result).toBe(false);
      // Should have created at least the top-level span
      expect(spans).toHaveLength(1);
      expect(spans[0].operation).toBe('prerequisite.evaluate');
    });
  });

  describe('Performance Analysis', () => {
    it('should provide span attributes for performance analysis', () => {
      const prerequisites = [
        { logic: { '===': [1, 1] } },
        { logic: { '===': [2, 2] } },
      ];
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      const spans = [];
      const mockWithSpan = jest.fn((operation, fn, attributes) => {
        spans.push({ operation, attributes });
        return fn();
      });
      structuredTrace.withSpan = mockWithSpan;

      service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor,
        structuredTrace
      );

      // Verify all spans have relevant attributes for performance analysis
      const evaluateSpan = spans.find(
        (s) => s.operation === 'prerequisite.evaluate'
      );
      expect(evaluateSpan.attributes).toHaveProperty('actionId');
      expect(evaluateSpan.attributes).toHaveProperty('actorId');
      expect(evaluateSpan.attributes).toHaveProperty('ruleCount');

      const rulesSpan = spans.find(
        (s) => s.operation === 'prerequisite.evaluateRules'
      );
      expect(rulesSpan.attributes).toHaveProperty('actionId');
      expect(rulesSpan.attributes).toHaveProperty('ruleCount');

      const ruleSpans = spans.filter((s) =>
        s.operation.startsWith('prerequisite.rule.')
      );
      ruleSpans.forEach((span, index) => {
        expect(span.attributes).toHaveProperty('actionId');
        expect(span.attributes).toHaveProperty('ruleNumber', index + 1);
        expect(span.attributes).toHaveProperty(
          'totalRules',
          prerequisites.length
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty prerequisites array with spans', () => {
      const prerequisites = [];

      const spans = [];
      const mockWithSpan = jest.fn((operation, fn, attributes) => {
        spans.push({ operation, attributes });
        return fn();
      });
      structuredTrace.withSpan = mockWithSpan;

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor,
        structuredTrace
      );

      expect(result).toBe(true);
      // Should create the main span even for empty prerequisites
      expect(spans).toHaveLength(1);
      expect(spans[0]).toEqual({
        operation: 'prerequisite.evaluate',
        attributes: {
          actionId: mockActionDefinition.id,
          actorId: mockActor.id,
          ruleCount: 0,
        },
      });
    });

    it('should handle rule evaluation failure within spans', () => {
      const prerequisites = [
        { logic: { '===': [1, 1] } }, // This will pass
        { logic: { '===': [1, 2] } }, // This will fail
        { logic: { '===': [3, 3] } }, // This won't be evaluated
      ];

      mockJsonLogicEvaluationService.evaluate
        .mockReturnValueOnce(true) // First rule passes
        .mockReturnValueOnce(false); // Second rule fails

      const spans = [];
      const mockWithSpan = jest.fn((operation, fn, attributes) => {
        spans.push({ operation, attributes });
        return fn();
      });
      structuredTrace.withSpan = mockWithSpan;

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor,
        structuredTrace
      );

      expect(result).toBe(false);

      // Should have created spans for evaluate, evaluateRules, and 2 rule spans (stopping at the failed one)
      expect(spans).toHaveLength(4);

      const ruleSpans = spans.filter((s) =>
        s.operation.startsWith('prerequisite.rule.')
      );
      expect(ruleSpans).toHaveLength(2); // Only first two rules should have spans
    });
  });
});
