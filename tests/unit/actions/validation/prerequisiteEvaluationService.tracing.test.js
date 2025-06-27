// tests/unit/actions/validation/prerequisiteEvaluationService.tracing.test.js

import { jest, describe, beforeEach, expect, it } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import { mock } from 'jest-mock-extended';

// Mock dependencies
const mockLogger = mock();
const mockJsonLogicEvaluationService = mock();
const mockActionValidationContextBuilder = mock();
const mockGameDataRepository = mock();

// Mock TraceContext
const mockTraceContext = {
  addLog: jest.fn(),
};

// Test data
const mockActor = { id: 'actor1', name: 'Player' };
// CORRECTED: mockTargetContext is no longer needed in these tests.
const mockActionDefinition = { id: 'testAction' };
const mockEvaluationContext = {
  actor: { id: 'actor1' },
  // CORRECTED: The context built for prereqs no longer includes target or global info.
};

describe('PrerequisiteEvaluationService › with Tracing', () => {
  let service;

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
  });

  it('should evaluate to true if there are no prerequisites', () => {
    // CORRECTED: Removed mockTargetContext
    const result = service.evaluate([], mockActionDefinition, mockActor);
    expect(result).toBe(true);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `PrerequisiteEvaluationService: PrereqEval[${mockActionDefinition.id}]: → PASSED (No prerequisites to evaluate).`
    );
  });

  it('should return false if context building fails', () => {
    mockActionValidationContextBuilder.buildContext.mockImplementation(() => {
      throw new Error('Context build failed');
    });
    const prerequisites = [{ logic: { '===': [1, 1] } }];
    // CORRECTED: Removed mockTargetContext
    const result = service.evaluate(
      prerequisites,
      mockActionDefinition,
      mockActor
    );
    expect(result).toBe(false);
  });

  it('should evaluate a single passing rule correctly without tracing', () => {
    const prerequisites = [{ logic: { '===': [1, 1] } }];
    mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);
    // CORRECTED: Removed mockTargetContext
    const result = service.evaluate(
      prerequisites,
      mockActionDefinition,
      mockActor
    );
    expect(result).toBe(true);
    expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
      prerequisites[0].logic,
      mockEvaluationContext
    );
  });

  it('should evaluate a single failing rule correctly without tracing', () => {
    const prerequisites = [{ logic: { '===': [1, 2] } }];
    mockJsonLogicEvaluationService.evaluate.mockReturnValue(false);
    // CORRECTED: Removed mockTargetContext
    const result = service.evaluate(
      prerequisites,
      mockActionDefinition,
      mockActor
    );
    expect(result).toBe(false);
  });

  describe('with Tracing enabled', () => {
    const sourceEvaluate = 'PrerequisiteEvaluationService.evaluate';
    const sourceEvaluatePrerequisite =
      'PrerequisiteEvaluationService._evaluatePrerequisite';

    it('should log the built evaluation context', () => {
      const prerequisites = [{ logic: { '===': [1, 1] } }];
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      // CORRECTED: Removed mockTargetContext
      service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor,
        mockTraceContext
      );

      expect(mockTraceContext.addLog).toHaveBeenCalledWith(
        'data',
        'Built prerequisite evaluation context.',
        sourceEvaluate,
        { context: mockEvaluationContext }
      );
    });

    it('should log the start of a rule evaluation', () => {
      const prerequisites = [{ logic: { '===': [1, 1] } }];
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      // CORRECTED: Removed mockTargetContext
      service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor,
        mockTraceContext
      );

      expect(mockTraceContext.addLog).toHaveBeenCalledWith(
        'info',
        'Evaluating rule.',
        sourceEvaluatePrerequisite,
        { logic: prerequisites[0].logic }
      );
    });

    it('should log the success result of a rule evaluation', () => {
      const prerequisites = [{ logic: { '===': [1, 1] } }];
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      // CORRECTED: Removed mockTargetContext
      service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor,
        mockTraceContext
      );

      expect(mockTraceContext.addLog).toHaveBeenCalledWith(
        'success',
        'Rule evaluation result: true',
        sourceEvaluatePrerequisite,
        { result: true }
      );
    });

    it('should log the failure result of a rule evaluation', () => {
      const prerequisites = [{ logic: { '===': [1, 2] } }];
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(false);

      // CORRECTED: Removed mockTargetContext
      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor,
        mockTraceContext
      );

      expect(result).toBe(false);
      expect(mockTraceContext.addLog).toHaveBeenCalledWith(
        'failure',
        'Rule evaluation result: false',
        sourceEvaluatePrerequisite,
        { result: false }
      );
    });

    it('should log both original and resolved logic for a condition_ref', () => {
      const originalLogic = { condition_ref: 'is_strong' };
      const resolvedLogic = { '===': [{ var: 'actor.strength' }, 10] };
      const prerequisites = [{ logic: originalLogic }];
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      // CORRECTED: Removed mockTargetContext
      service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor,
        mockTraceContext
      );

      // Log original
      expect(mockTraceContext.addLog).toHaveBeenCalledWith(
        'info',
        'Evaluating rule.',
        sourceEvaluatePrerequisite,
        { logic: originalLogic }
      );

      // Log resolved
      expect(mockTraceContext.addLog).toHaveBeenCalledWith(
        'data',
        'Condition reference resolved.',
        sourceEvaluatePrerequisite,
        { resolvedLogic: resolvedLogic }
      );

      // Check that the service called the evaluation with the *resolved* logic
      expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
        resolvedLogic,
        mockEvaluationContext
      );
    });

    it('should NOT log resolved logic if it is the same as the original', () => {
      const logic = { '===': [1, 1] };
      const prerequisites = [{ logic: logic }];
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      // CORRECTED: Removed mockTargetContext
      service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor,
        mockTraceContext
      );

      // Verify that the 'Condition reference resolved' log was NOT called
      const resolvedLogCall = mockTraceContext.addLog.mock.calls.find(
        (call) => call[1] === 'Condition reference resolved.'
      );
      expect(resolvedLogCall).toBeUndefined();
    });

    it('should log an error if rule evaluation throws an exception', () => {
      const prerequisites = [{ logic: { invalid_op: 1 } }];
      const evalError = new Error('Invalid operator');
      mockJsonLogicEvaluationService.evaluate.mockImplementation(() => {
        throw evalError;
      });

      // CORRECTED: Removed mockTargetContext
      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor,
        mockTraceContext
      );

      expect(result).toBe(false);
      expect(mockTraceContext.addLog).toHaveBeenCalledWith(
        'error',
        `Error during rule evaluation: ${evalError.message}`,
        sourceEvaluatePrerequisite,
        { error: evalError }
      );
    });

    it('should not break if trace context is null', () => {
      const prerequisites = [{ logic: { '===': [1, 1] } }];
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      expect(() => {
        // CORRECTED: Removed mockTargetContext
        service.evaluate(
          prerequisites,
          mockActionDefinition,
          mockActor,
          null // explicit null
        );
      }).not.toThrow();

      expect(mockTraceContext.addLog).not.toHaveBeenCalled();
    });
  });
});
