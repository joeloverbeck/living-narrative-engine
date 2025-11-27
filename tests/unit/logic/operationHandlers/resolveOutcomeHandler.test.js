/**
 * @file Unit tests for ResolveOutcomeHandler
 * @jest-environment node
 */

import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import ResolveOutcomeHandler, {
  ResolveOutcomeOperationError,
} from '../../../../src/logic/operationHandlers/resolveOutcomeHandler.js';

/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */

// -----------------------------------------------------------------------------
// Mock Factories
// -----------------------------------------------------------------------------

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/**
 * Creates a mock ChanceCalculationService.
 *
 * @param {object} [overrides] - Optional method overrides
 * @returns {object} Mock service
 */
const createMockChanceCalculationService = (overrides = {}) => ({
  resolveOutcome: jest.fn().mockReturnValue({
    outcome: 'SUCCESS',
    roll: 30,
    threshold: 50,
    margin: -20,
    isCritical: false,
    modifiers: [],
  }),
  calculateForDisplay: jest.fn(),
  ...overrides,
});

/**
 * Builds a mock execution context with configurable event payload.
 *
 * @param {ILogger} loggerInstance - Logger instance for the context.
 * @param {object} [eventPayload] - Event payload overrides.
 * @param {object} [contextData] - Initial context data.
 * @returns {object} Mock execution context.
 */
function buildExecutionContext(
  loggerInstance,
  eventPayload = {},
  contextData = {}
) {
  const defaultPayload = {
    actorId: 'actor-123',
    targetId: 'target-456',
  };

  return {
    evaluationContext: {
      event: {
        type: 'ACTION_PERFORMED',
        payload: { ...defaultPayload, ...eventPayload },
      },
      actor: { id: 'actor-123', name: 'TestActor' },
      target: { id: 'target-456', name: 'TestTarget' },
      context: { ...contextData },
    },
    logger: loggerInstance,
  };
}

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('ResolveOutcomeHandler', () => {
  let handler;
  let mockLogger;
  let mockChanceCalculationService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = createMockLogger();
    mockChanceCalculationService = createMockChanceCalculationService();

    handler = new ResolveOutcomeHandler({
      chanceCalculationService: mockChanceCalculationService,
      logger: mockLogger,
    });
    mockLogger.debug.mockClear();
  });

  // ---------------------------------------------------------------------------
  // Constructor Tests
  // ---------------------------------------------------------------------------

  describe('Constructor', () => {
    test('initializes successfully with valid dependencies', () => {
      const freshLogger = createMockLogger();
      const freshHandler = new ResolveOutcomeHandler({
        chanceCalculationService: mockChanceCalculationService,
        logger: freshLogger,
      });
      expect(freshHandler).toBeDefined();
      expect(freshLogger.debug).toHaveBeenCalledWith(
        'ResolveOutcomeHandler initialized.'
      );
    });

    test('throws if logger is missing', () => {
      expect(
        () =>
          new ResolveOutcomeHandler({
            chanceCalculationService: mockChanceCalculationService,
          })
      ).toThrow(/ILogger instance/);
    });

    test('throws if logger is invalid (missing methods)', () => {
      expect(
        () =>
          new ResolveOutcomeHandler({
            chanceCalculationService: mockChanceCalculationService,
            logger: { info: jest.fn() }, // Missing debug, warn, error
          })
      ).toThrow(/ILogger instance/);
    });

    test('throws if chanceCalculationService is missing', () => {
      expect(
        () =>
          new ResolveOutcomeHandler({
            logger: mockLogger,
          })
      ).toThrow(/chanceCalculationService/);
    });

    test('throws if chanceCalculationService lacks resolveOutcome method', () => {
      expect(
        () =>
          new ResolveOutcomeHandler({
            chanceCalculationService: { otherMethod: jest.fn() },
            logger: mockLogger,
          })
      ).toThrow(/chanceCalculationService/);
    });
  });

  // ---------------------------------------------------------------------------
  // Parameter Validation Tests - Fail Fast Behavior
  // ---------------------------------------------------------------------------

  describe('Parameter Validation - Fail Fast', () => {
    test('throws ResolveOutcomeOperationError when actor_skill_component is missing', () => {
      const ctx = buildExecutionContext(mockLogger);
      const params = { result_variable: 'outcome' };

      expect(() => handler.execute(params, ctx)).toThrow(
        ResolveOutcomeOperationError
      );
      expect(() => handler.execute(params, ctx)).toThrow(
        'Missing or invalid "actor_skill_component"'
      );
    });

    test('throws ResolveOutcomeOperationError when actor_skill_component is not a string', () => {
      const ctx = buildExecutionContext(mockLogger);
      const params = { actor_skill_component: 123, result_variable: 'outcome' };

      expect(() => handler.execute(params, ctx)).toThrow(
        ResolveOutcomeOperationError
      );
      expect(() => handler.execute(params, ctx)).toThrow(
        'Missing or invalid "actor_skill_component"'
      );
    });

    test('throws ResolveOutcomeOperationError when result_variable is missing', () => {
      const ctx = buildExecutionContext(mockLogger);
      const params = { actor_skill_component: 'skills:melee' };

      expect(() => handler.execute(params, ctx)).toThrow(
        ResolveOutcomeOperationError
      );
      expect(() => handler.execute(params, ctx)).toThrow(
        'Missing or invalid "result_variable"'
      );
    });

    test('throws ResolveOutcomeOperationError when result_variable is not a string', () => {
      const ctx = buildExecutionContext(mockLogger);
      const params = {
        actor_skill_component: 'skills:melee',
        result_variable: 42,
      };

      expect(() => handler.execute(params, ctx)).toThrow(
        ResolveOutcomeOperationError
      );
      expect(() => handler.execute(params, ctx)).toThrow(
        'Missing or invalid "result_variable"'
      );
    });

    test('throws ResolveOutcomeOperationError when params is null', () => {
      const ctx = buildExecutionContext(mockLogger);

      expect(() => handler.execute(null, ctx)).toThrow(
        ResolveOutcomeOperationError
      );
    });

    test('throws ResolveOutcomeOperationError when params is undefined', () => {
      const ctx = buildExecutionContext(mockLogger);

      expect(() => handler.execute(undefined, ctx)).toThrow(
        ResolveOutcomeOperationError
      );
    });

    test('includes diagnostic details for missing actor_skill_component', () => {
      const ctx = buildExecutionContext(mockLogger);
      const params = { result_variable: 'outcome' };

      try {
        handler.execute(params, ctx);
        throw new Error('Expected ResolveOutcomeOperationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ResolveOutcomeOperationError);
        expect(err.details.receivedValue).toBeUndefined();
        expect(err.details.receivedType).toBe('undefined');
        expect(err.details.allParams).toEqual(params);
      }
    });

    test('logs error before throwing', () => {
      const ctx = buildExecutionContext(mockLogger);
      const params = { result_variable: 'outcome' };

      expect(() => handler.execute(params, ctx)).toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('actor_skill_component'),
        expect.any(Object)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Event Payload Validation Tests - Fail Fast Behavior
  // ---------------------------------------------------------------------------

  describe('Event Payload Validation - Fail Fast', () => {
    test('throws ResolveOutcomeOperationError when actorId is missing from event payload', () => {
      const ctx = buildExecutionContext(mockLogger, { actorId: undefined });
      const params = {
        actor_skill_component: 'skills:melee',
        result_variable: 'outcome',
      };

      expect(() => handler.execute(params, ctx)).toThrow(
        ResolveOutcomeOperationError
      );
      expect(() => handler.execute(params, ctx)).toThrow('Missing actorId');
    });

    test('includes diagnostic details for missing actorId', () => {
      const ctx = buildExecutionContext(mockLogger, { actorId: undefined });
      const params = {
        actor_skill_component: 'skills:melee',
        result_variable: 'outcome',
      };

      try {
        handler.execute(params, ctx);
        throw new Error('Expected ResolveOutcomeOperationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ResolveOutcomeOperationError);
        expect(err.details.hasEvent).toBe(true);
        expect(err.details.hasPayload).toBe(true);
        expect(err.details.eventPayload).toBeDefined();
        expect(err.details.hasExecutionContext).toBe(true);
        expect(err.details.hasEvaluationContext).toBe(true);
      }
    });

    test('throws ResolveOutcomeOperationError when evaluationContext.context is missing', () => {
      const ctx = {
        evaluationContext: {
          event: { payload: { actorId: 'actor-123' } },
          // context is missing
        },
        logger: mockLogger,
      };
      const params = {
        actor_skill_component: 'skills:melee',
        result_variable: 'outcome',
      };

      expect(() => handler.execute(params, ctx)).toThrow(
        ResolveOutcomeOperationError
      );
      expect(() => handler.execute(params, ctx)).toThrow(
        'Missing evaluationContext.context'
      );
    });

    test('includes diagnostic details for missing context', () => {
      const ctx = {
        evaluationContext: {
          event: { payload: { actorId: 'actor-123' } },
        },
        logger: mockLogger,
      };
      const params = {
        actor_skill_component: 'skills:melee',
        result_variable: 'outcome',
      };

      try {
        handler.execute(params, ctx);
        throw new Error('Expected ResolveOutcomeOperationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ResolveOutcomeOperationError);
        expect(err.details.hasExecutionContext).toBe(true);
        expect(err.details.hasEvaluationContext).toBe(true);
        expect(err.details.result_variable).toBe('outcome');
      }
    });

    test('logs error before throwing for missing actorId', () => {
      const ctx = buildExecutionContext(mockLogger, { actorId: undefined });
      const params = {
        actor_skill_component: 'skills:melee',
        result_variable: 'outcome',
      };

      expect(() => handler.execute(params, ctx)).toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing actorId'),
        expect.any(Object)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Happy Path Tests - Pseudo-ActionDef Construction
  // ---------------------------------------------------------------------------

  describe('Happy Path - Pseudo-ActionDef Construction', () => {
    test('constructs pseudo-actionDef for simple skill check', () => {
      const ctx = buildExecutionContext(mockLogger);
      const params = {
        actor_skill_component: 'skills:melee',
        result_variable: 'combat_result',
      };

      handler.execute(params, ctx);

      expect(mockChanceCalculationService.resolveOutcome).toHaveBeenCalledWith({
        actorId: 'actor-123',
        targetId: 'target-456',
        actionDef: {
          id: 'RESOLVE_OUTCOME_OPERATION',
          chanceBased: {
            enabled: true,
            contestType: 'simple',
            actorSkill: {
              component: 'skills:melee',
              default: 0,
            },
            targetSkill: undefined,
            formula: 'ratio',
            fixedDifficulty: 0,
          },
        },
      });
    });

    test('constructs pseudo-actionDef for opposed skill check', () => {
      const ctx = buildExecutionContext(mockLogger);
      const params = {
        actor_skill_component: 'skills:melee',
        target_skill_component: 'skills:defense',
        result_variable: 'combat_result',
      };

      handler.execute(params, ctx);

      expect(mockChanceCalculationService.resolveOutcome).toHaveBeenCalledWith({
        actorId: 'actor-123',
        targetId: 'target-456',
        actionDef: {
          id: 'RESOLVE_OUTCOME_OPERATION',
          chanceBased: {
            enabled: true,
            contestType: 'opposed',
            actorSkill: {
              component: 'skills:melee',
              default: 0,
            },
            targetSkill: {
              component: 'skills:defense',
              default: 0,
            },
            formula: 'ratio',
            fixedDifficulty: 0,
          },
        },
      });
    });

    test('passes custom default values to pseudo-actionDef', () => {
      const ctx = buildExecutionContext(mockLogger);
      const params = {
        actor_skill_component: 'skills:melee',
        target_skill_component: 'skills:defense',
        actor_skill_default: 15,
        target_skill_default: 10,
        result_variable: 'outcome',
      };

      handler.execute(params, ctx);

      const calledWith =
        mockChanceCalculationService.resolveOutcome.mock.calls[0][0];
      expect(calledWith.actionDef.chanceBased.actorSkill.default).toBe(15);
      expect(calledWith.actionDef.chanceBased.targetSkill.default).toBe(10);
    });

    test('passes difficulty modifier to pseudo-actionDef', () => {
      const ctx = buildExecutionContext(mockLogger);
      const params = {
        actor_skill_component: 'skills:athletics',
        difficulty_modifier: 25,
        result_variable: 'climb_result',
      };

      handler.execute(params, ctx);

      const calledWith =
        mockChanceCalculationService.resolveOutcome.mock.calls[0][0];
      expect(calledWith.actionDef.chanceBased.fixedDifficulty).toBe(25);
    });
  });

  // ---------------------------------------------------------------------------
  // Formula Type Tests
  // ---------------------------------------------------------------------------

  describe('Formula Types', () => {
    test.each(['ratio', 'logistic', 'linear'])(
      'passes %s formula to pseudo-actionDef',
      (formula) => {
        const ctx = buildExecutionContext(mockLogger);
        const params = {
          actor_skill_component: 'skills:melee',
          formula,
          result_variable: 'outcome',
        };

        handler.execute(params, ctx);

        const calledWith =
          mockChanceCalculationService.resolveOutcome.mock.calls[0][0];
        expect(calledWith.actionDef.chanceBased.formula).toBe(formula);
      }
    );

    test('uses default ratio formula when not specified', () => {
      const ctx = buildExecutionContext(mockLogger);
      const params = {
        actor_skill_component: 'skills:melee',
        result_variable: 'outcome',
      };

      handler.execute(params, ctx);

      const calledWith =
        mockChanceCalculationService.resolveOutcome.mock.calls[0][0];
      expect(calledWith.actionDef.chanceBased.formula).toBe('ratio');
    });
  });

  // ---------------------------------------------------------------------------
  // Result Object Tests
  // ---------------------------------------------------------------------------

  describe('Result Object Structure', () => {
    test('result contains all expected properties from service', () => {
      mockChanceCalculationService.resolveOutcome.mockReturnValue({
        outcome: 'SUCCESS',
        roll: 42,
        threshold: 55,
        margin: -13,
        isCritical: false,
        modifiers: [{ type: 'environmental', value: 5 }],
      });

      const ctx = buildExecutionContext(mockLogger);
      const params = {
        actor_skill_component: 'skills:melee',
        result_variable: 'attack_result',
      };

      handler.execute(params, ctx);

      const result = ctx.evaluationContext.context.attack_result;

      expect(result).toHaveProperty('outcome', 'SUCCESS');
      expect(result).toHaveProperty('roll', 42);
      expect(result).toHaveProperty('threshold', 55);
      expect(result).toHaveProperty('margin', -13);
      expect(result).toHaveProperty('isCritical', false);
      // actorSkill and targetSkill are set to 0 for backward compatibility
      expect(result).toHaveProperty('actorSkill', 0);
      expect(result).toHaveProperty('targetSkill', 0);
      // breakdown is empty object for backward compatibility
      expect(result).toHaveProperty('breakdown');
      expect(result).toHaveProperty('modifiers');
      expect(result.modifiers).toEqual([{ type: 'environmental', value: 5 }]);
    });

    test('result is stored in correct context variable', () => {
      const ctx = buildExecutionContext(mockLogger);
      const params = {
        actor_skill_component: 'skills:melee',
        result_variable: 'my_custom_variable',
      };

      handler.execute(params, ctx);

      expect(ctx.evaluationContext.context.my_custom_variable).toBeDefined();
      expect(ctx.evaluationContext.context.my_custom_variable.outcome).toBe(
        'SUCCESS'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Outcome Distribution Tests
  // ---------------------------------------------------------------------------

  describe('Outcome Distribution (via mocked service)', () => {
    test('SUCCESS outcome is returned correctly', () => {
      mockChanceCalculationService.resolveOutcome.mockReturnValue({
        outcome: 'SUCCESS',
        roll: 40,
        threshold: 50,
        margin: -10,
        isCritical: false,
        modifiers: [],
      });

      const ctx = buildExecutionContext(mockLogger);
      handler.execute(
        { actor_skill_component: 'skills:melee', result_variable: 'r' },
        ctx
      );

      expect(ctx.evaluationContext.context.r.outcome).toBe('SUCCESS');
      expect(ctx.evaluationContext.context.r.isCritical).toBe(false);
    });

    test('FAILURE outcome is returned correctly', () => {
      mockChanceCalculationService.resolveOutcome.mockReturnValue({
        outcome: 'FAILURE',
        roll: 75,
        threshold: 50,
        margin: 25,
        isCritical: false,
        modifiers: [],
      });

      const ctx = buildExecutionContext(mockLogger);
      handler.execute(
        { actor_skill_component: 'skills:melee', result_variable: 'r' },
        ctx
      );

      expect(ctx.evaluationContext.context.r.outcome).toBe('FAILURE');
      expect(ctx.evaluationContext.context.r.isCritical).toBe(false);
    });

    test('CRITICAL_SUCCESS outcome is returned correctly', () => {
      mockChanceCalculationService.resolveOutcome.mockReturnValue({
        outcome: 'CRITICAL_SUCCESS',
        roll: 3,
        threshold: 50,
        margin: -47,
        isCritical: true,
        modifiers: [],
      });

      const ctx = buildExecutionContext(mockLogger);
      handler.execute(
        { actor_skill_component: 'skills:melee', result_variable: 'r' },
        ctx
      );

      expect(ctx.evaluationContext.context.r.outcome).toBe('CRITICAL_SUCCESS');
      expect(ctx.evaluationContext.context.r.isCritical).toBe(true);
    });

    test('FUMBLE outcome is returned correctly', () => {
      mockChanceCalculationService.resolveOutcome.mockReturnValue({
        outcome: 'FUMBLE',
        roll: 98,
        threshold: 50,
        margin: 48,
        isCritical: true,
        modifiers: [],
      });

      const ctx = buildExecutionContext(mockLogger);
      handler.execute(
        { actor_skill_component: 'skills:melee', result_variable: 'r' },
        ctx
      );

      expect(ctx.evaluationContext.context.r.outcome).toBe('FUMBLE');
      expect(ctx.evaluationContext.context.r.isCritical).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge Cases
  // ---------------------------------------------------------------------------

  describe('Edge Cases', () => {
    test('uses secondaryId when targetId is not available', () => {
      const ctx = buildExecutionContext(mockLogger, {
        actorId: 'actor-123',
        targetId: undefined,
        secondaryId: 'secondary-789',
      });
      const params = {
        actor_skill_component: 'skills:melee',
        target_skill_component: 'skills:defense',
        result_variable: 'outcome',
      };

      handler.execute(params, ctx);

      expect(mockChanceCalculationService.resolveOutcome).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: 'secondary-789',
        })
      );
    });

    test('does not modify event payload', () => {
      const ctx = buildExecutionContext(mockLogger);
      const originalPayload = JSON.stringify(ctx.evaluationContext.event.payload);

      const params = {
        actor_skill_component: 'skills:melee',
        result_variable: 'outcome',
      };

      handler.execute(params, ctx);

      expect(JSON.stringify(ctx.evaluationContext.event.payload)).toBe(
        originalPayload
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Logging Tests
  // ---------------------------------------------------------------------------

  describe('Logging', () => {
    test('logs debug message on successful execution', () => {
      mockChanceCalculationService.resolveOutcome.mockReturnValue({
        outcome: 'SUCCESS',
        roll: 50,
        threshold: 65,
        margin: -15,
        isCritical: false,
        modifiers: [],
      });

      const ctx = buildExecutionContext(mockLogger);
      const params = {
        actor_skill_component: 'skills:melee',
        result_variable: 'outcome',
      };

      handler.execute(params, ctx);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('RESOLVE_OUTCOME: Stored result in "outcome"')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('outcome: SUCCESS')
      );
    });
  });

  // ---------------------------------------------------------------------------
  // ResolveOutcomeOperationError Class Tests
  // ---------------------------------------------------------------------------

  describe('ResolveOutcomeOperationError class', () => {
    test('has correct name property', () => {
      const error = new ResolveOutcomeOperationError('test message');
      expect(error.name).toBe('ResolveOutcomeOperationError');
    });

    test('stores details object', () => {
      const details = { foo: 'bar', baz: 123 };
      const error = new ResolveOutcomeOperationError('test message', details);
      expect(error.details).toEqual(details);
    });

    test('defaults details to empty object', () => {
      const error = new ResolveOutcomeOperationError('test message');
      expect(error.details).toEqual({});
    });

    test('extends Error', () => {
      const error = new ResolveOutcomeOperationError('test message');
      expect(error).toBeInstanceOf(Error);
    });

    test('preserves message', () => {
      const error = new ResolveOutcomeOperationError('custom error message');
      expect(error.message).toBe('custom error message');
    });
  });
});
