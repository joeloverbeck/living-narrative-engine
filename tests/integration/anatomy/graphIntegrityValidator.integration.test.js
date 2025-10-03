import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { GraphIntegrityValidator } from '../../../src/anatomy/graphIntegrityValidator.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ValidationRuleChain } from '../../../src/anatomy/validation/validationRuleChain.js';
import { ValidationContext } from '../../../src/anatomy/validation/validationContext.js';

/**
 * Creates a minimal logger spy object for the validator.
 *
 * @returns {{ debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock }}
 */
function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('GraphIntegrityValidator integration coverage', () => {
  /** @type {{ debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock }} */
  let logger;
  /** @type {Record<string, unknown>} */
  let entityManager;

  beforeEach(() => {
    logger = createLogger();
    entityManager = {};
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requires both entityManager and logger dependencies', () => {
    expect(() => new GraphIntegrityValidator({ logger })).toThrow(
      new InvalidArgumentError('entityManager is required')
    );

    expect(() => new GraphIntegrityValidator({ entityManager })).toThrow(
      new InvalidArgumentError('logger is required')
    );
  });

  it('initializes the validation rule chain and logs the configured rule count', () => {
    const getRuleCountSpy = jest.spyOn(
      ValidationRuleChain.prototype,
      'getRuleCount'
    );

    // Instantiation triggers rule chain construction and logging.
    new GraphIntegrityValidator({ entityManager, logger });

    expect(getRuleCountSpy).toHaveBeenCalled();
    expect(
      logger.debug.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes(
            'GraphIntegrityValidator: Initialized with 6 validation rules'
          )
      )
    ).toBe(true);
  });

  it('creates a validation context and returns success when no issues are found', async () => {
    const contexts = [];
    const executeSpy = jest
      .spyOn(ValidationRuleChain.prototype, 'execute')
      .mockImplementation(async (context) => {
        contexts.push(context);
      });

    const validator = new GraphIntegrityValidator({ entityManager, logger });
    const entityIds = ['torso', 'arm'];
    const recipe = { name: 'basic' };
    const socketOccupancy = new Set(['socket:shoulder']);

    const result = await validator.validateGraph(
      entityIds,
      recipe,
      socketOccupancy
    );

    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(contexts).toHaveLength(1);
    const [context] = contexts;
    expect(context).toBeInstanceOf(ValidationContext);
    expect(context.entityIds).toBe(entityIds);
    expect(context.recipe).toBe(recipe);
    expect(context.socketOccupancy).toBe(socketOccupancy);

    expect(result).toEqual({ valid: true, errors: [], warnings: [] });
    expect(
      logger.debug.mock.calls.some(([message]) =>
        typeof message === 'string' &&
        message.includes('GraphIntegrityValidator: Validating graph with 2 entities')
      )
    ).toBe(true);
    expect(
      logger.debug.mock.calls.some(([message]) =>
        typeof message === 'string' &&
        message.includes('GraphIntegrityValidator: Validation passed without issues')
      )
    ).toBe(true);
  });

  it('logs warnings when validation rules emit warning issues', async () => {
    jest
      .spyOn(ValidationRuleChain.prototype, 'execute')
      .mockImplementation(async (context) => {
        context.addIssues([
          { severity: 'warning', message: 'loose socket' },
        ]);
      });

    const validator = new GraphIntegrityValidator({ entityManager, logger });
    const result = await validator.validateGraph(['entity-1'], { recipe: true }, new Set());

    expect(result).toEqual({ valid: true, errors: [], warnings: ['loose socket'] });
    expect(
      logger.warn.mock.calls.some(([message]) =>
        typeof message === 'string' &&
        message.includes('GraphIntegrityValidator: Validation passed with 1 warnings')
      )
    ).toBe(true);
  });

  it('logs errors when validation rules report failures', async () => {
    jest
      .spyOn(ValidationRuleChain.prototype, 'execute')
      .mockImplementation(async (context) => {
        context.addIssues([{ severity: 'error', message: 'disconnected limb' }]);
      });

    const validator = new GraphIntegrityValidator({ entityManager, logger });
    const result = await validator.validateGraph(['entity-2'], {}, new Set());

    expect(result).toEqual({ valid: false, errors: ['disconnected limb'], warnings: [] });
    expect(
      logger.error.mock.calls.some(([message]) =>
        typeof message === 'string' &&
        message.includes('GraphIntegrityValidator: Validation failed with 1 errors')
      )
    ).toBe(true);
  });

  it('captures unexpected execution failures and adds a system validation issue', async () => {
    const failure = new Error('rule blew up');
    jest
      .spyOn(ValidationRuleChain.prototype, 'execute')
      .mockRejectedValue(failure);

    const validator = new GraphIntegrityValidator({ entityManager, logger });
    const result = await validator.validateGraph(['entity-3'], {}, new Set());

    expect(
      logger.error.mock.calls.some(
        ([message, details]) =>
          message === 'GraphIntegrityValidator: Unexpected error during validation' &&
          details && details.error === failure
      )
    ).toBe(true);
    expect(result).toEqual({
      valid: false,
      errors: ['Validation error: rule blew up'],
      warnings: [],
    });
    expect(
      logger.error.mock.calls.some(([message]) =>
        typeof message === 'string' &&
        message.includes('GraphIntegrityValidator: Validation failed with 1 errors')
      )
    ).toBe(true);
  });
});
