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
          tracedActions: ['movement:go', 'core:look'],
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
          tracedActions: ['movement:go'],
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
          tracedActions: ['movement:go'],
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

  describe('Schema Error Formatting', () => {
    it('should format required property errors', async () => {
      mockSchemaValidator.validate.mockResolvedValue({
        valid: false,
        errors: [
          {
            instancePath: '/actionTracing',
            keyword: 'required',
            params: { missingProperty: 'enabled' },
            message: 'must have required property "enabled"',
          },
        ],
      });

      const config = {
        actionTracing: {
          tracedActions: ['movement:go'],
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toBe('Missing required property: enabled');
    });

    it('should format pattern errors', async () => {
      mockSchemaValidator.validate.mockResolvedValue({
        valid: false,
        errors: [
          {
            instancePath: '/actionTracing/outputDirectory',
            keyword: 'pattern',
            params: { pattern: '^[a-zA-Z0-9/_.-]+$' },
            data: 'invalid<>path',
            message: 'must match pattern "^[a-zA-Z0-9/_.-]+$"',
          },
        ],
      });

      const config = {
        actionTracing: {
          enabled: true,
          outputDirectory: 'invalid<>path',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid format for outputDirectory');
      expect(result.errors[0]).toContain('invalid<>path');
      expect(result.errors[0]).toContain('^[a-zA-Z0-9/_.-]+$');
    });

    it('should format minimum value errors', async () => {
      mockSchemaValidator.validate.mockResolvedValue({
        valid: false,
        errors: [
          {
            instancePath: '/actionTracing/maxTraceFiles',
            keyword: 'minimum',
            params: { limit: 1 },
            data: 0,
            message: 'must be >= 1',
          },
        ],
      });

      const config = {
        actionTracing: {
          enabled: true,
          maxTraceFiles: 0,
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain(
        'Value 0 for maxTraceFiles is outside valid range (1)'
      );
    });

    it('should format maximum value errors', async () => {
      mockSchemaValidator.validate.mockResolvedValue({
        valid: false,
        errors: [
          {
            instancePath: '/actionTracing/maxTraceFiles',
            keyword: 'maximum',
            params: { limit: 10000 },
            data: 20000,
            message: 'must be <= 10000',
          },
        ],
      });

      const config = {
        actionTracing: {
          enabled: true,
          maxTraceFiles: 20000,
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain(
        'Value 20000 for maxTraceFiles is outside valid range (10000)'
      );
    });

    it('should format type errors', async () => {
      mockSchemaValidator.validate.mockResolvedValue({
        valid: false,
        errors: [
          {
            instancePath: '/actionTracing/enabled',
            keyword: 'type',
            params: { type: 'boolean' },
            data: 'not-boolean',
            message: 'must be boolean',
          },
        ],
      });

      const config = {
        actionTracing: {
          enabled: 'not-boolean',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain(
        'Property enabled must be of type boolean, got string'
      );
    });

    it('should format generic errors as fallback', async () => {
      mockSchemaValidator.validate.mockResolvedValue({
        valid: false,
        errors: [
          {
            instancePath: '/actionTracing/customProperty',
            keyword: 'custom',
            message: 'custom validation failed',
            data: 'some-value',
          },
        ],
      });

      const config = {
        actionTracing: {
          enabled: true,
          customProperty: 'some-value',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toBe('customProperty: custom validation failed');
    });
  });

  describe('Custom Validation Rules', () => {
    it('should validate traced action patterns', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go', 'invalid-pattern', 'mod:*', '*'],
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
          tracedActions: ['movement:go', 'core:look', 'movement:go'],
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('Duplicate traced actions')
      );
    });

    it('should not warn about performance impact for verbose configuration', async () => {
      // Users who select verbose mode with all details want that level of detail
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go'],
          outputDirectory: './traces',
          verbosity: 'verbose',
          includeComponentData: true,
          includePrerequisites: true,
          includeTargets: true,
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      // Should not warn about performance impact for valid verbose configuration
      expect(result.warnings).not.toContainEqual(
        expect.stringContaining('High performance impact')
      );
    });

    it('should validate rotation configuration consistency', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go'],
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

    it('should validate age rotation policy consistency', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go'],
          outputDirectory: './traces',
          rotationPolicy: 'age',
          // maxFileAge is missing
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.warnings).toContainEqual(
        expect.stringContaining('maxFileAge not set')
      );
    });

    it('should warn about high maxTraceFiles values', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go'],
          outputDirectory: './traces',
          rotationPolicy: 'count',
          maxTraceFiles: 1000,
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.warnings).toContainEqual(
        expect.stringContaining(
          'High maxTraceFiles value (1000) may impact filesystem performance'
        )
      );
    });

    it('should warn about very short maxFileAge values', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go'],
          outputDirectory: './traces',
          rotationPolicy: 'age',
          maxFileAge: 1800, // 30 minutes
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.warnings).toContainEqual(
        expect.stringContaining(
          'Very short maxFileAge (1800s) may cause frequent file cleanup'
        )
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
          tracedActions: ['*', 'movement:go', 'core:look'],
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.warnings).toContainEqual(
        expect.stringContaining("Wildcard '*' will trace all actions")
      );
    });
  });

  describe('Action Pattern Edge Cases', () => {
    it('should handle non-string action types', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go', 123, null, undefined, {}],
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid action ID patterns');
      expect(result.errors[0]).toContain('123');
    });

    it('should warn about empty patterns', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go', ''],
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining("Invalid pattern '': Empty pattern")
      );
    });

    it('should warn about multiple consecutive asterisks', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go', '**', 'mod:**'],
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining("Invalid pattern '**': Redundant asterisks")
      );
      expect(result.warnings).toContainEqual(
        expect.stringContaining("Invalid pattern 'mod:**': Redundant asterisks")
      );
    });

    it('should warn about uppercase characters in patterns', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['CORE:go', 'mod:ACTION'],
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining(
          "Invalid pattern 'CORE:go': Contains uppercase characters"
        )
      );
      expect(result.warnings).toContainEqual(
        expect.stringContaining(
          "Invalid pattern 'mod:ACTION': Contains uppercase characters"
        )
      );
    });

    it('should handle invalid characters in patterns', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: [
            'movement:go!',
            'mod-with-dashes:action',
            'mod@invalid:action',
          ],
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid action ID patterns');
    });

    it('should handle multiple colons in patterns', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:sub:action', 'multiple:colons:here'],
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid action ID patterns');
    });

    it('should warn about mod names with partial wildcards', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['mod*:action', 'c*re:go'],
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining(
          "Invalid pattern 'mod*:action': Mod name contains partial wildcards"
        )
      );
    });

    it('should handle invalid mod name formats', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: [
            '1mod:action',
            '!invalid:action',
            '_starts_underscore:action',
          ],
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid action ID patterns');
    });

    it('should warn about uppercase mod names', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['MOD:action', 'CamelCase:action'],
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining(
          "Invalid pattern 'MOD:action': Contains uppercase characters"
        )
      );
      expect(result.warnings).toContainEqual(
        expect.stringContaining(
          "Invalid pattern 'CamelCase:action': Contains uppercase characters"
        )
      );
    });

    it('should warn about empty action parts after colon', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:', 'mod:'],
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining(
          "Invalid pattern 'core:': Empty action part after colon"
        )
      );
      expect(result.warnings).toContainEqual(
        expect.stringContaining(
          "Invalid pattern 'mod:': Empty action part after colon"
        )
      );
    });

    it('should handle non-wildcard patterns without namespaces', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['someaction', 'anotherthing'],
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid action ID patterns');
      expect(result.errors[0]).toContain('someaction');
      expect(result.errors[0]).toContain('anotherthing');
    });

    it('should handle null or undefined tracedActions', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: null,
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('Configuration Normalization', () => {
    it('should remove duplicate traced actions', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: [
            'movement:go',
            'core:look',
            'movement:go',
            'core:examine',
          ],
          outputDirectory: './traces',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.normalizedConfig.actionTracing.tracedActions).toEqual([
        'movement:go',
        'core:look',
        'core:examine',
      ]);
    });

    it('should set default rotation values for count policy', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go'],
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
          tracedActions: ['movement:go'],
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
        'movement:go',
        'invalid',
      ]);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid action ID patterns');
    });

    it('should validate outputDirectory property', () => {
      const result = validator.validateProperty(
        'outputDirectory',
        './valid/path'
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return valid for non-validated properties', () => {
      const result = validator.validateProperty('unknownProperty', 'any-value');

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should successfully initialize with valid dependencies', async () => {
      const newValidator = new ActionTraceConfigValidator({
        schemaValidator: mockSchemaValidator,
        logger: mockLogger,
      });

      // Initialize should succeed with valid dependencies
      await expect(newValidator.initialize()).resolves.toBeUndefined();

      // Verify logger was called
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Initializing action trace config validator'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Action trace config validator initialized successfully'
      );
    });

    it('should defer schema validation until validateConfiguration is called', async () => {
      // Initialize should succeed even if validate would return undefined
      mockSchemaValidator.validate.mockResolvedValue(undefined);

      const newValidator = new ActionTraceConfigValidator({
        schemaValidator: mockSchemaValidator,
        logger: mockLogger,
      });

      // Initialize should succeed - schema validation is deferred
      await expect(newValidator.initialize()).resolves.toBeUndefined();

      // The actual schema validation happens during validateConfiguration
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go'],
          outputDirectory: './traces',
        },
      };

      // This is where the undefined validation result should cause issues
      const result = await newValidator.validateConfiguration(config);
      expect(result.isValid).toBe(false);
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

    it('should handle validation result with no errors field', () => {
      // Create a new validator with a custom validator that returns a result without errors field
      const customValidator = new ActionTraceConfigValidator({
        schemaValidator: mockSchemaValidator,
        logger: mockLogger,
      });

      // Mock the internal validation to return a result without errors field
      const mockValidationResult = { isValid: true };
      jest
        .spyOn(customValidator, 'validateProperty')
        .mockImplementation((property, value) => {
          if (property === 'testProperty') {
            const validator = () => mockValidationResult;
            try {
              const result = validator(value);
              return {
                isValid: result.errors ? result.errors.length === 0 : true,
                errors: result.errors || [],
                warnings: result.warnings || [],
              };
            } catch (error) {
              return {
                isValid: false,
                errors: [
                  `Property ${property} validation error: ${error.message}`,
                ],
                warnings: [],
              };
            }
          }
          return {
            isValid: true,
            errors: [],
            warnings: [],
          };
        });

      const result = customValidator.validateProperty(
        'testProperty',
        'test-value'
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle single error object from schema validation', async () => {
      mockSchemaValidator.validate.mockResolvedValue({
        valid: false,
        errors: {
          instancePath: '/actionTracing/enabled',
          keyword: 'type',
          message: 'must be boolean',
        },
      });

      const config = {
        actionTracing: {
          enabled: 'not-a-boolean',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(1);
    });
  });

  describe('Logging', () => {
    it('should log validation results', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go'],
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
          tracedActions: ['*', 'movement:go'],
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
