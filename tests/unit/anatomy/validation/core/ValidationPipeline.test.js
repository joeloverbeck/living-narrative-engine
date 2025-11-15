import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ValidationPipeline from '../../../../../src/anatomy/validation/core/ValidationPipeline.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createValidator = (
  name,
  { priority = 10, failFast = false, result = undefined } = {}
) => {
  return {
    name,
    priority,
    failFast,
    validate: jest.fn(async () =>
      result ?? {
        errors: [],
        warnings: [],
        suggestions: [],
        passed: [],
      }
    ),
  };
};

describe('ValidationPipeline', () => {
  let logger;
  let registry;
  let validators;
  const recipe = { recipeId: 'test:recipe' };

  beforeEach(() => {
    logger = createLogger();
    validators = [];
    registry = {
      getAll: jest.fn(() => validators),
    };
  });

  it('executes validators in registry order and aggregates results', async () => {
    const executionOrder = [];
    const validatorA = createValidator('validator-a', {
      priority: 5,
      result: {
        errors: [],
        warnings: [
          { type: 'WARN_A', message: 'warn', severity: 'warning' },
        ],
        suggestions: [{ type: 'SUG', message: 'suggestion' }],
        passed: [{ message: 'validator-a', check: 'validator-a' }],
      },
    });
    const validatorB = createValidator('validator-b', {
      priority: 10,
      result: {
        errors: [{ type: 'ERR', message: 'error', severity: 'error' }],
        warnings: [],
        suggestions: [],
        passed: [],
      },
    });
    validatorA.validate.mockImplementation(async () => {
      executionOrder.push('validator-a');
      return {
        errors: [],
        warnings: [
          { type: 'WARN_A', message: 'warn', severity: 'warning' },
        ],
        suggestions: [{ type: 'SUG', message: 'suggestion' }],
        passed: [{ message: 'validator-a', check: 'validator-a' }],
      };
    });
    validatorB.validate.mockImplementation(async () => {
      executionOrder.push('validator-b');
      return {
        errors: [{ type: 'ERR', message: 'error', severity: 'error' }],
        warnings: [],
        suggestions: [],
        passed: [],
      };
    });
    validators = [validatorA, validatorB];

    const pipeline = new ValidationPipeline({ registry, logger });
    const result = await pipeline.execute(recipe);

    expect(executionOrder).toEqual(['validator-a', 'validator-b']);
    expect(result.errors).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.suggestions).toHaveLength(1);
    expect(result.passed).toHaveLength(1);
  });

  it('stops execution when validator failFast is triggered', async () => {
    const validatorA = createValidator('validator-a', {
      priority: 1,
      failFast: true,
      result: {
        errors: [{ type: 'ERR', message: 'error', severity: 'error' }],
        warnings: [],
        suggestions: [],
        passed: [],
      },
    });
    const validatorB = createValidator('validator-b');
    validators = [validatorA, validatorB];

    const pipeline = new ValidationPipeline({ registry, logger });
    await pipeline.execute(recipe);

    expect(validatorB.validate).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "ValidationPipeline: Validator 'validator-a' halted execution due to failFast errors"
    );
  });

  it('respects global failFast option', async () => {
    const validatorA = createValidator('validator-a', {
      result: {
        errors: [{ type: 'ERR', message: 'error', severity: 'error' }],
        warnings: [],
        suggestions: [],
        passed: [],
      },
    });
    const validatorB = createValidator('validator-b');
    validators = [validatorA, validatorB];

    const pipeline = new ValidationPipeline({ registry, logger });
    await pipeline.execute(recipe, { failFast: true });

    expect(validatorB.validate).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "ValidationPipeline: Halting pipeline after 'validator-a' due to failFast option"
    );
  });

  it('respects configuration enablement flags', async () => {
    const validatorA = createValidator('validator-a');
    const validatorB = createValidator('validator-b');
    validators = [validatorA, validatorB];

    const pipeline = new ValidationPipeline({
      registry,
      logger,
      configuration: {
        validators: {
          'validator-b': { enabled: false },
        },
      },
    });

    await pipeline.execute(recipe);

    expect(validatorA.validate).toHaveBeenCalledTimes(1);
    expect(validatorB.validate).not.toHaveBeenCalled();
  });

  it('applies severity overrides to aggregated issues', async () => {
    const validator = createValidator('pattern-matching', {
      result: {
        errors: [],
        warnings: [
          { type: 'PATTERN_WARN', message: 'warn', severity: 'warning' },
        ],
        suggestions: [],
        passed: [],
      },
    });
    validators = [validator];

    const pipeline = new ValidationPipeline({
      registry,
      logger,
      configuration: {
        validators: {
          'pattern-matching': {
            severityOverrides: { PATTERN_WARN: 'error' },
          },
        },
      },
    });

    const result = await pipeline.execute(recipe);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].severity).toBe('error');
    expect(result.warnings).toHaveLength(0);
  });

  it('falls back to legacy skip flags when configuration not provided', async () => {
    const validator = createValidator('pattern-matching');
    validators = [validator];

    const pipeline = new ValidationPipeline({ registry, logger });
    await pipeline.execute(recipe, { skipPatternValidation: true });

    expect(validator.validate).not.toHaveBeenCalled();
  });

  it('records exceptions as validation errors and continues when possible', async () => {
    const validatorA = {
      name: 'validator-a',
      priority: 1,
      failFast: false,
      validate: jest.fn(async () => {
        throw new Error('boom');
      }),
    };
    const validatorB = createValidator('validator-b', {
      result: {
        errors: [],
        warnings: [],
        suggestions: [],
        passed: [{ message: 'b' }],
      },
    });
    validators = [validatorA, validatorB];

    const pipeline = new ValidationPipeline({ registry, logger });
    const result = await pipeline.execute(recipe);

    expect(logger.error).toHaveBeenCalledWith(
      "ValidationPipeline: Validator 'validator-a' threw an exception",
      expect.any(Error)
    );
    expect(result.errors.some((issue) => issue.type === 'VALIDATION_ERROR')).toBe(
      true
    );
    expect(validatorB.validate).toHaveBeenCalledTimes(1);
  });
});
