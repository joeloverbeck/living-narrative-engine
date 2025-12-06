import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { GraphIntegrityValidator } from '../../../src/anatomy/graphIntegrityValidator.js';
import { ValidationRuleChain } from '../../../src/anatomy/validation/validationRuleChain.js';
import { ValidationContext } from '../../../src/anatomy/validation/validationContext.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

describe('GraphIntegrityValidator', () => {
  let mockLogger;
  let mockEntityManager;
  let validator;

  const entityIds = ['torso', 'arm'];
  const recipe = { id: 'recipe-1' };
  const socketOccupancy = new Set(['torso:socket']);

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(() => ({ sockets: [{ id: 'socket' }] })),
      getEntityInstance: jest.fn(),
    };

    validator = new GraphIntegrityValidator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('throws when entityManager is missing', () => {
      expect(() => new GraphIntegrityValidator({ logger: mockLogger })).toThrow(
        InvalidArgumentError
      );
    });

    it('throws when logger is missing', () => {
      expect(
        () => new GraphIntegrityValidator({ entityManager: mockEntityManager })
      ).toThrow(InvalidArgumentError);
    });

    it('logs initialization details with rule count', () => {
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'GraphIntegrityValidator: Initialized with 6 validation rules'
      );
    });
  });

  describe('validateGraph', () => {
    it('returns a successful result when no issues are reported', async () => {
      const executeSpy = jest
        .spyOn(ValidationRuleChain.prototype, 'execute')
        .mockImplementation(async () => undefined);

      const result = await validator.validateGraph(
        entityIds,
        recipe,
        socketOccupancy
      );

      expect(executeSpy).toHaveBeenCalledTimes(1);
      expect(executeSpy.mock.calls[0][0]).toBeInstanceOf(ValidationContext);
      expect(result).toEqual({ valid: true, errors: [], warnings: [] });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'GraphIntegrityValidator: Validating graph with 2 entities'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'GraphIntegrityValidator: Validation passed without issues'
      );
    });

    it('logs warnings when validation succeeds with warnings', async () => {
      jest
        .spyOn(ValidationRuleChain.prototype, 'execute')
        .mockImplementation(async (context) => {
          context.addIssues([
            {
              severity: 'warning',
              message: 'incomplete metadata',
              ruleId: 'test-rule',
              context: {},
            },
          ]);
        });

      const result = await validator.validateGraph(
        entityIds,
        recipe,
        socketOccupancy
      );

      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual(['incomplete metadata']);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'GraphIntegrityValidator: Validation passed with 1 warnings'
      );
    });

    it('logs errors when validation fails', async () => {
      jest
        .spyOn(ValidationRuleChain.prototype, 'execute')
        .mockImplementation(async (context) => {
          context.addIssues([
            {
              severity: 'error',
              message: 'missing joint connection',
              ruleId: 'test-rule',
              context: {},
            },
          ]);
        });

      const result = await validator.validateGraph(
        entityIds,
        recipe,
        socketOccupancy
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['missing joint connection']);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'GraphIntegrityValidator: Validation failed with 1 errors'
      );
    });

    it('captures unexpected execution errors as validation issues', async () => {
      const failure = new Error('chain explosion');
      jest
        .spyOn(ValidationRuleChain.prototype, 'execute')
        .mockImplementation(async () => {
          throw failure;
        });

      const result = await validator.validateGraph(
        entityIds,
        recipe,
        socketOccupancy
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([`Validation error: ${failure.message}`]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'GraphIntegrityValidator: Unexpected error during validation',
        { error: failure }
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'GraphIntegrityValidator: Validation failed with 1 errors'
      );
    });
  });
});
