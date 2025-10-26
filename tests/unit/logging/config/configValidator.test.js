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
    mockSchemaValidator = testBed.createMock('schemaValidator', [
      'validateAgainstSchema',
    ]);

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
          engine: { enabled: true, level: 'debug' },
        },
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
      expect(result.errors).toEqual([
        'Configuration must be a non-null object',
      ]);
    });

    it('should reject non-object configuration', () => {
      const result = validator.validateConfig('invalid');

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        'Configuration must be a non-null object',
      ]);
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
      expect(result.errors).toEqual([
        'Validation error: Schema validation error',
      ]);
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
      }).toThrow(
        'Invalid debug logging configuration: enabled must be boolean'
      );
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
        level: 'debug',
      });

      expect(result.isValid).toBe(true);
    });

    it('should reject invalid category name', () => {
      const result = validator.validateCategory('', {
        enabled: true,
        level: 'debug',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        'Category name must be a non-empty string',
      ]);
    });

    it('should reject invalid category config', () => {
      const result = validator.validateCategory('engine', null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        'Category configuration must be a non-null object',
      ]);
    });

    it('should handle validation exceptions for categories', () => {
      mockSchemaValidator.validateAgainstSchema.mockImplementation(() => {
        throw new Error('Validation error');
      });

      const result = validator.validateCategory('engine', {
        enabled: true,
        level: 'debug',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Validation error: Validation error']);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during debug logging configuration validation',
        expect.any(Error)
      );
    });

    it('should handle unexpected errors during category validation', () => {
      const spy = jest
        .spyOn(validator, 'validateConfig')
        .mockImplementation(() => {
          throw new Error('Category crash');
        });

      const result = validator.validateCategory('engine', {
        enabled: true,
        level: 'debug',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        'Category validation error: Category crash',
      ]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error validating category 'engine'",
        expect.any(Error)
      );

      spy.mockRestore();
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
      expect(result.errors).toEqual([
        'Remote configuration must be a non-null object',
      ]);
    });

    it('should handle remote validation exceptions', () => {
      mockSchemaValidator.validateAgainstSchema.mockImplementation(() => {
        throw new Error('Remote validation error');
      });

      const result = validator.validateRemoteConfig({ endpoint: 'invalid' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        'Validation error: Remote validation error',
      ]);
    });

    it('should handle unexpected errors during remote validation', () => {
      const spy = jest
        .spyOn(validator, 'validateConfig')
        .mockImplementation(() => {
          throw new Error('Remote crash');
        });

      const result = validator.validateRemoteConfig({ endpoint: 'invalid' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        'Remote validation error: Remote crash',
      ]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error validating remote configuration',
        expect.any(Error)
      );

      spy.mockRestore();
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
          formattedErrors: 'enabled must be boolean',
        });

      const report = validator.performDetailedValidation(config);

      expect(report.isValid).toBe(false);
      expect(report.errors).toContain(
        "Category 'engine': enabled must be boolean"
      );
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

      expect(report.warnings).toContain(
        'Remote mode enabled but no endpoint specified'
      );
      expect(report.warnings).toContain(
        'Very low slow log threshold may impact performance'
      );
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

      expect(report.warnings).toContain(
        'Logging disabled but mode is not "none" - consider setting mode to "none"'
      );
    });

    it('should report remote validation failures', () => {
      const config = {
        enabled: true,
        mode: 'remote',
        remote: { endpoint: 'https://api.example.com/logs' },
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      jest
        .spyOn(validator, 'validateRemoteConfig')
        .mockReturnValue({
          isValid: false,
          errors: ['remote invalid'],
          formattedErrors: 'remote invalid',
        });

      const report = validator.performDetailedValidation(config);

      expect(report.isValid).toBe(false);
      expect(report.errors).toContain('Remote config: remote invalid');

      validator.validateRemoteConfig.mockRestore();
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

    it('should handle unexpected errors during detailed validation', () => {
      jest.spyOn(validator, 'validateConfig').mockImplementation(() => {
        throw new Error('Detailed crash');
      });

      const report = validator.performDetailedValidation({ enabled: true });

      expect(report.isValid).toBe(false);
      expect(report.errors).toEqual([
        'Detailed validation error: Detailed crash',
      ]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during detailed validation',
        expect.any(Error)
      );

      validator.validateConfig.mockRestore();
    });

    it('should measure validation duration', () => {
      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const report = validator.performDetailedValidation({
        enabled: true,
        mode: 'development',
      });

      expect(report.validationDurationMs).toBeGreaterThanOrEqual(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/Detailed validation completed in \d+ms/),
        expect.objectContaining({
          isValid: true,
          errorCount: 0,
          warningCount: expect.any(Number),
        })
      );
    });
  });

  describe('validateSemanticRules', () => {
    it('should validate configuration without semantic issues', () => {
      const config = {
        enabled: true,
        mode: 'development',
        categories: {
          engine: { enabled: true, level: 'debug' },
        },
        remote: {
          endpoint: 'http://localhost:3001',
          batchSize: 100,
          flushInterval: 1000,
        },
      };

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should detect mode-category mismatch', () => {
      const config = {
        enabled: true,
        mode: 'none',
        categories: {
          engine: { enabled: true, level: 'debug' },
          ui: { enabled: true, level: 'info' },
        },
      };

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Categories enabled but mode is "none": engine, ui'
      );
    });

    it('should detect remote mode without endpoint', () => {
      const config = {
        enabled: true,
        mode: 'remote',
      };

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Remote or hybrid mode enabled but no endpoint specified'
      );
    });

    it('should detect hybrid mode without endpoint', () => {
      const config = {
        enabled: true,
        mode: 'hybrid',
      };

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Remote or hybrid mode enabled but no endpoint specified'
      );
    });

    it('should warn about batch-flush imbalance', () => {
      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'http://localhost:3001',
          batchSize: 800,
          flushInterval: 300,
        },
      };

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Large batch with short interval may cause performance issues'
      );
    });

    it('should warn about excessive retry delays', () => {
      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'http://localhost:3001',
          retryMaxDelay: 120000,
        },
      };

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Very high retry max delay may cause poor user experience'
      );
    });

    it('should warn about circuit breaker imbalance', () => {
      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'http://localhost:3001',
          circuitBreakerThreshold: 15,
          circuitBreakerTimeout: 20000,
        },
      };

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'High failure threshold with short timeout may cause frequent circuit breaker activation'
      );
    });

    it('should handle exceptions during semantic validation', () => {
      const config = null;

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Semantic validation error/);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during semantic validation',
        expect.any(Error)
      );
    });

    it('should allow mode "none" without categories', () => {
      const config = {
        enabled: true,
        mode: 'none',
      };

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should allow mode "none" with disabled categories', () => {
      const config = {
        enabled: true,
        mode: 'none',
        categories: {
          engine: { enabled: false, level: 'debug' },
        },
      };

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('validateSecurityConstraints', () => {
    beforeEach(() => {
      // Reset NODE_ENV for each test
      delete process.env.NODE_ENV;
    });

    it('should validate configuration without security issues', () => {
      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'https://api.example.com/logs',
          batchSize: 100,
          flushInterval: 1000,
        },
      };

      const result = validator.validateSecurityConstraints(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should flag localhost in production', () => {
      process.env.NODE_ENV = 'production';
      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'http://localhost:3001/logs',
        },
      };

      const result = validator.validateSecurityConstraints(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Using localhost endpoint in production environment'
      );
    });

    it('should warn about insecure HTTP in production', () => {
      process.env.NODE_ENV = 'production';
      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'http://api.example.com/logs',
        },
      };

      const result = validator.validateSecurityConstraints(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Using insecure HTTP endpoint in production'
      );
    });

    it('should warn about large batch sizes', () => {
      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'https://api.example.com/logs',
          batchSize: 2000,
        },
      };

      const result = validator.validateSecurityConstraints(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Very large batch size may cause memory issues'
      );
    });

    it('should warn about excessive flush frequency', () => {
      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'https://api.example.com/logs',
          flushInterval: 100,
        },
      };

      const result = validator.validateSecurityConstraints(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Very short flush interval may cause performance degradation'
      );
    });

    it('should warn about permissive circuit breaker', () => {
      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'https://api.example.com/logs',
          circuitBreakerThreshold: 75,
        },
      };

      const result = validator.validateSecurityConstraints(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Very high circuit breaker threshold may not provide adequate protection'
      );
    });

    it('should handle exceptions during security validation', () => {
      const config = null;

      const result = validator.validateSecurityConstraints(config);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Security validation error/);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during security validation',
        expect.any(Error)
      );
    });

    it('should allow localhost in development', () => {
      process.env.NODE_ENV = 'development';
      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'http://localhost:3001/logs',
        },
      };

      const result = validator.validateSecurityConstraints(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should allow HTTP in development', () => {
      process.env.NODE_ENV = 'development';
      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'http://api.example.com/logs',
        },
      };

      const result = validator.validateSecurityConstraints(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('validateEndpointReachability', () => {
    beforeEach(() => {
      // Mock global fetch for testing
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should validate reachable endpoint', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await validator.validateEndpointReachability(
        'http://localhost:3001'
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001', {
        method: 'HEAD',
        signal: expect.any(AbortSignal),
      });
    });

    it('should handle unreachable endpoint with HTTP error', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await validator.validateEndpointReachability(
        'http://invalid:3001'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Endpoint returned status: 404']);
    });

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await validator.validateEndpointReachability(
        'http://invalid:3001'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Cannot reach endpoint: Network error']);
    });

    it('should handle timeout errors', async () => {
      global.fetch.mockImplementation(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => reject({ name: 'AbortError' }), 100);
        });
      });

      const result = await validator.validateEndpointReachability(
        'http://slow:3001',
        50
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Endpoint timeout after 50ms']);
    }, 10000);

    it('should reject invalid endpoint parameter', async () => {
      const result = await validator.validateEndpointReachability(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Endpoint must be a non-empty string']);
    });

    it('should reject empty endpoint parameter', async () => {
      const result = await validator.validateEndpointReachability('');

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Endpoint must be a non-empty string']);
    });

    it('should handle exceptions during endpoint validation', async () => {
      // Mock an unexpected error during validation setup
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = null;

      const result =
        await validator.validateEndpointReachability('http://test:3001');

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Endpoint validation error/);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during endpoint reachability validation',
        expect.any(Error)
      );

      global.setTimeout = originalSetTimeout;
    });
  });

  describe('performComprehensiveValidation', () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should perform all validation layers successfully', async () => {
      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'https://api.example.com/logs',
          batchSize: 100,
          flushInterval: 1000,
        },
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = await validator.performComprehensiveValidation(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.layers.schema.isValid).toBe(true);
      expect(result.layers.semantic.isValid).toBe(true);
      expect(result.layers.security.isValid).toBe(true);
      expect(result.layers.runtime.isValid).toBe(true);
      expect(result.validationDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should fail when schema validation fails', async () => {
      const config = { enabled: 'invalid' };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: false,
        errors: ['enabled must be boolean'],
        formattedErrors: 'enabled must be boolean',
      });

      const result = await validator.performComprehensiveValidation(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('enabled must be boolean');
      expect(result.layers.schema.isValid).toBe(false);
    });

    it('should fail when semantic validation fails', async () => {
      const config = {
        enabled: true,
        mode: 'remote',
        // Missing endpoint
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = await validator.performComprehensiveValidation(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Remote or hybrid mode enabled but no endpoint specified'
      );
      expect(result.layers.semantic.isValid).toBe(false);
    });

    it('should fail when security validation fails', async () => {
      process.env.NODE_ENV = 'production';
      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'http://localhost:3001',
        },
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = await validator.performComprehensiveValidation(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Using localhost endpoint in production environment'
      );
      expect(result.layers.security.isValid).toBe(false);

      delete process.env.NODE_ENV;
    });

    it('should add warnings for unreachable endpoints but continue', async () => {
      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'http://unreachable:3001',
        },
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      global.fetch.mockRejectedValue(new Error('Network unreachable'));

      const result = await validator.performComprehensiveValidation(config);

      expect(result.isValid).toBe(true); // Still valid overall
      expect(result.warnings).toContain(
        'Cannot reach endpoint: Network unreachable'
      );
      expect(result.layers.runtime.isValid).toBe(false);
    });

    it('should support skipping schema validation', async () => {
      const config = { enabled: 'invalid' };

      const result = await validator.performComprehensiveValidation(config, {
        skipSchema: true,
      });

      expect(result.layers.schema).toBe(null);
      expect(mockSchemaValidator.validateAgainstSchema).not.toHaveBeenCalled();
    });

    it('should support skipping semantic validation', async () => {
      const config = {
        enabled: true,
        mode: 'remote',
        // Missing endpoint - would normally cause semantic failure
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = await validator.performComprehensiveValidation(config, {
        skipSemantic: true,
      });

      expect(result.layers.semantic).toBe(null);
      expect(result.isValid).toBe(true); // No semantic validation performed
    });

    it('should support skipping security validation', async () => {
      process.env.NODE_ENV = 'production';
      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'http://localhost:3001',
        },
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = await validator.performComprehensiveValidation(config, {
        skipSecurity: true,
      });

      expect(result.layers.security).toBe(null);
      expect(result.isValid).toBe(true); // No security validation performed

      delete process.env.NODE_ENV;
    });

    it('should support skipping runtime validation', async () => {
      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'http://unreachable:3001',
        },
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = await validator.performComprehensiveValidation(config, {
        skipRuntime: true,
      });

      expect(result.layers.runtime).toBe(null);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should skip runtime validation when no endpoint is configured', async () => {
      const config = {
        enabled: true,
        mode: 'console',
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = await validator.performComprehensiveValidation(config);

      expect(result.layers.runtime).toBe(null);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle exceptions during comprehensive validation', async () => {
      const config = { enabled: true };

      // Mock an error that happens after schema validation
      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      // Create a spy that will throw during debug logging
      const debugSpy = jest
        .spyOn(validator, 'validateSemanticRules')
        .mockImplementation(() => {
          throw new Error('Semantic validation system error');
        });

      const result = await validator.performComprehensiveValidation(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        'Comprehensive validation error: Semantic validation system error',
      ]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during comprehensive validation',
        expect.any(Error)
      );

      debugSpy.mockRestore();
    });

    it('should log debug information about validation completion', async () => {
      const config = {
        enabled: true,
        mode: 'console',
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      await validator.performComprehensiveValidation(config);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/Comprehensive validation completed in \d+ms/),
        expect.objectContaining({
          isValid: true,
          errorCount: 0,
          warningCount: expect.any(Number),
          layersExecuted: expect.arrayContaining([
            'schema',
            'semantic',
            'security',
          ]),
        })
      );
    });

    it('should collect warnings from multiple layers', async () => {
      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'http://unreachable:3001',
          batchSize: 2000,
          flushInterval: 100,
        },
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      global.fetch.mockRejectedValue(new Error('Network unreachable'));

      const result = await validator.performComprehensiveValidation(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(2);
      expect(result.warnings).toContain(
        'Very large batch size may cause memory issues'
      );
      expect(result.warnings).toContain(
        'Very short flush interval may cause performance degradation'
      );
      expect(result.warnings).toContain(
        'Cannot reach endpoint: Network unreachable'
      );
    });
  });

  describe('validateCategorizationStrategy', () => {
    it('should validate source-based strategy with proper configuration', () => {
      const config = {
        categorization: {
          strategy: 'source-based',
          sourceMappings: {
            'src/actions': 'actions',
            'src/entities': 'entities',
          },
          enableStackTraceExtraction: true,
        },
      };

      const result = validator.validateCategorizationStrategy(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should validate pattern-based strategy', () => {
      const config = {
        categorization: {
          strategy: 'pattern-based',
        },
      };

      const result = validator.validateCategorizationStrategy(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate hybrid strategy with recommendations', () => {
      const config = {
        categorization: {
          strategy: 'hybrid',
          sourceMappings: {
            'src/actions': 'actions',
          },
          migration: {
            preserveOldPatterns: true,
          },
        },
      };

      const result = validator.validateCategorizationStrategy(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should reject invalid strategy', () => {
      const config = {
        categorization: {
          strategy: 'invalid-strategy',
        },
      };

      const result = validator.validateCategorizationStrategy(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Invalid strategy 'invalid-strategy'. Must be one of: source-based, pattern-based, hybrid"
      );
    });

    it('should warn about source-based strategy without sourceMappings', () => {
      const config = {
        categorization: {
          strategy: 'source-based',
        },
      };

      const result = validator.validateCategorizationStrategy(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Source-based strategy requires sourceMappings configuration'
      );
    });

    it('should warn about hybrid strategy without sourceMappings', () => {
      const config = {
        categorization: {
          strategy: 'hybrid',
        },
      };

      const result = validator.validateCategorizationStrategy(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Hybrid strategy should include sourceMappings for optimal performance'
      );
    });

    it('should warn about pattern-based with unused sourceMappings', () => {
      const config = {
        categorization: {
          strategy: 'pattern-based',
          sourceMappings: {
            'src/actions': 'actions',
          },
        },
      };

      const result = validator.validateCategorizationStrategy(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Pattern-based strategy does not use sourceMappings - consider removing or switching strategy'
      );
    });

    it('should handle missing categorization configuration', () => {
      const config = {};

      const result = validator.validateCategorizationStrategy(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toEqual([
        'No categorization configuration found',
      ]);
    });

    it('should handle exceptions during strategy validation', () => {
      const config = null;

      const result = validator.validateCategorizationStrategy(config);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Strategy validation error/);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during categorization strategy validation',
        expect.any(Error)
      );
    });
  });

  describe('validateSourceMappings', () => {
    it('should validate correct source mappings', () => {
      const sourceMappings = {
        'src/actions': 'actions',
        'src/entities': 'entities',
        'src/engine': 'engine',
        'src/logging': 'logging',
        tests: 'tests',
      };

      const result = validator.validateSourceMappings(sourceMappings);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should reject null source mappings', () => {
      const result = validator.validateSourceMappings(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Source mappings must be a non-null object'
      );
    });

    it('should reject empty source mappings', () => {
      const result = validator.validateSourceMappings({});

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Source mappings cannot be empty');
    });

    it('should reject non-object source mappings', () => {
      const result = validator.validateSourceMappings('not-an-object');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Source mappings must be a non-null object'
      );
    });

    it('should reject invalid path keys', () => {
      const sourceMappings = {
        '': 'empty-path',
        'valid/path': 'valid',
      };

      const result = validator.validateSourceMappings(sourceMappings);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Source path '' must be a non-empty string"
      );
    });

    it('should reject invalid category values', () => {
      const sourceMappings = {
        'src/actions': '',
        'src/entities': 'valid',
      };

      const result = validator.validateSourceMappings(sourceMappings);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Category '' for path 'src/actions' must be a non-empty string"
      );
    });

    it('should warn about suspicious path patterns', () => {
      const sourceMappings = {
        '../suspicious/path': 'suspicious',
        'src\\windows\\path': 'windows',
        'valid/path': 'valid',
      };

      const result = validator.validateSourceMappings(sourceMappings);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        "Source path '../suspicious/path' contains suspicious characters"
      );
      expect(result.warnings).toContain(
        "Source path 'src\\windows\\path' contains suspicious characters"
      );
    });

    it('should warn about missing common paths', () => {
      const sourceMappings = {
        'custom/path': 'custom',
      };

      const result = validator.validateSourceMappings(sourceMappings);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Missing mappings for common paths: src/actions, src/entities, src/engine, src/logging, tests'
      );
    });

    it('should handle exceptions during source mappings validation', () => {
      // Force an exception by mocking Object.entries to fail
      const originalEntries = Object.entries;
      Object.entries = null;

      const result = validator.validateSourceMappings({ 'src/test': 'test' });

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Source mappings validation error/);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during source mappings validation',
        expect.any(Error)
      );

      Object.entries = originalEntries;
    });
  });

  describe('categorization semantic validation', () => {
    it('should validate source-based strategy with stack trace enabled', () => {
      const config = {
        categorization: {
          strategy: 'source-based',
          enableStackTraceExtraction: true,
          sourceMappings: { 'src/actions': 'actions' },
          performance: {
            stackTrace: { enabled: true },
          },
        },
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on source-based strategy without stack trace extraction', () => {
      const config = {
        categorization: {
          strategy: 'source-based',
          enableStackTraceExtraction: false,
        },
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Source-based categorization requires stack trace extraction to be enabled'
      );
    });

    it('should error on source-based strategy with disabled stack trace performance', () => {
      const config = {
        categorization: {
          strategy: 'source-based',
          performance: {
            stackTrace: { enabled: false },
          },
        },
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Source-based categorization requires stack trace performance settings to be enabled'
      );
    });

    it('should warn about hybrid strategy without preserved patterns', () => {
      const config = {
        categorization: {
          strategy: 'hybrid',
          migration: {
            preserveOldPatterns: false,
          },
        },
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Hybrid strategy should preserve old patterns for fallback'
      );
    });

    it('should warn about incomplete source mappings', () => {
      const config = {
        categorization: {
          sourceMappings: {
            'src/actions': 'actions',
            'src/entities': 'entities',
          },
        },
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Source mappings appear incomplete - fewer than 20 directories mapped'
      );
    });

    it('should warn about fallback category not in categories config', () => {
      const config = {
        categorization: {
          fallbackCategory: 'nonexistent',
        },
        categories: {
          actions: { enabled: true, level: 'info' },
          entities: { enabled: true, level: 'debug' },
        },
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        "Fallback category 'nonexistent' is not configured in categories"
      );
    });

    it('should warn about cache size vs TTL imbalance', () => {
      const config = {
        categorization: {
          performance: {
            stackTrace: {
              cache: {
                maxSize: 2000,
                ttl: 30000,
              },
            },
          },
        },
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Large cache size with short TTL may cause frequent cache churn'
      );
    });

    it('should warn about hybrid strategy with disabled stack trace performance', () => {
      const config = {
        categorization: {
          strategy: 'hybrid',
          performance: {
            stackTrace: { enabled: false },
          },
        },
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Hybrid strategy may have degraded performance with disabled stack trace'
      );
    });

    it('should warn about file buffer vs flush imbalance', () => {
      const config = {
        categorization: {
          performance: {
            fileOperations: {
              bufferSize: 800,
              flushInterval: 200,
            },
          },
        },
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Large file buffer with short flush interval may cause performance issues'
      );
    });

    it('should warn about excessive file handles', () => {
      const config = {
        categorization: {
          performance: {
            fileOperations: {
              maxFileHandles: 200,
            },
          },
        },
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Very high file handle limit may cause system resource issues'
      );
    });

    it('should warn about dual categorization performance impact', () => {
      const config = {
        categorization: {
          migration: {
            enableDualCategorization: true,
          },
        },
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = validator.validateSemanticRules(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Dual categorization enabled - may impact performance during migration'
      );
    });

    it('should handle unexpected errors during categorization semantic validation', () => {
      const keysSpy = jest.spyOn(Object, 'keys');
      keysSpy.mockImplementationOnce(() => {
        throw new Error('Categorization crash');
      });

      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = validator.validateSemanticRules({
        categorization: {
          sourceMappings: { 'src/actions': 'actions' },
        },
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Categorization validation error: Categorization crash'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during categorization semantic validation',
        expect.any(Error)
      );

      keysSpy.mockRestore();
    });
  });
});
