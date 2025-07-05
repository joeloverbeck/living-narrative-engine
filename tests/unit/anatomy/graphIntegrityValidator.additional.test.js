import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { GraphIntegrityValidator } from '../../../src/anatomy/graphIntegrityValidator.js';
import { ValidationRuleChain } from '../../../src/anatomy/validation/validationRuleChain.js';

/**
 * Additional tests targeting uncovered branches in GraphIntegrityValidator
 */

describe('GraphIntegrityValidator additional coverage', () => {
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      getAllComponentTypesForEntity: jest.fn().mockReturnValue([]),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  it('logs rule count during initialization', () => {
    // Instantiate validator and verify initialization message
    // Six rules are registered in the private initialization method
    new GraphIntegrityValidator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'GraphIntegrityValidator: Initialized with 6 validation rules'
    );
  });

  it('handles unexpected errors from the rule chain', async () => {
    const validator = new GraphIntegrityValidator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    // Force the underlying ValidationRuleChain.execute method to throw
    const originalExecute = ValidationRuleChain.prototype.execute;
    ValidationRuleChain.prototype.execute = jest
      .fn()
      .mockRejectedValue(new Error('boom'));

    const result = await validator.validateGraph(['e1'], {}, new Set());

    // Restore original implementation
    ValidationRuleChain.prototype.execute = originalExecute;

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Validation error: boom');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'GraphIntegrityValidator: Unexpected error during validation',
      expect.objectContaining({ error: expect.any(Error) })
    );
  });
});
