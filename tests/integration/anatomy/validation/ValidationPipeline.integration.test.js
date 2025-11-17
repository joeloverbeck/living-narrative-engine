import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ValidationPipeline from '../../../../src/anatomy/validation/core/ValidationPipeline.js';
import ValidatorRegistry from '../../../../src/anatomy/validation/core/ValidatorRegistry.js';
import { BaseValidator } from '../../../../src/anatomy/validation/validators/BaseValidator.js';

class StubValidator extends BaseValidator {
  constructor({ name, priority, failFast = false, logger, execute }) {
    super({ name, priority, failFast, logger });
    this.execute = execute;
  }

  async performValidation(recipe, options, builder) {
    if (this.execute) {
      await this.execute({ recipe, options, builder, name: this.name });
    }
  }
}

describe('ValidationPipeline integration', () => {
  let logger;
  let registry;
  const recipe = { recipeId: 'integration:test' };

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    registry = new ValidatorRegistry({ logger });
  });

  it('executes registered validators in priority order and aggregates results', async () => {
    const order = [];
    registry.register(
      new StubValidator({
        name: 'a-first',
        priority: 1,
        logger,
        execute: async ({ builder }) => {
          order.push('a-first');
          builder
            .addWarning('WARN', 'warn message')
            .addSuggestion('SUG', 'suggestion');
        },
      })
    );
    registry.register(
      new StubValidator({
        name: 'b-second',
        priority: 2,
        logger,
        execute: async ({ builder }) => {
          order.push('b-second');
          builder.addError('ERR', 'error happened');
        },
      })
    );

    const pipeline = new ValidationPipeline({ registry, logger });
    const result = await pipeline.execute(recipe);

    expect(order).toEqual(['a-first', 'b-second']);
    expect(result.errors).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.suggestions).toHaveLength(1);
  });

  it('stops when a validator with failFast emits errors', async () => {
    const stopper = new StubValidator({
      name: 'stopper',
      priority: 1,
      failFast: true,
      logger,
      execute: async ({ builder }) => builder.addError('ERR', 'boom'),
    });
    const skipped = new StubValidator({
      name: 'skipped',
      priority: 2,
      logger,
      execute: jest.fn(),
    });
    registry.register(stopper);
    registry.register(skipped);

    const pipeline = new ValidationPipeline({ registry, logger });
    await pipeline.execute(recipe);

    expect(skipped.execute).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "ValidationPipeline: Validator 'stopper' halted execution due to failFast errors"
    );
  });

  it('does not allow options.failFast=false to override validator failFast', async () => {
    const stopper = new StubValidator({
      name: 'stopper',
      priority: 1,
      failFast: true,
      logger,
      execute: async ({ builder }) => builder.addError('ERR', 'boom'),
    });
    const skipped = new StubValidator({
      name: 'skipped',
      priority: 2,
      logger,
      execute: jest.fn(),
    });
    registry.register(stopper);
    registry.register(skipped);

    const pipeline = new ValidationPipeline({ registry, logger });
    await pipeline.execute(recipe, { failFast: false });

    expect(skipped.execute).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "ValidationPipeline: Validator 'stopper' halted execution due to failFast errors"
    );
  });

  it('respects configuration overrides for enablement and severity remapping', async () => {
    registry.register(
      new StubValidator({
        name: 'pattern-matching',
        priority: 1,
        logger,
        execute: async ({ builder }) =>
          builder.addWarning('PATTERN_WARN', 'warn message'),
      })
    );
    registry.register(
      new StubValidator({
        name: 'descriptor-coverage',
        priority: 2,
        logger,
        execute: async ({ builder }) =>
          builder.addWarning('DESCRIPTOR_WARN', 'should be skipped'),
      })
    );

    const pipeline = new ValidationPipeline({
      registry,
      logger,
      configuration: {
        validators: {
          'descriptor-coverage': { enabled: false },
          'pattern-matching': {
            severityOverrides: { PATTERN_WARN: 'error' },
          },
        },
      },
    });

    const result = await pipeline.execute(recipe);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe('PATTERN_WARN');
    expect(result.warnings).toHaveLength(0);
  });
});
