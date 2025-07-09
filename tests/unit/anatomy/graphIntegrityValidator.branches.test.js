import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GraphIntegrityValidator } from '../../../src/anatomy/graphIntegrityValidator.js';
import { ValidationRuleChain } from '../../../src/anatomy/validation/validationRuleChain.js';

/**
 * Additional branch coverage tests for GraphIntegrityValidator
 */

describe('GraphIntegrityValidator branch cases', () => {
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    mockEntityManager = {};
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  it('logs warning when validation ends with multiple warnings', async () => {
    const validator = new GraphIntegrityValidator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    const executeSpy = jest
      .spyOn(ValidationRuleChain.prototype, 'execute')
      .mockImplementation(async (context) => {
        context.addIssues([
          { severity: 'warning', message: 'w1' },
          { severity: 'warning', message: 'w2' },
        ]);
      });

    const result = await validator.validateGraph(['e1'], {}, new Set());

    executeSpy.mockRestore();

    expect(result).toEqual({ valid: true, errors: [], warnings: ['w1', 'w2'] });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'GraphIntegrityValidator: Validation passed with 2 warnings'
    );
  });

  it('logs error when validation produces errors', async () => {
    const validator = new GraphIntegrityValidator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    const executeSpy = jest
      .spyOn(ValidationRuleChain.prototype, 'execute')
      .mockImplementation(async (context) => {
        context.addIssues([{ severity: 'error', message: 'boom' }]);
      });

    const result = await validator.validateGraph(['e2'], {}, new Set());

    executeSpy.mockRestore();

    expect(result).toEqual({ valid: false, errors: ['boom'], warnings: [] });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'GraphIntegrityValidator: Validation failed with 1 errors'
    );
  });
});
