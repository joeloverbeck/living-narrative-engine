/**
 * @file Unit tests for DebugLoggingConfigValidator
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { DebugLoggingConfigValidator } from '../../../../src/logging/config/configValidator.js';

describe('DebugLoggingConfigValidator', () => {
  let testBed;
  let validator;
  let mockSchemaValidator;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockSchemaValidator = testBed.createMock('schemaValidator', ['validateAgainstSchema']);
    
    validator = new DebugLoggingConfigValidator({
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
    });
  });

  describe('Constructor', () => {
    it('should initialize with valid dependencies', () => {
      expect(validator).toBeInstanceOf(DebugLoggingConfigValidator);
    });

    it('should throw error with invalid schema validator', () => {
      expect(() => {
        new DebugLoggingConfigValidator({
          schemaValidator: null,
          logger: mockLogger,
        });
      }).toThrow('Missing required dependency: ISchemaValidator');
    });

    it('should throw error with invalid logger', () => {
      expect(() => {
        new DebugLoggingConfigValidator({
          schemaValidator: mockSchemaValidator,
          logger: null,
        });
      }).toThrow('Missing required dependency: ILogger');
    });
  });

  describe('validateConfig', () => {
    it('should validate valid configuration successfully', () => {
      const config = {
        enabled: true,
        mode: 'development',
        categories: {
          engine: { enabled: true, level: 'debug' }
        }
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = validator.validateConfig(config);

      expect(result.isValid).toBe(true);
      expect(mockSchemaValidator.validateAgainstSchema).toHaveBeenCalledWith(
        config,
        'schema://living-narrative-engine/debug-logging-config.schema.json'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Validating debug logging configuration against schema'
      );
    });

    it('should reject null configuration', () => {
      const result = validator.validateConfig(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Configuration must be a non-null object']);
    });

    it('should reject non-object configuration', () => {
      const result = validator.validateConfig('invalid');

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Configuration must be a non-null object']);
    });

    it('should handle schema validation failures', () => {
      const config = { enabled: 'invalid' };
      
      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: false,
        errors: ['enabled must be boolean'],
        formattedErrors: 'enabled must be boolean',
      });

      const result = validator.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['enabled must be boolean']);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Debug logging configuration validation failed',
        { errors: ['enabled must be boolean'], config }
      );
    });

    it('should handle validation exceptions', () => {
      const config = { enabled: true };
      
      mockSchemaValidator.validateAgainstSchema.mockImplementation(() => {
        throw new Error('Schema validation error');
      });

      const result = validator.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Validation error: Schema validation error']);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during debug logging configuration validation',
        expect.any(Error)
      );
    });
  });

  describe('validateConfigOrThrow', () => {
    it('should not throw for valid configuration', () => {
      const config = { enabled: true, mode: 'development' };
      
      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      expect(() => {
        validator.validateConfigOrThrow(config);
      }).not.toThrow();
    });

    it('should throw for invalid configuration', () => {
      const config = { enabled: 'invalid' };
      
      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: false,
        errors: ['enabled must be boolean'],
        formattedErrors: 'enabled must be boolean',
      });

      expect(() => {
        validator.validateConfigOrThrow(config);
      }).toThrow('Invalid debug logging configuration: enabled must be boolean');
    });
  });

  describe('validateCategory', () => {
    it('should validate valid category configuration', () => {
      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = validator.validateCategory('engine', {
        enabled: true,
        level: 'debug'
      });

      expect(result.isValid).toBe(true);
    });

    it('should reject invalid category name', () => {
      const result = validator.validateCategory('', { enabled: true, level: 'debug' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Category name must be a non-empty string']);
    });

    it('should reject invalid category config', () => {
      const result = validator.validateCategory('engine', null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Category configuration must be a non-null object']);
    });

    it('should handle validation exceptions for categories', () => {
      mockSchemaValidator.validateAgainstSchema.mockImplementation(() => {
        throw new Error('Validation error');
      });

      const result = validator.validateCategory('engine', { enabled: true, level: 'debug' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Validation error: Validation error']);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during debug logging configuration validation',
        expect.any(Error)
      );
    });
  });

  describe('validateRemoteConfig', () => {
    it('should validate valid remote configuration', () => {
      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = validator.validateRemoteConfig({
        endpoint: 'http://localhost:3001/api/debug-log',
        batchSize: 100,
      });

      expect(result.isValid).toBe(true);
    });

    it('should reject invalid remote config', () => {
      const result = validator.validateRemoteConfig(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Remote configuration must be a non-null object']);
    });

    it('should handle remote validation exceptions', () => {
      mockSchemaValidator.validateAgainstSchema.mockImplementation(() => {
        throw new Error('Remote validation error');
      });

      const result = validator.validateRemoteConfig({ endpoint: 'invalid' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Validation error: Remote validation error']);
    });
  });

  describe('performDetailedValidation', () => {
    it('should perform comprehensive validation with valid config', () => {
      const config = {
        enabled: true,
        mode: 'development',
        categories: {
          engine: { enabled: true, level: 'debug' },
          ui: { enabled: true, level: 'info' },
        },
        remote: {
          endpoint: 'http://localhost:3001/api/debug-log',
          batchSize: 100,
        },
      };

      // Mock all validation calls to succeed
      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const report = validator.performDetailedValidation(config);

      expect(report.isValid).toBe(true);
      expect(report.errors).toEqual([]);
      expect(report.categories.engine.isValid).toBe(true);
      expect(report.categories.ui.isValid).toBe(true);
      expect(report.remote.isValid).toBe(true);
      expect(report.validationDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should detect and report category validation failures', () => {
      const config = {
        enabled: true,
        mode: 'development',
        categories: {
          engine: { enabled: 'invalid', level: 'debug' },
        },
      };

      // First call (overall) succeeds, second call (category) fails
      mockSchemaValidator.validateAgainstSchema
        .mockReturnValueOnce({ isValid: true, errors: [] })
        .mockReturnValueOnce({ 
          isValid: false, 
          errors: ['enabled must be boolean'],
          formattedErrors: 'enabled must be boolean'
        });

      const report = validator.performDetailedValidation(config);

      expect(report.isValid).toBe(false);
      expect(report.errors).toContain('Category \'engine\': enabled must be boolean');
      expect(report.categories.engine.isValid).toBe(false);
    });

    it('should add warnings for potential configuration issues', () => {
      const config = {
        enabled: true,
        mode: 'remote', // Remote mode but no endpoint
        performance: {
          slowLogThreshold: 50, // Very low threshold
        },
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const report = validator.performDetailedValidation(config);

      expect(report.warnings).toContain('Remote mode enabled but no endpoint specified');
      expect(report.warnings).toContain('Very low slow log threshold may impact performance');
    });

    it('should warn when logging is disabled but mode is not none', () => {
      const config = {
        enabled: false,
        mode: 'development',
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const report = validator.performDetailedValidation(config);

      expect(report.warnings).toContain('Logging disabled but mode is not "none" - consider setting mode to "none"');
    });

    it('should handle exceptions during detailed validation', () => {
      mockSchemaValidator.validateAgainstSchema.mockImplementation(() => {
        throw new Error('Validation exception');
      });

      const report = validator.performDetailedValidation({ enabled: true });

      expect(report.isValid).toBe(false);
      expect(report.errors).toEqual(['Validation error: Validation exception']);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during debug logging configuration validation',
        expect.any(Error)
      );
    });

    it('should measure validation duration', () => {
      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const report = validator.performDetailedValidation({ enabled: true, mode: 'development' });

      expect(report.validationDurationMs).toBeGreaterThanOrEqual(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/Detailed validation completed in \d+ms/),
        expect.objectContaining({
          isValid: true,
          errorCount: 0,
          warningCount: expect.any(Number)
        })
      );
    });
  });
});