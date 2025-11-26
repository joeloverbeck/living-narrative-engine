/**
 * @file Unit tests for ResolveOutcomeHandler
 * @jest-environment node
 */

import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import ResolveOutcomeHandler from '../../../../src/logic/operationHandlers/resolveOutcomeHandler.js';

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

const createMockSkillResolverService = (overrides = {}) => ({
  getSkillValue: jest.fn().mockReturnValue({ baseValue: 50, hasComponent: true }),
  ...overrides,
});

const createMockProbabilityCalculatorService = (overrides = {}) => ({
  calculate: jest.fn().mockReturnValue({
    baseChance: 50,
    finalChance: 50,
    breakdown: {
      formula: 'ratio',
      rawCalculation: 50,
      afterModifiers: 50,
      bounds: { min: 5, max: 95 },
    },
  }),
  ...overrides,
});

const createMockOutcomeDeterminerService = (overrides = {}) => ({
  determine: jest.fn().mockReturnValue({
    outcome: 'SUCCESS',
    roll: 30,
    margin: -20,
    isCritical: false,
  }),
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
  let mockSkillResolver;
  let mockProbabilityCalculator;
  let mockOutcomeDeterminer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = createMockLogger();
    mockSkillResolver = createMockSkillResolverService();
    mockProbabilityCalculator = createMockProbabilityCalculatorService();
    mockOutcomeDeterminer = createMockOutcomeDeterminerService();

    handler = new ResolveOutcomeHandler({
      skillResolverService: mockSkillResolver,
      probabilityCalculatorService: mockProbabilityCalculator,
      outcomeDeterminerService: mockOutcomeDeterminer,
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
        skillResolverService: mockSkillResolver,
        probabilityCalculatorService: mockProbabilityCalculator,
        outcomeDeterminerService: mockOutcomeDeterminer,
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
            skillResolverService: mockSkillResolver,
            probabilityCalculatorService: mockProbabilityCalculator,
            outcomeDeterminerService: mockOutcomeDeterminer,
          })
      ).toThrow(/ILogger instance/);
    });

    test('throws if logger is invalid (missing methods)', () => {
      expect(
        () =>
          new ResolveOutcomeHandler({
            skillResolverService: mockSkillResolver,
            probabilityCalculatorService: mockProbabilityCalculator,
            outcomeDeterminerService: mockOutcomeDeterminer,
            logger: { info: jest.fn() }, // Missing debug, warn, error
          })
      ).toThrow(/ILogger instance/);
    });

    test('throws if skillResolverService is missing', () => {
      expect(
        () =>
          new ResolveOutcomeHandler({
            probabilityCalculatorService: mockProbabilityCalculator,
            outcomeDeterminerService: mockOutcomeDeterminer,
            logger: mockLogger,
          })
      ).toThrow(/skillResolverService/);
    });

    test('throws if skillResolverService lacks getSkillValue method', () => {
      expect(
        () =>
          new ResolveOutcomeHandler({
            skillResolverService: { otherMethod: jest.fn() },
            probabilityCalculatorService: mockProbabilityCalculator,
            outcomeDeterminerService: mockOutcomeDeterminer,
            logger: mockLogger,
          })
      ).toThrow(/skillResolverService/);
    });

    test('throws if probabilityCalculatorService is missing', () => {
      expect(
        () =>
          new ResolveOutcomeHandler({
            skillResolverService: mockSkillResolver,
            outcomeDeterminerService: mockOutcomeDeterminer,
            logger: mockLogger,
          })
      ).toThrow(/probabilityCalculatorService/);
    });

    test('throws if probabilityCalculatorService lacks calculate method', () => {
      expect(
        () =>
          new ResolveOutcomeHandler({
            skillResolverService: mockSkillResolver,
            probabilityCalculatorService: { otherMethod: jest.fn() },
            outcomeDeterminerService: mockOutcomeDeterminer,
            logger: mockLogger,
          })
      ).toThrow(/probabilityCalculatorService/);
    });

    test('throws if outcomeDeterminerService is missing', () => {
      expect(
        () =>
          new ResolveOutcomeHandler({
            skillResolverService: mockSkillResolver,
            probabilityCalculatorService: mockProbabilityCalculator,
            logger: mockLogger,
          })
      ).toThrow(/outcomeDeterminerService/);
    });

    test('throws if outcomeDeterminerService lacks determine method', () => {
      expect(
        () =>
          new ResolveOutcomeHandler({
            skillResolverService: mockSkillResolver,
            probabilityCalculatorService: mockProbabilityCalculator,
            outcomeDeterminerService: { otherMethod: jest.fn() },
            logger: mockLogger,
          })
      ).toThrow(/outcomeDeterminerService/);
    });
  });

  // ---------------------------------------------------------------------------
  // Parameter Validation Tests
  // ---------------------------------------------------------------------------

  describe('Parameter Validation', () => {
    test('logs error and returns if actor_skill_component is missing', () => {
      const ctx = buildExecutionContext(mockLogger);
      const params = { result_variable: 'outcome' };

      handler.execute(params, ctx);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'RESOLVE_OUTCOME: Missing or invalid "actor_skill_component" parameter. Must be a non-empty string.',
        { params }
      );
      expect(ctx.evaluationContext.context.outcome).toBeUndefined();
    });

    test('logs error and returns if actor_skill_component is not a string', () => {
      const ctx = buildExecutionContext(mockLogger);
      const params = { actor_skill_component: 123, result_variable: 'outcome' };

      handler.execute(params, ctx);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'RESOLVE_OUTCOME: Missing or invalid "actor_skill_component" parameter. Must be a non-empty string.',
        { params }
      );
    });

    test('logs error and returns if result_variable is missing', () => {
      const ctx = buildExecutionContext(mockLogger);
      const params = { actor_skill_component: 'skills:melee' };

      handler.execute(params, ctx);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'RESOLVE_OUTCOME: Missing or invalid "result_variable" parameter. Must be a non-empty string.',
        { params }
      );
    });

    test('logs error and returns if result_variable is not a string', () => {
      const ctx = buildExecutionContext(mockLogger);
      const params = { actor_skill_component: 'skills:melee', result_variable: 42 };

      handler.execute(params, ctx);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'RESOLVE_OUTCOME: Missing or invalid "result_variable" parameter. Must be a non-empty string.',
        { params }
      );
    });

    test('logs error and returns if params is null', () => {
      const ctx = buildExecutionContext(mockLogger);

      handler.execute(null, ctx);

      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('logs error and returns if params is undefined', () => {
      const ctx = buildExecutionContext(mockLogger);

      handler.execute(undefined, ctx);

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Event Payload Validation Tests
  // ---------------------------------------------------------------------------

  describe('Event Payload Validation', () => {
    test('logs error and returns if actorId is missing from event payload', () => {
      const ctx = buildExecutionContext(mockLogger, { actorId: undefined });
      const params = {
        actor_skill_component: 'skills:melee',
        result_variable: 'outcome',
      };

      handler.execute(params, ctx);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'RESOLVE_OUTCOME: Missing actorId in event payload.',
        expect.any(Object)
      );
      expect(ctx.evaluationContext.context.outcome).toBeUndefined();
    });

    test('logs error and returns if evaluationContext.context is missing', () => {
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

      handler.execute(params, ctx);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'RESOLVE_OUTCOME: Missing evaluationContext.context for variable storage.'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Happy Path Tests
  // ---------------------------------------------------------------------------

  describe('Happy Path - Opposed Skill Check', () => {
    test('executes opposed skill check with both skills present', () => {
      mockSkillResolver.getSkillValue
        .mockReturnValueOnce({ baseValue: 60, hasComponent: true }) // Actor
        .mockReturnValueOnce({ baseValue: 40, hasComponent: true }); // Target

      mockProbabilityCalculator.calculate.mockReturnValue({
        baseChance: 60,
        finalChance: 60,
        breakdown: { formula: 'ratio', rawCalculation: 60, afterModifiers: 60, bounds: { min: 5, max: 95 } },
      });

      mockOutcomeDeterminer.determine.mockReturnValue({
        outcome: 'SUCCESS',
        roll: 45,
        margin: -15,
        isCritical: false,
      });

      const ctx = buildExecutionContext(mockLogger);
      const params = {
        actor_skill_component: 'skills:melee',
        target_skill_component: 'skills:defense',
        result_variable: 'combat_result',
      };

      handler.execute(params, ctx);

      expect(mockSkillResolver.getSkillValue).toHaveBeenCalledTimes(2);
      expect(mockSkillResolver.getSkillValue).toHaveBeenNthCalledWith(
        1,
        'actor-123',
        'skills:melee',
        0
      );
      expect(mockSkillResolver.getSkillValue).toHaveBeenNthCalledWith(
        2,
        'target-456',
        'skills:defense',
        0
      );

      expect(mockProbabilityCalculator.calculate).toHaveBeenCalledWith({
        actorSkill: 60,
        targetSkill: 40,
        difficulty: 0,
        formula: 'ratio',
      });

      expect(mockOutcomeDeterminer.determine).toHaveBeenCalledWith({
        finalChance: 60,
      });

      expect(ctx.evaluationContext.context.combat_result).toEqual({
        outcome: 'SUCCESS',
        roll: 45,
        threshold: 60,
        margin: -15,
        isCritical: false,
        actorSkill: 60,
        targetSkill: 40,
        breakdown: expect.any(Object),
      });
    });

    test('executes opposed skill check with missing target skill (uses default)', () => {
      mockSkillResolver.getSkillValue
        .mockReturnValueOnce({ baseValue: 50, hasComponent: true }) // Actor
        .mockReturnValueOnce({ baseValue: 10, hasComponent: false }); // Target - uses default

      const ctx = buildExecutionContext(mockLogger);
      const params = {
        actor_skill_component: 'skills:melee',
        target_skill_component: 'skills:defense',
        target_skill_default: 10,
        result_variable: 'outcome',
      };

      handler.execute(params, ctx);

      expect(mockSkillResolver.getSkillValue).toHaveBeenNthCalledWith(
        2,
        'target-456',
        'skills:defense',
        10
      );
      expect(ctx.evaluationContext.context.outcome).toBeDefined();
    });

    test('executes fixed difficulty check (no target_skill_component)', () => {
      mockSkillResolver.getSkillValue.mockReturnValue({
        baseValue: 50,
        hasComponent: true,
      });

      const ctx = buildExecutionContext(mockLogger);
      const params = {
        actor_skill_component: 'skills:athletics',
        difficulty_modifier: 25,
        result_variable: 'climb_result',
      };

      handler.execute(params, ctx);

      // Should only call once (for actor)
      expect(mockSkillResolver.getSkillValue).toHaveBeenCalledTimes(1);
      expect(mockSkillResolver.getSkillValue).toHaveBeenCalledWith(
        'actor-123',
        'skills:athletics',
        0
      );

      // Target skill should be 0
      expect(mockProbabilityCalculator.calculate).toHaveBeenCalledWith({
        actorSkill: 50,
        targetSkill: 0,
        difficulty: 25,
        formula: 'ratio',
      });

      expect(ctx.evaluationContext.context.climb_result).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Formula Type Tests
  // ---------------------------------------------------------------------------

  describe('Formula Types', () => {
    test.each(['ratio', 'logistic', 'linear'])(
      'passes %s formula to probability calculator',
      (formula) => {
        const ctx = buildExecutionContext(mockLogger);
        const params = {
          actor_skill_component: 'skills:melee',
          formula,
          result_variable: 'outcome',
        };

        handler.execute(params, ctx);

        expect(mockProbabilityCalculator.calculate).toHaveBeenCalledWith(
          expect.objectContaining({ formula })
        );
      }
    );

    test('uses default ratio formula when not specified', () => {
      const ctx = buildExecutionContext(mockLogger);
      const params = {
        actor_skill_component: 'skills:melee',
        result_variable: 'outcome',
      };

      handler.execute(params, ctx);

      expect(mockProbabilityCalculator.calculate).toHaveBeenCalledWith(
        expect.objectContaining({ formula: 'ratio' })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Result Object Tests
  // ---------------------------------------------------------------------------

  describe('Result Object Structure', () => {
    test('result contains all expected properties', () => {
      mockSkillResolver.getSkillValue.mockReturnValue({
        baseValue: 55,
        hasComponent: true,
      });

      mockProbabilityCalculator.calculate.mockReturnValue({
        baseChance: 55,
        finalChance: 55,
        breakdown: {
          formula: 'ratio',
          rawCalculation: 55,
          afterModifiers: 55,
          bounds: { min: 5, max: 95 },
        },
      });

      mockOutcomeDeterminer.determine.mockReturnValue({
        outcome: 'SUCCESS',
        roll: 42,
        margin: -13,
        isCritical: false,
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
      expect(result).toHaveProperty('actorSkill', 55);
      // targetSkill is 0 because no target_skill_component was provided
      expect(result).toHaveProperty('targetSkill', 0);
      expect(result).toHaveProperty('breakdown');
      expect(result.breakdown).toHaveProperty('formula', 'ratio');
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

    test('breakdown information is included from probability service', () => {
      mockProbabilityCalculator.calculate.mockReturnValue({
        baseChance: 75,
        finalChance: 75,
        breakdown: {
          formula: 'logistic',
          rawCalculation: 73.1,
          afterModifiers: 75,
          bounds: { min: 10, max: 90 },
        },
      });

      const ctx = buildExecutionContext(mockLogger);
      const params = {
        actor_skill_component: 'skills:melee',
        formula: 'logistic',
        result_variable: 'outcome',
      };

      handler.execute(params, ctx);

      const result = ctx.evaluationContext.context.outcome;
      expect(result.breakdown).toEqual({
        formula: 'logistic',
        rawCalculation: 73.1,
        afterModifiers: 75,
        bounds: { min: 10, max: 90 },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Outcome Distribution Tests
  // ---------------------------------------------------------------------------

  describe('Outcome Distribution (via mocked services)', () => {
    test('SUCCESS outcome is returned correctly', () => {
      mockOutcomeDeterminer.determine.mockReturnValue({
        outcome: 'SUCCESS',
        roll: 40,
        margin: -10,
        isCritical: false,
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
      mockOutcomeDeterminer.determine.mockReturnValue({
        outcome: 'FAILURE',
        roll: 75,
        margin: 25,
        isCritical: false,
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
      mockOutcomeDeterminer.determine.mockReturnValue({
        outcome: 'CRITICAL_SUCCESS',
        roll: 3,
        margin: -47,
        isCritical: true,
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
      mockOutcomeDeterminer.determine.mockReturnValue({
        outcome: 'FUMBLE',
        roll: 98,
        margin: 48,
        isCritical: true,
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

      expect(mockSkillResolver.getSkillValue).toHaveBeenNthCalledWith(
        2,
        'secondary-789',
        'skills:defense',
        0
      );
    });

    test('uses actor_skill_default when actor lacks component', () => {
      mockSkillResolver.getSkillValue.mockReturnValue({
        baseValue: 15,
        hasComponent: false,
      });

      const ctx = buildExecutionContext(mockLogger);
      const params = {
        actor_skill_component: 'skills:melee',
        actor_skill_default: 15,
        result_variable: 'outcome',
      };

      handler.execute(params, ctx);

      expect(mockSkillResolver.getSkillValue).toHaveBeenCalledWith(
        'actor-123',
        'skills:melee',
        15
      );
    });

    test('handles zero skill values correctly', () => {
      mockSkillResolver.getSkillValue.mockReturnValue({
        baseValue: 0,
        hasComponent: true,
      });

      mockProbabilityCalculator.calculate.mockReturnValue({
        baseChance: 50,
        finalChance: 50,
        breakdown: { formula: 'ratio', rawCalculation: 50, afterModifiers: 50, bounds: { min: 5, max: 95 } },
      });

      const ctx = buildExecutionContext(mockLogger);
      const params = {
        actor_skill_component: 'skills:melee',
        result_variable: 'outcome',
      };

      handler.execute(params, ctx);

      expect(mockProbabilityCalculator.calculate).toHaveBeenCalledWith(
        expect.objectContaining({ actorSkill: 0 })
      );
      expect(ctx.evaluationContext.context.outcome).toBeDefined();
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
      mockProbabilityCalculator.calculate.mockReturnValue({
        finalChance: 65,
        breakdown: {},
      });
      mockOutcomeDeterminer.determine.mockReturnValue({
        outcome: 'SUCCESS',
        roll: 50,
        margin: -15,
        isCritical: false,
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
});
