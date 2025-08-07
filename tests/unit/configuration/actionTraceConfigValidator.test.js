/**
 * @file Unit tests for ActionTraceConfigValidator
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ActionTraceConfigValidator from '../../../src/configuration/actionTraceConfigValidator.js';

describe('ActionTraceConfigValidator', () => {
  let validator;
  let mockSchemaValidator;
  let mockLogger;

  beforeEach(async () => {
    // Create mock schema validator
    mockSchemaValidator = {
      validate: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
      addSchema: jest.fn(),
      removeSchema: jest.fn(),
    };

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Create validator instance
    validator = new ActionTraceConfigValidator({
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
    });

    // Initialize the validator
    await validator.initialize();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Validation', () => {
    it('should validate complete valid configuration', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go', 'core:look'],
          outputDirectory: './traces/actions',
          verbosity: 'standard',
          includeComponentData: true,
          includePrerequisites: true,
          includeTargets: true,
          maxTraceFiles: 100,
          rotationPolicy: 'age',
          maxFileAge: 86400,
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.normalizedConfig).toBeDefined();
    });

    it('should reject configuration with schema validation errors', async () => {
      mockSchemaValidator.validate.mockResolvedValue({
        valid: false,
        errors: [
          {
            instancePath: '/actionTracing/enabled',
            keyword: 'type',
            params: { type: 'boolean' },
            message: 'must be boolean',
          },
        ],
      });

      const config = {
        actionTracing: {
          enabled: 'not-a-boolean',
          tracedActions: ['core:go'],
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should format schema errors for user-friendly display', async () => {
      mockSchemaValidator.validate.mockResolvedValue({
        valid: false,
        errors: [
          {
            instancePath: '/actionTracing/verbosity',
            keyword: 'enum',
            params: {
              allowedValues: ['minimal', 'standard', 'detailed', 'verbose'],
            },
            data: 'invalid',
            message: 'must be equal to one of the allowed values',
          },
        ],
      });

      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go'],
          outputDirectory: './traces',
          verbosity: 'invalid',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid value');
      expect(result.errors[0]).toContain(
        'minimal, standard, detailed, verbose'
      );
    });
  });

  describe('Custom Validation Rules', () => {
    it('should validate traced action patterns', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go', 'invalid-pattern', 'mod:*', '*'],
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid action ID patterns');
      expect(result.errors[0]).toContain('invalid-pattern');
    });

    it('should warn about duplicate actions', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go', 'core:look', 'core:go'],
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('Duplicate traced actions')
      );
    });

    it('should assess performance impact', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go'],
          outputDirectory: './traces',
          verbosity: 'verbose',
          includeComponentData: true,
          includePrerequisites: true,
          includeTargets: true,
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('High performance impact')
      );
    });

    it('should validate rotation configuration consistency', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go'],
          outputDirectory: './traces',
          rotationPolicy: 'count',
          // maxTraceFiles is missing
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.warnings).toContainEqual(
        expect.stringContaining('maxTraceFiles not set')
      );
    });

    it('should warn about too many traced actions', async () => {
      const tracedActions = Array.from(
        { length: 25 },
        (_, i) => `mod:action${i}`
      );
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions,
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.warnings).toContainEqual(
        expect.stringContaining('may impact performance')
      );
    });

    it('should warn about wildcard conflicts', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['*', 'core:go', 'core:look'],
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.warnings).toContainEqual(
        expect.stringContaining("Wildcard '*' will trace all actions")
      );
    });
  });

  describe('Configuration Normalization', () => {
    it('should remove duplicate traced actions', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go', 'core:look', 'core:go', 'core:examine'],
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.normalizedConfig.actionTracing.tracedActions).toEqual([
        'core:go',
        'core:look',
        'core:examine',
      ]);
    });

    it('should set default rotation values for count policy', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go'],
          outputDirectory: './traces',
          rotationPolicy: 'count',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.normalizedConfig.actionTracing.maxTraceFiles).toBe(100);
    });

    it('should set default rotation values for age policy', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go'],
          outputDirectory: './traces',
          rotationPolicy: 'age',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.normalizedConfig.actionTracing.maxFileAge).toBe(86400);
    });
  });

  describe('Property Validation', () => {
    it('should validate individual properties', () => {
      const result = validator.validateProperty('tracedActions', [
        'core:go',
        'invalid',
      ]);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid action ID patterns');
    });

    it('should return valid for non-validated properties', () => {
      const result = validator.validateProperty('unknownProperty', 'any-value');

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors', async () => {
      mockSchemaValidator.validate.mockRejectedValue(
        new Error('Schema not found')
      );

      const newValidator = new ActionTraceConfigValidator({
        schemaValidator: mockSchemaValidator,
        logger: mockLogger,
      });

      await expect(newValidator.initialize()).rejects.toThrow(
        'Schema validation setup failed'
      );
    });

    it('should handle validation runtime errors', async () => {
      mockSchemaValidator.validate.mockRejectedValue(
        new Error('Validation error')
      );

      const result = await validator.validateConfiguration({
        actionTracing: {},
      });

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Validation error');
    });

    it('should handle property validation exceptions', () => {
      // Force an error by creating a validator with no custom validators
      const brokenValidator = new ActionTraceConfigValidator({
        schemaValidator: mockSchemaValidator,
        logger: mockLogger,
      });

      // Simulate error by passing null value to tracedActions validator
      const result = brokenValidator.validateProperty('tracedActions', null);

      // Since null handling is built-in, it should return empty errors/warnings
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('Logging', () => {
    it('should log validation results', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go'],
          outputDirectory: './traces',
        },
      };

      await validator.validateConfiguration(config);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('validation passed'),
        expect.any(Object)
      );
    });

    it('should log validation errors', async () => {
      mockSchemaValidator.validate.mockResolvedValue({
        valid: false,
        errors: [{ message: 'test error' }],
      });

      await validator.validateConfiguration({
        actionTracing: {},
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('validation failed'),
        expect.any(Object)
      );
    });

    it('should log individual warnings', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['*', 'core:go'],
          outputDirectory: './traces',
        },
      };

      await validator.validateConfiguration(config);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Config validation warning')
      );
    });
  });
});
